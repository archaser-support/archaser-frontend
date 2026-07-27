import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { computePolicyGapAmounts } from "@/server/services/creditInsurance/computePolicyGapAmounts";

const rateDate = new Date("2026-05-31T00:00:00.000Z");

describe("computePolicyGapAmounts", () => {
    it("zeros gap when outdated DCL", () => {
        const result = computePolicyGapAmounts({
            outdatedDcl: true,
            approvedLimit: new Prisma.Decimal(1000),
            approvedLimitCurrency: "USD",
            accountCurrency: "USD",
            openAr: 5000,
            currencyBuckets: [{ currency: "USD", openAr: 5000 }],
            rateDate,
        });
        expect(result.missingRate).toBe(false);
        expect(result.payload?.capacity_gap_amount).toBe(0);
        expect(result.payload?.uninsured_amount).toBe(0);
    });

    it("same-currency account gap and uninsured", () => {
        const result = computePolicyGapAmounts({
            outdatedDcl: false,
            approvedLimit: new Prisma.Decimal(1000),
            approvedLimitCurrency: "USD",
            accountCurrency: "USD",
            openAr: 1500,
            currencyBuckets: [{ currency: "USD", openAr: 1500 }],
            rateDate,
        });
        expect(result.missingRate).toBe(false);
        expect(result.payload?.capacity_gap_amount).toBe(500);
        expect(result.payload?.uninsured_amount).toBe(500);
        expect(result.payload?.capacity_gap_amount1).toBe(500);
        expect(result.payload?.capacity_gap_currency1).toBe("USD");
    });

    it("cross-currency uses rate and sets missingRate when rate missing", () => {
        const withRate = computePolicyGapAmounts({
            outdatedDcl: false,
            approvedLimit: new Prisma.Decimal(100),
            approvedLimitCurrency: "EUR",
            accountCurrency: "USD",
            openAr: 200,
            currencyBuckets: [{ currency: "USD", openAr: 200 }],
            rateDate,
            currencyRate: {
                base_currency: "USD",
                other_currency: "EUR",
                currency_ratio: 2,
                rate_date: rateDate,
            },
        });
        expect(withRate.missingRate).toBe(false);
        expect(withRate.payload?.capacity_gap_amount).toBe(150);

        const noRate = computePolicyGapAmounts({
            outdatedDcl: false,
            approvedLimit: new Prisma.Decimal(100),
            approvedLimitCurrency: "EUR",
            accountCurrency: "USD",
            openAr: 200,
            currencyBuckets: [],
            rateDate,
            currencyRate: null,
        });
        expect(noRate.missingRate).toBe(true);
    });

    it("converts policy-currency capacity gap to base currency when bucket currency matches approved limit currency", () => {
        const result = computePolicyGapAmounts({
            outdatedDcl: false,
            approvedLimit: new Prisma.Decimal(12000),
            approvedLimitCurrency: "GBP",
            accountCurrency: "ILS",
            openAr: 75000,
            currencyBuckets: [{ currency: "GBP", openAr: 15000 }],
            rateDate,
            currencyRate: {
                base_currency: "ILS",
                other_currency: "GBP",
                currency_ratio: 0.25503,
                rate_date: rateDate,
            },
        });
        expect(result.missingRate).toBe(false);
        // gap in policy currency is 15000 - 12000 = 3000 GBP
        // converted to ILS: 3000 / 0.25503 = 11763.32196
        expect(result.payload?.capacity_gap_amount).toBeCloseTo(11763.32, 2);
        expect(result.payload?.uninsured_amount).toBeCloseTo(11763.32, 2);
        expect(result.payload?.capacity_gap_amount1).toBe(3000);
        expect(result.payload?.capacity_gap_currency1).toBe("GBP");
    });
});
