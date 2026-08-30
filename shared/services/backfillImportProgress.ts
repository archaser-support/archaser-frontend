import type { ImportType } from "@/types/db";

import type {
    ConnectorSyncStatePublic,
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

/** Progress-panel label for deferred payment → invoice linking. */
export const BACKFILL_LINK_PAYMENTS_LABEL = "Link payments";

/**
 * Tail steps after entity ingest. They run while the sync is still RUNNING, so
 * without their own rows the panel froze on the last entity and gave no reason
 * for the disabled action buttons.
 */
export const POST_INGEST_ENTITY_STATS_KEY = "_post_ingest";
export const PENDING_CLOSES_ENTITY_STATS_KEY = "_pending_closes";
export const BALANCES_ENTITY_STATS_KEY = "_balances";

export const BACKFILL_POST_INGEST_LABEL = "Refresh AR & insurance";
export const BACKFILL_PENDING_CLOSES_LABEL = "Settle closed invoices";
export const BACKFILL_BALANCES_LABEL = "Recalculate balances";

/** Rendered in run order, after the entity rows. */
export const BACKFILL_TAIL_STEPS = [
    {
        key: PENDING_CLOSES_ENTITY_STATS_KEY,
        label: BACKFILL_PENDING_CLOSES_LABEL,
    },
    { key: POST_INGEST_ENTITY_STATS_KEY, label: BACKFILL_POST_INGEST_LABEL },
    { key: BALANCES_ENTITY_STATS_KEY, label: BACKFILL_BALANCES_LABEL },
] as const;

export type BackfillTailStepLabel =
    (typeof BACKFILL_TAIL_STEPS)[number]["label"];

export type BackfillProgressRowKey =
    | ImportType
    | typeof BACKFILL_LINK_PAYMENTS_LABEL
    | BackfillTailStepLabel;

export type EntityProgressPhase =
    | "waiting"
    | "running"
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
    /** Sub-line for tail steps, e.g. "Replaying AR history · 1,240 / 2,027 events". */
    detail?: string;
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

function shouldShowLinkPaymentsRow(enabledEntities: ImportType[]): boolean {
    return enabledEntities.includes("Invoice");
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
        };
    }

    // Invoice finished this run; maturity may not have emitted status yet.
    if (
        params.invoiceDone &&
        params.runHasProgress &&
        status !== "done" &&
        status !== "failed"
    ) {
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
        live_refresh: { label: "Refreshing insurance fields", unit: "customers" },
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

function formatTailStepDetail(
    detail: EntityStatSlice["detail"],
    mepBreachStartDate?: string | null
): string | undefined {
    if (!detail) {
        return undefined;
    }
    const known = TAIL_STEP_DETAIL_LABELS[detail.step];
    let label = known?.label ?? detail.step;
    if (detail.step === "replay") {
        const from = formatMepBreachStartDate(mepBreachStartDate);
        if (from) {
            label = `${label} from ${from}`;
        }
    }
    if (detail.total == null || detail.total <= 0) {
        return label;
    }
    const processed = detail.processed ?? 0;
    return `${label} · ${processed.toLocaleString()} / ${detail.total.toLocaleString()} ${known?.unit ?? "items"}`;
}

/**
 * Tail steps report an explicit status, so the row maps straight off it. A
 * missing slice means the step has not started (or had nothing to do).
 */
function buildTailStepRow(params: {
    label: BackfillTailStepLabel;
    slice: EntityStatSlice | undefined;
    runFinished: boolean;
    mepBreachStartDate?: string | null;
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

    return {
        entity_type: params.label,
        phase: "running",
        records_pulled: processed,
        total_records: total,
        progress_percent: total != null ? clampPercent(processed, total) : null,
        last_error: null,
        success: processed,
        failed: 0,
        skipped: 0,
        ...(formatTailStepDetail(slice.detail, params.mepBreachStartDate)
            ? {
                  detail: formatTailStepDetail(
                      slice.detail,
                      params.mepBreachStartDate
                  ),
              }
            : {}),
    };
}

function appendTailStepRows(params: {
    rows: EntityProgressRow[];
    stats: SyncRunSummary["entity_stats"] | undefined;
    runFinished: boolean;
    mepBreachStartDate?: string | null;
}): EntityProgressRow[] {
    const stats = params.stats ?? {};
    const tailRows = BACKFILL_TAIL_STEPS.filter(
        // Only surface a step once it has reported, so runs that never reach it
        // (collection-only accounts, cancelled runs) do not show dead rows.
        (step) => stats[step.key]?.status != null
    ).map((step) =>
        buildTailStepRow({
            label: step.label,
            slice: stats[step.key],
            runFinished: params.runFinished,
            mepBreachStartDate: params.mepBreachStartDate,
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
 *   sync_state. When live stats are absent (reload mid-run / run just created),
 *   fall back to checkpointed state — entity start zeros pulled on the backend
 *   so sampling does not flash a prior run's total.
 * - Finished runs: fall back to checkpointed state when live stats are missing.
 */
export function resolveEntityPulledCount(
    entityStats: EntityStatSlice | undefined,
    state: ConnectorSyncStatePublic | undefined,
    options?: { running?: boolean }
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
    /** Names the replay window in the AR replay sub-line. */
    mepBreachStartDate?: string | null;
}): EntityProgressRow[] {
    const ordered = orderEnabledBackfillEntities(params.enabledEntities);
    const byType = new Map(
        (params.syncStates ?? []).map((state) => [state.entity_type, state])
    );
    const stats = params.entityStats ?? {};
    const maturity = readMaturityStats(stats);
    const runHasProgress = Object.entries(stats).some(
        ([key, entityStats]) =>
            key !== MATURITY_ENTITY_STATS_KEY &&
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
    // Page reload mid-import: live entity_stats may be empty until the next
    // poll, but sync_state checkpoints still have pulled/cursor — resume from
    // those instead of zeroing the bar.
    const resumeFromCheckpoint =
        !runHasProgress &&
        !hasFreshPlaceholderStats &&
        ordered.some((entity) => {
            const state = byType.get(entity);
            if (!state || state.backfill_completed) {
                return false;
            }
            return (
                (state.backfill_records_pulled ?? 0) > 0 ||
                Boolean(state.backfill_cursor_present)
            );
        });
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
    const firstIncompleteIndex = ordered.findIndex(
        (entity) => !byType.get(entity)?.backfill_completed
    );

    const completedInThisRun = (
        entity: ImportType,
        index: number,
        state: ConnectorSyncStatePublic | undefined
    ): boolean => {
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

    const activeIndex = ordered.findIndex((entity, index) => {
        if (!useLiveOrCheckpoint) {
            return true;
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
        });
        const total = state?.backfill_total_records ?? null;
        const completed = completedInThisRun(entity, index, state);

        if (completed) {
            return {
                entity_type: entity,
                phase: "done" as const,
                records_pulled: pulled,
                total_records: total,
                progress_percent: total != null ? 100 : null,
                last_error: null,
                success: resolveCompletedSuccessCount(
                    entityStats,
                    pulled,
                    true
                ),
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
                    total != null ? clampPercent(pulled, total) : null,
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

    return appendTailStepRows({
        rows: withLinkRow,
        stats,
        runFinished: false,
        mepBreachStartDate: params.mepBreachStartDate,
    });
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
                total != null ? clampPercent(pulled, total) : null,
            last_error: sampleError ?? stateError,
            success,
            failed: failedCount,
            skipped,
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
        rows: withLinkRow,
        stats,
        runFinished: true,
        mepBreachStartDate: params.run.cutover_options?.mep_breach_start_date,
    });
}

export function buildBackfillProgressHeader(params: {
    run: SyncRunSummary;
    rows: EntityProgressRow[];
}): { title: string; subtitle: string; severity: "info" | "success" | "warning" | "error" } {
    const isRunning = params.run.status === "RUNNING";
    const runningRow = params.rows.find((row) => row.phase === "running");
    const failedRows = params.rows.filter((row) => row.phase === "failed");
    const doneCount = params.rows.filter(
        (row) => row.phase === "done"
    ).length;

    if (isRunning) {
        if (runningRow?.entity_type === BACKFILL_LINK_PAYMENTS_LABEL) {
            return {
                title: "Backfill progress",
                subtitle:
                    "Linking payments to invoices… · Actions are disabled until this finishes",
                severity: "info",
            };
        }
        const tailStep = BACKFILL_TAIL_STEPS.find(
            (step) => step.label === runningRow?.entity_type
        );
        if (tailStep) {
            return {
                title: "Backfill progress",
                subtitle: `${tailStep.label}… · Actions are disabled until this finishes`,
                severity: "info",
            };
        }
        const current = runningRow?.entity_type ?? "entities";
        return {
            title: "Backfill progress",
            subtitle: `Importing ${current}… · Actions are disabled until this finishes`,
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
export function createPendingBackfillRun(): SyncRunSummary {
    return {
        id: "pending-backfill",
        trigger: "backfill",
        sync_mode: "BACKFILL",
        status: "RUNNING",
        started_at: new Date().toISOString(),
        completed_at: null,
        duration_seconds: null,
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
