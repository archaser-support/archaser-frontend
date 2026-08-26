import type { ImportType } from "@/types/db";

import type {
    ConnectorSyncStatePublic,
    SyncRunSummary,
} from "@/shared/services/billingConnectorService";

/** Matches BillingConnectorSyncService backfill walk order. */
export const BACKFILL_ENTITY_ORDER: ImportType[] = [
    "Customer",
    "Invoice",
    "Payment",
    "Contact",
];

export type EntityProgressPhase =
    | "waiting"
    | "running"
    | "done"
    | "failed"
    | "not_started";

export interface EntityProgressRow {
    entity_type: ImportType;
    phase: EntityProgressPhase;
    records_pulled: number;
    total_records: number | null;
    /** 0–100 when total is known; null → indeterminate while running. */
    progress_percent: number | null;
    last_error: string | null;
    success?: number;
    failed?: number;
    skipped?: number;
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

type EntityStatSlice = NonNullable<
    SyncRunSummary["entity_stats"]
>[string];

/**
 * Live sync-run stats always include every entity key (often at 0). Prefer the
 * higher of live vs checkpointed pulled so starting the next entity does not
 * wipe a completed entity's count.
 */
export function resolveEntityPulledCount(
    entityStats: EntityStatSlice | undefined,
    state: ConnectorSyncStatePublic | undefined
): number {
    const fromStats = entityStats?.pulled;
    const fromState = state?.backfill_records_pulled ?? 0;
    if (fromStats == null) {
        return fromState;
    }
    return Math.max(fromStats, fromState);
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
        (entityStats.skipped ?? 0) > 0
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
 */
export function buildRunningEntityProgressRows(params: {
    enabledEntities: ImportType[];
    syncStates: ConnectorSyncStatePublic[] | undefined;
    entityStats?: SyncRunSummary["entity_stats"];
}): EntityProgressRow[] {
    const ordered = orderEnabledBackfillEntities(params.enabledEntities);
    const byType = new Map(
        (params.syncStates ?? []).map((state) => [state.entity_type, state])
    );
    const stats = params.entityStats ?? {};

    const activeIndex = ordered.findIndex((entity) => {
        const state = byType.get(entity);
        return !state?.backfill_completed;
    });

    return ordered.map((entity, index) => {
        const state = byType.get(entity);
        const entityStats = stats[entity];
        const pulled = resolveEntityPulledCount(entityStats, state);
        const total = state?.backfill_total_records ?? null;
        const error = state?.last_error?.trim() || null;
        const completed = Boolean(state?.backfill_completed);

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

        if (activeIndex >= 0 && index === activeIndex) {
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

        return {
            entity_type: entity,
            phase: "waiting" as const,
            records_pulled: pulled,
            total_records: total,
            progress_percent: null,
            last_error: null,
        };
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

    return ordered.map((entity) => {
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
