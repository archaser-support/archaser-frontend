import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    runArPostIngestForCustomers: vi.fn(),
}));

vi.mock("@/server/services/import/arPostIngestForCustomers", () => ({
    runArPostIngestForCustomers: mocks.runArPostIngestForCustomers,
}));

import {
    applyConnectorArPostIngest,
    shouldRunConnectorPaymentOnlyArFallback,
} from "@/server/services/import/connectorArPostIngest";

describe("shouldRunConnectorPaymentOnlyArFallback", () => {
    it("runs when Invoice post-ingest did not run and payment customers exist", () => {
        expect(
            shouldRunConnectorPaymentOnlyArFallback({
                invoiceArPostIngestRan: false,
                paymentAffectedCustomerIds: [10, 20],
            })
        ).toBe(true);
    });

    it("does not run when Invoice post-ingest already ran", () => {
        expect(
            shouldRunConnectorPaymentOnlyArFallback({
                invoiceArPostIngestRan: true,
                paymentAffectedCustomerIds: [10],
            })
        ).toBe(false);
    });

    it("does not run when no payment customers were touched", () => {
        expect(
            shouldRunConnectorPaymentOnlyArFallback({
                invoiceArPostIngestRan: false,
                paymentAffectedCustomerIds: [],
            })
        ).toBe(false);
    });
});

describe("applyConnectorArPostIngest", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.runArPostIngestForCustomers.mockResolvedValue({
            replayStats: {
                customersAffected: 1,
                eventsApplied: 4,
                paymentsLinked: 2,
                deferredRemaining: 1,
                perCustomer: [],
            },
            maturityResult: {
                matured: 3,
                deferredRemaining: 1,
            },
        });
    });

    it("runs shared orchestration with maturity and live refresh, writes entity stats", async () => {
        const entityStats: Record<
            string,
            { pulled: number; success: number; failed: number; skipped: number }
        > = {};

        await applyConnectorArPostIngest({
            accountId: 55,
            customerIds: [7, 9],
            skipReportingBreachPromotion: true,
            entityStats,
        });

        expect(mocks.runArPostIngestForCustomers).toHaveBeenCalledTimes(1);
        expect(mocks.runArPostIngestForCustomers).toHaveBeenCalledWith({
            accountId: 55,
            customerIds: [7, 9],
            runMaturity: true,
            runLiveRefresh: true,
            liveRefreshOptions: {
                skipReportingBreachPromotion: true,
            },
        });

        expect(entityStats["_replay"]).toEqual({
            pulled: 4,
            success: 2,
            failed: 0,
            skipped: 1,
        });
        expect(entityStats["_maturity"]).toEqual({
            pulled: 4,
            success: 3,
            failed: 0,
            skipped: 1,
        });
    });

    it("still runs maturity with empty customers (Invoice path) and omits _replay stats", async () => {
        mocks.runArPostIngestForCustomers.mockResolvedValue({
            replayStats: null,
            maturityResult: { matured: 1, deferredRemaining: 0 },
        });

        const entityStats: Record<
            string,
            { pulled: number; success: number; failed: number; skipped: number }
        > = {};

        await applyConnectorArPostIngest({
            accountId: 55,
            customerIds: [],
            skipReportingBreachPromotion: false,
            entityStats,
        });

        expect(mocks.runArPostIngestForCustomers).toHaveBeenCalledWith({
            accountId: 55,
            customerIds: [],
            runMaturity: true,
            runLiveRefresh: true,
            liveRefreshOptions: {
                skipReportingBreachPromotion: false,
            },
        });
        expect(entityStats["_replay"]).toBeUndefined();
        expect(entityStats["_maturity"]).toEqual({
            pulled: 1,
            success: 1,
            failed: 0,
            skipped: 0,
        });
    });
});
