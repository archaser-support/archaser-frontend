import { describe, expect, it } from "vitest";

import {
    computeCustomerDailyCostSnapshot,
    computePolicyDailyCost,
    computeTopUpDailyCostAggregate,
    computeTotalDailyCost,
    inclusiveUtcCalendarDays,
} from "@/server/services/creditInsurance/customerPolicyDailyCost";

function utcDate(iso: string): Date {
    return new Date(iso);
}

describe("inclusiveUtcCalendarDays", () => {
    it("counts a single-day window as one day", () => {
        expect(
            inclusiveUtcCalendarDays(
                utcDate("2026-06-10"),
                utcDate("2026-06-10")
            )
        ).toBe(1);
    });

    it("counts inclusive calendar days across a month window", () => {
        expect(
            inclusiveUtcCalendarDays(
                utcDate("2026-06-01"),
                utcDate("2026-06-30")
            )
        ).toBe(30);
    });
});

describe("computePolicyDailyCost", () => {
    it("computes Limit method from approved limit and daily cost percent", () => {
        const result = computePolicyDailyCost({
            costCalculationMethod: "Limit",
            costPercent: 0.05,
            approvedLimit: 1_000_000,
            usageAmount: 250_000,
            limitCurrency: "usd",
            excludedFromPolicy: false,
            outdatedDcl: false,
        });

        expect(result.policyDailyCost).toEqual({
            amount: 500,
            currency: "USD",
        });
        expect(result.costCalculationMethod).toBe("Limit");
        expect(result.costPercent).toBe(0.05);
    });

    it("computes Actual Sales method from usage amount", () => {
        const result = computePolicyDailyCost({
            costCalculationMethod: "ActualSales",
            costPercent: 0.1,
            approvedLimit: 1_000_000,
            usageAmount: 200_000,
            limitCurrency: "EUR",
            excludedFromPolicy: false,
            outdatedDcl: false,
        });

        expect(result.policyDailyCost).toEqual({
            amount: 200,
            currency: "EUR",
        });
    });

    it("returns null policy cost when cost config is missing", () => {
        const result = computePolicyDailyCost({
            costCalculationMethod: null,
            costPercent: 0.05,
            approvedLimit: 1_000_000,
            usageAmount: 200_000,
            limitCurrency: "USD",
            excludedFromPolicy: false,
            outdatedDcl: false,
        });

        expect(result.policyDailyCost).toBeNull();
    });

    it("returns null policy cost when excluded from policy", () => {
        const result = computePolicyDailyCost({
            costCalculationMethod: "Limit",
            costPercent: 0.05,
            approvedLimit: 1_000_000,
            usageAmount: 200_000,
            limitCurrency: "USD",
            excludedFromPolicy: true,
            outdatedDcl: false,
        });

        expect(result.policyDailyCost).toBeNull();
        expect(result.costCalculationMethod).toBe("Limit");
        expect(result.costPercent).toBe(0.05);
    });

    it("returns null policy cost when DCL is outdated", () => {
        const result = computePolicyDailyCost({
            costCalculationMethod: "Limit",
            costPercent: 0.05,
            approvedLimit: 1_000_000,
            usageAmount: 200_000,
            limitCurrency: "USD",
            excludedFromPolicy: false,
            outdatedDcl: true,
        });

        expect(result.policyDailyCost).toBeNull();
    });

    it("does not divide cost percent by 365", () => {
        const result = computePolicyDailyCost({
            costCalculationMethod: "Limit",
            costPercent: 0.05,
            approvedLimit: 1_000_000,
            usageAmount: 0,
            limitCurrency: "USD",
            excludedFromPolicy: false,
            outdatedDcl: false,
        });

        expect(result.policyDailyCost?.amount).toBe(500);
        expect(result.policyDailyCost?.amount).not.toBeCloseTo(500 / 365);
    });
});

