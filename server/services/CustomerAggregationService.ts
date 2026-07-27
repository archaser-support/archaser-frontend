import { CustomerAggregatedData } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { LogLevel } from "@/types/enums";
import { linkedInvoicePaymentWhere } from "@/utils/invoicePaymentFilters";
import { resolveCustomerFirstCurrency } from "@/utils/stringFormatters";

import { LogService } from "./LogService";

export class CustomerAggregationService {
    private static instance: CustomerAggregationService;
    private logService = LogService.getInstance();
    // Track parent IDs currently being recalculated to prevent duplicate concurrent recalculations
    private recalculatingParents = new Set<number>();

    private constructor() {}

    public static getInstance(): CustomerAggregationService {
        if (!CustomerAggregationService.instance) {
            CustomerAggregationService.instance =
                new CustomerAggregationService();
        }
        return CustomerAggregationService.instance;
    }

    /**
     * Calculate aggregated data for a parent customer from all child customers
     * @param parentCustomerId The parent customer ID
     * @returns Aggregated data object
     */
    public async calculateAggregatedData(
        parentCustomerId: number,
        userId?: string
    ): Promise<any> {
        // Get all direct child customers
        const childCustomers = await prisma.customer.findMany({
            where: {
                parent_customer_id: parentCustomerId,
            } as any,
            select: {
                id: true,
            },
        });

        const childCustomerIds = childCustomers.map((c) => c.id);
        const childCustomersCount = childCustomerIds.length;

        // If no children, return zero/null values
        if (childCustomersCount === 0) {
            return await this.updateAggregatedData(
                parentCustomerId,
                {
                    child_customers_count: 0,
                    total_outstanding_amount: 0,
                    customer_outstanding_amount1: 0,
                    customer_outstanding_amount2: 0,
                    customer_currency1: null,
                    customer_currency2: null,
                    no_of_overdue_invoices: 0,
                    no_of_due_invoices: 0,
                    total_invoices_count: 0,
                    total_paid_amount: 0,
                    customer_total_paid_amount1: 0,
                    customer_total_paid_amount2: 0,
                    total_collection_periods: 0,
                    active_collection_periods: 0,
                },
                userId
            );
        }

        // Get all invoices for child customers
        const [invoicesData, paymentsData, collectionPeriodsData] =
            await Promise.all([
                // Invoices data
                prisma.invoice.groupBy({
                    by: ["customer_id", "customer_currency"],
                    where: {
                        customer_id: { in: childCustomerIds },
                    },
                    _sum: {
                        outstanding_debt: true,
                        customer_outstanding_debt: true,
                        amount: true,
                        total_paid: true,
                        customer_total_paid: true,
                    },
                    _count: {
                        id: true,
                    },
                }),
                // Payments data
                prisma.invoicePayment.groupBy({
                    by: ["customer_id", "customer_currency"],
                    where: {
                        customer_id: { in: childCustomerIds },
                        ...linkedInvoicePaymentWhere,
                    },
                    _sum: {
                        amount: true,
                        customer_amount: true,
                    },
                }),
                // Collection periods data
                prisma.customerCollectionPeriod.findMany({
                    where: {
                        customer_id: { in: childCustomerIds },
                    },
                    select: {
                        id: true,
                        period_end_date: true,
                        total_outstanding_amount: true,
                        no_of_overdue_invoices: true,
                        customer_outstanding_amount1: true,
                        customer_outstanding_amount2: true,
                        customer_currency1: true,
                        customer_currency2: true,
                    },
                }),
            ]);

        // Calculate invoice counts by status
        const [overdueInvoices, dueInvoices, totalInvoices] = await Promise.all(
            [
                prisma.invoice.count({
                    where: {
                        customer_id: { in: childCustomerIds },
                        status: "Overdue",
                    },
                }),
                prisma.invoice.count({
                    where: {
                        customer_id: { in: childCustomerIds },
                        status: "Due",
                    },
                }),
                prisma.invoice.count({
                    where: {
                        customer_id: { in: childCustomerIds },
                        status: { notIn: ["Paid", "Void", "Cancelled"] },
                    },
                }),
            ]
        );

        // Calculate total outstanding amount from collection periods only
        // Use collection period total_outstanding_amount for each child customer, which is already calculated correctly
        const activeCollectionPeriods = collectionPeriodsData.filter(
            (cp) => cp.period_end_date === null
        );

        // Sum up total_outstanding_amount from active collection periods
        // If no active collection periods exist, total_outstanding_amount will be 0
        const totalOutstanding = activeCollectionPeriods.reduce(
            (sum, cp) => sum + (cp.total_outstanding_amount || 0),
            0
        );

        // Aggregate outstanding amounts by currency for currency breakdown
        // Use only collection period currency data
        const currencyMap = new Map<string, number>();

        activeCollectionPeriods.forEach((cp) => {
            if (cp.customer_currency1 && cp.customer_outstanding_amount1) {
                const currency = cp.customer_currency1;
                currencyMap.set(
                    currency,
                    (currencyMap.get(currency) || 0) +
                        (cp.customer_outstanding_amount1 || 0)
                );
            }
            if (cp.customer_currency2 && cp.customer_outstanding_amount2) {
                const currency = cp.customer_currency2;
                currencyMap.set(
                    currency,
                    (currencyMap.get(currency) || 0) +
                        (cp.customer_outstanding_amount2 || 0)
                );
            }
        });

        // Note: currencyMap is now only populated from collection periods
        // Get top 2 currencies by amount (for fallback, though should match collection period data)
        const sortedCurrencies = Array.from(currencyMap.entries()).sort(
            (a, b) => b[1] - a[1]
        );
        const currency1 = sortedCurrencies[0]?.[0] || null;
        const currency2 = sortedCurrencies[1]?.[0] || null;
        const amount1 = sortedCurrencies[0]?.[1] || 0;
        const amount2 = sortedCurrencies[1]?.[1] || 0;

        // Aggregate payment amounts:
        // - totalPaid: sum of base/account currency amounts (`amount`)
        // - paymentCurrencyMap: sum of customer/original currency amounts (`customer_amount`) per currency
        const paymentCurrencyMap = new Map<string, number>();
        let totalPaid = 0;

        paymentsData.forEach((payment) => {
            const baseAmount = payment._sum.amount || 0;
            const customerAmount = payment._sum.customer_amount || 0;
            const currency = resolveCustomerFirstCurrency({
                customerCurrencyPrimary: payment.customer_currency,
            });

            // Base (account) currency total
            totalPaid += baseAmount;

            // Per-customer-currency totals (only if we have a customer amount)
            if (customerAmount) {
                paymentCurrencyMap.set(
                    currency,
                    (paymentCurrencyMap.get(currency) || 0) + customerAmount
                );
            }
        });

        const paymentSortedCurrencies = Array.from(
            paymentCurrencyMap.entries()
        ).sort((a, b) => b[1] - a[1]);
        const paymentCurrency1 = paymentSortedCurrencies[0]?.[0] || null;
        const paymentCurrency2 = paymentSortedCurrencies[1]?.[0] || null;
        const paymentAmount1 = paymentSortedCurrencies[0]?.[1] || 0;
        const paymentAmount2 = paymentSortedCurrencies[1]?.[1] || 0;

        // Calculate collection periods stats
        const totalCollectionPeriods = collectionPeriodsData.length;
        const activeCollectionPeriodsCount = activeCollectionPeriods.length;

        // Aggregate collection period outstanding amounts by currency
        // This properly handles multiple currencies by grouping amounts by currency
        const collectionPeriodCurrencyMap = new Map<string, number>();

        activeCollectionPeriods.forEach((cp) => {
            // Add currency1 amount
            if (cp.customer_currency1 && cp.customer_outstanding_amount1) {
                const currency = cp.customer_currency1;
                collectionPeriodCurrencyMap.set(
                    currency,
                    (collectionPeriodCurrencyMap.get(currency) || 0) +
                        (cp.customer_outstanding_amount1 || 0)
                );
            }
            // Add currency2 amount
            if (cp.customer_currency2 && cp.customer_outstanding_amount2) {
                const currency = cp.customer_currency2;
                collectionPeriodCurrencyMap.set(
                    currency,
                    (collectionPeriodCurrencyMap.get(currency) || 0) +
                        (cp.customer_outstanding_amount2 || 0)
                );
            }
        });

        // Get top 2 currencies from collection periods
        const collectionPeriodSortedCurrencies = Array.from(
            collectionPeriodCurrencyMap.entries()
        ).sort((a, b) => b[1] - a[1]);

        let collectionPeriodOutstanding1 = 0;
        let collectionPeriodOutstanding2 = 0;
        let collectionPeriodCurrency1: string | null = null;
        let collectionPeriodCurrency2: string | null = null;

        if (collectionPeriodSortedCurrencies.length >= 1) {
            collectionPeriodCurrency1 = collectionPeriodSortedCurrencies[0][0];
            collectionPeriodOutstanding1 =
                collectionPeriodSortedCurrencies[0][1];
        }
        if (collectionPeriodSortedCurrencies.length >= 2) {
            collectionPeriodCurrency2 = collectionPeriodSortedCurrencies[1][0];
            collectionPeriodOutstanding2 =
                collectionPeriodSortedCurrencies[1][1];
        }

        // Use collection period currencies (currencyMap is also from collection periods, so they should match)
        const finalCurrency1 = collectionPeriodCurrency1 || currency1;
        const finalCurrency2 = collectionPeriodCurrency2 || currency2;
        const finalAmount1 =
            collectionPeriodOutstanding1 > 0
                ? collectionPeriodOutstanding1
                : amount1;
        const finalAmount2 =
            collectionPeriodOutstanding2 > 0
                ? collectionPeriodOutstanding2
                : amount2;

        // For total_outstanding_amount, sum the total_outstanding_amount from all active collection periods
        // This uses the correctly calculated amount per customer (in their base currency)
        // Note: This assumes all child customers are in the same account with the same base currency
        // If no collection periods exist, total_outstanding_amount will be 0
        const finalTotalOutstanding = totalOutstanding;

        const aggregatedData = {
            child_customers_count: childCustomersCount,
            total_outstanding_amount: finalTotalOutstanding,
            customer_outstanding_amount1: finalAmount1,
            customer_outstanding_amount2: finalAmount2,
            customer_currency1: finalCurrency1,
            customer_currency2: finalCurrency2,
            no_of_overdue_invoices: overdueInvoices,
            no_of_due_invoices: dueInvoices,
            total_invoices_count: totalInvoices,
            total_paid_amount: totalPaid,
            customer_total_paid_amount1: paymentAmount1,
            customer_total_paid_amount2: paymentAmount2,
            total_collection_periods: totalCollectionPeriods,
            active_collection_periods: activeCollectionPeriodsCount,
        };

        const result = await this.updateAggregatedData(
            parentCustomerId,
            aggregatedData,
            userId
        );

        // Invalidate dashboard cache after recalculating aggregated data
        try {
            // Get account_id from parent customer
            const parentCustomer = await prisma.customer.findUnique({
                where: { id: parentCustomerId },
                select: { account_id: true },
            });

            if (parentCustomer) {
                const { invalidateDashboardCacheForAccount } = await import(
                    "@/server/utils/cacheInvalidationHelper"
                );
                await invalidateDashboardCacheForAccount(
                    parentCustomer.account_id
                );
            }
        } catch (error) {
            // Cache invalidation failure should not break the aggregation
            console.error("Failed to invalidate dashboard cache:", error);
        }

        return result;
    }

