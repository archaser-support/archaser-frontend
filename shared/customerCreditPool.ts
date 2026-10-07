/**
 * Credit-pool hierarchy helpers for customer detail (Dashboard / header).
 */

export type CustomerCreditPoolShape = {
    parent_customer_id?: number | null;
    ChildCustomers?: unknown;
};

/** `credit` block from GET /customers/aggregated-data/:id (shell-parent pool). */
export type CustomerAggregatedCreditBlock = {
    root_customer_id: number;
    approved_limit: number | null;
    approved_limit_currency: string | null;
    effective_limit: number | null;
    total_due_amount: number;
    total_overdue_amount: number;
    total_ar: number;
    number_of_overdue_invoices: number;
    no_of_due_invoices: number;
    oldest_invoice_overdue_date: string | null;
    capacity_gap_amount: number | null;
    at_risk_exposure: number;
    uninsured_amount: number | null;
    capacity_gap_amount1: number | null;
    capacity_gap_currency1: string | null;
    capacity_gap_amount2: number | null;
    capacity_gap_currency2: string | null;
    uninsured_amount1: number | null;
    uninsured_currency1: string | null;
    uninsured_amount2: number | null;
    uninsured_currency2: string | null;
    open_claims_count: number;
    total_claims_count: number;
    members: Array<{
        id: number;
        customer_number: string | null;
        name: string;
        type: "Person" | "Company";
        parent_customer_id: number | null;
        total_due_amount: number;
        total_overdue_amount: number;
        total_ar: number;
        capacity_gap_amount: number;
        at_risk_exposure: number;
        open_claims_count: number;
        total_claims_count: number;
    }>;
};

/** True when the customer is a shell parent (has at least one child). */
export function customerHasCreditPoolChildren(
    customer: CustomerCreditPoolShape | null | undefined
): boolean {
    if (!customer) {
        return false;
    }
    const children = customer.ChildCustomers;
    return Array.isArray(children) && children.length > 0;
}

/**
 * Linked leaf under a pool: has a parent and no children of its own
 * (pool cards stay N/A on these).
 */
export function isLinkedCreditPoolChildCustomer(
    customer: CustomerCreditPoolShape | null | undefined
): boolean {
    if (!customer) {
        return false;
    }
    const hasParent =
        customer.parent_customer_id != null &&
        Number(customer.parent_customer_id) > 0;
    return hasParent && !customerHasCreditPoolChildren(customer);
}

export function customerCreditPoolQueryKey(customerId: number) {
    return ["customerAggregatedData", "creditPool", customerId] as const;
}
