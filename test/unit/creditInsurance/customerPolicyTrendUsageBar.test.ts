import { describe, expect, it } from "vitest";

import { computeCustomerUsageBarSegments } from "@/server/services/creditInsurance/customerPolicyTrendService";

describe("computeCustomerUsageBarSegments", () => {
    it("uses policy-only usage when account has no top-up policies", () => {
        const result = computeCustomerUsageBarSegments({
            ar: 15_000,
            approvedLimit: 12_000,
            topUpTotal: null,
            hasTopUpPolicies: false,
        });
        expect(result.policyUsagePct).toBe(125);
        expect(result.topUpUsagePct).toBeNull();
        expect(result.barTopUpPct).toBe(0);
        expect(result.usagePct).toBe(125);
    });

    it("splits policy and top-up segments when AR exceeds approved limit", () => {
        const result = computeCustomerUsageBarSegments({
            ar: 14_000,
            approvedLimit: 10_000,
            topUpTotal: 5_000,
            hasTopUpPolicies: true,
        });
        expect(result.policyUsagePct).toBe(100);
        expect(result.topUpUsagePct).toBe(80);
        expect(result.effectiveUsagePct).toBeCloseTo(93.333, 2);
        expect(result.barPolicyPct).toBeCloseTo(66.667, 2);
        expect(result.barTopUpPct).toBeCloseTo(26.667, 2);
        expect(result.barOverPct).toBe(0);
    });

    it("adds over-effective segment when AR exceeds base plus top-up", () => {
        const result = computeCustomerUsageBarSegments({
            ar: 19_000,
            approvedLimit: 10_000,
            topUpTotal: 8_000,
            hasTopUpPolicies: true,
        });
        expect(result.effectiveUsagePct).toBeCloseTo(105.56, 1);
        expect(result.barOverPct).toBeGreaterThan(0);
        expect(
            result.barPolicyPct + result.barTopUpPct + result.barOverPct
        ).toBeCloseTo(result.effectiveUsagePct!, 1);
    });
});
