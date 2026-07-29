import { Prisma, type customer_limit_type } from "@prisma/client";

import { type DbClient, prisma } from "@/lib/prisma";
import { InsurancePolicyService } from "@/server/services/InsurancePolicyService";
import { startOfTodayUtc } from "@/shared/creditInsurance/insurancePolicyLifecycle";

import { getPolicyCountryDefaultsForCustomer } from "./applyPolicyCountryDefaults";
import {
    computeCustomerOutdatedDcl,
    resolveDclApprovedLimitAfterOutdatedRecompute,
} from "./customerOutdatedDcl";
import {
    emptyEffectiveCustomerPolicyFields,
    type CustomerPolicyWriteInput,
    type EffectiveCustomerPolicyFields,
    mapCustomerPolicyRow,
} from "./customerPolicyTypes";
import {
    hasMeaningfulCustomerPolicyFieldChange,
    pickCustomerPolicyVersioningSnapshot,
} from "./hasMeaningfulCustomerPolicyFieldChange";
import {
    freezeCustomerPolicyGapOnDeactivation,
} from "./syncCustomerPolicyGapAmounts";
import { syncCreditInsuranceGapPipelineForCustomer } from "./syncCreditInsuranceGapPipeline";
import { nullGapPayload } from "./computePolicyGapAmounts";
import {
    getActiveCustomerPolicyRow,
    listCustomerPolicyHistory,
} from "./resolveActiveCustomerPolicy";
import {
    deriveExcludedFromPolicy,
    isAllowedPolicyExclusionReason,
    isCustomerPolicyExcluded,
    normalizePolicyExclusionReason,
} from "./policyExclusion";

function parseDecimalOrNull(
    value: unknown
): Prisma.Decimal | null | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (value === null || value === "") {
        return null;
    }
    return new Prisma.Decimal(String(value));
}

function parseDateOrNull(value: unknown): Date | null | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (value === null || value === "") {
        return null;
    }
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? null : d;
}

function parseIntOrNull(value: unknown): number | null | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (value === null || value === "") {
        return null;
    }
    const n = parseInt(String(value), 10);
    return Number.isNaN(n) ? null : n;
}

export class CustomerPolicyService {
    static listHistory(customerId: number) {
        return listCustomerPolicyHistory(customerId);
    }

    static async getActiveFields(
        customerId: number
    ): Promise<EffectiveCustomerPolicyFields | null> {
        const active = await getActiveCustomerPolicyRow(customerId);
        return active ? mapCustomerPolicyRow(active) : null;
    }

    /**
     * Enqueue an as-of rewrite for a customer whose policy limit/config changed.
     * Limits are not effective-dated, so the corrected limit applies across the
     * customer's whole history: anchor at the earliest invoice_date through today.
     * Runs on the caller's client so it is atomic with the change, and never
     * throws into the mutation.
     */
    private static async enqueuePolicyHistoryRewrite(
        client: DbClient,
        accountId: number,
        customerId: number
    ): Promise<void> {
        try {
            const agg = await client.invoice.aggregate({
                where: { customer_id: customerId },
                _min: { invoice_date: true },
            });
            const fromDate = agg._min.invoice_date;
            if (!fromDate) {
                return;
            }
            const { enqueueAsOfRewriteInTransaction } = await import(
                "./asOfRewriteQueue"
            );
            await enqueueAsOfRewriteInTransaction(client, {
                accountId,
                customerIds: [customerId],
                fromDate,
                toDate: startOfTodayUtc(),
            });
        } catch {
            // Non-fatal: enqueue must never break a policy save
        }
    }

