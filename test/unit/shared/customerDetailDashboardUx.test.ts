import { describe, expect, it } from "vitest";

import {
    customerHasLinkedInsurancePolicy,
    type CustomerWithPolicyFields,
} from "@/shared/customerPolicyAdapter";
import { resolveCustomerDetailDashboardUx } from "@/shared/customerDetailDashboardUx";

function makeCustomer(
    overrides: Partial<CustomerWithPolicyFields> = {}
): CustomerWithPolicyFields {
    return {
        customerPolicies: [],
        ...overrides,
    };
}

describe("customerHasLinkedInsurancePolicy", () => {
    it("returns false when customer is null", () => {
        expect(customerHasLinkedInsurancePolicy(null)).toBe(false);
    });

    it("returns false when no policy id is resolvable", () => {
        expect(
            customerHasLinkedInsurancePolicy(
                makeCustomer({
                    customerPolicies: [{ id: 1, is_active: true, insurance_policy_id: null }],
                })
            )
        ).toBe(false);
    });

    it("returns true when active CustomerPolicy has insurance_policy_id", () => {
        expect(
            customerHasLinkedInsurancePolicy(
                makeCustomer({
                    activeCustomerPolicy: {
                        id: 1,
                        is_active: true,
                        insurance_policy_id: 42,
                    },
                })
            )
        ).toBe(true);
    });

    it("returns true for legacy policy_id only", () => {
        expect(
            customerHasLinkedInsurancePolicy(makeCustomer({ policy_id: 7 }))
        ).toBe(true);
    });
});

describe("resolveCustomerDetailDashboardUx", () => {
    const noPolicyCustomer = makeCustomer({
        customerPolicies: [{ id: 1, is_active: true, insurance_policy_id: null }],
    });
    const linkedPolicyCustomer = makeCustomer({
        activeCustomerPolicy: {
            id: 1,
            is_active: true,
            insurance_policy_id: 99,
        },
    });

    it("credit-only, no policy: empty state and dashboard default", () => {
        const result = resolveCustomerDetailDashboardUx({
            customer: noPolicyCustomer,
            hasCreditInsurance: true,
            hasCollection: false,
            hasChildren: false,
            explicitTab: null,
        });
        expect(result.showDashboardNoPolicyEmptyState).toBe(true);
        expect(result.defaultTabWithoutUrlParam).toBe("dashboard");
    });

    it("credit-only, linked policy: no empty state and dashboard default", () => {
        const result = resolveCustomerDetailDashboardUx({
            customer: linkedPolicyCustomer,
            hasCreditInsurance: true,
            hasCollection: false,
            hasChildren: false,
            explicitTab: null,
        });
        expect(result.showDashboardNoPolicyEmptyState).toBe(false);
        expect(result.defaultTabWithoutUrlParam).toBe("dashboard");
    });

    it("dual-product, no policy: empty state and activities default", () => {
        const result = resolveCustomerDetailDashboardUx({
            customer: noPolicyCustomer,
            hasCreditInsurance: true,
            hasCollection: true,
            hasChildren: false,
            explicitTab: null,
        });
        expect(result.showDashboardNoPolicyEmptyState).toBe(true);
        expect(result.defaultTabWithoutUrlParam).toBe("activities");
    });

    it("dual-product, linked policy: no empty state and dashboard default", () => {
        const result = resolveCustomerDetailDashboardUx({
            customer: linkedPolicyCustomer,
            hasCreditInsurance: true,
            hasCollection: true,
            hasChildren: false,
            explicitTab: null,
        });
        expect(result.showDashboardNoPolicyEmptyState).toBe(false);
        expect(result.defaultTabWithoutUrlParam).toBe("dashboard");
    });

    it("parent, dual, no policy: empty state and aggregated_data default", () => {
        const result = resolveCustomerDetailDashboardUx({
            customer: noPolicyCustomer,
            hasCreditInsurance: true,
            hasCollection: true,
            hasChildren: true,
            explicitTab: null,
        });
        expect(result.showDashboardNoPolicyEmptyState).toBe(true);
        expect(result.defaultTabWithoutUrlParam).toBe("aggregated_data");
    });

    it("collection-only: no empty state and dashboard default", () => {
        const result = resolveCustomerDetailDashboardUx({
            customer: noPolicyCustomer,
            hasCreditInsurance: false,
            hasCollection: true,
            hasChildren: false,
            explicitTab: null,
        });
        expect(result.showDashboardNoPolicyEmptyState).toBe(false);
        expect(result.defaultTabWithoutUrlParam).toBe("dashboard");
    });

    it("history rows without insurance_policy_id: treated as no policy", () => {
        const result = resolveCustomerDetailDashboardUx({
            customer: makeCustomer({
                customerPolicies: [
                    { id: 1, is_active: false, insurance_policy_id: null },
                    { id: 2, is_active: true, insurance_policy_id: null },
                ],
            }),
            hasCreditInsurance: true,
            hasCollection: true,
            hasChildren: false,
            explicitTab: null,
        });
        expect(result.showDashboardNoPolicyEmptyState).toBe(true);
        expect(result.defaultTabWithoutUrlParam).toBe("activities");
    });

    it("legacy policy_id only: linked policy", () => {
        const result = resolveCustomerDetailDashboardUx({
            customer: makeCustomer({ policy_id: 12 }),
            hasCreditInsurance: true,
            hasCollection: true,
            hasChildren: false,
            explicitTab: null,
        });
        expect(result.showDashboardNoPolicyEmptyState).toBe(false);
        expect(result.defaultTabWithoutUrlParam).toBe("dashboard");
    });
});
