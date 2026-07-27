/*
    This cron job is used to handle overdue invoices.
    
    Algorithm:
    1. Get all overdue invoices
    2. Update the status of the invoices to overdue
    3. Calculate the outstanding amounts
    4. Activate the customers (only if outstanding debt > 0)
    5. Create/update customer collection periods for newly activated customers
    
    Optimizations:
    - Batch fetching to avoid N+1 queries (similar to workflowManager pattern)
    - Single customer query with all needed relations
    - Consolidated customer ID extraction
    - Efficient oldest overdue date calculation
*/
import { prismaCron } from "@/lib/prisma";
const prisma = prismaCron();

import { CollectionPeriodService } from "../services/CollectionPeriodService";
import { CustomerService } from "../services/CustomerService";
import { InvoiceService } from "../services/InvoiceService";

async function handleOverdueInvoices(
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
): Promise<{
    success: boolean;
    message: string;
    summary?: any;
    error?: string;
    stack?: string;
    duration: number;
    consoleLogs?: string[];
}> {
    const startTime = new Date();
    const processStats = {
        totalInvoicesProcessed: 0,
        invoicesUpdated: 0,
        customersActivated: 0,
        dcpCreated: 0,
        dcpUpdated: 0,
        dcpOldestOverdueDateRefreshed: 0,
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
        logStep("START", "Starting handleOverdueInvoices process", "INFO", {
            processName: "handleOverdueInvoices",
            startTime: startTime.toISOString(),
            customerId: customerId || "ALL",
            step: "START",
            stepNumber: 1,
        });

        const invoiceService = new InvoiceService();

        const refreshOldestOverdueDateForOpenPeriods = async () => {
            const { syncCustomerInsuranceFields } = await import(
                "@/server/services/creditInsurance/syncCustomerInsuranceFields"
            );
            const openPeriods = await prisma.customerCollectionPeriod.findMany({
                where: {
                    period_end_date: null,
                    ...(typeof customerId === "number"
                        ? { customer_id: customerId }
                        : {}),
                },
                select: {
                    customer_id: true,
                },
            });

            if (openPeriods.length === 0) {
                return 0;
            }

            const uniqueCustomerIds = Array.from(
                new Set(openPeriods.map((p) => p.customer_id))
            );

            for (const cid of uniqueCustomerIds) {
                await syncCustomerInsuranceFields(cid);
            }

            return uniqueCustomerIds.length;
        };

        // Step 1: Get all overdue invoices
        const getInvoicesStart = Date.now();
        logStep("GET_INVOICES", "Querying past due invoices", "INFO", {
            customer_id: customerId,
            due_date: "< now",
            status: "Due",
            customer_outstanding_debt: "!= 0 OR amount < 0",
            has_customer_filter: !!customerId,
        });

        const pastDueInvoices =
            await invoiceService.getAllPastDueInvoices(customerId);
        const getInvoicesDuration = Date.now() - getInvoicesStart;
        processStats.totalInvoicesProcessed = pastDueInvoices.length;

        logStep(
            "GET_INVOICES_COMPLETE",
            `Found ${pastDueInvoices.length} past due invoices`,
            "INFO",
            {
                invoices_found: pastDueInvoices.length,
                invoice_ids: pastDueInvoices.map((inv) => inv.id),
                customer_ids: Array.from(
                    new Set(
                        pastDueInvoices
                            .map((inv) => inv.customer_id)
                            .filter(Boolean)
                    )
                ),
                total_amount: pastDueInvoices.reduce(
                    (sum, inv) => sum + (inv.amount || 0),
                    0
                ),
            }
        );

        // Step 2: Update invoice statuses to overdue (only if we found past due invoices)
        let affectedCustomerIds: number[] = [];

        if (pastDueInvoices.length > 0) {
            const uniqueCustomerIds = Array.from(
                new Set(
                    pastDueInvoices
                        .map((i) => i.customer_id)
                        .filter((id): id is number => typeof id === "number")
                )
            );

            const updateStatusStart = Date.now();
            const updateResult = await invoiceService.updateInvoicesStatusToOverdue(
                pastDueInvoices.map((i) => i.id)
            );
            const updateStatusDuration = Date.now() - updateStatusStart;
            processStats.invoicesUpdated =
                updateResult?.updatedCount || pastDueInvoices.length;

            affectedCustomerIds = (
                updateResult?.affectedCustomerIds?.length
                    ? updateResult.affectedCustomerIds
                    : uniqueCustomerIds
            ) as number[];
        }

        // Always refresh the stored oldest overdue date for open periods.
        // This keeps the field as the single source used across list/detail views.
        processStats.dcpOldestOverdueDateRefreshed =
            await refreshOldestOverdueDateForOpenPeriods();

        // Exit early only if there is no additional work after refresh.
        if (pastDueInvoices.length === 0 && affectedCustomerIds.length === 0) {
            const totalDuration = Date.now() - startTime.getTime();
            logStep("COMPLETE", "No overdue invoices or sync issues found", "INFO", {
                step: "COMPLETE",
                stepNumber: 2,
                duration: totalDuration,
                processStats,
                performanceMetrics: {
                    getPastDueInvoices: getInvoicesDuration,
                    totalExecution: totalDuration,
                },
            });
            return {
                success: true,
                message: "No work needed",
                duration: totalDuration,
            };
        }

        // Cache invalidation will be done at the end after all processing

        // Step 3: Recalculate amounts for affected customers
        // This automatically triggers parent aggregation recalculation (centralized in CustomerService)
        try {
            if (affectedCustomerIds.length > 0) {
                await CustomerService.recalculateAllAmountsForCustomers(
                    affectedCustomerIds,
                    "cron_overdue_invoices"
                );
            }
        } catch (error) {
            logStep("ERROR", "Error recalculating amounts", "ERROR", {
                error: error instanceof Error ? error.message : String(error),
                affectedCustomerIds,
            });
            // Continue processing even if recalculation fails
        }

        // Step 4: Calculate outstanding amounts (needed for activation decision)
        const calculateStart = Date.now();
        const outstandingMap =
            await CustomerService.calculateOutstandingAmountsForCustomers(
                affectedCustomerIds
            );
        const calculateDuration = Date.now() - calculateStart;

        // Step 5: Activate customers only if total outstanding debt > 0
        const activateStart = Date.now();

        // OPTIMIZATION: Batch fetch customer statuses and open collection period in a single query
        const [customers, openPeriodRows] = await Promise.all([
            prisma.customer.findMany({
                where: { id: { in: affectedCustomerIds } },
                select: {
                    id: true,
                    collection_status: true,
                },
            }),
            prisma.customerCollectionPeriod.findMany({
                where: {
                    customer_id: { in: affectedCustomerIds },
                    period_end_date: null,
                },
                select: { customer_id: true },
            }),
        ]);

        const inactiveCustomerIds = new Set(
            customers
                .filter((c) => c.collection_status === "Inactive")
                .map((c) => c.id)
        );
        const openPeriodCustomerIds = new Set(
            openPeriodRows.map((r) => r.customer_id)
        );

        // Filter customers to activate: must be inactive AND have outstanding debt > 0
        const customersToActivate = affectedCustomerIds.filter((customerId: number) => {
            if (!inactiveCustomerIds.has(customerId)) {
                return false;
            }
            const amounts = outstandingMap.get(customerId);
            return amounts && (amounts.total_outstanding_amount ?? 0) > 0;
        });

        // Customers that need a collection period: only when there are overdue invoices
        // (outstanding > 0 and at least one overdue invoice). No period if only due invoices.
        const customersNeedingCollectionPeriod = affectedCustomerIds.filter(
            (customerId: number) => {
                const amounts = outstandingMap.get(customerId);
                if (!amounts) return false;
                if ((amounts.no_of_overdue_invoices ?? 0) <= 0) return false;
                if ((amounts.total_outstanding_amount ?? 0) <= 0) return false;
                if (openPeriodCustomerIds.has(customerId)) return false;
                return true;
            }
        );

        // Activate customers
        const customerService = new CustomerService();
        if (customersToActivate.length > 0) {
            await customerService.activateCustomers(customersToActivate);
            processStats.customersActivated = customersToActivate.length;
        }
        const activateDuration = Date.now() - activateStart;

        // Step 6: Create/update collection periods for customers with overdue debt and no open period
        const createCollectionPeriodsStart = Date.now();

        if (customersNeedingCollectionPeriod.length > 0) {
            // OPTIMIZATION: Batch fetch customer details with invoices in single query
            // Includes overdue invoices already filtered and ordered by due_date
            const customerDetails = await prisma.customer.findMany({
                where: { id: { in: customersNeedingCollectionPeriod } },
                include: {
                    Invoice: {
                        where: {
                            due_date: { lte: new Date() },
                            status: "Overdue",
                        },
                        orderBy: {
                            due_date: "asc", // Already ordered, oldest first
                        },
                        select: {
                            due_date: true,
                        },
                    },
                },
            });

            // Prepare data for collection period creation
            const customerDataForCollectionPeriods = customerDetails.map(
                (customer) => {
                    const amounts = outstandingMap.get(customer.id);

                    // OPTIMIZATION: Calculate oldest overdue date once from pre-filtered invoices
                    // Invoices are already filtered and ordered by due_date asc, so first one is oldest
                    const oldestOverdueDate =
                        customer.Invoice.length > 0 &&
                            customer.Invoice[0].due_date
                            ? new Date(customer.Invoice[0].due_date)
                            : new Date();

                    return {
                        customerId: customer.id,
                        amounts: amounts,
                        customerInfo: customer,
                        oldestOverdueDate: oldestOverdueDate,
                    };
                }
            );

            // Create/update collection periods using the existing service
            const collectionPeriodService = new CollectionPeriodService();
            const collectionPeriodResults =
                await collectionPeriodService.createOrUpdateCollectionPeriods(
                    customerDataForCollectionPeriods
                );

            // Count created vs updated collection periods
            collectionPeriodResults.forEach((result) => {
                if (result.isNew) {
                    processStats.dcpCreated++;
                } else {
                    processStats.dcpUpdated++;
                }
            });
        }

        const createCollectionPeriodsDuration =
            Date.now() - createCollectionPeriodsStart;

        // Final summary
        const totalDuration = Date.now() - startTime.getTime();

        const summary = {
            processName: "handleOverdueInvoices",
            startTime: startTime.toISOString(),
            duration: totalDuration,
            processStats,
            summary: {
                totalInvoices: pastDueInvoices.length,
                uniqueCustomers: affectedCustomerIds.length,
                dcpCreated: processStats.dcpCreated,
                dcpUpdated: processStats.dcpUpdated,
                customersActivated: processStats.customersActivated,
            },
        };

        logStep(
            "COMPLETE",
            "handleOverdueInvoices process completed successfully",
            "INFO",
            {
                processName: "handleOverdueInvoices",
                startTime: startTime.toISOString(),
                customerId: customerId || "ALL",
                step: "COMPLETE",
                stepNumber: 6,
                duration: totalDuration,
                processStats,
                performanceMetrics: {
                    getPastDueInvoices: getInvoicesDuration,
                    calculateOutstandingAmounts: calculateDuration,
                    activateCustomers: activateDuration,
                    createCollectionPeriods: createCollectionPeriodsDuration,
                    totalExecution: totalDuration,
                },
            }
        );

        // Invalidate dashboard cache for affected accounts
        try {
            // Get unique account IDs from affected customers
            const affectedCustomers = await prisma.customer.findMany({
                where: { id: { in: affectedCustomerIds } },
                select: { account_id: true },
                distinct: ["account_id"],
            });
            const accountIds = affectedCustomers.map((c) => c.account_id);

            if (accountIds.length > 0) {
                const { invalidateDashboardCacheForAccounts } = await import(
                    "@/server/utils/cacheInvalidationHelper"
                );
                await invalidateDashboardCacheForAccounts(accountIds);
            }
        } catch (cacheError) {
            // Cache invalidation failure should not break the cron job
            logStep("WARNING", "Cache invalidation error", "WARNING", {
                error:
                    cacheError instanceof Error
                        ? cacheError.message
                        : String(cacheError),
            });
        }

        return {
            success: true,
            message: "Overdue invoices processed successfully",
            summary: summary,
            duration: totalDuration,
            consoleLogs: [
                `Found ${pastDueInvoices.length} overdue invoices`,
                `Updated ${processStats.invoicesUpdated} invoice statuses`,
                `Activated ${processStats.customersActivated} customers`,
                `Created ${processStats.dcpCreated} collection periods`,
                `Updated ${processStats.dcpUpdated} collection periods`,
                `Refreshed ${processStats.dcpOldestOverdueDateRefreshed} oldest overdue dates`,
                `Total execution time: ${totalDuration}ms`,
            ],
        };
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        const totalDuration = Date.now() - startTime.getTime();

        logStep(
            "ERROR",
            `handleOverdueInvoices process failed: ${error.message}`,
            "ERROR",
            {
                processName: "handleOverdueInvoices",
                error: error.message,
                stack: error.stack,
                processStats,
                duration: totalDuration,
            }
        );

        throw error;
    }
}

export { handleOverdueInvoices };
