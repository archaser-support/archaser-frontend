import { describe, it, expect } from "vitest";

import {
    buildDashboardDisputeChartFilters,
    DASHBOARD_DISPUTES_CONTEXT,
    DASHBOARD_DISPUTE_CLOSED_STATUSES,
    DASHBOARD_DISPUTE_FAMILY_FILTER_FIELD,
    DASHBOARD_DISPUTE_SYSTEM_REPORT_UNIQUE_NAME,
    expandDashboardDisputeFamilyWhere,
    getDashboardDisputeChartFamily,
    getDashboardDisputeSystemReportUniqueName,
    isDashboardDisputeChartType,
    shouldUseDashboardDisputeReportList,
} from "@/shared/dashboard/dashboardDisputeChartFilters";
import {
    canAccessReportsForContext,
    DASHBOARD_REPORT_CONTEXTS,
} from "@/shared/dashboard/dashboardInvoiceReportAccess";

const NOW = new Date(2026, 6, 12);

function findFilter(
    filters: ReturnType<
        typeof buildDashboardDisputeChartFilters
    >["additionalFilters"],
    field: string
) {
    return filters.find((f) => f.table === "Dispute" && f.field === field);
}

describe("dashboardDisputeChartFilters", () => {
    it("recognizes disputes-created and disputes-closed only", () => {
        expect(isDashboardDisputeChartType("disputes-created")).toBe(true);
        expect(isDashboardDisputeChartType("disputes-closed")).toBe(true);
        expect(isDashboardDisputeChartType("open-disputes")).toBe(false);
        expect(isDashboardDisputeChartType("manual-activities")).toBe(false);
        expect(getDashboardDisputeChartFamily("disputes-created")).toBe(
            "created"
        );
        expect(getDashboardDisputeChartFamily("disputes-closed")).toBe(
            "closed"
        );
    });

    it("maps both drills to the single system report unique_name", () => {
        expect(
            getDashboardDisputeSystemReportUniqueName("disputes-created")
        ).toBe(DASHBOARD_DISPUTE_SYSTEM_REPORT_UNIQUE_NAME);
        expect(
            getDashboardDisputeSystemReportUniqueName("disputes-closed")
        ).toBe(DASHBOARD_DISPUTE_SYSTEM_REPORT_UNIQUE_NAME);
        expect(
            getDashboardDisputeSystemReportUniqueName("open-disputes")
        ).toBeNull();
    });

    it("locks created_at and created family marker for disputes-created", () => {
        const result = buildDashboardDisputeChartFilters({
            type: "disputes-created",
            startDate: "2026-07-01T00:00:00.000Z",
            endDate: "2026-07-12T00:00:00.000Z",
            now: NOW,
        });

        expect(result.isDisputeShaped).toBe(true);
        expect(result.isDisputeList).toBe(true);
        expect(result.family).toBe("created");
        expect(
            findFilter(result.additionalFilters, DASHBOARD_DISPUTE_FAMILY_FILTER_FIELD)
                ?.value
        ).toBe("created");
        expect(findFilter(result.additionalFilters, "created_at")).toEqual({
            table: "Dispute",
            field: "created_at",
            operator: "between",
            value: ["2026-07-01", "2026-07-12"],
        });
        expect(
            findFilter(result.additionalFilters, "dispute_status")
        ).toBeUndefined();
    });

    it("locks closed_at, closed statuses, and closed family for disputes-closed", () => {
        const result = buildDashboardDisputeChartFilters({
            type: "disputes-closed",
            startDate: "2026-07-01",
            endDate: "2026-07-12",
            now: NOW,
        });

        expect(result.family).toBe("closed");
        expect(
            findFilter(result.additionalFilters, DASHBOARD_DISPUTE_FAMILY_FILTER_FIELD)
                ?.value
        ).toBe("closed");
        expect(findFilter(result.additionalFilters, "closed_at")?.value).toEqual([
            "2026-07-01",
            "2026-07-12",
        ]);
        expect(findFilter(result.additionalFilters, "dispute_status")?.value).toEqual(
            [...DASHBOARD_DISPUTE_CLOSED_STATUSES]
        );
    });

    it("expands created/closed OR membership matching legacy details", () => {
        expect(
            expandDashboardDisputeFamilyWhere("created", {
                agentIds: ["a1", "sys"],
                systemUserId: "sys",
                portalUserId: "portal",
            })
        ).toEqual({
            created_by: { notIn: ["portal", "sys"] },
            OR: [
                { created_by: { in: ["a1", "sys"] } },
                { owner_id: { in: ["a1", "sys"] } },
            ],
        });

        expect(
            expandDashboardDisputeFamilyWhere("closed", {
                agentIds: ["a1"],
                systemUserId: "sys",
                portalUserId: "portal",
            })
        ).toEqual({
            OR: [
                { created_by: { in: ["a1"] } },
                { owner_id: { in: ["a1"] } },
                { modified_by: { in: ["a1"] } },
            ],
            modified_by: { notIn: ["portal", "sys"] },
        });
    });
});

describe("shouldUseDashboardDisputeReportList", () => {
    it("is true only for the two converted dispute types", () => {
        expect(
            shouldUseDashboardDisputeReportList({ type: "disputes-created" })
        ).toBe(true);
        expect(
            shouldUseDashboardDisputeReportList({ type: "disputes-closed" })
        ).toBe(true);
        expect(
            shouldUseDashboardDisputeReportList({ type: "open-disputes" })
        ).toBe(false);
        expect(
            shouldUseDashboardDisputeReportList({ type: "promises-to-pay" })
        ).toBe(false);
    });
});

describe("dashboard dispute report access", () => {
    it("allows operation-dashboard-only users for dashboard_disputes", () => {
        expect(
            canAccessReportsForContext(DASHBOARD_DISPUTES_CONTEXT, {
                canViewReports: false,
                canViewOperationDashboard: true,
            })
        ).toBe(true);
        expect(DASHBOARD_REPORT_CONTEXTS).toContain(DASHBOARD_DISPUTES_CONTEXT);
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
