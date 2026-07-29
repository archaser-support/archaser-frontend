import { beforeEach, describe, expect, it, vi } from "vitest";

const takeCustomerPolicyTrendSnapshots = vi.fn();
const drainAsOfRewriteQueue = vi.fn();

vi.mock("@/server/services/creditInsurance/customerPolicyTrendService", () => ({
    takeCustomerPolicyTrendSnapshots,
}));

vi.mock("@/server/services/creditInsurance/asOfRewriteQueue", () => ({
    drainAsOfRewriteQueue,
}));

const todayOk = {
    rowsUpserted: 2,
    accountsProcessed: 1,
    gapFillWarnings: [] as Array<{
        accountId: number;
        gapDays: number;
        gapFillDaysApplied: number;
    }>,
};

const drainOk = {
    itemsProcessed: 1,
    daysRewritten: 3,
    failures: 0,
    skippedForBackfill: 0,
};

describe("takeCustomerPolicyTrendSnapshotsJob drain reliability", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        takeCustomerPolicyTrendSnapshots.mockResolvedValue(todayOk);
        drainAsOfRewriteQueue.mockResolvedValue(drainOk);
    });

    it("still attempts drain when today's snapshot write throws", async () => {
        takeCustomerPolicyTrendSnapshots.mockRejectedValue(
            new Error("today snapshot failed")
        );
        drainAsOfRewriteQueue.mockResolvedValue(drainOk);
        const addStep = vi.fn();

        const job = (
            await import("@/server/cron-jobs/takeCustomerPolicyTrendSnapshots")
        ).default;

        await expect(job(undefined, undefined, { addStep })).rejects.toThrow(
            "today snapshot failed"
        );

        expect(drainAsOfRewriteQueue).toHaveBeenCalledTimes(1);
        expect(addStep).toHaveBeenCalledWith(
            "POLICY_TREND_ERROR",
            "today snapshot failed",
            "ERROR",
            expect.objectContaining({ stack: expect.any(String) })
        );
        expect(addStep).toHaveBeenCalledWith(
            "AS_OF_REWRITE_DRAIN_DONE",
            expect.stringContaining("As-of rewrite drain:"),
            "INFO",
            drainOk
        );
    });

    it("fails the job when drain reports hard failures", async () => {
        drainAsOfRewriteQueue.mockResolvedValue({
            itemsProcessed: 0,
            daysRewritten: 1,
            failures: 2,
            skippedForBackfill: 0,
        });
        const addStep = vi.fn();

        const job = (
            await import("@/server/cron-jobs/takeCustomerPolicyTrendSnapshots")
        ).default;

        await expect(job(undefined, undefined, { addStep })).rejects.toThrow(
            /As-of rewrite drain/
        );

        expect(addStep).toHaveBeenCalledWith(
            "AS_OF_REWRITE_DRAIN_DONE",
            expect.stringContaining("2 failures"),
            "ERROR",
            expect.objectContaining({ failures: 2 })
        );
    });

    it("fails the job when drain throws", async () => {
        drainAsOfRewriteQueue.mockRejectedValue(new Error("drain blew up"));
        const addStep = vi.fn();

        const job = (
            await import("@/server/cron-jobs/takeCustomerPolicyTrendSnapshots")
        ).default;

        await expect(job(undefined, undefined, { addStep })).rejects.toThrow(
            "drain blew up"
        );

        expect(addStep).toHaveBeenCalledWith(
            "AS_OF_REWRITE_DRAIN_ERROR",
            "drain blew up",
            "ERROR",
            expect.objectContaining({ stack: expect.any(String) })
        );
    });

    it("does not fail the job when drain only skips for admin backfill", async () => {
        drainAsOfRewriteQueue.mockResolvedValue({
            itemsProcessed: 0,
            daysRewritten: 0,
            failures: 0,
            skippedForBackfill: 4,
        });
        const addStep = vi.fn();

        const job = (
            await import("@/server/cron-jobs/takeCustomerPolicyTrendSnapshots")
        ).default;

        const result = await job(undefined, undefined, { addStep });

        expect(result.success).toBe(true);
        expect(addStep).toHaveBeenCalledWith(
            "AS_OF_REWRITE_DRAIN_DONE",
            expect.stringContaining("4 skipped for admin backfill"),
            "INFO",
            expect.objectContaining({ skippedForBackfill: 4, failures: 0 })
        );
    });

    it("surfaces both today-write and drain failures in steps when both fail", async () => {
        takeCustomerPolicyTrendSnapshots.mockRejectedValue(
            new Error("today snapshot failed")
        );
        drainAsOfRewriteQueue.mockRejectedValue(new Error("drain blew up"));
        const addStep = vi.fn();

        const job = (
            await import("@/server/cron-jobs/takeCustomerPolicyTrendSnapshots")
        ).default;

        await expect(job(undefined, undefined, { addStep })).rejects.toThrow();

        expect(addStep).toHaveBeenCalledWith(
            "POLICY_TREND_ERROR",
            "today snapshot failed",
            "ERROR",
            expect.objectContaining({ stack: expect.any(String) })
        );
        expect(addStep).toHaveBeenCalledWith(
            "AS_OF_REWRITE_DRAIN_ERROR",
            "drain blew up",
            "ERROR",
            expect.objectContaining({ stack: expect.any(String) })
        );
    });
});
