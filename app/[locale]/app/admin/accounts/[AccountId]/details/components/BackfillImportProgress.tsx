"use client";

import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Card,
    CardContent,
    Chip,
    LinearProgress,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
    ExpandMore as ExpandMoreIcon,
    Sync as SyncIcon,
} from "@mui/icons-material";
import type { ImportType } from "@/types/db";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { useTranslation } from "react-i18next";

import {
    appendProgressRateSample,
    buildBackfillProgressHeader,
    buildFinishedEntityProgressRows,
    buildRunningEntityProgressRows,
    estimateRemainingSeconds,
    formatEstimatedRemaining,
    BACKFILL_LINK_PAYMENTS_LABEL,
    BACKFILL_TAIL_STEPS,
    type EntityProgressPhase,
    type EntityProgressRow,
    type ProgressRateSample,
} from "@/shared/services/backfillImportProgress";
import type {
    ConnectorSyncStatePublic,
    SyncRunSummary,
} from "@/shared/services/billingConnectorService";
import { translateImportMessage } from "@/shared/utils/translateImportMessage";
import {
    accountCardSx,
    accountCardTitleSx,
    accountSectionIconSx,
} from "../accountCardStyles";

function phaseChipColor(
    phase: EntityProgressPhase
): "default" | "info" | "success" | "error" | "warning" {
    switch (phase) {
        case "running":
            return "info";
        case "done":
            return "success";
        case "failed":
            return "error";
        case "waiting":
        case "not_started":
        default:
            return "default";
    }
}

function phaseLabel(phase: EntityProgressPhase): string {
    switch (phase) {
        case "running":
            return "Running";
        case "done":
            return "Done";
        case "failed":
            return "Failed";
        case "waiting":
            return "Waiting";
        case "not_started":
            return "Not started";
        default:
            return phase;
    }
}

function formatCounts(row: EntityProgressRow, finished: boolean): string {
    const isLinkPayments =
        row.entity_type === BACKFILL_LINK_PAYMENTS_LABEL;
    const isTailStep = BACKFILL_TAIL_STEPS.some(
        (step) => step.label === row.entity_type
    );
    const unit = isLinkPayments
        ? "linked"
        : isTailStep
          ? "processed"
          : "imported";

    if (
        !finished &&
        isLinkPayments &&
        row.total_records != null &&
        row.phase === "running"
    ) {
        return `${row.records_pulled.toLocaleString()} / ${row.total_records.toLocaleString()} linked`;
    }

    if (finished && (row.success != null || row.failed != null)) {
        const parts: string[] = [];
        if (row.success != null) {
            parts.push(`${row.success.toLocaleString()} ${unit}`);
        }
        if ((row.failed ?? 0) > 0) {
            parts.push(`${(row.failed ?? 0).toLocaleString()} failed`);
        }
        if ((row.skipped ?? 0) > 0) {
            parts.push(
                isLinkPayments
                    ? `${(row.skipped ?? 0).toLocaleString()} still deferred`
                    : `${(row.skipped ?? 0).toLocaleString()} skipped`
            );
        }
        if (parts.length > 0) {
            return parts.join(" · ");
        }
    }

    if (row.total_records != null) {
        return `${row.records_pulled.toLocaleString()} / ${row.total_records.toLocaleString()}`;
    }

    if (row.records_pulled > 0) {
        return `${row.records_pulled.toLocaleString()} ${unit}`;
    }

    if (row.phase === "waiting" || row.phase === "not_started") {
        return "—";
    }

    return isLinkPayments ? "Linking…" : "0 imported";
}

function formatCountsWithEta(
    counts: string,
    eta: string | null | undefined
): string {
    return eta ? `${counts} · ${eta}` : counts;
}

interface BackfillImportProgressProps {
    run: SyncRunSummary | null;
    enabledEntities: ImportType[];
    syncStates: ConnectorSyncStatePublic[] | undefined;
    expanded: boolean;
    onExpandedChange: (expanded: boolean) => void;
    actions?: ReactNode;
}

