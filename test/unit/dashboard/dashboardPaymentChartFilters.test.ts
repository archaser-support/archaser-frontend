import { describe, it, expect } from "vitest";

import {
    buildDashboardPaymentChartFilters,
    collectedMtdPeriodDateRange,
    DASHBOARD_PAYMENT_SYSTEM_REPORT_UNIQUE_NAMES,
    DASHBOARD_PAYMENTS_CONTEXT,
    getDashboardPaymentSystemReportUniqueName,
    isDashboardPaymentChartType,
    shouldUseDashboardPaymentReportList,
} from "@/shared/dashboard/dashboardPaymentChartFilters";
import { canAccessReportsForContext } from "@/shared/dashboard/dashboardInvoiceReportAccess";

describe("dashboardPaymentChartFilters", () => {
    it("recognizes collected-mtd and legacy alias", () => {
        expect(isDashboardPaymentChartType("collected-mtd")).toBe(true);
        expect(isDashboardPaymentChartType("collected-vs-promise")).toBe(true);
        expect(isDashboardPaymentChartType("overdue-invoices")).toBe(false);
        expect(getDashboardPaymentSystemReportUniqueName("collected-mtd")).toBe(
            DASHBOARD_PAYMENT_SYSTEM_REPORT_UNIQUE_NAMES.collected_mtd
        );
    });

    it("locks payment_date between and linked invoice_id", () => {
        const result = buildDashboardPaymentChartFilters({
            type: "collected-mtd",
            period: "2026-07",
        });

        expect(result.isPaymentList).toBe(true);
        expect(result.additionalFilters).toEqual([
            {
                table: "InvoicePayment",
                field: "payment_date",
                operator: "between",
                value: ["2026-07-01", "2026-07-31"],
            },
            {
                table: "InvoicePayment",
                field: "invoice_id",
                operator: "is_not_empty",
                value: true,
            },
        ]);
        expect(
            shouldUseDashboardPaymentReportList({
                type: "collected-vs-promise",
                period: "2026-07",
            })
        ).toBe(true);
    });

    it("requires a valid period for list mode", () => {
        expect(
            shouldUseDashboardPaymentReportList({ type: "collected-mtd" })
        ).toBe(false);
        expect(collectedMtdPeriodDateRange("bad")).toBeNull();
    });

    it("allows dashboard_payments with financial dashboard permission", () => {
        expect(
            canAccessReportsForContext(DASHBOARD_PAYMENTS_CONTEXT, {
                canViewReports: false,
                canViewFinancialDashboard: true,
            })
        ).toBe(true);
    });
});