    /**
     * Update aggregated data record for a parent customer
     * @param parentCustomerId The parent customer ID
     * @param data The aggregated data to update
     * @param userId Optional user ID for audit trail
     * @returns Updated aggregated data record
     */
    public async updateAggregatedData(
        parentCustomerId: number,
        data: any,
        userId?: string
    ): Promise<any> {
        const now = new Date();

        // Check if record exists
        const existing = await (
            prisma as any
        ).customerAggregatedData.findUnique({
            where: { customer_id: parentCustomerId },
        });

        if (existing) {
            // Update existing record
            return await (prisma as any).customerAggregatedData.update({
                where: { customer_id: parentCustomerId },
                data: {
                    ...data,
                    modified_at: now,
                    modified_by: userId || undefined,
                },
            });
        } else {
            // Create new record
            return await (prisma as any).customerAggregatedData.create({
                data: {
                    customer_id: parentCustomerId,
                    ...data,
                    created_at: now,
                    modified_at: now,
                    created_by: userId || undefined,
                    modified_by: userId || undefined,
                },
            });
        }
    }

    /**
     * Recalculate aggregated data for all parent customers in an account
     * @param accountId The account ID
     * @param userId Optional user ID for audit trail
     */
    public async recalculateAllParentCustomers(
        accountId: number,
        userId?: string
    ): Promise<void> {
        // Get all customers that have children
        // First get all parent customers (those with null parent_customer_id)
        const allParentCustomers = await prisma.customer.findMany({
            where: {
                account_id: accountId,
                parent_customer_id: null,
            } as any,
            select: {
                id: true,
            },
        });

        // Then filter to only those that have children
        const parentCustomers = await prisma.customer.findMany({
            where: {
                id: { in: allParentCustomers.map((c) => c.id) },
                ChildCustomers: {
                    some: {},
                },
            } as any,
            select: {
                id: true,
            },
        });

        // Recalculate for each parent
        for (const parent of parentCustomers) {
            try {
                await this.calculateAggregatedData(parent.id, userId);
            } catch (error: any) {
                await this.logService.logMessage(
                    LogLevel.ERROR,
                    `Failed to recalculate aggregated data for parent customer ${parent.id}`,
                    "CustomerAggregationService",
                    { parentId: parent.id, error: error.message }
                );
            }
        }
    }

