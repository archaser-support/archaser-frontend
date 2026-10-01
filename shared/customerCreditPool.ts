/**
 * Credit-pool hierarchy helpers for customer detail (Dashboard / header).
 */

export type CustomerCreditPoolShape = {
    parent_customer_id?: number | null;
    ChildCustomers?: unknown;
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
