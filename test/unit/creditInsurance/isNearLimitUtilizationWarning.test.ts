import { describe, expect, it } from "vitest";

import { isNearLimitUtilizationWarning } from "@/server/services/creditInsurance/invoiceInsuranceFields";

describe("isNearLimitUtilizationWarning", () => {
    const thresholdPct = 80;

    it("uses approved limit when top-up is not enabled", () => {
        expect(
            isNearLimitUtilizationWarning({
                ar: 8_500,
                approvedLimit: 10_000,
                thresholdPct,
            })
        ).toBe(true);
        expect(
            isNearLimitUtilizationWarning({
                ar: 12_000,
                approvedLimit: 10_000,
                thresholdPct,
            })
        ).toBe(false);
    });

    it("uses effective limit when top-up is enabled", () => {
        expect(
            isNearLimitUtilizationWarning({
                ar: 15_000,
                approvedLimit: 10_000,
                effectiveLimitInAccountCurrency: 15_000,
                useEffectiveLimit: true,
                thresholdPct,
            })
        ).toBe(true);
        expect(
            isNearLimitUtilizationWarning({
                ar: 12_000,
                approvedLimit: 10_000,
                effectiveLimitInAccountCurrency: 15_000,
                useEffectiveLimit: true,
                thresholdPct,
            })
        ).toBe(true);
        expect(
            isNearLimitUtilizationWarning({
                ar: 11_000,
                approvedLimit: 10_000,
                effectiveLimitInAccountCurrency: 15_000,
                useEffectiveLimit: true,
                thresholdPct,
            })
        ).toBe(false);
    });

    it("excludes customers over effective limit (capacity gap territory)", () => {
        expect(
            isNearLimitUtilizationWarning({
                ar: 15_100,
                approvedLimit: 10_000,
                effectiveLimitInAccountCurrency: 15_000,
                useEffectiveLimit: true,
                thresholdPct,
            })
        ).toBe(false);
    });

    it("does not treat over-approved-but-within-effective as over limit when top-up applies", () => {
        expect(
            isNearLimitUtilizationWarning({
                ar: 12_000,
                approvedLimit: 10_000,
                effectiveLimitInAccountCurrency: 15_000,
                useEffectiveLimit: true,
                thresholdPct,
            })
        ).toBe(true);
    });
});
