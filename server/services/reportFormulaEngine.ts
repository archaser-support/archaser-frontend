import { Prisma } from "@prisma/client";

import {
    collectFieldRefsFromAst,
    parseFormulaExpression,
    type FormulaAstNode,
} from "@/shared/reportFormula/parser";
import {
    type FormulaAggregation,
    type ReportFormula,
} from "@/shared/reportFormula/types";

export {
    buildCanonicalFieldReference,
    extractFieldReferences,
    FormulaParseError,
    normalizeFormulaExpression,
    parseFormulaExpression,
} from "@/shared/reportFormula/parser";

export interface ValidateFormulaOptions {
    allowedFieldReferences: Set<string>;
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
        if (ref.startsWith("formula:")) {
            throw new Error("Formula-to-formula references are not supported");
        }
        if (!options.allowedFieldReferences.has(ref)) {
            throw new Error(`Formula references unavailable field: ${ref}`);
        }
    }
}

export type FormulaRowValue = Prisma.Decimal | null;

export interface EvaluateFormulaRowContext {
    getFieldValue: (reference: string) => unknown;
}

export function evaluateFormulaAst(
    node: FormulaAstNode,
    ctx: EvaluateFormulaRowContext
): FormulaRowValue {
    if (node.type === "number") {
        try {
            const d = new Prisma.Decimal(node.value);
            return d.isFinite() ? d : null;
        } catch {
            return null;
        }
    }
    if (node.type === "field") {
        return coerceToDecimal(ctx.getFieldValue(node.reference));
    }
    if (node.type === "unary") {
        const val = evaluateFormulaAst(node.operand, ctx);
        if (val === null) {
            return null;
        }
        return node.operator === "-" ? val.neg() : val;
    }
    const left = evaluateFormulaAst(node.left, ctx);
    const right = evaluateFormulaAst(node.right, ctx);
    if (left === null || right === null) {
        return null;
    }
    try {
        let result: Prisma.Decimal;
        switch (node.operator) {
            case "+":
                result = left.add(right);
                break;
            case "-":
                result = left.sub(right);
                break;
            case "*":
                result = left.mul(right);
                break;
            case "/":
                if (right.isZero()) {
                    return null;
                }
                result = left.div(right);
                break;
            default:
                return null;
        }
        return result.isFinite() ? result : null;
    } catch {
        return null;
    }
}

export function evaluateFormulaExpression(
    expression: string,
    ctx: EvaluateFormulaRowContext
): FormulaRowValue {
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
