import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    coalesceCheckpointDate,
    drainAsOfRewriteQueue,
    enqueueAsOfRewriteInTransaction,
    isAdminBackfillBlockingDrain,
    isStaleProcessingUpdatedAt,
    mergeRewriteRange,
    REWRITE_QUEUE_STALE_PROCESSING_MS,
    resolveRewriteDrainStart,
} from "@/server/services/creditInsurance/asOfRewriteQueue";

function day(iso: string): Date {
    return new Date(`${iso}T00:00:00.000Z`);
}

function sqlText(strings: TemplateStringsArray): string {
    return strings.join("?");
}

describe("mergeRewriteRange", () => {
    it("widens the date span across overlapping ranges", () => {
        const merged = mergeRewriteRange(
            { customerIds: [1], fromDate: day("2026-03-10"), toDate: day("2026-03-20") },
            { customerIds: [2], fromDate: day("2026-03-01"), toDate: day("2026-03-15") }
        );
        expect(merged.fromDate.toISOString().slice(0, 10)).toBe("2026-03-01");
        expect(merged.toDate.toISOString().slice(0, 10)).toBe("2026-03-20");
    });

    it("unions customer ids", () => {
        const merged = mergeRewriteRange(
            { customerIds: [1, 3], fromDate: day("2026-03-10"), toDate: day("2026-03-20") },
            { customerIds: [2, 3], fromDate: day("2026-03-10"), toDate: day("2026-03-20") }
        );
        expect(merged.customerIds).toEqual([1, 2, 3]);
    });

    it("treats an empty customer set as whole-account (widest scope wins)", () => {
        const existingAll = mergeRewriteRange(
            { customerIds: [], fromDate: day("2026-03-10"), toDate: day("2026-03-20") },
            { customerIds: [2], fromDate: day("2026-03-10"), toDate: day("2026-03-20") }
        );
        expect(existingAll.customerIds).toEqual([]);

        const incomingAll = mergeRewriteRange(
            { customerIds: [1], fromDate: day("2026-03-10"), toDate: day("2026-03-20") },
            { customerIds: [], fromDate: day("2026-03-10"), toDate: day("2026-03-20") }
        );
        expect(incomingAll.customerIds).toEqual([]);
    });

    it("keeps the earliest from and latest to for disjoint ranges", () => {
        const merged = mergeRewriteRange(
            { customerIds: [1], fromDate: day("2026-01-05"), toDate: day("2026-01-10") },
            { customerIds: [1], fromDate: day("2026-02-01"), toDate: day("2026-02-05") }
        );
        expect(merged.fromDate.toISOString().slice(0, 10)).toBe("2026-01-05");
        expect(merged.toDate.toISOString().slice(0, 10)).toBe("2026-02-05");
    });
});

describe("resolveRewriteDrainStart", () => {
    it("starts at fromDate when there is no checkpoint", () => {
        expect(
            resolveRewriteDrainStart(day("2026-07-01"), null).toISOString().slice(0, 10)
        ).toBe("2026-07-01");
    });

    it("resumes on the calendar day after the last completed checkpoint", () => {
        expect(
            resolveRewriteDrainStart(day("2026-07-01"), day("2026-07-03"))
                .toISOString()
                .slice(0, 10)
        ).toBe("2026-07-04");
    });

    it("never starts before fromDate (stale checkpoint guard)", () => {
        expect(
            resolveRewriteDrainStart(day("2026-07-10"), day("2026-07-01"))
                .toISOString()
                .slice(0, 10)
        ).toBe("2026-07-10");
    });
});

describe("coalesceCheckpointDate", () => {
    it("clears checkpoint when coalesce widens fromDate backward", () => {
        expect(
            coalesceCheckpointDate(
                day("2026-07-10"),
                day("2026-07-01"),
                day("2026-07-15")
            )
        ).toBeNull();
    });

    it("keeps checkpoint when fromDate does not move earlier", () => {
        const kept = coalesceCheckpointDate(
            day("2026-07-01"),
            day("2026-07-01"),
            day("2026-07-05")
        );
        expect(kept?.toISOString().slice(0, 10)).toBe("2026-07-05");
    });
});

describe("isStaleProcessingUpdatedAt", () => {
    const now = new Date("2026-07-27T12:00:00.000Z");

    it("treats updated_at older than 60 minutes as stale", () => {
        const updatedAt = new Date(
            now.getTime() - REWRITE_QUEUE_STALE_PROCESSING_MS
        );
        expect(isStaleProcessingUpdatedAt(updatedAt, now)).toBe(true);
    });

    it("does not treat fresh processing updated_at as stale", () => {
        const updatedAt = new Date(
            now.getTime() - REWRITE_QUEUE_STALE_PROCESSING_MS + 60_000
        );
        expect(isStaleProcessingUpdatedAt(updatedAt, now)).toBe(false);
    });
});

