/**
 * Example implementation of Visual Connectors Layout for FilterBuilder
 * This shows filter relationships with "AND" connectors between filters
 */

import React from "react";
import {
    Autocomplete,
    Box,
    Divider,
    IconButton,
    TextField,
    Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Delete } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

// This would replace the filter rendering section in FilterBuilder.tsx

interface Filter {
    table: string;
    field: string;
    operator: string;
    value: any;
}

interface RenderConnectorBasedFiltersProps {
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
    isBetweenDateOrDateTime?: boolean;
    rtlTypographyStyles?: React.CSSProperties;
}

const renderConnectorBasedFilters = ({
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
    isBetweenDateOrDateTime = false,
    rtlTypographyStyles = {},
}: RenderConnectorBasedFiltersProps) => {
    const { t } = useTranslation(["reports", "common"]);
    const theme = useTheme();
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0,
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

                const isLast = index === filters.length - 1;

                return (
                    <React.Fragment key={index}>
                        {/* Filter Row */}
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 2,
                                p: 2,
                                borderRadius: 2,
                                backgroundColor: alpha(
                                    theme.palette.background.paper,
                                    0.5
                                ),
                                border: `1px solid ${theme.palette.divider}`,
                                "&:hover": {
                                    backgroundColor: alpha(
                                        theme.palette.primary.main,
                                        0.04
                                    ),
                                },
                                flexDirection: isRTL ? "row-reverse" : "row",
                            }}
                        >
                            {/* Filter Content */}
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 2,
                                    flex: 1,
                                    flexWrap: "wrap",
                                    flexDirection: isRTL ? "row-reverse" : "row",
                                }}
                            >
                                {/* Table */}
                                <Box
                                    sx={{
                                        minWidth: 120,
                                        maxWidth: 200,
                                    }}
                                >
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
                                </Box>

                                {/* Field */}
                                <Box
                                    sx={{
                                        minWidth: 150,
                                        maxWidth: 250,
                                    }}
                                >
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
                                </Box>

                                {/* Operator */}
                                <Box
                                    sx={{
                                        minWidth: 120,
                                        maxWidth: 180,
                                    }}
                                >
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

                                {/* Value */}
                                <Box
                                    sx={{
                                        flex: 1,
                                        minWidth: 200,
                                        maxWidth: isBetweenDateOrDateTime
                                            ? "none"
                                            : 400,
                                    }}
                                >
                                    {renderValueInput(displayFilter, index)}
                                </Box>
                            </Box>

                            {/* Delete Button */}
                            <IconButton
                                size="small"
                                onClick={() => handleRemoveFilter(index)}
                                sx={{
                                    color: "error.main",
                                    flexShrink: 0,
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

                        {/* Validation Error */}
                        {validationErrors[index] && (
                            <Box
                                sx={{
                                    px: 2,
                                    pb: 1,
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    color="error"
                                    sx={{
                                        ...rtlTypographyStyles,
                                    }}
                                >
                                    {validationErrors[index]}
                                </Typography>
                            </Box>
                        )}

                        {/* AND Connector */}
                        {!isLast && (
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    py: 1,
                                    position: "relative",
                                }}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                        px: 2,
                                        py: 0.5,
                                        borderRadius: 1,
                                        backgroundColor: alpha(
                                            theme.palette.primary.main,
                                            0.1
                                        ),
                                        border: `1px solid ${alpha(
                                            theme.palette.primary.main,
                                            0.3
                                        )}`,
                                    }}
                                >
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            fontWeight: 600,
                                            color: "primary.main",
                                            textTransform: "uppercase",
                                            letterSpacing: 1,
                                        }}
                                    >
                                        {t("values.and", {
                                            defaultValue: "AND",
                                        })}
                                    </Typography>
                                </Box>
                                <Divider
                                    sx={{
                                        position: "absolute",
                                        left: 0,
                                        right: 0,
                                        zIndex: -1,
                                    }}
                                />
                            </Box>
                        )}
                    </React.Fragment>
                );
            })}
        </Box>
    );
};

