import {
    formatAmountWithoutSymbolWhole,
    getCurrencySymbol,
} from "@/utils/stringFormatters";

function normalizeCurrency(currencyCode: string): string {
    return currencyCode.trim().toUpperCase() || "USD";
}

function portfolioCurrencySymbol(currencyCode: string): string {
    const code = normalizeCurrency(currencyCode);
    return getCurrencySymbol(code) || code;
}

function numberLocale(language: string): string {
    return language.startsWith("he") ? "he-IL" : "en-US";
}

/** KPI number (percent, count) in the dashboard locale. */
export function formatPortfolioNumber(
    value: number,
    language: string,
    options: Pick<
        Intl.NumberFormatOptions,
        "minimumFractionDigits" | "maximumFractionDigits"
    >
): string {
    return value.toLocaleString(numberLocale(language), options);
}

const SUB_ONE_MAX_DECIMALS = 2;

/**
 * Sub-1 magnitudes keep enough fraction digits so a positive value does not
 * collapse to 0 (e.g. 0.1 → 1 dp, 0.03 → 2 dp). Caps at {@link SUB_ONE_MAX_DECIMALS}.
 */
export function resolvePortfolioNumberDecimals(
    value: number,
    decimals: number
): number {
    const abs = Math.abs(value);
    if (!(abs > 0) || abs >= 1) {
        return decimals;
    }
    let resolved = Math.max(decimals, 1);
    while (
        resolved < SUB_ONE_MAX_DECIMALS &&
        Math.round(abs * 10 ** resolved) / 10 ** resolved === 0
    ) {
        resolved += 1;
    }
    return resolved;
}

/** Account currency next to amount (RTL-aware). Whole numbers — KPI / portfolio cards. */
export function formatPortfolioMoney(
    amount: number,
    currencyCode: string,
    language: string
): string {
    const locale = numberLocale(language);
    const symbol = portfolioCurrencySymbol(currencyCode);
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    const formattedAmount = formatAmountWithoutSymbolWhole(safeAmount, locale);
    const nbsp = "\u00A0";
    if (language.startsWith("he")) {
        return `\u200E${formattedAmount}${nbsp}${symbol}`;
    }
    return `${symbol}${nbsp}${formattedAmount}`;
}

/** Prefix/suffix for animated StatNumber / BigNumber money displays. */
export function portfolioMoneyAffixes(
    currencyCode: string,
    language: string
): { prefix: string; suffix: string } {
    const symbol = portfolioCurrencySymbol(currencyCode);
    const nbsp = "\u00A0";
    if (language.startsWith("he")) {
        return { prefix: "\u200E", suffix: `${nbsp}${symbol}` };
    }
    return { prefix: `${symbol}${nbsp}`, suffix: "" };
}

/**
 * Compact axis ticks with account currency after the number.
 * Recharts Y-axis labels are right-aligned into the plot; a leading currency
 * marker is clipped by IslandCard overflow:hidden, so keep the symbol on the end.
 */
export function formatPortfolioAxisMoney(
    amount: number,
    currencyCode: string,
    language: string
): string {
    const locale = numberLocale(language);
    const compact = amount.toLocaleString(locale, {
        notation: "compact",
        maximumFractionDigits: 1,
    });
    const symbol = portfolioCurrencySymbol(currencyCode);
    return `\u200E${compact}\u00A0${symbol}`;
}
