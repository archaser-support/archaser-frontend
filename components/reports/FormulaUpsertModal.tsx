"use client";

import { Calculate } from "@mui/icons-material";
import {
    Autocomplete,
    Alert,
    Box,
    Button,
    Stack,
    TextField,
    Typography,
    useTheme,
} from "@mui/material";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { OUTLINED_LABEL_HELPER_OFFSET } from "@/app/theme/appButton";
import AppDialog from "@/shared/layout-components/modal/AppDialog";
import ModalScrollBox from "@/shared/layout-components/modal/ModalScrollBox";
import { expressionHasRedundantAutoScalePercentDivision } from "@/shared/reportFormula/autoScalePercentFields";
import {
    filterFormulaOperandOptionsForFormat,
    getFormulaOperandReferencesFromTables,
} from "@/shared/reportFormula/columnOrder";
import {
    buildEditTimeFormulaReference,
    expressionToEditTime,
    expressionToStorage,
} from "@/shared/reportFormula/editTimeExpression";
import {
    buildCanonicalFieldReference,
    isFormulaOperandReference,
    normalizeFormulaExpression,
} from "@/shared/reportFormula/parser";
import {
    FORMULA_AGGREGATION_TYPES,
    type FormulaResultFormat,
    type ReportFormula,
} from "@/shared/reportFormula/types";
import {
    resolveFormulaValidationMessage,
    validateFormulaDraft,
} from "@/shared/reportFormula/validateFormulaDraft";

const SCROLL_CONTAINER_ID = "formula-upsert-modal-scroll";
const DIALOG_HEIGHT_FRACTION = 0.62;

/** Pseudo object name for formula operands in the insert picker. */
export const FORMULA_OPERAND_OBJECT_NAME = "__formulas__";

export type FormulaOperandOption = {
    reference: string;
    label: string;
    outputKey: string;
    kind?: "field" | "formula";
    formulaFormat?: FormulaResultFormat;
};

type FormatOption = {
    value: FormulaResultFormat;
    label: string;
};

type AggregationOption = {
    value: ReportFormula["aggregation"];
    label: string;
};

export interface FormulaUpsertModalProps {
    open: boolean;
    mode: "add" | "edit";
    editingId: string | null;
    initialFormula: ReportFormula | null;
    defaultLabel: string;
    existingFormulas: ReportFormula[];
    operandOptions: FormulaOperandOption[];
    reportTableNames: string[];
    tableOptions: Array<{ name: string; label: string }>;
    tablesMetadata: Array<{
        name: string;
        fields: Array<{ name: string; type: string; label?: string }>;
    }>;
    isGrouped: boolean;
    onClose: () => void;
    onSave: (formula: ReportFormula) => void;
}

function appendExpressionToken(prev: string, token: string): string {
    return prev ? `${prev} ${token}` : token;
}

function isFormulaOperandOption(option: FormulaOperandOption): boolean {
    return (
        option.kind === "formula" ||
        isFormulaOperandReference(option.reference)
    );
}

function themeSpacingToPx(value: string): number {
    return Number.parseFloat(value.replace("px", ""));
}

