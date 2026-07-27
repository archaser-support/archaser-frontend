import { DbClient, prisma } from "@/lib/prisma";
import { ActivityService } from "@/server/services/ActivityService";
import { ActivityStatus } from "@/types/enums";
import { genericTimelineContentFormatter } from "@/utils/stringFormatters";

import {
    computeCustomerOutdatedDcl,
    resolveDclApprovedLimitAfterOutdatedRecompute,
} from "./customerOutdatedDcl";
import { computeCustomerOverdueBlock } from "./invoiceInsuranceFields";
import { getActiveCustomerPolicyRow } from "./resolveActiveCustomerPolicy";
import { syncCreditInsuranceGapPipelineForCustomer } from "./syncCreditInsuranceGapPipeline";
import { syncZeroLimitAlertFlagsForCustomer } from "./syncZeroLimitAlertFlags";

type SyncCustomerInsuranceFieldsOptions = {
    dbClient?: DbClient;
    runFollowUpEffects?: boolean;
    validateZeroLimitDate?: boolean;
    /** When set, gap pipeline only recomputes these invoices' gaps. */
    invoiceIds?: number[];
    /** Calendar day for overdue_block / DCL evaluation (chronological replay). */
    asOfDate?: Date;
    /** Recompute open-invoice terms-breach CTV flags after policy exclusion/limit-type changes. */
    refreshTermsBreachFlags?: boolean;
};

type SyncCustomerInsuranceFieldsCoreResult = {
    accountId: number | null;
    previousBlock: boolean;
    overdueBlock: boolean;
};

async function syncCustomerInsuranceFieldsCore(
    customerId: number,
    dbClient: DbClient,
    validateZeroLimitDate = false,
    asOfDate?: Date
): Promise<SyncCustomerInsuranceFieldsCoreResult> {
    const today = asOfDate ? new Date(asOfDate) : new Date();
    today.setHours(0, 0, 0, 0);

    const [overdueInvoices, customerRow, activePolicy] = await Promise.all([
        dbClient.invoice.findMany({
            where: {
                customer_id: customerId,
                status: "Overdue",
            },
            select: {
                due_date: true,
            },
        }),
        dbClient.customer.findUnique({
            where: { id: customerId },
            select: {
                overdue_block: true,
                account_id: true,
            },
        }),
        getActiveCustomerPolicyRow(customerId, dbClient),
    ]);

    let oldestDue: Date | null = null;
    for (const inv of overdueInvoices) {
        if (inv.due_date) {
            const d = new Date(inv.due_date);
            if (!oldestDue || d < oldestDue) {
                oldestDue = d;
            }
        }
    }

    const policyWithInsurance = activePolicy
        ? await dbClient.customerPolicy.findFirst({
              where: { id: activePolicy.id },
              select: {
                  id: true,
                  limit_type: true,
                  credit_score: true,
                  credit_score_input_date: true,
                  active_customer_since: true,
                  approved_limit: true,
                  approved_limit_expiration_date: true,
                  zero_limit_date: true,
                  max_allowed_mep: true,
                  approved_limit_currency: true,
                  InsurancePolicy: {
                      select: {
                          min_credit_score: true,
                          score_validity_period_months: true,
                          dcl_customer_since_months: true,
                          currency: true,
                          max_dcl: true,
                      },
                  },
              },
          })
        : null;

    const overdueBlock = computeCustomerOverdueBlock({
        oldestInvoiceOverdueDate: oldestDue,
        maxAllowedMepDays: policyWithInsurance?.max_allowed_mep ?? null,
        today,
    });

    const outdatedDcl = policyWithInsurance
        ? computeCustomerOutdatedDcl({
              limitType: policyWithInsurance.limit_type,
              creditScore: policyWithInsurance.credit_score,
              minCreditScore:
                  policyWithInsurance.InsurancePolicy?.min_credit_score ??
                  null,
              creditScoreInputDate: policyWithInsurance.credit_score_input_date,
              scoreValidityPeriodMonths:
                  policyWithInsurance.InsurancePolicy
                      ?.score_validity_period_months ?? null,
              activeCustomerSince: policyWithInsurance.active_customer_since,
              dclCustomerSinceMonths:
                  policyWithInsurance.InsurancePolicy
                      ?.dcl_customer_since_months ?? null,
              today,
          })
        : false;

    const approvedLimitPatch = policyWithInsurance
        ? resolveDclApprovedLimitAfterOutdatedRecompute({
              limitType: policyWithInsurance.limit_type,
              outdatedDcl,
              creditScore: policyWithInsurance.credit_score,
              minCreditScore:
                  policyWithInsurance.InsurancePolicy?.min_credit_score ??
                  null,
              userProvidedApprovedLimit: false,
              existingApprovedLimit: policyWithInsurance.approved_limit,
              patchedApprovedLimit: undefined,
              approvedLimitExpirationDate:
                  policyWithInsurance.approved_limit_expiration_date ?? null,
              zeroLimitDate: policyWithInsurance.zero_limit_date ?? null,
              policyMaxDcl:
                  policyWithInsurance.InsurancePolicy?.max_dcl ?? null,
              today,
          })
        : {};

    const previousBlock = customerRow?.overdue_block === true;

    await dbClient.customer.update({
        where: { id: customerId },
        data: {
            oldest_invoice_overdue_date: oldestDue,
            overdue_block: overdueBlock,
        },
    });

    if (policyWithInsurance) {
        await dbClient.customerPolicy.update({
            where: { id: policyWithInsurance.id },
            data: {
                outdated_dcl: outdatedDcl,
                approved_limit_currency:
                    policyWithInsurance.InsurancePolicy?.currency ??
                    policyWithInsurance.approved_limit_currency ??
                    null,
                ...approvedLimitPatch,
            },
        });
    }

    await syncZeroLimitAlertFlagsForCustomer({
        customerId,
        dbClient,
        validateZeroLimitDate,
    });

    return {
        accountId: customerRow?.account_id ?? null,
        previousBlock,
        overdueBlock,
    };
}

