import type { InvoiceInput } from "@/server/services/InvoiceService";

function toOptionalNumber(value: unknown): number | undefined {
    if (value === null || value === undefined || value === "") {
        return undefined;
    }
    const parsed =
        typeof value === "string" ? parseFloat(value) : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function toOptionalString(value: unknown): string | undefined {
    if (value === null || value === undefined) {
        return undefined;
    }
    const trimmed = String(value).trim();
    return trimmed ? trimmed : undefined;
}

/**
 * Normalize invoice import rows from file catalog or billing connector field names
 * into {@link InvoiceInput} for {@link InvoiceService.createMany}.
 *
 * Catalog aliases:
 * - `base_amount` → `amount` (account base currency)
 * - `invoice_amount` → `customer_amount` (customer/invoice currency)
 * - `currency` → `customer_currency`
 *
 * Explicit `amount` / `customer_amount` / `customer_currency` win when already set.
 */
export function normalizeInvoiceImportInput(
    row: Record<string, unknown>,
    accountId: number
): InvoiceInput {
    const amount =
        toOptionalNumber(row.amount) ?? toOptionalNumber(row.base_amount) ?? 0;
    const customerAmount =
        toOptionalNumber(row.customer_amount) ??
        toOptionalNumber(row.invoice_amount);
    const customerCurrency =
        toOptionalString(row.customer_currency) ??
        toOptionalString(row.currency);

    const normalized: InvoiceInput = {
        account_id: accountId,
        customer_number: String(row.customer_number ?? ""),
        invoice_number: String(row.invoice_number ?? ""),
        invoice_date: String(row.invoice_date ?? ""),
        amount,
        customer_amount: customerAmount,
        customer_currency: customerCurrency,
    };

    const dueDate = toOptionalString(row.due_date);
    if (dueDate) {
        normalized.due_date = dueDate;
    }

    const totalPaid = toOptionalNumber(row.total_paid);
    if (totalPaid !== undefined) {
        normalized.total_paid = totalPaid;
    }

    const customerTotalPaid = toOptionalNumber(row.customer_total_paid);
    if (customerTotalPaid !== undefined) {
        normalized.customer_total_paid = customerTotalPaid;
    }

    const status = toOptionalString(row.status);
    if (status) {
        normalized.status = status;
    }

    const creditFor = toOptionalString(row.credit_for_invoice_number);
    if (creditFor) {
        normalized.credit_for_invoice_number = creditFor;
    }

    if (row.actual_reporting_date != null && row.actual_reporting_date !== "") {
        normalized.actual_reporting_date = row.actual_reporting_date as
            | string
            | Date;
    }

    return normalized;
}
