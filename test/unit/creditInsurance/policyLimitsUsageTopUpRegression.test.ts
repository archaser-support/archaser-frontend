import { describe, expect, it } from "vitest";

import {
    buildPolicyUsageBaseStackedSeries,
    shouldShowTopUpPolicyUsageBar,
} from "@/app/[locale]/app/credit-dashboard/creditPolicyUsageChartViewModel";
import {
    aggregatePortfolioPolicyLimitUsage,
    computeCustomerPolicyLimitUsageSegments,
    type PolicyLimitUsageRowInput,
} from "@/server/services/creditInsurance/portfolioPolicyLimitUsage";

function baseRow(
    overrides: Partial<PolicyLimitUsageRowInput> = {}
): PolicyLimitUsageRowInput {
    return {
        limitType: "Named",
        openArAccount: 100,
        approvedLimitAccount: 100,
        topUpTotalAccount: 0,
        isActive: true,
        isCollectionActive: true,
        excludedFromPolicy: false,
        outdatedDcl: false,
        approvedLimitExpirationDate: null,
        ...overrides,
    };
}

describe("shouldShowTopUpPolicyUsageBar", () => {
    it("hides the Top-Up bar when active capacity is zero or missing", () => {
        expect(shouldShowTopUpPolicyUsageBar(undefined)).toBe(false);
        expect(shouldShowTopUpPolicyUsageBar(0)).toBe(false);
    });

    it("shows the Top-Up bar when active capacity is positive", () => {
        expect(shouldShowTopUpPolicyUsageBar(1)).toBe(true);
        expect(shouldShowTopUpPolicyUsageBar(25_000)).toBe(true);
    });
});