/**
 * Recomputes Customer.oldest_invoice_overdue_date and Customer.overdue_block from Invoice rows.
 * Policy-specific fields (MEP, DCL, limits) are read/written on active CustomerPolicy.
 */
export async function syncCustomerInsuranceFields(
    customerId: number,
    options: SyncCustomerInsuranceFieldsOptions = {}
): Promise<void> {
    const {
        dbClient,
        runFollowUpEffects = dbClient == null,
        validateZeroLimitDate = false,
        invoiceIds,
        asOfDate,
        refreshTermsBreachFlags = false,
    } = options;

    if (dbClient && runFollowUpEffects) {
        throw new Error(
            "syncCustomerInsuranceFields follow-up effects require a committed client"
        );
    }

    const syncResult = dbClient
        ? await syncCustomerInsuranceFieldsCore(
              customerId,
              dbClient,
              validateZeroLimitDate,
              asOfDate
          )
        : await prisma.$transaction(async (tx) =>
              syncCustomerInsuranceFieldsCore(
                  customerId,
                  tx as DbClient,
                  validateZeroLimitDate,
                  asOfDate
              )
          );

    if (
        runFollowUpEffects &&
        syncResult.accountId != null &&
        syncResult.previousBlock !== syncResult.overdueBlock
    ) {
        const openPeriod = await prisma.customerCollectionPeriod.findFirst({
            where: { customer_id: customerId, period_end_date: null },
            orderBy: { id: "desc" },
            select: { id: true },
        });

        try {
            const activityService = new ActivityService();
            const title = syncResult.overdueBlock
                ? "{{activities.fields.overdue_block_applied_title}}"
                : "{{activities.fields.overdue_block_cleared_title}}";
            const detail = syncResult.overdueBlock
                ? "{{activities.fields.overdue_block_applied_body}}"
                : "{{activities.fields.overdue_block_cleared_body}}";

            await activityService.createActivityWithFormattedDescription({
                customer_id: customerId,
                collection_period_id: openPeriod?.id ?? null,
                type: "Internal",
                title,
                content: genericTimelineContentFormatter([
                    {
                        label: "{{activities.fields.event}}",
                        value: detail,
                    },
                ]),
                account_id: syncResult.accountId,
                schedule_time: new Date(),
                actual_delivery_time: new Date(),
                status: ActivityStatus.COMPLETED,
                systemGenerated: true,
                titleParams: {
                    userId: "System",
                },
            });
        } catch (e) {
            console.error(
                "[syncCustomerInsuranceFields] Failed to log overdue_block activity",
                { customerId, overdueBlock: syncResult.overdueBlock, error: e }
            );
        }
    }

    if (runFollowUpEffects) {
        if (refreshTermsBreachFlags) {
            const { refreshTermsBreachFlagsForCustomer } = await import(
                "./syncInvoiceReportingBreach"
            );
            await refreshTermsBreachFlagsForCustomer(customerId);
        }
        await syncCreditInsuranceGapPipelineForCustomer(customerId, {
            invoiceIds,
        });
    }
}
