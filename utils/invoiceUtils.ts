import { updateInvoice } from "@/shared/services/InvoiceStatusService";

import {
    invalidateUnpaidInvoiceListQueries,
    invalidateControlCenterStats,
    BatchCacheInvalidator,
} from "./cacheUtils";

/**
 * Update an invoice with automatic cache invalidation
 * @param invoiceId - The ID of the invoice to update
 * @param updates - The updates to apply to the invoice
 * @returns Promise with the updated invoice data
 */
export const updateInvoiceWithCacheInvalidation = async (
    invoiceId: number,
    updates: any
) => {
    try {
        // Update the invoice
        const result = await updateInvoice(invoiceId, updates);

        // Use batch cache invalidator for efficient cache management
        const batchInvalidator = new BatchCacheInvalidator();

        // Mark control center stats for invalidation since invoice changes affect the stats
        batchInvalidator.markControlCenterForInvalidation();

        // Invalidate UnpaidInvoiceList queries for affected customers
        if (result?.affectedCustomerIds && result.affectedCustomerIds.length > 0) {
            batchInvalidator.addAffectedCustomers(result.affectedCustomerIds);
        }

        // Execute all cache invalidations at once
        if (batchInvalidator.hasPendingInvalidations()) {
            await batchInvalidator.executeInvalidations();
        }

        return result;
    } catch (error) {
        console.error("Error updating invoice with cache invalidation:", error);
        throw error;
    }
};

/**
 * Batch update multiple invoices with efficient cache invalidation
 * @param updates - Array of { invoiceId, updates } objects
 * @returns Promise with the updated invoice data
 */
export const batchUpdateInvoicesWithCacheInvalidation = async (
    updates: Array<{ invoiceId: number; updates: any }>
) => {
    try {
        const batchInvalidator = new BatchCacheInvalidator();
        const results = [];

        // Process all updates
        for (const { invoiceId, updates: invoiceUpdates } of updates) {
            const result = await updateInvoice(invoiceId, invoiceUpdates);
            results.push(result);

            // Collect affected customer IDs
            if (
                result?.affectedCustomerIds &&
                result.affectedCustomerIds.length > 0
            ) {
                batchInvalidator.addAffectedCustomers(result.affectedCustomerIds);
            }
        }

        // Mark control center stats for invalidation
        batchInvalidator.markControlCenterForInvalidation();

        // Execute all cache invalidations at once
        if (batchInvalidator.hasPendingInvalidations()) {
            await batchInvalidator.executeInvalidations();
        }

        return results;
    } catch (error) {
        console.error(
            "Error batch updating invoices with cache invalidation:",
            error
        );
        throw error;
    }
};