describe("buildPolicyUsageBaseStackedSeries", () => {
    it("maps category totals to stacked used, remaining, and uncovered series", () => {
        const series = buildPolicyUsageBaseStackedSeries([
            {
                fullLabel: "Combined",
                shortLabel: "Total",
                totals: {
                    openAr: 200,
                    approvedLimit: 300,
                    topUpTotal: 0,
                    usedWithinLimit: 180,
                    remaining: 100,
                    topUpCoveredExcess: 0,
                    uncoveredExposure: 20,
                    usagePct: (200 / 300) * 100,
                },
            },
            {
                fullLabel: "Named",
                shortLabel: "Named",
                totals: {
                    openAr: 120,
                    approvedLimit: 100,
                    topUpTotal: 0,
                    usedWithinLimit: 100,
                    remaining: 0,
                    topUpCoveredExcess: 0,
                    uncoveredExposure: 20,
                    usagePct: 120,
                },
            },
            {
                fullLabel: "DCL/SDL",
                shortLabel: "DCL/SDL",
                totals: {
                    openAr: 80,
                    approvedLimit: 200,
                    topUpTotal: 0,
                    usedWithinLimit: 80,
                    remaining: 120,
                    topUpCoveredExcess: 0,
                    uncoveredExposure: 0,
                    usagePct: 40,
                },
            },
        ]);

        expect(series.usedWithin).toEqual([180, 100, 80]);
        expect(series.remaining).toEqual([100, 0, 120]);
        expect(series.topUpCovered).toEqual([0, 0, 0]);
        expect(series.uncovered).toEqual([20, 20, 0]);
        expect(series.approvedLimits).toEqual([300, 100, 200]);
        expect(series.stackHeights).toEqual([300, 120, 200]);
        // Chart usage = Used / (approved + top-up)
        expect(series.usagePct[0]).toBeCloseTo((180 / 300) * 100, 2);
        expect(series.usagePct[1]).toBe(100);
        expect(series.usagePct[2]).toBe(40);
    });

    it("includes top-up covered excess on base bars so full AR is visible", () => {
        const series = buildPolicyUsageBaseStackedSeries([
            {
                fullLabel: "Combined",
                shortLabel: "Total",
                totals: {
                    openAr: 18_600,
                    approvedLimit: 13_000,
                    topUpTotal: 5_000,
                    usedWithinLimit: 13_000,
                    remaining: 0,
                    topUpCoveredExcess: 5_000,
                    uncoveredExposure: 600,
                    usagePct: (13_000 / 18_000) * 100,
                },
                showTopUpCovered: true,
            },
        ]);

        expect(series.usedWithin).toEqual([13_000]);
        expect(series.topUpCovered).toEqual([5_000]);
        expect(series.uncovered).toEqual([600]);
        expect(series.approvedLimits).toEqual([18_000]);
        expect(series.stackHeights).toEqual([18_600]);
        expect(series.usagePct[0]).toBeCloseTo((13_000 / 18_000) * 100, 5);
    });

    it("hides only Top-Up Covered on Named/DCL; keeps true uncovered exposure", () => {
        const series = buildPolicyUsageBaseStackedSeries([
            {
                fullLabel: "Combined",
                shortLabel: "Total",
                showTopUpCovered: true,
                totals: {
                    openAr: 410,
                    approvedLimit: 300,
                    topUpTotal: 100,
                    usedWithinLimit: 300,
                    remaining: 0,
                    topUpCoveredExcess: 70,
                    uncoveredExposure: 40,
                    usagePct: (300 / 400) * 100,
                },
            },
            {
                fullLabel: "Named",
                shortLabel: "Named",
                showTopUpCovered: false,
                totals: {
                    openAr: 290,
                    approvedLimit: 200,
                    topUpTotal: 50,
                    usedWithinLimit: 200,
                    remaining: 0,
                    topUpCoveredExcess: 50,
                    uncoveredExposure: 40,
                    usagePct: (200 / 250) * 100,
                },
            },
            {
                fullLabel: "DCL/SDL",
                shortLabel: "DCL/SDL",
                showTopUpCovered: false,
                totals: {
                    openAr: 120,
                    approvedLimit: 100,
                    topUpTotal: 50,
                    usedWithinLimit: 100,
                    remaining: 0,
                    topUpCoveredExcess: 20,
                    uncoveredExposure: 0,
                    usagePct: (100 / 150) * 100,
                },
            },
        ]);

        // Named: hide 50 top-up covered, keep 40 uncovered. DCL: hide 20, no red.
        expect(series.topUpCovered).toEqual([70, 0, 0]);
        expect(series.uncovered).toEqual([40, 40, 0]);
        expect(series.stackHeights).toEqual([410, 240, 100]);
        expect(series.approvedLimits).toEqual([400, 200, 100]);
        expect(series.usagePct[0]).toBeCloseTo((300 / 400) * 100, 5);
        // Named / DCL: base approved only (no top-up in denominator)
        expect(series.usagePct[1]).toBe(100);
        expect(series.usagePct[2]).toBe(100);
    });

    it("reports Used over Approved when overage segments exist", () => {
        const series = buildPolicyUsageBaseStackedSeries([
            {
                fullLabel: "Named",
                shortLabel: "Named",
                showTopUpCovered: false,
                totals: {
                    openAr: 12_600,
                    approvedLimit: 20_000,
                    topUpTotal: 0,
                    usedWithinLimit: 10_000,
                    remaining: 10_000,
                    topUpCoveredExcess: 0,
                    uncoveredExposure: 2_600,
                    usagePct: 50,
                },
            },
        ]);
        expect(series.approvedLimits).toEqual([20_000]);
        // Used 10k / Approved 20k = 50% (uncovered is not part of usage %)
        expect(series.usagePct[0]).toBe(50);
    });

    it("excludes top-up from Named/DCL approved limit and usage", () => {
        const series = buildPolicyUsageBaseStackedSeries([
            {
                fullLabel: "Named",
                shortLabel: "Named",
                showTopUpCovered: false,
                totals: {
                    openAr: 12_600,
                    approvedLimit: 20_000,
                    topUpTotal: 5_000,
                    usedWithinLimit: 10_000,
                    remaining: 10_000,
                    topUpCoveredExcess: 2_600,
                    uncoveredExposure: 0,
                    usagePct: 50,
                },
            },
        ]);
        expect(series.topUpCovered).toEqual([0]);
        expect(series.uncovered).toEqual([0]);
        expect(series.approvedLimits).toEqual([20_000]);
        expect(series.usagePct[0]).toBe(50);
    });

    it("includes top-up in Total Limits approved limit and usage only", () => {
        const series = buildPolicyUsageBaseStackedSeries([
            {
                fullLabel: "Combined",
                shortLabel: "Total",
                showTopUpCovered: true,
                totals: {
                    openAr: 12_600,
                    approvedLimit: 20_000,
                    topUpTotal: 5_000,
                    usedWithinLimit: 10_000,
                    remaining: 10_000,
                    topUpCoveredExcess: 2_600,
                    uncoveredExposure: 0,
                    usagePct: (10_000 / 25_000) * 100,
                },
            },
        ]);
        expect(series.approvedLimits).toEqual([25_000]);
        expect(series.usagePct[0]).toBeCloseTo((10_000 / 25_000) * 100, 5);
    });

    it("reports ~16.7% when Used is 3k of Approved 18k", () => {
        const series = buildPolicyUsageBaseStackedSeries([
            {
                fullLabel: "DCL/SDL",
                shortLabel: "DCL/SDL",
                showTopUpCovered: false,
                totals: {
                    openAr: 6_000,
                    approvedLimit: 18_000,
                    topUpTotal: 0,
                    usedWithinLimit: 3_000,
                    remaining: 15_000,
                    topUpCoveredExcess: 0,
                    uncoveredExposure: 3_000,
                    usagePct: (3_000 / 18_000) * 100,
                },
            },
        ]);
        expect(series.approvedLimits).toEqual([18_000]);
        expect(series.usagePct[0]).toBeCloseTo((3_000 / 18_000) * 100, 5);
    });
});

