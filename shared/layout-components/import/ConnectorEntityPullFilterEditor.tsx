"use client";

import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Chip,
    CircularProgress,
    IconButton,
    MenuItem,
    Tab,
    Tabs,
    TextField,
    Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import type { ImportType } from "@/types/db";
import React, { useEffect, useMemo, useState } from "react";

import { useBillingConnectorDiscoveredFields } from "@/shared/hooks/useBillingConnectorDiscoveredFields";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import {
    saveBillingConnectorConfig,
    type AdvancedEntityPullFilter,
    type BillingConnectorConfig,
    type EntityPullFilterConfig,
    type EntityPullFilterMode,
    type PullFilterOperator,
    type PullFilterRule,
    type RulesEntityPullFilter,
    PULL_FILTER_OPERATORS,
} from "@/shared/services/billingConnectorService";

interface ConnectorEntityPullFilterEditorProps {
    accountId: number;
    importType: ImportType;
    canManage: boolean;
    locked: boolean;
    config: BillingConnectorConfig | null | undefined;
    onSaved?: (config: BillingConnectorConfig) => void;
    /** When true, omit the per-entity Save pull filter button (parent sticky Save). */
    hideSaveButton?: boolean;
    /** Fires when the draft filter diverges from the saved connector config. */
    onDirtyChange?: (dirty: boolean) => void;
}

export type ConnectorEntityPullFilterEditorHandle = {
    getDraftConfig: () => EntityPullFilterConfig | null;
    /** Returns false when the draft cannot be saved (e.g. rules without discovered fields). */
    canSaveDraft: () => boolean;
};

const OPERATOR_LABELS: Record<PullFilterOperator, string> = {
    eq: "equals",
    ne: "not equals",
    startswith: "starts with",
    contains: "contains",
    gt: "greater than",
    lt: "less than",
};

function emptyRule(): PullFilterRule {
    return { field: "", operator: "eq", value: "" };
}

function readMode(
    config: BillingConnectorConfig | null | undefined,
    importType: ImportType
): EntityPullFilterMode {
    const entry = config?.pull_filters?.[importType];
    if (entry?.mode === "rules") {
        return "rules";
    }
    return "advanced";
}

function readAdvancedOData(
    config: BillingConnectorConfig | null | undefined,
    importType: ImportType
): string {
    const entry = config?.pull_filters?.[importType];
    if (entry && entry.mode === "advanced") {
        return entry.odata;
    }
    return "";
}

function readRules(
    config: BillingConnectorConfig | null | undefined,
    importType: ImportType
): PullFilterRule[] {
    const entry = config?.pull_filters?.[importType];
    if (entry && entry.mode === "rules" && entry.rules.length > 0) {
        return entry.rules.map((rule) => ({ ...rule }));
    }
    return [emptyRule()];
}

function extractErrorMessage(err: unknown): string {
    if (
        err &&
        typeof err === "object" &&
        "response" in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data
            ?.error
    ) {
        return (err as { response: { data: { error: string } } }).response.data
            .error;
    }
    if (err instanceof Error) {
        return err.message;
    }
    return "Failed to save pull filter";
}

export default React.forwardRef<
    ConnectorEntityPullFilterEditorHandle,
    ConnectorEntityPullFilterEditorProps
