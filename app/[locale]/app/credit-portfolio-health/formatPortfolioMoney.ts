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

/**
 * Account currency next to amount. LRM keeps digit runs intact under RTL parents.
 * - Hebrew: `₪ 50,884` (symbol before)
 * - English: `50,884 ₪` (symbol after)
 */
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
        return `\u200E${symbol}${nbsp}${formattedAmount}`;
    }
    return `\u200E${formattedAmount}${nbsp}${symbol}`;
}

/**
 * SVG `<text>` props so {@link formatPortfolioMoney} order survives an RTL page.
 * Without this, browsers reorder shekel/currency marks to the left of the amount.
 */
export const portfolioMoneySvgTextProps = {
    direction: "ltr" as const,
    style: {
        unicodeBidi: "isolate" as const,
        fontVariantNumeric: "tabular-nums" as const,
    },
};

/**
 * CSS for HTML / tooltip money spans under an RTL `dir` parent.
 * Same reorder bug as SVG when the tooltip container is Hebrew.
 */
export const portfolioMoneyHtmlStyle = {
    direction: "ltr" as const,
    unicodeBidi: "isolate" as const,
    fontVariantNumeric: "tabular-nums" as const,
};

/** Inline style string for ApexCharts custom HTML tooltips. */
export const PORTFOLIO_MONEY_HTML_STYLE =
    "direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums;";

/** Prefix/suffix for animated StatNumber / BigNumber money displays. */
export function portfolioMoneyAffixes(
    currencyCode: string,
    language: string
): { prefix: string; suffix: string } {
    const symbol = portfolioCurrencySymbol(currencyCode);
    const nbsp = "\u00A0";
    if (language.startsWith("he")) {
        return { prefix: `\u200E${symbol}${nbsp}`, suffix: "" };
    }
    return { prefix: "\u200E", suffix: `${nbsp}${symbol}` };
}

/**
 * Compact axis ticks with account currency.
 * - Hebrew: `₪ 15M` (symbol before)
 * - English: `15M ₪` (symbol after; avoids left-edge clip on LTR axes)
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
    if (language.startsWith("he")) {
        return `\u200E${symbol}\u00A0${compact}`;
    }
    return `\u200E${compact}\u00A0${symbol}`;
}
