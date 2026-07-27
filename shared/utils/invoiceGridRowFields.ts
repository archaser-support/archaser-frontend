/**
 * Helpers for invoice rows from view/report execution (flattened or Invoice.* keys).
 */

export function getInvoiceFieldFromGridRow(
    row: Record<string, unknown> | null | undefined,
    field: string
): unknown {
    if (!row) return undefined;
    const dotted = `Invoice.${field}`;
    const raw = row.raw as Record<string, unknown> | undefined;

    const pick = (obj: Record<string, unknown> | undefined): unknown => {
        if (!obj) return undefined;
        const direct =
            obj[dotted] ??
            obj[field] ??
            undefined;
        if (direct !== undefined && direct !== null) {
            return direct;
        }
        const inv = obj.Invoice as Record<string, unknown> | undefined;
        if (inv && field in inv) {
            return inv[field];
        }
        const suffix = `.${field}`;
        const matchKey = Object.keys(obj).find((k) => k.endsWith(suffix));
        if (matchKey) return obj[matchKey];
        return undefined;
    };

    return (
        pick(row) ??
        pick(raw) ??
        (() => {
            const rawInv = raw?.Invoice as Record<string, unknown> | undefined;
            if (rawInv && field in rawInv) return rawInv[field];
            return undefined;
        })()
    );
}

/** Boolean fields used for the credit-insurance “violations” summary column */
export const INVOICE_CREDIT_INSURANCE_VIOLATION_FIELDS = [
    {
        field: "reporting_breach",
        labelKey: "credit_insurance_violations.causes.reporting_breach",
    },
    {
        field: "ctv_payment_term",
        labelKey: "credit_insurance_violations.causes.payment_term",
    },
    {
        field: "ctv_customer_overdue_mep",
        labelKey: "credit_insurance_violations.causes.customer_overdue_mep",
    },
    {
        field: "ctv_customer_excluded_from_policy",
        labelKey: "credit_insurance_violations.causes.excluded_from_policy",
    },
    {
        field: "ctv_outdated_dcl",
        labelKey: "credit_insurance_violations.causes.outdated_dcl",
    },
    {
        field: "ctv_invoice_after_policy_end",
        labelKey: "credit_insurance_violations.causes.invoice_after_policy_end",
    },
] as const;

export function isTruthyFlag(value: unknown): boolean {
    if (value === true || value === 1) return true;
    if (typeof value === "string") {
        const s = value.trim().toLowerCase();
        return s === "true" || s === "1" || s === "t" || s === "yes";
    }
    return false;
}
