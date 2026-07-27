import type { TFunction } from "i18next";

import { formatCurrencyWithRTLSupport } from "@/utils/stringFormatters";
import { isAmountField } from "./viewFieldHelpers";

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
    /** Grouped reports: full-dataset sum for COUNT columns (from execute API). */
    aggregationTotals?: Record<string, number>,
    t?: TFunction
): string {
    if (!fieldConfig?.aggregation) return "";

    const fromTotals =
        fieldConfig.aggregation === "COUNT" &&
        aggregationTotals &&
        typeof aggregationTotals[fieldKey] === "number"
            ? aggregationTotals[fieldKey]
            : null;

    const aggregationValue =
        fromTotals !== null
            ? fromTotals
            : calculateAggregation(data, fieldKey, fieldConfig.aggregation);

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
