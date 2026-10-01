"use client";

import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { Box, Button, LinearProgress, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
    PARENT_CHANGE_SYNC_STEPS,
    type ParentChangeSyncStep,
} from "@/shared/customerCreditPoolSyncSteps";
import AppDialog from "@/shared/layout-components/modal/AppDialog";
import type { CreditAsOfBackfillJobView } from "@/types/creditInsurance";
import { apiFetch } from "@/utils/apiFetch";

export type CreditHistoryRefreshStatusKind =
    | "parent_pool_history"
    | "asof_backfill";

function statusPathForKind(kind: CreditHistoryRefreshStatusKind): string {
    return kind === "asof_backfill"
        ? "/api/credit-insurance/asof-backfill-status"
        : "/api/credit-insurance/parent-pool-history-status";
}

async function fetchCreditHistoryRefreshStatus(
    kind: CreditHistoryRefreshStatusKind
): Promise<CreditAsOfBackfillJobView> {
    const res = await apiFetch(statusPathForKind(kind));
    if (!res.ok) {
        throw new Error("backfill_status_failed");
    }
    return (await res.json()) as CreditAsOfBackfillJobView;
}

function formatEtaSeconds(
    seconds: number,
    t: (key: string, options?: Record<string, unknown>) => string
): string {
    if (seconds < 60) {
        return t("credit_history_refresh.eta_seconds", {
            ns: "customers",
            defaultValue: "~{{count}} sec",
            count: Math.max(1, Math.round(seconds)),
        });
    }
    if (seconds < 3600) {
        return t("credit_history_refresh.eta_minutes", {
            ns: "customers",
            defaultValue: "~{{count}} min",
            count: Math.max(1, Math.round(seconds / 60)),
        });
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    if (mins > 0) {
        return t("credit_history_refresh.eta_hours_minutes", {
            ns: "customers",
            defaultValue: "~{{hours}} hr {{mins}} min",
            hours,
            mins,
        });
    }
    return t("credit_history_refresh.eta_hours", {
        ns: "customers",
        defaultValue: "~{{hours}} hr",
        hours,
    });
}

function stepLabel(
    step: ParentChangeSyncStep,
    t: (key: string, options?: Record<string, unknown>) => string
): string {
    const defaults: Record<ParentChangeSyncStep, string> = {
        remirror: "Applying shared credit settings to the pool",
        capacity_gap: "Recalculating capacity gap",
        ctp_today: "Updating today’s credit trends",
        ctp_overlay: "Applying pool gap and at-risk totals",
        cdp_today: "Updating today’s credit dashboard",
        breach_and_open_ar: "Rolling up breach and open receivables",
        history: "Refreshing credit history",
    };
    return t(`credit_history_refresh.steps.${step}`, {
        ns: "customers",
        defaultValue: defaults[step],
    });
}

export type CreditHistoryRefreshProgressDialogProps = {
    open: boolean;
    onClose: () => void;
    /** Seed from parent-save response so the bar shows before first poll. */
    initialJob?: CreditAsOfBackfillJobView | null;
    /**
     * `started` — parent save in progress / succeeded and kicked off refresh.
     * `blocked` — parent save was rejected because a refresh is already running.
     */
    reason?: "started" | "blocked";
    /** Which status endpoint to poll. */
    statusKind?: CreditHistoryRefreshStatusKind;
    /** When true, Close / backdrop dismiss are disabled (Save still syncing). */
    lockDismiss?: boolean;
};

/**
 * Progress UI for parent-link sync + scoped history refresh, or account
 * Generate when that job is what blocked the save.
 */
export function CreditHistoryRefreshProgressDialog({
    open,
    onClose,
    initialJob = null,
    reason = "started",
    statusKind = "parent_pool_history",
    lockDismiss = false,
}: CreditHistoryRefreshProgressDialogProps) {
    const { t } = useTranslation();
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (open) {
            setDismissed(false);
        }
    }, [open]);

    const { data: job } = useQuery({
        queryKey: [
            "credit-insurance",
            "credit-history-refresh-status",
            statusKind,
        ],
        queryFn: () => fetchCreditHistoryRefreshStatus(statusKind),
        enabled: open && !dismissed,
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            return status === "running" || status === "syncing" ? 1000 : false;
        },
        initialData: initialJob ?? undefined,
    });

    const status = job?.status ?? initialJob?.status ?? "idle";
    const daysDone = job?.daysDone ?? initialJob?.daysDone ?? 0;
    const daysTotal = job?.daysTotal ?? initialJob?.daysTotal ?? 0;
    const currentStep = (job?.step ??
        initialJob?.step ??
        null) as ParentChangeSyncStep | null;
    const phase = job?.phase ?? initialJob?.phase ?? null;
    const isSyncing =
        status === "syncing" ||
        (phase === "sync" && status !== "failed" && status !== "complete");
    const isRunning = status === "running" || isSyncing;
    const isTerminal =
        status === "complete" || status === "failed" || status === "paused";
    const dismissLocked = lockDismiss || status === "syncing";

    const syncStepsDone =
        job?.syncStepsDone ??
        initialJob?.syncStepsDone ??
        (currentStep
            ? PARENT_CHANGE_SYNC_STEPS.indexOf(currentStep)
            : isSyncing
              ? 0
              : PARENT_CHANGE_SYNC_STEPS.length);
    const syncStepsTotal =
        job?.syncStepsTotal ??
        initialJob?.syncStepsTotal ??
        PARENT_CHANGE_SYNC_STEPS.length;

    const progressPct = useMemo(() => {
        if (status === "complete") {
            return 100;
        }
        if (isSyncing || phase === "sync") {
            return Math.min(
                99,
                Math.round(
                    ((Math.max(0, syncStepsDone) + (isSyncing ? 0.35 : 0)) /
                        Math.max(1, syncStepsTotal)) *
                        100
                )
            );
        }
        if (daysTotal > 0) {
            // Sync checklist complete; history days are the remaining bar.
            const historyPct = Math.min(
                100,
                Math.round((daysDone / daysTotal) * 100)
            );
            return Math.round(70 + historyPct * 0.3);
        }
        return isRunning ? 5 : 0;
    }, [
        status,
        isSyncing,
        phase,
        syncStepsDone,
        syncStepsTotal,
        daysDone,
        daysTotal,
        isRunning,
    ]);

    const etaLabel = useMemo(() => {
        if (
            status !== "running" ||
            job?.estimatedSecondsRemaining == null ||
            job.estimatedSecondsRemaining <= 0
        ) {
            return null;
        }
        return formatEtaSeconds(job.estimatedSecondsRemaining, t);
    }, [status, job?.estimatedSecondsRemaining, t]);

    const handleClose = () => {
        if (dismissLocked) {
            return;
        }
        setDismissed(true);
        onClose();
    };

    const title =
        isSyncing || status === "idle"
            ? t("credit_history_refresh.title_syncing", {
                  ns: "customers",
                  defaultValue: "Updating credit pool",
              })
            : t("credit_history_refresh.title", {
                  ns: "customers",
                  defaultValue: "Refreshing credit history",
              });

    const bodyKey =
        reason === "blocked"
            ? "credit_history_refresh.body_blocked"
            : isSyncing || status === "idle"
              ? status === "idle"
                  ? "credit_history_refresh.body_starting"
                  : "credit_history_refresh.body_syncing"
              : "credit_history_refresh.body";
    const bodyDefault =
        reason === "blocked"
            ? "A credit history refresh is already running. Parent link changes are blocked until it finishes. Dashboard charts will catch up overnight."
            : isSyncing || status === "idle"
              ? status === "idle"
                  ? "Starting credit pool update…"
                  : "Saving the parent link and updating the shared credit pool. Please wait — this can take a minute on large accounts."
              : "Parent link is saved. Customer credit history is updating in the background. Dashboard charts will catch up overnight.";

    const showChecklist =
        statusKind === "parent_pool_history" &&
        reason !== "blocked" &&
        (isSyncing ||
            status === "idle" ||
            status === "running" ||
            status === "failed" ||
            status === "complete");

    return (
        <AppDialog
            open={open && !dismissed}
            onClose={dismissLocked ? () => undefined : handleClose}
            title={title}
            actions={
                isTerminal || reason === "blocked" ? (
                    <Button onClick={handleClose} variant="contained">
                        {t("credit_history_refresh.close", {
                            ns: "customers",
                            defaultValue: "Close",
                        })}
                    </Button>
                ) : null
            }
        >
            {status === "complete" ? (
                <Typography variant="body2" color="success.main" sx={{ mb: 2 }}>
                    {t("credit_history_refresh.complete", {
                        ns: "customers",
                        defaultValue:
                            "Customer credit history is up to date. Dashboard charts will catch up overnight.",
                    })}
                </Typography>
            ) : (
                <Typography variant="body2" sx={{ mb: 2 }}>
                    {t(bodyKey, {
                        ns: "customers",
                        defaultValue: bodyDefault,
                    })}
                </Typography>
            )}

            {showChecklist ? (
                <Stack spacing={0.75} sx={{ mb: 2 }}>
                    {PARENT_CHANGE_SYNC_STEPS.map((step, index) => {
                        const currentIndex = currentStep
                            ? PARENT_CHANGE_SYNC_STEPS.indexOf(currentStep)
                            : status === "idle"
                              ? -1
                              : syncStepsDone;
                        const done =
                            status === "complete" ||
                            (status === "running" && phase !== "sync") ||
                            index < currentIndex ||
                            (status === "failed" && index < currentIndex);
                        const active =
                            !done &&
                            (step === currentStep ||
                                (status === "idle" && index === 0));
                        const failed =
                            status === "failed" && step === currentStep;
                        return (
                            <Stack
                                key={step}
                                direction="row"
                                spacing={1}
                                alignItems="center"
                            >
                                {failed ? (
                                    <ErrorOutlineIcon
                                        color="error"
                                        fontSize="small"
                                    />
                                ) : done ? (
                                    <CheckCircleOutlineIcon
                                        color="success"
                                        fontSize="small"
                                    />
                                ) : (
                                    <RadioButtonUncheckedIcon
                                        color={active ? "primary" : "disabled"}
                                        fontSize="small"
                                    />
                                )}
                                <Typography
                                    variant="body2"
                                    color={
                                        failed
                                            ? "error"
                                            : active
                                              ? "text.primary"
                                              : done
                                                ? "text.secondary"
                                                : "text.disabled"
                                    }
                                    fontWeight={active ? 600 : 400}
                                >
                                    {stepLabel(step, t)}
                                </Typography>
                            </Stack>
                        );
                    })}
                </Stack>
            ) : null}

            {status === "running" && !isSyncing ? (
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1 }}
                >
                    {t("credit_history_refresh.progress", {
                        ns: "customers",
                        defaultValue:
                            "Updating history: {{done}} of {{total}} days",
                        done: daysDone,
                        total: daysTotal,
                    })}
                    {etaLabel ? ` · ${etaLabel}` : null}
                </Typography>
            ) : null}
            <Box sx={{ width: "100%", mb: 1 }}>
                <LinearProgress
                    variant={
                        isRunning && progressPct < 2
                            ? "indeterminate"
                            : "determinate"
                    }
                    value={progressPct}
                />
            </Box>
            {status === "failed" && job?.lastError ? (
                <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                    {job.lastError}
                </Typography>
            ) : null}
        </AppDialog>
    );
}