    /** Apply credit-insurance patch to active CustomerPolicy (creates row if missing). */
    static async applyActivePolicyPatch(args: {
        customerId: number;
        accountId: number;
        countryId: number | null;
        customerNumber: string | null;
        modifiedBy: string | null;
        patch: CustomerPolicyWriteInput & {
            policy_id?: number | null;
            credit_score?: unknown;
            credit_score_input_date?: Date | null;
            outdated_dcl?: boolean;
        };
        existingCountryId: number | null;
        existing: EffectiveCustomerPolicyFields;
        dbClient?: DbClient;
        /** Policies-tab save only: copy-on-write when allowlisted fields change. */
        enableCopyOnWriteVersioning?: boolean;
    }): Promise<{ error?: string; refreshTermsBreachFlags?: boolean }> {
        const dbClient = args.dbClient ?? prisma;
        const active = await getActiveCustomerPolicyRow(args.customerId, dbClient);
        const base = active
            ? mapCustomerPolicyRow(active)
            : args.existing.customerPolicyRowId != null
              ? args.existing
              : emptyEffectiveCustomerPolicyFields();

        const next: CustomerPolicyWriteInput & {
            insurance_policy_id?: number | null;
        } = {
            insurance_policy_id: base.insurance_policy_id,
            customer_number_policy: base.customer_number_policy,
            approved_limit: base.approved_limit,
            approved_limit_currency: base.approved_limit_currency,
            approved_limit_expiration_date: base.approved_limit_expiration_date,
            zero_limit_date: base.zero_limit_date,
            limit_type: base.limit_type,
            max_payment_term: base.max_payment_term,
            max_allowed_mep: base.max_allowed_mep,
            reporting_days: base.reporting_days,
            mep_cutoff_day_of_month: base.mep_cutoff_day_of_month,
            mep_substitute_day_of_month: base.mep_substitute_day_of_month,
            reporting_cutoff_day_of_month: base.reporting_cutoff_day_of_month,
            reporting_substitute_day_of_month: base.reporting_substitute_day_of_month,
            payment_term_cutoff_day_of_month: base.payment_term_cutoff_day_of_month,
            payment_term_substitute_day_of_month:
                base.payment_term_substitute_day_of_month,
            excluded_from_policy: base.excluded_from_policy,
            policy_exclusion_reason: base.policy_exclusion_reason,
            credit_score: base.credit_score,
            credit_score_input_date: base.credit_score_input_date,
            active_customer_since: base.active_customer_since,
            outdated_dcl: base.outdated_dcl,
        };

        if (args.patch.policy_id !== undefined) {
            const pid =
                args.patch.policy_id === null
                    ? null
                    : Number(args.patch.policy_id);
            if (pid !== null && !Number.isNaN(pid)) {
                const pol = await InsurancePolicyService.findAssignablePrimaryPolicy(
                    args.accountId,
                    pid
                );
                if (!pol) {
                    return {
                        error: "Invalid or inactive policy for this account",
                    };
                }
                next.insurance_policy_id = pid;
                const def = await getPolicyCountryDefaultsForCustomer(
                    pid,
                    args.countryId ?? args.existingCountryId
                );
                if (def) {
                    if (def.reporting_days != null) {
                        next.reporting_days = def.reporting_days;
                    }
                    if (def.max_payment_term != null) {
                        next.max_payment_term = def.max_payment_term;
                    }
                    if (def.max_allowed_mep != null) {
                        next.max_allowed_mep = def.max_allowed_mep;
                    }
                }
                const policyMonthEnd = await dbClient.insurancePolicy.findFirst({
                    where: { id: pid, account_id: args.accountId },
                    select: {
                        mep_cutoff_day_of_month: true,
                        mep_substitute_day_of_month: true,
                        reporting_cutoff_day_of_month: true,
                        reporting_substitute_day_of_month: true,
                        payment_term_cutoff_day_of_month: true,
                        payment_term_substitute_day_of_month: true,
                    },
                });
                if (policyMonthEnd) {
                    next.mep_cutoff_day_of_month =
                        policyMonthEnd.mep_cutoff_day_of_month;
                    next.mep_substitute_day_of_month =
                        policyMonthEnd.mep_substitute_day_of_month;
                    next.reporting_cutoff_day_of_month =
                        policyMonthEnd.reporting_cutoff_day_of_month;
                    next.reporting_substitute_day_of_month =
                        policyMonthEnd.reporting_substitute_day_of_month;
                    next.payment_term_cutoff_day_of_month =
                        policyMonthEnd.payment_term_cutoff_day_of_month;
                    next.payment_term_substitute_day_of_month =
                        policyMonthEnd.payment_term_substitute_day_of_month;
                }
            } else {
                next.insurance_policy_id = null;
            }
        }

        if (args.patch.insurance_policy_id !== undefined) {
            const pid = args.patch.insurance_policy_id;
            if (pid !== null && pid !== undefined) {
                const pol = await InsurancePolicyService.findAssignablePrimaryPolicy(
                    args.accountId,
                    Number(pid)
                );
                if (!pol) {
                    return {
                        error: "Invalid or inactive policy for this account",
                    };
                }
            }
            next.insurance_policy_id = args.patch.insurance_policy_id;
        }
        if (args.patch.approved_limit !== undefined) {
            next.approved_limit = parseDecimalOrNull(args.patch.approved_limit);
        }
        if (args.patch.approved_limit_expiration_date !== undefined) {
            next.approved_limit_expiration_date = parseDateOrNull(
                args.patch.approved_limit_expiration_date
            );
        }
        if (args.patch.zero_limit_date !== undefined) {
            next.zero_limit_date = parseDateOrNull(args.patch.zero_limit_date);
        }
        if (args.patch.limit_type !== undefined) {
            next.limit_type = args.patch.limit_type;
        }
        if (args.patch.customer_number_policy !== undefined) {
            next.customer_number_policy =
                args.patch.customer_number_policy === null ||
                args.patch.customer_number_policy === ""
                    ? null
                    : String(args.patch.customer_number_policy).trim();
        }
        if (args.patch.max_payment_term !== undefined) {
            next.max_payment_term = parseIntOrNull(args.patch.max_payment_term);
        }
        if (args.patch.max_allowed_mep !== undefined) {
            next.max_allowed_mep = parseIntOrNull(args.patch.max_allowed_mep);
        }
        if (args.patch.reporting_days !== undefined) {
            next.reporting_days = parseIntOrNull(args.patch.reporting_days);
        }
        if (args.patch.mep_cutoff_day_of_month !== undefined) {
            next.mep_cutoff_day_of_month = parseIntOrNull(
                args.patch.mep_cutoff_day_of_month
            );
        }
        if (args.patch.mep_substitute_day_of_month !== undefined) {
            next.mep_substitute_day_of_month = parseIntOrNull(
                args.patch.mep_substitute_day_of_month
            );
        }
        if (args.patch.reporting_cutoff_day_of_month !== undefined) {
            next.reporting_cutoff_day_of_month = parseIntOrNull(
                args.patch.reporting_cutoff_day_of_month
            );
        }
        if (args.patch.reporting_substitute_day_of_month !== undefined) {
            next.reporting_substitute_day_of_month = parseIntOrNull(
                args.patch.reporting_substitute_day_of_month
            );
        }
        if (args.patch.payment_term_cutoff_day_of_month !== undefined) {
            next.payment_term_cutoff_day_of_month = parseIntOrNull(
                args.patch.payment_term_cutoff_day_of_month
            );
        }
        if (args.patch.payment_term_substitute_day_of_month !== undefined) {
            next.payment_term_substitute_day_of_month = parseIntOrNull(
                args.patch.payment_term_substitute_day_of_month
            );
        }
        if (args.patch.policy_exclusion_reason !== undefined) {
            const normalizedReason = normalizePolicyExclusionReason(
                args.patch.policy_exclusion_reason
            );
            if (
                normalizedReason !== null &&
                !isAllowedPolicyExclusionReason(normalizedReason)
            ) {
                return {
                    error: "Invalid policy exclusion reason",
                };
            }
            next.policy_exclusion_reason = normalizedReason;
        }
        next.excluded_from_policy = deriveExcludedFromPolicy(
            next.policy_exclusion_reason
        );

        const effectiveLimitType = next.limit_type ?? base.limit_type;
        // Clear exclusion only when switching from a non-Named type to Named.
        const switchedToNamed =
            effectiveLimitType === "Named" && base.limit_type !== "Named";
        if (switchedToNamed) {
            next.excluded_from_policy = false;
            next.policy_exclusion_reason = null;
        }

        const switchedToDcl =
            effectiveLimitType === "DCL" && base.limit_type !== "DCL";
        if (switchedToDcl) {
            next.policy_exclusion_reason = "Pending review";
            next.excluded_from_policy = true;
        }

        const exclusionSet =
            !isCustomerPolicyExcluded(base.policy_exclusion_reason) &&
            isCustomerPolicyExcluded(next.policy_exclusion_reason);
        const limitTypeChanged = effectiveLimitType !== base.limit_type;
        const refreshTermsBreachFlags = limitTypeChanged;

        let scoreChanged = false;
        if (args.patch.credit_score !== undefined) {
            const parsed = parseDecimalOrNull(args.patch.credit_score);
            const prev = base.credit_score;
            if (prev == null && (parsed == null || parsed === undefined)) {
                scoreChanged = false;
            } else if (prev == null || parsed == null || parsed === undefined) {
                scoreChanged = true;
            } else {
                scoreChanged = !new Prisma.Decimal(prev).equals(parsed);
            }
            next.credit_score = parsed ?? null;
            if (scoreChanged) {
                if (parsed == null || parsed === undefined) {
                    next.credit_score_input_date = null;
                } else {
                    const d = new Date();
                    d.setUTCHours(0, 0, 0, 0);
                    next.credit_score_input_date = d;
                }
            }
        }
        if (args.patch.credit_score_input_date !== undefined) {
            next.credit_score_input_date = parseDateOrNull(
                args.patch.credit_score_input_date
            );
        }
        if (args.patch.active_customer_since !== undefined) {
            next.active_customer_since = parseDateOrNull(
                args.patch.active_customer_since
            );
        }

        const shouldRecomputeOutdatedDcl =
            args.patch.policy_id !== undefined ||
            args.patch.insurance_policy_id !== undefined ||
            args.patch.limit_type !== undefined ||
            args.patch.credit_score !== undefined ||
            args.patch.credit_score_input_date !== undefined ||
            args.patch.active_customer_since !== undefined;

        if (shouldRecomputeOutdatedDcl) {
            const nextPolicyId = next.insurance_policy_id ?? null;
            const policyForOutdatedDcl =
                nextPolicyId == null
                    ? null
                    : await dbClient.insurancePolicy.findFirst({
                          where: { id: nextPolicyId, account_id: args.accountId },
                          select: {
                              min_credit_score: true,
                              score_validity_period_months: true,
                              dcl_customer_since_months: true,
                              max_dcl: true,
                          },
                      });

            next.outdated_dcl = computeCustomerOutdatedDcl({
                limitType: next.limit_type ?? base.limit_type,
                creditScore: next.credit_score ?? base.credit_score,
                minCreditScore: policyForOutdatedDcl?.min_credit_score ?? null,
                creditScoreInputDate:
                    next.credit_score_input_date ?? base.credit_score_input_date,
                scoreValidityPeriodMonths:
                    policyForOutdatedDcl?.score_validity_period_months ?? null,
                activeCustomerSince:
                    next.active_customer_since ?? base.active_customer_since,
                dclCustomerSinceMonths:
                    policyForOutdatedDcl?.dcl_customer_since_months ?? null,
            });

            const limitAdjust = resolveDclApprovedLimitAfterOutdatedRecompute({
                limitType: next.limit_type ?? base.limit_type,
                outdatedDcl: Boolean(next.outdated_dcl),
                creditScore: next.credit_score ?? base.credit_score,
                minCreditScore: policyForOutdatedDcl?.min_credit_score ?? null,
                userProvidedApprovedLimit: args.patch.approved_limit !== undefined,
                existingApprovedLimit: base.approved_limit,
                patchedApprovedLimit: next.approved_limit,
                approvedLimitExpirationDate:
                    next.approved_limit_expiration_date ??
                    base.approved_limit_expiration_date,
                zeroLimitDate: next.zero_limit_date ?? base.zero_limit_date,
                policyMaxDcl: policyForOutdatedDcl?.max_dcl ?? null,
                today: new Date(),
            });
            if (limitAdjust.approved_limit !== undefined) {
                next.approved_limit = limitAdjust.approved_limit as Prisma.Decimal;
            }
        } else if (args.patch.outdated_dcl !== undefined) {
            next.outdated_dcl = Boolean(args.patch.outdated_dcl);
        }

        const rowData = {
            insurance_policy_id: next.insurance_policy_id ?? null,
            customer_number_policy: next.customer_number_policy ?? null,
            approved_limit: next.approved_limit ?? null,
            approved_limit_currency: next.approved_limit_currency ?? null,
            approved_limit_expiration_date:
                next.approved_limit_expiration_date ?? null,
            zero_limit_date: next.zero_limit_date ?? null,
            limit_type: next.limit_type ?? null,
            max_payment_term: next.max_payment_term ?? null,
            max_allowed_mep: next.max_allowed_mep ?? null,
            reporting_days: next.reporting_days ?? null,
            mep_cutoff_day_of_month: next.mep_cutoff_day_of_month ?? null,
            mep_substitute_day_of_month: next.mep_substitute_day_of_month ?? null,
            reporting_cutoff_day_of_month:
                next.reporting_cutoff_day_of_month ?? null,
            reporting_substitute_day_of_month:
                next.reporting_substitute_day_of_month ?? null,
            payment_term_cutoff_day_of_month:
                next.payment_term_cutoff_day_of_month ?? null,
            payment_term_substitute_day_of_month:
                next.payment_term_substitute_day_of_month ?? null,
            excluded_from_policy: next.excluded_from_policy ?? false,
            policy_exclusion_reason: next.policy_exclusion_reason ?? null,
            credit_score: next.credit_score ?? null,
            credit_score_input_date: next.credit_score_input_date ?? null,
            active_customer_since: next.active_customer_since ?? null,
            outdated_dcl: next.outdated_dcl ?? false,
            modified_by: args.modifiedBy,
        };

        if (exclusionSet) {
            Object.assign(rowData, nullGapPayload(), {
                retained_capacity_gap: null,
            });
        }

        if (active && args.enableCopyOnWriteVersioning) {
            const beforeSnapshot = pickCustomerPolicyVersioningSnapshot(base);
            const afterSnapshot = pickCustomerPolicyVersioningSnapshot(next);
            const policyIdUnchanged =
                beforeSnapshot.insurance_policy_id ===
                afterSnapshot.insurance_policy_id;
            const hasMeaningfulChange = hasMeaningfulCustomerPolicyFieldChange(
                beforeSnapshot,
                afterSnapshot
            );

            if (policyIdUnchanged && !hasMeaningfulChange) {
                return {};
            }

            if (policyIdUnchanged && hasMeaningfulChange) {
                await freezeCustomerPolicyGapOnDeactivation(
                    args.customerId,
                    active.id,
                    dbClient
                );
                await dbClient.customerPolicy.update({
                    where: { id: active.id },
                    data: {
                        is_active: false,
                        modified_by: args.modifiedBy,
                    },
                });
                await dbClient.customerPolicy.create({
                    data: {
                        customer_id: args.customerId,
                        is_active: true,
                        created_by: args.modifiedBy,
                        ...rowData,
                    },
                });
                if (exclusionSet) {
                    const { syncInvoiceCapacityGapAmountsForCustomer } =
                        await import("./syncInvoiceCapacityGapAmounts");
                    await syncInvoiceCapacityGapAmountsForCustomer(
                        args.customerId,
                        { dbClient }
                    );
                }
                await CustomerPolicyService.enqueuePolicyHistoryRewrite(
                    dbClient,
                    args.accountId,
                    args.customerId
                );
                return refreshTermsBreachFlags
                    ? { refreshTermsBreachFlags: true }
                    : {};
            }
        }

        if (active) {
            await dbClient.customerPolicy.update({
                where: { id: active.id },
                data: rowData,
            });
        } else {
            await dbClient.customerPolicy.create({
                data: {
                    customer_id: args.customerId,
                    is_active: true,
                    created_by: args.modifiedBy,
                    ...rowData,
                },
            });
        }

        const refreshed = await getActiveCustomerPolicyRow(args.customerId, dbClient);
        const effective = refreshed
            ? mapCustomerPolicyRow(refreshed)
            : {
                  ...base,
                  insurance_policy_id: rowData.insurance_policy_id,
                  customer_number_policy: rowData.customer_number_policy,
                  approved_limit: rowData.approved_limit as Prisma.Decimal | null,
                  approved_limit_expiration_date:
                      rowData.approved_limit_expiration_date,
                  zero_limit_date: rowData.zero_limit_date,
                  limit_type: rowData.limit_type,
                  max_payment_term: rowData.max_payment_term,
                  max_allowed_mep: rowData.max_allowed_mep,
                  reporting_days: rowData.reporting_days,
                  mep_cutoff_day_of_month: rowData.mep_cutoff_day_of_month,
                  mep_substitute_day_of_month: rowData.mep_substitute_day_of_month,
                  reporting_cutoff_day_of_month:
                      rowData.reporting_cutoff_day_of_month,
                  reporting_substitute_day_of_month:
                      rowData.reporting_substitute_day_of_month,
                  payment_term_cutoff_day_of_month:
                      rowData.payment_term_cutoff_day_of_month,
                  payment_term_substitute_day_of_month:
                      rowData.payment_term_substitute_day_of_month,
                  excluded_from_policy: rowData.excluded_from_policy,
                  policy_exclusion_reason: rowData.policy_exclusion_reason,
                  credit_score: rowData.credit_score as Prisma.Decimal | null,
                  credit_score_input_date: rowData.credit_score_input_date,
                  active_customer_since: rowData.active_customer_since,
                  outdated_dcl: rowData.outdated_dcl,
              };

        if (exclusionSet) {
            const { syncInvoiceCapacityGapAmountsForCustomer } = await import(
                "./syncInvoiceCapacityGapAmounts"
            );
            await syncInvoiceCapacityGapAmountsForCustomer(args.customerId, {
                dbClient,
            });
        }

        await CustomerPolicyService.enqueuePolicyHistoryRewrite(
            dbClient,
            args.accountId,
            args.customerId
        );

        return refreshTermsBreachFlags
            ? { refreshTermsBreachFlags: true }
            : {};
    }

