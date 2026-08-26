import { describe, expect, it } from "vitest";

import {
    buildBackfillProgressHeader,
    buildFinishedEntityProgressRows,
    buildRunningEntityProgressRows,
    isBackfillSyncRun,
    orderEnabledBackfillEntities,
    resolveBackfillProgressRun,
    canStartFirstBackfill,
} from "@/shared/services/backfillImportProgress";
import type {
    ConnectorSyncStatePublic,
    SyncRunSummary,
} from "@/shared/services/billingConnectorService";

function syncState(
    partial: Partial<ConnectorSyncStatePublic> & { entity_type: ConnectorSyncStatePublic["entity_type"] }
): ConnectorSyncStatePublic {
    return {
        backfill_completed: false,
        backfill_completed_at: null,
        backfill_cursor_present: false,
        backfill_records_pulled: 0,
        backfill_total_records: null,
        last_max_updated_at: null,
        last_successful_run_at: null,
        last_attempt_at: null,
        last_error: null,
        ...partial,
    };
}

function run(
    partial: Partial<SyncRunSummary> & Pick<SyncRunSummary, "id" | "status">
): SyncRunSummary {
    return {
        trigger: "backfill",
        sync_mode: "BACKFILL",
        started_at: "2026-08-04T00:00:00.000Z",
        completed_at: null,
        duration_seconds: null,
        entity_stats: {},
        error_message: null,
        error_type: null,
        ...partial,
    };
}

