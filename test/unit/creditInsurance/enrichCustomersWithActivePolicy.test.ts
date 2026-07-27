import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
    prisma: {
        customerPolicy: {
            findMany: (...args: unknown[]) => mockFindMany(...args),
        },
    },
}));

import { enrichCustomersWithPolicyScope } from "@/server/services/creditInsurance/enrichCustomersWithActivePolicy";

describe("enrichCustomersWithPolicyScope", () => {
    beforeEach(() => {
        mockFindMany.mockReset();
    });

    it("loads active CustomerPolicy when policyId is null", async () => {
        mockFindMany.mockResolvedValue([
            {
                id: 101,
                customer_id: 1,
                insurance_policy_id: 10,
                capacity_gap_amount: 250,
                capacity_gap_amount_date: null,
                uninsured_amount: 250,
                capacity_gap_amount1: 250,
                capacity_gap_currency1: "USD",
                capacity_gap_amount2: null,
                capacity_gap_currency2: null,
                uninsured_amount1: 250,
                uninsured_currency1: "USD",
                uninsured_amount2: null,
                uninsured_currency2: null,
                limit_type: "DCL",
                outdated_dcl: false,
                approved_limit: null,
                approved_limit_currency: null,
                approved_limit_expiration_date: null,
                zero_limit_date: null,
                max_payment_term: 30,
                max_allowed_mep: 45,
                reporting_days: 35,
                excluded_from_policy: false,
                policy_exclusion_reason: null,
                credit_score: null,
                credit_score_input_date: null,
                active_customer_since: null,
                customer_number_policy: "P-1",
                InsurancePolicy: {
                    id: 10,
                    policy_number: "POL-10",
                    end_date: new Date("2027-01-01"),
                    score_validity_period_months: 12,
                    currency: "USD",
                    max_total_cover: null,
                    max_total_dcl_sdl_cover: null,
                },
            },
        ]);

        const [row] = await enrichCustomersWithPolicyScope([{ id: 1 }]);
        expect(mockFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { customer_id: { in: [1] }, is_active: true },
            })
        );
        expect(row.policy_id).toBe(10);
        expect(row.capacity_gap_amount).toBe(250);
        expect(row.reporting_days).toBe(35);
        expect(row.InsurancePolicy?.policy_number).toBe("POL-10");
    });

    it("prefers active row for scoped policyId when customer switched policies", async () => {
        mockFindMany.mockResolvedValue([
            {
                id: 201,
                customer_id: 2,
                insurance_policy_id: 20,
                is_active: true,
                limit_type: "Named",
                outdated_dcl: false,
                approved_limit: 5000,
                approved_limit_currency: "USD",
                approved_limit_expiration_date: null,
                zero_limit_date: null,
                max_payment_term: 60,
                max_allowed_mep: 90,
                reporting_days: 30,
                excluded_from_policy: false,
                policy_exclusion_reason: null,
                credit_score: null,
                credit_score_input_date: null,
                active_customer_since: null,
                customer_number_policy: "P-2",
                InsurancePolicy: {
                    id: 20,
                    policy_number: "POL-20",
                    end_date: new Date("2027-06-01"),
                    score_validity_period_months: 12,
                    currency: "USD",
                    max_total_cover: null,
                    max_total_dcl_sdl_cover: null,
                },
            },
            {
                id: 202,
                customer_id: 2,
                insurance_policy_id: 20,
                is_active: false,
                limit_type: "Named",
                outdated_dcl: false,
                approved_limit: 4000,
                approved_limit_currency: "USD",
                approved_limit_expiration_date: null,
                zero_limit_date: null,
                max_payment_term: 45,
                max_allowed_mep: 60,
                reporting_days: 25,
                excluded_from_policy: false,
                policy_exclusion_reason: null,
                credit_score: null,
                credit_score_input_date: null,
                active_customer_since: null,
                customer_number_policy: "P-2-old",
                InsurancePolicy: {
                    id: 20,
                    policy_number: "POL-20",
                    end_date: new Date("2027-06-01"),
                    score_validity_period_months: 12,
                    currency: "USD",
                    max_total_cover: null,
                    max_total_dcl_sdl_cover: null,
                },
            },
        ]);

        const [row] = await enrichCustomersWithPolicyScope([{ id: 2 }], 20);
        expect(mockFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    customer_id: { in: [2] },
                    insurance_policy_id: 20,
                },
            })
        );
        expect(row.approved_limit?.toString()).toBe("5000");
        expect(row.max_payment_term).toBe(60);
    });
});
