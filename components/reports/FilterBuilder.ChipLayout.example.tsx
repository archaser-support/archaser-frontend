/**
 * Example implementation of Chip-Based Compact Layout for FilterBuilder
 * This is a reference implementation showing how Option 2 could be implemented
 */

import React from "react";
import {
    Autocomplete,
    Box,
    Chip,
    Collapse,
    IconButton,
    Paper,
    TextField,
    Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Delete, ExpandMore, ExpandLess } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

// This would replace the filter rendering section in FilterBuilder.tsx

interface Filter {
    table: string;
    field: string;
    operator: string;
    value: any;
}

interface RenderChipBasedFiltersProps {
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

const renderChipBasedFilters = ({
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
}: RenderChipBasedFiltersProps) => {
    const { t } = useTranslation(["reports", "common"]);
    const theme = useTheme();
    const [expandedFilters, setExpandedFilters] = React.useState<Set<number>>(
        new Set()
    );

    const toggleFilterExpansion = (index: number) => {
        setExpandedFilters((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
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

                // Format value for display in chip
                const formatValueForChip = (value: any): string => {
                    if (value === null || value === undefined) return "";
                    if (Array.isArray(value)) {
                        if (value.length === 2) {
                            return `${value[0]} - ${value[1]}`;
                        }
                        return value.join(", ");
                    }
                    if (typeof value === "boolean") {
                        return value ? t("values.true", "True") : t("values.false", "False");
                    }
                    if (typeof value === "string" && value.length > 30) {
                        return value.substring(0, 30) + "...";
                    }
                    return String(value);
                };

                const isExpanded = expandedFilters.has(index);
                const displayValue = formatValueForChip(filter.value);
                const isEmptyOperator =
                    filter.operator === "is_empty" ||
                    filter.operator === "is_not_empty";

                return (
                    <Box key={index}>
                        {/* Compact Chip View */}
                        <Paper
                            elevation={isExpanded ? 4 : 1}
                            sx={{
                                p: 1.5,
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                cursor: "pointer",
                                transition: "all 0.2s",
                                border: `1px solid ${theme.palette.divider}`,
                                borderRadius: 2,
                                "&:hover": {
                                    backgroundColor: alpha(
                                        theme.palette.primary.main,
                                        0.04
                                    ),
                                    borderColor: theme.palette.primary.main,
                                },
                                flexDirection: isRTL ? "row-reverse" : "row",
                            }}
                            onClick={() => toggleFilterExpansion(index)}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    flex: 1,
                                    flexWrap: "wrap",
                                    flexDirection: isRTL ? "row-reverse" : "row",
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
                                    sx={{
                                        fontWeight: 500,
                                        color: "text.primary",
                                    }}
                                >
                                    {fieldLabel}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                >
                                    {operatorLabel}
                                </Typography>
                                {!isEmptyOperator && displayValue && (
                                    <Chip
                                        label={displayValue}
                                        size="small"
                                        variant="filled"
                                        sx={{
                                            backgroundColor: alpha(
                                                theme.palette.primary.main,
                                                0.1
                                            ),
                                            color: "text.primary",
                                            maxWidth: 200,
                                            "& .MuiChip-label": {
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                            },
                                        }}
                                    />
                                )}
                                {validationErrors[index] && (
                                    <Chip
                                        label={validationErrors[index]}
                                        size="small"
                                        color="error"
                                        variant="outlined"
                                    />
                                )}
                            </Box>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    flexDirection: isRTL ? "row-reverse" : "row",
                                }}
                            >
                                <IconButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveFilter(index);
                                    }}
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
                                <IconButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleFilterExpansion(index);
                                    }}
                                >
                                    {isExpanded ? (
                                        <ExpandLess fontSize="small" />
                                    ) : (
                                        <ExpandMore fontSize="small" />
                                    )}
                                </IconButton>
                            </Box>
                        </Paper>

                        {/* Expanded Edit View */}
                        <Collapse in={isExpanded}>
                            <Paper
                                elevation={0}
                                sx={{
                                    mt: 1,
                                    p: 2,
                                    border: `1px solid ${theme.palette.divider}`,
                                    borderTop: "none",
                                    borderTopLeftRadius: 0,
                                    borderTopRightRadius: 0,
                                    borderBottomLeftRadius: 8,
                                    borderBottomRightRadius: 8,
                                    backgroundColor: alpha(
                                        theme.palette.background.paper,
                                        0.5
                                    ),
                                }}
                            >
                                <Box
                                    sx={{
                                        display: "grid",
                                        gridTemplateColumns: {
                                            xs: "1fr",
                                            sm: "repeat(2, 1fr)",
                                            md: "repeat(3, 1fr)",
                                        },
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
                                        getOptionLabel={(option) =>
                                            getTableLabel(option)
                                        }
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
                                                (f: { name: string; label: string }) =>
                                                    f.name === displayFilter.field
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
                                                (op: { value: string; label: string }) =>
                                                    op.value ===
                                                    displayFilter.operator
                                            ) || null
                                        }
                                        onChange={(_, newValue) =>
                                            handleUpdateFilter(
                                                index,
                                                "operator",
                                                newValue?.value || ""
                                            )
                                        }
                                        getOptionLabel={(option) =>
                                            option.label
                                        }
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label={t(
                                                    "fields.operator",
                                                    "Operator"
                                                )}
                                                size="small"
                                            />
                                        )}
                                    />
                                </Box>

                                {/* Value Input - Full Width */}
                                <Box sx={{ mt: 2 }}>
                                    {renderValueInput(displayFilter, index)}
                                </Box>
                            </Paper>
                        </Collapse>
                    </Box>
                );
            })}
        </Box>
    );
};

