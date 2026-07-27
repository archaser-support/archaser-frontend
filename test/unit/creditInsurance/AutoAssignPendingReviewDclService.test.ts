import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    autoAssignPendingReviewDcl,
    ensurePendingReviewOnDclWithoutExclusion,
} from "@/server/services/creditInsurance/AutoAssignPendingReviewDclService";
import { createPrismaMock } from "@/test/mocks/prisma";

const { mocks, prismaHolder } = vi.hoisted(() => ({
    mocks: {
        listAssignablePrimaryPolicies: vi.fn(),
        switchActivePolicy: vi.fn(),
        applyActivePolicyPatch: vi.fn(),
        getActiveCustomerPolicyRow: vi.fn(),
        syncCustomerInsuranceFields: vi.fn(),
        syncCreditInsuranceGapPipelineForCustomer: vi.fn(),
    },
    prismaHolder: {
        prisma: null as ReturnType<typeof createPrismaMock> | null,
    },
}));

vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    const prisma = createPrismaMock();
    prismaHolder.prisma = prisma;
    return { prisma };
});

vi.mock("@/server/services/InsurancePolicyService", () => ({
    InsurancePolicyService: {
        listAssignablePrimaryPolicies: mocks.listAssignablePrimaryPolicies,
    },
}));

vi.mock("@/server/services/creditInsurance/CustomerPolicyService", () => ({
    CustomerPolicyService: {
        switchActivePolicy: mocks.switchActivePolicy,
        applyActivePolicyPatch: mocks.applyActivePolicyPatch,
    },
}));

vi.mock(
    "@/server/services/creditInsurance/resolveActiveCustomerPolicy",
    () => ({
        getActiveCustomerPolicyRow: mocks.getActiveCustomerPolicyRow,
    })
);

vi.mock(
    "@/server/services/creditInsurance/syncCustomerInsuranceFields",
    () => ({
        syncCustomerInsuranceFields: mocks.syncCustomerInsuranceFields,
    })
);

vi.mock(
    "@/server/services/creditInsurance/syncCreditInsuranceGapPipeline",
    () => ({
        syncCreditInsuranceGapPipelineForCustomer:
            mocks.syncCreditInsuranceGapPipelineForCustomer,
    })
);

const baseArgs = {
    customerId: 100,
    accountId: 42,
    countryId: 1,
    customerNumber: "CUST-1",
    modifiedBy: "user-1",
};

describe("autoAssignPendingReviewDcl", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prismaHolder.prisma!.account.findUnique.mockResolvedValue({
            has_credit_insurance: true,
        });
        mocks.listAssignablePrimaryPolicies.mockResolvedValue([
            { id: 5, policy_number: "POL-1" },
        ]);
        mocks.getActiveCustomerPolicyRow
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                id: 10,
                insurance_policy_id: 5,
                limit_type: "DCL",
                policy_exclusion_reason: null,
            });
        mocks.switchActivePolicy.mockResolvedValue({});
        mocks.applyActivePolicyPatch.mockResolvedValue({});
    });

    it("assigns DCL with pending review on happy path", async () => {
        const result = await autoAssignPendingReviewDcl(baseArgs);

        expect(result).toEqual({ assigned: true });
        expect(mocks.switchActivePolicy).toHaveBeenCalledWith(
            expect.objectContaining({
                customerId: 100,
                newInsurancePolicyId: 5,
                limitType: "DCL",
            })
        );
        expect(mocks.applyActivePolicyPatch).toHaveBeenCalledWith(
            expect.objectContaining({
                patch: {
                    limit_type: "DCL",
                    policy_exclusion_reason: "Pending review",
                },
            })
        );
    });

    it("skips when account has no single assignable primary policy", async () => {
        mocks.listAssignablePrimaryPolicies.mockResolvedValue([]);

        const result = await autoAssignPendingReviewDcl(baseArgs);

        expect(result).toEqual({
            assigned: false,
            skippedReason: "no_single_assignable_primary",
        });
        expect(mocks.switchActivePolicy).not.toHaveBeenCalled();
    });

    it("skips when customer already has active linked policy", async () => {
        mocks.getActiveCustomerPolicyRow.mockReset();
        mocks.getActiveCustomerPolicyRow.mockResolvedValue({
            insurance_policy_id: 9,
            limit_type: "DCL",
        });

        const result = await autoAssignPendingReviewDcl(baseArgs);

        expect(result).toEqual({
            assigned: false,
            skippedReason: "active_linked_policy_exists",
        });
    });

    it("skips when customer already has active Named assignment", async () => {
        mocks.getActiveCustomerPolicyRow.mockReset();
        mocks.getActiveCustomerPolicyRow.mockResolvedValue({
            insurance_policy_id: null,
            limit_type: "Named",
        });

        const result = await autoAssignPendingReviewDcl(baseArgs);

        expect(result).toEqual({
            assigned: false,
            skippedReason: "active_named_assignment_exists",
        });
    });
});

describe("ensurePendingReviewOnDclWithoutExclusion", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.applyActivePolicyPatch.mockResolvedValue({});
    });

    it("applies pending review when DCL policy has no exclusion reason", async () => {
        mocks.getActiveCustomerPolicyRow.mockResolvedValue({
            id: 10,
            insurance_policy_id: 5,
            limit_type: "DCL",
            policy_exclusion_reason: null,
        });

        await ensurePendingReviewOnDclWithoutExclusion({
            previousPolicyExclusionReason: null,
            policyExclusionReasonInRequest: null,
            limitTypeInRequest: undefined,
            ...baseArgs,
        });

        expect(mocks.applyActivePolicyPatch).toHaveBeenCalledWith(
            expect.objectContaining({
                patch: {
                    limit_type: "DCL",
                    policy_exclusion_reason: "Pending review",
                },
            })
        );
    });

    it("still applies when form sends null exclusion reason on first save", async () => {
        mocks.getActiveCustomerPolicyRow.mockResolvedValue({
            id: 10,
            insurance_policy_id: 5,
            limit_type: "DCL",
            policy_exclusion_reason: null,
        });

        await ensurePendingReviewOnDclWithoutExclusion({
            previousPolicyExclusionReason: null,
            policyExclusionReasonInRequest: null,
            limitTypeInRequest: "DCL",
            ...baseArgs,
        });

        expect(mocks.applyActivePolicyPatch).toHaveBeenCalled();
    });

    it("does not override when caller sent a non-empty exclusion reason", async () => {
        await ensurePendingReviewOnDclWithoutExclusion({
            previousPolicyExclusionReason: null,
            policyExclusionReasonInRequest: "Credit hold",
            limitTypeInRequest: undefined,
            ...baseArgs,
        });

        expect(mocks.getActiveCustomerPolicyRow).not.toHaveBeenCalled();
        expect(mocks.applyActivePolicyPatch).not.toHaveBeenCalled();
    });

    it("does not re-apply when user cleared an existing exclusion reason", async () => {
        await ensurePendingReviewOnDclWithoutExclusion({
            previousPolicyExclusionReason: "Pending review",
            policyExclusionReasonInRequest: null,
            limitTypeInRequest: undefined,
            ...baseArgs,
        });

        expect(mocks.applyActivePolicyPatch).not.toHaveBeenCalled();
    });

    it("skips Named limit type assignments", async () => {
        await ensurePendingReviewOnDclWithoutExclusion({
            previousPolicyExclusionReason: null,
            policyExclusionReasonInRequest: null,
            limitTypeInRequest: "Named",
            ...baseArgs,
        });

        expect(mocks.applyActivePolicyPatch).not.toHaveBeenCalled();
    });
});
