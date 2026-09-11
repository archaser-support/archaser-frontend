import type { ImportType } from "@/types/db";

import type {
    BillingConnectorConfig,
    ConnectorSyncStatePublic,
    PreviewSyncResponse,
    SyncRunSummary,
} from "@/shared/services/billingConnectorService";

/** Matches connector ingest order: Customer → Payment → Invoice → Contact. */
export const BACKFILL_ENTITY_ORDER: ImportType[] = [
    "Customer",
    "Payment",
    "Invoice",
    "Contact",
];

/** Orchestration step after Invoice — links deferred payments to invoices. */
export const MATURITY_ENTITY_STATS_KEY = "_maturity";

/** Start backfill clear-before-import purge phase (before entity pull/import). */
export const PURGE_ENTITY_STATS_KEY = "_purge";

/** Progress-panel label for clear-before-import deletes. */
export const BACKFILL_DELETING_LABEL = "Record deletion";

/** Progress-panel labels for Payment / Invoice pull+import steps. */
export const BACKFILL_PAYMENT_IMPORT_LABEL = "Payment import";
export const BACKFILL_INVOICE_IMPORT_LABEL = "Invoice import";

/**
 * Tail steps after entity ingest. They run while the sync is still RUNNING, so
 * without their own rows the panel froze on the last entity and gave no reason
 * for the disabled action buttons.
 */
export const AR_REPLAY_ENTITY_STATS_KEY = "_ar_replay";
export const LIVE_REFRESH_ENTITY_STATS_KEY = "_live_refresh";
export const PROCESS_OVERDUE_ENTITY_STATS_KEY = "_process_overdue";
export const INSURANCE_TARGETS_ENTITY_STATS_KEY = "_insurance_targets";
export const PENDING_CLOSES_ENTITY_STATS_KEY = "_pending_closes";
export const BALANCES_ENTITY_STATS_KEY = "_balances";

export const BACKFILL_LINK_PAYMENTS_LABEL = "Link payments";

export const BACKFILL_AR_REPLAY_LABEL = "Replay AR history";
export const BACKFILL_LIVE_REFRESH_LABEL = "Refresh insurance fields";
export const BACKFILL_PROCESS_OVERDUE_LABEL = "Recompute overdue";
export const BACKFILL_INSURANCE_TARGETS_LABEL = "Refresh insurance dates";
export const BACKFILL_PENDING_CLOSES_LABEL = "Settle closed invoices";
export const BACKFILL_BALANCES_LABEL = "Recalculate balances";

/** Rendered in run order, after the entity rows. */
export const BACKFILL_TAIL_STEPS = [
    {
        key: PENDING_CLOSES_ENTITY_STATS_KEY,
        label: BACKFILL_PENDING_CLOSES_LABEL,
    },
    {
        key: PROCESS_OVERDUE_ENTITY_STATS_KEY,
        label: BACKFILL_PROCESS_OVERDUE_LABEL,
    },
    {
        key: INSURANCE_TARGETS_ENTITY_STATS_KEY,
        label: BACKFILL_INSURANCE_TARGETS_LABEL,
    },
    {
        key: AR_REPLAY_ENTITY_STATS_KEY,
        label: BACKFILL_AR_REPLAY_LABEL,
    },
    {
        key: LIVE_REFRESH_ENTITY_STATS_KEY,
        label: BACKFILL_LIVE_REFRESH_LABEL,
    },
    { key: BALANCES_ENTITY_STATS_KEY, label: BACKFILL_BALANCES_LABEL },
] as const;

export type BackfillTailStepLabel =
    (typeof BACKFILL_TAIL_STEPS)[number]["label"];

export type BackfillProgressRowKey =
    | Exclude<ImportType, "Payment" | "Invoice">
    | typeof BACKFILL_PAYMENT_IMPORT_LABEL
    | typeof BACKFILL_INVOICE_IMPORT_LABEL
    | typeof BACKFILL_LINK_PAYMENTS_LABEL
    | typeof BACKFILL_DELETING_LABEL
    | BackfillTailStepLabel;

/** Map connector entity types to progress-row display labels. */
export function progressRowLabelForEntity(
    entity: ImportType
): BackfillProgressRowKey {
    if (entity === "Payment") {
        return BACKFILL_PAYMENT_IMPORT_LABEL;
    }
    if (entity === "Invoice") {
        return BACKFILL_INVOICE_IMPORT_LABEL;
    }
    return entity;
}

const BACKFILL_PROGRESS_STEP_TOOLTIPS: Record<BackfillProgressRowKey, string> =
    {
        Customer:
            "Pulls customer master records from the ERP and creates or updates them in Archaser.",
        "Payment import":
            "Pulls payment and receipt lines from the ERP. Counter is imported / pulled (DB writes vs ERP rows).",
        "Invoice import":
            "Pulls invoice lines from the ERP. Counter is imported / pulled (DB writes vs ERP rows).",
        Contact:
            "Pulls customer contact people from the ERP and links them to customers.",
        Policy:
            "Imports credit insurance policy records when enabled for this connector.",
        // String keys (not computed consts) so Fast Refresh cannot leave a
        // dangling BACKFILL_* identifier after an export is removed.
        "Record deletion":
            "Deletes existing Archaser rows for the selected entities before ERP pull and import.",
        "Link payments":
            "Matches deferred payments to invoices, applies close rules, and recalculates invoice paid totals and outstanding balances.",
        "Settle closed invoices":
            "Runs account extension rules to close invoices that ERP reconciliation marks as fully paid.",
        "Recompute overdue":
            "Re-evaluates overdue invoices and updates collection status for every customer touched in this import.",
        "Refresh insurance dates":
            "Recomputes each invoice's insurance target reporting and MEP dates from due dates and customer credit terms before AR replay.",
        "Replay AR history":
            "Replays AR history from the MEP breach start date and stamps limit-assessed amounts on open invoices.",
        "Refresh insurance fields":
            "Refreshes credit-insurance fields (MEP block, capacity gap, and related columns) for imported invoices.",
        "Recalculate balances":
            "Recomputes each customer's denormalized due and overdue totals from their open invoices.",
    };

/** Explains what a progress-row step counts or calculates. */
export function getBackfillProgressStepTooltip(
    step: BackfillProgressRowKey
): string {
    return (
        BACKFILL_PROGRESS_STEP_TOOLTIPS[step] ??
        "Import progress for this step."
    );
}

export type EntityProgressPhase =
    | "waiting"
    | "running"
    | "queued"
    | "done"
    | "failed"
    | "not_started";

export interface EntityProgressRow {
    entity_type: BackfillProgressRowKey;
    phase: EntityProgressPhase;
    records_pulled: number;
    total_records: number | null;
    /** 0–100 when total is known; null → indeterminate while running. */
    progress_percent: number | null;
    last_error: string | null;
    success?: number;
    failed?: number;
    skipped?: number;
    /** Rows removed during clear-before-import (entity or Deleting… row). */
    deleted?: number;
    /** Sub-line for tail steps, e.g. "Applying matured payments · 1,240 / 2,027 payments". */
    detail?: string;
}

/** Maps backend active_step registry keys to progress-row labels. */
export const ACTIVE_STEP_TO_ROW_LABEL: Record<string, BackfillProgressRowKey> =
    {
        [PURGE_ENTITY_STATS_KEY]: BACKFILL_DELETING_LABEL,
        Customer: "Customer",
        Payment: BACKFILL_PAYMENT_IMPORT_LABEL,
        Invoice: BACKFILL_INVOICE_IMPORT_LABEL,
        Contact: "Contact",
        [MATURITY_ENTITY_STATS_KEY]: BACKFILL_LINK_PAYMENTS_LABEL,
        [PENDING_CLOSES_ENTITY_STATS_KEY]: BACKFILL_PENDING_CLOSES_LABEL,
        [PROCESS_OVERDUE_ENTITY_STATS_KEY]: BACKFILL_PROCESS_OVERDUE_LABEL,
        [INSURANCE_TARGETS_ENTITY_STATS_KEY]: BACKFILL_INSURANCE_TARGETS_LABEL,
        [AR_REPLAY_ENTITY_STATS_KEY]: BACKFILL_AR_REPLAY_LABEL,
        [LIVE_REFRESH_ENTITY_STATS_KEY]: BACKFILL_LIVE_REFRESH_LABEL,
        [BALANCES_ENTITY_STATS_KEY]: BACKFILL_BALANCES_LABEL,
    };

/** Resolve a progress-row label from a backend active_step key. */
export function resolveRowLabelForActiveStep(
    activeStep: string
): BackfillProgressRowKey {
    return (
        ACTIVE_STEP_TO_ROW_LABEL[activeStep] ??
        (activeStep as BackfillProgressRowKey)
    );
}

/**
 * When the backend declares active_step, override inferred row phases so the
 * panel matches orchestrator state (Phase 2 — explicit step pointer).
 */
export function applyExplicitActiveStepToRows(
    rows: EntityProgressRow[],
    activeStep: string
): EntityProgressRow[] {
    const targetLabel = resolveRowLabelForActiveStep(activeStep);
    const activeIndex = rows.findIndex(
        (row) => row.entity_type === targetLabel
    );
    if (activeIndex < 0) {
        return rows;
    }

    // Backend can leave active_step on a finished step until the next one
    // starts. Do not force that row back to Running or demote later steps.
    const activePhase = rows[activeIndex]?.phase;
    if (activePhase === "done" || activePhase === "failed") {
        return rows;
    }

    return rows.map((row, index) => {
        if (row.phase === "failed") {
            return row;
        }
        if (index < activeIndex) {
            if (row.phase === "done") {
                return {
                    ...row,
                    progress_percent: 100,
                };
            }
            return {
                ...row,
                phase: "done" as const,
                // Completed steps always show a full bar even when ERP gave no total.
                progress_percent: 100,
                success: row.success ?? row.records_pulled,
            };
        }
        if (index === activeIndex) {
            if (row.phase === "queued") {
                return row;
            }
            // Active step from the backend: show Running even at 0 pulled so
            // long ERP waits (column sample / first page) are not mistaken for
            // a stuck Waiting step.
            return {
                ...row,
                phase: "running",
            };
        }
        if (row.phase === "waiting" || row.phase === "running") {
            return {
                ...row,
                phase: "waiting" as const,
                records_pulled: 0,
                total_records: null,
                progress_percent: null,
                last_error: null,
            };
        }
        return row;
    });
}

