export function isActiveConnectorSyncRun(run: {
    status: string;
    error_type?: string | null;
    completed_at?: string | null;
}): boolean {
    if (run.status === "RUNNING") {
        return true;
    }
    return (
        run.status === "TIMEOUT" &&
        run.error_type === "cancelled" &&
        !run.completed_at
    );
}

function formatEntityList(entities: string[]): string {
    if (entities.length === 1) {
        return entities[0];
    }
    if (entities.length === 2) {
        return `${entities[0]} and ${entities[1]}`;
    }
    return `${entities.slice(0, -1).join(", ")}, and ${entities[entities.length - 1]}`;
}

/** Why first backfill is blocked until preview sync passes. */
export function getPreviewBlockedReason(entities: string[]): string {
    if (entities.length === 0) {
        return "Run preview sync for each enabled entity in Field mapping before starting backfill.";
    }
    return `Run preview sync for ${formatEntityList(entities)} in Field mapping before starting backfill. Every enabled entity needs a passing preview, including any you just turned on.`;
}

export function getStartBackfillDisabledReason(params: {
    canManage: boolean;
    syncInProgress: boolean;
    backfillPending: boolean;
    syncMode: string;
    previewBlocked?: boolean;
    previewBlockedEntities?: string[];
}): string | null {
    if (!params.canManage) {
        return "You do not have permission to run backfill.";
    }
    if (params.syncInProgress) {
        return "A sync is already running. Cancel it or wait for it to finish.";
    }
    if (params.backfillPending) {
        return "Backfill request is still in progress.";
    }
    if (params.syncMode === "INCREMENTAL") {
        return "Backfill is complete. Reset backfill to run it again.";
    }
    if (params.previewBlocked) {
        return getPreviewBlockedReason(params.previewBlockedEntities ?? []);
    }
    return null;
}

export function getResetBackfillDisabledReason(params: {
    canManage: boolean;
    resetPending: boolean;
    syncInProgress: boolean;
}): string | null {
    if (!params.canManage) {
        return "You do not have permission to reset backfill.";
    }
    if (params.resetPending) {
        return "Reset is still in progress.";
    }
    if (params.syncInProgress) {
        return "A sync is already running. Stop it or wait for it to finish.";
    }
    return null;
}

export function isResetBackfillDisabled(params: {
    canManage: boolean;
    resetPending: boolean;
    syncInProgress: boolean;
}): boolean {
    return getResetBackfillDisabledReason(params) != null;
}

export function getRunIncrementalDisabledReason(params: {
    canManage: boolean;
    syncInProgress: boolean;
    incrementalPending: boolean;
    syncMode: string;
}): string | null {
    if (!params.canManage) {
        return "You do not have permission to run incremental sync.";
    }
    if (params.syncInProgress) {
        return "A sync is already running. Stop it or wait for it to finish.";
    }
    if (params.incrementalPending) {
        return "Incremental sync request is still in progress.";
    }
    if (params.syncMode !== "INCREMENTAL") {
        return "Finish backfill before running incremental sync.";
    }
    return null;
}

/** HTML date inputs only accept YYYY-MM-DD; API Dates may arrive as ISO datetimes. */
export function toDateInputValue(value: string | null | undefined): string {
    if (!value) {
        return "";
    }
    const day = String(value).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "";
}
