import { CustomerDispute } from "@/types/CustomerDispute";

type PartialCustomerDispute = Partial<
    Pick<
        CustomerDispute,
        | "DisputeReason"
        | "invoices_in_dispute"
        | "customer_comment"
        | "User_CustomerDispute_owner_idToUser"
    >
>;

type timelineContentRowItem = {
    label: string;
    value: string;
};
export type timelineContentRowItems = Array<timelineContentRowItem>;

export function formatCustomerDisputeSummary(
    dispute: PartialCustomerDispute,
    call_type: string
): string {
    const reason = dispute.DisputeReason?.name ?? "—";
    const invoices = dispute.invoices_in_dispute ?? "—";
    const userFullName = [
        dispute?.User_CustomerDispute_owner_idToUser?.first_name,
        dispute?.User_CustomerDispute_owner_idToUser?.last_name,
    ]
        .filter(Boolean)
        .join(" ");

    const details: timelineContentRowItems = [
        { label: "Dispute Reason", value: reason },
        { label: "Invoices In Dispute", value: invoices },
        { label: `Comment`, value: dispute.customer_comment || "-" },
    ];

    if (call_type) {
        details.push({ label: `Call Direction`, value: call_type });
    }

    if (userFullName) {
        details.push({ label: "Dispute Owner", value: userFullName });
    }

    return genericTimelineContentFormatter(details);
}

export function genericTimelineContentFormatter(
    details: timelineContentRowItems
): string {
    let formattdSummary = "";
    for (let i = 0; i < details.length; i++) {
        const row = details[i];
        formattdSummary += `<p><b>${row.label}</b>: <span>${row.value}</span></p>`;
    }

    return formattdSummary;
}

export function formatAssignUserContent(
    assignmentDetails: string,
    comment: string
): string {
    const details: timelineContentRowItems = [
        { label: "{{activity.log_activity.event}}", value: assignmentDetails },
        {
            label: "{{activity.log_activity.comment}}",
            value: comment || "{{activity.log_activity.no_comment}}",
        },
    ];

    return genericTimelineContentFormatter(details);
}

export function formatResolvedDisputeContent(
    resolution: string,
    comment: string
): string {
    const details: timelineContentRowItems = [
        {
            label: "{{activity.log_activity.dispute_resolution}}",
            value: resolution,
        },
        { label: "{{activity.log_activity.comment}}", value: comment },
    ];

    return genericTimelineContentFormatter(details);
}

export function formatDisputeResolutionContent(
    resolution: string,
    comment: string
): string {
    const details: timelineContentRowItems = [
        {
            label: "{{activity.log_activity.dispute_resolution}}",
            value: resolution,
        },
        { label: "{{activity.log_activity.comment}}", value: comment },
    ];

    return genericTimelineContentFormatter(details);
}

/**
 * Formats a number as a currency amount with proper decimal places and thousands separators
 * @param amount - The amount to format
 * @param currency - The currency code (default: 'USD')
 * @param locale - The locale to use for formatting (default: 'en-US')
 * @returns Formatted amount string
 */
