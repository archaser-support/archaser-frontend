import { describe, expect, it } from "vitest";

import {
    applyTermsBreachOtherBucket,
    aggregatePolicyUsageFromRows,
    computeCustomerHealthIndex,
    computePortfolioUsagePct,
} from "@/server/services/creditInsurance/customerDashboardKpisService";
import { computeTopUpUsageMetrics } from "@/server/services/creditInsurance/invoiceCapacityGapAmounts";
import { computeCustomerRiskExposure } from "@/server/services/creditInsurance/invoiceInsuranceFields";

describe("computeCustomerHealthIndex", () => {
    it("matches portfolio formula (compliant / total) × 100", () => {
        const totalAr = 1000;
        const atRisk = computeCustomerRiskExposure({
            totalAr,
            capacityGapAmount: 200,
            termsBreachOutstanding: 100,
        });
        const health = computeCustomerHealthIndex(totalAr, atRisk);
        const compliant = totalAr - atRisk;
        expect(health).toBeCloseTo((100 * compliant) / totalAr, 5);
    });

    it("returns 100 when total AR is zero", () => {
        expect(computeCustomerHealthIndex(0, 0)).toBe(100);
        expect(computeCustomerHealthIndex(0, 50)).toBe(100);
    });

    it("clamps to 0–100", () => {
        expect(computeCustomerHealthIndex(100, 150)).toBe(0);
        expect(computeCustomerHealthIndex(100, -10)).toBe(100);
    });

    it("uses capacity gap for at-risk when within effective limit with top-up", () => {
        const totalAr = 20_600;
        const atRisk = computeCustomerRiskExposure({
            totalAr,
            capacityGapAmount: 5_000,
            termsBreachOutstanding: 0,
        });
        expect(atRisk).toBe(5_000);
        expect(computeCustomerHealthIndex(totalAr, atRisk)).toBeCloseTo(
            (100 * (totalAr - 5_000)) / totalAr,
            5
        );
    });
});

describe("computePortfolioUsagePct", () => {
    it("returns null when no positive approved limits", async () => {
        expect(
            await computePortfolioUsagePct(
                [
                    {
                        insurance_policy_id: 1,
                        approved_limit: null,
                        is_active: true,
                    },
                ],
                new Map([[1, 500]]),
                "USD"
            )
        ).toBeNull();
    });

    it("computes weighted usage across active policies", async () => {
        const pct = await computePortfolioUsagePct(
            [
                {
                    insurance_policy_id: 1,
                    approved_limit: 1000 as unknown as import("@prisma/client").Prisma.Decimal,
                    is_active: true,
                },
                {
                    insurance_policy_id: 2,
                    approved_limit: 500 as unknown as import("@prisma/client").Prisma.Decimal,
                    is_active: true,
                },
            ],
            new Map([
                [1, 800],
                [2, 100],
            ]),
            "USD"
        );
        expect(pct).toBeCloseTo((100 * 900) / 1500, 2);
    });

    it("caps usage at 999.99%", async () => {
        const pct = await computePortfolioUsagePct(
            [
                {
                    insurance_policy_id: 1,
                    approved_limit: 100 as unknown as import("@prisma/client").Prisma.Decimal,
                    is_active: true,
                },
            ],
            new Map([[1, 5000]]),
            "USD"
        );
        expect(pct).toBe(999.99);
    });

    it("all-policies view includes inactive policies that have open AR", async () => {
        const pct = await computePortfolioUsagePct(
            [
                {
                    insurance_policy_id: 7,
                    approved_limit: 10000 as unknown as import("@prisma/client").Prisma.Decimal,
                    is_active: false,
                },
                {
                    insurance_policy_id: 8,
                    approved_limit: 990 as unknown as import("@prisma/client").Prisma.Decimal,
                    is_active: true,
                },
            ],
            new Map([
                [7, 11340],
                [8, 0],
            ]),
            "ILS",
            { includeInactiveWithExposure: true }
        );
        expect(pct).toBeCloseTo(113.4, 1);
    });
});

describe("aggregatePolicyUsageFromRows", () => {
    it("without top-up: policy usage = AR / approved limit × 100", () => {
        const result = aggregatePolicyUsageFromRows([
            { ar: 15_000, approvedLimit: 12_000, topUpTotal: 0 },
        ]);
        expect(result.policyUsagePct).toBeCloseTo(125, 2);
        expect(result.topUpUsagePct).toBeNull();
        expect(result.effectiveUsagePct).toBeNull();
    });

    it("with top-up: policy capped at 100%, top and effective usage per sheet 2", () => {
        const metrics = computeTopUpUsageMetrics({
            ar: 11_000,
            approvedLimit: 10_000,
            topUpTotal: 5_000,
        });
        expect(metrics.policyUsage).toBe(1);
        expect(metrics.topUpUsage).toBeCloseTo(0.2, 4);
        expect(metrics.effectiveUsage).toBeCloseTo(11_000 / 15_000, 4);

        const result = aggregatePolicyUsageFromRows([
            { ar: 11_000, approvedLimit: 10_000, topUpTotal: 5_000 },
        ]);
        expect(result.policyUsagePct).toBe(100);
        expect(result.topUpUsagePct).toBeCloseTo(20, 2);
        expect(result.effectiveUsagePct).toBeCloseTo(73.33, 1);
        expect(result.topUpTotal).toBe(5_000);
        expect(result.effectiveLimit).toBe(15_000);
    });

    it("with top-up below limit: policy usage only, no top-up slice", () => {
        const result = aggregatePolicyUsageFromRows([
            { ar: 5_000, approvedLimit: 10_000, topUpTotal: 5_000 },
        ]);
        expect(result.policyUsagePct).toBe(50);
        expect(result.topUpUsagePct).toBe(0);
        expect(result.effectiveUsagePct).toBeCloseTo(33.33, 1);
    });

    it("with top-up: usage may exceed 100% when AR exceeds limit plus top-up pool", () => {
        const metrics = computeTopUpUsageMetrics({
            ar: 16_000,
            approvedLimit: 10_000,
            topUpTotal: 5_000,
        });
        expect(metrics.policyUsage).toBe(1);
        expect(metrics.topUpUsage).toBeCloseTo(1.2, 4);

        const result = aggregatePolicyUsageFromRows([
            { ar: 16_000, approvedLimit: 10_000, topUpTotal: 5_000 },
        ]);
        expect(result.policyUsagePct).toBe(100);
        expect(result.topUpUsagePct).toBeCloseTo(120, 2);
    });
});

describe("applyTermsBreachOtherBucket", () => {
    it("puts uncategorized invoice count into other", () => {
        const result = applyTermsBreachOtherBucket(
            {
                reportingBreach: 2,
                paymentTerm: 1,
                customerOverdueMep: 0,
                outdatedDcl: 0,
                invoiceAfterPolicyEnd: 0,
            },
            5
        );
        expect(result.other).toBe(2);
    });

    it("never returns negative other", () => {
        const result = applyTermsBreachOtherBucket(
            {
                reportingBreach: 10,
                paymentTerm: 0,
                customerOverdueMep: 0,
                outdatedDcl: 0,
                invoiceAfterPolicyEnd: 0,
            },
            3
        );
        expect(result.other).toBe(0);
    });
});
