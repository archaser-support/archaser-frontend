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
export const BACKFILL_DELETING_LABEL = "Deleting…";

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
    | ImportType
    | typeof BACKFILL_LINK_PAYMENTS_LABEL
    | typeof BACKFILL_DELETING_LABEL
    | BackfillTailStepLabel;

const BACKFILL_PROGRESS_STEP_TOOLTIPS: Record<BackfillProgressRowKey, string> =
    {
        Customer:
            "Pulls customer master records from the ERP and creates or updates them in Archaser.",
        Payment:
            "Pulls payment and receipt lines from the ERP. Counter is imported / pulled (DB writes vs ERP rows).",
        Invoice:
            "Pulls invoice lines from the ERP. Counter is imported / pulled (DB writes vs ERP rows).",
        Contact:
            "Pulls customer contact people from the ERP and links them to customers.",
        Policy:
            "Imports credit insurance policy records when enabled for this connector.",
        // String keys (not computed consts) so Fast Refresh cannot leave a
        // dangling BACKFILL_* identifier after an export is removed.
        "Deleting…":
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
        Payment: "Payment",
        Invoice: "Invoice",
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
            // Keep waiting until entity_stats for this step arrive. Promoting an
            // empty waiting row to running shows "0 processed" + indeterminate bar.
            if (
                (row.phase === "waiting" || row.phase === "not_started") &&
                row.total_records == null &&
                row.records_pulled <= 0
            ) {
                return row;
            }
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
        label === BACKFILL_LINK_PAYMENTS_LABEL ||
        label === BACKFILL_AR_REPLAY_LABEL ||
        BACKFILL_TAIL_STEPS.some((step) => step.label === label) ||
        BACKFILL_ENTITY_ORDER.includes(label as ImportType)
    ) {
        return "Actions are disabled until this finishes";
    }
    return null;
}

export interface BackfillProgressSession {
    executionId: string;
    dismissed: boolean;
}

export function isBackfillSyncRun(
    run: Pick<SyncRunSummary, "sync_mode" | "trigger">
): boolean {
    return (
        run.sync_mode === "BACKFILL" ||
        run.trigger === "backfill"
    );
}

export function findRunningBackfillRun(
    runs: SyncRunSummary[]
): SyncRunSummary | null {
    return runs.find((run) => isBackfillSyncRun(run) && run.status === "RUNNING") ?? null;
}

export function findSyncRunById(
    runs: SyncRunSummary[],
    executionId: string
): SyncRunSummary | null {
    return runs.find((run) => run.id === executionId) ?? null;
}

/**
 * Resolve which run the progress panel should bind to.
 * - Prefer a RUNNING backfill.
 * - Else keep a tracked finished run until dismissed.
 * - Do not auto-attach to an old finished backfill with no session.
 */
