import {
    getFormulaOutputKey,
    isFormulaFilterField,
    type ReportFormula,
} from "./types";

export const FORMULA_FILTER_GROUPING_CONFLICT_CODE =
    "FORMULA_FILTER_GROUPING_CONFLICT" as const;
export const ORPHAN_FORMULA_FILTER_CODE = "ORPHAN_FORMULA_FILTER" as const;

export type FormulaFilterGuardErrorCode =
    | typeof FORMULA_FILTER_GROUPING_CONFLICT_CODE
    | typeof ORPHAN_FORMULA_FILTER_CODE;

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
 * Orphan checks run before grouping so deleted formulas fail loudly.
 */
export function getFormulaFilterGuardFailure(params: {
    filters: Array<{ field?: string | null }> | null | undefined;
    formulas?: Array<Pick<ReportFormula, "id">> | null;
    isGrouped: boolean;
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
    if (params.isGrouped) {
        return FORMULA_FILTER_GROUPING_CONFLICT_CODE;
    }
    return null;
}

/** Map Nest/API errorCode to reports locale validation key. */
export function formulaFilterGuardTranslationKey(
    errorCode: string | undefined | null
): string | null {
    if (errorCode === FORMULA_FILTER_GROUPING_CONFLICT_CODE) {
        return "validation.formula_filter_grouping_conflict";
    }
    if (errorCode === ORPHAN_FORMULA_FILTER_CODE) {
        return "validation.orphan_formula_filter";
    }
    return null;
}
