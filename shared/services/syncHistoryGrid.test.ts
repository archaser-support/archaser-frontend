import { describe, expect, it } from "vitest";

import { MATURITY_ENTITY_STATS_KEY } from "@/shared/services/backfillImportProgress";
import type { SyncRunSummary } from "@/shared/services/billingConnectorService";
import {
    formatEntityStatsCell,
    formatSyncHistoryDuration,
    toSyncHistoryGridRow,
} from "@/shared/services/syncHistoryGrid";

function run(
    partial: Partial<SyncRunSummary> & Pick<SyncRunSummary, "id">
): SyncRunSummary {
    return {
        trigger: "manual",
        sync_mode: "BACKFILL",
        status: "SUCCESS",
        started_at: "2026-08-26T10:00:00.000Z",
        completed_at: "2026-08-26T10:01:00.000Z",
        duration_seconds: 60,
        entity_stats: {},
        error_message: null,
        error_type: null,
        ...partial,
    };
}

describe("formatEntityStatsCell", () => {
    it("returns em dash when the entity key is missing", () => {
        expect(formatEntityStatsCell({}, "Customer")).toBe("—");
        expect(formatEntityStatsCell(undefined, "Invoice")).toBe("—");
        expect(formatEntityStatsCell({}, MATURITY_ENTITY_STATS_KEY)).toBe("—");
    });

    it("formats pulled / success / failed when present", () => {
        expect(
            formatEntityStatsCell(
                {
                    Customer: {
                        pulled: 10,
                        success: 8,
                        failed: 2,
                        skipped: 0,
                    },
                },
                "Customer"
            )
        ).toBe("10 / 8 / 2");
    });

    it("formats zero counts when the slice exists", () => {
        expect(
            formatEntityStatsCell(
                {
                    Payment: {
                        pulled: 0,
                        success: 0,
                        failed: 0,
                        skipped: 0,
                    },
                },
                "Payment"
            )
        ).toBe("0 / 0 / 0");
    });

    it("formats Link payments from _maturity", () => {
        expect(
            formatEntityStatsCell(
                {
                    [MATURITY_ENTITY_STATS_KEY]: {
                        pulled: 5,
                        success: 4,
                        failed: 1,
                        skipped: 0,
                        status: "done",
                    },
                },
                MATURITY_ENTITY_STATS_KEY
            )
        ).toBe("5 / 4 / 1");
    });
});

describe("formatSyncHistoryDuration", () => {
    it("returns em dash for nullish duration", () => {
        expect(formatSyncHistoryDuration(null)).toBe("—");
        expect(formatSyncHistoryDuration(undefined)).toBe("—");
    });

    it("appends seconds suffix", () => {
        expect(formatSyncHistoryDuration(0)).toBe("0s");
        expect(formatSyncHistoryDuration(42)).toBe("42s");
    });
});

describe("toSyncHistoryGridRow", () => {
    it("maps run fields and entity cells", () => {
        const row = toSyncHistoryGridRow(
            run({
                id: "exec-1",
                error_message: "boom",
                entity_stats: {
                    Customer: {
                        pulled: 1,
                        success: 1,
                        failed: 0,
                        skipped: 0,
                    },
                    [MATURITY_ENTITY_STATS_KEY]: {
                        pulled: 2,
                        success: 2,
                        failed: 0,
                        skipped: 0,
                    },
                },
            })
        );
        expect(row.id).toBe("exec-1");
        expect(row.status).toBe("SUCCESS");
        expect(row.mode).toBe("BACKFILL");
        expect(row.trigger).toBe("manual");
        expect(row.duration).toBe("60s");
        expect(row.error).toBe("boom");
        expect(row.customer).toBe("1 / 1 / 0");
        expect(row.contact).toBe("—");
        expect(row.invoice).toBe("—");
        expect(row.payment).toBe("—");
        expect(row.linkPayments).toBe("2 / 2 / 0");
    });

    it("uses em dash for blank error messages", () => {
        expect(toSyncHistoryGridRow(run({ id: "a", error_message: "  " })).error).toBe(
            "—"
        );
        expect(toSyncHistoryGridRow(run({ id: "b", error_message: null })).error).toBe(
            "—"
        );
    });
});
