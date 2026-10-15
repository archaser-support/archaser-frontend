"use client";

import { DeleteIcon as Delete } from "@/shared/components/report-icons";
import {
    Box,
    Typography,
    Paper,
    Button,
    Chip,
    Autocomplete,
    TextField,
    FormControlLabel,
    Switch,
    Tooltip,
} from "@mui/material";
import {Add} from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import React from "react";
import { useTranslation } from "react-i18next";

import { isGroupedReportConfig } from "@/shared/reportFormula/columnOrder";
import {
    alignFormulaAggregationsWithGrouping,
    type ReportFormula,
} from "@/shared/reportFormula/types";
import { getRTLTooltipProps } from "@/utils/reportFieldUtils";
import { getFieldOutputKey } from "@/utils/reportTableUtils";

interface GroupingBuilderProps {
    selectedFields: Array<{
        table: string;
        field: string;
        alias?: string;
        aggregation?: "SUM" | "AVG" | "COUNT" | "MIN" | "MAX";
    }>;
    tables: Array<{
        name: string;
        label: string;
        fields: Array<{ name: string; label: string }>;
    }>;
    grouping: string[];
    onGroupingChange: (grouping: string[]) => void;
    formulas?: ReportFormula[];
    showTotalRow?: boolean;
    onShowTotalRowChange?: (showTotalRow: boolean) => void;
}

