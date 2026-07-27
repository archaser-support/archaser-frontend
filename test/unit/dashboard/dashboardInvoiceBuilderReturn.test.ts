import { describe, it, expect } from "vitest";

import {
    appendDashboardChartDetailsReturnParams,
    buildDashboardChartDetailsReturnPath,
    buildDashboardInvoiceChartDetailsReturnPath,
    isDashboardInvoicesReportContext,
} from "@/shared/dashboard/dashboardInvoiceBuilderReturn";
import { DASHBOARD_CUSTOMERS_CONTEXT } from "@/shared/dashboard/dashboardCustomerChartFilters";
import { DASHBOARD_INVOICES_CONTEXT } from "@/shared/dashboard/dashboardInvoiceChartFilters";
import { MAIN_REPORTS_MENU_CONTEXT } from "@/shared/utils/viewConfigs";

describe("dashboardInvoiceBuilderReturn", () => {
    it("recognizes dashboard_invoices context only", () => {
        expect(isDashboardInvoicesReportContext(DASHBOARD_INVOICES_CONTEXT)).toBe(
            true
        );
        expect(isDashboardInvoicesReportContext("invoices")).toBe(false);
        expect(isDashboardInvoicesReportContext(MAIN_REPORTS_MENU_CONTEXT)).toBe(
            false
        );
    });

    it("forwards chart-details drill params onto builder query", () => {
        const target = new URLSearchParams({
            context: DASHBOARD_INVOICES_CONTEXT,
            table: "Invoice",
        });
        appendDashboardChartDetailsReturnParams(
            target,
            new URLSearchParams({
                type: "aging-portfolio",
                period: "2026-07",
                daysRange: "8_30",
                businessUnitId: "12",
                viewMode: "child",
                unrelated: "x",
            })
        );

        expect(target.get("type")).toBe("aging-portfolio");
        expect(target.get("period")).toBe("2026-07");
        expect(target.get("daysRange")).toBe("8_30");
        expect(target.get("businessUnitId")).toBe("12");
        expect(target.get("viewMode")).toBe("child");
        expect(target.get("unrelated")).toBeNull();
    });

    it("builds chart-details return path with preserved params and reportId", () => {
        const path = buildDashboardInvoiceChartDetailsReturnPath(
            "en",
            new URLSearchParams({
                type: "due-today",
                period: "2026-07",
                businessUnitId: "5",
            }),
            99
        );

        expect(path.startsWith("/en/app/dashboard/chart-details?")).toBe(true);
        const query = new URLSearchParams(path.split("?")[1]);
        expect(query.get("type")).toBe("due-today");
        expect(query.get("period")).toBe("2026-07");
        expect(query.get("businessUnitId")).toBe("5");
        expect(query.get("reportId")).toBe("99");
    });

    it("defaults type and period when missing", () => {
        const path = buildDashboardInvoiceChartDetailsReturnPath(
            "he",
            new URLSearchParams(),
            7,
            new Date(2026, 6, 12)
        );
        const query = new URLSearchParams(path.split("?")[1]);
        expect(query.get("type")).toBe("overdue-invoices");
        expect(query.get("period")).toBe("2026-07");
        expect(query.get("reportId")).toBe("7");
    });

    it("defaults overdue-customers for dashboard_customers context", () => {
        const path = buildDashboardChartDetailsReturnPath(
            "en",
            new URLSearchParams(),
            3,
            DASHBOARD_CUSTOMERS_CONTEXT,
            new Date(2026, 6, 12)
        );
        const query = new URLSearchParams(path.split("?")[1]);
        expect(query.get("type")).toBe("overdue-customers");
        expect(query.get("period")).toBe("2026-07");
    });
});

describe("main reports menu isolation", () => {
    it("does not treat dashboard_invoices as the main reports menu context", () => {
        expect(DASHBOARD_INVOICES_CONTEXT).not.toBe(MAIN_REPORTS_MENU_CONTEXT);
    });
});
