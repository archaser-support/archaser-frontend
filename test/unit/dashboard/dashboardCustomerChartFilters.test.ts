import { describe, it, expect } from "vitest";

import {
    buildDashboardCustomerChartFilters,
    DASHBOARD_ACTIVE_DYNAMICS_FILTER_FIELD,
    DASHBOARD_CUSTOMER_SYSTEM_REPORT_UNIQUE_NAMES,
    DASHBOARD_CUSTOMERS_CONTEXT,
    expandDashboardActiveDynamicsWhere,
    getDashboardCustomerChartFamily,
    getDashboardCustomerSystemReportUniqueName,
    isDashboardCustomerChartType,
    resolveActiveCustomersPeriodMonth,
    shouldUseDashboardCustomerReportList,
} from "@/shared/dashboard/dashboardCustomerChartFilters";
import {
    canAccessReportsForContext,
    DASHBOARD_REPORT_CONTEXTS,
} from "@/shared/dashboard/dashboardInvoiceReportAccess";
import { prepareDashboardCustomerExecuteFilters } from "@/server/services/dashboardCustomerExecuteFilters";

const NOW = new Date(2026, 6, 12); // Jul 12, 2026

describe("dashboardCustomerChartFilters", () => {
    it("recognizes customer-shaped chart types only", () => {
        expect(isDashboardCustomerChartType("overdue-customers")).toBe(true);
        expect(isDashboardCustomerChartType("overdue-amount")).toBe(true);
        expect(isDashboardCustomerChartType("active-customers")).toBe(true);
        expect(isDashboardCustomerChartType("overdue-invoices")).toBe(false);
        expect(getDashboardCustomerChartFamily("overdue-amount")).toBe(
            "overdue"
        );
        expect(getDashboardCustomerChartFamily("active-customers")).toBe(
            "active_dynamics"
        );
    });

    it("maps type to family-specific system report unique_name", () => {
        expect(
            getDashboardCustomerSystemReportUniqueName("overdue-customers")
        ).toBe(DASHBOARD_CUSTOMER_SYSTEM_REPORT_UNIQUE_NAMES.overdue);
        expect(
            getDashboardCustomerSystemReportUniqueName("overdue-amount")
        ).toBe(DASHBOARD_CUSTOMER_SYSTEM_REPORT_UNIQUE_NAMES.overdue);
        expect(
            getDashboardCustomerSystemReportUniqueName("active-customers")
        ).toBe(DASHBOARD_CUSTOMER_SYSTEM_REPORT_UNIQUE_NAMES.active_dynamics);
        expect(DASHBOARD_CUSTOMER_SYSTEM_REPORT_UNIQUE_NAMES.overdue).not.toBe(
            DASHBOARD_CUSTOMER_SYSTEM_REPORT_UNIQUE_NAMES.active_dynamics
        );
    });

    describe("overdue child", () => {
        it("locks open CCP with outstanding > 0", () => {
            const result = buildDashboardCustomerChartFilters({
                type: "overdue-customers",
                viewMode: "child",
                now: NOW,
            });

            expect(result.isCustomerList).toBe(true);
            expect(result.family).toBe("overdue");
            expect(result.additionalFilters).toEqual([
                {
                    table: "CustomerCollectionPeriod",
                    field: "period_end_date",
                    operator: "is_empty",
                    value: true,
                },
                {
                    table: "CustomerCollectionPeriod",
                    field: "total_outstanding_amount",
                    operator: "greater_than",
                    value: 0,
                },
            ]);
            expect(shouldUseDashboardCustomerReportList({
                type: "overdue-amount",
                viewMode: "child",
            })).toBe(true);
        });

        it("defers parent viewMode to legacy EndlessScroll", () => {
            const result = buildDashboardCustomerChartFilters({
                type: "overdue-amount",
                viewMode: "parent",
            });
            expect(result.parentViewModeRequiresSpecialHandling).toBe(true);
            expect(result.isCustomerList).toBe(false);
            expect(
                shouldUseDashboardCustomerReportList({
                    type: "overdue-customers",
                    viewMode: "parent",
                })
            ).toBe(false);
        });
    });

    describe("active-customers", () => {
        it("emits marker filter and skips BU on contract", () => {
            const result = buildDashboardCustomerChartFilters({
                type: "active-customers",
                period: "2026-07",
                now: NOW,
            });

            expect(result.isCustomerList).toBe(true);
            expect(result.skipBusinessUnitFilter).toBe(true);
            expect(result.additionalFilters).toEqual([
                {
                    table: "Customer",
                    field: DASHBOARD_ACTIVE_DYNAMICS_FILTER_FIELD,
                    operator: "equals",
                    value: "2026-07",
                },
            ]);
        });

        it("adjusts future period month to previous year", () => {
            const resolved = resolveActiveCustomersPeriodMonth(
                "2026-08",
                NOW
            );
            expect(resolved).toEqual({ year: 2025, monthIndex: 7 });
        });

        it("expands marker into Entered/Exited OR with BU only on Entered", () => {
            const expanded = expandDashboardActiveDynamicsWhere("2026-07", {
                businessUnitFilter: { business_unit_id: 5 },
                now: NOW,
            });

            expect(expanded).toMatchObject({
                OR: [
                    {
                        collection_status: "Active",
                        business_unit_id: 5,
                    },
                    {
                        collection_status: "Inactive",
                    },
                ],
            });
            expect((expanded as any).OR[1].business_unit_id).toBeUndefined();
        });
    });
});

describe("prepareDashboardCustomerExecuteFilters", () => {
    it("strips marker and returns primaryWhereExtras", () => {
        const prepared = prepareDashboardCustomerExecuteFilters(
            [
                {
                    table: "Customer",
                    field: DASHBOARD_ACTIVE_DYNAMICS_FILTER_FIELD,
                    operator: "equals",
                    value: "2026-07",
                },
            ],
            {
                businessUnitFilter: { business_unit_id: 3 },
                now: NOW,
            }
        );

        expect(prepared.skipBusinessUnitFilter).toBe(true);
        expect(prepared.filters).toEqual([]);
        expect(prepared.primaryWhereExtras).toMatchObject({
            OR: [
                { collection_status: "Active", business_unit_id: 3 },
                { collection_status: "Inactive" },
            ],
        });
    });

    it("passes through overdue filters unchanged", () => {
        const filters = [
            {
                table: "CustomerCollectionPeriod",
                field: "period_end_date",
                operator: "is_empty",
                value: true,
            },
        ];
        const prepared = prepareDashboardCustomerExecuteFilters(filters);
        expect(prepared.skipBusinessUnitFilter).toBe(false);
        expect(prepared.filters).toEqual(filters);
        expect(prepared.primaryWhereExtras).toBeUndefined();
    });
});

describe("dashboard report access allowlist", () => {
    it("includes customers and payments contexts", () => {
        expect(DASHBOARD_REPORT_CONTEXTS).toContain(DASHBOARD_CUSTOMERS_CONTEXT);
        expect(DASHBOARD_REPORT_CONTEXTS).toContain("dashboard_payments");
        expect(
            canAccessReportsForContext(DASHBOARD_CUSTOMERS_CONTEXT, {
                canViewReports: false,
                canViewFinancialDashboard: true,
            })
        ).toBe(true);
        expect(
            canAccessReportsForContext("customers", {
                canViewReports: false,
                canViewFinancialDashboard: true,
            })
        ).toBe(false);
    });
});
