import { describe, it, expect } from "vitest";

import {
    AGING_DAYS_RANGE_MAP,
    buildDashboardInvoiceChartFilters,
    DASHBOARD_INVOICE_SYSTEM_REPORT_UNIQUE_NAMES,
    DASHBOARD_OVERDUE_INVOICE_STATUSES,
    getDashboardInvoiceChartFamily,
    getDashboardInvoiceSystemReportUniqueName,
    isDashboardInvoiceChartType,
    MATURITY_DAYS_RANGE_MAP,
    normalizeMaturityDaysRange,
    shouldUseDashboardInvoiceReportList,
} from "@/shared/dashboard/dashboardInvoiceChartFilters";
import {
    canAccessDashboardInvoiceReportContext,
    canAccessReportsForContext,
    DASHBOARD_INVOICES_CONTEXT,
} from "@/shared/dashboard/dashboardInvoiceReportAccess";

/** Fixed local calendar day for deterministic date windows. */
const NOW = new Date(2026, 6, 12); // Sunday Jul 12, 2026

function findFilter(
    filters: ReturnType<typeof buildDashboardInvoiceChartFilters>["additionalFilters"],
    field: string,
    table = "Invoice"
) {
    return filters.find((f) => f.table === table && f.field === field);
}

describe("dashboardInvoiceChartFilters", () => {
    it("recognizes invoice-shaped chart types only", () => {
        expect(isDashboardInvoiceChartType("overdue-invoices")).toBe(true);
        expect(isDashboardInvoiceChartType("collected-mtd")).toBe(false);
        expect(getDashboardInvoiceChartFamily("aging-portfolio")).toBe("aging");
        expect(getDashboardInvoiceChartFamily("collected-mtd")).toBeNull();
    });

    it("maps type to family-specific system report unique_name", () => {
        expect(getDashboardInvoiceSystemReportUniqueName("overdue-invoices")).toBe(
            DASHBOARD_INVOICE_SYSTEM_REPORT_UNIQUE_NAMES.overdue
        );
        expect(getDashboardInvoiceSystemReportUniqueName("due-today")).toBe(
            DASHBOARD_INVOICE_SYSTEM_REPORT_UNIQUE_NAMES.due
        );
        expect(
            getDashboardInvoiceSystemReportUniqueName("receivables-maturity-schedule")
        ).toBe(DASHBOARD_INVOICE_SYSTEM_REPORT_UNIQUE_NAMES.maturity);
        expect(getDashboardInvoiceSystemReportUniqueName("aging-portfolio")).toBe(
            DASHBOARD_INVOICE_SYSTEM_REPORT_UNIQUE_NAMES.aging
        );
        expect(
            new Set([
                DASHBOARD_INVOICE_SYSTEM_REPORT_UNIQUE_NAMES.overdue,
                DASHBOARD_INVOICE_SYSTEM_REPORT_UNIQUE_NAMES.aging,
                DASHBOARD_INVOICE_SYSTEM_REPORT_UNIQUE_NAMES.due,
                DASHBOARD_INVOICE_SYSTEM_REPORT_UNIQUE_NAMES.maturity,
            ]).size
        ).toBe(4);
    });

    describe("overdue-invoices", () => {
        it("locks Active customers, unpaid statuses, and due_date before today", () => {
            const result = buildDashboardInvoiceChartFilters({
                type: "overdue-invoices",
                now: NOW,
            });

            expect(result.isInvoiceShaped).toBe(true);
            expect(result.isInvoiceList).toBe(true);
            expect(result.family).toBe("overdue");
            expect(result.systemReportUniqueName).toBe(
                DASHBOARD_INVOICE_SYSTEM_REPORT_UNIQUE_NAMES.overdue
            );

            expect(findFilter(result.additionalFilters, "status")?.value).toEqual(
                [...DASHBOARD_OVERDUE_INVOICE_STATUSES]
            );
            expect(
                findFilter(result.additionalFilters, "collection_status", "Customer")
                    ?.value
            ).toBe("Active");
            expect(findFilter(result.additionalFilters, "due_date")).toEqual({
                table: "Invoice",
                field: "due_date",
                operator: "less_than",
                value: { __datePreset: "today" },
            });
        });
    });

    describe("aging-portfolio", () => {
        it("applies overdue base filters and aging day bucket as due_date between", () => {
            const result = buildDashboardInvoiceChartFilters({
                type: "aging-portfolio",
                daysRange: "8_30",
                now: NOW,
            });

            expect(result.family).toBe("aging");
            expect(result.systemReportUniqueName).toBe(
                DASHBOARD_INVOICE_SYSTEM_REPORT_UNIQUE_NAMES.aging
            );

            const dueDateFilters = result.additionalFilters.filter(
                (f) => f.field === "due_date"
            );
            expect(dueDateFilters).toHaveLength(1);
            expect(dueDateFilters[0]).toEqual({
                table: "Invoice",
                field: "due_date",
                operator: "between",
                // 8..30 days overdue → due between today-30 and today-8
                value: ["2026-06-12", "2026-07-04"],
            });
            expect(findFilter(result.additionalFilters, "status")?.operator).toBe(
                "in"
            );
        });

        it("covers every aging daysRange key from the legacy map", () => {
            for (const daysRange of Object.keys(AGING_DAYS_RANGE_MAP)) {
                const result = buildDashboardInvoiceChartFilters({
                    type: "aging-portfolio",
                    daysRange,
                    now: NOW,
                });
                const between = result.additionalFilters.find(
                    (f) => f.field === "due_date" && f.operator === "between"
                );
                expect(between, daysRange).toBeTruthy();
                expect(Array.isArray(between!.value)).toBe(true);
                expect((between!.value as string[]).length).toBe(2);
            }
        });
    });

    describe("due windows", () => {
        it("total-due locks Due status, Active|Inactive, and outstanding without date window", () => {
            const result = buildDashboardInvoiceChartFilters({
                type: "total-due",
                now: NOW,
            });

            expect(result.family).toBe("due");
            expect(findFilter(result.additionalFilters, "status")?.value).toBe(
                "Due"
            );
            expect(
                findFilter(result.additionalFilters, "collection_status", "Customer")
                    ?.value
            ).toEqual(["Active", "Inactive"]);
            expect(
                findFilter(result.additionalFilters, "customer_outstanding_debt")
                    ?.operator
            ).toBe("greater_than");
            expect(
                result.additionalFilters.filter((f) => f.field === "due_date")
            ).toHaveLength(0);
        });

        it("due-today locks calendar day of now", () => {
            const result = buildDashboardInvoiceChartFilters({
                type: "due-today",
                now: NOW,
            });
            expect(findFilter(result.additionalFilters, "due_date")).toEqual({
                table: "Invoice",
                field: "due_date",
                operator: "between",
                value: ["2026-07-12", "2026-07-12"],
            });
        });

        it("due-this-week locks today through end of Sunday-based week", () => {
            // NOW is Sunday → week is Sun 12 .. Sat 18
            const result = buildDashboardInvoiceChartFilters({
                type: "due-this-week",
                now: NOW,
            });
            expect(findFilter(result.additionalFilters, "due_date")).toEqual({
                table: "Invoice",
                field: "due_date",
                operator: "between",
                value: ["2026-07-12", "2026-07-18"],
            });
        });

        it("due-this-month locks today through end of month", () => {
            const result = buildDashboardInvoiceChartFilters({
                type: "due-this-month",
                now: NOW,
            });
            expect(findFilter(result.additionalFilters, "due_date")).toEqual({
                table: "Invoice",
                field: "due_date",
                operator: "between",
                value: ["2026-07-12", "2026-07-31"],
            });
        });

        it("due-next-month locks full next calendar month", () => {
            const result = buildDashboardInvoiceChartFilters({
                type: "due-next-month",
                now: NOW,
            });
            expect(findFilter(result.additionalFilters, "due_date")).toEqual({
                table: "Invoice",
                field: "due_date",
                operator: "between",
                value: ["2026-08-01", "2026-08-31"],
            });
        });
    });

    describe("receivables-maturity-schedule", () => {
        it("normalizes + encoded spaces in daysRange labels (legacy chart-details)", () => {
            expect(normalizeMaturityDaysRange("0-7+days")).toBe("0-7 days");
            expect(normalizeMaturityDaysRange("8-30+days")).toBe("8-30 days");
        });

        it("without daysRange is not an invoice list (bucket overview)", () => {
            const result = buildDashboardInvoiceChartFilters({
                type: "receivables-maturity-schedule",
                now: NOW,
            });
            expect(result.isInvoiceList).toBe(false);
            expect(result.additionalFilters).toEqual([]);
        });

        it("with daysRange locks Due window and future due_date bucket", () => {
            const result = buildDashboardInvoiceChartFilters({
                type: "receivables-maturity-schedule",
                daysRange: "8-30 days",
                now: NOW,
            });

            expect(result.isInvoiceList).toBe(true);
            expect(result.family).toBe("maturity");
            const between = result.additionalFilters.find(
                (f) => f.field === "due_date" && f.operator === "between"
            );
            expect(between?.value).toEqual(["2026-07-20", "2026-08-11"]);
        });

        it("covers every maturity daysRange key", () => {
            for (const daysRange of Object.keys(MATURITY_DAYS_RANGE_MAP)) {
                const result = buildDashboardInvoiceChartFilters({
                    type: "receivables-maturity-schedule",
                    daysRange,
                    now: NOW,
                });
                expect(result.isInvoiceList, daysRange).toBe(true);
            }
        });

        it("flags parent viewMode as requiring special handling", () => {
            const result = buildDashboardInvoiceChartFilters({
                type: "receivables-maturity-schedule",
                daysRange: "0-7 days",
                viewMode: "parent",
                now: NOW,
            });
            expect(result.parentViewModeRequiresSpecialHandling).toBe(true);
            expect(result.isInvoiceList).toBe(true);
        });
    });
});