export function formatAmount(
    amount: number,
    currency: string = "USD",
    locale: string = "en-US"
): string {
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

/**
 * Formats a number as a currency amount without the currency symbol
 * Only shows decimal places if the value has non-zero decimal parts
 * @param amount - The amount to format
 * @param locale - The locale to use for formatting (default: 'en-US')
 * @returns Formatted amount string without currency symbol
 */
export function formatAmountWithoutSymbol(
    amount: number,
    locale: string = "en-US"
): string {
    // Check if the amount has non-zero decimal places
    const hasDecimalPlaces = Math.abs(amount % 1) > 0.0001; // Account for floating point precision

    return new Intl.NumberFormat(locale, {
        minimumFractionDigits: hasDecimalPlaces ? 2 : 0,
        maximumFractionDigits: hasDecimalPlaces ? 2 : 0,
    }).format(amount);
}

/**
 * Formats a number as a currency amount with proper RTL/LTR support
 * @param amount - The amount to format
 * @param currencyCode - The currency code (e.g., 'USD', 'EUR')
 * @param locale - The locale to use for formatting (default: 'en-US')
 * @param i18nLanguage - The current i18n language for RTL/LTR positioning
 * @returns Formatted currency string with proper positioning
 */
export function formatCurrencyWithRTLSupport(
    amount: number,
    currencyCode: string,
    locale: string = "en-US",
    i18nLanguage: string = "en"
): string {
    const formattedAmount = formatAmountWithoutSymbol(amount, locale);

    // For Hebrew (RTL), put currency code AFTER the amount.
    // In RTL layout the string renders right-to-left, so "62,348 ILS" displays
    // with the number on the right and ILS on the left — the correct Hebrew convention.
    // Use an LTR mark before the number to preserve digit/sign order.
    const nbsp = "\u00A0";
    if (i18nLanguage === "he") {
        const ltrMark = "\u200E"; // Left-to-Right Mark — keeps number digits in correct order
        return `${ltrMark}${formattedAmount}${nbsp}${currencyCode}`;
    }
    return `${currencyCode}${nbsp}${formattedAmount}`;
}

/**
 * Formats a number as a currency amount with currency symbol and proper RTL/LTR support
 * @param amount - The amount to format
 * @param currencySymbol - The currency symbol (e.g., '$', '€')
 * @param locale - The locale to use for formatting (default: 'en-US')
 * @param i18nLanguage - The current i18n language for RTL/LTR positioning
 * @returns Formatted currency string with proper positioning
 */
export function formatCurrencySymbolWithRTLSupport(
    amount: number,
    currencySymbol: string,
    locale: string = "en-US",
    i18nLanguage: string = "en"
): string {
    const formattedAmount = formatAmountWithoutSymbol(amount, locale);

    // For Hebrew (RTL), put currency symbol after amount
    // For English (LTR), put currency symbol before amount
    return i18nLanguage === "he"
        ? `${formattedAmount} ${currencySymbol}`
        : `${currencySymbol}${formattedAmount}`;
}

export interface AmountCurrencyPair {
    amount: number | null | undefined;
    currency: string | null | undefined;
    source: "customer" | "collection_period" | "account" | "row" | "fallback";
}

let hasLoggedTerminalCurrencyFallback = false;

interface ResolveCurrencyFallbackInput {
    customerCurrencyPrimary?: string | null;
    customerCurrencySecondary?: string | null;
    collectionCurrencyPrimary?: string | null;
    collectionCurrencySecondary?: string | null;
    accountCurrency?: string | null;
    fallbackCurrency?: string | null;
    terminalFallback?: string;
}

/**
 * Resolves a display currency using customer-first precedence.
 * Use this for customer-summary displays where customer table values are the default source.
 */
export function resolveCustomerFirstCurrency(
    input: ResolveCurrencyFallbackInput
): string {
    const resolved =
        input.customerCurrencyPrimary ||
        input.customerCurrencySecondary ||
        input.collectionCurrencyPrimary ||
        input.collectionCurrencySecondary ||
        input.accountCurrency ||
        input.fallbackCurrency ||
        input.terminalFallback ||
        "USD";

    // Lightweight telemetry: emit once in non-production when we fall back to terminal USD.
    if (
        resolved === (input.terminalFallback || "USD") &&
        !input.customerCurrencyPrimary &&
        !input.customerCurrencySecondary &&
        !input.collectionCurrencyPrimary &&
        !input.collectionCurrencySecondary &&
        !input.accountCurrency &&
        !input.fallbackCurrency &&
        process.env.NODE_ENV !== "production" &&
        !hasLoggedTerminalCurrencyFallback
    ) {
        hasLoggedTerminalCurrencyFallback = true;
        console.warn(
            "[currency] Terminal fallback currency used; upstream currency fields missing."
        );
    }

    return resolved;
}

/**
 * Returns the first valid amount+currency pair. This prevents mismatching amount and currency sources.
 */
export function resolveAmountCurrencyPair(
    pairs: AmountCurrencyPair[],
    terminalFallbackCurrency: string = "USD"
): { amount: number; currency: string; source: AmountCurrencyPair["source"] } {
    for (const pair of pairs) {
        const amount = pair.amount ?? 0;
        if (amount > 0 && pair.currency) {
            return { amount, currency: pair.currency, source: pair.source };
        }
    }

    const firstAmount = pairs.find((p) => (p.amount ?? 0) > 0);
    if (firstAmount) {
        return {
            amount: firstAmount.amount ?? 0,
            currency: terminalFallbackCurrency,
            source: "fallback",
        };
    }

    return { amount: 0, currency: terminalFallbackCurrency, source: "fallback" };
}

/**
 * Formats a number as a whole number without decimal places
 * @param amount - The amount to format
 * @param locale - The locale to use for formatting (default: 'en-US')
 * @returns Formatted amount string as whole number
 */
export function formatAmountWithoutSymbolWhole(
    amount: number,
    locale: string = "en-US"
): string {
    return new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

export function translateCronExpression(expression: string): string {
    try {
        const parts = expression.trim().split(/\s+/);

        // Handle 6-field format: second minute hour day month dayOfWeek
        if (parts.length === 6) {
            const [second, minute, hour, dayOfMonth, month, dayOfWeek] = parts;

            // Every X minutes pattern
            if (
                second === "0" &&
                minute.startsWith("*/") &&
                hour === "*" &&
                dayOfMonth === "*" &&
                month === "*" &&
                dayOfWeek === "*"
            ) {
                const interval = parseInt(minute.substring(2));
                if (interval === 1) return "Every minute";
                if (interval === 5) return "Every 5 minutes";
                if (interval === 10) return "Every 10 minutes";
                if (interval === 15) return "Every 15 minutes";
                if (interval === 30) return "Every 30 minutes";
                return `Every ${interval} minutes`;
            }

            // Every X hours pattern
            if (
                second === "0" &&
                minute === "0" &&
                hour.startsWith("*/") &&
                dayOfMonth === "*" &&
                month === "*" &&
                dayOfWeek === "*"
            ) {
                const interval = parseInt(hour.substring(2));
                if (interval === 1) return "Every hour";
                if (interval === 2) return "Every 2 hours";
                if (interval === 3) return "Every 3 hours";
                if (interval === 6) return "Every 6 hours";
                if (interval === 12) return "Every 12 hours";
                return `Every ${interval} hours`;
            }

            // Daily at specific time
            if (
                second === "0" &&
                minute === "0" &&
                hour !== "*" &&
                dayOfMonth === "*" &&
                month === "*" &&
                dayOfWeek === "*"
            ) {
                const hourNum = parseInt(hour);
                if (hourNum === 0) return "Daily at midnight";
                if (hourNum === 12) return "Daily at noon";
                if (hourNum < 12) return `Daily at ${hourNum}:00 AM`;
                return `Daily at ${hourNum - 12}:00 PM`;
            }

            // Weekly pattern
            if (
                second === "0" &&
                minute === "0" &&
                hour === "0" &&
                dayOfMonth === "*" &&
                month === "*" &&
                dayOfWeek !== "*"
            ) {
                const days = [
                    "Sunday",
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                ];
                const dayNum = parseInt(dayOfWeek);
                if (dayNum >= 0 && dayNum <= 6) {
                    return `Weekly on ${days[dayNum]}`;
                }
            }
        }

        // Handle 5-field format: minute hour day month dayOfWeek
        if (parts.length === 5) {
            const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

            // Every X minutes pattern
            if (
                minute.startsWith("*/") &&
                hour === "*" &&
                dayOfMonth === "*" &&
                month === "*" &&
                dayOfWeek === "*"
            ) {
                const interval = parseInt(minute.substring(2));
                if (interval === 1) return "Every minute";
                if (interval === 5) return "Every 5 minutes";
                if (interval === 10) return "Every 10 minutes";
                if (interval === 15) return "Every 15 minutes";
                if (interval === 30) return "Every 30 minutes";
                return `Every ${interval} minutes`;
            }

            // Every X hours pattern
            if (
                minute === "0" &&
                hour.startsWith("*/") &&
                dayOfMonth === "*" &&
                month === "*" &&
                dayOfWeek === "*"
            ) {
                const interval = parseInt(hour.substring(2));
                if (interval === 1) return "Every hour";
                if (interval === 2) return "Every 2 hours";
                if (interval === 3) return "Every 3 hours";
                if (interval === 6) return "Every 6 hours";
                if (interval === 12) return "Every 12 hours";
                return `Every ${interval} hours`;
            }

            // Daily at specific time
            if (
                minute === "0" &&
                hour !== "*" &&
                dayOfMonth === "*" &&
                month === "*" &&
                dayOfWeek === "*"
            ) {
                const hourNum = parseInt(hour);
                if (hourNum === 0) return "Daily at midnight";
                if (hourNum === 12) return "Daily at noon";
                if (hourNum < 12) return `Daily at ${hourNum}:00 AM`;
                return `Daily at ${hourNum - 12}:00 PM`;
            }
        }

        // Fallback for complex expressions
        return expression;
    } catch (_error) {
        // Return original expression if parsing fails
        return expression;
    }
}