describe("enqueueAsOfRewriteInTransaction coalesce checkpoint", () => {
    it("resets checkpoint_date when coalesce widens fromDate backward", async () => {
        const executeRaw = vi.fn(async () => 1);
        const queryRaw = vi.fn(async () => [
            {
                id: 3n,
                from_date: day("2026-07-10"),
                to_date: day("2026-07-20"),
                customer_ids: [1],
                checkpoint_date: day("2026-07-15"),
            },
        ]);

        await enqueueAsOfRewriteInTransaction(
            { $queryRaw: queryRaw, $executeRaw: executeRaw } as never,
            {
                accountId: 42,
                customerIds: [1],
                fromDate: day("2026-07-01"),
                toDate: day("2026-07-12"),
            }
        );

        const updateCall = executeRaw.mock.calls[0]!;
        expect(sqlText(updateCall[0] as TemplateStringsArray)).toContain(
            "checkpoint_date ="
        );
        // Tagged template value order: customer_ids, from_date, to_date, checkpoint, id
        expect(updateCall[4]).toBeNull();
        expect((updateCall[2] as Date).toISOString().slice(0, 10)).toBe(
            "2026-07-01"
        );
    });
});

describe("isAdminBackfillBlockingDrain", () => {
    it("blocks drain when backfill is running or paused", () => {
        expect(isAdminBackfillBlockingDrain("running")).toBe(true);
        expect(isAdminBackfillBlockingDrain("paused")).toBe(true);
    });

    it("does not block when backfill is idle, complete, failed, or absent", () => {
        expect(isAdminBackfillBlockingDrain("idle")).toBe(false);
        expect(isAdminBackfillBlockingDrain("complete")).toBe(false);
        expect(isAdminBackfillBlockingDrain("failed")).toBe(false);
        expect(isAdminBackfillBlockingDrain(null)).toBe(false);
        expect(isAdminBackfillBlockingDrain(undefined)).toBe(false);
    });
});

