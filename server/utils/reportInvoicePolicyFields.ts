/**
 * Report helpers for invoice-scoped insurance policy fields (`Invoice.policy_id`).
 */

import { extractCustomerPolicyReportField } from "./reportCustomerPolicyFields";

export function isInvoicePolicyReportField(field: string): boolean {
    return (
        field === "policy_id" ||
        field === "InsurancePolicy.policy_number" ||
        field.startsWith("InsurancePolicy.")
    );
}

export function mergeInvoicePolicySelect(
    select: Record<string, unknown>,
    fields: string[]
): void {
    for (const field of fields) {
        if (!isInvoicePolicyReportField(field)) {
            continue;
        }
        select.policy_id = true;
        const relationField = field.startsWith("InsurancePolicy.")
            ? field.split(".", 2)[1]
            : "policy_number";
        const existing = select.InsurancePolicy as
            | { select?: Record<string, boolean> }
            | undefined;
        if (!existing) {
            select.InsurancePolicy = {
                select: { [relationField]: true },
            };
            continue;
        }
        if (!existing.select) {
            existing.select = { [relationField]: true };
            continue;
        }
        existing.select[relationField] = true;
    }
}

export function extractInvoicePolicyReportField(
    row: unknown,
    field: string
): unknown {
    if (!row || typeof row !== "object") {
        return null;
    }
    const insurancePolicy = (row as { InsurancePolicy?: Record<string, unknown> | null })
        .InsurancePolicy;

    if (field === "policy_id" || field === "InsurancePolicy.policy_number") {
        return insurancePolicy?.policy_number ?? null;
    }

    if (field.startsWith("InsurancePolicy.")) {
        const relationField = field.split(".", 2)[1];
        return insurancePolicy?.[relationField] ?? null;
    }

    return null;
}

/** Policy number fields that may appear on Customer table in invoice reports. */
export function isInvoiceReportPolicyNumberField(field: string): boolean {
    return field === "policy_id" || field === "InsurancePolicy.policy_number";
}

/**
 * Prefer {@link Invoice.policy_id} → InsurancePolicy.policy_number on the invoice row;
 * fall back to active CustomerPolicy only when the invoice has no tagged policy.
 */
export function resolvePolicyNumberForInvoiceReportRow(
    invoiceRow: unknown,
    field: string,
    customerRow?: unknown
): unknown {
    const invoiceField = isInvoiceReportPolicyNumberField(field)
        ? field
        : "InsurancePolicy.policy_number";
    const fromInvoice = extractInvoicePolicyReportField(
        invoiceRow,
        invoiceField
    );
    if (fromInvoice != null && String(fromInvoice).trim() !== "") {
        return fromInvoice;
    }
    if (customerRow) {
        return extractCustomerPolicyReportField(customerRow, field, invoiceRow);
    }
    return null;
}
