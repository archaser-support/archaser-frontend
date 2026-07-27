import { Prisma } from "@prisma/client";

import { prismaCron } from "@/lib/prisma";
import { ActivityStatus } from "@/types/enums";
import { runInsurancePolicyStatusMaintenance } from "@/server/services/creditInsurance/insurancePolicyStatusCron";
import { syncCustomerInsuranceFields } from "@/server/services/creditInsurance/syncCustomerInsuranceFields";
import { sweepReportingBreachForOverdueInvoiceIds } from "@/server/services/creditInsurance/syncInvoiceReportingBreach";

const CUSTOMER_CHUNK = 2000;
const INVOICE_REPORTING_BREACH_CHUNK = 2000;

/**
 * Start of "today" as a calendar date in UTC (00:00:00.000Z).
 * Use when comparing {@link Prisma} `@db.Date` fields so results match PostgreSQL DATE
 * semantics and avoid off-by-one bugs from mixing local `startOfDay` with stored dates.
 */
function startOfTodayUtc(): Date {
    const n = new Date();
    return new Date(
        Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())
    );
}

/**
 * Timeline sorts/groups by {@link Activity.schedule_time} / delivery time.
 * Map the stored expiration calendar date to a stable instant on that UTC day so the row appears on the expiration date.
 */
function scheduleTimeOnApprovedLimitExpirationDate(expiration: Date): Date {
    return new Date(
        Date.UTC(
            expiration.getUTCFullYear(),
            expiration.getUTCMonth(),
            expiration.getUTCDate(),
            12,
            0,
            0,
            0
        )
    );
}

/**
 * Daily job:
 * - Customer: sync oldest_invoice_overdue_date + overdue_block for credit-insurance customers.
 * - Approved-limit expiration: reset approved_limit once expiration date is in the past.
 */
