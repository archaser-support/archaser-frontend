import { describe, expect, it } from "vitest";

import {
    computeCustomerRiskExposure,
    computeLimitExcessOverEffective,
} from "@/server/services/creditInsurance/invoiceInsuranceFields";

describe("computeLimitExcessOverEffective", () => {
    it("returns zero when AR is within effective limit", () => {
        expect(computeLimitExcessOverEffective(20_600, 20_600)).toBe(0);
        expect(computeLimitExcessOverEffective(15_000, 20_600)).toBe(0);
    });

    it("returns excess when AR exceeds effective limit", () => {
        expect(computeLimitExcessOverEffective(21_000, 20_600)).toBe(400);
    });
});

describe("computeCustomerRiskExposure", () => {
    it("uses capacity gap when no terms breach", () => {
        expect(
            computeCustomerRiskExposure({
                totalAr: 14_000,
                capacityGapAmount: 4_000,
                termsBreachOutstanding: 0,
            })
        ).toBe(4_000);
    });

    it("sums capacity gap and terms breach", () => {
        expect(
            computeCustomerRiskExposure({
                totalAr: 23_000,
                capacityGapAmount: 3_000,
                termsBreachOutstanding: 5_000,
            })
        ).toBe(8_000);
    });

    it("caps summed drivers at open AR", () => {
        expect(
            computeCustomerRiskExposure({
                totalAr: 5_000,
                capacityGapAmount: 3_000,
                termsBreachOutstanding: 5_000,
            })
        ).toBe(5_000);
    });

    it("returns zero when open AR is zero", () => {
        expect(
            computeCustomerRiskExposure({
                totalAr: 0,
                capacityGapAmount: 3_000,
                termsBreachOutstanding: 5_000,
            })
        ).toBe(0);
    });
});