describe("backfillImportProgress", () => {
    it("detects backfill runs by sync_mode or trigger", () => {
        expect(
            isBackfillSyncRun({ sync_mode: "BACKFILL", trigger: "scheduled" })
        ).toBe(true);
        expect(
            isBackfillSyncRun({ sync_mode: "INCREMENTAL", trigger: "backfill" })
        ).toBe(true);
        expect(
            isBackfillSyncRun({ sync_mode: "INCREMENTAL", trigger: "manual" })
        ).toBe(false);
    });

    it("orders enabled entities in sync walk order", () => {
        expect(
            orderEnabledBackfillEntities([
                "Payment",
                "Customer",
                "Contact",
                "Invoice",
            ])
        ).toEqual(["Customer", "Invoice", "Payment", "Contact"]);
    });

    it("marks first incomplete entity as running with indeterminate progress", () => {
        const rows = buildRunningEntityProgressRows({
            enabledEntities: ["Customer", "Invoice", "Payment"],
            syncStates: [
                syncState({
                    entity_type: "Customer",
                    backfill_completed: true,
                    backfill_records_pulled: 100,
                }),
                syncState({
                    entity_type: "Invoice",
                    backfill_records_pulled: 12400,
                    last_error: null,
                }),
            ],
        });

        expect(rows.map((row) => [row.entity_type, row.phase])).toEqual([
            ["Customer", "done"],
            ["Invoice", "running"],
            ["Payment", "waiting"],
        ]);
        expect(rows[1].progress_percent).toBeNull();
        expect(rows[1].records_pulled).toBe(12400);
    });

    it("uses live entity_stats pulled counts while the run is in progress", () => {
        const rows = buildRunningEntityProgressRows({
            enabledEntities: ["Invoice"],
            syncStates: [
                syncState({
                    entity_type: "Invoice",
                    backfill_records_pulled: 0,
                }),
            ],
            entityStats: {
                Invoice: {
                    pulled: 500,
                    success: 0,
                    failed: 0,
                    skipped: 0,
                },
            },
        });

        expect(rows[0].phase).toBe("running");
        expect(rows[0].records_pulled).toBe(500);
    });

    it("uses determinate percent when total is known", () => {
        const rows = buildRunningEntityProgressRows({
            enabledEntities: ["Customer"],
            syncStates: [
                syncState({
                    entity_type: "Customer",
                    backfill_records_pulled: 25,
                    backfill_total_records: 100,
                }),
            ],
        });
        expect(rows[0].progress_percent).toBe(25);
    });

    it("surfaces last_error on the active entity as failed", () => {
        const rows = buildRunningEntityProgressRows({
            enabledEntities: ["Customer"],
            syncStates: [
                syncState({
                    entity_type: "Customer",
                    backfill_records_pulled: 10,
                    last_error: "All pulled records failed to import",
                }),
            ],
        });
        expect(rows[0].phase).toBe("failed");
        expect(rows[0].last_error).toContain("failed to import");
    });

    it("upgrades finished rows to success/failed/skipped summary", () => {
        const rows = buildFinishedEntityProgressRows({
            enabledEntities: ["Customer", "Invoice", "Payment"],
            syncStates: [
                syncState({
                    entity_type: "Customer",
                    backfill_completed: true,
                    backfill_records_pulled: 50,
                }),
            ],
            run: run({
                id: "exec-1",
                status: "PARTIAL",
                entity_stats: {
                    Customer: {
                        pulled: 50,
                        success: 50,
                        failed: 0,
                        skipped: 0,
                    },
                    Invoice: {
                        pulled: 1000,
                        success: 920,
                        failed: 80,
                        skipped: 0,
                        sample_errors: ["amount required"],
                    },
                },
            }),
        });

        expect(rows[0].phase).toBe("done");
        expect(rows[0].success).toBe(50);
        expect(rows[1].phase).toBe("failed");
        expect(rows[1].failed).toBe(80);
        expect(rows[1].last_error).toBe("amount required");
        expect(rows[2].phase).toBe("not_started");
    });

    it("builds header copy for running and failed states", () => {
        const runningRows = buildRunningEntityProgressRows({
            enabledEntities: ["Customer", "Invoice"],
            syncStates: [
                syncState({
                    entity_type: "Customer",
                    backfill_completed: true,
                }),
                syncState({
                    entity_type: "Invoice",
                    backfill_records_pulled: 1,
                }),
            ],
        });
        const runningHeader = buildBackfillProgressHeader({
            run: run({ id: "r1", status: "RUNNING" }),
            rows: runningRows,
        });
        expect(runningHeader.subtitle).toContain("Importing Invoice");
        expect(runningHeader.subtitle).toContain("Actions are disabled");

        const stoppingHeader = buildBackfillProgressHeader({
            run: run({
                id: "stop",
                status: "TIMEOUT",
                error_type: "cancelled",
                completed_at: null,
            }),
            rows: runningRows,
        });
        expect(stoppingHeader.subtitle).toMatch(/stopping/i);
        expect(stoppingHeader.severity).toBe("warning");

        const finishedRows = buildFinishedEntityProgressRows({
            enabledEntities: ["Invoice"],
            syncStates: [],
            run: run({
                id: "r2",
                status: "FAILED",
                entity_stats: {
                    Invoice: {
                        pulled: 10,
                        success: 0,
                        failed: 10,
                        skipped: 0,
                        sample_errors: ["boom"],
                    },
                },
            }),
        });
        const failedHeader = buildBackfillProgressHeader({
            run: run({ id: "r2", status: "FAILED" }),
            rows: finishedRows,
        });
        expect(failedHeader.severity).toBe("error");
        expect(failedHeader.subtitle).toContain("Invoice");
    });

    it("resolves progress run: prefer RUNNING, else tracked unfinished dismiss", () => {
        const running = run({ id: "live", status: "RUNNING" });
        const finished = run({
            id: "done",
            status: "SUCCESS",
            completed_at: "2026-08-04T01:00:00.000Z",
        });

        expect(
            resolveBackfillProgressRun({
                runs: [running, finished],
                session: null,
            }).run?.id
        ).toBe("live");

        expect(
            resolveBackfillProgressRun({
                runs: [finished],
                session: null,
            }).run
        ).toBeNull();

        expect(
            resolveBackfillProgressRun({
                runs: [finished],
                session: { executionId: "done", dismissed: false },
            }).run?.id
        ).toBe("done");

        expect(
            resolveBackfillProgressRun({
                runs: [finished],
                session: { executionId: "done", dismissed: true },
            }).run
        ).toBeNull();
    });

    it("gates first backfill on preview passes unless already locked or incremental", () => {
        expect(
            canStartFirstBackfill({
                enabledEntities: ["Customer", "Invoice"],
                previewPasses: {
                    Customer: {
                        passed: true,
                        completed_at: "2026-08-04T00:00:00.000Z",
                    },
                },
            })
        ).toBe(false);
        expect(
            canStartFirstBackfill({
                enabledEntities: ["Customer", "Invoice"],
                previewPasses: {
                    Customer: {
                        passed: true,
                        completed_at: "2026-08-04T00:00:00.000Z",
                    },
                    Invoice: {
                        passed: true,
                        completed_at: "2026-08-04T00:00:00.000Z",
                    },
                },
            })
        ).toBe(true);
        expect(
            canStartFirstBackfill({
                enabledEntities: ["Customer"],
                previewPasses: {},
                backfillOptionsLocked: true,
            })
        ).toBe(true);
        expect(
            canStartFirstBackfill({
                enabledEntities: ["Customer"],
                previewPasses: {},
                syncMode: "INCREMENTAL",
            })
        ).toBe(true);
    });
});