export default async function computeCustomerOverdueMetrics(
    customerIdFilter?: number,
    logCallback?: (
        message: string,
        level: "INFO" | "ERROR" | "WARNING" | "DEBUG",
        parameters?: any,
        results?: any
    ) => void,
    stepCollector?: {
        addStep: (
            step: string,
            message: string,
            level?: "INFO" | "ERROR" | "WARNING" | "DEBUG",
            parameters?: any,
            results?: any,
            duration?: number
        ) => void;
    }
): Promise<{
    success: boolean;
    message: string;
    summary?: any;
    duration: number;
}> {
    const start = Date.now();
    const log = (
        msg: string,
        level: "INFO" | "ERROR" | "WARNING" | "DEBUG" = "INFO",
        parameters?: any
    ) => {
        if (stepCollector) {
            stepCollector.addStep("METRICS", msg, level, parameters);
        }
        if (logCallback) {
            logCallback(msg, level, parameters);
        }
    };

    try {
        const prisma = prismaCron();

        let customersSynced = 0;
        let limitExpirationsProcessed = 0;
        let reportingBreachesPromoted = 0;
        let lastCustomerId = 0;
        let iteration = 0;

        for (;;) {
            iteration += 1;
            const chunk = await prisma.customer.findMany({
                where: {
                    id: { gt: lastCustomerId },
                    Account: { has_credit_insurance: true },
                    ...(typeof customerIdFilter === "number"
                        ? { id: customerIdFilter }
                        : {}),
                },
                select: { id: true },
                orderBy: { id: "asc" },
                take: CUSTOMER_CHUNK,
            });

            if (chunk.length === 0) {
                break;
            }

            const lastId = chunk[chunk.length - 1]!.id;
            if (lastId <= lastCustomerId) {
                log(
                    "computeCustomerOverdueMetrics: cursor did not advance — aborting",
                    "ERROR",
                    { lastId, lastCustomerId }
                );
                break;
            }
            lastCustomerId = lastId;

            for (const row of chunk) {
                await syncCustomerInsuranceFields(row.id);
                customersSynced += 1;
            }
        }

        // --- Reporting breach sweep (Due/Overdue invoices past target reporting date) ---
        let lastInvoiceId = 0;
        for (;;) {
            const invoiceBatch = await prisma.invoice.findMany({
                where: {
                    id: { gt: lastInvoiceId },
                    status: { in: ["Due", "Overdue"] },
                    actual_reporting_date: null,
                    target_reporting_date: { not: null },
                    reporting_breach: false,
                    Customer: {
                        Account: { has_credit_insurance: true },
                    },
                    ...(typeof customerIdFilter === "number"
                        ? { customer_id: customerIdFilter }
                        : {}),
                },
                select: { id: true },
                orderBy: { id: "asc" },
                take: INVOICE_REPORTING_BREACH_CHUNK,
            });

            if (invoiceBatch.length === 0) {
                break;
            }

            const lastId = invoiceBatch[invoiceBatch.length - 1]!.id;
            if (lastId <= lastInvoiceId) {
                log(
                    "computeCustomerOverdueMetrics: invoice cursor did not advance — aborting reporting breach sweep",
                    "ERROR",
                    { lastId, lastInvoiceId }
                );
                break;
            }
            lastInvoiceId = lastId;

            reportingBreachesPromoted +=
                await sweepReportingBreachForOverdueInvoiceIds(
                    invoiceBatch.map((row) => row.id),
                    prisma
                );
        }

        // --- Approved limit expiration step ---
        // Reset approved_limit the calendar day after approved_limit_expiration_date (stored as DATE).
        // Compare using UTC midnight "today" so @db.Date filters align with PostgreSQL DATE.
        const todayUtc = startOfTodayUtc();
        const expiredFromActivePolicy = await prisma.customerPolicy.findMany({
            where: {
                is_active: true,
                ...(typeof customerIdFilter === "number"
                    ? { customer_id: customerIdFilter }
                    : {}),
                Customer: {
                    Account: { has_credit_insurance: true },
                },
                approved_limit_expiration_date: {
                    not: null,
                    lt: todayUtc,
                },
                approved_limit: {
                    not: null,
                    gt: new Prisma.Decimal(0),
                },
            },
            select: {
                id: true,
                customer_id: true,
                approved_limit_expiration_date: true,
                Customer: {
                    select: { account_id: true },
                },
            },
        });

        const expirationTargets = expiredFromActivePolicy.map((row) => ({
            id: row.customer_id,
            account_id: row.Customer.account_id,
            approved_limit_expiration_date: row.approved_limit_expiration_date,
            customerPolicyId: row.id,
        }));

        for (const c of expirationTargets) {
            const expiration = c.approved_limit_expiration_date;
            if (!expiration) {
                continue;
            }
            const activityOnExpirationDay =
                scheduleTimeOnApprovedLimitExpirationDate(
                    expiration instanceof Date
                        ? expiration
                        : new Date(expiration)
                );

            await prisma.customerPolicy.update({
                where: { id: c.customerPolicyId },
                data: { approved_limit: new Prisma.Decimal(0) },
            });

            await prisma.activity.create({
                data: {
                    customer_id: c.id,
                    account_id: c.account_id,
                    type: "Internal",
                    status: ActivityStatus.COMPLETED,
                    system_generated: true,
                    content: "",
                    title: "{{activities.fields.activity_approved_limit_expired_reset_on_date}}",
                    schedule_time: activityOnExpirationDay,
                    actual_delivery_time: activityOnExpirationDay,
                    title_params: {
                        date: activityOnExpirationDay.toISOString(),
                    },
                },
            });

            limitExpirationsProcessed += 1;
        }
        // --- End approved limit expiration step ---

        const {
            policiesDeactivated,
            policiesPrematureDeactivated,
            policiesActivated,
            topUpsDeactivated,
            topUpsActivated,
        } = await runInsurancePolicyStatusMaintenance();

        const duration = Date.now() - start;
        log(
            `computeCustomerOverdueMetrics: customer_sync_passes=${customersSynced}, reporting_breaches_promoted=${reportingBreachesPromoted}, limit_expirations_processed=${limitExpirationsProcessed}, insurance_policies_deactivated=${policiesDeactivated}, insurance_policies_premature_deactivated=${policiesPrematureDeactivated}, insurance_policies_activated=${policiesActivated}, topup_policies_deactivated=${topUpsDeactivated}, topup_policies_activated=${topUpsActivated}`,
            "INFO",
            {
                customersSynced,
                reportingBreachesPromoted,
                limitExpirationsProcessed,
                policiesDeactivated,
                policiesPrematureDeactivated,
                policiesActivated,
                topUpsDeactivated,
                topUpsActivated,
                iterations: iteration,
            }
        );

        return {
            success: true,
            message: "computeCustomerOverdueMetrics completed",
            summary: {
                customersSynced,
                reportingBreachesPromoted,
                limitExpirationsProcessed,
                policiesDeactivated,
                policiesPrematureDeactivated,
                policiesActivated,
                topUpsDeactivated,
                topUpsActivated,
                iterations: iteration,
            },
            duration,
        };
    } catch (e: unknown) {
        const message =
            e instanceof Error ? e.message : "computeCustomerOverdueMetrics failed";
        log(message, "ERROR", {
            stack: e instanceof Error ? e.stack : undefined,
        });
        if (e instanceof Error) {
            throw e;
        }
        throw new Error(message);
    }
}