export default function BackfillImportProgress({
    run,
    enabledEntities,
    syncStates,
    expanded,
    onExpandedChange,
    actions,
}: BackfillImportProgressProps) {
    const theme = useTheme();
    const { t } = useTranslation(["import"]);
    const pillRadiusPx = `${theme.appButton.sizeMedium.borderRadius}px`;

    const isRunning = run?.status === "RUNNING";
    const isStopping =
        run?.status === "TIMEOUT" &&
        run.error_type === "cancelled" &&
        !run.completed_at;
    const collapseLocked = isRunning || isStopping;
    const effectiveExpanded = collapseLocked || expanded;

    const rows = useMemo(() => {
        if (!run) {
            return [];
        }
        if (isRunning) {
            return buildRunningEntityProgressRows({
                enabledEntities,
                syncStates,
                entityStats: run.entity_stats,
                mepBreachStartDate:
                    run.cutover_options?.mep_breach_start_date,
            });
        }
        return buildFinishedEntityProgressRows({
            enabledEntities,
            syncStates,
            run,
        });
    }, [enabledEntities, isRunning, run, syncStates]);

    const rateSamplesRef = useRef<ProgressRateSample[]>([]);
    const trackedRunIdRef = useRef<string | null>(null);
    const [rateSamplesVersion, setRateSamplesVersion] = useState(0);

    useEffect(() => {
        const runId = run?.id ?? null;
        if (!isRunning || !runId) {
            rateSamplesRef.current = [];
            trackedRunIdRef.current = null;
            setRateSamplesVersion((value) => value + 1);
            return;
        }
        if (trackedRunIdRef.current !== runId) {
            trackedRunIdRef.current = runId;
            rateSamplesRef.current = [];
        }

        const linkRow = rows.find(
            (row) =>
                row.entity_type === BACKFILL_LINK_PAYMENTS_LABEL &&
                row.phase === "running"
        );
        if (!linkRow) {
            if (rateSamplesRef.current.length > 0) {
                rateSamplesRef.current = [];
                setRateSamplesVersion((value) => value + 1);
            }
            return;
        }

        const next = appendProgressRateSample(
            rateSamplesRef.current,
            linkRow.records_pulled,
            Date.now()
        );
        if (next !== rateSamplesRef.current) {
            rateSamplesRef.current = next;
            setRateSamplesVersion((value) => value + 1);
        }
    }, [isRunning, rows, run?.id]);

    const linkPaymentsEta = useMemo(() => {
        if (!isRunning) {
            return null;
        }
        const linkRow = rows.find(
            (row) => row.entity_type === BACKFILL_LINK_PAYMENTS_LABEL
        );
        if (!linkRow || linkRow.phase !== "running") {
            return null;
        }
        // Priority entity pulls have no total count — only Link payments does.
        return formatEstimatedRemaining(
            estimateRemainingSeconds({
                pulled: linkRow.records_pulled,
                total: linkRow.total_records,
                samples: rateSamplesRef.current,
            })
        );
    }, [isRunning, rows, rateSamplesVersion]);

    const header = useMemo(() => {
        if (!run) {
            return {
                title: "Backfill progress",
                subtitle:
                    "Run preview, start or resume backfill, or run incremental sync.",
            };
        }
        return buildBackfillProgressHeader({ run, rows });
    }, [run, rows]);

    const billingAccordionSx = {
        border: "1px solid",
        borderColor: "divider",
        borderRadius: pillRadiusPx,
        overflow: "hidden",
        bgcolor: "background.paper",
        "&:before": { display: "none" },
        "&:first-of-type, &:last-of-type, &:not(:first-of-type)": {
            borderRadius: pillRadiusPx,
        },
        "&.Mui-expanded": {
            margin: 0,
        },
    };
    const billingAccordionSummarySx = {
        bgcolor: "background.paper",
        px: 2,
        py: 0.75,
        minHeight: 48,
        borderTopLeftRadius: pillRadiusPx,
        borderTopRightRadius: pillRadiusPx,
        borderBottomLeftRadius: effectiveExpanded ? 0 : pillRadiusPx,
        borderBottomRightRadius: effectiveExpanded ? 0 : pillRadiusPx,
        cursor: collapseLocked ? "default" : undefined,
        ...(collapseLocked
            ? {
                  "& .MuiAccordionSummary-expandIconWrapper": {
                      display: "none",
                  },
              }
            : {}),
        "& .MuiAccordionSummary-content": {
            my: 0,
            alignItems: "center",
            gap: 1,
            "&.Mui-expanded": { my: 0 },
        },
        "&.Mui-expanded": {
            minHeight: 48,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
        },
    };
    const billingAccordionDetailsSx = {
        p: 0,
        bgcolor: "background.paper",
        borderBottomLeftRadius: pillRadiusPx,
        borderBottomRightRadius: pillRadiusPx,
    };
    const billingAccordionContentSx = {
        px: 2,
        py: 1.5,
        "&:last-child": { pb: 1.5 },
    };

    return (
        <Card elevation={0} sx={accountCardSx}>
            <Accordion
                disableGutters
                elevation={0}
                expanded={effectiveExpanded}
                onChange={(_, next) => {
                    if (collapseLocked) {
                        return;
                    }
                    onExpandedChange(next);
                }}
                sx={billingAccordionSx}
            >
                <AccordionSummary
                    expandIcon={
                        collapseLocked ? null : <ExpandMoreIcon />
                    }
                    sx={billingAccordionSummarySx}
                >
                    <SyncIcon sx={accountSectionIconSx} />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                            variant="subtitle1"
                            sx={accountCardTitleSx}
                        >
                            {header.title}
                        </Typography>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 0.25 }}
                        >
                            {header.subtitle}
                        </Typography>
                    </Box>
                </AccordionSummary>
                <AccordionDetails sx={billingAccordionDetailsSx}>
                    <CardContent sx={billingAccordionContentSx}>
                        {rows.length > 0 ? (
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 1.5,
                                    mb: actions ? 2 : 0,
                                }}
                            >
                                {rows.map((row) => {
                                    const showBar =
                                        row.phase === "running" ||
                                        (row.phase === "done" &&
                                            row.progress_percent != null) ||
                                        (row.phase === "failed" &&
                                            row.records_pulled > 0 &&
                                            Boolean(isRunning));

                                    return (
                                        <Box key={row.entity_type}>
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent:
                                                        "space-between",
                                                    gap: 1,
                                                    flexWrap: "wrap",
                                                    mb: 0.5,
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 1,
                                                        minWidth: 0,
                                                    }}
                                                >
                                                    <Typography
                                                        variant="body2"
                                                        fontWeight={600}
                                                    >
                                                        {row.entity_type}
                                                    </Typography>
                                                    <Chip
                                                        size="small"
                                                        label={phaseLabel(
                                                            row.phase
                                                        )}
                                                        color={phaseChipColor(
                                                            row.phase
                                                        )}
                                                        variant={
                                                            row.phase ===
                                                                "waiting" ||
                                                            row.phase ===
                                                                "not_started"
                                                                ? "outlined"
                                                                : "filled"
                                                        }
                                                    />
                                                </Box>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    {formatCountsWithEta(
                                                        formatCounts(
                                                            row,
                                                            !isRunning ||
                                                                row.phase ===
                                                                    "done" ||
                                                                row.phase ===
                                                                    "failed"
                                                        ),
                                                        row.entity_type ===
                                                            BACKFILL_LINK_PAYMENTS_LABEL
                                                            ? linkPaymentsEta
                                                            : null
                                                    )}
                                                </Typography>
                                            </Box>
                                            {showBar ? (
                                                <LinearProgress
                                                    variant={
                                                        row.progress_percent !=
                                                        null
                                                            ? "determinate"
                                                            : "indeterminate"
                                                    }
                                                    value={
                                                        row.progress_percent ??
                                                        0
                                                    }
                                                    color={
                                                        row.phase === "failed"
                                                            ? "error"
                                                            : row.phase ===
                                                                "done"
                                                              ? "success"
                                                              : "primary"
                                                    }
                                                />
                                            ) : null}
                                            {row.detail &&
                                            row.phase === "running" ? (
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    sx={{
                                                        display: "block",
                                                        mt: 0.5,
                                                    }}
                                                >
                                                    {row.detail}
                                                </Typography>
                                            ) : null}
                                            {row.last_error ? (
                                                <Typography
                                                    variant="caption"
                                                    color="error"
                                                    sx={{
                                                        display: "block",
                                                        mt: 0.5,
                                                    }}
                                                >
                                                    {translateImportMessage(
                                                        row.last_error,
                                                        t
                                                    )}
                                                </Typography>
                                            ) : null}
                                        </Box>
                                    );
                                })}
                            </Box>
                        ) : null}
                        {actions}
                    </CardContent>
                </AccordionDetails>
            </Accordion>
        </Card>
    );
}