/** Build a running-run subtitle from backend active_step when present. */
export function resolveBackfillSubtitleFromActiveStep(
    activeStep: string,
    _mepBreachStartDate?: string | null
): string | null {
    const label = resolveRowLabelForActiveStep(activeStep);
    if (
        label === BACKFILL_DELETING_LABEL ||
        label === BACKFILL_PAYMENT_IMPORT_LABEL ||
        label === BACKFILL_INVOICE_IMPORT_LABEL ||
        label === BACKFILL_LINK_PAYMENTS_LABEL ||
        label === BACKFILL_AR_REPLAY_LABEL ||
        BACKFILL_TAIL_STEPS.some((step) => step.label === label) ||
        BACKFILL_ENTITY_ORDER.includes(label as ImportType)
    ) {
        return "Actions are disabled until this finishes";
    }
    return null;
}

/** Canonical backfill progress panel phases (session machine). */
export type BackfillProgressSessionPhase =
    | "idle"
    | "seeding"
    | "running"
    | "finishing"
    | "deferred_drain"
    | "finished"
    | "cleared";

/**
 * Progress session for the Backfill progress panel.
 * `phase` + optional `executionId` are the source of truth; storage is a hint only (D6).
 * Legacy `{ executionId, dismissed }` payloads are still accepted on read.
 */
export interface BackfillProgressSession {
    phase?: BackfillProgressSessionPhase;
    executionId?: string;
    /** @deprecated Legacy hide flag — maps to `cleared` when true. */
    dismissed?: boolean;
    /** Seeding only (slice 02) — planned step keys. */
    plannedSteps?: string[];
    /** Seeding only — clear-before-import was requested on Start. */
    expectPurge?: boolean;
}

export function createClearedBackfillProgressSession(): BackfillProgressSession {
    return { phase: "cleared" };
}

export function createSeedingBackfillProgressSession(options?: {
    expectPurge?: boolean;
    executionId?: string;
    plannedSteps?: string[];
}): BackfillProgressSession {
    return {
        phase: "seeding",
        executionId: options?.executionId,
        expectPurge: options?.expectPurge === true ? true : undefined,
        plannedSteps: options?.plannedSteps,
    };
}

/**
 * Planned progress-row keys for Start/Resume seeding (D4).
 * Record deletion is included only when clear-before-import was requested.
 */
export function buildPlannedBackfillStepKeys(
    enabledEntities: ImportType[],
    expectPurge = false
): string[] {
    const ordered = orderEnabledBackfillEntities(enabledEntities);
    const keys: string[] = [];
    if (expectPurge) {
        keys.push(PURGE_ENTITY_STATS_KEY);
    }
    for (const entity of ordered) {
        keys.push(entity);
        if (entity === "Invoice" && shouldShowLinkPaymentsRow(ordered)) {
            keys.push(MATURITY_ENTITY_STATS_KEY);
        }
    }
    if (shouldShowArTailSteps(ordered)) {
        for (const step of BACKFILL_TAIL_STEPS) {
            keys.push(step.key);
        }
    }
    return keys;
}

/**
 * Seeding panel rows: Not started / Waiting with zero counts.
 * Never shows a Running spinner (including Record deletion) until a live run
 * reports purge / `active_step` (D4).
 */
export function buildSeedingEntityProgressRows(params: {
    enabledEntities: ImportType[];
    expectPurge?: boolean;
}): EntityProgressRow[] {
    const ordered = orderEnabledBackfillEntities(params.enabledEntities);
    const waitingRow = (
        entity_type: BackfillProgressRowKey
    ): EntityProgressRow => ({
        entity_type,
        phase: "waiting",
        records_pulled: 0,
        total_records: null,
        progress_percent: null,
        last_error: null,
    });

    const entityRows = ordered.map((entity) =>
        waitingRow(progressRowLabelForEntity(entity))
    );
    const withLinkRow = shouldShowLinkPaymentsRow(ordered)
        ? insertLinkPaymentsRow(entityRows, waitingRow(BACKFILL_LINK_PAYMENTS_LABEL))
        : entityRows;
    const withTail = appendTailStepRows({
        rows: withLinkRow,
        stats: undefined,
        runFinished: false,
        enabledEntities: ordered,
    });
    if (params.expectPurge !== true) {
        return withTail;
    }
    return prependDeletingRow(withTail, {
        entity_type: BACKFILL_DELETING_LABEL,
        phase: "not_started",
        records_pulled: 0,
        total_records: null,
        progress_percent: null,
        last_error: null,
        deleted: 0,
        success: 0,
    });
}

/**
 * True for sync runs the import progress panel should track.
 * Includes Backfill and Incremental; excludes Preview.
 */
export function isBackfillSyncRun(
    run: Pick<SyncRunSummary, "sync_mode" | "trigger">
): boolean {
    const mode = String(run.sync_mode ?? "").toUpperCase();
    if (mode === "PREVIEW") {
        return false;
    }
    return (
        mode === "BACKFILL" ||
        mode === "INCREMENTAL" ||
        run.trigger === "backfill"
    );
}

export function findRunningBackfillRun(
    runs: SyncRunSummary[]
): SyncRunSummary | null {
    return runs.find((run) => isBackfillSyncRun(run) && run.status === "RUNNING") ?? null;
}

/** Most recent finished (non-RUNNING) real backfill — used for idle last-run paint. */
export function findLastFinishedBackfillRun(
    runs: SyncRunSummary[]
): SyncRunSummary | null {
    let best: SyncRunSummary | null = null;
    let bestTs = Number.NEGATIVE_INFINITY;
    for (const run of runs) {
        if (!isBackfillSyncRun(run) || isPlaceholderBackfillProgressRun(run)) {
            continue;
        }
        if (run.status === "RUNNING") {
            continue;
        }
        if (
            run.status === "TIMEOUT" &&
            run.error_type === "cancelled" &&
            !run.completed_at
        ) {
            continue;
        }
        const ts = Date.parse(run.completed_at ?? run.started_at ?? "") || 0;
        if (ts >= bestTs) {
            bestTs = ts;
            best = run;
        }
    }
    return best;
}

/**
 * After Start/Resume we seed a RUNNING row into the React Query cache. The next
 * sync-runs refetch can briefly return without that row (empty payload, race,
 * or stale response) and wipe the seed — progress steps vanish until refresh.
 * Keep the previous optimistic RUNNING backfill until the fetch includes it or
 * another live RUNNING backfill.
 */
export function mergeSyncRunsPreservingOptimisticRunning(
    fetched: SyncRunSummary[] | null | undefined,
    previous: SyncRunSummary[] | null | undefined
): SyncRunSummary[] {
    const fetchedRuns = Array.isArray(fetched) ? fetched : [];
    const previousRuns = Array.isArray(previous) ? previous : [];
    if (findRunningBackfillRun(fetchedRuns)) {
        return fetchedRuns;
    }
    const previousRunning = findRunningBackfillRun(previousRuns);
    if (
        !previousRunning ||
        isPlaceholderBackfillProgressRun(previousRunning)
    ) {
        return fetchedRuns;
    }
    const fetchedSameId = fetchedRuns.find(
        (run) => run.id === previousRunning.id
    );
    if (fetchedSameId) {
        // Terminal (or non-running) update for the same execution — trust fetch.
        return fetchedRuns;
    }
    return [
        previousRunning,
        ...fetchedRuns.filter((run) => run.id !== previousRunning.id),
    ];
}

/**
 * Pick the run the progress panel should render, including Start/Resume holds.
 */
export function resolveDisplayBackfillProgressRun(params: {
    syncRuns: SyncRunSummary[];
    progressRun: SyncRunSummary | null;
    heldProgressRun: SyncRunSummary | null;
    pendingBackfillReset: boolean;
    progressUiReset: boolean;
    expectDeletingStep?: boolean;
}): SyncRunSummary | null {
    if (params.progressUiReset) {
        return createResetBackfillProgressRun();
    }
    const liveRunning = findRunningBackfillRun(params.syncRuns);
    if (liveRunning) {
        return liveRunning;
    }
    if (
        params.heldProgressRun &&
        params.heldProgressRun.status === "RUNNING"
    ) {
        return params.heldProgressRun;
    }
    if (params.pendingBackfillReset) {
        return createPendingBackfillRun({
            expectPurge: params.expectDeletingStep === true,
        });
    }
    return params.progressRun;
}

export function findSyncRunById(
    runs: SyncRunSummary[],
    executionId: string
): SyncRunSummary | null {
    return runs.find((run) => run.id === executionId) ?? null;
}

/**
 * Legacy binder kept for existing unit tests. Prefer
 * {@link resolveBackfillProgressSession} for the panel.
 * - Prefer a RUNNING backfill.
 * - Else keep a tracked finished run until dismissed / cleared.
 */
export function resolveBackfillProgressRun(params: {
    runs: SyncRunSummary[];
    session: BackfillProgressSession | null;
}): { run: SyncRunSummary | null; session: BackfillProgressSession | null } {
    const running = findRunningBackfillRun(params.runs);
    if (running && !isPlaceholderBackfillProgressRun(running)) {
        return {
            run: running,
            session: {
                phase: "running",
                executionId: running.id,
                dismissed: false,
            },
        };
    }

    if (
        !params.session?.executionId ||
        params.session.dismissed ||
        params.session.phase === "cleared"
    ) {
        return { run: null, session: params.session };
    }

    const tracked = findSyncRunById(params.runs, params.session.executionId);
    if (!tracked || !isBackfillSyncRun(tracked)) {
        return { run: null, session: params.session };
    }

    if (tracked.status === "RUNNING") {
        return {
            run: tracked,
            session: {
                phase: "running",
                executionId: tracked.id,
                dismissed: false,
            },
        };
    }

    return {
        run: tracked,
        session: {
            ...params.session,
            phase: params.session.phase ?? "finished",
            executionId: tracked.id,
        },
    };
}

export type BackfillProgressSessionIntent = "none" | "clear";

export interface ResolveBackfillProgressSessionParams {
    syncRuns: SyncRunSummary[];
    /** False until the first sync-runs fetch settles — avoids orphan-clear races. */
    syncRunsFetched: boolean;
    /** Persisted / in-memory session hint (execution id + phase). */
    sessionHint: BackfillProgressSession | null;
    /** Reset backfill / Run preview → cleared empty panel (D3). */
    intent?: BackfillProgressSessionIntent;
    /**
     * True while Start/Resume mutation is in flight (session may already be seeding).
     * Prefer session hint `phase: "seeding"` as the durable owner.
     */
    seedingActive?: boolean;
    seedingExpectPurge?: boolean;
    seedingExecutionId?: string | null;
    seedingPlannedSteps?: string[];
    /**
     * Connector config `pending_ar_post_ingest_customers` — finished run +
     * pending above zero → `deferred_drain` (D7).
     */
    pendingArPostIngestCustomers?: number;
}