describe("dashboardInvoiceReportAccess", () => {
    it("allows financial-dashboard-only users for dashboard_invoices", () => {
        expect(
            canAccessReportsForContext(DASHBOARD_INVOICES_CONTEXT, {
                canViewReports: false,
                canViewFinancialDashboard: true,
            })
        ).toBe(true);
    });

    it("denies financial-dashboard-only users for other contexts", () => {
        expect(
            canAccessReportsForContext("invoices", {
                canViewReports: false,
                canViewFinancialDashboard: true,
            })
        ).toBe(false);
        expect(
            canAccessDashboardInvoiceReportContext("customers", {
                canViewReports: false,
                canViewFinancialDashboard: true,
            })
        ).toBe(false);
    });

    it("allows view_reports for any context", () => {
        expect(
            canAccessReportsForContext("invoices", {
                canViewReports: true,
                canViewFinancialDashboard: false,
            })
        ).toBe(true);
    });
});

describe("shouldUseDashboardInvoiceReportList", () => {
    it("is true for overdue and due drills", () => {
        expect(
            shouldUseDashboardInvoiceReportList({ type: "overdue-invoices" })
        ).toBe(true);
        expect(
            shouldUseDashboardInvoiceReportList({ type: "due-today" })
        ).toBe(true);
        expect(
            shouldUseDashboardInvoiceReportList({
                type: "aging-portfolio",
                daysRange: "0_7",
            })
        ).toBe(true);
    });

    it("is true for maturity only when a bucket is selected in child mode", () => {
        expect(
            shouldUseDashboardInvoiceReportList({
                type: "receivables-maturity-schedule",
            })
        ).toBe(false);
        expect(
            shouldUseDashboardInvoiceReportList({
                type: "receivables-maturity-schedule",
                daysRange: "0-7 days",
                viewMode: "child",
            })
        ).toBe(true);
        expect(
            shouldUseDashboardInvoiceReportList({
                type: "receivables-maturity-schedule",
                daysRange: "0-7 days",
                viewMode: "parent",
            })
        ).toBe(false);
    });

    it("is false for non-invoice chart types", () => {
        expect(
            shouldUseDashboardInvoiceReportList({ type: "collected-mtd" })
        ).toBe(false);
    });
});