describe("computeTopUpDailyCostAggregate", () => {
    const asOf = utcDate("2026-06-15");

    it("amortizes premium evenly over inclusive calendar days", () => {
        const result = computeTopUpDailyCostAggregate(
            [
                {
                    premium: 3_000,
                    premiumCurrency: "USD",
                    startDate: utcDate("2026-06-01"),
                    endDate: utcDate("2026-06-30"),
                    cancelledAt: null,
                },
            ],
            asOf
        );

        expect(result).toEqual({ amount: 100, currency: "USD" });
    });

    it("sums same-currency top-ups", () => {
        const result = computeTopUpDailyCostAggregate(
            [
                {
                    premium: 3_000,
                    premiumCurrency: "USD",
                    startDate: utcDate("2026-06-01"),
                    endDate: utcDate("2026-06-30"),
                    cancelledAt: null,
                },
                {
                    premium: 1_500,
                    premiumCurrency: "USD",
                    startDate: utcDate("2026-06-01"),
                    endDate: utcDate("2026-06-15"),
                    cancelledAt: null,
                },
            ],
            asOf
        );

        expect(result?.amount).toBeCloseTo(100 + 100);
        expect(result?.currency).toBe("USD");
    });

    it("returns null when premium currencies are mixed", () => {
        const result = computeTopUpDailyCostAggregate(
            [
                {
                    premium: 3_000,
                    premiumCurrency: "USD",
                    startDate: utcDate("2026-06-01"),
                    endDate: utcDate("2026-06-30"),
                    cancelledAt: null,
                },
                {
                    premium: 1_500,
                    premiumCurrency: "EUR",
                    startDate: utcDate("2026-06-01"),
                    endDate: utcDate("2026-06-30"),
                    cancelledAt: null,
                },
            ],
            asOf
        );

        expect(result).toBeNull();
    });

    it("skips top-ups without premium and returns null when none remain", () => {
        const result = computeTopUpDailyCostAggregate(
            [
                {
                    premium: null,
                    premiumCurrency: "USD",
                    startDate: utcDate("2026-06-01"),
                    endDate: utcDate("2026-06-30"),
                    cancelledAt: null,
                },
            ],
            asOf
        );

        expect(result).toBeNull();
    });

    it("excludes cancelled and inactive top-ups", () => {
        const result = computeTopUpDailyCostAggregate(
            [
                {
                    premium: 3_000,
                    premiumCurrency: "USD",
                    startDate: utcDate("2026-06-01"),
                    endDate: utcDate("2026-06-30"),
                    cancelledAt: utcDate("2026-06-10"),
                },
                {
                    premium: 3_000,
                    premiumCurrency: "USD",
                    startDate: utcDate("2026-07-01"),
                    endDate: utcDate("2026-07-31"),
                    cancelledAt: null,
                },
            ],
            asOf
        );

        expect(result).toBeNull();
    });

    it("handles a single-day top-up window", () => {
        const result = computeTopUpDailyCostAggregate(
            [
                {
                    premium: 250,
                    premiumCurrency: "USD",
                    startDate: utcDate("2026-06-15"),
                    endDate: utcDate("2026-06-15"),
                    cancelledAt: null,
                },
            ],
            asOf
        );

        expect(result).toEqual({ amount: 250, currency: "USD" });
    });
});

describe("computeTotalDailyCost", () => {
    it("sums policy and top-up when currencies match", () => {
        expect(
            computeTotalDailyCost(
                { amount: 500, currency: "USD" },
                { amount: 100, currency: "USD" }
            )
        ).toBe(600);
    });

    it("returns policy-only total when top-up is null", () => {
        expect(
            computeTotalDailyCost({ amount: 500, currency: "USD" }, null)
        ).toBe(500);
    });

    it("returns top-up-only total when policy is null", () => {
        expect(
            computeTotalDailyCost(null, { amount: 100, currency: "USD" })
        ).toBe(100);
    });

    it("returns null when both exist in different currencies", () => {
        expect(
            computeTotalDailyCost(
                { amount: 500, currency: "USD" },
                { amount: 100, currency: "EUR" }
            )
        ).toBeNull();
    });

    it("returns null when both components are null", () => {
        expect(computeTotalDailyCost(null, null)).toBeNull();
    });
});

describe("computeCustomerDailyCostSnapshot", () => {
    const asOf = utcDate("2026-06-15");

    it("nulls all cost amounts when customer is excluded", () => {
        const snapshot = computeCustomerDailyCostSnapshot({
            policyInput: {
                costCalculationMethod: "Limit",
                costPercent: 0.05,
                approvedLimit: 1_000_000,
                usageAmount: 200_000,
                limitCurrency: "USD",
                excludedFromPolicy: true,
                outdatedDcl: false,
            },
            activeTopUps: [
                {
                    premium: 3_000,
                    premiumCurrency: "USD",
                    startDate: utcDate("2026-06-01"),
                    endDate: utcDate("2026-06-30"),
                    cancelledAt: null,
                },
            ],
            asOfDate: asOf,
        });

        expect(snapshot).toEqual({
            policyDailyCost: null,
            policyCostCurrency: null,
            topUpDailyCost: null,
            topUpCostCurrency: null,
            totalDailyCost: null,
            costCalculationMethod: "Limit",
            costPercent: 0.05,
        });
    });

    it("combines policy and top-up costs when currencies match", () => {
        const snapshot = computeCustomerDailyCostSnapshot({
            policyInput: {
                costCalculationMethod: "Limit",
                costPercent: 0.05,
                approvedLimit: 1_000_000,
                usageAmount: 200_000,
                limitCurrency: "USD",
                excludedFromPolicy: false,
                outdatedDcl: false,
            },
            activeTopUps: [
                {
                    premium: 3_000,
                    premiumCurrency: "USD",
                    startDate: utcDate("2026-06-01"),
                    endDate: utcDate("2026-06-30"),
                    cancelledAt: null,
                },
            ],
            asOfDate: asOf,
        });

        expect(snapshot.policyDailyCost).toBe(500);
        expect(snapshot.topUpDailyCost).toBe(100);
        expect(snapshot.totalDailyCost).toBe(600);
        expect(snapshot.policyCostCurrency).toBe("USD");
        expect(snapshot.topUpCostCurrency).toBe("USD");
    });
});
