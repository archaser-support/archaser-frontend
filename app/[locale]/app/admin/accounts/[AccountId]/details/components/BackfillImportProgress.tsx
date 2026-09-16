"use client";

import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Card,
    CardContent,
    CircularProgress,
    Divider,
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
    buildSeedingEntityProgressRows,
    enrichPostIngestDrainProgressRow,
    estimateRemainingSeconds,
    formatEstimatedRemaining,
    isPlaceholderBackfillProgressRun,
    BACKFILL_DELETING_LABEL,
    BACKFILL_INVOICE_IMPORT_LABEL,
    BACKFILL_LINK_PAYMENTS_LABEL,
    BACKFILL_PAYMENT_IMPORT_LABEL,
    BACKFILL_TAIL_STEPS,
    getBackfillProgressStepTooltip,
    type BackfillProgressSessionPhase,
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
    return (
        row.entity_type === BACKFILL_INVOICE_IMPORT_LABEL ||
        row.entity_type === BACKFILL_PAYMENT_IMPORT_LABEL
    );
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
        const deleted = row.deleted ?? row.records_pulled ?? 0;
        return `${deleted.toLocaleString()} deleted`;
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
        // Link payments has prepare/link/close/recalc detail — same as AR tail.
        if (!finished && (isTailStep || isLinkPayments) && row.detail) {
            const detailHasCounts = /\d/.test(row.detail);
            return detailHasCounts ? row.detail : `${row.detail} · ${countLabel}`;
        }
        if (
            (finished || row.phase === "done") &&
            ((row.failed ?? 0) > 0 || (row.skipped ?? 0) > 0)
        ) {
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
     * Clear-before-import was requested on Start — show Record deletion in the
     * planned seeding list only. After bind, callers must pass false (D5).
     */
    expectDeletingStep?: boolean;
    /** Session phase — seeding paints planned zeros without a SyncRunSummary. */
    sessionPhase?: BackfillProgressSessionPhase | null;
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
    sessionPhase = null,
    pendingArPostIngestCustomers,
    expanded,
    onExpandedChange,
    actions,
}: BackfillImportProgressProps) {
    const theme = useTheme();
    const { t } = useTranslation(["import"]);
    const pillRadiusPx = `${theme.appButton.sizeMedium.borderRadius}px`;

    const isSeeding = sessionPhase === "seeding";
    const isDeferredDrain = sessionPhase === "deferred_drain";
    const isPlaceholderRun = isPlaceholderBackfillProgressRun(run);
    // Deferred drain binds a finished run — never paint full-pipeline Running (D7).
    const isRunning = Boolean(
        run?.status === "RUNNING" && !isPlaceholderRun && !isDeferredDrain
    );
    const showLiveProgress = isRunning || isDeferredDrain;
    const isStopping =
        run?.status === "TIMEOUT" &&
        run.error_type === "cancelled" &&
        !run.completed_at;
    const collapseLocked = showLiveProgress || isStopping || isSeeding;
    const effectiveExpanded = collapseLocked || expanded;

    const rows = useMemo(() => {
        if (isSeeding || isPlaceholderRun || !run) {
            if (isSeeding || expectDeletingStep) {
                return buildSeedingEntityProgressRows({
                    enabledEntities,
                    expectPurge: expectDeletingStep,
                });
            }
            return [];
        }
        const baseRows =
            isRunning && !isDeferredDrain
                ? buildRunningEntityProgressRows({
                      enabledEntities,
                      syncStates,
                      entityStats: run.entity_stats,
                      activeStep: run.active_step,
                      runStartedAt: run.started_at,
                      runId: run.id,
                      // D5 — never keep expect-purge after bind to a live run.
                      expectPurge: false,
                  })
                : buildFinishedEntityProgressRows({
                      enabledEntities,
                      syncStates,
                      run,
                      expectPurge: expectDeletingStep,
                  });
        return enrichPostIngestDrainProgressRow(
            baseRows,
            pendingArPostIngestCustomers,
            { forceDeferredDrain: isDeferredDrain }
        );
    }, [
        enabledEntities,
        expectDeletingStep,
        isDeferredDrain,
        isPlaceholderRun,
        isRunning,
        isSeeding,
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
        if (isSeeding) {
            return {
                title: "Backfill progress",
                subtitle: "Actions are disabled until this finishes",
            };
        }
        if (isDeferredDrain) {
            return {
                title: "Backfill progress",
                subtitle: "Finishing AR & insurance on worker",
            };
        }
        if (!run || isPlaceholderRun) {
            return {
                title: "Backfill progress",
                subtitle:
                    "Run preview, start or resume backfill, or run incremental sync.",
            };
        }
        return buildBackfillProgressHeader({ run, rows });
    }, [isDeferredDrain, isPlaceholderRun, isSeeding, run, rows]);

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
                                        "20px max-content minmax(0, 1fr)",
                                    columnGap: 1,
                                    rowGap: 1.5,
                                    alignItems: "start",
                                    mb: actions ? 2 : 0,
                                }}
                            >
                                {rows.map((row, index) => {
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
                                    const countsLabel = formatCountsWithEta(
                                        formatCounts(
                                            row,
                                            !showLiveProgress ||
                                                row.phase === "done" ||
                                                row.phase === "failed"
                                        ),
                                        row.entity_type ===
                                            BACKFILL_LINK_PAYMENTS_LABEL
                                            ? linkPaymentsEta
                                            : null
                                    );

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
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    alignItems: "flex-start",
                                                    gap: 0.5,
                                                    minWidth: 0,
                                                    width: "100%",
                                                }}
                                            >
                                                {showBar ||
                                                showIndeterminateBar ? (
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            width: "100%",
                                                            minHeight: 20,
                                                        }}
                                                    >
                                                        {showBar ? (
                                                            <LinearProgress
                                                                variant="determinate"
                                                                value={
                                                                    row.progress_percent ??
                                                                    0
                                                                }
                                                                color={
                                                                    row.phase ===
                                                                    "failed"
                                                                        ? "error"
                                                                        : row.phase ===
                                                                            "done"
                                                                          ? "success"
                                                                          : "primary"
                                                                }
                                                                sx={{
                                                                    width: "100%",
                                                                }}
                                                            />
                                                        ) : (
                                                            <LinearProgress
                                                                variant="indeterminate"
                                                                color="primary"
                                                                sx={{
                                                                    width: "100%",
                                                                }}
                                                            />
                                                        )}
                                                    </Box>
                                                ) : null}
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                    sx={{ textAlign: "start" }}
                                                >
                                                    {countsLabel}
                                                </Typography>
                                            </Box>
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
                                            {index < rows.length - 1 ? (
                                                <Divider
                                                    sx={{
                                                        gridColumn: "1 / -1",
                                                    }}
                                                />
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
