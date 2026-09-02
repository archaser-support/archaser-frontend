import { describe, expect, it } from "vitest";

import {
    BACKFILL_TAIL_STEPS,
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

function waitingTailProgressRows(): Array<[string, string]> {
    return BACKFILL_TAIL_STEPS.map((step) => [step.label, "waiting"]);
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
        ).toEqual(["Customer", "Payment", "Invoice", "Contact"]);
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
                    entity_type: "Payment",
                    backfill_completed: true,
                    backfill_records_pulled: 1867,
                }),
                syncState({
                    entity_type: "Invoice",
                    backfill_records_pulled: 12400,
                    last_error: null,
                }),
            ],
            // Live progress present — completed chips stay for prior entities.
            entityStats: {
                Customer: {
                    pulled: 100,
                    success: 100,
                    failed: 0,
                    skipped: 0,
                },
                Payment: {
                    pulled: 1867,
                    success: 1867,
                    failed: 0,
                    skipped: 0,
                },
                Invoice: {
                    pulled: 50,
                    success: 40,
                    failed: 0,
                    skipped: 0,
                },
            },
        });

        expect(rows.map((row) => [row.entity_type, row.phase])).toEqual([
            ["Customer", "done"],
            ["Payment", "done"],
            ["Invoice", "running"],
            ["Link payments", "waiting"],
            ...waitingTailProgressRows(),
        ]);
        // No known ERP total → estimate from page size so the bar stays determinate.
        expect(rows[2].progress_percent).toBe(9);
        expect(rows[2].records_pulled).toBe(50);
        expect(rows[0].records_pulled).toBe(100);
        expect(rows[1].records_pulled).toBe(1867);
        expect(rows[3].records_pulled).toBe(0);
    });

    it("does not mark later entities Done from stale prior-run backfill_completed", () => {
        // After Customer finishes this run, Payment is still sampling columns —
        // Invoice/Contact/Payment may still have backfill_completed from before.
        const rows = buildRunningEntityProgressRows({
            enabledEntities: ["Customer", "Payment", "Invoice", "Contact"],
            syncStates: [
                syncState({
                    entity_type: "Customer",
                    backfill_completed: true,
                    backfill_records_pulled: 1,
                }),
                syncState({
                    entity_type: "Payment",
                    backfill_completed: true,
                    backfill_records_pulled: 1982,
                }),
                syncState({
                    entity_type: "Invoice",
                    backfill_completed: true,
                    backfill_records_pulled: 2000,
                }),
                syncState({
                    entity_type: "Contact",
                    backfill_completed: true,
                    backfill_records_pulled: 5,
                }),
            ],
            entityStats: {
                Customer: { pulled: 1, success: 1, failed: 0, skipped: 0 },
            },
        });

        expect(rows.map((row) => [row.entity_type, row.phase])).toEqual([
            ["Customer", "done"],
            ["Payment", "running"],
            ["Invoice", "waiting"],
            ["Link payments", "waiting"],
            ["Contact", "waiting"],
            ...waitingTailProgressRows(),
        ]);
    });

    it("does not mark Invoice Done or start Link payments from checkpoint-only stale flags", () => {
        // Live entity_stats empty (common while sync-runs lag) but sync_states
        // updated — must not treat prior-run Invoice completion as Done.
        const rows = buildRunningEntityProgressRows({
            enabledEntities: ["Customer", "Payment", "Invoice"],
            syncStates: [
                syncState({
                    entity_type: "Customer",
                    backfill_completed: true,
                    backfill_records_pulled: 1,
                }),
                syncState({
                    entity_type: "Payment",
                    backfill_completed: false,
                    backfill_records_pulled: 1982,
                    backfill_cursor_present: true,
                }),
                syncState({
                    entity_type: "Invoice",
                    backfill_completed: true,
                    backfill_records_pulled: 2000,
                }),
            ],
            entityStats: {},
        });

        expect(rows.map((row) => [row.entity_type, row.phase])).toEqual([
            ["Customer", "done"],
            ["Payment", "running"],
            ["Invoice", "waiting"],
            ["Link payments", "waiting"],
            ...waitingTailProgressRows(),
        ]);
        expect(rows[1].records_pulled).toBe(1982);
    });

    it("keeps the frontier entity Running until pages are exhausted", () => {
        // First Payment page landed, but prior-run backfill_completed is still
        // true until the exhausted-page checkpoint — must not show Done yet.
        const rows = buildRunningEntityProgressRows({
            enabledEntities: ["Customer", "Payment", "Invoice"],
            syncStates: [
                syncState({
                    entity_type: "Customer",
                    backfill_completed: true,
                    backfill_records_pulled: 1,
                }),
                syncState({
                    entity_type: "Payment",
                    backfill_completed: true,
                    backfill_records_pulled: 500,
                    backfill_cursor_present: true,
                }),
                syncState({
                    entity_type: "Invoice",
                    backfill_completed: true,
                    backfill_records_pulled: 2000,
                }),
            ],
            entityStats: {
                Customer: { pulled: 1, success: 1, failed: 0, skipped: 0 },
                Payment: { pulled: 500, success: 500, failed: 0, skipped: 0 },
            },
        });

        expect(rows.map((row) => [row.entity_type, row.phase])).toEqual([
            ["Customer", "done"],
            ["Payment", "running"],
            ["Invoice", "waiting"],
            ["Link payments", "waiting"],
            ...waitingTailProgressRows(),
        ]);
    });

    it("marks the frontier entity Done only after backfill_completed", () => {
        const rows = buildRunningEntityProgressRows({
            enabledEntities: ["Customer", "Payment", "Invoice"],
            syncStates: [
                syncState({
                    entity_type: "Customer",
                    backfill_completed: true,
                    backfill_records_pulled: 1,
                }),
                syncState({
                    entity_type: "Payment",
                    backfill_completed: true,
                    backfill_records_pulled: 1982,
                }),
                syncState({
                    entity_type: "Invoice",
                    backfill_completed: false,
                    backfill_records_pulled: 0,
                }),
            ],
            entityStats: {
                Customer: { pulled: 1, success: 1, failed: 0, skipped: 0 },
                Payment: { pulled: 1982, success: 1982, failed: 0, skipped: 0 },
            },
        });

        expect(rows.map((row) => [row.entity_type, row.phase])).toEqual([
            ["Customer", "done"],
            ["Payment", "done"],
            ["Invoice", "running"],
            ["Link payments", "waiting"],
            ...waitingTailProgressRows(),
        ]);
    });

    it("resets Done/Failed chips and counters while the new run has no live progress yet", () => {
        const rows = buildRunningEntityProgressRows({
            enabledEntities: ["Customer", "Payment", "Invoice"],
            syncStates: [
                syncState({
                    entity_type: "Customer",
                    backfill_completed: true,
                    backfill_records_pulled: 100,
                    backfill_total_records: 100,
                }),
                syncState({
                    entity_type: "Payment",
                    backfill_completed: true,
                    backfill_records_pulled: 50,
                    last_error: "boom",
                }),
                syncState({
                    entity_type: "Invoice",
                    backfill_records_pulled: 10,
                    backfill_total_records: 20000,
                    last_error: "still failing",
                }),
            ],
            entityStats: {
                Customer: { pulled: 0, success: 0, failed: 0, skipped: 0 },
                Payment: { pulled: 0, success: 0, failed: 0, skipped: 0 },
                Invoice: { pulled: 0, success: 0, failed: 0, skipped: 0 },
            },
        });

        expect(rows.map((row) => [row.entity_type, row.phase])).toEqual([
            ["Customer", "running"],
            ["Payment", "waiting"],
            ["Invoice", "waiting"],
            ["Link payments", "waiting"],
            ...waitingTailProgressRows(),
        ]);
        expect(rows.every((row) => row.last_error == null)).toBe(true);
        expect(rows.every((row) => row.records_pulled === 0)).toBe(true);
        expect(rows.every((row) => row.total_records == null)).toBe(true);
    });

    it("advances to the next entity when prior entity finished this run but entity_stats are still placeholders", () => {
        const runStartedAt = "2026-08-04T00:00:00.000Z";
        const rows = buildRunningEntityProgressRows({
            enabledEntities: ["Payment", "Invoice"],
            runStartedAt,
            syncStates: [
                syncState({
                    entity_type: "Payment",
                    backfill_completed: true,
                    backfill_records_pulled: 1867,
                    last_attempt_at: "2026-08-04T00:05:00.000Z",
                }),
                syncState({
                    entity_type: "Invoice",
                    backfill_records_pulled: 0,
                }),
            ],
            entityStats: {
                Payment: { pulled: 0, success: 0, failed: 0, skipped: 0 },
                Invoice: { pulled: 0, success: 0, failed: 0, skipped: 0 },
            },
        });

        expect(rows.map((row) => [row.entity_type, row.phase])).toEqual([
            ["Payment", "done"],
            ["Invoice", "running"],
            ["Link payments", "waiting"],
            ...waitingTailProgressRows(),
        ]);
        expect(rows[0].records_pulled).toBe(1867);
        expect(rows[1].records_pulled).toBe(0);
    });

    it("marks Payment Done when sync_state frontier moved to Invoice but only Payment has live stats", () => {
        const rows = buildRunningEntityProgressRows({
            enabledEntities: ["Payment", "Invoice"],
            runStartedAt: "2026-09-01T18:28:00.000Z",
            syncStates: [
                syncState({
                    entity_type: "Payment",
                    backfill_completed: true,
                    backfill_records_pulled: 100000,
                    last_attempt_at: "2026-09-01T18:28:43.000Z",
                }),
                syncState({
                    entity_type: "Invoice",
                    backfill_completed: false,
                    backfill_records_pulled: 1000,
                    backfill_cursor_present: true,
                    last_attempt_at: "2026-09-01T18:23:24.525Z",
                }),
            ],
            entityStats: {
                Payment: {
                    pulled: 100000,
                    success: 100000,
                    failed: 0,
                    skipped: 0,
                },
                Invoice: { pulled: 0, success: 0, failed: 0, skipped: 0 },
            },
        });

        expect(rows.map((row) => [row.entity_type, row.phase])).toEqual([
            ["Payment", "done"],
            ["Invoice", "running"],
            ["Link payments", "waiting"],
            ...waitingTailProgressRows(),
        ]);
    });

    it("lists all tail steps as Waiting while a backfill run is in progress", () => {
        const rows = buildRunningEntityProgressRows({
            enabledEntities: ["Customer", "Invoice"],
            syncStates: [
                syncState({
                    entity_type: "Customer",
                    backfill_completed: true,
                    backfill_records_pulled: 1,
                }),
                syncState({
                    entity_type: "Invoice",
                    backfill_records_pulled: 1,
                }),
            ],
            entityStats: {
                Customer: { pulled: 1, success: 1, failed: 0, skipped: 0 },
                Invoice: { pulled: 1, success: 0, failed: 0, skipped: 0 },
            },
        });

        expect(
            rows.slice(-BACKFILL_TAIL_STEPS.length).map((row) => [
                row.entity_type,
                row.phase,
            ])
        ).toEqual(waitingTailProgressRows());
    });

    it("hides AR tail steps when only Customer or Contact are enabled", () => {
        const customerOnly = buildRunningEntityProgressRows({
            enabledEntities: ["Customer"],
            syncStates: [
                syncState({
                    entity_type: "Customer",
                    backfill_records_pulled: 1,
                }),
            ],
            entityStats: {
                Customer: { pulled: 1, success: 0, failed: 0, skipped: 0 },
            },
        });
        expect(
            customerOnly.some((row) =>
                BACKFILL_TAIL_STEPS.some((step) => step.label === row.entity_type)
            )
        ).toBe(false);

        const contactOnly = buildRunningEntityProgressRows({
            enabledEntities: ["Contact"],
            syncStates: [
                syncState({
                    entity_type: "Contact",
                    backfill_records_pulled: 1,
                }),
            ],
            entityStats: {
                Contact: { pulled: 1, success: 0, failed: 0, skipped: 0 },
            },
        });
        expect(
            contactOnly.some((row) =>
                BACKFILL_TAIL_STEPS.some((step) => step.label === row.entity_type)
            )
        ).toBe(false);
    });

    it("shows AR tail steps for Payment-only backfill but not Link payments", () => {
        const rows = buildRunningEntityProgressRows({
            enabledEntities: ["Customer", "Payment"],
            syncStates: [
                syncState({
                    entity_type: "Customer",
                    backfill_completed: true,
                    backfill_records_pulled: 1,
                }),
                syncState({
                    entity_type: "Payment",
                    backfill_records_pulled: 10,
                }),
            ],
            entityStats: {
                Customer: { pulled: 1, success: 1, failed: 0, skipped: 0 },
                Payment: { pulled: 10, success: 0, failed: 0, skipped: 0 },
            },
        });

        expect(rows.some((row) => row.entity_type === "Link payments")).toBe(
            false
        );
        expect(
            rows.slice(-BACKFILL_TAIL_STEPS.length).map((row) => row.entity_type)
        ).toEqual(BACKFILL_TAIL_STEPS.map((step) => step.label));
    });

    it("uses live entity_stats pulled counts while the run is in progress", () => {
        const rows = buildRunningEntityProgressRows({
            enabledEntities: ["Invoice"],
            syncStates: [
                syncState({
                    entity_type: "Invoice",
                    backfill_records_pulled: 9000,
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

    it("resets incomplete counters to live zeros instead of stale sync_state", () => {
        const rows = buildRunningEntityProgressRows({
            enabledEntities: ["Invoice"],
            syncStates: [
                syncState({
                    entity_type: "Invoice",
                    backfill_records_pulled: 12400,
                    backfill_total_records: 20000,
                }),
            ],
            entityStats: {
                Invoice: {
                    pulled: 0,
                    success: 0,
                    failed: 0,
                    skipped: 0,
                },
            },
        });

        expect(rows[0].phase).toBe("running");
        expect(rows[0].records_pulled).toBe(0);
        // Stale total is cleared until live progress reports a new one.
        expect(rows[0].total_records).toBeNull();
        expect(rows[0].progress_percent).toBeNull();
    });

    it("uses determinate percent when total is known", () => {
        const rows = buildRunningEntityProgressRows({
            enabledEntities: ["Customer"],
            syncStates: [
                syncState({
                    entity_type: "Customer",
                    backfill_total_records: 100,
                }),
            ],
            entityStats: {
                Customer: {
                    pulled: 25,
                    success: 0,
                    failed: 0,
                    skipped: 0,
                },
            },
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
            entityStats: {
                Customer: {
                    pulled: 10,
                    success: 0,
                    failed: 10,
                    skipped: 0,
                },
            },
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
        expect(rows[1].phase).toBe("not_started");
        expect(rows[2].phase).toBe("failed");
        expect(rows[2].failed).toBe(80);
        expect(rows[2].last_error).toBe("amount required");
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
            entityStats: {
                Customer: {
                    pulled: 10,
                    success: 10,
                    failed: 0,
                    skipped: 0,
                },
                Invoice: {
                    pulled: 1,
                    success: 0,
                    failed: 0,
                    skipped: 0,
                },
            },
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
