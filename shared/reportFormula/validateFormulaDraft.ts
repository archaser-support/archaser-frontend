import {
    generateFormulaId,
    getFormulaOperandReferencesFromTables,
    resolveAllFormulaCurrencySources,
    resolveFormulaCurrencySourceFromExpression,
} from "@/shared/reportFormula/columnOrder";
import { expressionHasRedundantAutoScalePercentDivision } from "@/shared/reportFormula/autoScalePercentFields";
import {
    expressionToStorage,
    formulaLabelCollidesWithField,
} from "@/shared/reportFormula/editTimeExpression";
import {
    validateFormulaDependencyGraph,
    wouldCreateFormulaCycle,
} from "@/shared/reportFormula/formulaDependencies";
import {
    extractFieldReferences,
    FormulaParseError,
    type FormulaParseErrorCode,
    isFormulaOperandReference,
    normalizeFormulaExpression,
    parseFormulaExpression,
} from "@/shared/reportFormula/parser";
import type { FormulaResultFormat, ReportFormula } from "@/shared/reportFormula/types";

export type FormulaValidationErrorCode =
    | FormulaParseErrorCode
    | "label_required"
    | "duplicate_label"
    | "label_collides_with_field"
    | "no_field_reference"
    | "field_reference_unavailable"
    | "unknown_formula_reference"
    | "formula_cycle"
    | "formula_self_reference"
    | "formula_label_reference"
    | "currency_field_required"
    | "aggregation_required"
    | "aggregation_not_allowed";

export type FormulaValidationFailure = {
    ok: false;
    errorCode: FormulaValidationErrorCode;
    messageKey: string;
    defaultMessage: string;
    interpolation?: Record<string, string | number>;
};

export type FormulaValidationSuccess = {
    ok: true;
    formula: ReportFormula;
    warning?: {
        messageKey: string;
        defaultMessage: string;
    };
};

export type ValidateFormulaDraftInput = {
    label: string;
    expression: string;
    format: FormulaResultFormat;
    aggregation?: ReportFormula["aggregation"] | "";
    editingId: string | null;
    formulaId?: string | null;
    locale: string;
    reportTableNames: string[];
    tablesMetadata: Array<{
        name: string;
        fields: Array<{ name: string; type: string; label?: string }>;
    }>;
    existingFormulas: ReportFormula[];
    isGrouped: boolean;
};

const PARSE_ERROR_MESSAGES: Record<
    FormulaParseErrorCode,
    { messageKey: string; defaultMessage: string }
> = {
    empty_expression: {
        messageKey: "formulas.errors.empty_expression",
        defaultMessage: "Expression is required",
    },
    expression_too_long: {
        messageKey: "formulas.errors.expression_too_long",
        defaultMessage: "Expression is too long",
    },
    unexpected_character: {
        messageKey: "formulas.errors.unexpected_character",
        defaultMessage: "Expression contains an invalid character",
    },
    unclosed_parenthesis: {
        messageKey: "formulas.errors.unclosed_parenthesis",
        defaultMessage: "Expression has an unclosed parenthesis",
    },
    unclosed_reference: {
        messageKey: "formulas.errors.unclosed_reference",
        defaultMessage: "Expression has an unclosed field reference",
    },
    invalid_reference: {
        messageKey: "formulas.errors.invalid_reference",
        defaultMessage: "Expression contains an invalid field reference",
    },
    missing_operand: {
        messageKey: "formulas.errors.missing_operand",
        defaultMessage: "Expression is missing an operand",
    },
    overflow: {
        messageKey: "formulas.errors.overflow",
        defaultMessage: "Expression is too complex",
    },
    prohibited_token: {
        messageKey: "formulas.errors.prohibited_token",
        defaultMessage: "Expression contains a prohibited token",
    },
};

function validationFailure(
    errorCode: FormulaValidationErrorCode,
    messageKey: string,
    defaultMessage: string,
    interpolation?: Record<string, string | number>
): FormulaValidationFailure {
    return { ok: false, errorCode, messageKey, defaultMessage, interpolation };
}

function getDecimalSeparator(locale: string): "." | "," {
    return locale.startsWith("he") ? "," : ".";
}

