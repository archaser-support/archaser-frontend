import type { TFunction } from "i18next";

import { formatCurrencyWithRTLSupport } from "@/utils/stringFormatters";
import {
    getFieldOutputKey,
    getLegacyFieldOutputKey,
    type Field,
} from "@/utils/reportTableUtils";
import { isAmountField } from "./viewFieldHelpers";

function coerceAggregationTotal(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

/** Normalize `Table.field__sum` → `Table.field__SUM` so FE/BE casing cannot miss. */
export function normalizeAggregationOutputKey(key: string): string {
    return String(key || "").replace(
        /__(sum|avg|count|min|max)$/i,
        (_match, agg: string) => `__${agg.toUpperCase()}`
    );
}

/**
 * Resolve a full-dataset total from execute `aggregationTotals`, trying output /
 * legacy / alias keys (case-insensitive aggregation suffix).
 */
export function resolveAggregationTotalFromMap(
    aggregationTotals: Record<string, number> | undefined,
    fieldKey: string,
    fieldConfig?: Pick<Field, "table" | "field" | "alias" | "aggregation"> | null
): number | null {
    if (!aggregationTotals) {
        return null;
    }
    const byNormalized = new Map<string, number>();
    for (const [key, value] of Object.entries(aggregationTotals)) {
        const total = coerceAggregationTotal(value);
        if (total === null) {
            continue;
        }
        byNormalized.set(normalizeAggregationOutputKey(key), total);
        byNormalized.set(key, total);
    }
    const candidates = new Set<string>();
    if (fieldKey) {
        candidates.add(fieldKey);
        candidates.add(normalizeAggregationOutputKey(fieldKey));
    }
    if (fieldConfig) {
        const outputKey = getFieldOutputKey(fieldConfig as Field);
        const legacyKey = getLegacyFieldOutputKey(fieldConfig as Field);
        candidates.add(outputKey);
        candidates.add(normalizeAggregationOutputKey(outputKey));
        candidates.add(legacyKey);
        candidates.add(normalizeAggregationOutputKey(legacyKey));
        if (fieldConfig.alias) {
            candidates.add(fieldConfig.alias);
        }
        if (fieldConfig.aggregation) {
            candidates.add(
                `${fieldConfig.table}.${fieldConfig.field}__${String(fieldConfig.aggregation).toUpperCase()}`
            );
        }
    }
    for (const key of Array.from(candidates)) {
        if (!key) {
            continue;
        }
        const total = byNormalized.get(key);
        if (total !== undefined) {
            return total;
        }
    }
    return null;
}

const AGGREGATION_TYPE_I18N_KEYS: Record<string, string> = {
    SUM: "values.aggregation_sum",
    AVG: "values.aggregation_avg",
    COUNT: "values.aggregation_count",
    MIN: "values.aggregation_min",
    MAX: "values.aggregation_max",
};

/**
 * Localized aggregation name for column headers (reports namespace).
 * Falls back to the raw Prisma-style token when `t` is omitted (e.g. tests).
 */
export function translateReportAggregationType(
    aggregationType: string,
    t?: TFunction
): string {
    const upper = String(aggregationType || "").toUpperCase();
    const i18nKey = AGGREGATION_TYPE_I18N_KEYS[upper];
    if (!t || !i18nKey) {
        return upper || String(aggregationType);
    }
    const translated = t(i18nKey, {
        ns: "reports",
        defaultValue: upper,
    });
    return translated && translated !== i18nKey ? translated : upper;
}

export interface AggregationResult {
    value: number | null;
    formatted: string | null;
}

/**
 * Calculate aggregation value from data
 */
export function calculateAggregation(
    data: any[],
    fieldKey: string,
    aggregationType: "SUM" | "AVG" | "COUNT" | "MIN" | "MAX"
): number | null {
    const values = data
        .map((row: any) => {
            const value = row[fieldKey];
            if (value !== null && value !== undefined) {
                const numValue =
                    typeof value === "number"
                        ? value
                        : parseFloat(String(value));
                return isNaN(numValue) ? null : numValue;
            }
            return null;
        })
        .filter((v: any) => v !== null) as number[];

    if (values.length === 0) return null;

    switch (aggregationType) {
        case "SUM":
            return values.reduce((sum, val) => sum + val, 0);
        case "AVG":
            return values.reduce((sum, val) => sum + val, 0) / values.length;
        case "COUNT":
            // Grouped rows store one count per group; header should reflect the sum of those counts.
            return values.reduce((sum, val) => sum + val, 0);
        case "MIN":
            return Math.min(...values);
        case "MAX":
            return Math.max(...values);
        default:
            return null;
    }
}

/**
 * Format aggregation value for display in column header
 */
export function formatAggregationValue(
    aggregationValue: number | null,
    aggregationType: string,
    fieldConfig: any,
    tablesMetadata: any[],
    data: any[],
    i18n: { language: string },
    accountCurrency?: string,
    options?: { includeTypePrefix?: boolean; t?: TFunction }
): string | null {
    if (aggregationValue === null) return null;

    const shouldFormatAmount =
        aggregationType !== "COUNT" &&
        isAmountField(fieldConfig, tablesMetadata);
    const userLocale = i18n.language === "he" ? "he-IL" : "en-US";
    const includeTypePrefix = options?.includeTypePrefix !== false;
    const t = options?.t;

    let formattedValue: string;
    if (shouldFormatAmount) {
        // Try row-level currency first; then account default (session), not hardcoded USD
        const firstRow = data[0] as Record<string, any> | undefined;
        const fromAccount =
            accountCurrency && String(accountCurrency).trim()
                ? String(accountCurrency).trim().toUpperCase()
                : "";
        const currency =
            firstRow?.customer_currency ||
            firstRow?.currency ||
            firstRow?.[`${fieldConfig?.table}.customer_currency`] ||
            firstRow?.[`${fieldConfig?.table}.currency`] ||
            fromAccount ||
            "USD";
        formattedValue = formatCurrencyWithRTLSupport(
            aggregationValue,
            currency,
            userLocale,
            i18n.language
        );
    } else {
        formattedValue = new Intl.NumberFormat(userLocale).format(
            aggregationValue
        );
    }

    const typeLabel = translateReportAggregationType(aggregationType, t);
    return includeTypePrefix
        ? `${typeLabel}: ${formattedValue}`
        : formattedValue;
}

/**
 * Get aggregation label suffix for column header
 */
export function getAggregationLabelSuffix(
    fieldConfig: any,
    data: any[],
    fieldKey: string,
    tablesMetadata: any[],
    i18n: { language: string },
    accountCurrency?: string,
    /** When true, header already includes "FIELD SUM"; omit redundant "(SUM)" / "SUM:" in suffix. */
    omitRedundantAggregationType?: boolean,
    /** Grouped reports: full-dataset totals for aggregated columns (from execute API). */
    aggregationTotals?: Record<string, number>,
    t?: TFunction,
    /** When true, keep the aggregation type but omit the total number (and currency). */
    hideHeaderAggregationValue?: boolean
): string {
    if (!fieldConfig?.aggregation) return "";

    if (hideHeaderAggregationValue) {
        return omitRedundantAggregationType
            ? ""
            : ` (${translateReportAggregationType(fieldConfig.aggregation, t)})`;
    }

    // Prefer server full-dataset totals (all pages). Caller should pass a map
    // that does not grow with infinite scroll (server totals or a frozen seed).
    const fromTotals = resolveAggregationTotalFromMap(
        aggregationTotals,
        fieldKey,
        fieldConfig
    );

    const aggregationValue =
        fromTotals !== null
            ? fromTotals
            : calculateAggregation(
                  data,
                  fieldKey,
                  fieldConfig.aggregation
              ) ??
              calculateAggregation(
                  data,
                  getFieldOutputKey(fieldConfig as Field),
                  fieldConfig.aggregation
              ) ??
              calculateAggregation(
                  data,
                  getLegacyFieldOutputKey(fieldConfig as Field),
                  fieldConfig.aggregation
              );

    if (aggregationValue !== null) {
        const formatted = formatAggregationValue(
            aggregationValue,
            fieldConfig.aggregation,
            fieldConfig,
            tablesMetadata,
            data,
            i18n,
            accountCurrency,
            omitRedundantAggregationType
                ? { includeTypePrefix: false, t }
                : { includeTypePrefix: true, t }
        );
        if (formatted) {
            return ` (${formatted})`;
        }
        return omitRedundantAggregationType
            ? ""
            : ` (${translateReportAggregationType(fieldConfig.aggregation, t)})`;
    }

    return omitRedundantAggregationType
        ? ""
        : ` (${translateReportAggregationType(fieldConfig.aggregation, t)})`;
}
