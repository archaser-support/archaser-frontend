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

function isScannedImportedCountRow(row: EntityProgressRow): boolean {
    return (
        row.entity_type === "Customer" ||
        row.entity_type === "Contact" ||
        row.entity_type === "Policy" ||
        row.entity_type === BACKFILL_INVOICE_IMPORT_LABEL ||
        row.entity_type === BACKFILL_PAYMENT_IMPORT_LABEL
    );
}

function formatScannedImportedCounts(row: EntityProgressRow): string {
    const parts = [
        `Scanned: ${row.records_pulled.toLocaleString()}`,
        `Imported ${(row.success ?? 0).toLocaleString()}`,
    ];
    if ((row.failed ?? 0) > 0) {
        parts.push(`Failed ${(row.failed ?? 0).toLocaleString()}`);
    }
    if ((row.skipped ?? 0) > 0) {
        parts.push(`Skipped ${(row.skipped ?? 0).toLocaleString()}`);
    }
    if ((row.deleted ?? 0) > 0) {
        parts.push(`Deleted ${row.deleted.toLocaleString()}`);
    }
    return parts.join(" | ");
}

function formatCountExtras(
    row: EntityProgressRow,
    isLinkPayments: boolean,
    includeDeleted: boolean
): string[] {
    const parts: string[] = [];
    if ((row.failed ?? 0) > 0) {
        parts.push(`Failed ${(row.failed ?? 0).toLocaleString()}`);
    }
    if ((row.skipped ?? 0) > 0) {
        parts.push(
            isLinkPayments
                ? `Still deferred ${(row.skipped ?? 0).toLocaleString()}`
                : `Skipped ${(row.skipped ?? 0).toLocaleString()}`
        );
    }
    if (includeDeleted && (row.deleted ?? 0) > 0) {
        parts.push(`Deleted ${row.deleted.toLocaleString()}`);
    }
    return parts;
}

function formatUnitTotalCounts(
    unitLabel: string,
    current: number,
    total: number | null,
    extras: string[]
): string {
    const parts = [`${unitLabel}: ${current.toLocaleString()}`];
    if (total != null) {
        parts.push(`Total ${total.toLocaleString()}`);
    }
    return [...parts, ...extras].join(" | ");
}

function formatCounts(row: EntityProgressRow, finished: boolean): string {
    const isLinkPayments =
        row.entity_type === BACKFILL_LINK_PAYMENTS_LABEL;
    const isDeleting = row.entity_type === BACKFILL_DELETING_LABEL;
    const isTailStep = BACKFILL_TAIL_STEPS.some(
        (step) => step.label === row.entity_type
    );
    const unitLabel = isLinkPayments
        ? "Linked"
        : isDeleting
          ? "Deleted"
          : isTailStep
            ? "Processed"
            : "Imported";

    if (row.phase === "queued") {
        return row.detail ?? "Queued";
    }

    if (row.phase === "waiting" || row.phase === "not_started") {
        return "—";
    }

    if (isDeleting) {
        if (row.detail) {
            return row.detail;
        }
        return formatUnitTotalCounts(
            unitLabel,
            row.deleted ?? row.records_pulled ?? 0,
            row.total_records,
            formatCountExtras(row, false, false)
        );
    }

    // Customer/Contact/Invoice/Payment/Policy: scanned (ERP rows) | imported (DB writes).
    if (isScannedImportedCountRow(row)) {
        return formatScannedImportedCounts(row);
    }

    const extras = formatCountExtras(row, isLinkPayments, true);
    const current =
        finished && row.success != null ? row.success : row.records_pulled;
    const countLabel = formatUnitTotalCounts(
        unitLabel,
        current,
        row.total_records,
        extras
    );

    if (!finished && (isTailStep || isLinkPayments) && row.detail) {
        const detailHasCounts = /\d/.test(row.detail);
        return detailHasCounts ? row.detail : `${row.detail} | ${countLabel}`;
    }

    return countLabel;
}

function formatCountsWithEta(
    counts: string,
    eta: string | null | undefined
): string {
    return eta ? `${counts} | ${eta}` : counts;
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
            // Idle / cleared / seeding: still show planned entity steps so the
            // expanded accordion is not an empty shell after Reset.
            if (
                isSeeding ||
                expectDeletingStep ||
                enabledEntities.length > 0
            ) {
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
                slotProps={{
                    transition: { unmountOnExit: true },
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
                                    const isRunningStep =
                                        row.phase === "running" &&
                                        Boolean(showLiveProgress);
                                    // Entity pulls have no ERP total (and Invoice/Payment
                                    // % is imported/scanned, not remaining work).
                                    const hasTrueTotal =
                                        row.total_records != null &&
                                        !isScannedImportedCountRow(row);
                                    const showBar =
                                        isRunningStep &&
                                        hasTrueTotal &&
                                        row.progress_percent != null;
                                    const showIndeterminateBar =
                                        isRunningStep && !showBar;
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
                                                                color="primary"
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
