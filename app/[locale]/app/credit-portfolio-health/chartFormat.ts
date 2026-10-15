/** Shared Recharts axis / tooltip formatters for the portfolio-health charts. */

import { getCurrencySymbol } from "@/utils/stringFormatters";

function currencyMarker(currency: string): string {
    return getCurrencySymbol(currency) || currency.trim().toUpperCase() || "USD";
}

/**
 * Compact money for chart axes/tooltips.
 * - Hebrew: `₪ 35M` · English: `35M ₪`
 */
export function formatCurrencyCompact(
    v: number,
    currency: string,
    language = "en"
): string {
    const compact = v.toLocaleString("en-US", {
        notation: "compact",
        maximumFractionDigits: 0,
    });
    const symbol = currencyMarker(currency);
    if (language.startsWith("he")) {
        return `\u200E${symbol}\u00A0${compact}`;
    }
    return `\u200E${compact}\u00A0${symbol}`;
}

/**
 * Full money for chart tooltips.
 * - Hebrew: `₪ 112,893,772` · English: `112,893,772 ₪`
 */
export function formatCurrencyFull(
    v: number,
    currency: string,
    language = "en"
): string {
    const amount = Math.round(v).toLocaleString("en-US", {
        maximumFractionDigits: 0,
    });
    const symbol = currencyMarker(currency);
    if (language.startsWith("he")) {
        return `\u200E${symbol}\u00A0${amount}`;
    }
    return `\u200E${amount}\u00A0${symbol}`;
}

/** "35M ₪" (English default) */
export const formatIlsCompact = (v: number) => formatCurrencyCompact(v, "ILS");

/** "112,893,772 ₪" (English default) */
export const formatIlsFull = (v: number) => formatCurrencyFull(v, "ILS");

/** "Jan '26" — accepts Date or `YYYY-MM` / ISO date strings. */
export const formatMonthYear = (d: string | Date) => {
    const date =
        typeof d === "string" && /^\d{4}-\d{2}$/.test(d)
            ? new Date(`${d}-01T12:00:00`)
            : new Date(d);
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        year: "2-digit",
    })
        .format(date)
        .replace(" ", " '");
};

export const formatPct = (v: number) => `${Math.round(v)}%`;

function chartLocale(language: string): string {
    return language.startsWith("he") ? "he-IL" : "en-US";
}

/** Daily x-axis tick, e.g. "1 באפר׳" / "Apr 1". */
export function formatChartDayLabel(ymd: string, language: string): string {
    const date = new Date(`${ymd}T12:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
        return ymd;
    }
    return date.toLocaleDateString(chartLocale(language), {
        month: "short",
        day: "numeric",
    });
}

/** Monthly x-axis tick from `YYYY-MM`, e.g. "אפר׳ 26" / "Apr 26". */
export function formatChartMonthLabel(month: string, language: string): string {
    const [y, m] = month.split("-").map(Number);
    if (!y || !m) {
        return month;
    }
    return new Date(y, m - 1, 1).toLocaleDateString(chartLocale(language), {
        month: "short",
        year: "2-digit",
    });
}

/** Percent with up to one decimal (tooltips, utilization ticks). */
export function formatChartPct(value: number, language: string): string {
    return `${value.toLocaleString(chartLocale(language), {
        maximumFractionDigits: 1,
        minimumFractionDigits: 0,
    })}%`;
}
