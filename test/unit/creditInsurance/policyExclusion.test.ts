import { describe, expect, it } from "vitest";

import {
    deriveExcludedFromPolicy,
    isAllowedPolicyExclusionReason,
    isCustomerPolicyExcluded,
    isNoPolicyExposureCardCustomer,
    isPendingReviewExclusion,
    isUncoveredExposureCustomer,
    POLICY_EXCLUSION_REASONS,
} from "@/server/services/creditInsurance/policyExclusion";

describe("policyExclusion", () => {
    it("marks exclusion from non-empty reason", () => {
        expect(isCustomerPolicyExcluded(null)).toBe(false);
        expect(isCustomerPolicyExcluded("")).toBe(false);
        expect(isCustomerPolicyExcluded("   ")).toBe(false);
        expect(isCustomerPolicyExcluded("Pending review")).toBe(true);
        expect(deriveExcludedFromPolicy("Other")).toBe(true);
    });

    it("validates only allowlisted reasons", () => {
        for (const reason of POLICY_EXCLUSION_REASONS) {
            expect(isAllowedPolicyExclusionReason(reason)).toBe(true);
        }
        expect(isAllowedPolicyExclusionReason("pending review")).toBe(true);
        expect(isAllowedPolicyExclusionReason("Random")).toBe(false);
    });

    it("detects pending review case-insensitively", () => {
        expect(isPendingReviewExclusion("Pending review")).toBe(true);
        expect(isPendingReviewExclusion(" pending review ")).toBe(true);
        expect(isPendingReviewExclusion("PENDING REVIEW")).toBe(true);
        expect(isPendingReviewExclusion("Other")).toBe(false);
    });

    it("classifies uncovered exposure (no-policy and each exclusion reason)", () => {
        expect(
            isUncoveredExposureCustomer({
                hasLinkedPolicy: false,
                exclusionReason: null,
            })
        ).toBe(true);
        for (const reason of POLICY_EXCLUSION_REASONS) {
            expect(
                isUncoveredExposureCustomer({
                    hasLinkedPolicy: true,
                    exclusionReason: reason,
                })
            ).toBe(true);
        }
        expect(
            isUncoveredExposureCustomer({
                hasLinkedPolicy: true,
                exclusionReason: null,
            })
        ).toBe(false);
    });

    it("classifies No Policy Exposure card cohort", () => {
        expect(
            isNoPolicyExposureCardCustomer({
                hasLinkedPolicy: false,
                exclusionReason: null,
                openAr: 100,
            })
        ).toBe(true);
        expect(
            isNoPolicyExposureCardCustomer({
                hasLinkedPolicy: true,
                exclusionReason: "Pending review",
                openAr: 50,
            })
        ).toBe(true);
        expect(
            isNoPolicyExposureCardCustomer({
                hasLinkedPolicy: true,
                exclusionReason: "Credit hold",
                openAr: 100,
            })
        ).toBe(false);
        expect(
            isNoPolicyExposureCardCustomer({
                hasLinkedPolicy: false,
                exclusionReason: null,
                openAr: 0,
            })
        ).toBe(false);
    });
});
