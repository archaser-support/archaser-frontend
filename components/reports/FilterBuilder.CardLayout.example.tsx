/**
 * Example implementation of Card-Based Layout for FilterBuilder
 * This is a reference implementation showing how Option 1 could be implemented
 */

import React from "react";
import {
    Autocomplete,
    Box,
    Card,
    CardContent,
    Chip,
    IconButton,
    TextField,
    Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Delete } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

// This would replace the filter rendering section (around line 2984-3364)
// in the current FilterBuilder.tsx

interface Filter {
    table: string;
    field: string;
    operator: string;
    value: any;
}

interface RenderCardBasedFiltersProps {
    filters: Filter[];
    selectedTables: string[];
    availableFields: Array<{
        name: string;
        label: string;
    }>;
    operators: Array<{
        value: string;
        label: string;
    }>;
    validationErrors?: Record<number, string>;
    handleRemoveFilter: (index: number) => void;
    handleUpdateFilter: (index: number, field: keyof Filter, value: any) => void;
    renderValueInput: (filter: Filter, index: number) => React.ReactNode;
    normalizeFieldName: (table: string, field: string) => string;
    getFieldInfo: (table: string, field: string) => { label?: string; type?: string } | undefined;
    getTableLabel: (table: string) => string;
    isRTL: boolean;
}

const renderCardBasedFilters = ({
    filters,
    selectedTables,
    availableFields,
    operators,
    validationErrors = {},
    handleRemoveFilter,
    handleUpdateFilter,
    renderValueInput,
    normalizeFieldName,
    getFieldInfo,
    getTableLabel,
    isRTL,
}: RenderCardBasedFiltersProps) => {
    const { t } = useTranslation(["reports", "common"]);
    const theme = useTheme();
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                direction: isRTL ? "rtl" : "ltr",
            }}
        >
            {filters.map((filter, index) => {
                const normalizedField = normalizeFieldName(
                    filter.table,
                    filter.field
                );
                const fieldInfo = getFieldInfo(filter.table, normalizedField);
                const tableLabel = getTableLabel(filter.table);
                const fieldLabel = fieldInfo?.label || normalizedField;
                const operatorLabel = operators.find(
                    (op: { value: string; label: string }) => op.value === filter.operator
                )?.label || filter.operator;
                const displayFilter = { ...filter, field: normalizedField };

                // Format value for display
                const formatValueForDisplay = (value: any): string => {
                    if (value === null || value === undefined) return "";
                    if (Array.isArray(value)) {
                        return value.join(" - ");
                    }
                    if (typeof value === "boolean") {
                        return value ? t("values.true", "True") : t("values.false", "False");
                    }
                    return String(value);
                };

                return (
                    <Card
                        key={index}
                        elevation={1}
                        sx={{
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: 2,
                            "&:hover": {
                                boxShadow: theme.shadows[4],
                            },
                        }}
                    >
                        <CardContent
                            sx={{
                                p: 2,
                                "&:last-child": { pb: 2 },
                            }}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                    mb: 2,
                                    flexDirection: isRTL ? "row-reverse" : "row",
                                }}
                            >
                                <Box sx={{ flex: 1 }}>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            gap: 1,
                                            alignItems: "center",
                                            mb: 1,
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        <Chip
                                            label={tableLabel}
                                            size="small"
                                            color="primary"
                                            variant="outlined"
                                        />
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                        >
                                            {fieldLabel}
                                        </Typography>
                                        <Chip
                                            label={operatorLabel}
                                            size="small"
                                            variant="outlined"
                                        />
                                    </Box>
                                    {validationErrors[index] && (
                                        <Typography
                                            variant="caption"
                                            color="error"
                                            sx={{ display: "block", mt: 0.5 }}
                                        >
                                            {validationErrors[index]}
                                        </Typography>
                                    )}
                                </Box>
                                <IconButton
                                    size="small"
                                    onClick={() => handleRemoveFilter(index)}
                                    sx={{
                                        color: "error.main",
                                        "&:hover": {
                                            backgroundColor: alpha(
                                                theme.palette.error.main,
                                                0.1
                                            ),
                                        },
                                    }}
                                >
                                    <Delete fontSize="small" />
                                </IconButton>
                            </Box>

                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 2,
                                }}
                            >
                                {/* Table Selector */}
                                <Autocomplete
                                    size="small"
                                    options={selectedTables}
                                    value={filter.table}
                                    onChange={(_, newValue) =>
                                        handleUpdateFilter(
                                            index,
                                            "table",
                                            newValue || ""
                                        )
                                    }
                                    getOptionLabel={(option) => getTableLabel(option)}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label={t("fields.table", "Table")}
                                            size="small"
                                        />
                                    )}
                                />

                                {/* Field Selector */}
                                <Autocomplete
                                    size="small"
                                    options={availableFields}
                                    value={
                                        availableFields.find(
                                            (f: { name: string; label: string }) => f.name === displayFilter.field
                                        ) || null
                                    }
                                    onChange={(_, newValue) =>
                                        handleUpdateFilter(
                                            index,
                                            "field",
                                            newValue?.name || ""
                                        )
                                    }
                                    getOptionLabel={(option) =>
                                        option.label || option.name
                                    }
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label={t("fields.field", "Field")}
                                            size="small"
                                        />
                                    )}
                                />

                                {/* Operator Selector */}
                                <Autocomplete
                                    size="small"
                                    options={operators}
                                    value={
                                        operators.find(
                                            (op) => op.value === displayFilter.operator
                                        ) || null
                                    }
                                    onChange={(_, newValue) =>
                                        handleUpdateFilter(
                                            index,
                                            "operator",
                                            newValue?.value || ""
                                        )
                                    }
                                    getOptionLabel={(option) => option.label}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label={t("fields.operator", "Operator")}
                                            size="small"
                                        />
                                    )}
                                />

                                {/* Value Input */}
                                <Box>
                                    {renderValueInput(displayFilter, index)}
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                );
            })}
        </Box>
    );
};

