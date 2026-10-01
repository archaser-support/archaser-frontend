"use client";

import { Box, Button, LinearProgress, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

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

export type CreditHistoryRefreshProgressDialogProps = {
    open: boolean;
    onClose: () => void;
    /** Seed from parent-save response so the bar shows before first poll. */
    initialJob?: CreditAsOfBackfillJobView | null;
    /**
     * `started` — parent save succeeded and kicked off history refresh.
     * `blocked` — parent save was rejected because a refresh is already running.
     */
    reason?: "started" | "blocked";
    /** Which status endpoint to poll. */
    statusKind?: CreditHistoryRefreshStatusKind;
};

/**
 * Progress UI for parent-link scoped history refresh (pool members + CDP days),
 * or account Generate when that job is what blocked the save.
 */
export function CreditHistoryRefreshProgressDialog({
    open,
    onClose,
    initialJob = null,
    reason = "started",
    statusKind = "parent_pool_history",
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
            return status === "running" ? 2000 : false;
        },
        initialData: initialJob ?? undefined,
    });

    const status = job?.status ?? initialJob?.status ?? "idle";
    const daysDone = job?.daysDone ?? initialJob?.daysDone ?? 0;
    const daysTotal = job?.daysTotal ?? initialJob?.daysTotal ?? 0;
    const progressPct =
        daysTotal > 0
            ? Math.min(100, Math.round((daysDone / daysTotal) * 100))
            : status === "complete"
              ? 100
              : 0;
    const isRunning = status === "running";
    const isTerminal =
        status === "complete" || status === "failed" || status === "paused";

    const etaLabel = useMemo(() => {
        if (
            !isRunning ||
            job?.estimatedSecondsRemaining == null ||
            job.estimatedSecondsRemaining <= 0
        ) {
            return null;
        }
        return formatEtaSeconds(job.estimatedSecondsRemaining, t);
    }, [isRunning, job?.estimatedSecondsRemaining, t]);

    const handleClose = () => {
        setDismissed(true);
        onClose();
    };

    const bodyKey =
        reason === "blocked"
            ? "credit_history_refresh.body_blocked"
            : "credit_history_refresh.body";
    const bodyDefault =
        reason === "blocked"
            ? "A credit history refresh is already running. Parent link changes are blocked until it finishes. Dashboard charts will catch up overnight."
            : "Parent link is saved. Customer credit history is updating in the background. Dashboard charts will catch up overnight.";

    return (
        <AppDialog
            open={open && !dismissed}
            onClose={handleClose}
            title={t("credit_history_refresh.title", {
                ns: "customers",
                defaultValue: "Refreshing credit history",
            })}
            actions={
                <Button onClick={handleClose} variant="contained">
                    {isTerminal
                        ? t("credit_history_refresh.close", {
                              ns: "customers",
                              defaultValue: "Close",
                          })
                        : t("credit_history_refresh.run_in_background", {
                              ns: "customers",
                              defaultValue: "Run in background",
                          })}
                </Button>
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
            {status !== "complete" ? (
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
                        isRunning && daysDone === 0
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
