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
import { useBillingConnectorDiscoveredFields } from "@/shared/hooks/useBillingConnectorDiscoveredFields";
import EndlessScrollDataGrid from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import MappingDefaultValueInput from "@/shared/layout-components/import/MappingDefaultValueInput";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import {
    fetchBillingConnectorMapping,
    saveBillingConnectorMapping,
} from "@/shared/services/billingConnectorService";

interface MappingGridRow {
    id: string;
    archaserField: string;
    erpField: string;
    transform: string;
    defaultValue: string;
    sample: string;
    sampleIsDefault: boolean;
    isRequired: boolean;
    isHighlighted: boolean;
}

interface ConnectorFieldMapperProps {
    accountId: number;
    importType: ImportType;
    canManage: boolean;
    onCompletenessChange?: (importType: ImportType, isComplete: boolean) => void;
    hideEntityHeader?: boolean;
    /** When true, omit the per-entity Save mapping button (parent sticky Save). */
    hideSaveButton?: boolean;
    /** Current Priority table override (empty = contract default). */
    entitySet?: string;
    /** Contract default table name for placeholder. */
    defaultEntitySet?: string;
    /** Cached EntitySet names from $metadata. */
    entitySetCatalog?: string[];
    onEntitySetChange?: (importType: ImportType, entitySet: string | null) => void;
    onRefreshEntitySetCatalog?: () => Promise<void>;
    isRefreshingEntitySetCatalog?: boolean;
    /** Fires when local mapping rules diverge from the last loaded/saved baseline. */
    onDirtyChange?: (dirty: boolean) => void;
    /** Optional content rendered under the Priority table toolbar and above the mapping grid. */
    betweenHeaderAndGrid?: React.ReactNode;
}

export type ConnectorFieldMapperHandle = {
    save: () => Promise<boolean>;
};

const ConnectorFieldMapper = React.forwardRef<
    ConnectorFieldMapperHandle,
    ConnectorFieldMapperProps