    /**
     * Switch active policy: deactivate current row, create new active row from prefill.
     */
    static async switchActivePolicy(args: {
        customerId: number;
        accountId: number;
        newInsurancePolicyId: number;
        countryId: number | null;
        customerNumber: string | null;
        customerNumberPolicy: string | null;
        limitType?: customer_limit_type | null;
        modifiedBy: string | null;
        dbClient?: DbClient;
    }): Promise<{ error?: string }> {
        const dbClient = args.dbClient ?? prisma;
        const pol = await InsurancePolicyService.findAssignablePrimaryPolicy(
            args.accountId,
            args.newInsurancePolicyId
        );
        if (!pol) {
            return { error: "Invalid or inactive policy" };
        }

        let prefill = await InsurancePolicyService.getCustomerPrefillForEdit({
            policyId: args.newInsurancePolicyId,
            accountId: args.accountId,
            countryId: args.countryId,
            customerNumber: args.customerNumber,
            customerNumberPolicy: args.customerNumberPolicy,
            namedMatchByPolicyCustomerNumberOnly:
                args.limitType === "Named",
        });

        if (prefill && "source" in prefill && prefill.source === "no_named_match") {
            prefill = await InsurancePolicyService.getCustomerPrefillForEdit({
                policyId: args.newInsurancePolicyId,
                accountId: args.accountId,
                countryId: args.countryId,
                customerNumber: args.customerNumber,
                customerNumberPolicy: args.customerNumberPolicy,
                namedMatchByPolicyCustomerNumberOnly: false,
            });
        }

        const activeBeforeSwitch = await getActiveCustomerPolicyRow(
            args.customerId,
            dbClient
        );

        const runSwitch = async (tx: DbClient) => {
            if (activeBeforeSwitch) {
                await freezeCustomerPolicyGapOnDeactivation(
                    args.customerId,
                    activeBeforeSwitch.id,
                    tx
                );
            }
            await tx.customerPolicy.updateMany({
                where: { customer_id: args.customerId, is_active: true },
                data: { is_active: false, modified_by: args.modifiedBy },
            });

            const p = prefill && "limit_type" in prefill ? prefill : null;
            await tx.customerPolicy.create({
                data: {
                    customer_id: args.customerId,
                    insurance_policy_id: args.newInsurancePolicyId,
                    is_active: true,
                    limit_type:
                        args.limitType ??
                        (p?.limit_type as customer_limit_type) ??
                        "DCL",
                    max_payment_term: p?.max_payment_term ?? null,
                    max_allowed_mep: p?.max_allowed_mep ?? null,
                    reporting_days: p?.reporting_days ?? null,
                    mep_cutoff_day_of_month: p?.mep_cutoff_day_of_month ?? null,
                    mep_substitute_day_of_month:
                        p?.mep_substitute_day_of_month ?? null,
                    reporting_cutoff_day_of_month:
                        p?.reporting_cutoff_day_of_month ?? null,
                    reporting_substitute_day_of_month:
                        p?.reporting_substitute_day_of_month ?? null,
                    payment_term_cutoff_day_of_month:
                        p?.payment_term_cutoff_day_of_month ?? null,
                    payment_term_substitute_day_of_month:
                        p?.payment_term_substitute_day_of_month ?? null,
                    approved_limit:
                        p?.approved_limit != null
                            ? new Prisma.Decimal(String(p.approved_limit))
                            : null,
                    approved_limit_expiration_date:
                        p?.approved_limit_expiration_date ?? null,
                    zero_limit_date: null,
                    customer_number_policy:
                        p?.customer_number_policy ??
                        args.customerNumberPolicy ??
                        null,
                    credit_score:
                        p?.credit_score != null
                            ? new Prisma.Decimal(String(p.credit_score))
                            : null,
                    credit_score_input_date: p?.credit_score
                        ? new Date()
                        : null,
                    created_by: args.modifiedBy,
                    modified_by: args.modifiedBy,
                },
            });
        };

        if (args.dbClient) {
            await runSwitch(dbClient);
        } else {
            await prisma.$transaction(async (tx) => {
                await runSwitch(tx as DbClient);
            });
        }

        if (!args.dbClient) {
            await syncCreditInsuranceGapPipelineForCustomer(args.customerId, {
                skipPolicyAggregate: false,
            });
        }

        await CustomerPolicyService.enqueuePolicyHistoryRewrite(
            dbClient,
            args.accountId,
            args.customerId
        );

        return {};
    }

