import { describe, it, expect } from "vitest";

import {
    buildDashboardPromiseChartFilters,
    DASHBOARD_PROMISES_CONTEXT,
    DASHBOARD_PROMISE_ACTIVITY_FILTER_FIELD,
    DASHBOARD_PROMISE_SYSTEM_REPORT_UNIQUE_NAME,
    getDashboardPromiseSystemReportUniqueName,
    isDashboardPromiseChartType,
    parsePromiseActivityMarkerValue,
    resolvePromiseDrillDateRange,
    shouldUseDashboardPromiseReportList,
} from "@/shared/dashboard/dashboardPromiseChartFilters";
import {
    canAccessReportsForContext,
    DASHBOARD_REPORT_CONTEXTS,
} from "@/shared/dashboard/dashboardInvoiceReportAccess";

const NOW = new Date(2026, 6, 12);

describe("dashboardPromiseChartFilters", () => {
    it("recognizes promises-to-pay only", () => {
        expect(isDashboardPromiseChartType("promises-to-pay")).toBe(true);
        expect(isDashboardPromiseChartType("disputes-created")).toBe(false);
        expect(isDashboardPromiseChartType("manual-activities")).toBe(false);
    });

    it("maps to the single system report unique_name", () => {
        expect(getDashboardPromiseSystemReportUniqueName("promises-to-pay")).toBe(
            DASHBOARD_PROMISE_SYSTEM_REPORT_UNIQUE_NAME
        );
        expect(
            getDashboardPromiseSystemReportUniqueName("disputes-created")
        ).toBeNull();
    });

    it("locks promise-activity marker with ISO date range", () => {
        const result = buildDashboardPromiseChartFilters({
            type: "promises-to-pay",
            startDate: "2026-07-01T00:00:00.000Z",
            endDate: "2026-07-12T00:00:00.000Z",
            now: NOW,
        });

        expect(result.isPromiseShaped).toBe(true);
        expect(result.isPromiseList).toBe(true);
        expect(result.systemReportUniqueName).toBe(
            DASHBOARD_PROMISE_SYSTEM_REPORT_UNIQUE_NAME
        );
        expect(result.additionalFilters).toEqual([
            {
                table: "CustomerCollectionPeriod",
                field: DASHBOARD_PROMISE_ACTIVITY_FILTER_FIELD,
                operator: "equals",
                value: {
                    start: "2026-07-01T00:00:00.000Z",
                    end: "2026-07-12T00:00:00.000Z",
                },
            },
        ]);
        expect(result.activityDateRange).toEqual({
            start: new Date("2026-07-01T00:00:00.000Z"),
            end: new Date("2026-07-12T00:00:00.000Z"),
        });
    });

    it("defaults date range to last 30 days ending now when missing", () => {
        const range = resolvePromiseDrillDateRange(null, null, NOW);
        expect(range.end).toEqual(NOW);
        expect(range.start.getTime()).toBe(
            NOW.getTime() - 30 * 24 * 60 * 60 * 1000
        );
    });

    it("parses marker value ISO strings", () => {
        expect(
            parsePromiseActivityMarkerValue({
                start: "2026-07-01T00:00:00.000Z",
                end: "2026-07-12T00:00:00.000Z",
            })
        ).toEqual({
            start: new Date("2026-07-01T00:00:00.000Z"),
            end: new Date("2026-07-12T00:00:00.000Z"),
        });
        expect(parsePromiseActivityMarkerValue("bad")).toBeNull();
        expect(parsePromiseActivityMarkerValue({})).toBeNull();
    });
});

describe("shouldUseDashboardPromiseReportList", () => {
    it("is true only for promises-to-pay", () => {
        expect(
            shouldUseDashboardPromiseReportList({ type: "promises-to-pay" })
        ).toBe(true);
        expect(
            shouldUseDashboardPromiseReportList({ type: "disputes-created" })
        ).toBe(false);
        expect(
            shouldUseDashboardPromiseReportList({ type: "manual-activities" })
        ).toBe(false);
    });
});

describe("dashboard promise report access", () => {
    it("allows operation-dashboard-only users for dashboard_promises", () => {
        expect(
            canAccessReportsForContext(DASHBOARD_PROMISES_CONTEXT, {
                canViewReports: false,
                canViewOperationDashboard: true,
            })
        ).toBe(true);
        expect(DASHBOARD_REPORT_CONTEXTS).toContain(DASHBOARD_PROMISES_CONTEXT);
    });

    it("denies operation-dashboard-only users for unrelated contexts", () => {
        expect(
            canAccessReportsForContext("invoices", {
                canViewReports: false,
                canViewOperationDashboard: true,
            })
        ).toBe(false);
    });
});
