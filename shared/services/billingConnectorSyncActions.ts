import type { ConnectorSyncStatePublic } from "@/shared/services/billingConnectorService";

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
        return "Run preview sync for each enabled entity before starting backfill.";
    }
    return `Run preview sync for ${formatEntityList(entities)} before starting backfill. Every enabled entity needs a passing preview, including any you just turned on.`;
}

export function getStartBackfillDisabledReason(params: {
    canManage: boolean;
    syncInProgress: boolean;
    backfillPending: boolean;
    syncMode: string;
    previewBlocked?: boolean;
    previewBlockedEntities?: string[];
    pendingArPostIngestCustomers?: number;
}): string | null {
    if (!params.canManage) {
        return "You do not have permission to run backfill.";
    }
    if (params.syncInProgress) {
        return "A sync is already running. Cancel it or wait for it to finish.";
    }
    if ((params.pendingArPostIngestCustomers ?? 0) > 0) {
        return "Refresh AR & insurance is still running in the background. Wait for it to finish before starting or resuming backfill.";
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

export type BackfillActionStage =
    | "import_running"
    | "preview_required"
    | "start_backfill"
    | "resume_backfill"
    | "incremental";

export type BackfillPrimaryAction =
    | "preview"
    | "start_backfill"
    | "resume_backfill"
    | "incremental"
    | "stop";

export interface BackfillActionStageView {
    stage: BackfillActionStage;
    caption: string;
    primaryAction: BackfillPrimaryAction;
    primaryLabel: string;
    showReset: boolean;
    showStop: boolean;
}

const PREVIEW_PURPOSE =
    "Fetches a small sample from the ERP (Enterprise Resource Planning) and checks mapping and pull filters. Run once for each enabled entity before the first import.";
const START_BACKFILL_PURPOSE =
    "Pulls historical invoices and payments from the ERP into Archaser. Run after preview passes for every enabled entity.";
const RESUME_BACKFILL_PURPOSE =
    "Continues the historical import from where it stopped. Use this after a stopped or interrupted backfill.";
const INCREMENTAL_PURPOSE =
    "Pulls the latest invoice and payment changes from the ERP into Archaser.";
const STOP_IMPORT_PURPOSE =
    "Stops the current import run. You can resume backfill later from where it left off.";
const RESET_BACKFILL_PURPOSE =
    "Unlocks the start date and backfill options so you can change settings and run backfill again. Does not delete imported data.";

/** True when deferred replay / live-refresh work is still on the worker queue. */
export function hasPendingDeferredArPostIngest(
    pendingCustomers: number | undefined
): boolean {
    return (pendingCustomers ?? 0) > 0;
}

/** True when backfill started but not all enabled entities finished. */
export function hasPartialBackfillProgress(
    syncStates: ConnectorSyncStatePublic[] | undefined
): boolean {
    if (!syncStates?.length) {
        return false;
    }
    return syncStates.some(
        (state) =>
            state.backfill_cursor_present ||
            state.backfill_records_pulled > 0 ||
            (state.last_attempt_at != null && !state.backfill_completed)
    );
}

export function getPreviewSyncDisabledReason(params: {
    canManage: boolean;
    previewPending: boolean;
    importBusy: boolean;
    previewUpToDate: boolean;
}): string | null {
    if (!params.canManage) {
        return "You do not have permission to run preview sync.";
    }
    if (params.importBusy) {
        return "A sync is already running. Stop it or wait for it to finish.";
    }
    if (params.previewPending) {
        return "Preview sync request is still in progress.";
    }
    if (params.previewUpToDate) {
        return "Preview already ran for the current mapping and pull filters. Change a mapping or pull filter to run it again.";
    }
    return null;
}

export function getStopImportDisabledReason(params: {
    canManage: boolean;
    stopPending: boolean;
    stopInProgress: boolean;
}): string | null {
    if (!params.canManage) {
        return "You do not have permission to stop the import.";
    }
    if (params.stopInProgress || params.stopPending) {
        return "Stop request is already in progress.";
    }
    return null;
}

export function getBackfillActionPurpose(action: BackfillPrimaryAction): string {
    switch (action) {
        case "preview":
            return PREVIEW_PURPOSE;
        case "start_backfill":
            return START_BACKFILL_PURPOSE;
        case "resume_backfill":
            return RESUME_BACKFILL_PURPOSE;
        case "incremental":
            return INCREMENTAL_PURPOSE;
        case "stop":
            return STOP_IMPORT_PURPOSE;
        default:
            return "";
    }
}

export function getResetBackfillPurpose(): string {
    return RESET_BACKFILL_PURPOSE;
}

export function resolveBackfillActionStage(params: {
    syncMode: string;
    previewBlocked: boolean;
    backfillOptionsLocked: boolean;
    syncStates: ConnectorSyncStatePublic[] | undefined;
    importBusy: boolean;
    showStopImport: boolean;
}): BackfillActionStageView {
    if (params.importBusy) {
        return {
            stage: "import_running",
            caption: params.showStopImport
                ? "Import running…"
                : "Starting import…",
            primaryAction: "stop",
            primaryLabel: "Stop import",
            showReset: false,
            showStop: params.showStopImport,
        };
    }

    if (params.syncMode !== "INCREMENTAL" && params.previewBlocked) {
        return {
            stage: "preview_required",
            caption:
                "Next: run a preview sync to validate mapping and pull filters before the first import.",
            primaryAction: "preview",
            primaryLabel: "Run preview sync",
            showReset: params.backfillOptionsLocked,
            showStop: false,
        };
    }

    if (params.syncMode === "INCREMENTAL") {
        return {
            stage: "incremental",
            caption: "Pull the latest ERP changes now.",
            primaryAction: "incremental",
            primaryLabel: "Run incremental sync now",
            showReset: params.backfillOptionsLocked,
            showStop: false,
        };
    }

    const resume =
        params.backfillOptionsLocked &&
        hasPartialBackfillProgress(params.syncStates);

    if (resume) {
        return {
            stage: "resume_backfill",
            caption:
                "Next: continue the historical import from where it stopped.",
            primaryAction: "resume_backfill",
            primaryLabel: "Resume backfill",
            showReset: params.backfillOptionsLocked,
            showStop: false,
        };
    }

    return {
        stage: "start_backfill",
        caption:
            "Next: import historical invoices and payments from the ERP.",
        primaryAction: "start_backfill",
        primaryLabel: "Start backfill",
        showReset: params.backfillOptionsLocked,
        showStop: false,
    };
}