    /**
     * Bulk replace: all active CustomerPolicy rows on old policy → new policy with full prefill.
     */
    static async bulkReplacePolicy(args: {
        accountId: number;
        oldPolicyId: number;
        newPolicyId: number;
        modifiedBy: string | null;
    }): Promise<{ updatedCount: number; error?: string }> {
        if (args.oldPolicyId === args.newPolicyId) {
            return { updatedCount: 0, error: "Old and new policy must differ" };
        }

        const [oldPol] = await Promise.all([
            prisma.insurancePolicy.findFirst({
                where: {
                    id: args.oldPolicyId,
                    account_id: args.accountId,
                },
            }),
        ]);

        if (!oldPol) {
            return { updatedCount: 0, error: "Old policy not found" };
        }
        const newPolAssignable =
            await InsurancePolicyService.findAssignablePrimaryPolicy(
                args.accountId,
                args.newPolicyId
            );
        if (!newPolAssignable) {
            return {
                updatedCount: 0,
                error: "New policy not found or not assignable",
            };
        }

        const newPol = await prisma.insurancePolicy.findFirst({
            where: {
                id: args.newPolicyId,
                account_id: args.accountId,
            },
        });
        if (!newPol) {
            return {
                updatedCount: 0,
                error: "New policy not found or not assignable",
            };
        }

        const activeRows = await prisma.customerPolicy.findMany({
            where: {
                is_active: true,
                insurance_policy_id: args.oldPolicyId,
                Customer: { account_id: args.accountId },
            },
            include: {
                Customer: {
                    select: {
                        id: true,
                        country_id: true,
                        customer_number: true,
                    },
                },
            },
        });

        let updatedCount = 0;
        for (const row of activeRows) {
            const c = row.Customer;
            if (!c) {
                continue;
            }
            const prefill = await InsurancePolicyService.getCustomerPrefillForEdit(
                {
                    policyId: args.newPolicyId,
                    accountId: args.accountId,
                    countryId: c.country_id,
                    customerNumber: c.customer_number,
                    customerNumberPolicy: row.customer_number_policy,
                    namedMatchByPolicyCustomerNumberOnly:
                        row.limit_type === "Named",
                }
            );

            if (
                prefill &&
                "source" in prefill &&
                prefill.source === "no_named_match"
            ) {
                continue;
            }

            const p = prefill && "limit_type" in prefill ? prefill : null;
            const outdated_dcl = computeCustomerOutdatedDcl({
                limitType: (p?.limit_type as string) ?? row.limit_type,
                creditScore: p?.credit_score ?? row.credit_score,
                minCreditScore: newPol.min_credit_score,
                creditScoreInputDate: p?.credit_score ? new Date() : null,
                scoreValidityPeriodMonths: newPol.score_validity_period_months,
                activeCustomerSince: row.active_customer_since,
                dclCustomerSinceMonths: newPol.dcl_customer_since_months,
            });

            await prisma.customerPolicy.update({
                where: { id: row.id },
                data: {
                    insurance_policy_id: args.newPolicyId,
                    limit_type:
                        (p?.limit_type as customer_limit_type) ?? row.limit_type,
                    max_payment_term: p?.max_payment_term ?? row.max_payment_term,
                    max_allowed_mep: p?.max_allowed_mep ?? row.max_allowed_mep,
                    reporting_days: p?.reporting_days ?? row.reporting_days,
                    mep_cutoff_day_of_month:
                        p?.mep_cutoff_day_of_month ?? row.mep_cutoff_day_of_month,
                    mep_substitute_day_of_month:
                        p?.mep_substitute_day_of_month ??
                        row.mep_substitute_day_of_month,
                    reporting_cutoff_day_of_month:
                        p?.reporting_cutoff_day_of_month ??
                        row.reporting_cutoff_day_of_month,
                    reporting_substitute_day_of_month:
                        p?.reporting_substitute_day_of_month ??
                        row.reporting_substitute_day_of_month,
                    payment_term_cutoff_day_of_month:
                        p?.payment_term_cutoff_day_of_month ??
                        row.payment_term_cutoff_day_of_month,
                    payment_term_substitute_day_of_month:
                        p?.payment_term_substitute_day_of_month ??
                        row.payment_term_substitute_day_of_month,
                    approved_limit:
                        p?.approved_limit != null
                            ? new Prisma.Decimal(String(p.approved_limit))
                            : row.approved_limit,
                    approved_limit_expiration_date:
                        p?.approved_limit_expiration_date ??
                        row.approved_limit_expiration_date,
                    zero_limit_date: row.zero_limit_date ?? null,
                    customer_number_policy:
                        p?.customer_number_policy ?? row.customer_number_policy,
                    credit_score:
                        p?.credit_score != null
                            ? new Prisma.Decimal(String(p.credit_score))
                            : row.credit_score,
                    credit_score_input_date: p?.credit_score
                        ? new Date()
                        : row.credit_score_input_date,
                    outdated_dcl,
                    modified_by: args.modifiedBy,
                },
            });

            await syncCreditInsuranceGapPipelineForCustomer(c.id);
            await CustomerPolicyService.enqueuePolicyHistoryRewrite(
                prisma,
                args.accountId,
                c.id
            );
            updatedCount += 1;
        }

        return { updatedCount };
    }
}
