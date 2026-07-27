export type FormulaResultFormat = "number" | "currency" | "percentage";

export type FormulaAggregation = "SUM" | "AVG" | "MIN" | "MAX";

export const FORMULA_AGGREGATION_TYPES = [
    "SUM",
    "AVG",
    "MIN",
    "MAX",
] as const satisfies readonly FormulaAggregation[];

export const MAX_FORMULAS_PER_REPORT = 10;
export const MAX_FORMULA_EXPRESSION_LENGTH = 500;
export const MAX_FORMULA_AST_DEPTH = 10;

export interface ReportFormula {
    /** Stable generated identity — survives label renames. */
    id: string;
    /** Display label; case-insensitively unique within the report. */
    label: string;
    /** Locale-neutral normalized expression text. */
    expression: string;
    format: FormulaResultFormat;
    /** Output key of a referenced amount field (required when format is currency). */
    currencySource?: string;
    /** Required when the report uses grouping or field aggregation. */
    aggregation?: FormulaAggregation;
}

/** Prefix for formula output / column-order keys. */
export const FORMULA_OUTPUT_KEY_PREFIX = "formula:";

export function getFormulaOutputKey(formulaId: string): string {
    return `${FORMULA_OUTPUT_KEY_PREFIX}${formulaId}`;
}

export function isFormulaOutputKey(key: string): boolean {
    return key.startsWith(FORMULA_OUTPUT_KEY_PREFIX);
}

export function parseFormulaIdFromOutputKey(key: string): string | null {
    if (!isFormulaOutputKey(key)) {
        return null;
    }
    return key.slice(FORMULA_OUTPUT_KEY_PREFIX.length);
}

export interface FormulaWarningSummary {
    formulaId: string;
    label: string;
    invalidCount: number;
}
