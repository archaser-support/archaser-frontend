import { Prisma } from "@prisma/client";

import {
    collectFieldRefsFromAst,
    isFormulaOperandReference,
    parseFormulaExpression,
    type FormulaAstNode,
} from "@/shared/reportFormula/parser";
import { formulaLabelCollidesWithField } from "@/shared/reportFormula/editTimeExpression";
import {
    type FormulaAggregation,
    type ReportFormula,
} from "@/shared/reportFormula/types";
import { isFormulaAutoScalePercentReference } from "@/shared/reportFormula/autoScalePercentFields";

export {
    buildCanonicalFieldReference,
    buildCanonicalFormulaReference,
    extractFieldReferences,
    FormulaParseError,
    isFormulaOperandReference,
    normalizeFormulaExpression,
    parseFormulaExpression,
} from "@/shared/reportFormula/parser";

export interface ValidateFormulaOptions {
    allowedFieldReferences: Set<string>;
    /** Known formula ids in the same report (for `[formula:<id>]` operands). */
    knownFormulaIds: Set<string>;
    /** Formula labels (lowercased) — used to reject label-form references. */
    formulaLabelsLower: Map<string, string>;
    isGroupedReport: boolean;
    existingLabelsLower: Set<string>;
}

export function validateFormulaDefinition(
    formula: ReportFormula,
    options: ValidateFormulaOptions
): void {
    if (!formula.id?.trim()) {
        throw new Error("Formula id is required");
    }
    if (!formula.label?.trim()) {
        throw new Error("Formula label is required");
    }
    const labelLower = formula.label.trim().toLowerCase();
    if (options.existingLabelsLower.has(labelLower)) {
        throw new Error(`Duplicate formula label: ${formula.label}`);
    }
    const collidingField = formulaLabelCollidesWithField(
        formula.label,
        options.allowedFieldReferences
    );
    if (collidingField) {
        throw new Error(
            `Formula label cannot match an allowed field name: ${collidingField}`
        );
    }

    if (
        formula.format !== "number" &&
        formula.format !== "currency" &&
        formula.format !== "percentage"
    ) {
        throw new Error(`Invalid formula format: ${formula.format}`);
    }

    if (formula.format === "currency") {
        if (!formula.currencySource?.trim()) {
            throw new Error("Currency formulas require an amount field in the expression");
        }
        if (!options.allowedFieldReferences.has(formula.currencySource)) {
            throw new Error(
                `Currency source must reference an available numeric field: ${formula.currencySource}`
            );
        }
    }

    if (options.isGroupedReport) {
        if (!formula.aggregation) {
            throw new Error(
                `Formula "${formula.label}" requires an aggregation for grouped reports`
            );
        }
        if (!["SUM", "AVG", "MIN", "MAX"].includes(formula.aggregation)) {
            throw new Error(`Invalid formula aggregation: ${formula.aggregation}`);
        }
    } else if (formula.aggregation) {
        throw new Error(
            `Formula "${formula.label}" cannot have aggregation on ungrouped reports`
        );
    }

    const ast = parseFormulaExpression(formula.expression);
    const refs = collectFieldRefsFromAst(ast);
    if (refs.length === 0) {
        throw new Error(
            `Formula "${formula.label}" must reference at least one report field`
        );
    }
    for (const ref of refs) {
        if (isFormulaOperandReference(ref)) {
            const formulaId = ref.slice("formula:".length);
            if (formulaId === formula.id) {
                throw new Error(
                    `Formula "${formula.label}" cannot reference itself`
                );
            }
            if (!options.knownFormulaIds.has(formulaId)) {
                throw new Error(
                    `Formula references unknown formula id: ${formulaId}`
                );
            }
            continue;
        }

        // Reject display-label formula refs (e.g. [Premium]) — only [formula:<id>] is allowed.
        // Allowed field names win when a formula label collides (slice 02 hardens label creation).
        const labelMatch = options.formulaLabelsLower.get(ref.toLowerCase());
        if (labelMatch && !options.allowedFieldReferences.has(ref)) {
            throw new Error(
                `Formula references must use [formula:<id>] (not label "${labelMatch}")`
            );
        }

        if (!options.allowedFieldReferences.has(ref)) {
            throw new Error(`Formula references unavailable field: ${ref}`);
        }
    }
}

export type FormulaRowValue = Prisma.Decimal | null;

export type FormulaNullReason =
    | "missing_operand"
    | "div_by_zero"
    | "non_finite"
    | "error";

export type FormulaEvalResult = {
    value: FormulaRowValue;
    /** Set when value is null — missing operands are expected blanks, not warnings. */
    nullReason?: FormulaNullReason;
};

