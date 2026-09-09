import { formatAmountWithoutSymbolWhole } from "@/utils/stringFormatters";

function normalizeCurrency(currencyCode: string): string {
    return currencyCode.trim().toUpperCase() || "USD";
}

function numberLocale(language: string): string {
    return language.startsWith("he") ? "he-IL" : "en-US";
}

function rtlLanguage(language: string): string {
    return language.startsWith("he") ? "he" : language;
}

/** Account currency next to amount (RTL-aware). Whole numbers — KPI / portfolio cards. */
export function formatPortfolioMoney(
    amount: number,
    currencyCode: string,
    language: string
): string {
    const locale = numberLocale(language);
    const code = normalizeCurrency(currencyCode);
    const formattedAmount = formatAmountWithoutSymbolWhole(amount, locale);
    const nbsp = "\u00A0";
    if (rtlLanguage(language) === "he") {
        return `\u200E${formattedAmount}${nbsp}${code}`;
    }
    return `${code}${nbsp}${formattedAmount}`;
}

/** Prefix/suffix for animated StatNumber / BigNumber money displays. */
export function portfolioMoneyAffixes(
    currencyCode: string,
    language: string
): { prefix: string; suffix: string } {
    const code = normalizeCurrency(currencyCode);
    const nbsp = "\u00A0";
    if (language.startsWith("he")) {
        return { prefix: "\u200E", suffix: `${nbsp}${code}` };
    }
    return { prefix: `${code}${nbsp}`, suffix: "" };
}

/**
 * Compact axis ticks with account currency after the number.
 * Recharts Y-axis labels are right-aligned into the plot; a leading currency
 * code is clipped by IslandCard overflow:hidden, so keep the code on the end.
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
    const code = normalizeCurrency(currencyCode);
    return `\u200E${compact}\u00A0${code}`;
}
