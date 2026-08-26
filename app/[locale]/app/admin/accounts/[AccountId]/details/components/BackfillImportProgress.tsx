"use client";

import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    LinearProgress,
    Typography,
} from "@mui/material";
import type { ImportType } from "@/types/db";
import { useMemo } from "react";

import {
    buildBackfillProgressHeader,
    buildFinishedEntityProgressRows,
    buildRunningEntityProgressRows,
    type EntityProgressPhase,
    type EntityProgressRow,
} from "@/shared/services/backfillImportProgress";
import type {
    ConnectorSyncStatePublic,
    SyncRunSummary,
} from "@/shared/services/billingConnectorService";

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
    if (finished && (row.success != null || row.failed != null)) {
        const parts: string[] = [];
        if (row.success != null) {
            parts.push(`${row.success.toLocaleString()} imported`);
        }
        if ((row.failed ?? 0) > 0) {
            parts.push(`${(row.failed ?? 0).toLocaleString()} failed`);
        }
        if ((row.skipped ?? 0) > 0) {
            parts.push(`${(row.skipped ?? 0).toLocaleString()} skipped`);
        }
        if (parts.length > 0) {
            return parts.join(" · ");
        }
    }

    if (row.total_records != null) {
        return `${row.records_pulled.toLocaleString()} / ${row.total_records.toLocaleString()}`;
    }

    if (row.records_pulled > 0) {
        return `${row.records_pulled.toLocaleString()} imported`;
    }

    if (row.phase === "waiting" || row.phase === "not_started") {
        return "—";
    }

    return "0 imported";
}

interface BackfillImportProgressProps {
    run: SyncRunSummary;
    enabledEntities: ImportType[];
    syncStates: ConnectorSyncStatePublic[] | undefined;
    onDismiss: () => void;
    onStop?: () => void;
    stopPending?: boolean;
}

export default function BackfillImportProgress({
    run,
    enabledEntities,
    syncStates,
    onDismiss,
    onStop,
    stopPending = false,
}: BackfillImportProgressProps) {
    const isRunning = run.status === "RUNNING";
    const isStopping =
        run.status === "TIMEOUT" &&
        run.error_type === "cancelled" &&
        !run.completed_at;

    const rows = useMemo(() => {
        if (isRunning) {
            return buildRunningEntityProgressRows({
                enabledEntities,
                syncStates,
                entityStats: run.entity_stats,
            });
        }
        return buildFinishedEntityProgressRows({
            enabledEntities,
            syncStates,
            run,
        });
    }, [enabledEntities, isRunning, run, syncStates]);

    const header = useMemo(
        () => buildBackfillProgressHeader({ run, rows }),
        [run, rows]
    );

    return (
        <Card
            elevation={0}
            sx={{
                bgcolor: "background.paper",
                border: 1,
                borderColor: "divider",
                borderRadius: 2,
                boxShadow: "none",
            }}
        >
            <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 2,
                        flexWrap: "wrap",
                        mb: 2,
                    }}
                >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                            sx={{
                                fontSize: 16,
                                fontWeight: 600,
                                lineHeight: 1.35,
                            }}
                        >
                            {header.title}
                        </Typography>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 0.5 }}
                        >
                            {header.subtitle}
                        </Typography>
                    </Box>
                    <Box
                        sx={{
                            display: "flex",
                            gap: 1,
                            flexShrink: 0,
                        }}
                    >
                        {isRunning && onStop ? (
                            <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                onClick={onStop}
                                disabled={stopPending}
                                startIcon={
                                    stopPending ? (
                                        <CircularProgress
                                            size={14}
                                            color="inherit"
                                        />
                                    ) : undefined
                                }
                            >
                                {stopPending ? "Stopping…" : "Stop import"}
                            </Button>
                        ) : isStopping ? (
                            <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                disabled
                                startIcon={
                                    <CircularProgress
                                        size={14}
                                        color="inherit"
                                    />
                                }
                            >
                                Stopping…
                            </Button>
                        ) : null}
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={onDismiss}
                            disabled={isRunning || isStopping || stopPending}
                        >
                            Close
                        </Button>
                    </Box>
                </Box>

                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 1.5,
                    }}
                >
                    {rows.map((row) => {
                        const showBar =
                            row.phase === "running" ||
                            (row.phase === "done" &&
                                row.progress_percent != null) ||
                            (row.phase === "failed" &&
                                row.records_pulled > 0 &&
                                isRunning);

                        return (
                            <Box key={row.entity_type}>
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
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
                                            label={phaseLabel(row.phase)}
                                            color={phaseChipColor(row.phase)}
                                            variant={
                                                row.phase === "waiting" ||
                                                row.phase === "not_started"
                                                    ? "outlined"
                                                    : "filled"
                                            }
                                        />
                                    </Box>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        {formatCounts(
                                            row,
                                            !isRunning ||
                                                row.phase === "done" ||
                                                row.phase === "failed"
                                        )}
                                    </Typography>
                                </Box>
                                {showBar ? (
                                    <LinearProgress
                                        variant={
                                            row.progress_percent != null
                                                ? "determinate"
                                                : "indeterminate"
                                        }
                                        value={row.progress_percent ?? 0}
                                        color={
                                            row.phase === "failed"
                                                ? "error"
                                                : row.phase === "done"
                                                  ? "success"
                                                  : "primary"
                                        }
                                    />
                                ) : null}
                                {row.last_error ? (
                                    <Typography
                                        variant="caption"
                                        color="error"
                                        sx={{ display: "block", mt: 0.5 }}
                                    >
                                        {row.last_error}
                                    </Typography>
                                ) : null}
                            </Box>
                        );
                    })}
                </Box>
            </CardContent>
        </Card>
    );
}
