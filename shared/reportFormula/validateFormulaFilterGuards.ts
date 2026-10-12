import {
    getFormulaOutputKey,
    isFormulaFilterField,
    type ReportFormula,
} from "./types";

export const ORPHAN_FORMULA_FILTER_CODE = "ORPHAN_FORMULA_FILTER" as const;

export type FormulaFilterGuardErrorCode = typeof ORPHAN_FORMULA_FILTER_CODE;

/** True when any filter targets a formula output key (`formula:<id>`). */
export function hasFormulaFilters(
    filters: Array<{ field?: string | null }> | null | undefined
): boolean {
    if (!Array.isArray(filters)) {
        return false;
    }
    return filters.some((filter) => isFormulaFilterField(filter?.field));
}

/** Indexes of formula filters whose `formula:<id>` is not on the report. */
export function findOrphanFormulaFilterIndexes(
    filters: Array<{ field?: string | null }> | null | undefined,
    formulas: Array<Pick<ReportFormula, "id">> | null | undefined = []
): number[] {
    if (!Array.isArray(filters)) {
        return [];
    }
    const knownKeys = new Set(
        (formulas || []).map((formula) => getFormulaOutputKey(formula.id))
    );
    const indexes: number[] = [];
    filters.forEach((filter, index) => {
        if (
            isFormulaFilterField(filter?.field) &&
            !knownKeys.has(filter.field as string)
        ) {
            indexes.push(index);
        }
    });
    return indexes;
}

/**
 * First hard guard failure for formula filters, or null when allowed.
 * On grouped reports formula filters run per detail row, before grouping.
 */
export function getFormulaFilterGuardFailure(params: {
    filters: Array<{ field?: string | null }> | null | undefined;
    formulas?: Array<Pick<ReportFormula, "id">> | null;
}): FormulaFilterGuardErrorCode | null {
    if (!hasFormulaFilters(params.filters)) {
        return null;
    }
    if (
        findOrphanFormulaFilterIndexes(params.filters, params.formulas).length >
        0
    ) {
        return ORPHAN_FORMULA_FILTER_CODE;
    }
    return null;
}

/** Map Nest/API errorCode to reports locale validation key. */
export function formulaFilterGuardTranslationKey(
    errorCode: string | undefined | null
): string | null {
    if (errorCode === ORPHAN_FORMULA_FILTER_CODE) {
        return "validation.orphan_formula_filter";
    }
    return null;
}