export interface ResolveBackfillProgressSessionResult {
    session: BackfillProgressSession;
    /** Real sync-run only — never `pending-backfill` / `progress-reset`. */
    boundRun: SyncRunSummary | null;
    /** Cleared / seeding / idle-without-finished → zero sync_state paint (D8). */
    zeroCounts: boolean;
    /**
     * Record deletion planned for seeding only — never from idle delete toggles.
     */
    expectDeletingStep: boolean;
}

/** True when the worker AR post-ingest queue still has customers. */
export function hasPendingArPostIngestCustomers(
    pendingCustomers: number | undefined
): boolean {
    return (pendingCustomers ?? 0) > 0;
}

/**
 * D7 — finished (non-RUNNING) bound run with pending AR customers →
 * `deferred_drain`; queue empty → `finished`.
 */
export function resolveFinishedOrDeferredDrainPhase(
    pendingArPostIngestCustomers: number | undefined
): Extract<BackfillProgressSessionPhase, "deferred_drain" | "finished"> {
    return hasPendingArPostIngestCustomers(pendingArPostIngestCustomers)
        ? "deferred_drain"
        : "finished";
}

/** Progress-row labels that may stay live during deferred AR worker drain. */
export const DEFERRED_AR_DRAIN_PROGRESS_LABELS: ReadonlySet<BackfillProgressRowKey> =
    new Set([BACKFILL_AR_REPLAY_LABEL, BACKFILL_LIVE_REFRESH_LABEL]);

export function isDeferredArDrainProgressLabel(
    label: BackfillProgressRowKey | string
): boolean {
    return DEFERRED_AR_DRAIN_PROGRESS_LABELS.has(
        label as BackfillProgressRowKey
    );
}

/**
 * Single seam for panel phase + bound run (idle / cleared / reload / running).
 * Fake sync-run placeholders are never returned as `boundRun`.
 */
export function resolveBackfillProgressSession(
    params: ResolveBackfillProgressSessionParams
): ResolveBackfillProgressSessionResult {
    const intent = params.intent ?? "none";
    const runs = params.syncRuns;
    const hint = params.sessionHint;
    const pendingAr = params.pendingArPostIngestCustomers;

    if (intent === "clear") {
        return {
            session: createClearedBackfillProgressSession(),
            boundRun: null,
            zeroCounts: true,
            expectDeletingStep: false,
        };
    }

    // D6 — server RUNNING wins; never invent Running from storage alone.
    const running = findRunningBackfillRun(runs);
    if (running && !isPlaceholderBackfillProgressRun(running)) {
        return {
            session: {
                phase: "running",
                executionId: running.id,
                // D5 — expectPurge is seeding-only; never force Running after bind.
            },
            boundRun: running,
            zeroCounts: false,
            expectDeletingStep: false,
        };
    }

    if (hint?.phase === "cleared" || hint?.dismissed === true) {
        return {
            session: createClearedBackfillProgressSession(),
            boundRun: null,
            zeroCounts: true,
            expectDeletingStep: false,
        };
    }

    const seedingExpectPurge =
        params.seedingExpectPurge === true || hint?.expectPurge === true;
    const seedingExecutionId =
        params.seedingExecutionId ??
        (hint?.phase === "seeding" ? hint.executionId : null) ??
        null;
    const seedingPlannedSteps =
        params.seedingPlannedSteps ?? hint?.plannedSteps;
    const seedingActive =
        params.seedingActive === true || hint?.phase === "seeding";

    if (seedingActive) {
        // Terminal sync-run for the seeding execution → leave seeding (Stop/cancel).
        if (seedingExecutionId && params.syncRunsFetched) {
            const tracked = findSyncRunById(runs, seedingExecutionId);
            if (
                tracked &&
                isBackfillSyncRun(tracked) &&
                !isPlaceholderBackfillProgressRun(tracked) &&
                tracked.status !== "RUNNING"
            ) {
                return {
                    session: {
                        phase: resolveFinishedOrDeferredDrainPhase(pendingAr),
                        executionId: tracked.id,
                    },
                    boundRun: tracked,
                    zeroCounts: false,
                    expectDeletingStep: false,
                };
            }
            if (
                !params.seedingActive &&
                (!tracked ||
                    !isBackfillSyncRun(tracked) ||
                    isPlaceholderBackfillProgressRun(tracked))
            ) {
                // Stale seeding hint with missing execution → cleared (orphan).
                return {
                    session: createClearedBackfillProgressSession(),
                    boundRun: null,
                    zeroCounts: true,
                    expectDeletingStep: false,
                };
            }
        }
        return {
            session: createSeedingBackfillProgressSession({
                expectPurge: seedingExpectPurge,
                executionId: seedingExecutionId ?? undefined,
                plannedSteps: seedingPlannedSteps,
            }),
            boundRun: null,
            zeroCounts: true,
            expectDeletingStep: seedingExpectPurge,
        };
    }

    const hintId = hint?.executionId;
    if (hintId && params.syncRunsFetched) {
        const tracked = findSyncRunById(runs, hintId);
        if (
            !tracked ||
            !isBackfillSyncRun(tracked) ||
            isPlaceholderBackfillProgressRun(tracked)
        ) {
            return {
                session: createClearedBackfillProgressSession(),
                boundRun: null,
                zeroCounts: true,
                expectDeletingStep: false,
            };
        }
        if (tracked.status === "RUNNING") {
            return {
                session: { phase: "running", executionId: tracked.id },
                boundRun: tracked,
                zeroCounts: false,
                expectDeletingStep: false,
            };
        }
        return {
            session: {
                phase: resolveFinishedOrDeferredDrainPhase(pendingAr),
                executionId: tracked.id,
            },
            boundRun: tracked,
            zeroCounts: false,
            expectDeletingStep: false,
        };
    }

    // Hint present but sync-runs not fetched yet — wait; do not invent Running.
    if (hintId && !params.syncRunsFetched) {
        return {
            session: {
                phase: hint?.phase ?? "idle",
                executionId: hintId,
                expectPurge: hint?.expectPurge,
            },
            boundRun: null,
            zeroCounts: false,
            expectDeletingStep: false,
        };
    }

    // D2 / D7 — last finished run; pending AR queue elevates to deferred_drain.
    const lastFinished = findLastFinishedBackfillRun(runs);
    if (lastFinished) {
        const phase = hasPendingArPostIngestCustomers(pendingAr)
            ? "deferred_drain"
            : "idle";
        return {
            session: {
                phase,
                executionId: lastFinished.id,
            },
            boundRun: lastFinished,
            zeroCounts: false,
            expectDeletingStep: false,
        };
    }

    return {
        session: { phase: "idle" },
        boundRun: null,
        zeroCounts: true,
        expectDeletingStep: false,
    };
}

export function orderEnabledBackfillEntities(
    enabled: ImportType[]
): ImportType[] {
    const enabledSet = new Set(enabled);
    return BACKFILL_ENTITY_ORDER.filter((entity) => enabledSet.has(entity));
}

function clampPercent(pulled: number, total: number): number {
    if (total <= 0) {
        return 0;
    }
    return Math.min(100, Math.round((pulled / total) * 100));
}

/** Matches Priority `recommendedPageSize` — used to estimate totals while paging. */
export const BACKFILL_ENTITY_PAGE_SIZE_ESTIMATE = 500;

/**
 * When the ERP does not expose a total count, estimate one from the current
 * page so the progress bar can stay determinate (like import batch progress).
 */
export function estimateEntityTotalRecords(params: {
    knownTotal: number | null;
    pulled: number;
    pageComplete?: boolean;
}): number | null {
    if (params.knownTotal != null) {
        return params.knownTotal;
    }
    if (params.pulled <= 0) {
        return null;
    }
    if (params.pageComplete) {
        return params.pulled;
    }
    return Math.max(
        params.pulled + BACKFILL_ENTITY_PAGE_SIZE_ESTIMATE,
        params.pulled + 1
    );
}

/** Weighted 0–100 across all pipeline rows (entities, link, tail steps). */
export function computeOverallBackfillProgressPercent(
    rows: EntityProgressRow[]
): number | null {
    if (rows.length === 0) {
        return null;
    }
    let accumulated = 0;
    for (const row of rows) {
        if (row.phase === "done" || row.phase === "failed") {
            accumulated += 1;
        } else if (row.phase === "running" || row.phase === "queued") {
            accumulated +=
                row.progress_percent != null ? row.progress_percent / 100 : 0;
        }
    }
    return clampPercent(accumulated, rows.length);
}

/** Pull-count samples used to estimate records/sec for remaining-time ETA. */
export type ProgressRateSample = { atMs: number; pulled: number };

/**
 * Append a sample when pulled advances. Same pulled → unchanged list (stalled
 * imports keep the last measured rate instead of looking instant).
 */
export function appendProgressRateSample(
    samples: ProgressRateSample[],
    pulled: number,
    atMs: number,
    maxSamples = 12
): ProgressRateSample[] {
    const last = samples[samples.length - 1];
    if (last && last.pulled === pulled) {
        return samples;
    }
    return [...samples, { atMs, pulled }].slice(-maxSamples);
}

/**
 * Estimate seconds left from recent pull-rate samples when a total is known.
 * Needs ≥2 samples, ≥2s span, and a positive pull gain.
 */
export function estimateRemainingSeconds(params: {
    pulled: number;
    total: number | null;
    samples: ProgressRateSample[];
}): number | null {
    const total = params.total;
    if (total == null || total <= 0) {
        return null;
    }
    const remaining = total - params.pulled;
    if (remaining <= 0) {
        return 0;
    }
    const samples = params.samples;
    if (samples.length < 2) {
        return null;
    }
    const first = samples[0];
    const last = samples[samples.length - 1];
    const elapsedMs = last.atMs - first.atMs;
    const gained = last.pulled - first.pulled;
    if (elapsedMs < 2000 || gained <= 0) {
        return null;
    }
    const perSecond = gained / (elapsedMs / 1000);
    if (!Number.isFinite(perSecond) || perSecond <= 0) {
        return null;
    }
    return Math.max(0, Math.ceil(remaining / perSecond));
}

