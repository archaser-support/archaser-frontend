import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    customerFindUnique: vi.fn(),
    customerPolicyUpdate: vi.fn(),
    syncInvoiceCapacityGapFlagsForCustomer: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: {
        customer: { findUnique: mocks.customerFindUnique },
        customerPolicy: { update: mocks.customerPolicyUpdate },
    },
}));

vi.mock(
    "@/server/services/creditInsurance/syncInvoiceCapacityGapFlags",
    () => ({
        syncInvoiceCapacityGapFlagsForCustomer:
            mocks.syncInvoiceCapacityGapFlagsForCustomer,
    })
);

import { syncCustomerPolicyGapAmountsForCustomer } from "@/server/services/creditInsurance/syncCustomerPolicyGapAmounts";

describe("syncCustomerPolicyGapAmountsForCustomer uncovered short-circuit", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.customerPolicyUpdate.mockResolvedValue({});
        mocks.syncInvoiceCapacityGapFlagsForCustomer.mockResolvedValue(undefined);
    });

    it("persists null gap payload when customer has exclusion reason", async () => {
        mocks.customerFindUnique.mockResolvedValue({
            id: 1,
            account_id: 10,
            Account: { currency: "USD", has_credit_insurance: true },
            CustomerPolicy: [
                {
                    id: 99,
                    insurance_policy_id: 5,
                    is_active: true,
                    policy_exclusion_reason: "Credit hold",
                    customer_number_policy: "CN-1",
                    approved_limit: 10_000,
                    approved_limit_currency: "USD",
                    approved_limit_expiration_date: null,
                    limit_type: "Named",
                    max_payment_term: 30,
                    max_allowed_mep: 90,
                    reporting_days: 7,
                    excluded_from_policy: true,
                    credit_score: null,
                    credit_score_input_date: null,
                    active_customer_since: null,
                    outdated_dcl: false,
                    retained_capacity_gap: 500,
                },
            ],
        });

        await syncCustomerPolicyGapAmountsForCustomer(1);

        expect(mocks.customerPolicyUpdate).toHaveBeenCalledWith({
            where: { id: 99 },
            data: expect.objectContaining({
                capacity_gap_amount: null,
                uninsured_amount: null,
                retained_capacity_gap: null,
            }),
        });
    });

    it("persists null gap payload when active policy has no linked insurance policy", async () => {
        mocks.customerFindUnique.mockResolvedValue({
            id: 2,
            account_id: 10,
            Account: { currency: "USD", has_credit_insurance: true },
            CustomerPolicy: [
                {
                    id: 100,
                    insurance_policy_id: null,
                    is_active: true,
                    policy_exclusion_reason: null,
                    customer_number_policy: null,
                    approved_limit: null,
                    approved_limit_currency: null,
                    approved_limit_expiration_date: null,
                    limit_type: "DCL",
                    max_payment_term: null,
                    max_allowed_mep: null,
                    reporting_days: null,
                    excluded_from_policy: false,
                    credit_score: null,
                    credit_score_input_date: null,
                    active_customer_since: null,
                    outdated_dcl: false,
                    retained_capacity_gap: 200,
                },
            ],
        });

        await syncCustomerPolicyGapAmountsForCustomer(2);

        expect(mocks.customerPolicyUpdate).not.toHaveBeenCalled();
    });
});
