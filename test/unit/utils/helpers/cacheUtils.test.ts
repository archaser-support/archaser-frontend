import { QueryClient } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
    setGlobalQueryClient,
    invalidateUnpaidInvoiceListQueries,
    BatchCacheInvalidator,
} from "@/utils/cacheUtils";

// Mock the broadcast module
vi.mock("@/utils/broadcast", () => ({
    broadcast: {
        postMessage: vi.fn(),
    },
    BROADCAST_TYPES: {
        CONTROL_CENTER_STATS_UPDATED: "CONTROL_CENTER_STATS_UPDATED",
    },
}));

describe("cacheUtils", () => {
    let mockQueryClient: QueryClient;

    beforeEach(() => {
        mockQueryClient = {
            invalidateQueries: vi.fn(),
        } as any;

        setGlobalQueryClient(mockQueryClient);
    });

    describe("invalidateUnpaidInvoiceListQueries", () => {
        it("should invalidate invoices and customer queries for given customer IDs", async () => {
            const customerIds = [1, 2, 3];

            await invalidateUnpaidInvoiceListQueries(customerIds);

            expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
                queryKey: ["invoices"],
            });
            expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
                queryKey: ["customer", 1],
            });
            expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
                queryKey: ["customer", 2],
            });
            expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
                queryKey: ["customer", 3],
            });
        });

        it("should not invalidate if no customer IDs provided", async () => {
            await invalidateUnpaidInvoiceListQueries([]);

            expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled();
        });
    });

    describe("BatchCacheInvalidator", () => {
        let batchInvalidator: BatchCacheInvalidator;

        beforeEach(() => {
            batchInvalidator = new BatchCacheInvalidator();
        });

        it("should add affected customers correctly", () => {
            batchInvalidator.addAffectedCustomers([1, 2, 3]);
            batchInvalidator.addAffectedCustomers([2, 3, 4]); // Duplicates should be handled

            expect(batchInvalidator.getAffectedCustomerCount()).toBe(4);
            expect(batchInvalidator.hasPendingInvalidations()).toBe(true);
        });

        it("should mark control center for invalidation", () => {
            batchInvalidator.markControlCenterForInvalidation();

            expect(batchInvalidator.hasPendingInvalidations()).toBe(true);
        });

        it("should execute all invalidations at once", async () => {
            batchInvalidator.addAffectedCustomers([1, 2, 3]);
            batchInvalidator.markControlCenterForInvalidation();

            await batchInvalidator.executeInvalidations();

            // Should invalidate control center stats
            expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
                queryKey: ["controlCenterStats"],
            });

            // Should invalidate invoices query
            expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
                queryKey: ["invoices"],
            });

            // Should invalidate customer queries
            expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
                queryKey: ["customer", 1],
            });
            expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
                queryKey: ["customer", 2],
            });
            expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
                queryKey: ["customer", 3],
            });

            // Should reset state after execution
            expect(batchInvalidator.getAffectedCustomerCount()).toBe(0);
            expect(batchInvalidator.hasPendingInvalidations()).toBe(false);
        });

        it("should handle empty invalidations gracefully", async () => {
            await batchInvalidator.executeInvalidations();

            expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled();
        });

        it("should deduplicate customer IDs automatically", () => {
            batchInvalidator.addAffectedCustomers([1, 2, 3]);
            batchInvalidator.addAffectedCustomers([2, 3, 4]);
            batchInvalidator.addAffectedCustomers([1, 4, 5]);

            expect(batchInvalidator.getAffectedCustomerCount()).toBe(5); // 1, 2, 3, 4, 5
        });
    });
});
