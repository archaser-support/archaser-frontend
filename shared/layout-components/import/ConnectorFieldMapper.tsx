"use client";

import {
    Autocomplete,
    Box,
    Button,
    Chip,
    CircularProgress,
    MenuItem,
    Select,
    TextField,
    Typography,
} from "@mui/material";
import { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import type { ImportType } from "@/types/db";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
    CONNECTOR_FIELD_TRANSFORMS,
    buildDefaultConnectorMappingRules,
    getImportEntityFieldCatalog,
} from "@/shared/constants/importEntityFields";
import type { MappingRule } from "@/shared/constants/importEntityFields";
import EndlessScrollDataGrid from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import {
    discoverBillingConnectorFields,
    fetchBillingConnectorMapping,
    saveBillingConnectorMapping,
} from "@/shared/services/billingConnectorService";

interface MappingGridRow {
    id: string;
    archaserField: string;
    erpField: string;
    transform: string;
    sample: string;
    isRequired: boolean;
    isHighlighted: boolean;
}

interface ConnectorFieldMapperProps {
    accountId: number;
    importType: ImportType;
    canManage: boolean;
    onCompletenessChange?: (importType: ImportType, isComplete: boolean) => void;
    hideEntityHeader?: boolean;
}

export default function ConnectorFieldMapper({
    accountId,
    importType,
    canManage,
    onCompletenessChange,
    hideEntityHeader = false,
}: ConnectorFieldMapperProps) {
    const { i18n } = useTranslation();
    const { success, error: showError } = useToast();
    const catalog = useMemo(
        () => getImportEntityFieldCatalog(importType),
        [importType]
    );

    const [rules, setRules] = useState<MappingRule[]>([]);
    const [rawHeaders, setRawHeaders] = useState<string[]>([]);
    const [exampleValues, setExampleValues] = useState<Record<string, unknown>>(
        {}
    );
    const [isComplete, setIsComplete] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDiscovering, setIsDiscovering] = useState(false);

    const highlighted = useMemo(
        () => new Set(catalog?.highlightedFields ?? []),
        [catalog]
    );
    const required = useMemo(
        () => new Set(catalog?.requiredFields ?? []),
        [catalog]
    );

    const onCompletenessChangeRef = useRef(onCompletenessChange);
    onCompletenessChangeRef.current = onCompletenessChange;

    const loadMapping = useCallback(async () => {
        setIsLoading(true);
        try {
            const mapping = await fetchBillingConnectorMapping(
                accountId,
                importType
            );
            const loaded = mapping?.mapping ?? [];
            const nextRules =
                loaded.length > 0
                    ? loaded
                    : buildDefaultConnectorMappingRules(importType);
            setRules(nextRules);
            setIsComplete(Boolean(mapping?.is_complete));
            onCompletenessChangeRef.current?.(
                importType,
                Boolean(mapping?.is_complete)
            );
        } catch (err: unknown) {
            showError(extractErrorMessage(err) ?? "Failed to load mapping");
            setRules(buildDefaultConnectorMappingRules(importType));
        } finally {
            setIsLoading(false);
        }
    }, [accountId, importType, showError]);

    useEffect(() => {
        void loadMapping();
    }, [loadMapping]);

    const updateRule = useCallback(
        (archaserField: string, patch: Partial<MappingRule>) => {
            setRules((prev) => {
                const existing = prev.find(
                    (rule) => rule.archaserField === archaserField
                );
                if (!existing) {
                    return [
                        ...prev,
                        {
                            archaserField,
                            erpField: patch.erpField ?? "",
                            transform: patch.transform,
                        },
                    ];
                }
                return prev.map((rule) =>
                    rule.archaserField === archaserField
                        ? { ...rule, ...patch }
                        : rule
                );
            });
        },
        []
    );

    const handleDiscover = async () => {
        setIsDiscovering(true);
        try {
            const discovered = await discoverBillingConnectorFields(
                accountId,
                importType
            );
            setRawHeaders(discovered.raw_headers);
            setExampleValues(discovered.example_values);

            setRules((prev) => {
                const byField = new Map(
                    prev.map((rule) => [rule.archaserField, rule])
                );
                const next: MappingRule[] = [];
                for (const field of catalog?.fields ?? []) {
                    const existing = byField.get(field);
                    if (existing?.erpField) {
                        next.push(existing);
                        continue;
                    }
                    const suggested = discovered.raw_headers.find(
                        (header) =>
                            header.toLowerCase() === field.toLowerCase() ||
                            header.toLowerCase().endsWith(`.${field.toLowerCase()}`)
                    );
                    if (suggested) {
                        next.push({ archaserField: field, erpField: suggested });
                    }
                }
                return next.length > 0 ? next : prev;
            });
            success("Fields discovered from Priority");
        } catch (err: unknown) {
            showError(extractErrorMessage(err) ?? "Failed to discover fields");
        } finally {
            setIsDiscovering(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const saved = await saveBillingConnectorMapping(
                accountId,
                importType,
                rules.filter((rule) => rule.erpField.trim())
            );
            setRules(saved.mapping);
            setIsComplete(saved.is_complete);
            onCompletenessChange?.(importType, saved.is_complete);
            success(`${importType} mapping saved`);
        } catch (err: unknown) {
            showError(extractErrorMessage(err) ?? "Failed to save mapping");
        } finally {
            setIsSaving(false);
        }
    };

    const gridRows = useMemo<MappingGridRow[]>(() => {
        if (!catalog) {
            return [];
        }
        return catalog.fields.map((archaserField) => {
            const rule = rules.find((item) => item.archaserField === archaserField);
            const erpField = rule?.erpField ?? "";
            return {
                id: archaserField,
                archaserField,
                erpField,
                transform: rule?.transform ?? "",
                sample:
                    erpField && exampleValues[erpField] !== undefined
                        ? String(exampleValues[erpField])
                        : "",
                isRequired: required.has(archaserField),
                isHighlighted: highlighted.has(archaserField),
            };
        });
    }, [catalog, rules, exampleValues, required, highlighted]);

    const columns = useMemo<GridColDef[]>(
        () => [
            {
                field: "archaserField",
                headerName: "Archaser field",
                flex: 1,
                minWidth: 180,
                sortable: false,
                renderCell: (params: GridRenderCellParams<MappingGridRow>) => (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            width: "100%",
                        }}
                    >
                        <Typography variant="body2">
                            {params.row.archaserField}
                        </Typography>
                        {params.row.isRequired && (
                            <Chip
                                size="small"
                                label="Required"
                                color={
                                    params.row.isHighlighted
                                        ? "primary"
                                        : "default"
                                }
                            />
                        )}
                    </Box>
                ),
            },
            {
                field: "erpField",
                headerName: "Priority field (dot path)",
                flex: 1.2,
                minWidth: 220,
                sortable: false,
                renderCell: (params: GridRenderCellParams<MappingGridRow>) => (
                    <Box
                        data-interactive="true"
                        onClick={(e) => e.stopPropagation()}
                        sx={{ width: "100%", pr: 0.5 }}
                    >
                        <Autocomplete
                            size="small"
                            freeSolo
                            options={rawHeaders}
                            value={params.row.erpField}
                            onChange={(_, value) =>
                                updateRule(params.row.archaserField, {
                                    erpField: value ?? "",
                                })
                            }
                            onInputChange={(_, value) =>
                                updateRule(params.row.archaserField, {
                                    erpField: value,
                                })
                            }
                            disabled={!canManage}
                            sx={{
                                m: 0,
                                width: "100%",
                                "& .MuiFormControl-root": { m: 0 },
                            }}
                            renderInput={(inputParams) => (
                                <TextField
                                    {...inputParams}
                                    size="small"
                                    placeholder="e.g. CUSTNAME"
                                    sx={{ m: 0, width: "100%" }}
                                />
                            )}
                        />
                    </Box>
                ),
            },
            {
                field: "transform",
                headerName: "Transform",
                flex: 0.8,
                minWidth: 140,
                sortable: false,
                renderCell: (params: GridRenderCellParams<MappingGridRow>) => (
                    <Box
                        data-interactive="true"
                        onClick={(e) => e.stopPropagation()}
                        sx={{ width: "100%", pr: 0.5 }}
                    >
                        <Select
                            size="small"
                            fullWidth
                            displayEmpty
                            disabled={!canManage}
                            value={params.row.transform}
                            onChange={(e) => {
                                const value = String(e.target.value);
                                updateRule(params.row.archaserField, {
                                    transform:
                                        value === ""
                                            ? undefined
                                            : (value as MappingRule["transform"]),
                                });
                            }}
                            sx={{ m: 0 }}
                        >
                            <MenuItem value="">
                                <em>None</em>
                            </MenuItem>
                            {CONNECTOR_FIELD_TRANSFORMS.map((transform) => (
                                <MenuItem key={transform} value={transform}>
                                    {transform}
                                </MenuItem>
                            ))}
                        </Select>
                    </Box>
                ),
            },
            {
                field: "sample",
                headerName: "Sample value",
                flex: 1,
                minWidth: 140,
                sortable: false,
                renderCell: (params: GridRenderCellParams<MappingGridRow>) => (
                    <Typography variant="body2" color="text.secondary">
                        {params.row.sample}
                    </Typography>
                ),
            },
        ],
        [rawHeaders, canManage, updateRule]
    );

    if (!catalog) {
        return null;
    }

    if (isLoading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                <CircularProgress size={24} />
            </Box>
        );
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: hideEntityHeader ? "flex-end" : "space-between",
                    flexWrap: "wrap",
                    gap: 1,
                }}
            >
                {!hideEntityHeader && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography variant="subtitle2">{importType}</Typography>
                        <Chip
                            size="small"
                            label={isComplete ? "Complete" : "Incomplete"}
                            color={isComplete ? "success" : "warning"}
                            variant="outlined"
                        />
                    </Box>
                )}
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={() => void handleDiscover()}
                        disabled={!canManage || isDiscovering}
                    >
                        {isDiscovering ? "Discoveringâ€¦" : "Discover fields"}
                    </Button>
                    <Button
                        size="small"
                        variant="contained"
                        onClick={() => void handleSave()}
                        disabled={!canManage || isSaving}
                    >
                        {isSaving ? "Savingâ€¦" : "Save mapping"}
                    </Button>
                </Box>
            </Box>

            <Box
                sx={{
                    width: "100%",
                    bgcolor: "background.paper",
                    borderRadius: 2,
                    overflow: "hidden",
                }}
            >
                <EndlessScrollDataGrid
                    rows={gridRows}
                    columns={columns}
                    totalRecords={gridRows.length}
                    isLoading={false}
                    onLoadMore={() => {}}
                    hasMore={false}
                    hideToolbar
                    resizableColumns
                    visibleRows={gridRows.length}
                    language={i18n.language}
                />
            </Box>
        </Box>
    );
}

function extractErrorMessage(err: unknown): string | undefined {
    if (
        err &&
        typeof err === "object" &&
        "response" in err &&
        err.response &&
        typeof err.response === "object" &&
        "data" in err.response &&
        err.response.data &&
        typeof err.response.data === "object" &&
        "error" in err.response.data
    ) {
        const errorField = (err.response.data as { error?: unknown }).error;
        return typeof errorField === "string" ? errorField : undefined;
    }
    if (err instanceof Error) {
        return err.message;
    }
    return undefined;
}