>(function ConnectorEntityPullFilterEditor(
    {
        accountId,
        importType,
        canManage,
        locked,
        config,
        onSaved,
        hideSaveButton = false,
        onDirtyChange,
    },
    ref
) {
    const { success, error: showError } = useToast();
    const [mode, setMode] = useState<EntityPullFilterMode>(() =>
        readMode(config, importType)
    );
    const [odata, setOdata] = useState(() =>
        readAdvancedOData(config, importType)
    );
    const [rules, setRules] = useState<PullFilterRule[]>(() =>
        readRules(config, importType)
    );
    const [isSaving, setIsSaving] = useState(false);
    const {
        rawHeaders: discoveredFields,
    } = useBillingConnectorDiscoveredFields(accountId, importType);

    useEffect(() => {
        setMode(readMode(config, importType));
        setOdata(readAdvancedOData(config, importType));
        setRules(readRules(config, importType));
    }, [config, importType]);

    const rulesEnabled = discoveredFields.length > 0;
    const controlsDisabled = !canManage || locked || isSaving;

    const fieldOptions = useMemo(() => {
        const names = new Set(discoveredFields);
        for (const rule of rules) {
            if (rule.field.trim()) {
                names.add(rule.field.trim());
            }
        }
        return Array.from(names).sort((a, b) => a.localeCompare(b));
    }, [discoveredFields, rules]);

    const draftConfig = useMemo((): EntityPullFilterConfig | null => {
        if (mode === "advanced") {
            const trimmed = odata.trim();
            return trimmed
                ? ({
                      mode: "advanced",
                      odata: trimmed,
                  } satisfies AdvancedEntityPullFilter)
                : null;
        }
        const completeRules = rules.filter(
            (rule) => rule.field.trim() && rule.operator
        );
        if (completeRules.length === 0) {
            return null;
        }
        return {
            mode: "rules",
            rules: completeRules,
        } satisfies RulesEntityPullFilter;
    }, [mode, odata, rules]);

    useEffect(() => {
        const saved = config?.pull_filters?.[importType] ?? null;
        onDirtyChange?.(
            JSON.stringify(draftConfig) !== JSON.stringify(saved ?? null)
        );
    }, [draftConfig, config, importType, onDirtyChange]);

    const handleModeChange = (
        _event: React.SyntheticEvent,
        next: EntityPullFilterMode
    ) => {
        if (next === mode || controlsDisabled) {
            return;
        }
        // Only the active mode is saved/applied; the other draft is ignored.
        setMode(next);
    };

    const updateRule = (index: number, patch: Partial<PullFilterRule>) => {
        setRules((prev) =>
            prev.map((rule, i) => (i === index ? { ...rule, ...patch } : rule))
        );
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const next = draftConfig;
            const saved = await saveBillingConnectorConfig(accountId, {
                pull_filters: {
                    [importType]: next,
                },
            });
            setMode(readMode(saved, importType));
            setOdata(readAdvancedOData(saved, importType));
            setRules(readRules(saved, importType));
            onSaved?.(saved);
            success(
                next
                    ? `${importType} pull filter saved`
                    : `${importType} pull filter cleared`
            );
        } catch (err: unknown) {
            showError(extractErrorMessage(err));
        } finally {
            setIsSaving(false);
        }
    };

    React.useImperativeHandle(
        ref,
        () => ({
            getDraftConfig: () => draftConfig,
            canSaveDraft: () =>
                !(mode === "rules" && !rulesEnabled && Boolean(draftConfig)),
        }),
        [draftConfig, mode, rulesEnabled]
    );

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Tabs
                value={mode}
                onChange={handleModeChange}
                aria-label={`${importType} pull filter mode`}
                sx={{ mb: 1 }}
            >
                <Tab
                    label="Rules"
                    value="rules"
                    disabled={controlsDisabled}
                />
                <Tab
                    label="Advanced OData"
                    value="advanced"
                    disabled={controlsDisabled}
                />
            </Tabs>

            {mode === "rules" && (
                <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 2 }}
                >
                    {rules.map((rule, index) => (
                        <Box
                            key={`rule-${index}`}
                            sx={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 1,
                                alignItems: "center",
                                // Theme MuiFormControl adds marginBottom: 16px; that
                                // inflates row height and breaks vertical centering.
                                "& .MuiFormControl-root": { mb: 0 },
                            }}
                        >
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                    minWidth: 36,
                                    visibility:
                                        index > 0 ? "visible" : "hidden",
                                }}
                                aria-hidden={index === 0}
                            >
                                AND
                            </Typography>
                            <Autocomplete
                                size="small"
                                options={fieldOptions}
                                value={rule.field || null}
                                onChange={(_e, value) =>
                                    updateRule(index, {
                                        field: value ?? "",
                                    })
                                }
                                disabled={
                                    controlsDisabled || !rulesEnabled
                                }
                                sx={{ width: 220, flexShrink: 0 }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Field"
                                        size="small"
                                    />
                                )}
                            />
                            <TextField
                                select
                                label="Operator"
                                size="small"
                                value={rule.operator}
                                onChange={(event) =>
                                    updateRule(index, {
                                        operator: event.target
                                            .value as PullFilterOperator,
                                    })
                                }
                                disabled={
                                    controlsDisabled || !rulesEnabled
                                }
                                sx={{ minWidth: 150 }}
                            >
                                {PULL_FILTER_OPERATORS.map((op) => (
                                    <MenuItem key={op} value={op}>
                                        {OPERATOR_LABELS[op]}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                label="Value"
                                size="small"
                                value={rule.value}
                                onChange={(event) =>
                                    updateRule(index, {
                                        value: event.target.value,
                                    })
                                }
                                disabled={
                                    controlsDisabled || !rulesEnabled
                                }
                                sx={{ width: 220, flexShrink: 0 }}
                            />
                            <IconButton
                                aria-label="Remove rule"
                                color="primary"
                                onClick={() =>
                                    setRules((prev) =>
                                        prev.length <= 1
                                            ? [emptyRule()]
                                            : prev.filter((_, i) => i !== index)
                                    )
                                }
                                disabled={
                                    controlsDisabled || !rulesEnabled
                                }
                            >
                                <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                            {index === rules.length - 1 && (
                                <Chip
                                    label="Add rule"
                                    color="primary"
                                    variant="outlined"
                                    size="small"
                                    clickable
                                    disabled={
                                        controlsDisabled || !rulesEnabled
                                    }
                                    onClick={() =>
                                        setRules((prev) => [
                                            ...prev,
                                            emptyRule(),
                                        ])
                                    }
                                />
                            )}
                        </Box>
                    ))}
                </Box>
            )}

            {mode === "advanced" && (
                <TextField
                    label={`${importType} $filter`}
                    value={odata}
                    onChange={(event) => setOdata(event.target.value)}
                    multiline
                    minRows={2}
                    fullWidth
                    disabled={controlsDisabled}
                    placeholder="e.g. startswith(CUSTNAME,'A')"
                    helperText={
                        locked
                            ? "Locked after backfill has started. Reset backfill to edit."
                            : "Priority OData $filter expression"
                    }
                />
            )}

            {locked && (
                <Alert severity="info">
                    Pull filters are locked because backfill has started. Use
                    Reset backfill to unlock.
                </Alert>
            )}

            {!locked && (
                <Alert severity="warning">
                    Saving a tighter filter soft-excludes unmatched imported
                    rows on the next Backfill (not deleted). Matching rows can
                    return when re-imported.
                </Alert>
            )}

            {!hideSaveButton && (
                <Box>
                    <Button
                        variant="outlined"
                        onClick={() => void handleSave()}
                        disabled={
                            controlsDisabled ||
                            (mode === "rules" &&
                                !rulesEnabled &&
                                Boolean(draftConfig))
                        }
                        startIcon={
                            isSaving ? (
                                <CircularProgress size={16} />
                            ) : undefined
                        }
                    >
                        {isSaving ? "Saving…" : "Save pull filter"}
                    </Button>
                </Box>
            )}
        </Box>
    );
});
