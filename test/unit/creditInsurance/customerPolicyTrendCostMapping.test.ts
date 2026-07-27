import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
    inferGapFillDaysAppliedFromRecentDates,
    mapCustomerPolicyTrendRowToPoint,
    mapDailyCostFieldsFromTrendRow,
    resolvePriorSnapshotDateFromOrderedDates,
    resolveTrendRowUsagePct,
} from "@/server/services/creditInsurance/customerPolicyTrendService";

describe("mapDailyCostFieldsFromTrendRow", () => {
    it("maps stored delta columns to *Change response fields", () => {
        const result = mapDailyCostFieldsFromTrendRow({
            policy_daily_cost: new Prisma.Decimal("500.25"),
            policy_cost_currency: " USD ",
            top_up_daily_cost: new Prisma.Decimal("10"),
            top_up_cost_currency: "EUR",
            total_daily_cost: new Prisma.Decimal("510.25"),
            cost_calculation_method: "Limit",
            cost_percent: new Prisma.Decimal("0.5"),
        });

        expect(result).toEqual({
            policyDailyCostChange: 500.25,
            policyCostCurrency: "USD",
            topUpDailyCostChange: 10,
            topUpCostCurrency: "EUR",
            totalDailyCostChange: 510.25,
            costCalculationMethod: "Limit",
            costPercent: 0.5,
        });
    });

    it("returns null change fields when not configured", () => {
        const result = mapDailyCostFieldsFromTrendRow({
            policy_daily_cost: null,
            policy_cost_currency: null,
            top_up_daily_cost: null,
            top_up_cost_currency: null,
            total_daily_cost: null,
            cost_calculation_method: null,
            cost_percent: null,
        });

        expect(result).toEqual({
            policyDailyCostChange: null,
            policyCostCurrency: null,
            topUpDailyCostChange: null,
            topUpCostCurrency: null,
            totalDailyCostChange: null,
            costCalculationMethod: null,
            costPercent: null,
        });
    });
});

describe("resolveTrendRowUsagePct", () => {
    it("prefers effective_usage_pct over legacy usage_pct", () => {
        expect(
            resolveTrendRowUsagePct({
                effective_usage_pct: 73.5,
                usage_pct: 120,
            })
        ).toBe(73.5);
    });

    it("falls back to legacy usage_pct when effective is null", () => {
        expect(
            resolveTrendRowUsagePct({
                effective_usage_pct: null,
                usage_pct: 88,
            })
        ).toBe(88);
    });

    it("recomputes from AR and effective limit when stored pcts are missing", () => {
        expect(
            resolveTrendRowUsagePct({
                usage_amount: 600,
                approved_limit: new Prisma.Decimal("1000"),
                effective_approved_limit: new Prisma.Decimal("1200"),
            })
        ).toBe(50);
    });
});

describe("mapCustomerPolicyTrendRowToPoint", () => {
    it("includes usage and cost change fields on each series point", () => {
        const snapshotDate = new Date("2026-06-28T00:00:00.000Z");
        const point = mapCustomerPolicyTrendRowToPoint({
            snapshot_date: snapshotDate,
            usage_amount: 12_000,
            approved_limit: new Prisma.Decimal("100000"),
            usage_pct: 12,
            effective_usage_pct: 15,
            policy_daily_cost: new Prisma.Decimal("500"),
            policy_cost_currency: "USD",
            top_up_daily_cost: new Prisma.Decimal("25"),
            top_up_cost_currency: "USD",
            total_daily_cost: new Prisma.Decimal("525"),
            cost_calculation_method: "ActualSales",
            cost_percent: new Prisma.Decimal("0.5"),
        });

        expect(point.snapshotDate).toBe("2026-06-28");
        expect(point.usageAmount).toBe(12_000);
        expect(point.approvedLimit).toBe(100_000);
        expect(point.usagePct).toBe(15);
        expect(point.policyDailyCostChange).toBe(500);
        expect(point.policyCostCurrency).toBe("USD");
        expect(point.topUpDailyCostChange).toBe(25);
        expect(point.topUpCostCurrency).toBe("USD");
        expect(point.totalDailyCostChange).toBe(525);
        expect(point.costCalculationMethod).toBe("ActualSales");
        expect(point.costPercent).toBe(0.5);
        expect(point).not.toHaveProperty("policyDailyCost");
        expect(point).not.toHaveProperty("priorSnapshotDate");
    });

    it("computes usagePct when stored usage columns are null", () => {
        const point = mapCustomerPolicyTrendRowToPoint({
            snapshot_date: new Date("2026-06-28T00:00:00.000Z"),
            usage_amount: 500,
            approved_limit: new Prisma.Decimal("1000"),
            usage_pct: null,
            effective_usage_pct: null,
        });

        expect(point.usagePct).toBeCloseTo(50, 5);
        expect(point.policyDailyCostChange).toBeNull();
        expect(point.totalDailyCostChange).toBeNull();
    });
});

describe("resolvePriorSnapshotDateFromOrderedDates", () => {
    it("prefers the prior calendar day when present in the series", () => {
        const result = resolvePriorSnapshotDateFromOrderedDates(
            ["2026-06-26", "2026-06-27", "2026-06-28"],
            "2026-06-28"
        );

        expect(result).toBe("2026-06-27");
    });

    it("falls back to the latest earlier date when the prior calendar day is missing", () => {
        const result = resolvePriorSnapshotDateFromOrderedDates(
            ["2026-06-25", "2026-06-28"],
            "2026-06-28"
        );

        expect(result).toBe("2026-06-25");
    });

    it("returns null when there is no predecessor row", () => {
        const result = resolvePriorSnapshotDateFromOrderedDates(
            ["2026-06-28"],
            "2026-06-28"
        );

        expect(result).toBeNull();
    });
});

describe("inferGapFillDaysAppliedFromRecentDates", () => {
    it("returns 0 when yesterday is missing", () => {
        const todayUtc = new Date("2026-06-30T00:00:00.000Z");
        const result = inferGapFillDaysAppliedFromRecentDates(
            [new Date("2026-06-28T00:00:00.000Z")],
            todayUtc
        );

        expect(result).toBe(0);
    });

    it("returns 0 for a normal consecutive daily run", () => {
        const todayUtc = new Date("2026-06-30T00:00:00.000Z");
        const result = inferGapFillDaysAppliedFromRecentDates(
            [
                new Date("2026-06-28T00:00:00.000Z"),
                new Date("2026-06-29T00:00:00.000Z"),
            ],
            todayUtc
        );

        expect(result).toBe(0);
    });

    it("infers a three-day gap fill before today", () => {
        const todayUtc = new Date("2026-06-29T00:00:00.000Z");
        const result = inferGapFillDaysAppliedFromRecentDates(
            [
                new Date("2026-06-25T00:00:00.000Z"),
                new Date("2026-06-28T00:00:00.000Z"),
            ],
            todayUtc
        );

        expect(result).toBe(3);
    });
});
