import { describe, it, expect } from "vitest";

import {
    buildDashboardActivityChartFilters,
    DASHBOARD_ACTIVITIES_CONTEXT,
    DASHBOARD_ACTIVITY_IDENTITY_FILTER_FIELD,
    DASHBOARD_ACTIVITY_SYSTEM_REPORT_UNIQUE_NAME,
    DASHBOARD_TOTAL_CALLS_FILTER_FIELD,
    expandDashboardTotalCallsWhere,
    getDashboardActivityChartFamily,
    getDashboardActivityIdentityMode,
    getDashboardActivitySystemReportUniqueName,
    isDashboardActivityChartType,
    shouldUseDashboardActivityReportList,
} from "@/shared/dashboard/dashboardActivityChartFilters";
import {
    canAccessReportsForContext,
    DASHBOARD_REPORT_CONTEXTS,
    isOperationDashboardReportContext,
} from "@/shared/dashboard/dashboardInvoiceReportAccess";

const NOW = new Date(2026, 6, 12); // Sunday Jul 12, 2026

function findFilter(
    filters: ReturnType<
        typeof buildDashboardActivityChartFilters
    >["additionalFilters"],
    field: string,
    table = "Activity"
) {
    return filters.find((f) => f.table === table && f.field === field);
}

describe("dashboardActivityChartFilters", () => {
    it("recognizes the five wired activity drill types only", () => {
        expect(isDashboardActivityChartType("manual-activities")).toBe(true);
        expect(isDashboardActivityChartType("total-calls")).toBe(true);
        expect(isDashboardActivityChartType("activity-success-rate")).toBe(
            true
        );
        expect(isDashboardActivityChartType("system-activities")).toBe(true);
        expect(isDashboardActivityChartType("portal-activities")).toBe(true);
        expect(isDashboardActivityChartType("disputes-created")).toBe(false);
        expect(isDashboardActivityChartType("automated-activities")).toBe(
            false
        );
        expect(getDashboardActivityChartFamily("manual-activities")).toBe(
            "manual"
        );
        expect(getDashboardActivityChartFamily("disputes-created")).toBeNull();
    });

    it("maps every activity drill to the single system report unique_name", () => {
        for (const type of [
            "manual-activities",
            "total-calls",
            "activity-success-rate",
            "system-activities",
            "portal-activities",
        ]) {
            expect(getDashboardActivitySystemReportUniqueName(type)).toBe(
                DASHBOARD_ACTIVITY_SYSTEM_REPORT_UNIQUE_NAME
            );
        }
        expect(getDashboardActivitySystemReportUniqueName("disputes-created")).toBeNull();
    });

    it("locks created_at between and identity marker for manual-activities", () => {
        const result = buildDashboardActivityChartFilters({
            type: "manual-activities",
            startDate: "2026-07-01T00:00:00.000Z",
            endDate: "2026-07-12T00:00:00.000Z",
            now: NOW,
        });

        expect(result.isActivityShaped).toBe(true);
        expect(result.isActivityList).toBe(true);
        expect(result.family).toBe("manual");
        expect(result.identityMode).toBe("agents_excl_audit");
        expect(result.systemReportUniqueName).toBe(
            DASHBOARD_ACTIVITY_SYSTEM_REPORT_UNIQUE_NAME
        );
        expect(findFilter(result.additionalFilters, "created_at")).toEqual({
            table: "Activity",
            field: "created_at",
            operator: "between",
            value: ["2026-07-01", "2026-07-12"],
        });
        expect(
            findFilter(
                result.additionalFilters,
                DASHBOARD_ACTIVITY_IDENTITY_FILTER_FIELD
            )?.value
        ).toBe("agents_excl_audit");
        expect(
            findFilter(result.additionalFilters, "system_generated")?.value
        ).toBe(false);
        expect(
            findFilter(
                result.additionalFilters,
                DASHBOARD_TOTAL_CALLS_FILTER_FIELD
            )
        ).toBeUndefined();
    });

    it("locks total-calls marker without system_generated filter", () => {
        const result = buildDashboardActivityChartFilters({
            type: "total-calls",
            startDate: "2026-07-01",
            endDate: "2026-07-12",
            now: NOW,
        });

        expect(result.family).toBe("total_calls");
        expect(result.identityMode).toBe("agents_excl_audit");
        expect(
            findFilter(
                result.additionalFilters,
                DASHBOARD_TOTAL_CALLS_FILTER_FIELD
            )?.value
        ).toBe(true);
        expect(
            findFilter(result.additionalFilters, "system_generated")
        ).toBeUndefined();
    });

    it("uses all_agents_incl_audit for activity-success-rate", () => {
        const result = buildDashboardActivityChartFilters({
            type: "activity-success-rate",
            now: NOW,
        });
        expect(result.identityMode).toBe("all_agents_incl_audit");
        expect(getDashboardActivityIdentityMode("activity-success-rate")).toBe(
            "all_agents_incl_audit"
        );
        expect(
            findFilter(result.additionalFilters, "system_generated")
        ).toBeUndefined();
    });

    it("uses system / portal identity modes for audit drills", () => {
        expect(
            buildDashboardActivityChartFilters({
                type: "system-activities",
                now: NOW,
            }).identityMode
        ).toBe("system");
        expect(
            buildDashboardActivityChartFilters({
                type: "portal-activities",
                now: NOW,
            }).identityMode
        ).toBe("portal");
    });

    it("defaults date range to last 30 days when dates are omitted", () => {
        const result = buildDashboardActivityChartFilters({
            type: "manual-activities",
            now: NOW,
        });
        expect(findFilter(result.additionalFilters, "created_at")?.value).toEqual([
            "2026-06-12",
            "2026-07-12",
        ]);
    });

    it("expands total-calls OR matching legacy details membership", () => {
        expect(expandDashboardTotalCallsWhere()).toEqual({
            OR: [
                { type: { in: ["Call", "Promise_to_pay"] } },
                {
                    AND: [
                        { type: "Dispute" },
                        {
                            title: {
                                contains: "filed",
                                mode: "insensitive",
                            },
                        },
                    ],
                },
            ],
        });
    });
});