const GroupingBuilder: React.FC<GroupingBuilderProps> = ({
    selectedFields,
    tables,
    grouping,
    onGroupingChange,
    formulas = [],
    showTotalRow = false,
    onShowTotalRowChange,
}) => {
    const { t, i18n } = useTranslation(["reports", "common"]);
    const theme = useTheme();
    const isHebrew = i18n.language === "he";
    const isRTL = isHebrew;
    const [selectedFieldForGrouping, setSelectedFieldForGrouping] =
        React.useState<string>("");

    const getTableLabel = (tableName: string) => {
        return tables.find((t) => t.name === tableName)?.label || tableName;
    };

    const getFieldLabel = (tableName: string, fieldName: string) => {
        // Regular field lookup first
        const table = tables.find((t) => t.name === tableName);
        const field = table?.fields.find((f) => f.name === fieldName);

        // If found in the table, return its label
        if (field?.label) {
            return field.label;
        }

        // Special handling: Customer table may have Company fields merged in
        // If field not found in Customer table, check if it's a Company field
        if (tableName === "Customer") {
            const companyTable = tables.find((t) => t.name === "Company");
            const companyField = companyTable?.fields.find(
                (f) => f.name === fieldName
            );
            if (companyField?.label) {
                return companyField.label;
            }
        }

        // Fallback: return field name (shouldn't happen if metadata is correct)
        return fieldName;
    };

    const getFieldDisplayName = (table: string, field: string) => {
        const tableLabel = getTableLabel(table);
        const fieldLabel = getFieldLabel(table, field);
        return `${tableLabel}.${fieldLabel}`;
    };

    const availableFields = selectedFields.filter(
        (field) =>
            !field.aggregation &&
            !grouping.includes(getFieldOutputKey(field))
    );
    const hasAggregation =
        selectedFields.some((field) => !!field.aggregation) ||
        alignFormulaAggregationsWithGrouping(
            formulas,
            isGroupedReportConfig({ fields: selectedFields, grouping })
        ).some((formula) => !!formula.aggregation);

    // Reset selected field when available fields change
    React.useEffect(() => {
        if (
            selectedFieldForGrouping &&
            !availableFields.some(
                (f) => getFieldOutputKey(f) === selectedFieldForGrouping
            )
        ) {
            setSelectedFieldForGrouping("");
        }
    }, [availableFields, selectedFieldForGrouping]);

    const handleAddGrouping = () => {
        if (selectedFieldForGrouping) {
            onGroupingChange([...grouping, selectedFieldForGrouping]);
            setSelectedFieldForGrouping("");
        } else if (availableFields.length > 0) {
            // Fallback: add first available field if nothing selected
            const firstField = availableFields[0];
            onGroupingChange([
                ...grouping,
                getFieldOutputKey(firstField),
            ]);
        }
    };

    const handleRemoveGrouping = (index: number) => {
        onGroupingChange(grouping.filter((_, i) => i !== index));
    };

    const addGroupingButtonSx = {
        flexShrink: 0,
        direction: isRTL ? "rtl" : "ltr",
        "& .MuiButton-endIcon": {
            marginLeft: isRTL ? 0 : theme.spacing(1),
            marginRight: isRTL ? theme.spacing(1) : 0,
        },
        "& .MuiButton-startIcon": {
            marginRight: isRTL ? 0 : theme.spacing(1),
            marginLeft: isRTL ? theme.spacing(1) : 0,
        },
    } as const;

    const totalRowSwitch = (
        <FormControlLabel
            control={
                <Switch
                    checked={hasAggregation && !!showTotalRow}
                    onChange={(e) =>
                        onShowTotalRowChange?.(e.target.checked)
                    }
                    disabled={!hasAggregation}
                    color="primary"
                    {...(isHebrew && { "data-rtl": true })}
                />
            }
            label={t("fields.show_total_row", "Show total row")}
            sx={{
                m: 0,
                "& .MuiFormControlLabel-label": {
                    marginInlineStart: theme.spacing(1),
                    marginInlineEnd: 0,
                },
            }}
        />
    );
    const totalRowToggle = hasAggregation ? (
        totalRowSwitch
    ) : (
        <Tooltip
            title={t(
                "tooltips.total_row_requires_aggregation",
                "Add an aggregation (SUM, AVG, COUNT, MIN or MAX) to at least one field to show a total row."
            )}
            {...getRTLTooltipProps(i18n)}
        >
            <span>{totalRowSwitch}</span>
        </Tooltip>
    );

    const addGroupingRowButton = (
        <Button
            variant="outlined"
            startIcon={isRTL ? undefined : <Add />}
            endIcon={isRTL ? <Add /> : undefined}
            onClick={handleAddGrouping}
            disabled={
                availableFields.length === 0 || !selectedFieldForGrouping
            }
            sx={addGroupingButtonSx}
        >
            {t("actions.add_grouping", "Add Grouping")}
        </Button>
    );

    // Do not stretch to full step width: column flex defaults to align-items: stretch;
    // cap width so the combobox + popup anchor stay a sensible field size (like filter row controls).
    const fieldSelectForGroupingRow = (
        <Box
            sx={{
                width: "100%",
                maxWidth: 400,
                minWidth: 0,
                alignSelf: isRTL ? "flex-end" : "flex-start",
            }}
        >
            <Autocomplete
                fullWidth
                options={availableFields}
                value={
                    selectedFieldForGrouping
                        ? availableFields.find(
                              (f) =>
                                  getFieldOutputKey(f) ===
                                  selectedFieldForGrouping
                          ) || null
                        : null
                }
                onChange={(_, newValue) => {
                    setSelectedFieldForGrouping(
                        newValue ? getFieldOutputKey(newValue) : ""
                    );
                }}
                getOptionLabel={(option) =>
                    getFieldLabel(option.table, option.field)
                }
                isOptionEqualToValue={(option, value) =>
                    getFieldOutputKey(option) === getFieldOutputKey(value)
                }
                size="small"
                dir={isRTL ? "rtl" : "ltr"}
                {...(isHebrew && {
                    "data-hebrew": true,
                    "data-rtl": true,
                })}
                renderOption={(props, option) => {
                    const { key, ...otherProps } = props;
                    return (
                        <li
                            key={key}
                            {...otherProps}
                            style={{
                                direction: isRTL ? "rtl" : "ltr",
                                textAlign: isRTL ? "right" : "left",
                                paddingRight: isRTL ? "16px" : "14px",
                                paddingLeft: isRTL ? "14px" : "16px",
                            }}
                        >
                            <Typography
                                sx={{
                                    direction: isRTL ? "rtl" : "ltr",
                                    textAlign: isRTL ? "right" : "left",
                                    width: "100%",
                                }}
                            >
                                {getFieldLabel(option.table, option.field)}
                            </Typography>
                        </li>
                    );
                }}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label={t("fields.select_field", "Select Field")}
                        {...(isHebrew && { "data-hebrew": true })}
                        dir={isRTL ? "rtl" : "ltr"}
                    />
                )}
            />
        </Box>
    );

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                direction: isRTL ? "rtl" : "ltr",
                textAlign: isRTL ? "right" : "left",
            }}
        >
            {/* Description + Add Grouping (step title comes from wizard; no duplicate h6 here) */}
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexDirection: isRTL ? "row-reverse" : "row",
                    gap: 2,
                }}
            >
                {isRTL ? (
                    <>
                        {addGroupingRowButton}
                        <Box
                            sx={{
                                flex: "1 1 auto",
                                minWidth: 0,
                            }}
                        >
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                    direction: isRTL ? "rtl" : "ltr",
                                    textAlign: isRTL ? "right" : "left",
                                }}
                            >
                                {t(
                                    "sections.grouping_description",
                                    "Group your report data by selected fields"
                                )}
                            </Typography>
                        </Box>
                    </>
                ) : (
                    <>
                        <Box
                            sx={{
                                flex: "1 1 auto",
                                minWidth: 0,
                            }}
                        >
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                    direction: isRTL ? "rtl" : "ltr",
                                    textAlign: isRTL ? "right" : "left",
                                }}
                            >
                                {t(
                                    "sections.grouping_description",
                                    "Group your report data by selected fields"
                                )}
                            </Typography>
                        </Box>
                        {addGroupingRowButton}
                    </>
                )}
            </Box>

            {availableFields.length > 0 && fieldSelectForGroupingRow}

            {grouping.length === 0 && (
                <Paper
                    elevation={0}
                    sx={{
                        p: 3,
                        textAlign: isRTL ? "right" : "center",
                        bgcolor: "background.paper",
                        border: `1px dashed ${theme.palette.divider}`,
                        direction: isRTL ? "rtl" : "ltr",
                    }}
                >
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                            direction: isRTL ? "rtl" : "ltr",
                            textAlign: isRTL ? "right" : "center",
                        }}
                    >
                        {t(
                            "messages.no_grouping",
                            "No grouping fields selected. Add fields to group your data."
                        )}
                    </Typography>
                </Paper>
            )}

            <Box
                sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                    direction: isRTL ? "rtl" : "ltr",
                    justifyContent: isRTL ? "flex-end" : "flex-start",
                }}
            >
                {grouping.map((groupKey, index) => {
                    const fromSelection = selectedFields.find(
                        (f) => getFieldOutputKey(f) === groupKey
                    );
                    const label = fromSelection
                        ? getFieldDisplayName(
                              fromSelection.table,
                              fromSelection.field
                          )
                        : (() => {
                              const dot = groupKey.indexOf(".");
                              if (dot === -1) return groupKey;
                              return getFieldDisplayName(
                                  groupKey.substring(0, dot),
                                  groupKey.slice(dot + 1)
                              );
                          })();
                    return (
                        <Chip
                            key={index}
                            variant="outlined"
                            label={label}
                            onDelete={() => handleRemoveGrouping(index)}
                            deleteIcon={<Delete />}
                            color="primary"
                            sx={{
                                borderRadius: `${theme.appButton.sizeMedium.borderRadius}px`,
                                direction: isRTL ? "rtl" : "ltr",
                                "& .MuiChip-deleteIcon": {
                                    fontSize: 18,
                                    color: theme.palette.primary.main,
                                    "&:hover": {
                                        color: theme.palette.primary.dark,
                                    },
                                },
                            }}
                        />
                    );
                })}
            </Box>

            {totalRowToggle}
        </Box>
    );
};

export default GroupingBuilder;
