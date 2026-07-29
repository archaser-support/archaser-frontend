import {
    parseFormulaExpression,
    type FormulaAstNode,
} from "@/shared/reportFormula/parser";

/**
 * Policy pricing rates stored as percent points (3 = 3%).
 * Formula evaluation divides these by 100 once when reading the field.
 */
export const FORMULA_AUTO_SCALE_PERCENT_FIELD_NAMES = new Set([
    "cost_percent",
    "registration_fee_percent",
]);

export function getFormulaFieldNameFromReference(reference: string): string {
    const dot = reference.indexOf(".");
    return dot >= 0 ? reference.slice(dot + 1) : reference;
}

export function isFormulaAutoScalePercentReference(reference: string): boolean {
    return FORMULA_AUTO_SCALE_PERCENT_FIELD_NAMES.has(
        getFormulaFieldNameFromReference(reference)
    );
}

function astContainsAutoScalePercentField(node: FormulaAstNode): boolean {
    if (node.type === "field") {
        return isFormulaAutoScalePercentReference(node.reference);
    }
    if (node.type === "number") {
        return false;
    }
    if (node.type === "unary") {
        return astContainsAutoScalePercentField(node.operand);
    }
    return (
        astContainsAutoScalePercentField(node.left) ||
        astContainsAutoScalePercentField(node.right)
    );
}

function findRedundantAutoScalePercentDivision(node: FormulaAstNode): boolean {
    if (node.type === "binary") {
        if (
            node.operator === "/" &&
            node.right.type === "number" &&
            Number(node.right.value) === 100 &&
            astContainsAutoScalePercentField(node.left)
        ) {
            return true;
        }
        return (
            findRedundantAutoScalePercentDivision(node.left) ||
            findRedundantAutoScalePercentDivision(node.right)
        );
    }
    if (node.type === "unary") {
        return findRedundantAutoScalePercentDivision(node.operand);
    }
    return false;
}

/** True when expression divides an auto-scaled rate field by literal 100. */
export function expressionHasRedundantAutoScalePercentDivision(
    normalizedExpression: string
): boolean {
    try {
        return findRedundantAutoScalePercentDivision(
            parseFormulaExpression(normalizedExpression)
        );
    } catch {
        return false;
    }
}