/** Human-readable ETA, e.g. `~45s left`, `~3m left`, `~1h 5m left`. */
export function formatEstimatedRemaining(
    seconds: number | null
): string | null {
    if (seconds == null) {
        return null;
    }
    if (seconds <= 0) {
        return "~0s left";
    }
    if (seconds < 60) {
        return `~${seconds}s left`;
    }
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes < 60) {
        if (minutes < 10 && secs > 0) {
            return `~${minutes}m ${secs}s left`;
        }
        return `~${minutes}m left`;
    }
    const hours = Math.floor(minutes / 60);
    const remMin = minutes % 60;
    return remMin > 0 ? `~${hours}h ${remMin}m left` : `~${hours}h left`;
}

type EntityStatSlice = NonNullable<
    SyncRunSummary["entity_stats"]
>[string];

function readMaturityStats(
    entityStats: SyncRunSummary["entity_stats"] | undefined
): EntityStatSlice | undefined {
    return entityStats?.[MATURITY_ENTITY_STATS_KEY];
}

function readPurgeStats(
    entityStats: SyncRunSummary["entity_stats"] | undefined
): EntityStatSlice | undefined {
    return entityStats?.[PURGE_ENTITY_STATS_KEY];
}

const PURGE_ENTITY_LABELS: ImportType[] = [
    "Customer",
    "Payment",
    "Invoice",
    "Contact",
];

function sumDeletedCounts(
    entityStats: SyncRunSummary["entity_stats"] | undefined
): number {
    if (!entityStats) {
        return 0;
    }
    let total = 0;
    for (const entity of PURGE_ENTITY_LABELS) {
        total += entityStats[entity]?.deleted ?? 0;
    }
    return total;
}

function formatDeletedCountsDetail(
    entityStats: SyncRunSummary["entity_stats"] | undefined
): string | undefined {
    if (!entityStats) {
        return undefined;
    }
    const parts: string[] = [];
    for (const entity of PURGE_ENTITY_LABELS) {
        const deleted = entityStats[entity]?.deleted;
        if (deleted == null) {
            continue;
        }
        parts.push(
            `${progressRowLabelForEntity(entity)} ${deleted.toLocaleString()}`
        );
    }
    return parts.length > 0 ? parts.join(" · ") : undefined;
}

function shouldShowPurgeProgressRow(
    entityStats: SyncRunSummary["entity_stats"] | undefined,
    expectPurge = false
): boolean {
    if (expectPurge) {
        return true;
    }
    const purge = readPurgeStats(entityStats);
    if (purge?.status === "running" || purge?.status === "done") {
        return true;
    }
    return sumDeletedCounts(entityStats) > 0;
}

function buildDeletingProgressRow(params: {
    entityStats: SyncRunSummary["entity_stats"] | undefined;
    runFinished: boolean;
    /** Clear-before-import was requested; treat as running until purge reports done. */
    expectPurge?: boolean;
    /** Orchestrator active_step — when past `_purge`, do not keep Deleting running. */
    activeStep?: string | null;
}): EntityProgressRow {
    const purge = readPurgeStats(params.entityStats);
    const deletedTotal = Math.max(
        sumDeletedCounts(params.entityStats),
        purge?.success ?? 0,
        purge?.detail?.processed ?? 0
    );
    const total =
        purge?.detail?.total != null && purge.detail.total > 0
            ? purge.detail.total
            : purge?.pulled != null && purge.pulled > 0
              ? purge.pulled
              : null;
    const detail = formatDeletedCountsDetail(params.entityStats);
    const hasPurgeEvidence =
        purge?.status === "running" ||
        purge?.status === "done" ||
        deletedTotal > 0;
    const orchestratorPastPurge =
        params.activeStep != null &&
        params.activeStep !== PURGE_ENTITY_STATS_KEY;
    const orchestratorOnPurge = params.activeStep === PURGE_ENTITY_STATS_KEY;
    // D4 — expectPurge alone never forces Running; wait for live purge /
    // active_step=_purge (or finished → Not started).
    if (
        params.expectPurge === true &&
        !hasPurgeEvidence &&
        !orchestratorPastPurge &&
        !orchestratorOnPurge
    ) {
        return {
            entity_type: BACKFILL_DELETING_LABEL,
            phase: "not_started",
            records_pulled: 0,
            total_records: null,
            progress_percent: null,
            last_error: null,
            deleted: 0,
            success: 0,
        };
    }
    const running =
        !params.runFinished &&
        !orchestratorPastPurge &&
        (purge?.status === "running" || orchestratorOnPurge);
    const percent =
        total != null && total > 0
            ? clampPercent(deletedTotal, total)
            : running
              ? null
              : 100;
    return {
        entity_type: BACKFILL_DELETING_LABEL,
        phase: running ? "running" : "done",
        records_pulled: deletedTotal,
        total_records: total,
        progress_percent: percent,
        last_error: null,
        deleted: deletedTotal,
        success: deletedTotal,
        ...(detail ? { detail } : {}),
    };
}

function prependDeletingRow(
    rows: EntityProgressRow[],
    deletingRow: EntityProgressRow
): EntityProgressRow[] {
    return [deletingRow, ...rows];
}

const LINK_PAYMENTS_DETAIL_LABELS: Record<
    string,
    { label: string; unit: string }
> = {
    prepare: { label: "Finding deferred payments to link", unit: "payments" },
    link: { label: "Linking payments to invoices", unit: "payments" },
    close: { label: "Closing reconciled invoices", unit: "payments" },
    recalc: { label: "Recalculating paid totals", unit: "invoices" },
};

function formatLinkPaymentsDetail(
    detail: EntityStatSlice["detail"]
): string | undefined {
    if (!detail) {
        return undefined;
    }
    const known = LINK_PAYMENTS_DETAIL_LABELS[detail.step];
    const label = known?.label ?? detail.step;
    if (detail.total == null || detail.total <= 0) {
        return label;
    }
    const processed = detail.processed ?? 0;
    return `${label} · ${processed.toLocaleString()} / ${detail.total.toLocaleString()} ${known?.unit ?? "items"}`;
}

function shouldShowLinkPaymentsRow(enabledEntities: ImportType[]): boolean {
    return enabledEntities.includes("Invoice");
}

/** AR tail steps (closes, overdue, post-ingest, balances) need Invoice or Payment. */
function shouldShowArTailSteps(enabledEntities: ImportType[]): boolean {
    return (
        enabledEntities.includes("Invoice") ||
        enabledEntities.includes("Payment")
    );
}

function buildLinkPaymentsRunningRow(params: {
    maturity: EntityStatSlice | undefined;
    invoiceDone: boolean;
    runHasProgress: boolean;
}): EntityProgressRow {
    const maturity = params.maturity;
    const status = maturity?.status;
    const linked = maturity?.success ?? 0;
    const total =
        maturity?.pulled && maturity.pulled > 0
            ? maturity.pulled
            : linked + (maturity?.skipped ?? 0) > 0
              ? linked + (maturity?.skipped ?? 0)
              : null;
    const deferred =
        total != null ? Math.max(0, total - linked) : (maturity?.skipped ?? 0);
    const error =
        maturity?.sample_errors?.[0]?.trim() ||
        (status === "failed" ? "Failed to link payments to invoices" : null);
    const detail = formatLinkPaymentsDetail(maturity?.detail);
    const detailProps = detail ? { detail } : {};

    if (status === "failed") {
        return {
            entity_type: BACKFILL_LINK_PAYMENTS_LABEL,
            phase: "failed",
            records_pulled: linked,
            total_records: total,
            progress_percent:
                total != null ? clampPercent(linked, total) : null,
            last_error: error,
            success: linked,
            failed: maturity?.failed ?? 1,
            skipped: deferred,
        };
    }

    if (status === "done") {
        return {
            entity_type: BACKFILL_LINK_PAYMENTS_LABEL,
            phase: "done",
            records_pulled: linked,
            total_records: total,
            progress_percent: 100,
            last_error: null,
            success: linked,
            failed: 0,
            skipped: deferred,
        };
    }

    if (status === "running") {
        // Prefer live sub-step counts (link / close / recalc) so the bar does
        // not freeze at "payments linked / candidates" during the slow phases.
        const detailCounts = maturity?.detail;
        const useDetailCounts =
            detailCounts != null &&
            detailCounts.total != null &&
            detailCounts.total > 0 &&
            detailCounts.processed != null;
        const barPulled = useDetailCounts
            ? detailCounts.processed!
            : linked;
        const barTotal = useDetailCounts ? detailCounts.total! : total;
        return {
            entity_type: BACKFILL_LINK_PAYMENTS_LABEL,
            phase: "running",
            records_pulled: barPulled,
            total_records: barTotal,
            progress_percent:
                barTotal != null ? clampPercent(barPulled, barTotal) : null,
            last_error: null,
            success: linked,
            failed: 0,
            skipped: deferred,
            ...detailProps,
        };
    }

    // Invoice finished this run; maturity may not have emitted status yet.
    if (params.invoiceDone && params.runHasProgress && status == null) {
        return {
            entity_type: BACKFILL_LINK_PAYMENTS_LABEL,
            phase: "running",
            records_pulled: linked,
            total_records: total,
            progress_percent:
                total != null ? clampPercent(linked, total) : null,
            last_error: null,
            success: linked,
            failed: 0,
            skipped: deferred,
            ...detailProps,
        };
    }

    return {
        entity_type: BACKFILL_LINK_PAYMENTS_LABEL,
        phase: "waiting",
        records_pulled: 0,
        total_records: null,
        progress_percent: null,
        last_error: null,
    };
}

function buildLinkPaymentsFinishedRow(params: {
    maturity: EntityStatSlice | undefined;
    invoiceCompletedInRun: boolean;
}): EntityProgressRow {
    const maturity = params.maturity;

    if (!maturity) {
        // Invoice finished in this run ⇒ linking step already ran (or had
        // nothing to link). Never leave the row as Not started.
        if (params.invoiceCompletedInRun) {
            return {
                entity_type: BACKFILL_LINK_PAYMENTS_LABEL,
                phase: "done",
                records_pulled: 0,
                total_records: null,
                progress_percent: 100,
                last_error: null,
                success: 0,
                failed: 0,
                skipped: 0,
            };
        }
        return {
            entity_type: BACKFILL_LINK_PAYMENTS_LABEL,
            phase: "not_started",
            records_pulled: 0,
            total_records: null,
            progress_percent: null,
            last_error: null,
        };
    }

    const linked = maturity.success ?? 0;
    const total =
        maturity.pulled && maturity.pulled > 0
            ? maturity.pulled
            : linked + (maturity.skipped ?? 0) > 0
              ? linked + (maturity.skipped ?? 0)
              : null;
    const deferred =
        maturity.status === "done"
            ? (maturity.skipped ?? 0)
            : total != null
              ? Math.max(0, total - linked)
              : (maturity.skipped ?? 0);
    const failed = maturity.failed ?? 0;
    const error = maturity.sample_errors?.[0]?.trim() || null;

    if (maturity.status === "failed" || failed > 0) {
        return {
            entity_type: BACKFILL_LINK_PAYMENTS_LABEL,
            phase: "failed",
            records_pulled: linked,
            total_records: total,
            progress_percent: null,
            last_error: error ?? "Failed to link payments to invoices",
            success: linked,
            failed,
            skipped: deferred,
        };
    }

    // status=done, or any counts, or invoice completed in this run
    if (
        maturity.status === "done" ||
        maturity.status === "running" ||
        linked > 0 ||
        deferred > 0 ||
        (maturity.pulled ?? 0) > 0 ||
        params.invoiceCompletedInRun
    ) {
        return {
            entity_type: BACKFILL_LINK_PAYMENTS_LABEL,
            phase: "done",
            records_pulled: linked,
            total_records: total,
            progress_percent: 100,
            last_error: null,
            success: linked,
            failed: 0,
            skipped: deferred,
        };
    }

    return {
        entity_type: BACKFILL_LINK_PAYMENTS_LABEL,
        phase: "not_started",
        records_pulled: 0,
        total_records: null,
        progress_percent: null,
        last_error: null,
    };
}

