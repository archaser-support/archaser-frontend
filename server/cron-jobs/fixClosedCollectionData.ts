/*
    This cron job is used to fix closed collection data.
    
    Algorithm:
    1. Get all collection periods that were closed since last run
    2. Update invoices to paid status if they have no outstanding debt
    
    Note: Activity cancellation is handled by CollectionPeriodService.closeCollectionPeriod()
    when collection periods are closed. This job serves as a safety net for edge cases where:
    - Collection periods were closed but invoices weren't properly updated to PAID status
    - Legacy data from before the centralized closure method existed
    - Race conditions or partial failures during closure
    
    The invoice status update targets a specific scenario: invoices with customer_outstanding_debt = 0
    that are still marked as OVERDUE and belong to closed collection periods.
*/
import { prismaCron } from "@/lib/prisma";
const prisma = prismaCron();

import { INVOICE_STATUS } from "../services/InvoiceService";
import { syncCustomerInsuranceFields } from "../services/creditInsurance/syncCustomerInsuranceFields";

export const fixClosedCollectionData = async (
    last_run_at: Date,
    customerId?: number,
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
): Promise<void> => {
    const startTime = new Date();
    const processStats = {
        totalCollectionPeriods: 0,
        invoicesUpdated: 0,
    };

    const logStep = (
        step: string,
        message: string,
        level: "INFO" | "ERROR" | "WARNING" | "DEBUG",
        parameters?: any
    ) => {
        if (stepCollector) {
            stepCollector.addStep(step, message, level, parameters);
        }
        if (logCallback) {
            logCallback(message, level, parameters);
        }
    };

    try {
        logStep("START", "Starting fixClosedCollectionData process", "INFO", {
            processName: "fixClosedCollectionData",
            startTime: startTime.toISOString(),
            customerId: customerId || "ALL",
            last_run_at: last_run_at.toISOString(),
            step: "START",
            stepNumber: 1,
        });

        // Count collection periods closed since last run (for stats only)
        // This is a lightweight query that avoids fetching all IDs
        const getCollectionPeriodsStart = Date.now();
        const collectionPeriodsCount =
            await prisma.customerCollectionPeriod.count({
                where: {
                    period_end_date: {
                        gte: last_run_at,
                    },
                    ...(customerId && { customer_id: customerId }),
                },
            });
        const getCollectionPeriodsDuration =
            Date.now() - getCollectionPeriodsStart;
        processStats.totalCollectionPeriods = collectionPeriodsCount;

        if (collectionPeriodsCount === 0) {
            const totalDuration = Date.now() - startTime.getTime();
            logStep(
                "COMPLETE",
                "fixClosedCollectionData process completed - no closed collection periods found",
                "INFO",
                {
                    processName: "fixClosedCollectionData",
                    startTime: startTime.toISOString(),
                    customerId: customerId || "ALL",
                    step: "COMPLETE",
                    stepNumber: 2,
                    duration: totalDuration,
                    processStats,
                    performanceMetrics: {
                        getCollectionPeriods: getCollectionPeriodsDuration,
                        totalExecution: totalDuration,
                    },
                }
            );
            return;
        }

        // Update invoices to paid status if they have no customer outstanding debt
        // Filter directly by collection period relation to avoid N+1 queries
        // This eliminates the need to fetch collection period IDs first
        const affectedInvoices = await prisma.invoice.findMany({
            where: {
                customer_outstanding_debt: 0,
                status: "Overdue",
                CustomerCollectionPeriod: {
                    period_end_date: {
                        gte: last_run_at,
                    },
                    ...(customerId && { customer_id: customerId }),
                },
            },
            select: {
                customer_id: true,
            },
        });
        const affectedCustomerIds = Array.from(
            new Set(
                affectedInvoices
                    .map((invoice) => invoice.customer_id)
                    .filter(
                        (value): value is number =>
                            value !== null && value !== undefined
                    )
            )
        );
        const updateInvoicesStart = Date.now();
        const updateResult = await prisma.invoice.updateMany({
            where: {
                customer_outstanding_debt: 0,
                status: "Overdue",
                CustomerCollectionPeriod: {
                    period_end_date: {
                        gte: last_run_at,
                    },
                    ...(customerId && { customer_id: customerId }),
                },
            },
            data: {
                status: "Paid",
                zero_limit_alert: false,
            },
        });
        const updateInvoicesDuration = Date.now() - updateInvoicesStart;
        processStats.invoicesUpdated = updateResult.count;

        for (const affectedCustomerId of affectedCustomerIds) {
            await syncCustomerInsuranceFields(affectedCustomerId);
        }

        if (affectedCustomerIds.length > 0) {
            const { CustomerService } = await import(
                "@/server/services/CustomerService"
            );
            await CustomerService.recalculateAllAmountsForCustomers(
                affectedCustomerIds
            );
        }

        const totalDuration = Date.now() - startTime.getTime();
        logStep(
            "COMPLETE",
            "fixClosedCollectionData process completed successfully",
            "INFO",
            {
                processName: "fixClosedCollectionData",
                startTime: startTime.toISOString(),
                customerId: customerId || "ALL",
                last_run_at: last_run_at.toISOString(),
                step: "COMPLETE",
                stepNumber: 2,
                duration: totalDuration,
                processStats,
                performanceMetrics: {
                    getCollectionPeriods: getCollectionPeriodsDuration,
                    updateInvoices: updateInvoicesDuration,
                    totalExecution: totalDuration,
                },
            }
        );
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        const totalDuration = Date.now() - startTime.getTime();

        logStep(
            "ERROR",
            `fixClosedCollectionData process failed: ${error.message}`,
            "ERROR",
            {
                processName: "fixClosedCollectionData",
                error: error.message,
                stack: error.stack,
                processStats,
                duration: totalDuration,
            }
        );

        throw error;
    }
};
