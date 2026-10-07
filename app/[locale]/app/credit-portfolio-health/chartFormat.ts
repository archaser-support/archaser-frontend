/** Shared Recharts axis / tooltip formatters for the portfolio-health charts. */

export function formatCurrencyCompact(v: number, currency: string): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        notation: "compact",
        maximumFractionDigits: 0,
    }).format(v);
}

export function formatCurrencyFull(v: number, currency: string): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
    }).format(v);
}

/** "₪35M" */
export const formatIlsCompact = (v: number) => formatCurrencyCompact(v, "ILS");

/** "₪112,893,772" */
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
