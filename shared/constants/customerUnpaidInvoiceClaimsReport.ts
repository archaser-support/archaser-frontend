/** System report: unpaid invoices that have a credit-insurance claim. */
export const CUSTOMER_UNPAID_INVOICES_CONTEXT = "customer_unpaid_invoices";

/**
 * Must contain `credit_insurance` so non-credit accounts are filtered out
 * by the reports list API.
 */
export const CUSTOMER_UNPAID_INVOICES_CLAIMS_REPORT_UNIQUE_NAME =
    "customer_unpaid_invoices_credit_insurance_claims";