export function resolveBackfillProgressRun(params: {
    runs: SyncRunSummary[];
    session: BackfillProgressSession | null;
}): { run: SyncRunSummary | null; session: BackfillProgressSession | null } {
    const running = findRunningBackfillRun(params.runs);
    if (running) {
        return {
            run: running,
            session: { executionId: running.id, dismissed: false },
        };
    }

    if (!params.session?.executionId || params.session.dismissed) {
        return { run: null, session: params.session };
    }

    const tracked = findSyncRunById(params.runs, params.session.executionId);
    if (!tracked || !isBackfillSyncRun(tracked)) {
        return { run: null, session: params.session };
    }

    if (tracked.status === "RUNNING") {
        return {
            run: tracked,
            session: { executionId: tracked.id, dismissed: false },
        };
    }

    return { run: tracked, session: params.session };
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
        parts.push(`${entity} ${deleted.toLocaleString()}`);
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
    const running =
        !params.runFinished &&
        (purge?.status === "running" ||
            (params.expectPurge === true && purge?.status !== "done"));
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
        // live_refresh: omit — row label is enough; avoid "Refreshing insurance fields · N / M"
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

function formatTailStepDetail(
    detail: EntityStatSlice["detail"]
): string | undefined {
    if (!detail) {
        return undefined;
    }
    const known = TAIL_STEP_DETAIL_LABELS[detail.step];
    // Skip steps with no detail label (e.g. live_refresh) — the row title is enough.
    if (!known) {
        return undefined;
    }
    // Replay window text lives on the section subtitle; row only keeps counts.
    if (detail.step === "replay") {
        if (detail.total == null || detail.total <= 0) {
            return undefined;
        }
        const processed = detail.processed ?? 0;
        return `${processed.toLocaleString()} / ${detail.total.toLocaleString()} ${known.unit}`;
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
            skipped: 0,
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
            skipped: 0,
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
            skipped: 0,
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
        skipped: 0,
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
    const invoiceIndex = rows.findIndex((row) => row.entity_type === "Invoice");
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
 * Always lists every enabled entity. Active entity = first that is not
 * backfill_completed. Completed entities keep their checkpointed counts when
 * the live run only has placeholder zeros for them.
 *
 * When the live run has not reported any meaningful stats yet (just started),
 * ignore prior backfill_completed / last_error / pulled / totals so Start
 * resets chips and counters to Running / Waiting with zeros — same as Link
 * payments — instead of leaving Done / Failed counts from the previous run.
 * Waiting entities also keep counters clear until they become active.
 *
 * After Invoice completes, deferred payments are linked before Contact starts.
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
     * Start was requested with clear-before-import — show Deleting… immediately
     * even before the first purge progress patch arrives.
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
    const purgeRunning =
        purge?.status === "running" ||
        (expectPurge && purge?.status !== "done");
    const runHasProgress = Object.entries(stats).some(
        ([key, entityStats]) =>
            key !== MATURITY_ENTITY_STATS_KEY &&
            key !== PURGE_ENTITY_STATS_KEY &&
            hasMeaningfulEntityStats(entityStats)
    );
    // Placeholder zeros (Start backfill / pending run) are not a reload — do
    // not resume from prior-run sync_state checkpoints.
    const hasFreshPlaceholderStats =
        ordered.length > 0 &&
        ordered.every((entity) => {
            const entityStats = stats[entity];
            return (
                entityStats != null && !hasMeaningfulEntityStats(entityStats)
            );
        });
    const firstIncompleteIndex = ordered.findIndex(
        (entity) => !byType.get(entity)?.backfill_completed
    );
    const runStartedAt = params.runStartedAt;
    const hasCompletedEntityBeforeFrontierInCurrentRun =
        firstIncompleteIndex > 0 &&
        ordered.slice(0, firstIncompleteIndex).some((entity) =>
            entityCompletedInCurrentRun(byType.get(entity), runStartedAt)
        );
    // Page reload mid-import: live entity_stats may be empty until the next
    // poll, but sync_state checkpoints still have pulled/cursor — resume from
    // those instead of zeroing the bar. Also when an earlier entity finished
    // in *this* run while entity_stats are still placeholder zeros (common
    // during column sampling / before the first onProgress patch).
    const resumeFromCheckpoint =
        !runHasProgress &&
        (hasCompletedEntityBeforeFrontierInCurrentRun ||
            (!hasFreshPlaceholderStats &&
                ordered.some((entity) => {
                    const state = byType.get(entity);
                    if (!state || state.backfill_completed) {
                        return false;
                    }
                    return (
                        (state.backfill_records_pulled ?? 0) > 0 ||
                        Boolean(state.backfill_cursor_present)
                    );
                })));
    const useLiveOrCheckpoint = runHasProgress || resumeFromCheckpoint;
    const showLinkRow = shouldShowLinkPaymentsRow(params.enabledEntities);

    // Furthest entity that has live counts in this run (the fetch frontier).
    let lastTouchedIndex = -1;
    for (let i = 0; i < ordered.length; i++) {
        if (hasMeaningfulEntityStats(stats[ordered[i]])) {
            lastTouchedIndex = i;
        }
    }

    /**
     * Done only after this entity’s records are fully fetched in *this* run.
     * Never treat prior-run backfill_completed as Done for entities we have not
     * touched yet — that made Invoice look Done (and Link payments start) while
     * Payment was still importing / sampling.
     */
    const completedInThisRun = (
        entity: ImportType,
        index: number,
        state: ConnectorSyncStatePublic | undefined
    ): boolean => {
        // Live stats on entity N + sync_state frontier at N+1 ⇒ N is done,
        // even before Invoice emits entity_stats (column sampling gap).
        if (
            runHasProgress &&
            firstIncompleteIndex >= 0 &&
            index < firstIncompleteIndex &&
            hasMeaningfulEntityStats(stats[entity])
        ) {
            return true;
        }

        // A later entity already has live stats — done even when this entity's
        // sync_state checkpoint lags (poll interval / between-page work).
        if (
            runHasProgress &&
            lastTouchedIndex > index &&
            hasMeaningfulEntityStats(stats[entity])
        ) {
            return true;
        }

        if (!state?.backfill_completed || state.backfill_cursor_present) {
            return false;
        }

        if (!runHasProgress) {
            // Checkpoint-only resume: Done only for entities before the first
            // incomplete checkpoint (not every stale completed flag).
            if (firstIncompleteIndex < 0) {
                return true;
            }
            return index < firstIncompleteIndex;
        }

        if (!hasMeaningfulEntityStats(stats[entity])) {
            return false;
        }

        const livePulled = stats[entity]?.pulled ?? 0;
        const checkpointPulled = state.backfill_records_pulled ?? 0;
        if (livePulled < checkpointPulled) {
            return false;
        }

        // Earlier entity: Done once a later entity has live progress *and*
        // this entity’s sync_state says completed.
        if (lastTouchedIndex > index) {
            return true;
        }

        // Frontier: Done only after pages are exhausted (backfill_completed).
        return true;
    };

    const invoiceIndex = ordered.indexOf("Invoice");
    const invoiceDone =
        invoiceIndex >= 0 &&
        completedInThisRun(
            "Invoice",
            invoiceIndex,
            byType.get("Invoice")
        ) &&
        // Link payments must not start on stale Invoice completion alone.
        (runHasProgress
            ? hasMeaningfulEntityStats(stats.Invoice)
            : firstIncompleteIndex < 0 || firstIncompleteIndex > invoiceIndex);
    const linkComplete =
        !showLinkRow ||
        maturity?.status === "done" ||
        maturity?.status === "failed";

    const activeIndex = purgeRunning
        ? -1
        : ordered.findIndex((entity, index) => {
        if (!useLiveOrCheckpoint) {
            if (!hasFreshPlaceholderStats && firstIncompleteIndex >= 0) {
                return index === firstIncompleteIndex;
            }
            return index === 0;
        }
        if (
            showLinkRow &&
            !linkComplete &&
            invoiceIndex >= 0 &&
            index > invoiceIndex
        ) {
            return false;
        }
        return !completedInThisRun(entity, index, byType.get(entity));
    });

    const entityRows = ordered.map((entity, index) => {
        const state = byType.get(entity);
        const entityStats = stats[entity];
        const isActive = activeIndex >= 0 && index === activeIndex;

        // Purge phase: keep import rows Waiting until deletes finish.
        if (purgeRunning) {
            return {
                entity_type: entity,
                phase: "waiting" as const,
                records_pulled: 0,
                total_records: null,
                progress_percent: null,
                last_error: null,
            };
        }

        // Fresh Start: no live progress yet — zero counters like Link payments
        // so stale sync_state Done counts/totals do not flash back.
        if (!useLiveOrCheckpoint) {
            return {
                entity_type: entity,
                phase: isActive ? ("running" as const) : ("waiting" as const),
                records_pulled: 0,
                total_records: null,
                progress_percent: null,
                last_error: null,
            };
        }

        const pulled = resolveEntityPulledCount(entityStats, state, {
            running: true,
            runStartedAt,
        });
        const pageComplete = Boolean(
            state?.backfill_completed && !state?.backfill_cursor_present
        );
        const completed = completedInThisRun(entity, index, state);
        const staleCheckpointTotal =
            isActive &&
            pulled <= 0 &&
            !syncStateTouchedInRun(state, runStartedAt);
        const total = completed
            ? estimateEntityTotalRecords({
                  knownTotal: state?.backfill_total_records ?? null,
                  pulled,
                  pageComplete: true,
              })
            : isActive
              ? estimateEntityTotalRecords({
                    knownTotal: staleCheckpointTotal
                        ? null
                        : (state?.backfill_total_records ?? null),
                    pulled,
                    pageComplete,
                })
              : null;

        if (completed) {
            const success = resolveCompletedSuccessCount(
                entityStats,
                pulled,
                true
            );
            return {
                entity_type: entity,
                phase: "done" as const,
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
        }

        if (isActive) {
            // Live failure only — ignore stale sync_state.last_error from a
            // previous run so Start resets the Failed chip and validation text.
            const liveIndicatesFailure =
                (entityStats?.failed ?? 0) > 0 ||
                entityStats?.status === "failed" ||
                Boolean(entityStats?.sample_errors?.[0]?.trim());
            const error = liveIndicatesFailure
                ? entityStats?.sample_errors?.[0]?.trim() ||
                  state?.last_error?.trim() ||
                  null
                : null;
            return {
                entity_type: entity,
                phase: error ? ("failed" as const) : ("running" as const),
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
        }

        // Waiting entities: clear counters (same as Link payments waiting).
        // Ignore stale backfill_completed from a previous run.
        return {
            entity_type: entity,
            phase: "waiting" as const,
            records_pulled: 0,
            total_records: null,
            progress_percent: null,
            last_error: null,
        };
    });

    const withLinkRow = showLinkRow
        ? insertLinkPaymentsRow(
              entityRows,
              buildLinkPaymentsRunningRow({
                  maturity,
                  invoiceDone,
                  runHasProgress,
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
                  })
              )
            : withLinkRow,
        stats,
        runFinished: false,
        enabledEntities: ordered,
    });

    const activeStep =
        params.activeStep ??
        (purgeRunning && !purge?.status ? PURGE_ENTITY_STATS_KEY : null);

    return activeStep
        ? applyExplicitActiveStepToRows(rows, activeStep)
        : rows;
}

/**
 * While deferred AR post-ingest drains on the worker, connector config exposes
 * how many customers are still on ArPostIngestRetryQueue — use it when sync-run
 * entity_stats have not caught up yet.
 *
 * Only rewrite queued (worker-deferred) rows. Inline `_ar_replay` /
 * `_live_refresh` already emit real chunk progress; applying the queue depth
 * there zeroed the counter ("0 processed") and dropped the determinate bar.
 */
export function enrichPostIngestDrainProgressRow(
    rows: EntityProgressRow[],
    pendingCustomers: number | undefined
): EntityProgressRow[] {
    if (pendingCustomers == null) {
        return rows;
    }
    const drainLabels = [
        BACKFILL_AR_REPLAY_LABEL,
        BACKFILL_LIVE_REFRESH_LABEL,
    ] as const;
    let next = rows;
    for (const label of drainLabels) {
        const index = next.findIndex((row) => row.entity_type === label);
        if (index < 0) {
            continue;
        }
        const row = next[index];
        // Queued = deferred to worker. Do not clobber inline running progress.
        if (row.phase !== "queued") {
            continue;
        }
        const total = row.total_records;
        if (total == null || total <= 0) {
            continue;
        }
        const processed = Math.max(0, total - pendingCustomers);
        if (pendingCustomers <= 0) {
            const updated = [...next];
            updated[index] = {
                ...row,
                phase: "done",
                records_pulled: total,
                total_records: total,
                progress_percent: 100,
                success: total,
            };
            next = updated;
            continue;
        }
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
}): EntityProgressRow[] {
    const ordered = orderEnabledBackfillEntities(params.enabledEntities);
    const byType = new Map(
        (params.syncStates ?? []).map((state) => [state.entity_type, state])
    );
    const stats = params.run.entity_stats ?? {};

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
            Boolean(state?.backfill_completed)
        );
        const skipped = meaningful ? entityStats?.skipped : undefined;
        const sampleError = entityStats?.sample_errors?.[0]?.trim() || null;
        const stateError = state?.last_error?.trim() || null;

        if (!meaningful && !state?.backfill_completed && pulled === 0) {
            return {
                entity_type: entity,
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
                : meaningful || state?.backfill_completed || pulled > 0
                  ? "done"
                  : "not_started";

        return {
            entity_type: entity,
            phase: resolvedPhase,
            records_pulled: pulled,
            total_records: total,
            progress_percent:
                entity === "Invoice" || entity === "Payment"
                    ? pulled > 0
                        ? clampPercent(success ?? 0, pulled)
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

    const invoiceRow = entityRows.find((row) => row.entity_type === "Invoice");
    const invoiceCompletedInRun =
        invoiceRow?.phase === "done" ||
        Boolean(byType.get("Invoice")?.backfill_completed);

    const withLinkRow = shouldShowLinkPaymentsRow(params.enabledEntities)
        ? insertLinkPaymentsRow(
              entityRows,
              buildLinkPaymentsFinishedRow({
                  maturity: readMaturityStats(stats),
                  invoiceCompletedInRun,
              })
          )
        : entityRows;

    return appendTailStepRows({
        rows: shouldShowPurgeProgressRow(stats)
            ? prependDeletingRow(
                  withLinkRow,
                  buildDeletingProgressRow({
                      entityStats: stats,
                      runFinished: true,
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
        const parsed = JSON.parse(raw) as BackfillProgressSession;
        if (
            typeof parsed?.executionId !== "string" ||
            typeof parsed?.dismissed !== "boolean"
        ) {
            return null;
        }
        return parsed;
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
    window.sessionStorage.setItem(key, JSON.stringify(session));
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

/** Placeholder RUNNING run used until the server returns a real execution. */
export function createPendingBackfillRun(options?: {
    expectPurge?: boolean;
}): SyncRunSummary {
    const expectPurge = options?.expectPurge === true;
    return {
        id: "pending-backfill",
        trigger: "backfill",
        sync_mode: "BACKFILL",
        status: "RUNNING",
        started_at: new Date().toISOString(),
        completed_at: null,
        duration_seconds: null,
        active_step: expectPurge ? PURGE_ENTITY_STATS_KEY : null,
        entity_stats: {
            Customer: { pulled: 0, success: 0, failed: 0, skipped: 0 },
            Payment: { pulled: 0, success: 0, failed: 0, skipped: 0 },
            Invoice: { pulled: 0, success: 0, failed: 0, skipped: 0 },
            Contact: { pulled: 0, success: 0, failed: 0, skipped: 0 },
            ...(expectPurge
                ? {
                      [PURGE_ENTITY_STATS_KEY]: {
                          pulled: 0,
                          success: 0,
                          failed: 0,
                          skipped: 0,
                          status: "running" as const,
                      },
                  }
                : {}),
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