const FormulaUpsertModal: React.FC<FormulaUpsertModalProps> = ({
    open,
    mode,
    editingId,
    initialFormula,
    defaultLabel,
    existingFormulas,
    operandOptions,
    reportTableNames,
    tableOptions,
    tablesMetadata,
    isGrouped,
    onClose,
    onSave,
}) => {
    const { t, i18n } = useTranslation(["reports", "common"]);
    const theme = useTheme();
    const isRTL = i18n.language === "he";
    const isHebrew = i18n.language === "he";

    const objectLabel = t("formulas.object", { defaultValue: "Object" });
    const insertFieldLabel = t("formulas.insert_field", {
        defaultValue: "Insert field",
    });
    const formatLabel = t("formulas.format", { defaultValue: "Format" });
    const aggregationLabel = t("formulas.aggregation", {
        defaultValue: "Aggregation",
    });
    const formulaLabel = t("formulas.field_formula", { defaultValue: "Formula" });
    const expressionLabel = t("formulas.expression", {
        defaultValue: "Expression",
    });
    const panelRadiusPx = `${theme.appButton.sizeMedium.borderRadius}px`;

    const hebrewHelperTextFieldSx = useMemo(
        () =>
            isRTL
                ? {
                      "&:has(.MuiFormHelperText-root) > .MuiInputLabel-root:not(.MuiInputLabel-shrink)":
                          {
                              height: "auto",
                              bottom: OUTLINED_LABEL_HELPER_OFFSET,
                          },
                  }
                : undefined,
        [isRTL]
    );

    const dialogResizeOptions = useMemo(
        () => ({
            initialWidth: themeSpacingToPx(theme.spacing(52.5)),
            heightFraction: DIALOG_HEIGHT_FRACTION,
            minWidth: themeSpacingToPx(theme.spacing(45)),
            maxWidth: themeSpacingToPx(theme.spacing(75)),
            minHeight: themeSpacingToPx(theme.spacing(42.5)),
        }),
        [theme]
    );

    const dialogPaperSx = useMemo(
        () => ({
            "& > .MuiDialogTitle-root": {
                flexShrink: 0,
            },
            "& > .MuiDialogContent-root": {
                flex: "1 1 auto",
                minHeight: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
            },
            "& > .MuiDialogActions-root": {
                flexShrink: 0,
                backgroundColor: theme.palette.background.paper,
                borderTop: "none",
                paddingTop: theme.spacing(2),
            },
        }),
        [theme]
    );

    const formatOptions = useMemo<FormatOption[]>(
        () => [
            {
                value: "number",
                label: t("formulas.format_number", {
                    defaultValue: "Number",
                }),
            },
            {
                value: "currency",
                label: t("formulas.format_currency", {
                    defaultValue: "Currency",
                }),
            },
            {
                value: "percentage",
                label: t("formulas.format_percentage", {
                    defaultValue: "Percentage",
                }),
            },
        ],
        [t]
    );

    const aggregationOptions = useMemo<AggregationOption[]>(
        () =>
            FORMULA_AGGREGATION_TYPES.map((agg) => ({
                value: agg,
                label: agg,
            })),
        []
    );

    const [expressionDraft, setExpressionDraft] = useState("");
    const [labelDraft, setLabelDraft] = useState("");
    const [formatDraft, setFormatDraft] =
        useState<FormulaResultFormat>("number");
    const [aggregationDraft, setAggregationDraft] = useState<
        ReportFormula["aggregation"] | ""
    >("");
    const [validationError, setValidationError] = useState<string | null>(null);
    const [validationWarning, setValidationWarning] = useState<string | null>(
        null
    );
    const [selectedOperandReference, setSelectedOperandReference] =
        useState("");
    const [selectedTableName, setSelectedTableName] = useState("");

    const selectedFormatOption = useMemo(
        () => formatOptions.find((option) => option.value === formatDraft),
        [formatDraft, formatOptions]
    );

    const selectedAggregationOption = useMemo(
        () =>
            aggregationOptions.find(
                (option) => option.value === aggregationDraft
            ) ?? null,
        [aggregationDraft, aggregationOptions]
    );

    const filteredOperandOptions = useMemo(() => {
        if (!selectedTableName) {
            return operandOptions;
        }
        if (selectedTableName === FORMULA_OPERAND_OBJECT_NAME) {
            return operandOptions.filter(isFormulaOperandOption);
        }
        return operandOptions.filter((o) =>
            o.reference.startsWith(`${selectedTableName}.`)
        );
    }, [operandOptions, selectedTableName]);

    const formatFilteredOperandOptions = useMemo(() => {
        const fieldOptions = filterFormulaOperandOptionsForFormat(
            filteredOperandOptions.filter((o) => !isFormulaOperandOption(o)),
            formatDraft,
            tablesMetadata
        );
        const formulaOptions = filteredOperandOptions.filter((o) => {
            if (!isFormulaOperandOption(o)) {
                return false;
            }
            if (formatDraft === "currency") {
                return o.formulaFormat === "currency";
            }
            if (formatDraft === "percentage") {
                return o.formulaFormat === "percentage";
            }
            return true;
        });
        return [...fieldOptions, ...formulaOptions];
    }, [filteredOperandOptions, formatDraft, tablesMetadata]);

    const selectedTableOption = useMemo(
        () => tableOptions.find((table) => table.name === selectedTableName) ?? null,
        [tableOptions, selectedTableName]
    );

    const selectedOperandOption = useMemo(
        () =>
            formatFilteredOperandOptions.find(
                (option) => option.reference === selectedOperandReference
            ) ?? null,
        [formatFilteredOperandOptions, selectedOperandReference]
    );

    useEffect(() => {
        if (
            selectedOperandReference &&
            !formatFilteredOperandOptions.some(
                (option) => option.reference === selectedOperandReference
            )
        ) {
            setSelectedOperandReference("");
        }
    }, [formatFilteredOperandOptions, selectedOperandReference]);

    useEffect(() => {
        if (!open) {
            return;
        }
        if (mode === "edit" && initialFormula) {
            setExpressionDraft(
                expressionToEditTime(
                    initialFormula.expression,
                    existingFormulas
                )
            );
            setLabelDraft(initialFormula.label);
            setFormatDraft(initialFormula.format);
            setAggregationDraft(initialFormula.aggregation || "");
        } else {
            setExpressionDraft("");
            setLabelDraft(defaultLabel);
            setFormatDraft("number");
            setAggregationDraft("");
        }
        setValidationError(null);
        setValidationWarning(null);
        setSelectedOperandReference("");
        setSelectedTableName(tableOptions[0]?.name ?? "");
    }, [open, mode, initialFormula, defaultLabel, existingFormulas, tableOptions]);

    const insertOperand = useCallback(
        (reference: string) => {
            const option = operandOptions.find(
                (entry) => entry.reference === reference
            );
            let token: string;
            if (option && isFormulaOperandOption(option)) {
                token = buildEditTimeFormulaReference(option.label);
            } else if (isFormulaOperandReference(reference)) {
                token = buildEditTimeFormulaReference(
                    reference.slice("formula:".length)
                );
            } else {
                token = buildCanonicalFieldReference(
                    reference.split(".")[0],
                    reference.split(".").slice(1).join(".")
                );
            }
            setExpressionDraft((prev) => appendExpressionToken(prev, token));
        },
        [operandOptions]
    );
    const handleInsertField = useCallback(() => {
        if (!selectedOperandReference) {
            return;
        }
        insertOperand(selectedOperandReference);
    }, [insertOperand, selectedOperandReference]);

    const handleSave = () => {
        const result = validateFormulaDraft({
            label: labelDraft,
            expression: expressionDraft,
            format: formatDraft,
            aggregation: aggregationDraft,
            editingId: mode === "add" ? null : editingId,
            locale: i18n.language,
            reportTableNames,
            tablesMetadata,
            existingFormulas,
            isGrouped,
        });
        if (!result.ok) {
            setValidationWarning(null);
            setValidationError(
                resolveFormulaValidationMessage(t, result)
            );
            return;
        }
        setValidationError(null);
        if (result.warning) {
            // Soft warning: still save. Banner also shows while editing.
            setValidationWarning(
                resolveFormulaValidationMessage(t, result.warning)
            );
        } else {
            setValidationWarning(null);
        }
        onSave(result.formula);
        onClose();
    };

    const expressionHelperText =
        operandOptions.length === 0
            ? t("formulas.no_operands_hint", {
                  defaultValue:
                      "Select numeric report fields first, then build your expression.",
              })
            : formatFilteredOperandOptions.length === 0
              ? t("formulas.no_operands_for_format", {
                    format: formatDraft,
                    defaultValue:
                        "No fields match the selected format for this object.",
                })
              : t("formulas.expression_hint", {
                    defaultValue:
                        "Use [Table.field], numbers, + - * / and parentheses. Insurance Premium Rate and Registration Fee are percentages automatically (do not divide by 100).",
                });

    const redundantPercentDivisionWarning = useMemo(() => {
        try {
            const allowed = getFormulaOperandReferencesFromTables(
                reportTableNames,
                tablesMetadata
            );
            const converted = expressionToStorage(
                expressionDraft,
                existingFormulas,
                allowed,
                {
                    draftId: editingId,
                    draftLabel: labelDraft,
                }
            );
            const normalized = normalizeFormulaExpression(
                converted,
                i18n.language.startsWith("he") ? "," : "."
            );
            if (!expressionHasRedundantAutoScalePercentDivision(normalized)) {
                return null;
            }
            return t("formulas.redundant_percent_division_warning", {
                defaultValue:
                    "Insurance Premium Rate and Registration Fee are already treated as percentages in formulas. Remove /100 or results will be 100× too small.",
            });
        } catch {
            return null;
        }
    }, [
        expressionDraft,
        existingFormulas,
        editingId,
        labelDraft,
        reportTableNames,
        tablesMetadata,
        i18n.language,
        t,
    ]);

    const displayedWarning = validationWarning || redundantPercentDivisionWarning;

    return (
        <AppDialog
            open={open}
            onClose={onClose}
            drag
            align
            slide
            resize
            isRTL={isRTL}
            scrollContainerId={SCROLL_CONTAINER_ID}
            resizeOptions={dialogResizeOptions}
            title={
                mode === "add"
                    ? t("formulas.add", { defaultValue: "Add formula" })
                    : t("formulas.edit", { defaultValue: "Edit formula" })
            }
            titleIcon={
                <Calculate aria-hidden="true" />
            }
            ariaLabelledBy="formula-upsert-dialog-title"
            ariaDescribedBy="formula-upsert-dialog-description"
            paperSx={{
                sx: dialogPaperSx,
            }}
            actions={
                <>
                    <Button
                        onClick={onClose}
                        variant="outlined"
                        size="small"
                        className="cancel-button"
                        fullWidth={false}
                        sx={{
                            mr: isRTL ? 0 : theme.spacing(1),
                            ml: isRTL ? theme.spacing(1) : 0,
                        }}
                    >
                        {t("actions.cancel", { ns: "common" })}
                    </Button>
                    <Button
                        onClick={handleSave}
                        variant="contained"
                        size="small"
                        className="save-button"
                        fullWidth={false}
                        sx={{
                            direction: isRTL ? "rtl" : "ltr",
                        }}
                    >
                        {t("actions.save", { ns: "common" })}
                    </Button>
                </>
            }
        >
            <Box
                id="formula-upsert-dialog-description"
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    flex: "1 1 auto",
                    minHeight: 0,
                    overflow: "hidden",
                    direction: isRTL ? "rtl" : "ltr",
                }}
            >
                <ModalScrollBox id={SCROLL_CONTAINER_ID} isRTL={isRTL}>
                    <Stack spacing={1.5} sx={{ pt: 1.5 }}>
                        <TextField
                            label={formulaLabel}
                            value={labelDraft}
                            onChange={(e) => setLabelDraft(e.target.value)}
                            size="small"
                            fullWidth
                            {...(isHebrew && { "data-hebrew": true })}
                            dir={isRTL ? "rtl" : "ltr"}
                        />

                        <Autocomplete
                            fullWidth
                            options={formatOptions}
                            value={selectedFormatOption}
                            onChange={(_, newValue) => {
                                setFormatDraft(newValue?.value ?? "number");
                            }}
                            getOptionLabel={(option) => option.label}
                            isOptionEqualToValue={(option, value) =>
                                option.value === value.value
                            }
                            disableClearable
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
                                        }}
                                    >
                                        <Typography
                                            sx={{
                                                direction: isRTL ? "rtl" : "ltr",
                                                textAlign: isRTL ? "right" : "left",
                                                width: "100%",
                                            }}
                                        >
                                            {option.label}
                                        </Typography>
                                    </li>
                                );
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    margin="none"
                                    label={formatLabel}
                                    {...(isHebrew && { "data-hebrew": true })}
                                    dir={isRTL ? "rtl" : "ltr"}
                                />
                            )}
                        />


                        {isGrouped && (
                            <Autocomplete
                                fullWidth
                                options={aggregationOptions}
                                value={selectedAggregationOption}
                                onChange={(_, newValue) => {
                                    setAggregationDraft(newValue?.value ?? "");
                                }}
                                getOptionLabel={(option) => option.label}
                                isOptionEqualToValue={(option, value) =>
                                    option.value === value.value
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
                                            }}
                                        >
                                            <Typography
                                                sx={{
                                                    direction: isRTL ? "rtl" : "ltr",
                                                    textAlign: isRTL ? "right" : "left",
                                                    width: "100%",
                                                }}
                                            >
                                                {option.label}
                                            </Typography>
                                        </li>
                                    );
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        margin="none"
                                        label={aggregationLabel}
                                        {...(isHebrew && { "data-hebrew": true })}
                                        dir={isRTL ? "rtl" : "ltr"}
                                    />
                                )}
                            />
                        )}

                        <Box
                            sx={{
                                border: `1px solid ${theme.palette.divider}`,
                                borderRadius: panelRadiusPx,
                                p: theme.spacing(1.5),
                            }}
                        >
                            <Stack
                                spacing={0}
                                sx={{
                                    width: "100%",
                                    maxWidth: 300,
                                    minWidth: 0,
                                    alignSelf: isRTL ? "flex-end" : "flex-start",
                                    "& .MuiFormControl-root": {
                                        margin: 0,
                                    },
                                    "& .MuiTextField-root": {
                                        margin: 0,
                                    },
                                }}
                            >
                                <Autocomplete
                                    fullWidth
                                    options={tableOptions}
                                    value={selectedTableOption}
                                    onChange={(_, newValue) => {
                                        setSelectedTableName(newValue?.name ?? "");
                                        setSelectedOperandReference("");
                                    }}
                                    getOptionLabel={(option) => option.label}
                                    isOptionEqualToValue={(option, value) =>
                                        option.name === value.name
                                    }
                                    disabled={tableOptions.length === 0}
                                    size="small"
                                    dir={isRTL ? "rtl" : "ltr"}
                                    sx={{ mb: 0.5 }}
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
                                                }}
                                            >
                                                <Typography
                                                    sx={{
                                                        direction: isRTL ? "rtl" : "ltr",
                                                        textAlign: isRTL ? "right" : "left",
                                                        width: "100%",
                                                    }}
                                                >
                                                    {option.label}
                                                </Typography>
                                            </li>
                                        );
                                    }}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            margin="none"
                                            label={objectLabel}
                                            {...(isHebrew && { "data-hebrew": true })}
                                            dir={isRTL ? "rtl" : "ltr"}
                                        />
                                    )}
                                />

                                <Stack
                                    direction="row"
                                    spacing={0}
                                    alignItems="center"
                                    sx={{
                                        width: "100%",
                                        columnGap: theme.spacing(1.5),
                                    }}
                                >
                                    <Autocomplete
                                        sx={{ flex: 1, minWidth: 0 }}
                                        options={formatFilteredOperandOptions}
                                        value={selectedOperandOption}
                                        onChange={(_, newValue) => {
                                            setSelectedOperandReference(
                                                newValue?.reference ?? ""
                                            );
                                        }}
                                        getOptionLabel={(option) => option.label}
                                        getOptionKey={(option) => option.reference}
                                        isOptionEqualToValue={(option, value) =>
                                            option.reference === value.reference
                                        }
                                        disabled={formatFilteredOperandOptions.length === 0}
                                        size="small"
                                        dir={isRTL ? "rtl" : "ltr"}
                                        {...(isHebrew && {
                                            "data-hebrew": true,
                                            "data-rtl": true,
                                        })}
                                        renderOption={(props, option) => {
                                            const { key: _key, ...otherProps } = props;
                                            return (
                                                <li
                                                    key={option.reference}
                                                    {...otherProps}
                                                    style={{
                                                        direction: isRTL ? "rtl" : "ltr",
                                                        textAlign: isRTL ? "right" : "left",
                                                    }}
                                                >
                                                    <Typography
                                                        sx={{
                                                            direction: isRTL ? "rtl" : "ltr",
                                                            textAlign: isRTL ? "right" : "left",
                                                            width: "100%",
                                                        }}
                                                    >
                                                        {option.label}
                                                    </Typography>
                                                </li>
                                            );
                                        }}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                margin="none"
                                                label={insertFieldLabel}
                                                {...(isHebrew && { "data-hebrew": true })}
                                                dir={isRTL ? "rtl" : "ltr"}
                                            />
                                        )}
                                    />
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={handleInsertField}
                                        disabled={!selectedOperandReference}
                                        sx={{ flexShrink: 0 }}
                                    >
                                        {t("formulas.insert", {
                                            defaultValue: "Insert",
                                        })}
                                    </Button>
                                </Stack>
                            </Stack>
                        </Box>

                        <TextField
                            label={expressionLabel}
                            value={expressionDraft}
                            onChange={(e) => setExpressionDraft(e.target.value)}
                            size="small"
                            fullWidth
                            multiline
                            minRows={3}
                            helperText={expressionHelperText}
                            {...(isHebrew && { "data-hebrew": true })}
                            dir={isRTL ? "rtl" : "ltr"}
                            sx={hebrewHelperTextFieldSx}
                        />

                        {displayedWarning && (
                            <Alert severity="warning">
                                {displayedWarning}
                            </Alert>
                        )}

                        {validationError && (
                            <Typography variant="caption" color="error">
                                {validationError}
                            </Typography>
                        )}
                    </Stack>
                </ModalScrollBox>
            </Box>
        </AppDialog>
    );
};

export default FormulaUpsertModal;
