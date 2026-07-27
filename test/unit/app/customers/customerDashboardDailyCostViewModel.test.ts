import { describe, expect, it } from "vitest";

import {
    buildDailyCostChangeBreakdownLine,
    buildDailyCostChangeChartSeries,
    buildDailyCostChangeKpiDisplay,
    formatSignedCostChangeAmount,
    isDailyCostChangeChartEmpty,
    mapTrendPointsToDailyCostChartSeries,
    resolveCalendarYesterdayUtc,
    resolveDailyCostChangeSubtitle,
    resolveTotalCostChangeCurrency,
} from "@/app/[locale]/app/customers/[customerId]/customerDashboardDailyCostViewModel";

describe("customerDashboardDailyCostViewModel", () => {
    it("formats signed cost change amounts with currency", () => {
        expect(
            formatSignedCostChangeAmount(125.5, "USD", "en-US", false)
        ).toBe("+$125.50");
        expect(
            formatSignedCostChangeAmount(-40, "USD", "en-US", false)
        ).toBe("-$40");
        expect(formatSignedCostChangeAmount(0, "USD", "en-US", false)).toBe(
            "$0"
        );
        expect(formatSignedCostChangeAmount(null, "USD", "en-US", false)).toBe(
            "—"
        );
    });

    it("builds KPI display from latest change payload", () => {
        const display = buildDailyCostChangeKpiDisplay({
            latest: {
                totalDailyCostChange: 110,
                policyDailyCostChange: 100,
                topUpDailyCostChange: 10,
                policyCostCurrency: "USD",
                topUpCostCurrency: "USD",
                priorSnapshotDate: "2026-06-29",
            },
            locale: "en-US",
            isRtl: false,
            policyLabel: "Policy",
            topUpLabel: "Top-up",
            notConfiguredLabel: "Not configured",
            todayUtc: new Date("2026-06-30T12:00:00.000Z"),
        });

        expect(display.isConfigured).toBe(true);
        expect(display.primaryValue).toBe("+$110");
        expect(display.breakdownLine).toContain("Policy: +$100");
        expect(display.breakdownLine).toContain("Top-up: +$10");
        expect(display.subtitleDate).toBeNull();
    });

    it("shows subtitle when prior snapshot is not calendar yesterday", () => {
        const subtitle = resolveDailyCostChangeSubtitle({
            priorSnapshotDate: "2026-06-25",
            todayUtc: new Date("2026-06-30T00:00:00.000Z"),
            formatDate: (iso) => `since ${iso}`,
        });

        expect(subtitle).toBe("since 2026-06-25");
        expect(resolveCalendarYesterdayUtc(new Date("2026-06-30T00:00:00.000Z"))).toBe(
            "2026-06-29"
        );
    });

    it("returns not configured display when all change fields are null", () => {
        const display = buildDailyCostChangeKpiDisplay({
            latest: {
                totalDailyCostChange: null,
                policyDailyCostChange: null,
                topUpDailyCostChange: null,
                policyCostCurrency: null,
                topUpCostCurrency: null,
                priorSnapshotDate: null,
            },
            locale: "en-US",
            isRtl: false,
            policyLabel: "Policy",
            topUpLabel: "Top-up",
            notConfiguredLabel: "Not configured",
        });

        expect(display).toEqual({
            primaryValue: "Not configured",
            breakdownLine: null,
            subtitleDate: null,
            isConfigured: false,
        });
    });

    it("maps trend points and detects empty chart state", () => {
        const points = mapTrendPointsToDailyCostChartSeries([
            {
                snapshotDate: "2026-06-28",
                usageAmount: 1000,
                approvedLimit: 5000,
                usagePct: 20,
                policyDailyCostChange: 0,
                policyCostCurrency: "USD",
                topUpDailyCostChange: null,
                topUpCostCurrency: null,
                totalDailyCostChange: 0,
                costCalculationMethod: "Limit",
                costPercent: 0.5,
            },
            {
                snapshotDate: "2026-06-29",
                usageAmount: 1200,
                approvedLimit: 5000,
                usagePct: 24,
                policyDailyCostChange: 50,
                policyCostCurrency: "USD",
                topUpDailyCostChange: null,
                topUpCostCurrency: null,
                totalDailyCostChange: 50,
                costCalculationMethod: "Limit",
                costPercent: 0.5,
            },
        ]);

        expect(isDailyCostChangeChartEmpty(points)).toBe(false);
        const chart = buildDailyCostChangeChartSeries(points);
        expect(chart.categories).toEqual(["2026-06-28", "2026-06-29"]);
        expect(chart.policySeries).toEqual([0, 50]);
        expect(chart.showTotal).toBe(true);
    });

    it("treats all-null series as empty chart", () => {
        const points = mapTrendPointsToDailyCostChartSeries([
            {
                snapshotDate: "2026-06-28",
                usageAmount: 1000,
                approvedLimit: 5000,
                usagePct: 20,
                policyDailyCostChange: null,
                policyCostCurrency: null,
                topUpDailyCostChange: null,
                topUpCostCurrency: null,
                totalDailyCostChange: null,
                costCalculationMethod: null,
                costPercent: null,
            },
        ]);

        expect(isDailyCostChangeChartEmpty(points)).toBe(true);
    });

    it("builds breakdown line only for available components", () => {
        const line = buildDailyCostChangeBreakdownLine({
            policyDailyCostChange: 25,
            topUpDailyCostChange: null,
            policyCostCurrency: "EUR",
            topUpCostCurrency: null,
            locale: "en-US",
            isRtl: false,
            policyLabel: "Policy",
            topUpLabel: "Top-up",
        });

        expect(line).toBe("Policy: +€25");
        expect(
            resolveTotalCostChangeCurrency({
                policyCostCurrency: "USD",
                topUpCostCurrency: "EUR",
            })
        ).toBe("USD");
    });
});