describe("drainAsOfRewriteQueue", () => {
    const now = new Date("2026-07-27T12:00:00.000Z");
    let executeRaw: ReturnType<typeof vi.fn>;
    let queryRaw: ReturnType<typeof vi.fn>;
    let syncCpt: ReturnType<typeof vi.fn>;
    let takeDashboard: ReturnType<typeof vi.fn>;
    let dbClient: {
        $executeRaw: ReturnType<typeof vi.fn>;
        $queryRaw: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        executeRaw = vi.fn(async (strings: TemplateStringsArray) => {
            const sql = sqlText(strings);
            if (sql.includes("status = 'processing'") && sql.includes("AND status = 'pending'")) {
                return 1; // claim
            }
            return 1;
        });
        queryRaw = vi.fn(async () => []);
        syncCpt = vi.fn(async () => undefined);
        takeDashboard = vi.fn(async () => undefined);
        dbClient = { $executeRaw: executeRaw, $queryRaw: queryRaw };
    });

    async function drain() {
        return drainAsOfRewriteQueue({
            dbClient: dbClient as never,
            now,
            writers: {
                syncCustomerPolicyTrendSnapshotForAccount: syncCpt,
                takeCreditDashboardDailySnapshotsForAccount: takeDashboard,
            },
        });
    }

    function pendingItem(overrides: Partial<{
        id: bigint;
        account_id: number;
        from_date: Date;
        to_date: Date;
        customer_ids: number[];
        checkpoint_date: Date | null;
    }> = {}) {
        return {
            id: 7n,
            account_id: 42,
            from_date: day("2026-07-01"),
            to_date: day("2026-07-04"),
            customer_ids: [] as number[],
            checkpoint_date: null as Date | null,
            ...overrides,
        };
    }

    it("reclaims stale processing rows before claiming pending work", async () => {
        queryRaw.mockResolvedValueOnce([]);
        await drain();

        const firstSql = sqlText(executeRaw.mock.calls[0]![0] as TemplateStringsArray);
        expect(firstSql).toContain("status = 'processing'");
        expect(firstSql).toContain("updated_at <");
        const staleBefore = executeRaw.mock.calls[0]![2] as Date;
        expect(staleBefore.getTime()).toBe(
            now.getTime() - REWRITE_QUEUE_STALE_PROCESSING_MS
        );
    });

    it("does not reclaim fresh processing via a shorter threshold", async () => {
        // Fresh rows fail the SQL predicate (updated_at < now-60m); assert the
        // cutoff is exactly 60 minutes so younger rows stay processing.
        queryRaw.mockResolvedValueOnce([]);
        await drain();
        const staleBefore = executeRaw.mock.calls[0]![2] as Date;
        const freshUpdatedAt = new Date(now.getTime() - 30 * 60 * 1000);
        expect(freshUpdatedAt.getTime() >= staleBefore.getTime()).toBe(true);
        expect(isStaleProcessingUpdatedAt(freshUpdatedAt, now)).toBe(false);
    });

    it("resumes from the day after checkpoint instead of fromDate", async () => {
        queryRaw
            .mockResolvedValueOnce([
                pendingItem({
                    checkpoint_date: day("2026-07-02"),
                }),
            ])
            .mockResolvedValueOnce([]); // no blocking backfill

        const result = await drain();

        expect(result.itemsProcessed).toBe(1);
        expect(result.daysRewritten).toBe(2);
        expect(result.failures).toBe(0);
        expect(result.skippedForBackfill).toBe(0);

        const cptDays = syncCpt.mock.calls.map(
            (call) => (call[1] as { snapshotDate: Date }).snapshotDate.toISOString().slice(0, 10)
        );
        expect(cptDays).toEqual(["2026-07-03", "2026-07-04"]);

        const checkpointUpdates = executeRaw.mock.calls.filter((call) =>
            sqlText(call[0] as TemplateStringsArray).includes("checkpoint_date =")
        );
        expect(checkpointUpdates).toHaveLength(2);
    });

    it("on mid-window failure keeps work resumable and bumps attempts/last_error", async () => {
        queryRaw
            .mockResolvedValueOnce([
                pendingItem({
                    id: 9n,
                    to_date: day("2026-07-03"),
                    customer_ids: [11],
                }),
            ])
            .mockResolvedValueOnce([]);
        syncCpt
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error("writer blew up"));

        const result = await drain();

        expect(result.failures).toBe(1);
        expect(result.itemsProcessed).toBe(0);
        expect(result.daysRewritten).toBe(1);
        expect(result.skippedForBackfill).toBe(0);

        const failUpdate = executeRaw.mock.calls.find((call) =>
            sqlText(call[0] as TemplateStringsArray).includes("attempts = attempts + 1")
        );
        expect(failUpdate).toBeDefined();
        expect(sqlText(failUpdate![0] as TemplateStringsArray)).toContain(
            "status = 'pending'"
        );
        expect(sqlText(failUpdate![0] as TemplateStringsArray)).toContain("last_error");
        // First day was checkpointed before the failure.
        const checkpointUpdates = executeRaw.mock.calls.filter((call) =>
            sqlText(call[0] as TemplateStringsArray).includes("checkpoint_date =")
        );
        expect(checkpointUpdates.length).toBeGreaterThanOrEqual(1);
    });

    it("skips an account while admin as-of backfill is running", async () => {
        queryRaw
            .mockResolvedValueOnce([pendingItem()])
            .mockResolvedValueOnce([{ account_id: 42 }]);

        const result = await drain();

        expect(result.skippedForBackfill).toBe(1);
        expect(result.itemsProcessed).toBe(0);
        expect(result.daysRewritten).toBe(0);
        expect(result.failures).toBe(0);
        expect(syncCpt).not.toHaveBeenCalled();
        expect(takeDashboard).not.toHaveBeenCalled();

        const claimUpdates = executeRaw.mock.calls.filter((call) => {
            const sql = sqlText(call[0] as TemplateStringsArray);
            return sql.includes("status = 'processing'") && sql.includes("AND status = 'pending'");
        });
        expect(claimUpdates).toHaveLength(0);

        const backfillSql = sqlText(
            queryRaw.mock.calls[1]![0] as TemplateStringsArray
        );
        expect(backfillSql).toContain("CreditAsOfBackfillJob");
        expect(backfillSql).toContain("running");
        expect(backfillSql).toContain("paused");
    });

    it("skips an account while admin as-of backfill is paused", async () => {
        queryRaw
            .mockResolvedValueOnce([pendingItem({ id: 8n })])
            .mockResolvedValueOnce([{ account_id: 42 }]);

        const result = await drain();

        expect(result.skippedForBackfill).toBe(1);
        expect(result.failures).toBe(0);
        expect(syncCpt).not.toHaveBeenCalled();
    });

    it("drains normally after admin as-of backfill is complete", async () => {
        queryRaw
            .mockResolvedValueOnce([
                pendingItem({
                    from_date: day("2026-07-01"),
                    to_date: day("2026-07-02"),
                    checkpoint_date: null,
                }),
            ])
            .mockResolvedValueOnce([]); // complete/idle = not in running|paused query

        const result = await drain();

        expect(result.skippedForBackfill).toBe(0);
        expect(result.itemsProcessed).toBe(1);
        expect(result.daysRewritten).toBe(2);
        expect(result.failures).toBe(0);
        expect(syncCpt).toHaveBeenCalledTimes(2);
        expect(takeDashboard).toHaveBeenCalledTimes(2);
    });
});
