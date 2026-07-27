import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    customerPolicyFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: {
        customerPolicy: {
            findMany: mocks.customerPolicyFindMany,
        },
    },
    defaultPrisma: {
        customerPolicy: {
            findMany: mocks.customerPolicyFindMany,
        },
    },
}));

import { sumCustomerPolicyCapacityGapForAccount } from "@/server/services/creditInsurance/invoiceCapacityGapAmounts";

describe("sumCustomerPolicyCapacityGapForAccount", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("sums capacity_gap_amount on active policy rows for portfolio rollup", async () => {
        mocks.customerPolicyFindMany.mockResolvedValue([
            {
                customer_id: 1,
                insurance_policy_id: 10,
                capacity_gap_amount: 3000,
                capacity_gap_amount1: 500,
            },
            {
                customer_id: 2,
                insurance_policy_id: 10,
                capacity_gap_amount: 1500,
                capacity_gap_amount1: 0,
            },
            {
                customer_id: 3,
                insurance_policy_id: 20,
                capacity_gap_amount: 800,
                capacity_gap_amount1: 200,
            },
        ]);

        const rollup = await sumCustomerPolicyCapacityGapForAccount(99);

        expect(rollup.gapBaseTotal).toBe(5300);
        expect(rollup.customerOverLimitCount).toBe(2);
        expect(rollup.gapByPolicyId.get(10)).toBe(4500);
        expect(rollup.gapByPolicyId.get(20)).toBe(800);
        expect(rollup.gapByCustomerPolicy.get("1:10")).toBe(3000);
    });

    it("passes policyId filter to the query", async () => {
        mocks.customerPolicyFindMany.mockResolvedValue([]);

        await sumCustomerPolicyCapacityGapForAccount(99, { policyId: 10 });

        expect(mocks.customerPolicyFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    insurance_policy_id: 10,
                }),
            })
        );
    });

    it("applies business unit filter on Customer scope", async () => {
        mocks.customerPolicyFindMany.mockResolvedValue([]);

        await sumCustomerPolicyCapacityGapForAccount(99, {
            businessUnitFilter: { business_unit_id: 131 },
        });

        expect(mocks.customerPolicyFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    Customer: {
                        AND: [
                            {
                                account_id: 99,
                                collection_status: { in: ["Active", "Inactive"] },
                            },
                            { business_unit_id: 131 },
                        ],
                    },
                }),
            })
        );
    });
});