/**
 * A tail step can spend minutes inside one customer, so the coarse
 * customers-done count barely moves. The sub-step tells the user what is
 * actually happening, with its own counter when the step can report one.
 */
const TAIL_STEP_DETAIL_LABELS: Record<string, { label: string; unit: string }> =
    {
        replay: { label: "Replaying AR history", unit: "events" },
        maturity: { label: "Applying matured payments", unit: "payments" },
        process_overdue: { label: "Recomputing overdue", unit: "customers" },
        insurance_targets: {
            label: "Refreshing insurance dates",
            unit: "invoices",
        },
        live_refresh: {
            label: "Refreshing insurance fields",
            unit: "customers",
        },
        worker_drain: {
            label: "Finishing AR & insurance on worker",
            unit: "customers",
        },
        as_of_rewrite: { label: "Queueing as-of rewrite", unit: "customers" },
    };

/**
 * The replay only walks history from the MEP breach start date onward, so the
 * label names that date — otherwise the event count looks unexplainably small
 * against the customer's full invoice history.
 */
function formatMepBreachStartDate(value: string | null | undefined): string | null {
    if (!value) {
        return null;
    }
    const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
    if (!ymd) {
        return null;
    }
    const date = new Date(
        Number(ymd[1]),
        Number(ymd[2]) - 1,
        Number(ymd[3])
    );
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

/**
 * Section subtitle while AR replay runs — names the MEP breach window so the
 * event counter on the row is not mistaken for full customer history.
 */
export function formatArReplayProgressSubtitle(
    mepBreachStartDate?: string | null
): string {
    const from = formatMepBreachStartDate(mepBreachStartDate);
    if (from) {
        return `Replaying AR history from ${from}`;
    }
    return "Replaying AR history";
}

function formatCustomerScopedTailDetail(
    detail: NonNullable<EntityStatSlice["detail"]>,
    options: {
        /** Inner counter unit when processed/total are work items (e.g. events). */
        innerUnit?: string;
    } = {}
): string | undefined {
    const numberOrId =
        detail.customer_label?.trim() ||
        (detail.customer_id != null ? `#${detail.customer_id}` : null);
    const who = numberOrId ? `Customer ${numberOrId}` : null;
    const customerPos =
        detail.customer_index != null &&
        detail.customer_total != null &&
        detail.customer_total > 0
            ? `${detail.customer_index.toLocaleString()} / ${detail.customer_total.toLocaleString()}`
            : null;

    // Inner work (e.g. events) only when a customer is in flight — otherwise
    // processed/total may be a between-customer position tick (or zeros).
    const hasInFlightCustomer = who != null;
    const hasInner =
        hasInFlightCustomer &&
        options.innerUnit != null &&
        detail.total != null &&
        detail.total > 0;
    const innerCounts = hasInner
        ? `${(detail.processed ?? 0).toLocaleString()} / ${detail.total!.toLocaleString()} ${options.innerUnit}`
        : null;

    if (who && customerPos && innerCounts) {
        return `${who} (${customerPos}) · ${innerCounts}`;
    }
    if (who && customerPos) {
        return `${who} (${customerPos})`;
    }
    if (who && innerCounts) {
        return `${who} · ${innerCounts}`;
    }
    if (customerPos && innerCounts) {
        return `Customer ${customerPos} · ${innerCounts}`;
    }
    if (who) {
        return who;
    }
    if (customerPos) {
        return `Customer ${customerPos}`;
    }
    return innerCounts ?? undefined;
}

function formatTailStepDetail(
    detail: EntityStatSlice["detail"]
): string | undefined {
    if (!detail) {
        return undefined;
    }
    const known = TAIL_STEP_DETAIL_LABELS[detail.step];
    // Skip steps with no detail label — the row title is enough.
    if (!known) {
        return undefined;
    }
    if (detail.step === "replay") {
        const hasInFlightCustomer =
            detail.customer_id != null ||
            Boolean(detail.customer_label?.trim());
        return formatCustomerScopedTailDetail(
            detail,
            hasInFlightCustomer ? { innerUnit: known.unit } : {}
        );
    }
    if (detail.step === "live_refresh" || detail.step === "process_overdue") {
        return formatCustomerScopedTailDetail(detail);
    }
    const label = known.label;
    if (detail.total == null || detail.total <= 0) {
        return label;
    }
    const processed = detail.processed ?? 0;
    return `${label} · ${processed.toLocaleString()} / ${detail.total.toLocaleString()} ${known.unit}`;
}

/**
 * Tail steps report an explicit status, so the row maps straight off it. A
 * missing slice means the step has not started (or had nothing to do).
 */
function buildTailStepRow(params: {
    label: BackfillProgressRowKey;
    slice: EntityStatSlice | undefined;
    runFinished: boolean;
}): EntityProgressRow {
    const slice = params.slice;
    if (!slice?.status) {
        return {
            entity_type: params.label,
            phase: params.runFinished ? "not_started" : "waiting",
            records_pulled: 0,
            total_records: null,
            progress_percent: null,
            last_error: null,
        };
    }

    const processed = slice.success ?? 0;
    const total = slice.pulled && slice.pulled > 0 ? slice.pulled : null;
    const skipped = slice.skipped ?? 0;
    const error = slice.sample_errors?.[0]?.trim() || null;

    if (slice.status === "failed") {
        return {
            entity_type: params.label,
            phase: "failed",
            records_pulled: processed,
            total_records: total,
            progress_percent: null,
            last_error: error ?? `${params.label} failed`,
            success: processed,
            failed: slice.failed ?? 1,
            skipped,
        };
    }

    if (slice.status === "done") {
        return {
            entity_type: params.label,
            phase: "done",
            records_pulled: processed,
            total_records: total,
            progress_percent: 100,
            last_error: null,
            success: processed,
            failed: 0,
            skipped,
        };
    }

    if (slice.status === "queued") {
        const detail = formatTailStepDetail(slice.detail) ?? "Queued";
        return {
            entity_type: params.label,
            phase: "queued",
            records_pulled: processed,
            total_records: total,
            progress_percent: null,
            last_error: null,
            success: processed,
            failed: 0,
            skipped,
            detail,
        };
    }

    const detailText = formatTailStepDetail(slice.detail);
    // Determinate whenever total is known — including 0% at the start.
    const runningPercent =
        total != null ? clampPercent(processed, total) : null;

    return {
        entity_type: params.label,
        phase: "running",
        records_pulled: processed,
        total_records: total,
        progress_percent: runningPercent,
        last_error: null,
        success: processed,
        failed: 0,
        skipped,
        ...(detailText ? { detail: detailText } : {}),
    };
}

function resolveTailStepsForStats(
    _stats: SyncRunSummary["entity_stats"] | undefined
): ReadonlyArray<{ key: string; label: BackfillProgressRowKey }> {
    // Keep the same tail step list during and after the run so the UI does not
    // shrink when purge finishes or the run completes.
    return BACKFILL_TAIL_STEPS;
}

function appendTailStepRows(params: {
    rows: EntityProgressRow[];
    stats: SyncRunSummary["entity_stats"] | undefined;
    runFinished: boolean;
    enabledEntities: ImportType[];
}): EntityProgressRow[] {
    if (!shouldShowArTailSteps(params.enabledEntities)) {
        return params.rows;
    }
    const stats = params.stats ?? {};
    const steps = resolveTailStepsForStats(stats);
    const tailRows = steps.map((step) =>
        buildTailStepRow({
            label: step.label,
            slice: stats[step.key],
            runFinished: params.runFinished,
        })
    );
    return tailRows.length > 0 ? [...params.rows, ...tailRows] : params.rows;
}

function insertLinkPaymentsRow(
    rows: EntityProgressRow[],
    linkRow: EntityProgressRow
): EntityProgressRow[] {
    const invoiceIndex = rows.findIndex(
        (row) => row.entity_type === BACKFILL_INVOICE_IMPORT_LABEL
    );
    if (invoiceIndex < 0) {
        return [...rows, linkRow];
    }
    const next = [...rows];
    next.splice(invoiceIndex + 1, 0, linkRow);
    return next;
}

/**
 * Resolve pulled counts for progress rows.
 *
 * - Completed entities: live runs often ship placeholder zeros for every key —
 *   keep the higher of live vs checkpointed so finishing entity N does not wipe
 *   entity N-1's count.
 * - Incomplete entities while a run is RUNNING: prefer live stats (including 0)
 *   so Start backfill resets counters immediately instead of Math.max-ing stale
 *   sync_state. When live stats are absent, fall back to checkpointed state
 *   only if sync_state was updated after this run started (mid-run reload).
 *   During column sampling at the start of a resumed entity, last_attempt_at
 *   is still from the prior session — show 0 until the first page lands.
 * - Finished runs: fall back to checkpointed state when live stats are missing.
 */
export function resolveEntityPulledCount(
    entityStats: EntityStatSlice | undefined,
    state: ConnectorSyncStatePublic | undefined,
    options?: { running?: boolean; runStartedAt?: string | null }
): number {
    const fromStats = entityStats?.pulled;
    const fromState = state?.backfill_records_pulled ?? 0;

    if (state?.backfill_completed) {
        if (fromStats == null) {
            return fromState;
        }
        return Math.max(fromStats, fromState);
    }

    if (fromStats != null) {
        if (options?.running) {
            // Prefer live entity_stats when meaningful; same-run checkpoints
            // cover mid-import reload while stats are still placeholder zeros (D8).
            if (
                fromStats > 0 ||
                hasMeaningfulEntityStats(entityStats) ||
                !options.runStartedAt
            ) {
                return fromStats;
            }
            if (
                syncStateTouchedInRun(state, options.runStartedAt) &&
                fromState > 0
            ) {
                return fromState;
            }
            return fromStats;
        }
        return Math.max(fromStats, fromState);
    }

    if (options?.running && options.runStartedAt) {
        return syncStateTouchedInRun(state, options.runStartedAt)
            ? fromState
            : 0;
    }

    // Live stats missing (e.g. page reload before the next onProgress patch) —
    // fall back to checkpointed sync_state so the bar can keep moving.
    return fromState;
}

function hasMeaningfulEntityStats(
    entityStats: EntityStatSlice | undefined
): boolean {
    if (!entityStats) {
        return false;
    }
    return (
        (entityStats.pulled ?? 0) > 0 ||
        (entityStats.success ?? 0) > 0 ||
        (entityStats.failed ?? 0) > 0 ||
        (entityStats.skipped ?? 0) > 0 ||
        entityStats.status === "running" ||
        entityStats.status === "done" ||
        entityStats.status === "failed"
    );
}

/**
 * True when maturity or any AR tail step has started — the orchestrator is past
 * (or finished) entity pull/import. Used so Invoice/Payment do not stay Waiting
 * after settle/overdue/AR already report progress (Payment runs before Invoice;
 * active_step is also cleared briefly between done steps).
 */
function pipelineAdvancedPastEntityImports(
    stats: SyncRunSummary["entity_stats"] | undefined,
    explicitStep?: string | null
): boolean {
    if (
        explicitStep != null &&
        explicitStep !== PURGE_ENTITY_STATS_KEY &&
        !(BACKFILL_ENTITY_ORDER as string[]).includes(explicitStep)
    ) {
        return true;
    }
    const maturity = stats?.[MATURITY_ENTITY_STATS_KEY]?.status;
    if (
        maturity === "running" ||
        maturity === "done" ||
        maturity === "failed"
    ) {
        return true;
    }
    return BACKFILL_TAIL_STEPS.some((step) => {
        const status = stats?.[step.key]?.status;
        return (
            status === "running" ||
            status === "done" ||
            status === "failed" ||
            status === "queued"
        );
    });
}

/**
 * When the current run has zeroed placeholder stats for an already-completed
 * entity, fall back to the checkpointed pulled count for the imported summary.
 */
function resolveCompletedSuccessCount(
    entityStats: EntityStatSlice | undefined,
    pulled: number,
    backfillCompleted: boolean
): number | undefined {
    if (hasMeaningfulEntityStats(entityStats)) {
        return entityStats?.success;
    }
    if (backfillCompleted && pulled > 0) {
        return pulled;
    }
    return entityStats?.success;
}

/** True when sync_state was updated at or after this run started (5s skew). */
function syncStateTouchedInRun(
    state: ConnectorSyncStatePublic | undefined,
    runStartedAt: string | null | undefined
): boolean {
    if (!state?.last_attempt_at || !runStartedAt) {
        return false;
    }
    return (
        new Date(state.last_attempt_at).getTime() >=
        new Date(runStartedAt).getTime() - 5000
    );
}

/** Entity finished fetching in the current run (not a stale prior-run flag). */
function entityCompletedInCurrentRun(
    state: ConnectorSyncStatePublic | undefined,
    runStartedAt: string | null | undefined
): boolean {
    return (
        Boolean(state?.backfill_completed) &&
        !state?.backfill_cursor_present &&
        syncStateTouchedInRun(state, runStartedAt)
    );
}

/**
 * Build per-entity rows while a backfill execution is RUNNING.
 * Phases come from backend `active_step` + per-step `status` (D5) — not from
 * client frontier heuristics. Counts prefer bound-run `entity_stats`; sync_state
 * checkpoints only when touched in this run (D8).
 */
export function buildRunningEntityProgressRows(params: {
    enabledEntities: ImportType[];
    syncStates: ConnectorSyncStatePublic[] | undefined;
    entityStats?: SyncRunSummary["entity_stats"];
    /** Backend-declared orchestrator step — preferred over heuristics when set. */
    activeStep?: string | null;
    /** When set, distinguishes stale sync_state from checkpoints written this run. */
    runStartedAt?: string | null;
    /** Correlates browser console logs with backend execution id. */
    runId?: string | null;
    /**
     * Seeding-only: plan Record deletion before the first purge patch.
     * After bind, callers must pass false (D5).
     */
    expectPurge?: boolean;
}): EntityProgressRow[] {
    const ordered = orderEnabledBackfillEntities(params.enabledEntities);
    const byType = new Map(
        (params.syncStates ?? []).map((state) => [state.entity_type, state])
    );
    const stats = params.entityStats ?? {};
    const maturity = readMaturityStats(stats);
    const purge = readPurgeStats(stats);
    const expectPurge = params.expectPurge === true;
    const explicitStep = params.activeStep ?? null;
    const runStartedAt = params.runStartedAt;
    const showLinkRow = shouldShowLinkPaymentsRow(params.enabledEntities);

    const purgeFinished =
        purge?.status === "done" ||
        (explicitStep != null && explicitStep !== PURGE_ENTITY_STATS_KEY);
    const purgeRunning =
        !purgeFinished &&
        (purge?.status === "running" ||
            explicitStep === PURGE_ENTITY_STATS_KEY);

    const activeEntityIndex =
        explicitStep != null &&
        (BACKFILL_ENTITY_ORDER as string[]).includes(explicitStep)
            ? ordered.indexOf(explicitStep as ImportType)
            : -1;
    const activeStepPastEntities =
        explicitStep != null &&
        explicitStep !== PURGE_ENTITY_STATS_KEY &&
        activeEntityIndex < 0;

    const runHasEntityStats = ordered.some((entity) =>
        hasMeaningfulEntityStats(stats[entity])
    );

    const waitingRow = (entity: ImportType): EntityProgressRow => ({
        entity_type: progressRowLabelForEntity(entity),
        phase: "waiting",
        records_pulled: 0,
        total_records: null,
        progress_percent: null,
        last_error: null,
    });

    const doneRow = (
        entity: ImportType,
        entityStats: EntityStatSlice | undefined,
        state: ConnectorSyncStatePublic | undefined
    ): EntityProgressRow => {
        const pulled = resolveEntityPulledCount(entityStats, state, {
            running: true,
            runStartedAt,
        });
        const total = estimateEntityTotalRecords({
            knownTotal: syncStateTouchedInRun(state, runStartedAt)
                ? (state?.backfill_total_records ?? null)
                : null,
            pulled,
            pageComplete: true,
        });
        const success = resolveCompletedSuccessCount(
            entityStats,
            pulled,
            true
        );
        return {
            entity_type: progressRowLabelForEntity(entity),
            phase: "done",
            records_pulled: pulled,
            total_records: total,
            progress_percent:
                entity === "Invoice" || entity === "Payment"
                    ? pulled > 0
                        ? clampPercent(success ?? 0, pulled)
                        : 100
                    : 100,
            last_error: null,
            success,
            failed: hasMeaningfulEntityStats(entityStats)
                ? entityStats?.failed
                : 0,
            skipped: hasMeaningfulEntityStats(entityStats)
                ? entityStats?.skipped
                : 0,
        };
    };

    const runningRow = (
        entity: ImportType,
        entityStats: EntityStatSlice | undefined,
        state: ConnectorSyncStatePublic | undefined
    ): EntityProgressRow => {
        const pulled = resolveEntityPulledCount(entityStats, state, {
            running: true,
            runStartedAt,
        });
        const pageComplete = Boolean(
            state?.backfill_completed &&
                !state?.backfill_cursor_present &&
                syncStateTouchedInRun(state, runStartedAt)
        );
        const staleCheckpointTotal =
            pulled <= 0 && !syncStateTouchedInRun(state, runStartedAt);
        const total = estimateEntityTotalRecords({
            knownTotal: staleCheckpointTotal
                ? null
                : syncStateTouchedInRun(state, runStartedAt)
                  ? (state?.backfill_total_records ?? null)
                  : null,
            pulled,
            pageComplete,
        });
        const liveIndicatesFailure =
            (entityStats?.failed ?? 0) > 0 ||
            entityStats?.status === "failed" ||
            Boolean(entityStats?.sample_errors?.[0]?.trim());
        const error = liveIndicatesFailure
            ? entityStats?.sample_errors?.[0]?.trim() ||
              (syncStateTouchedInRun(state, runStartedAt)
                  ? state?.last_error?.trim() || null
                  : null)
            : null;
        return {
            entity_type: progressRowLabelForEntity(entity),
            phase: error ? "failed" : "running",
            records_pulled: pulled,
            total_records: total,
            progress_percent:
                entity === "Invoice" || entity === "Payment"
                    ? pulled > 0
                        ? clampPercent(entityStats?.success ?? 0, pulled)
                        : null
                    : total != null
                      ? clampPercent(pulled, total)
                      : null,
            last_error: error,
            success: entityStats?.success,
            failed: entityStats?.failed,
            skipped: entityStats?.skipped,
        };
    };

    const entityRows = ordered.map((entity, index) => {
        const state = byType.get(entity);
        const entityStats = stats[entity];
        const status = entityStats?.status;

        if (purgeRunning) {
            return waitingRow(entity);
        }

        if (status === "failed") {
            return runningRow(entity, entityStats, state);
        }

        if (status === "done") {
            return doneRow(entity, entityStats, state);
        }

        if (status === "running" || explicitStep === entity) {
            return runningRow(entity, entityStats, state);
        }

        // Backend advanced past this entity (active_step later in pipeline).
        if (
            explicitStep != null &&
            (activeStepPastEntities ||
                (activeEntityIndex >= 0 && index < activeEntityIndex))
        ) {
            return doneRow(entity, entityStats, state);
        }

        if (explicitStep != null) {
            return waitingRow(entity);
        }

        // Brief gap with no active_step yet: do not invent a Running frontier.
        if (entityCompletedInCurrentRun(state, runStartedAt)) {
            return doneRow(entity, entityStats, state);
        }

        // Tail/maturity already moved — do not leave earlier entities Waiting
        // while settle/overdue/AR show Done (common when active_step is cleared
        // between steps, or Payment-first tail ran with empty Invoice stats).
        if (pipelineAdvancedPastEntityImports(stats, explicitStep)) {
            return doneRow(entity, entityStats, state);
        }

        return waitingRow(entity);
    });

    const invoiceIndex = ordered.indexOf("Invoice");
    const invoiceStatus = stats.Invoice?.status;
    const invoiceDone =
        invoiceStatus === "done" ||
        maturity?.status === "running" ||
        maturity?.status === "done" ||
        maturity?.status === "failed" ||
        explicitStep === MATURITY_ENTITY_STATS_KEY ||
        pipelineAdvancedPastEntityImports(stats, explicitStep) ||
        (explicitStep != null &&
            activeStepPastEntities &&
            invoiceIndex >= 0) ||
        (activeEntityIndex >= 0 &&
            invoiceIndex >= 0 &&
            activeEntityIndex > invoiceIndex);

    const withLinkRow = showLinkRow
        ? insertLinkPaymentsRow(
              entityRows,
              buildLinkPaymentsRunningRow({
                  maturity,
                  invoiceDone,
                  runHasProgress: runHasEntityStats || Boolean(explicitStep),
              })
          )
        : entityRows;

    const rows = appendTailStepRows({
        rows: shouldShowPurgeProgressRow(stats, expectPurge)
            ? prependDeletingRow(
                  withLinkRow,
                  buildDeletingProgressRow({
                      entityStats: stats,
                      runFinished: false,
                      expectPurge,
                      activeStep: params.activeStep,
                  })
              )
            : withLinkRow,
        stats,
        runFinished: false,
        enabledEntities: ordered,
    });

    return explicitStep
        ? applyExplicitActiveStepToRows(rows, explicitStep)
        : rows;
}

/**
 * While deferred AR post-ingest drains on the worker, connector config exposes
 * how many customers are still on ArPostIngestRetryQueue — use it when sync-run
 * entity_stats have not caught up yet.
 *
 * Only rewrite AR drain rows (replay / live refresh). Inline running progress
 * is preserved unless `forceDeferredDrain` (session phase `deferred_drain`)
 * which may promote waiting / not_started / queued rows to live drain.
 * Non-AR rows are forced off live phases in that mode (D7).
 */
export function enrichPostIngestDrainProgressRow(
    rows: EntityProgressRow[],
    pendingCustomers: number | undefined,
    options?: { forceDeferredDrain?: boolean }
): EntityProgressRow[] {
    const forceDeferredDrain = options?.forceDeferredDrain === true;
    const pending = pendingCustomers ?? 0;
    let next = rows;

    if (forceDeferredDrain) {
        // Earlier pipeline steps stay Done / Not started from the finished run.
        next = next.map((row) => {
            if (isDeferredArDrainProgressLabel(row.entity_type)) {
                return row;
            }
            if (row.phase !== "running" && row.phase !== "queued") {
                return row;
            }
            const settled =
                row.records_pulled > 0 ||
                (row.success ?? 0) > 0 ||
                row.progress_percent != null;
            return {
                ...row,
                phase: settled ? ("done" as const) : ("not_started" as const),
                progress_percent: settled ? 100 : null,
                detail: undefined,
            };
        });
    }

    if (pendingCustomers == null && !forceDeferredDrain) {
        return next;
    }

    const drainLabels = [
        BACKFILL_AR_REPLAY_LABEL,
        BACKFILL_LIVE_REFRESH_LABEL,
    ] as const;
    for (const label of drainLabels) {
        const index = next.findIndex((row) => row.entity_type === label);
        if (index < 0) {
            continue;
        }
        const row = next[index];
        const canRewriteQueued = row.phase === "queued";
        const canPromoteForDeferred =
            forceDeferredDrain &&
            (row.phase === "queued" ||
                row.phase === "waiting" ||
                row.phase === "not_started" ||
                row.phase === "running");
        if (!canRewriteQueued && !canPromoteForDeferred) {
            continue;
        }
        // Queued = deferred to worker. Do not clobber inline running progress
        // unless the session is explicitly in deferred_drain.
        if (row.phase === "running" && !forceDeferredDrain) {
            continue;
        }
        const total =
            row.total_records != null && row.total_records > 0
                ? row.total_records
                : pending > 0
                  ? Math.max(pending, row.records_pulled || 0)
                  : row.records_pulled > 0
                    ? row.records_pulled
                    : null;
        if (pending <= 0) {
            const doneTotal = total ?? row.records_pulled;
            const updated = [...next];
            updated[index] = {
                ...row,
                phase: "done",
                records_pulled: doneTotal,
                total_records: doneTotal > 0 ? doneTotal : row.total_records,
                progress_percent: 100,
                success: doneTotal,
                detail: undefined,
            };
            next = updated;
            continue;
        }
        if (total == null || total <= 0) {
            const detail = formatTailStepDetail({
                step: "worker_drain",
                processed: 0,
                total: pending,
            });
            const updated = [...next];
            updated[index] = {
                ...row,
                phase: "running",
                records_pulled: 0,
                total_records: pending,
                progress_percent: null,
                success: 0,
                ...(detail ? { detail } : {}),
            };
            next = updated;
            continue;
        }
        const processed = Math.max(0, total - pending);
        const detail = formatTailStepDetail({
            step: "worker_drain",
            processed,
            total,
        });
        const updated = [...next];
        updated[index] = {
            ...row,
            phase: "running",
            records_pulled: processed,
            total_records: total,
            progress_percent:
                processed > 0 ? clampPercent(processed, total) : null,
            success: processed,
            ...(detail ? { detail } : {}),
        };
        next = updated;
    }
    return next;
}

/**
 * Build rows after the run finished — prefer meaningful entity_stats; fall
 * back to sync state. Zeroed placeholder stats do not mark an entity done.
 */
export function buildFinishedEntityProgressRows(params: {
    enabledEntities: ImportType[];
    syncStates: ConnectorSyncStatePublic[] | undefined;
    run: SyncRunSummary;
    /**
     * Delete-before-import switches are on (or last Start requested purge) —
     * include Deleting… even when this finished run has no purge stats yet.
     */
    expectPurge?: boolean;
}): EntityProgressRow[] {
    const ordered = orderEnabledBackfillEntities(params.enabledEntities);
    const byType = new Map(
        (params.syncStates ?? []).map((state) => [state.entity_type, state])
    );
    const stats = params.run.entity_stats ?? {};
    const pipelinePast = pipelineAdvancedPastEntityImports(stats);
    const runOk =
        params.run.status === "SUCCESS" ||
        (params.run.status !== "FAILED" &&
            params.run.status !== "TIMEOUT" &&
            pipelinePast);

    const entityRows = ordered.map((entity) => {
        const state = byType.get(entity);
        const entityStats = stats[entity];
        const meaningful = hasMeaningfulEntityStats(entityStats);
        const pulled = resolveEntityPulledCount(entityStats, state);
        const total = state?.backfill_total_records ?? null;
        const failedCount = meaningful ? (entityStats?.failed ?? 0) : 0;
        const success = resolveCompletedSuccessCount(
            entityStats,
            pulled,
            Boolean(state?.backfill_completed) || (runOk && pipelinePast)
        );
        const skipped = meaningful ? entityStats?.skipped : undefined;
        const sampleError = entityStats?.sample_errors?.[0]?.trim() || null;
        const stateError = state?.last_error?.trim() || null;

        if (!meaningful && !state?.backfill_completed && pulled === 0) {
            // Successful / advanced pipeline: empty entity is Done, not Waiting.
            if (runOk && pipelinePast) {
                return {
                    entity_type: progressRowLabelForEntity(entity),
                    phase: "done" as const,
                    records_pulled: 0,
                    total_records: total,
                    progress_percent: 100,
                    last_error: null,
                    success: 0,
                    failed: 0,
                    skipped: 0,
                };
            }
            return {
                entity_type: progressRowLabelForEntity(entity),
                phase: "not_started" as const,
                records_pulled: 0,
                total_records: total,
                progress_percent: null,
                last_error: null,
            };
        }

        const resolvedPhase: EntityProgressPhase =
            failedCount > 0
                ? "failed"
                : meaningful ||
                    state?.backfill_completed ||
                    pulled > 0 ||
                    (runOk && pipelinePast)
                  ? "done"
                  : "not_started";

        return {
            entity_type: progressRowLabelForEntity(entity),
            phase: resolvedPhase,
            records_pulled: pulled,
            total_records: total,
            progress_percent:
                entity === "Invoice" || entity === "Payment"
                    ? pulled > 0
                        ? clampPercent(success ?? 0, pulled)
                        : resolvedPhase === "done"
                          ? 100
                          : null
                    : resolvedPhase === "done"
                      ? 100
                      : total != null
                        ? clampPercent(pulled, total)
                        : null,
            last_error: sampleError ?? stateError,
            success,
            failed: failedCount,
            skipped,
            ...(entityStats?.deleted != null
                ? { deleted: entityStats.deleted }
                : {}),
        };
    });

    const invoiceRow = entityRows.find(
        (row) => row.entity_type === BACKFILL_INVOICE_IMPORT_LABEL
    );
    const invoiceCompletedInRun =
        invoiceRow?.phase === "done" ||
        Boolean(byType.get("Invoice")?.backfill_completed) ||
        pipelinePast;

    const withLinkRow = shouldShowLinkPaymentsRow(params.enabledEntities)
        ? insertLinkPaymentsRow(
              entityRows,
              buildLinkPaymentsFinishedRow({
                  maturity: readMaturityStats(stats),
                  invoiceCompletedInRun,
              })
          )
        : entityRows;

    const expectPurge = params.expectPurge === true;
    return appendTailStepRows({
        rows: shouldShowPurgeProgressRow(stats, expectPurge)
            ? prependDeletingRow(
                  withLinkRow,
                  buildDeletingProgressRow({
                      entityStats: stats,
                      runFinished: true,
                      expectPurge,
                  })
              )
            : withLinkRow,
        stats,
        runFinished: true,
        enabledEntities: ordered,
    });
}

export function buildBackfillProgressHeader(params: {
    run: SyncRunSummary;
    rows: EntityProgressRow[];
}): { title: string; subtitle: string; severity: "info" | "success" | "warning" | "error" } {
    if (isPlaceholderBackfillProgressRun(params.run)) {
        return {
            title: "Backfill progress",
            subtitle:
                "Run preview, start or resume backfill, or run incremental sync.",
            severity: "info",
        };
    }

    const isRunning = params.run.status === "RUNNING";
    const activeRow = params.rows.find(
        (row) => row.phase === "running" || row.phase === "queued"
    );
    const failedRows = params.rows.filter((row) => row.phase === "failed");
    const doneCount = params.rows.filter(
        (row) => row.phase === "done"
    ).length;

    if (isRunning) {
        if (params.run.active_step) {
            const stepLabel = resolveRowLabelForActiveStep(
                params.run.active_step
            );
            const stepRow = params.rows.find(
                (row) => row.entity_type === stepLabel
            );
            // Ignore stale active_step after that step already finished.
            const stepStillActive =
                stepRow == null ||
                (stepRow.phase !== "done" && stepRow.phase !== "failed");
            if (stepStillActive) {
                const fromStep = resolveBackfillSubtitleFromActiveStep(
                    params.run.active_step,
                    params.run.cutover_options?.mep_breach_start_date
                );
                if (fromStep) {
                    return {
                        title: "Backfill progress",
                        subtitle: fromStep,
                        severity: "info",
                    };
                }
            }
        }
        return {
            title: "Backfill progress",
            subtitle: "Actions are disabled until this finishes",
            severity: "info",
        };
    }

    if (
        params.run.status === "TIMEOUT" &&
        params.run.error_type === "cancelled" &&
        !params.run.completed_at
    ) {
        return {
            title: "Backfill progress",
            subtitle:
                "Stopping… · Start / resume will enable when this run ends",
            severity: "warning",
        };
    }

    if (activeRow) {
        return {
            title: "Backfill progress",
            subtitle: "Actions are disabled until this finishes",
            severity: "info",
        };
    }

    if (
        params.run.status === "FAILED" ||
        params.run.status === "TIMEOUT" ||
        failedRows.length > 0
    ) {
        if (params.run.error_type === "cancelled") {
            return {
                title: "Backfill progress",
                subtitle: "Stopped by operator",
                severity: "warning",
            };
        }
        const failedNames = failedRows.map((row) => row.entity_type).join(", ");
        return {
            title: "Backfill progress",
            subtitle: failedNames
                ? `Finished with errors · ${failedNames}`
                : params.run.error_message?.trim() ||
                  "Backfill finished with errors",
            severity: "error",
        };
    }

    if (params.run.status === "PARTIAL") {
        return {
            title: "Backfill progress",
            subtitle: `Partial complete · ${doneCount} of ${params.rows.length} entities`,
            severity: "warning",
        };
    }

    return {
        title: "Backfill progress",
        subtitle: `Complete · ${doneCount} of ${params.rows.length} entities`,
        severity: "success",
    };
}

export function backfillProgressSessionStorageKey(accountId: number): string {
    return `billing-backfill-progress:${accountId}`;
}

export function readBackfillProgressSession(
    accountId: number
): BackfillProgressSession | null {
    if (typeof window === "undefined") {
        return null;
    }
    try {
        const raw = window.sessionStorage.getItem(
            backfillProgressSessionStorageKey(accountId)
        );
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw) as Partial<BackfillProgressSession>;
        if (!parsed || typeof parsed !== "object") {
            return null;
        }

        const phases: BackfillProgressSessionPhase[] = [
            "idle",
            "seeding",
            "running",
            "finishing",
            "deferred_drain",
            "finished",
            "cleared",
        ];
        const phase =
            typeof parsed.phase === "string" &&
            phases.includes(parsed.phase as BackfillProgressSessionPhase)
                ? (parsed.phase as BackfillProgressSessionPhase)
                : undefined;
        const executionId =
            typeof parsed.executionId === "string"
                ? parsed.executionId
                : undefined;
        const dismissed =
            typeof parsed.dismissed === "boolean"
                ? parsed.dismissed
                : undefined;

        // Legacy shape: { executionId, dismissed } without phase.
        if (!phase && executionId && dismissed === true) {
            return createClearedBackfillProgressSession();
        }
        if (!phase && executionId && dismissed === false) {
            return { executionId, dismissed: false };
        }
        if (!phase && !executionId && dismissed === true) {
            return createClearedBackfillProgressSession();
        }
        if (!phase && !executionId) {
            return null;
        }

        return {
            phase,
            executionId,
            dismissed,
            expectPurge: parsed.expectPurge === true ? true : undefined,
            plannedSteps: Array.isArray(parsed.plannedSteps)
                ? parsed.plannedSteps.filter(
                      (step): step is string => typeof step === "string"
                  )
                : undefined,
        };
    } catch {
        return null;
    }
}