export function resolveFormulaValidationMessage(
    t: (key: string, options?: Record<string, unknown>) => string,
    result: FormulaValidationFailure | NonNullable<FormulaValidationSuccess["warning"]>
): string {
    return t(result.messageKey, {
        defaultValue: result.defaultMessage,
        ...("interpolation" in result ? result.interpolation : undefined),
    });
}

export function validateFormulaDraft(
    input: ValidateFormulaDraftInput
): FormulaValidationSuccess | FormulaValidationFailure {
    const label = input.label.trim();
    if (!label) {
        return validationFailure(
            "label_required",
            "formulas.field_formula_required",
            "Formula name is required"
        );
    }

    const duplicate = input.existingFormulas.some(
        (f) =>
            f.label.toLowerCase() === label.toLowerCase() &&
            f.id !== input.editingId
    );
    if (duplicate) {
        return validationFailure(
            "duplicate_label",
            "formulas.duplicate_label",
            "Formula label must be unique"
        );
    }

    const allowedRefs = getFormulaOperandReferencesFromTables(
        input.reportTableNames,
        input.tablesMetadata
    );
    const collidingField = formulaLabelCollidesWithField(label, allowedRefs);
    if (collidingField) {
        return validationFailure(
            "label_collides_with_field",
            "formulas.errors.label_collides_with_field",
            `Formula label cannot match an allowed field name (${collidingField})`,
            { field: collidingField }
        );
    }

    const id =
        input.formulaId ||
        input.editingId ||
        generateFormulaId();

    // Convert edit-time `[Label]` tokens to `[formula:<id>]` before parse.
    const storageExpression = expressionToStorage(
        input.expression,
        input.existingFormulas,
        allowedRefs,
        { draftId: id, draftLabel: label }
    );

    let normalized: string;
    try {
        normalized = normalizeFormulaExpression(
            storageExpression,
            getDecimalSeparator(input.locale)
        );
        parseFormulaExpression(normalized);
    } catch (e) {
        if (e instanceof FormulaParseError) {
            const mapped = PARSE_ERROR_MESSAGES[e.code];
            return validationFailure(
                e.code,
                mapped.messageKey,
                mapped.defaultMessage
            );
        }
        return validationFailure(
            "unexpected_character",
            "formulas.errors.unexpected_character",
            e instanceof Error ? e.message : String(e)
        );
    }

    const refs = extractFieldReferences(normalized);
    if (refs.length === 0) {
        return validationFailure(
            "no_field_reference",
            "formulas.errors.no_field_reference",
            "Formula must reference at least one report field"
        );
    }

    const knownFormulaIds = new Set(input.existingFormulas.map((f) => f.id));
    knownFormulaIds.add(id);
    const formulaLabelsLower = new Map(
        input.existingFormulas.map((f) => [
            f.label.trim().toLowerCase(),
            f.label.trim(),
        ])
    );
    formulaLabelsLower.set(label.toLowerCase(), label);

    for (const ref of refs) {
        if (isFormulaOperandReference(ref)) {
            const depId = ref.slice("formula:".length);
            if (depId === id) {
                return validationFailure(
                    "formula_self_reference",
                    "formulas.errors.formula_self_reference",
                    "A formula cannot reference itself"
                );
            }
            if (!knownFormulaIds.has(depId)) {
                return validationFailure(
                    "unknown_formula_reference",
                    "formulas.errors.unknown_formula_reference",
                    `Unknown formula reference: ${depId}`,
                    { ref: depId }
                );
            }
            if (wouldCreateFormulaCycle(input.existingFormulas, id, depId)) {
                return validationFailure(
                    "formula_cycle",
                    "formulas.errors.formula_cycle",
                    "Formula references create a dependency cycle"
                );
            }
            continue;
        }

        // After conversion, remaining label-form refs are invalid (fields already won).
        const labelMatch = formulaLabelsLower.get(ref.toLowerCase());
        if (labelMatch && !allowedRefs.has(ref)) {
            return validationFailure(
                "formula_label_reference",
                "formulas.errors.formula_label_reference",
                `Use [formula:<id>] instead of label "${labelMatch}"`,
                { label: labelMatch }
            );
        }

        if (!allowedRefs.has(ref)) {
            return validationFailure(
                "field_reference_unavailable",
                "formulas.invalid_reference",
                `Invalid or unavailable field reference: ${ref}`,
                { ref }
            );
        }
    }

    const draftFormula: ReportFormula = {
        id,
        label,
        expression: normalized,
        format: input.format,
        ...(input.isGrouped && input.aggregation
            ? { aggregation: input.aggregation }
            : {}),
    };

    const formulasForGraph =
        input.editingId == null
            ? [...input.existingFormulas, draftFormula]
            : input.existingFormulas.map((f) =>
                  f.id === id ? draftFormula : f
              );

    const graphError = validateFormulaDependencyGraph(formulasForGraph);
    if (graphError) {
        if (graphError.code === "cycle" || graphError.code === "self_reference") {
            return validationFailure(
                graphError.code === "self_reference"
                    ? "formula_self_reference"
                    : "formula_cycle",
                graphError.code === "self_reference"
                    ? "formulas.errors.formula_self_reference"
                    : "formulas.errors.formula_cycle",
                graphError.code === "self_reference"
                    ? "A formula cannot reference itself"
                    : "Formula references create a dependency cycle"
            );
        }
        if (graphError.code === "unknown_formula") {
            return validationFailure(
                "unknown_formula_reference",
                "formulas.errors.unknown_formula_reference",
                `Unknown formula reference: ${graphError.missingId}`,
                { ref: graphError.missingId }
            );
        }
        if (graphError.code === "no_transitive_field") {
            return validationFailure(
                "no_field_reference",
                "formulas.errors.no_field_reference",
                "Formula must eventually reference at least one report field"
            );
        }
    }

    let currencySource: string | undefined;
    if (input.format === "currency") {
        const resolvedList = resolveAllFormulaCurrencySources(
            formulasForGraph,
            input.tablesMetadata
        );
        const resolvedDraft = resolvedList.find((f) => f.id === id);
        currencySource =
            resolvedDraft?.currencySource ||
            resolveFormulaCurrencySourceFromExpression(
                normalized,
                input.tablesMetadata,
                formulasForGraph
            ) ||
            undefined;
        if (!currencySource) {
            return validationFailure(
                "currency_field_required",
                "formulas.currency_field_required",
                "Currency formulas must reference an amount field in the expression"
            );
        }
    }

    if (input.isGrouped && !input.aggregation) {
        return validationFailure(
            "aggregation_required",
            "formulas.aggregation_required",
            "Aggregation is required for grouped reports"
        );
    }
    if (!input.isGrouped && input.aggregation) {
        return validationFailure(
            "aggregation_not_allowed",
            "formulas.aggregation_not_allowed",
            "Remove aggregation for ungrouped reports"
        );
    }

    const warning = expressionHasRedundantAutoScalePercentDivision(normalized)
        ? {
              messageKey: "formulas.redundant_percent_division_warning",
              defaultMessage:
                  "Insurance Premium Rate and Registration Fee are already treated as percentages in formulas. Remove /100 or results will be 100× too small.",
          }
        : undefined;

    return {
        ok: true,
        formula: {
            id,
            label,
            expression: normalized,
            format: input.format,
            ...(input.format === "currency" && currencySource
                ? { currencySource }
                : {}),
            ...(input.isGrouped && input.aggregation
                ? { aggregation: input.aggregation }
                : {}),
        },
        ...(warning ? { warning } : {}),
    };
}

export function validateAllReportFormulas(
    formulas: ReportFormula[],
    options: {
        locale: string;
        reportTableNames: string[];
        tablesMetadata: ValidateFormulaDraftInput["tablesMetadata"];
        isGrouped: boolean;
    }
): Record<string, FormulaValidationFailure> {
    const errors: Record<string, FormulaValidationFailure> = {};
    for (const formula of formulas) {
        const result = validateFormulaDraft({
            label: formula.label,
            expression: formula.expression,
            format: formula.format,
            aggregation: formula.aggregation || "",
            editingId: formula.id,
            formulaId: formula.id,
            locale: options.locale,
            reportTableNames: options.reportTableNames,
            tablesMetadata: options.tablesMetadata,
            existingFormulas: formulas,
            isGrouped: options.isGrouped,
        });
        if (!result.ok) {
            errors[formula.id] = result;
        }
    }
    return errors;
}