describe("shouldUseDashboardActivityReportList", () => {
    it("is true only for the five converted activity types", () => {
        expect(
            shouldUseDashboardActivityReportList({ type: "manual-activities" })
        ).toBe(true);
        expect(
            shouldUseDashboardActivityReportList({ type: "total-calls" })
        ).toBe(true);
        expect(
            shouldUseDashboardActivityReportList({
                type: "activity-success-rate",
            })
        ).toBe(true);
        expect(
            shouldUseDashboardActivityReportList({ type: "system-activities" })
        ).toBe(true);
        expect(
            shouldUseDashboardActivityReportList({ type: "portal-activities" })
        ).toBe(true);
        expect(
            shouldUseDashboardActivityReportList({ type: "disputes-created" })
        ).toBe(false);
        expect(
            shouldUseDashboardActivityReportList({ type: "promises-to-pay" })
        ).toBe(false);
    });
});

describe("dashboard activity report access", () => {
    it("allows operation-dashboard-only users for dashboard_activities", () => {
        expect(
            canAccessReportsForContext(DASHBOARD_ACTIVITIES_CONTEXT, {
                canViewReports: false,
                canViewFinancialDashboard: false,
                canViewOperationDashboard: true,
            })
        ).toBe(true);
        expect(isOperationDashboardReportContext(DASHBOARD_ACTIVITIES_CONTEXT)).toBe(
            true
        );
        expect(DASHBOARD_REPORT_CONTEXTS).toContain(DASHBOARD_ACTIVITIES_CONTEXT);
    });

    it("denies operation-dashboard-only users for unrelated contexts", () => {
        expect(
            canAccessReportsForContext("invoices", {
                canViewReports: false,
                canViewOperationDashboard: true,
            })
        ).toBe(false);
        expect(
            canAccessReportsForContext("dashboard_invoices", {
                canViewReports: false,
                canViewOperationDashboard: true,
                canViewFinancialDashboard: false,
            })
        ).toBe(false);
    });

    it("does not grant financial contexts via operation permission alone", () => {
        expect(
            canAccessReportsForContext("dashboard_payments", {
                canViewReports: false,
                canViewOperationDashboard: true,
            })
        ).toBe(false);
    });
});
