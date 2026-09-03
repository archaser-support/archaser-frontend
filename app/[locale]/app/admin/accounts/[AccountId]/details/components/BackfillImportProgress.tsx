"use client";

import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Card,
    CardContent,
    CircularProgress,
    LinearProgress,
    Tooltip,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
    CheckCircle as CheckCircleIcon,
    ErrorOutline as ErrorOutlineIcon,
    ExpandMore as ExpandMoreIcon,
    HourglassEmpty as HourglassEmptyIcon,
    InfoOutlined as InfoOutlinedIcon,
    Sync as SyncIcon,
} from "@mui/icons-material";
import type { ImportType } from "@/types/db";
import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { useTranslation } from "react-i18next";

import {
    appendProgressRateSample,
    buildBackfillProgressHeader,
    buildFinishedEntityProgressRows,
    buildRunningEntityProgressRows,
    enrichPostIngestDrainProgressRow,
    estimateRemainingSeconds,
    formatEstimatedRemaining,
    BACKFILL_DELETING_LABEL,
    BACKFILL_LINK_PAYMENTS_LABEL,
    BACKFILL_TAIL_STEPS,
    getBackfillProgressStepTooltip,
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
import { getBillingAccordionStyles } from "./billingAccordionStyles";

function phaseLabel(phase: EntityProgressPhase): string {
    switch (phase) {
        case "running":
            return "Running";
        case "queued":
            return "Queued";
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

function PhaseStatusIcon({ phase }: { phase: EntityProgressPhase }) {
    const iconSx = { fontSize: "1.125rem", flexShrink: 0 };

    let icon: ReactNode;
    switch (phase) {
        case "done":
            icon = <CheckCircleIcon color="success" sx={iconSx} />;
            break;
        case "running":
            icon = (
                <CircularProgress
                    size={16}
                    color="primary"
                    sx={{ flexShrink: 0 }}
                />
            );
            break;
        case "queued":
            icon = (
                <HourglassEmptyIcon color="primary" sx={iconSx} />
            );
            break;
        case "failed":
            icon = <ErrorOutlineIcon color="error" sx={iconSx} />;
            break;
        case "waiting":
        case "not_started":
        default:
            icon = (
                <HourglassEmptyIcon sx={{ ...iconSx, color: "text.disabled" }} />
            );
            break;
    }

    return (
        <Tooltip
            title={phaseLabel(phase)}
            arrow
            enterDelay={300}
            leaveDelay={100}
            placement="bottom"
        >
            <Box
                component="span"
                sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 20,
                    height: 20,
                    flexShrink: 0,
                }}
            >
                {icon}
            </Box>
        </Tooltip>
    );
}

function isInvoiceOrPaymentRow(row: EntityProgressRow): boolean {
    return row.entity_type === "Invoice" || row.entity_type === "Payment";
}

function formatFailedSkippedSuffix(
    row: EntityProgressRow,
    isLinkPayments: boolean
): string[] {
    const parts: string[] = [];
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
    return parts;
}

function formatCounts(row: EntityProgressRow, finished: boolean): string {
    const isLinkPayments =
        row.entity_type === BACKFILL_LINK_PAYMENTS_LABEL;
    const isDeleting = row.entity_type === BACKFILL_DELETING_LABEL;
    const isTailStep = BACKFILL_TAIL_STEPS.some(
        (step) => step.label === row.entity_type
    );
    const unit = isLinkPayments
        ? "linked"
        : isDeleting
          ? "deleted"
          : isTailStep
            ? "processed"
            : "imported";

    if (row.phase === "queued") {
        return row.detail ?? "Queued";
    }

    if (row.phase === "waiting" || row.phase === "not_started") {
        return "—";
    }

    if (isDeleting) {
        if (row.total_records != null) {
            return `${row.records_pulled.toLocaleString()} / ${row.total_records.toLocaleString()} deleted`;
        }
        if (row.detail) {
            return row.detail;
        }
        if ((row.deleted ?? row.records_pulled) > 0) {
            return `${(row.deleted ?? row.records_pulled).toLocaleString()} deleted`;
        }
        return row.phase === "running" ? "Deleting…" : "0 deleted";
    }

    // Invoice/Payment: imported (DB writes) / pulled (ERP rows). First number matters.
    if (isInvoiceOrPaymentRow(row)) {
        const imported = row.success ?? 0;
        const pulled = row.records_pulled;
        const parts = [
            `${imported.toLocaleString()} / ${pulled.toLocaleString()} imported`,
        ];
        if (row.deleted != null && row.deleted > 0) {
            parts.unshift(`${row.deleted.toLocaleString()} deleted`);
        }
        parts.push(...formatFailedSkippedSuffix(row, false));
        return parts.join(" · ");
    }

    // Prefer N/M whenever a total is known (Link payments, purge, AR tail, etc.).
    if (row.total_records != null) {
        const countLabel = `${row.records_pulled.toLocaleString()} / ${row.total_records.toLocaleString()} ${unit}`;
        if (!finished && isTailStep && row.detail) {
            // Keep the richer sub-step label, but always include the counter.
            const detailHasCounts = /\d/.test(row.detail);
            return detailHasCounts ? row.detail : `${row.detail} · ${countLabel}`;
        }
        if (finished && ((row.failed ?? 0) > 0 || (row.skipped ?? 0) > 0)) {
            return [countLabel, ...formatFailedSkippedSuffix(row, isLinkPayments)].join(
                " · "
            );
        }
        return countLabel;
    }

    if (finished && (row.success != null || row.failed != null)) {
        const parts: string[] = [];
        if (row.deleted != null && row.deleted > 0) {
            parts.push(`${row.deleted.toLocaleString()} deleted`);
        }
        const successCount = row.success ?? row.records_pulled;
        parts.push(`${successCount.toLocaleString()} ${unit}`);
        parts.push(...formatFailedSkippedSuffix(row, isLinkPayments));
        return parts.join(" · ");
    }

    // Priority entity pulls have no ERP total — show the live pulled count.
    return `${row.records_pulled.toLocaleString()} ${unit}`;
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
    /**
     * Start requested clear-before-import — show Deleting… before the first
     * purge progress patch arrives (avoids the list jumping a second later).
     */
    expectDeletingStep?: boolean;
    /** Customers still on the worker AR post-ingest queue (connector config). */
    pendingArPostIngestCustomers?: number;
    expanded: boolean;
    onExpandedChange: (expanded: boolean) => void;
    actions?: ReactNode;
}

export default function BackfillImportProgress({
    run,
    enabledEntities,
    syncStates,
    expectDeletingStep = false,
    pendingArPostIngestCustomers,
    expanded,
    onExpandedChange,
    actions,
}: BackfillImportProgressProps) {
    const theme = useTheme();
    const { t } = useTranslation(["import"]);
    const pillRadiusPx = `${theme.appButton.sizeMedium.borderRadius}px`;

    const isRunning = run?.status === "RUNNING";
    const deferredDrainInProgress = (pendingArPostIngestCustomers ?? 0) > 0;
    const showLiveProgress = isRunning || deferredDrainInProgress;
    const isStopping =
        run?.status === "TIMEOUT" &&
        run.error_type === "cancelled" &&
        !run.completed_at;
    const collapseLocked = showLiveProgress || isStopping;
    const effectiveExpanded = collapseLocked || expanded;

    const rows = useMemo(() => {
        if (!run) {
            return [];
        }
        const baseRows = isRunning
            ? buildRunningEntityProgressRows({
                  enabledEntities,
                  syncStates,
                  entityStats: run.entity_stats,
                  activeStep: run.active_step,
                  runStartedAt: run.started_at,
                  runId: run.id,
                  expectPurge: expectDeletingStep,
              })
            : buildFinishedEntityProgressRows({
                  enabledEntities,
                  syncStates,
                  run,
              });
        return enrichPostIngestDrainProgressRow(
            baseRows,
            pendingArPostIngestCustomers
        );
    }, [
        enabledEntities,
        expectDeletingStep,
        isRunning,
        pendingArPostIngestCustomers,
        run,
        syncStates,
    ]);

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

    const {
        accordionSx: billingAccordionSx,
        summarySx: billingAccordionSummarySx,
        detailsSx: billingAccordionDetailsSx,
        contentSx: billingAccordionContentSx,
    } = getBillingAccordionStyles(pillRadiusPx);

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
                    sx={billingAccordionSummarySx(effectiveExpanded, {
                        collapseLocked,
                    })}
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
                                    display: "grid",
                                    gridTemplateColumns:
                                        "20px max-content minmax(0, 1fr) max-content",
                                    columnGap: 1,
                                    rowGap: 1.5,
                                    alignItems: "center",
                                    mb: actions ? 2 : 0,
                                }}
                            >
                                {rows.map((row) => {
                                    const showBar =
                                        row.progress_percent != null &&
                                        (row.phase === "running" ||
                                            row.phase === "done" ||
                                            (row.phase === "failed" &&
                                                row.records_pulled > 0 &&
                                                Boolean(showLiveProgress)));
                                    // Indeterminate only while a step is active and we
                                    // still have no total and no pulled count yet
                                    // (e.g. first ERP page). Once counts exist, show
                                    // the number — Priority pulls have no ERP total %.
                                    const showIndeterminateBar =
                                        (row.phase === "running" ||
                                            row.phase === "queued") &&
                                        row.progress_percent == null &&
                                        row.records_pulled <= 0 &&
                                        Boolean(showLiveProgress);

                                    return (
                                        <Fragment key={row.entity_type}>
                                            <PhaseStatusIcon
                                                phase={row.phase}
                                            />
                                            <Box
                                                sx={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: 0.5,
                                                }}
                                            >
                                                <Typography
                                                    variant="body2"
                                                    fontWeight={600}
                                                >
                                                    {row.entity_type}
                                                </Typography>
                                                <Tooltip
                                                    title={getBackfillProgressStepTooltip(
                                                        row.entity_type
                                                    )}
                                                    arrow
                                                    enterDelay={300}
                                                    leaveDelay={100}
                                                    placement="bottom"
                                                >
                                                    <Box
                                                        component="span"
                                                        sx={{
                                                            display:
                                                                "inline-flex",
                                                            alignItems:
                                                                "center",
                                                            color: "action.active",
                                                            cursor: "help",
                                                        }}
                                                        aria-label={`About ${row.entity_type} step`}
                                                    >
                                                        <InfoOutlinedIcon
                                                            sx={{
                                                                fontSize: 16,
                                                            }}
                                                        />
                                                    </Box>
                                                </Tooltip>
                                            </Box>
                                            {showBar ? (
                                                <LinearProgress
                                                    variant="determinate"
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
                                                    sx={{ width: "100%" }}
                                                />
                                            ) : showIndeterminateBar ? (
                                                <LinearProgress
                                                    variant="indeterminate"
                                                    color="primary"
                                                    sx={{ width: "100%" }}
                                                />
                                            ) : (
                                                <Box />
                                            )}
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                                sx={{ justifySelf: "end" }}
                                            >
                                                {formatCountsWithEta(
                                                    formatCounts(
                                                        row,
                                                        !showLiveProgress ||
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
                                            {row.last_error ? (
                                                <Typography
                                                    variant="caption"
                                                    color="error"
                                                    sx={{
                                                        gridColumn: "1 / -1",
                                                    }}
                                                >
                                                    {translateImportMessage(
                                                        row.last_error,
                                                        t
                                                    )}
                                                </Typography>
                                            ) : null}
                                        </Fragment>
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
