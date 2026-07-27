import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
    extractCustomerTrendCostReportField,
    formatCostCalculationMethodLabel,
    getLatestCustomerPolicyTrendRow,
    getTrendCostTrendColumn,
    isTrendCostBackedReportField,
    mergeLatestCustomerPolicyTrendSelect,
    TREND_COST_BACKED_REPORT_FIELDS,
} from "@/server/utils/reportCustomerTrendCostFields";

describe("reportCustomerTrendCostFields", () => {
    it("identifies all eight trend-cost report fields", () => {
        for (const field of TREND_COST_BACKED_REPORT_FIELDS) {
            expect(isTrendCostBackedReportField(field)).toBe(true);
        }
        expect(isTrendCostBackedReportField("approved_limit")).toBe(false);
    });

    it("maps virtual change fields to CustomerPolicyTrend delta columns for filters", () => {
        expect(getTrendCostTrendColumn("total_daily_cost_change")).toBe(
            "total_daily_cost"
        );
        expect(getTrendCostTrendColumn("policy_daily_cost_change")).toBe(
            "policy_daily_cost"
        );
        expect(getTrendCostTrendColumn("policy_cost_snapshot_date")).toBe(
            "snapshot_date"
        );
        expect(getTrendCostTrendColumn("approved_limit")).toBeNull();
    });

    it("formats cost_calculation_method enum labels", () => {
        expect(formatCostCalculationMethodLabel("Limit")).toBe("Limit");
        expect(formatCostCalculationMethodLabel("ActualSales")).toBe(
            "Actual Sales"
        );
        expect(formatCostCalculationMethodLabel(null)).toBeNull();
    });

    it("returns null when no trend row exists", () => {
        expect(
            extractCustomerTrendCostReportField({}, "policy_daily_cost_change")
        ).toBe(null);
        expect(
            extractCustomerTrendCostReportField(
                { CustomerPolicyTrend: [] },
                "total_daily_cost_change"
            )
        ).toBe(null);
    });

    it("extracts delta values from the latest CustomerPolicyTrend row", () => {
        const row = {
            CustomerPolicyTrend: [
                {
                    snapshot_date: new Date("2026-06-01"),
                    policy_daily_cost: new Prisma.Decimal("100.5"),
                    policy_cost_currency: "USD",
                    top_up_daily_cost: new Prisma.Decimal("10"),
                    top_up_cost_currency: "USD",
                    total_daily_cost: new Prisma.Decimal("110.5"),
                    cost_calculation_method: "Limit",
                    cost_percent: new Prisma.Decimal("0.25"),
                },
                {
                    snapshot_date: new Date("2026-06-28"),
                    policy_daily_cost: new Prisma.Decimal("500.25"),
                    policy_cost_currency: "EUR",
                    top_up_daily_cost: null,
                    top_up_cost_currency: null,
                    total_daily_cost: new Prisma.Decimal("500.25"),
                    cost_calculation_method: "ActualSales",
                    cost_percent: new Prisma.Decimal("0.5"),
                },
            ],
        };

        expect(getLatestCustomerPolicyTrendRow(row)?.policy_cost_currency).toBe(
            "EUR"
        );
        expect(
            extractCustomerTrendCostReportField(row, "policy_daily_cost_change")
        ).toBe(500.25);
        expect(
            extractCustomerTrendCostReportField(row, "policy_cost_currency")
        ).toBe("EUR");
        expect(
            extractCustomerTrendCostReportField(row, "top_up_daily_cost_change")
        ).toBe(null);
        expect(
            extractCustomerTrendCostReportField(row, "total_daily_cost_change")
        ).toBe(500.25);
        expect(
            extractCustomerTrendCostReportField(row, "cost_calculation_method")
        ).toBe("ActualSales");
        expect(extractCustomerTrendCostReportField(row, "cost_percent")).toBe(0.5);
        expect(
            extractCustomerTrendCostReportField(row, "policy_cost_snapshot_date")
        ).toEqual(new Date("2026-06-28"));
    });

    it("passes through null cost change values without coercing to zero", () => {
        const row = {
            CustomerPolicyTrend: {
                snapshot_date: new Date("2026-06-28"),
                policy_daily_cost: null,
                total_daily_cost: null,
            },
        };

        expect(
            extractCustomerTrendCostReportField(row, "policy_daily_cost_change")
        ).toBe(null);
        expect(
            extractCustomerTrendCostReportField(row, "total_daily_cost_change")
        ).toBe(null);
    });

    it("builds latest-row CustomerPolicyTrend select using underlying columns", () => {
        const select: Record<string, unknown> = {};
        mergeLatestCustomerPolicyTrendSelect(select, [
            "policy_daily_cost_change",
            "policy_cost_currency",
            "policy_cost_snapshot_date",
        ]);

        expect(select.CustomerPolicyTrend).toMatchObject({
            orderBy: { snapshot_date: "desc" },
            take: 1,
            select: {
                snapshot_date: true,
                policy_daily_cost: true,
                policy_cost_currency: true,
            },
        });
    });
});
