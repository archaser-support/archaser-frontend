/**
 * Currency resolution for invoice amount fields in report formatting/export.
 * Invoice rows default to customer_currency, but several fields are stored in account base.
 */

function pickCurrency(
    ...candidates: Array<string | null | undefined>
): string | null {
    for (const candidate of candidates) {
        const trimmed = candidate?.trim();
        if (trimmed) {
            return trimmed;
        }
    }
    return null;
}

/** Resolve display currency for an amount field on an Invoice row. */
export function resolveInvoiceAmountFieldCurrency(
    invoiceRow: unknown,
    field: string,
    accountCurrency: string
): string {
    if (!invoiceRow || typeof invoiceRow !== "object") {
        return accountCurrency;
    }
    const row = invoiceRow as Record<string, unknown>;

    if (field === "capacity_gap_amount") {
        return accountCurrency;
    }

    if (
        field === "capacity_gap_amount_limit" ||
        field === "limit_assessed_amount"
    ) {
        return (
            pickCurrency(
                row.limit_assessed_currency as string | null | undefined,
                row.customer_currency as string | null | undefined
            ) ?? accountCurrency
        );
    }

    if (
        field === "outstanding_debt" ||
        field === "net_amount" ||
        field === "amount" ||
        field === "total_paid"
    ) {
        return accountCurrency;
    }

    if (
        field === "customer_outstanding_debt" ||
        field === "customer_amount" ||
        field === "customer_net_amount" ||
        field === "customer_total_paid"
    ) {
        return (
            pickCurrency(row.customer_currency as string | null | undefined) ??
            accountCurrency
        );
    }

    return (
        pickCurrency(
            row.customer_currency as string | null | undefined,
            row.currency as string | null | undefined
        ) ?? accountCurrency
    );
}