export function writeBackfillProgressSession(
    accountId: number,
    session: BackfillProgressSession | null
): void {
    if (typeof window === "undefined") {
        return;
    }
    const key = backfillProgressSessionStorageKey(accountId);
    if (!session) {
        window.sessionStorage.removeItem(key);
        return;
    }
    // Persist cleared so Reload after Reset/Preview stays empty (D3), not last finished.
    if (session.phase === "cleared") {
        window.sessionStorage.setItem(
            key,
            JSON.stringify(createClearedBackfillProgressSession())
        );
        return;
    }
    const payload: BackfillProgressSession = {
        phase: session.phase,
        executionId: session.executionId,
        expectPurge: session.expectPurge,
        plannedSteps: session.plannedSteps,
    };
    window.sessionStorage.setItem(key, JSON.stringify(payload));
}

/** Zero pulled/total/error fields so Start backfill can clear the panel immediately. */
export function zeroBackfillProgressSyncStates(
    syncStates: ConnectorSyncStatePublic[] | undefined
): ConnectorSyncStatePublic[] | undefined {
    if (!syncStates) {
        return syncStates;
    }
    return syncStates.map((state) => ({
        ...state,
        backfill_completed: false,
        backfill_completed_at: null,
        backfill_records_pulled: 0,
        backfill_total_records: null,
        last_error: null,
    }));
}