export interface EvaluateFormulaRowContext {
    getFieldValue: (reference: string) => unknown;
}

function evalNull(reason: FormulaNullReason): FormulaEvalResult {
    return { value: null, nullReason: reason };
}

function evalValue(value: Prisma.Decimal): FormulaEvalResult {
    return { value };
}

export function evaluateFormulaAst(
    node: FormulaAstNode,
    ctx: EvaluateFormulaRowContext
): FormulaEvalResult {
    if (node.type === "number") {
        try {
            const d = new Prisma.Decimal(node.value);
            return d.isFinite() ? evalValue(d) : evalNull("non_finite");
        } catch {
            return evalNull("error");
        }
    }
    if (node.type === "field") {
        const value = coerceToDecimal(ctx.getFieldValue(node.reference));
        if (value === null) {
            return evalNull("missing_operand");
        }
        if (isFormulaAutoScalePercentReference(node.reference)) {
            const scaled = value.div(100);
            return scaled.isFinite() ? evalValue(scaled) : evalNull("non_finite");
        }
        return evalValue(value);
    }
    if (node.type === "unary") {
        const operand = evaluateFormulaAst(node.operand, ctx);
        if (operand.value === null) {
            return evalNull(operand.nullReason || "error");
        }
        return evalValue(
            node.operator === "-" ? operand.value.neg() : operand.value
        );
    }
    const left = evaluateFormulaAst(node.left, ctx);
    const right = evaluateFormulaAst(node.right, ctx);
    if (left.value === null || right.value === null) {
        if (
            left.nullReason === "missing_operand" ||
            right.nullReason === "missing_operand"
        ) {
            return evalNull("missing_operand");
        }
        return evalNull(
            left.nullReason || right.nullReason || "error"
        );
    }
    try {
        let result: Prisma.Decimal;
        switch (node.operator) {
            case "+":
                result = left.value.add(right.value);
                break;
            case "-":
                result = left.value.sub(right.value);
                break;
            case "*":
                result = left.value.mul(right.value);
                break;
            case "/":
                if (right.value.isZero()) {
                    return evalNull("div_by_zero");
                }
                result = left.value.div(right.value);
                break;
            default:
                return evalNull("error");
        }
        return result.isFinite() ? evalValue(result) : evalNull("non_finite");
    } catch {
        return evalNull("error");
    }
}

export function evaluateFormulaExpression(
    expression: string,
    ctx: EvaluateFormulaRowContext
): FormulaEvalResult {
    return evaluateFormulaAst(parseFormulaExpression(expression), ctx);
}

function coerceToDecimal(value: unknown): Prisma.Decimal | null {
    if (value === null || value === undefined || value === "") {
        return null;
    }
    if (value instanceof Prisma.Decimal) {
        return value.isFinite() ? value : null;
    }
    if (typeof value === "number") {
        return Number.isFinite(value) ? new Prisma.Decimal(value) : null;
    }
    if (typeof value === "object" && value !== null && "toNumber" in value) {
        try {
            const n = (value as { toNumber: () => number }).toNumber();
            return Number.isFinite(n) ? new Prisma.Decimal(n) : null;
        } catch {
            return null;
        }
    }
    const str = String(value).trim();
    if (!str) {
        return null;
    }
    try {
        const d = new Prisma.Decimal(str);
        return d.isFinite() ? d : null;
    } catch {
        return null;
    }
}

export function aggregateFormulaValues(
    values: Prisma.Decimal[],
    aggregation: FormulaAggregation
): Prisma.Decimal | null {
    if (values.length === 0) {
        return null;
    }
    switch (aggregation) {
        case "SUM": {
            let sum = new Prisma.Decimal(0);
            for (const v of values) {
                sum = sum.add(v);
            }
            return sum.isFinite() ? sum : null;
        }
        case "AVG": {
            let sum = new Prisma.Decimal(0);
            for (const v of values) {
                sum = sum.add(v);
            }
            const avg = sum.div(values.length);
            return avg.isFinite() ? avg : null;
        }
        case "MIN": {
            let min = values[0];
            for (let i = 1; i < values.length; i++) {
                if (values[i].lt(min)) {
                    min = values[i];
                }
            }
            return min;
        }
        case "MAX": {
            let max = values[0];
            for (let i = 1; i < values.length; i++) {
                if (values[i].gt(max)) {
                    max = values[i];
                }
            }
            return max;
        }
        default:
            return null;
    }
}

export function decimalToNumberOrNull(value: Prisma.Decimal | null): number | null {
    if (value === null) {
        return null;
    }
    try {
        const n = value.toNumber();
        return Number.isFinite(n) ? n : null;
    } catch {
        return null;
    }
}
