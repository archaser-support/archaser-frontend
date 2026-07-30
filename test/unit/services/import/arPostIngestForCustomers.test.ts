import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    replayArImportForCustomers: vi.fn(),
    applyMaturedDeferredPayments: vi.fn(),
    triggerPostImportOverdueMetrics: vi.fn(),
}));

vi.mock("@/server/services/import/importArReplayService", () => ({
    replayArImportForCustomers: mocks.replayArImportForCustomers,
    applyMaturedDeferredPayments: mocks.applyMaturedDeferredPayments,
}));

vi.mock("@/server/services/creditInsurance/postImportOverdueMetrics", () => ({
    triggerPostImportOverdueMetrics: mocks.triggerPostImportOverdueMetrics,
}));

import { runArPostIngestForCustomers } from "@/server/services/import/arPostIngestForCustomers";

describe("runArPostIngestForCustomers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.replayArImportForCustomers.mockResolvedValue({
            customersAffected: 1,
            eventsApplied: 2,
            paymentsLinked: 1,
            deferredRemaining: 0,
            perCustomer: [],
        });
        mocks.applyMaturedDeferredPayments.mockResolvedValue({
            matured: 1,
            deferredRemaining: 0,
        });
        mocks.triggerPostImportOverdueMetrics.mockResolvedValue(undefined);
    });

    it("runs chronological replay then live refresh without maturity by default", async () => {
        const result = await runArPostIngestForCustomers({
            accountId: 10,
            customerIds: [42, 42, Number.NaN],
            runLiveRefresh: true,
        });

        expect(mocks.replayArImportForCustomers).toHaveBeenCalledWith([42], 10);
        expect(mocks.applyMaturedDeferredPayments).not.toHaveBeenCalled();
        expect(mocks.triggerPostImportOverdueMetrics).toHaveBeenCalledWith(
            [42],
            undefined
        );
        expect(result.replayStats).toEqual({
            customersAffected: 1,
            eventsApplied: 2,
            paymentsLinked: 1,
            deferredRemaining: 0,
            perCustomer: [],
        });
        expect(result.maturityResult).toBeNull();
    });

    it("runs maturity when requested even with no customers", async () => {
        const asOf = new Date("2026-07-28T00:00:00.000Z");

        const result = await runArPostIngestForCustomers({
            accountId: 10,
            customerIds: [],
            runMaturity: true,
            maturityAsOf: asOf,
            runLiveRefresh: true,
        });

        expect(mocks.replayArImportForCustomers).not.toHaveBeenCalled();
        expect(mocks.applyMaturedDeferredPayments).toHaveBeenCalledWith(10, asOf);
        expect(mocks.triggerPostImportOverdueMetrics).not.toHaveBeenCalled();
        expect(result.replayStats).toBeNull();
        expect(result.maturityResult).toEqual({
            matured: 1,
            deferredRemaining: 0,
        });
    });

    it("skips live refresh when runLiveRefresh is false", async () => {
        await runArPostIngestForCustomers({
            accountId: 10,
            customerIds: [7],
            runLiveRefresh: false,
        });

        expect(mocks.replayArImportForCustomers).toHaveBeenCalledWith([7], 10);
        expect(mocks.triggerPostImportOverdueMetrics).not.toHaveBeenCalled();
    });
});
