import { QueryClient } from "@tanstack/react-query";

import { broadcast, BROADCAST_TYPES } from "./broadcast";

// Global query client instance for cache invalidation
let globalQueryClient: QueryClient | null = null;

export const setGlobalQueryClient = (queryClient: QueryClient) => {
    globalQueryClient = queryClient;
};

export const invalidateControlCenterStats = async () => {
    if (globalQueryClient) {
        try {
            await globalQueryClient.invalidateQueries({
                queryKey: ["controlCenterStats"],
            });

            // Note: Removed custom broadcast since React Query's broadcastQueryClient
            // already handles broadcasting query invalidations across tabs
            // Broadcasting here causes infinite loops
        } catch (error) {
            console.error(
                "Error invalidating control center stats cache:",
                error
            );
        }
    }
};

export const invalidateLastSyncDate = async (accountId?: number) => {
    if (globalQueryClient) {
        try {
            // Invalidate customer queries to refresh last sync date
            await globalQueryClient.invalidateQueries({
                queryKey: ["customer", accountId],
            });
            // Also invalidate any customer queries without specific ID for broader cache clearing
            await globalQueryClient.invalidateQueries({
                queryKey: ["customer"],
            });
        } catch (error) {
            console.error("Error invalidating customer cache:", error);
        }
    }
};

export const invalidateCustomerQueries = async (customerId?: number) => {
    if (globalQueryClient) {
        try {
            if (customerId) {
                await globalQueryClient.invalidateQueries({
                    queryKey: ["customer", customerId.toString()],
                });
            }
            await globalQueryClient.invalidateQueries({
                queryKey: ["customer"],
            });
        } catch (error) {
            // Silent fail
        }
    }
};

export const invalidateInvoiceQueries = async (invoiceId?: number) => {
    if (globalQueryClient) {
        try {
            if (invoiceId) {
                await globalQueryClient.invalidateQueries({
                    queryKey: ["invoice", invoiceId.toString()],
                });
            }
            await globalQueryClient.invalidateQueries({
                queryKey: ["invoices"],
            });
        } catch (error) {
            // Silent fail
        }
    }
};

/**
 * Invalidate UnpaidInvoiceList queries for specific customer IDs
 * This is used after invoice imports to refresh the unpaid invoice lists
 */
export const invalidateUnpaidInvoiceListQueries = async (
    customerIds: number[]
) => {
    if (!globalQueryClient || !customerIds.length) {
        return;
    }

    try {
        // Debug logging removed for production

        // Invalidate all invoices queries to refresh UnpaidInvoiceList
        await globalQueryClient.invalidateQueries({ queryKey: ["invoices"] });

        // Invalidate specific customer queries for each affected customer
        await Promise.all(
            customerIds.map((customerId) =>
                globalQueryClient!.invalidateQueries({
                    queryKey: ["customer", customerId],
                })
            )
        );

        // Debug logging removed for production
    } catch (error) {
        console.error("Error invalidating UnpaidInvoiceList queries:", error);
    }
};

/**
 * Batch cache invalidation for multiple operations
 * This function collects all affected customer IDs and invalidates cache once at the end
 */
export class BatchCacheInvalidator {
    private affectedCustomerIds: Set<number> = new Set();
    private shouldInvalidateControlCenter: boolean = false;

    /**
     * Add customer IDs that will be affected by the batch operation
     */
    addAffectedCustomers(customerIds: number[]) {
        customerIds.forEach((id) => this.affectedCustomerIds.add(id));
    }

    /**
     * Mark that control center stats should be invalidated
     */
    markControlCenterForInvalidation() {
        this.shouldInvalidateControlCenter = true;
    }

    /**
     * Execute all cache invalidations at once
     */
    async executeInvalidations() {
        try {
            const promises: Promise<any>[] = [];

            // Invalidate control center stats if needed
            if (this.shouldInvalidateControlCenter) {
                promises.push(invalidateControlCenterStats());
            }

            // Invalidate UnpaidInvoiceList queries for all affected customers
            if (this.affectedCustomerIds.size > 0) {
                const uniqueCustomerIds = Array.from(this.affectedCustomerIds);
                promises.push(
                    invalidateUnpaidInvoiceListQueries(uniqueCustomerIds)
                );
            }

            // Execute all invalidations in parallel
            await Promise.all(promises);

            // Debug logging removed for production
        } catch (error) {
            console.error("Error during batch cache invalidation:", error);
        } finally {
            // Reset the state
            this.affectedCustomerIds.clear();
            this.shouldInvalidateControlCenter = false;
        }
    }

    /**
     * Get the current count of affected customers
     */
    getAffectedCustomerCount(): number {
        return this.affectedCustomerIds.size;
    }

    /**
     * Check if any invalidations are pending
     */
    hasPendingInvalidations(): boolean {
        return (
            this.affectedCustomerIds.size > 0 ||
            this.shouldInvalidateControlCenter
        );
    }
}