>(function ConnectorFieldMapper(
    {
        accountId,
        importType,
        canManage,
        onCompletenessChange,
        hideEntityHeader = false,
        hideSaveButton = false,
        entitySet = "",
        defaultEntitySet = "",
        entitySetCatalog = [],
        onEntitySetChange,
        onRefreshEntitySetCatalog,
        isRefreshingEntitySetCatalog = false,
        onDirtyChange,
        betweenHeaderAndGrid,
    },
    ref
) {
    const { i18n } = useTranslation();
    const { success, error: showError } = useToast();
    const catalog = useMemo(
        () => getImportEntityFieldCatalog(importType),
        [importType]
    );

    const [rules, setRules] = useState<MappingRule[]>([]);
    const [baselineRulesJson, setBaselineRulesJson] = useState("[]");
    const [isComplete, setIsComplete] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const {
        rawHeaders,
        exampleValues,
        isDiscovering,
        discover,
    } = useBillingConnectorDiscoveredFields(accountId, importType);

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
            setBaselineRulesJson(JSON.stringify(nextRules));
            setIsComplete(Boolean(mapping?.is_complete));
            onCompletenessChangeRef.current?.(
                importType,
                Boolean(mapping?.is_complete)
            );
        } catch (err: unknown) {
            showError(extractErrorMessage(err) ?? "Failed to load mapping");
            const fallback = buildDefaultConnectorMappingRules(importType);
            setRules(fallback);
            setBaselineRulesJson(JSON.stringify(fallback));
        } finally {
            setIsLoading(false);
        }
    }, [accountId, importType, showError]);

    useEffect(() => {
        void loadMapping();
    }, [loadMapping]);

    useEffect(() => {
        onDirtyChange?.(JSON.stringify(rules) !== baselineRulesJson);
    }, [rules, baselineRulesJson, onDirtyChange]);

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
                            ...(patch.defaultValue !== undefined
                                ? { defaultValue: patch.defaultValue }
                                : {}),
                        },
                    ];
                }
                return prev.map((rule) => {
                    if (rule.archaserField !== archaserField) {
                        return rule;
                    }
                    const next = { ...rule, ...patch };
                    if (
                        "defaultValue" in patch &&
                        (patch.defaultValue === undefined ||
                            patch.defaultValue.trim() === "")
                    ) {
                        delete next.defaultValue;
                    }
                    return next;
                });
            });
        },
        []
    );

    const handleDiscover = async () => {
        try {
            const discovered = await discover();

            setRules((prev) => {
                const byField = new Map(
                    prev.map((rule) => [rule.archaserField, rule])
                );
                const next: MappingRule[] = [];
                for (const field of catalog?.fields ?? []) {
                    const existing = byField.get(field);
                    if (
                        existing &&
                        (existing.erpField ||
                            (existing.defaultValue?.trim() ?? ""))
                    ) {
                        next.push(existing);
                        continue;
                    }
                    const suggested = discovered.raw_headers.find(
                        (header) =>
                            header.toLowerCase() === field.toLowerCase() ||
                            header
                                .toLowerCase()
                                .endsWith(`.${field.toLowerCase()}`)
                    );
                    if (suggested) {
                        next.push({
                            archaserField: field,
                            erpField: suggested,
                        });
                    }
                }
                return next.length > 0 ? next : prev;
            });
            success("Fields discovered from Priority");
        } catch (err: unknown) {
            showError(extractErrorMessage(err) ?? "Failed to discover fields");
        }
    };

    const handleSave = useCallback(async (): Promise<boolean> => {
        setIsSaving(true);
        try {
            const saved = await saveBillingConnectorMapping(
                accountId,
                importType,
                rules.filter(
                    (rule) =>
                        rule.erpField.trim() ||
                        (rule.defaultValue?.trim() ?? "") !== ""
                )
            );
            setRules(saved.mapping);
            setBaselineRulesJson(JSON.stringify(saved.mapping));
            setIsComplete(saved.is_complete);
            onCompletenessChange?.(importType, saved.is_complete);
            if (!hideSaveButton) {
                success(`${importType} mapping saved`);
            }
            return true;
        } catch (err: unknown) {
            showError(extractErrorMessage(err) ?? "Failed to save mapping");
            return false;
        } finally {
            setIsSaving(false);
        }
    }, [
        accountId,
        importType,
        rules,
        onCompletenessChange,
        hideSaveButton,
        success,
        showError,
    ]);

    React.useImperativeHandle(
        ref,
        () => ({
            save: handleSave,
        }),
        [handleSave]
    );

    const gridRows = useMemo<MappingGridRow[]>(() => {
        if (!catalog) {
            return [];
        }
        return catalog.fields.map((archaserField) => {
            const rule = rules.find((item) => item.archaserField === archaserField);
            const erpField = rule?.erpField ?? "";
            const defaultValue = rule?.defaultValue ?? "";
            const erpSample =
                erpField && exampleValues[erpField] !== undefined
                    ? exampleValues[erpField]
                    : undefined;
            const erpSampleEmpty =
                erpSample === null ||
                erpSample === undefined ||
                (typeof erpSample === "string" && erpSample.trim() === "");
            const sampleIsDefault =
                Boolean(defaultValue.trim()) &&
                (!erpField || erpSampleEmpty);
            return {
                id: archaserField,
                archaserField,
                erpField,
                transform: rule?.transform ?? "",
                defaultValue,
                sample: sampleIsDefault
                    ? defaultValue
                    : erpSample !== undefined
                      ? String(erpSample)
                      : "",
                sampleIsDefault,
                isRequired: required.has(archaserField),
                isHighlighted: highlighted.has(archaserField),
            };
        });
    }, [catalog, rules, exampleValues, required, highlighted]);

    const countryIso2Default = useMemo(() => {
        const rule = rules.find((item) => item.archaserField === "country_iso2");
        return rule?.defaultValue?.trim() || undefined;
    }, [rules]);

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
                        sx={{
                            width: "100%",
                            height: "100%",
                            pr: 0.5,
                            display: "flex",
                            alignItems: "center",
                        }}
                    >
                        <Autocomplete
                            size="small"
                            freeSolo
                            options={rawHeaders}
                            value={params.row.erpField || null}
                            onChange={(_, value) =>
                                updateRule(params.row.archaserField, {
                                    erpField: value ?? "",
                                })
                            }
                            onInputChange={(_, value, reason) => {
                                if (
                                    reason === "input" ||
                                    reason === "clear"
                                ) {
                                    updateRule(params.row.archaserField, {
                                        erpField: value,
                                    });
                                }
                            }}
                            getOptionLabel={(option) => option || ""}
                            isOptionEqualToValue={(option, value) =>
                                option === value
                            }
                            disabled={!canManage}
                            sx={{
                                width: "100%",
                                // Theme MuiFormControl adds marginBottom: 16px
                                "& .MuiFormControl-root": { m: 0 },
                            }}
                            renderInput={(inputParams) => (
                                <TextField
                                    {...inputParams}
                                    size="small"
                                    placeholder={
                                        rawHeaders.length > 0
                                            ? "Select or type Priority field"
                                            : "Discover fields first, or type a path"
                                    }
                                    sx={{ m: 0 }}
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
                        sx={{
                            width: "100%",
                            height: "100%",
                            pr: 0.5,
                            display: "flex",
                            alignItems: "center",
                        }}
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
                field: "defaultValue",
                headerName: "Default",
                flex: 0.9,
                minWidth: 160,
                sortable: false,
                renderCell: (params: GridRenderCellParams<MappingGridRow>) => (
                    <Box
                        data-interactive="true"
                        onClick={(e) => e.stopPropagation()}
                        sx={{
                            width: "100%",
                            height: "100%",
                            pr: 0.5,
                            display: "flex",
                            alignItems: "center",
                        }}
                    >
                        <MappingDefaultValueInput
                            accountId={accountId}
                            archaserField={params.row.archaserField}
                            transform={
                                params.row.transform
                                    ? (params.row
                                          .transform as MappingRule["transform"])
                                    : undefined
                            }
                            value={params.row.defaultValue}
                            disabled={!canManage}
                            countryIso2Default={countryIso2Default}
                            onChange={(next) =>
                                updateRule(params.row.archaserField, {
                                    defaultValue: next,
                                })
                            }
                        />
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
                        {params.row.sampleIsDefault && params.row.sample
                            ? " (default)"
                            : ""}
                    </Typography>
                ),
            },
        ],
        [rawHeaders, canManage, updateRule, accountId, countryIso2Default]
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
                    {onEntitySetChange && (
                        <Autocomplete
                            size="small"
                            sx={{ minWidth: 220 }}
                            options={entitySetCatalog}
                            value={entitySet || null}
                            onChange={(_event, value) => {
                                onEntitySetChange(
                                    importType,
                                    value && value.trim() ? value.trim() : null
                                );
                            }}
                            disabled={!canManage}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Priority table"
                                    size="small"
                                    placeholder={
                                        defaultEntitySet || "Contract default"
                                    }
                                />
                            )}
                        />
                    )}
                    {onRefreshEntitySetCatalog && (
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => void onRefreshEntitySetCatalog()}
                            disabled={
                                !canManage || isRefreshingEntitySetCatalog
                            }
                            startIcon={
                                isRefreshingEntitySetCatalog ? (
                                    <CircularProgress size={14} />
                                ) : undefined
                            }
                        >
                            {isRefreshingEntitySetCatalog
                                ? "Refreshing tables…"
                                : "Refresh tables"}
                        </Button>
                    )}
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={() => void handleDiscover()}
                        disabled={!canManage || isDiscovering}
                        startIcon={
                            isDiscovering ? (
                                <CircularProgress size={14} />
                            ) : undefined
                        }
                    >
                        {isDiscovering ? "Discovering…" : "Discover fields"}
                    </Button>
                    {!hideSaveButton && (
                        <Button
                            size="small"
                            variant="contained"
                            onClick={() => void handleSave()}
                            disabled={!canManage || isSaving}
                        >
                            {isSaving ? "Saving…" : "Save mapping"}
                        </Button>
                    )}
                </Box>
            </Box>

            {betweenHeaderAndGrid}

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
                    // Cap height so the body scrolls; sizing to all rows traps
                    // wheel events (overscroll-behavior: contain) and blocks page scroll.
                    visibleRows={Math.min(gridRows.length, 8)}
                    language={i18n.language}
                />
            </Box>
        </Box>
    );
});

export default ConnectorFieldMapper;

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