    /**
     * Recalculate parent's aggregated data when a child customer's data changes
     * @param childCustomerId The child customer ID
     * @param userId Optional user ID for audit trail
     */
    public async recalculateParentForChild(
        childCustomerId: number,
        userId?: string
    ): Promise<void> {
        // Get the child customer to find its parent
        const childCustomer = await prisma.customer.findUnique({
            where: { id: childCustomerId },
            select: { parent_customer_id: true } as any,
        });

        if (childCustomer && (childCustomer as any).parent_customer_id) {
            await this.calculateAggregatedData(
                (childCustomer as any).parent_customer_id,
                userId
            );
        }
    }

    /**
     * Efficiently recalculate aggregated data for all unique parent customers
     * from a list of child customer IDs. This method ensures each parent is
     * recalculated only once, even if multiple children share the same parent.
     *
     * @param childCustomerIds Array of child customer IDs whose parents need recalculation
     * @param userId Optional user ID for audit trail
     * @returns Object with statistics about the recalculation
     */
    public async recalculateParentsForChildren(
        childCustomerIds: number[],
        userId?: string
    ): Promise<{
        processedChildren: number;
        uniqueParents: number;
        recalculatedParents: number;
        failedParents: number;
        skippedParents: number;
    }> {
        if (!childCustomerIds || childCustomerIds.length === 0) {
            return {
                processedChildren: 0,
                uniqueParents: 0,
                recalculatedParents: 0,
                failedParents: 0,
                skippedParents: 0,
            };
        }

        // Get unique child customer IDs
        const uniqueChildIds = Array.from(new Set(childCustomerIds));

        // Fetch all child customers with their parent IDs in a single query
        const childCustomers = await prisma.customer.findMany({
            where: {
                id: { in: uniqueChildIds },
            },
            select: {
                id: true,
                parent_customer_id: true,
            } as any,
        });

        // Extract unique parent customer IDs (excluding null values)
        const parentCustomerIds = new Set<number>();
        childCustomers.forEach((child) => {
            const parentId = (child as any).parent_customer_id;
            if (parentId !== null && parentId !== undefined) {
                parentCustomerIds.add(parentId);
            }
        });

        const uniqueParentIds = Array.from(parentCustomerIds);
        let recalculatedCount = 0;
        let failedCount = 0;
        let skippedCount = 0;

        // Recalculate aggregated data for each unique parent (only once per parent)
        // Skip if already being recalculated (prevents duplicate concurrent recalculations)
        for (const parentId of uniqueParentIds) {
            // Check if this parent is already being recalculated
            if (this.recalculatingParents.has(parentId)) {
                skippedCount++;
                continue; // Skip duplicate concurrent recalculation
            }

            try {
                // Mark as being recalculated
                this.recalculatingParents.add(parentId);

                await this.calculateAggregatedData(parentId, userId);
                recalculatedCount++;
            } catch (error: any) {
                failedCount++;
                await this.logService.logMessage(
                    LogLevel.ERROR,
                    `Failed to recalculate aggregated data for parent customer ${parentId}`,
                    "CustomerAggregationService",
                    {
                        parentId,
                        error: error.message,
                        stack: error.stack,
                    }
                );
            } finally {
                // Always remove from set when done (success or failure)
                this.recalculatingParents.delete(parentId);
            }
        }

        // Invalidate dashboard cache for affected accounts
        try {
            // Get unique account IDs from parent customers
            const parentCustomers = await prisma.customer.findMany({
                where: { id: { in: uniqueParentIds } },
                select: { account_id: true },
                distinct: ["account_id"],
            });
            const accountIds = parentCustomers.map((c) => c.account_id);

            if (accountIds.length > 0) {
                const { invalidateDashboardCacheForAccounts } = await import(
                    "@/server/utils/cacheInvalidationHelper"
                );
                await invalidateDashboardCacheForAccounts(accountIds);
            }
        } catch (error) {
            // Cache invalidation failure should not break the aggregation
            console.error("Failed to invalidate dashboard cache:", error);
        }

        return {
            processedChildren: uniqueChildIds.length,
            uniqueParents: uniqueParentIds.length,
            recalculatedParents: recalculatedCount,
            failedParents: failedCount,
            skippedParents: skippedCount,
        };
    }
}