describe("policy limits usage top-up regression", () => {
    const asOf = new Date("2026-07-15T12:00:00.000Z");

    it("Named over base without top-up contributes red uncovered exposure", () => {
        const segments = computeCustomerPolicyLimitUsageSegments({
            openArAccount: 120,
            approvedLimitAccount: 100,
            topUpTotalAccount: 0,
        });
        expect(segments.uncoveredExposure).toBe(20);
        expect(segments.topUpCoveredExcess).toBe(0);
        expect(segments.topUpTotal).toBe(0);
    });

    it("DCL/SDL above base but within top-up keeps base usage above 100% with no red exposure", () => {
        const segments = computeCustomerPolicyLimitUsageSegments({
            openArAccount: 120,
            approvedLimitAccount: 100,
            topUpTotalAccount: 50,
        });
        expect(segments.uncoveredExposure).toBe(0);
        expect(segments.topUpCoveredExcess).toBe(20);
        expect(segments.topUpTotal).toBe(50);
    });

    it("customer beyond effective cover contributes uncovered exposure to base categories", () => {
        const segments = computeCustomerPolicyLimitUsageSegments({
            openArAccount: 170,
            approvedLimitAccount: 100,
            topUpTotalAccount: 50,
        });
        expect(segments.uncoveredExposure).toBe(20);
        expect(segments.topUpCoveredExcess).toBe(50);
        expect(segments.topUpTotal).toBe(50);
    });

    it("manual QA portfolio: top-up cover is summed per customer, not from Σ top-up vs net excess", () => {
        const result = aggregatePortfolioPolicyLimitUsage(
            [
                baseRow({
                    limitType: "Named",
                    openArAccount: 120,
                    approvedLimitAccount: 100,
                    topUpTotalAccount: 0,
                }),
                baseRow({
                    limitType: "DCL",
                    openArAccount: 120,
                    approvedLimitAccount: 100,
                    topUpTotalAccount: 50,
                }),
                baseRow({
                    limitType: "Named",
                    openArAccount: 170,
                    approvedLimitAccount: 100,
                    topUpTotalAccount: 50,
                }),
            ],
            asOf
        );

        // Named: (120/100 topUp0 → unc 20) + (170/100 topUp50 → covered 50, unc 20).
        expect(result.named.openAr).toBe(290);
        expect(result.named.approvedLimit).toBe(200);
        expect(result.named.topUpTotal).toBe(50);
        // Named usage uses base approved only
        expect(result.named.usagePct).toBe(100);
        expect(result.named.usedWithinLimit).toBe(200);
        expect(result.named.remaining).toBe(0);
        expect(result.named.topUpCoveredExcess).toBe(50);
        expect(result.named.uncoveredExposure).toBe(40);

        expect(result.dclSdl.openAr).toBe(120);
        expect(result.dclSdl.topUpTotal).toBe(50);
        expect(result.dclSdl.usagePct).toBe(100);
        expect(result.dclSdl.usedWithinLimit).toBe(100);
        expect(result.dclSdl.remaining).toBe(0);
        expect(result.dclSdl.uncoveredExposure).toBe(0);
        expect(result.dclSdl.topUpCoveredExcess).toBe(20);

        // Combined includes top-up in usage denominator
        expect(result.combined.openAr).toBe(410);
        expect(result.combined.approvedLimit).toBe(300);
        expect(result.combined.topUpTotal).toBe(100);
        expect(result.combined.usagePct).toBeCloseTo((300 / 400) * 100, 5);
        expect(result.combined.usedWithinLimit).toBe(300);
        expect(result.combined.remaining).toBe(0);
        expect(result.combined.topUpCoveredExcess).toBe(70);
        expect(result.combined.uncoveredExposure).toBe(40);

        const stacked = buildPolicyUsageBaseStackedSeries([
            {
                fullLabel: "Combined",
                shortLabel: "Total",
                totals: result.combined,
                showTopUpCovered: true,
            },
            {
                fullLabel: "Named",
                shortLabel: "Named",
                totals: result.named,
                showTopUpCovered: false,
            },
            {
                fullLabel: "DCL/SDL",
                shortLabel: "DCL/SDL",
                totals: result.dclSdl,
                showTopUpCovered: false,
            },
        ]);

        expect(stacked.usedWithin).toEqual([300, 200, 100]);
        expect(stacked.remaining).toEqual([0, 0, 0]);
        expect(stacked.topUpCovered).toEqual([70, 0, 0]);
        expect(stacked.uncovered).toEqual([40, 40, 0]);
        expect(stacked.approvedLimits).toEqual([400, 200, 100]);
        // Named/DCL omit top-up-covered AR from the stack height.
        expect(stacked.stackHeights).toEqual([410, 240, 100]);
        expect(stacked.usagePct[0]).toBeCloseTo((300 / 400) * 100, 5);
        expect(stacked.usagePct[1]).toBe(100);
        expect(stacked.usagePct[2]).toBe(100);
    });
});
