import { describe, expect, it } from "vitest";

import { computeCustomerUsageBarSegments } from "@/server/services/creditInsurance/customerPolicyTrendService";

describe("policy usage multi-currency alignment", () => {
    it("usage % uses AR and limit in the same currency (GBP example)", () => {
        const arGbp = 15_000;
        const limitGbp = 12_000;
        const segments = computeCustomerUsageBarSegments({
            ar: arGbp,
            approvedLimit: limitGbp,
            topUpTotal: null,
            hasTopUpPolicies: false,
        });
        expect(segments.policyUsagePct).toBeCloseTo(125, 2);
        expect(segments.usagePct).toBeCloseTo(125, 2);
    });

    it("mixing ILS AR with GBP limit inflates usage (regression guard)", () => {
        const wrongSegments = computeCustomerUsageBarSegments({
            ar: 75_000,
            approvedLimit: 12_000,
            topUpTotal: null,
            hasTopUpPolicies: false,
        });
        expect(wrongSegments.policyUsagePct).toBeCloseTo(625, 2);

        const correctSegments = computeCustomerUsageBarSegments({
            ar: 15_000,
            approvedLimit: 12_000,
            topUpTotal: null,
            hasTopUpPolicies: false,
        });
        expect(correctSegments.policyUsagePct).toBeCloseTo(125, 2);
    });
});