/**
 * Legacy placeholder id — panel seeding no longer requires this SyncRunSummary.
 * Kept for tests / isPlaceholder detection; does not invent purge Running.
 */
export function createPendingBackfillRun(_options?: {
    expectPurge?: boolean;
}): SyncRunSummary {
    return {
        id: "pending-backfill",
        trigger: "backfill",
        sync_mode: "BACKFILL",
        status: "RUNNING",
        started_at: new Date().toISOString(),
        completed_at: null,
        duration_seconds: null,
        active_step: null,
        entity_stats: {
            Customer: { pulled: 0, success: 0, failed: 0, skipped: 0 },
            Payment: { pulled: 0, success: 0, failed: 0, skipped: 0 },
            Invoice: { pulled: 0, success: 0, failed: 0, skipped: 0 },
            Contact: { pulled: 0, success: 0, failed: 0, skipped: 0 },
        },
        error_message: null,
        error_type: null,
    };
}

/** Optimistic real-id RUNNING skeleton after Start returns (no fake purge). */
export function createOptimisticBackfillRun(params: {
    executionId: string;
    sync_mode?: string;
    trigger?: string;
}): SyncRunSummary {
    return {
        id: params.executionId,
        trigger: params.trigger ?? "backfill",
        sync_mode: params.sync_mode ?? "BACKFILL",
        status: "RUNNING",
        started_at: new Date().toISOString(),
        completed_at: null,
        duration_seconds: null,
        active_step: null,
        entity_stats: {
            Customer: { pulled: 0, success: 0, failed: 0, skipped: 0 },
            Payment: { pulled: 0, success: 0, failed: 0, skipped: 0 },
            Invoice: { pulled: 0, success: 0, failed: 0, skipped: 0 },
            Contact: { pulled: 0, success: 0, failed: 0, skipped: 0 },
        },
        error_message: null,
        error_type: null,
    };
}

