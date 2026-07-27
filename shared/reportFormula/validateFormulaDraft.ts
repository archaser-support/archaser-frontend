import {
    generateFormulaId,
    getFormulaOperandReferencesFromTables,
    resolveFormulaCurrencySourceFromExpression,
} from "@/shared/reportFormula/columnOrder";
import {
    extractFieldReferences,
    FormulaParseError,
    type FormulaParseErrorCode,
    normalizeFormulaExpression,
    parseFormulaExpression,
} from "@/shared/reportFormula/parser";
import type { FormulaResultFormat, ReportFormula } from "@/shared/reportFormula/types";

export type FormulaValidationErrorCode =
    | FormulaParseErrorCode
    | "label_required"
    | "duplicate_label"
    | "no_field_reference"
    | "field_reference_unavailable"
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
    result: FormulaValidationFailure
): string {
    return t(result.messageKey, {
        defaultValue: result.defaultMessage,
        ...result.interpolation,
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

    let normalized: string;
    try {
        normalized = normalizeFormulaExpression(
            input.expression,
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

    const allowedRefs = getFormulaOperandReferencesFromTables(
        input.reportTableNames,
        input.tablesMetadata
    );
    for (const ref of refs) {
        if (!allowedRefs.has(ref)) {
            return validationFailure(
                "field_reference_unavailable",
                "formulas.invalid_reference",
                `Invalid or unavailable field reference: ${ref}`,
                { ref }
            );
        }
    }

    let currencySource: string | undefined;
    if (input.format === "currency") {
        currencySource =
            resolveFormulaCurrencySourceFromExpression(
                normalized,
                input.tablesMetadata
            ) || undefined;
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

    const id =
        input.formulaId ||
        input.editingId ||
        generateFormulaId();

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
