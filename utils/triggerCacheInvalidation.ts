/**
 * Utility to trigger cache invalidation from anywhere in the application
 * This is particularly useful for refreshing data after cron job updates
 */

/**
 * Trigger cache invalidation for specific entities
 * @param options - Configuration for what to invalidate
 */
export const triggerCacheInvalidation = async (options: {
    customers?: number[];
    invoices?: number[];
    controlCenter?: boolean;
    all?: boolean;
}) => {
    try {
        // Import the cache utilities dynamically
        const {
            invalidateControlCenterStats,
            invalidateCustomerQueries,
            invalidateInvoiceQueries,
        } = await import("./cacheUtils");

        const promises: Promise<any>[] = [];

        // Invalidate control center stats if requested
        if (options.controlCenter) {
            promises.push(invalidateControlCenterStats());
        }

        // Invalidate specific customers
        if (options.customers?.length) {
            for (const customerId of options.customers) {
                promises.push(invalidateCustomerQueries(customerId));
            }
        }

        // Invalidate specific invoices
        if (options.invoices?.length) {
            for (const invoiceId of options.invoices) {
                promises.push(invalidateInvoiceQueries(invoiceId));
            }
        }

        // Invalidate all if requested
        if (options.all) {
            // Note: globalQueryClient is not exported, so we'll skip this for now
            // TODO: Implement proper global invalidation
        }

        // Execute all invalidations in parallel
        if (promises.length > 0) {
            await Promise.all(promises);
        }

        return true;
    } catch (error) {
        console.error("Error triggering cache invalidation:", error);
        return false;
    }
};

/**
 * Trigger cache invalidation specifically for overdue invoice updates
 * This is the main function that should be called after cron job updates
 */
export const triggerOverdueInvoiceCacheInvalidation = async (
    affectedCustomerIds: number[],
    affectedInvoiceIds: number[]
) => {
    return triggerCacheInvalidation({
        customers: affectedCustomerIds,
        invoices: affectedInvoiceIds,
        controlCenter: true,
    });
};

/**
 * Trigger cache invalidation for a specific customer
 * Useful for refreshing customer details after status changes
 */
export const triggerCustomerCacheInvalidation = async (customerId: number) => {
    return triggerCacheInvalidation({
        customers: [customerId],
        controlCenter: true,
    });
};

/**
 * Force refresh all cache data
 * Use sparingly - only when you need to completely refresh all data
 */
export const forceRefreshAllCache = async () => {
    return triggerCacheInvalidation({
        all: true,
        controlCenter: true,
    });
};
