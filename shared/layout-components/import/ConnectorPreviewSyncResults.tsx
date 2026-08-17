"use client";

import {
    Cancel as CancelIcon,
    CheckCircle as CheckCircleIcon,
} from "@mui/icons-material";
import {
    Alert,
    Box,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Typography,
} from "@mui/material";
import { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import type { ImportType } from "@/types/db";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { getImportEntityFieldCatalog } from "@/shared/constants/importEntityFields";
import EndlessScrollDataGrid from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import type {
    PreviewSyncEntityResult,
    PreviewSyncResponse,
} from "@/shared/services/billingConnectorService";

function formatSampleCountLabel(count: number, capped: boolean): string {
    return `${count.toLocaleString()}${capped ? "+" : ""}`;
}

function buildPreviewColumns(
    importType: ImportType,
    sampleRows: Record<string, unknown>[]
): { columns: GridColDef[]; fieldKeys: string[] } {
    const catalog = getImportEntityFieldCatalog(importType);
    const catalogFields = catalog?.fields ? [...catalog.fields] : [];
    const extraKeys = new Set<string>();
    for (const row of sampleRows) {
        for (const key of Object.keys(row)) {
            if (
                key !== "id" &&
                key !== "message" &&
                key !== "status" &&
                !catalogFields.includes(key)
            ) {
                extraKeys.add(key);
            }
        }
    }
    const fieldKeys = [...catalogFields, ...Array.from(extraKeys).sort()];

    const messageColumn: GridColDef = {
        field: "message",
        headerName: "Message",
        flex: 2,
        minWidth: 180,
        maxWidth: 320,
        sortable: false,
        renderCell: (params: GridRenderCellParams) => {
            const message = String(params.row?.message ?? "-");
            const failed =
                params.row?.status === "Validation Failed" ||
                (message !== "-" &&
                    message.includes("required") &&
                    message.includes("missing"));
            return (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        width: "100%",
                        overflow: "hidden",
                    }}
                >
                    {failed ? (
                        <CancelIcon
                            color="error"
                            sx={{ fontSize: "1rem", flexShrink: 0 }}
                        />
                    ) : (
                        <CheckCircleIcon
                            color="success"
                            sx={{ fontSize: "1rem", flexShrink: 0 }}
                        />
                    )}
                    <Typography
                        variant="body2"
                        noWrap
                        title={message}
                        sx={{ flex: 1, minWidth: 0 }}
                    >
                        {message}
                    </Typography>
                </Box>
            );
        },
    };

    const dataColumns: GridColDef[] = fieldKeys.map((field) => ({
        field,
        headerName: field.replace(/_/g, " "),
        flex: 1,
        minWidth: 120,
        maxWidth: 250,
        sortable: false,
        renderCell: (params: GridRenderCellParams) => {
            const value = params.value;
            return (
                <Typography variant="body2" noWrap title={String(value ?? "")}>
                    {value !== null && value !== undefined && value !== ""
                        ? String(value)
                        : "-"}
                </Typography>
            );
        },
    }));

    return { columns: [messageColumn, ...dataColumns], fieldKeys };
}

interface ConnectorPreviewSyncResultsProps {
    /** Full multi-entity preview (legacy / run-all). Prefer `entity` for per-tab UI. */
    previewResult?: PreviewSyncResponse;
    /** Single entity sample result for Mapping|Preview tabs. */
    entity?: PreviewSyncEntityResult;
    /** Optional go/no-go from the last run that produced `entity`. */
    goNoGo?: PreviewSyncResponse["go_no_go"];
    cutoverSummary?: string | null;
}

export default function ConnectorPreviewSyncResults({
    previewResult,
    entity: entityProp,
    goNoGo,
    cutoverSummary,
}: ConnectorPreviewSyncResultsProps) {
    const { i18n } = useTranslation();

    const entity =
        entityProp ??
        (previewResult?.entities.length === 1
            ? previewResult.entities[0]
            : undefined);
    const checks = goNoGo?.checks ?? previewResult?.go_no_go.checks;
    const passed =
        goNoGo?.passed ??
        previewResult?.go_no_go.passed ??
        (entity
            ? entity.validation_errors.length === 0 &&
              entity.sample_rows.length > 0
            : undefined);
    const requiredErrors =
        goNoGo?.required_field_errors ??
        previewResult?.go_no_go.required_field_errors ??
        entity?.validation_errors.length ??
        0;
    const summary =
        cutoverSummary ?? previewResult?.cutover_summary ?? null;

    const { columns, rows } = useMemo(() => {
        if (!entity) {
            return { columns: [] as GridColDef[], rows: [] };
        }
        const { columns: gridColumns } = buildPreviewColumns(
            entity.import_type,
            entity.sample_rows
        );
        const gridRows = entity.sample_rows.map((row, index) => ({
            id: `${entity.import_type}-${index}`,
            ...row,
        }));
        return { columns: gridColumns, rows: gridRows };
    }, [entity]);

    if (!entity) {
        return (
            <Alert severity="info">
                Preview returned no entity results. Enable at least one entity
                and try again.
            </Alert>
        );
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {passed !== undefined && (
                <Alert severity={passed ? "success" : "warning"}>
                    Go/no-go: {passed ? "passed" : "needs attention"} (
                    {requiredErrors} required-field error(s);{" "}
                    {formatSampleCountLabel(
                        entity.sample_rows.length,
                        Boolean(entity.match_count_capped)
                    )}{" "}
                    sample row
                    {entity.sample_rows.length === 1 ? "" : "s"})
                    {summary ? ` — ${summary}` : ""}
                </Alert>
            )}

            {checks && checks.length > 0 && (
                <List dense>
                    {checks.map((check) => (
                        <ListItem key={check.id}>
                            <ListItemIcon sx={{ minWidth: 36 }}>
                                {check.passed ? (
                                    <CheckCircleIcon
                                        color="success"
                                        fontSize="small"
                                    />
                                ) : (
                                    <CancelIcon color="error" fontSize="small" />
                                )}
                            </ListItemIcon>
                            <ListItemText
                                primary={check.label}
                                secondary={check.detail}
                            />
                        </ListItem>
                    ))}
                </List>
            )}

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                    {formatSampleCountLabel(
                        entity.sample_rows.length,
                        Boolean(entity.match_count_capped)
                    )}{" "}
                    sample row
                    {entity.sample_rows.length === 1 ? "" : "s"} pulled (full
                    match count skipped)
                </Typography>
                {entity.effective_filter ? (
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                            fontFamily: "monospace",
                            whiteSpace: "pre-wrap",
                        }}
                    >
                        Effective filter: {entity.effective_filter}
                    </Typography>
                ) : null}
                {entity.validation_errors.length > 0 && (
                    <Alert severity="error">
                        {entity.validation_errors.join("; ")}
                    </Alert>
                )}
                <Box
                    sx={{
                        width: "100%",
                        bgcolor: "background.paper",
                        borderRadius: 2,
                        overflow: "hidden",
                    }}
                >
                    <EndlessScrollDataGrid
                        rows={rows}
                        columns={columns}
                        totalRecords={rows.length}
                        isLoading={false}
                        onLoadMore={() => {}}
                        hasMore={false}
                        hideToolbar
                        resizableColumns
                        visibleRows={Math.min(Math.max(rows.length, 1), 8)}
                        language={i18n.language}
                        noRowsMessage="No preview rows"
                        noRowsDescription="Preview returned no sample rows for this entity."
                    />
                </Box>
            </Box>
        </Box>
    );
}
