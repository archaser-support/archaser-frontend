/**
 * Policy Insights system reports for credit-insurance accounts.
 * Each unique_name must contain `credit_insurance` so non-CI accounts are
 * filtered out by the reports list API.
 */
export const CUSTOMER_UNPAID_INVOICE_POLICY_INSIGHTS_UNIQUE_NAMES = {
    unpaid: "all_unpaid_invoices_credit_insurance_policy_insights",
    due: "due_invoices_credit_insurance_policy_insights",
    overdue: "overdue_invoices_credit_insurance_policy_insights",
    all: "all_invoices_credit_insurance_policy_insights",
} as const;

export const CUSTOMER_UNPAID_BASIC_UNIQUE_NAMES = {
    unpaid: "all_unpaid_invoices",
    due: "due_invoices",
    overdue: "overdue_invoices",
    all: "all_invoices",
} as const;

export function isDueOrOverdueCustomerInvoiceReport(
    uniqueName?: string | null
): boolean {
    return (
        uniqueName === CUSTOMER_UNPAID_BASIC_UNIQUE_NAMES.due ||
        uniqueName === CUSTOMER_UNPAID_BASIC_UNIQUE_NAMES.overdue ||
        uniqueName === CUSTOMER_UNPAID_INVOICE_POLICY_INSIGHTS_UNIQUE_NAMES.due ||
        uniqueName ===
            CUSTOMER_UNPAID_INVOICE_POLICY_INSIGHTS_UNIQUE_NAMES.overdue
    );
}

export function isOverdueCustomerInvoiceReport(
    uniqueName?: string | null
): boolean {
    return (
        uniqueName === CUSTOMER_UNPAID_BASIC_UNIQUE_NAMES.overdue ||
        uniqueName ===
            CUSTOMER_UNPAID_INVOICE_POLICY_INSIGHTS_UNIQUE_NAMES.overdue
    );
}