/** Cleared progress panel after Run Preview (or similar) until the next real import. */
export const BACKFILL_PROGRESS_RESET_RUN_ID = "progress-reset";

export function createResetBackfillProgressRun(): SyncRunSummary {
    const now = new Date().toISOString();
    return {
        id: BACKFILL_PROGRESS_RESET_RUN_ID,
        trigger: "backfill",
        sync_mode: "BACKFILL",
        status: "SUCCESS",
        started_at: now,
        completed_at: now,
        duration_seconds: 0,
        entity_stats: {
            Customer: { pulled: 0, success: 0, failed: 0, skipped: 0 },
            Payment: { pulled: 0, success: 0, failed: 0, skipped: 0 },
            Invoice: { pulled: 0, success: 0, failed: 0, skipped: 0 },
            Contact: { pulled: 0, success: 0, failed: 0, skipped: 0 },
        },
        error_message: null,
        error_type: null,
    };
}

export function isPlaceholderBackfillProgressRun(
    run: Pick<SyncRunSummary, "id"> | null | undefined
): boolean {
    return (
        run?.id === "pending-backfill" ||
        run?.id === BACKFILL_PROGRESS_RESET_RUN_ID
    );
}

type FirstBackfillPreviewParams = {
    enabledEntities: ImportType[];
    previewPasses?: Partial<
        Record<ImportType, { passed: boolean; completed_at: string }>
    >;
    backfillOptionsLocked?: boolean;
    syncMode?: string;
};

/**
 * Enabled entities that still need a passing preview. Empty when backfill is
 * already locked or incremental mode is active.
 */
export function entitiesMissingPreview(
    params: FirstBackfillPreviewParams
): ImportType[] {
    if (params.backfillOptionsLocked || params.syncMode === "INCREMENTAL") {
        return [];
    }
    return params.enabledEntities.filter(
        (entity) => params.previewPasses?.[entity]?.passed !== true
    );
}

/**
 * First backfill requires a passing preview for every enabled entity unless
 * backfill is already locked or incremental mode is active.
 */
export function canStartFirstBackfill(
    params: FirstBackfillPreviewParams
): boolean {
    if (params.backfillOptionsLocked || params.syncMode === "INCREMENTAL") {
        return true;
    }
    if (params.enabledEntities.length === 0) {
        return false;
    }
    return entitiesMissingPreview(params).length === 0;
}

/**
 * Build per-entity preview_passes from a preview sync response (same rules as
 * the billing-connector computeEntityPreviewPassed helper).
 */
export function previewPassesFromSyncResult(
    result: Pick<PreviewSyncResponse, "entities" | "completed_at">,
    existing?: BillingConnectorConfig["preview_passes"]
): NonNullable<BillingConnectorConfig["preview_passes"]> {
    const next: NonNullable<BillingConnectorConfig["preview_passes"]> = {
        ...(existing ?? {}),
    };
    const completed_at = result.completed_at;
    for (const entity of result.entities) {
        const passed =
            entity.validation_errors.length === 0 &&
            entity.sample_rows.length > 0 &&
            (entity.import_type !== "Invoice" || entity.sorted_preview);
        next[entity.import_type] = { passed, completed_at };
    }
    return next;
}
