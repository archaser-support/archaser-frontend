import { describe, it, expect } from "vitest";

import {
    appendOperationDashboardDetailsReturnParams,
    buildOperationDashboardDetailsReturnPath,
    DASHBOARD_ACTIVITIES_CONTEXT,
    isOperationDashboardDetailsReportContext,
} from "@/shared/dashboard/dashboardOperationBuilderReturn";
import { MAIN_REPORTS_MENU_CONTEXT } from "@/shared/utils/viewConfigs";

describe("dashboardOperationBuilderReturn", () => {
    it("recognizes dashboard_activities context for details return", () => {
        expect(
            isOperationDashboardDetailsReportContext(DASHBOARD_ACTIVITIES_CONTEXT)
        ).toBe(true);
        expect(isOperationDashboardDetailsReportContext("invoices")).toBe(false);
        expect(
            isOperationDashboardDetailsReportContext("dashboard_invoices")
        ).toBe(false);
        expect(
            isOperationDashboardDetailsReportContext(MAIN_REPORTS_MENU_CONTEXT)
        ).toBe(false);
    });

    it("forwards operation details drill params onto builder query", () => {
        const target = new URLSearchParams({
            context: DASHBOARD_ACTIVITIES_CONTEXT,
            table: "Activity",
        });
        appendOperationDashboardDetailsReturnParams(
            target,
            new URLSearchParams({
                type: "total-calls",
                startDate: "2026-07-01T00:00:00.000Z",
                endDate: "2026-07-12T23:59:59.999Z",
                selectedUserId: "agent-1",
                businessUnitId: "12",
                unrelated: "x",
            })
        );

        expect(target.get("type")).toBe("total-calls");
        expect(target.get("startDate")).toBe("2026-07-01T00:00:00.000Z");
        expect(target.get("endDate")).toBe("2026-07-12T23:59:59.999Z");
        expect(target.get("selectedUserId")).toBe("agent-1");
        expect(target.get("businessUnitId")).toBe("12");
        expect(target.get("unrelated")).toBeNull();
    });

    it("builds details return path with preserved params and reportId", () => {
        const path = buildOperationDashboardDetailsReturnPath(
            "en",
            new URLSearchParams({
                type: "system-activities",
                startDate: "2026-07-01T00:00:00.000Z",
                endDate: "2026-07-12T00:00:00.000Z",
                businessUnitId: "5",
                selectedUserId: "u-9",
            }),
            99,
            DASHBOARD_ACTIVITIES_CONTEXT
        );

        expect(path.startsWith("/en/app/operation-dashboard/details?")).toBe(
            true
        );
        const query = new URLSearchParams(path.split("?")[1]);
        expect(query.get("type")).toBe("system-activities");
        expect(query.get("startDate")).toBe("2026-07-01T00:00:00.000Z");
        expect(query.get("endDate")).toBe("2026-07-12T00:00:00.000Z");
        expect(query.get("businessUnitId")).toBe("5");
        expect(query.get("selectedUserId")).toBe("u-9");
        expect(query.get("reportId")).toBe("99");
    });

    it("defaults type to manual-activities when missing for activities", () => {
        const path = buildOperationDashboardDetailsReturnPath(
            "he",
            new URLSearchParams(),
            7,
            DASHBOARD_ACTIVITIES_CONTEXT
        );
        const query = new URLSearchParams(path.split("?")[1]);
        expect(query.get("type")).toBe("manual-activities");
        expect(query.get("reportId")).toBe("7");
    });

    it("defaults type to disputes-created when missing for disputes", () => {
        const path = buildOperationDashboardDetailsReturnPath(
            "en",
            new URLSearchParams(),
            8,
            "dashboard_disputes"
        );
        const query = new URLSearchParams(path.split("?")[1]);
        expect(query.get("type")).toBe("disputes-created");
        expect(query.get("reportId")).toBe("8");
    });

    it("defaults type to promises-to-pay when missing for promises", () => {
        const path = buildOperationDashboardDetailsReturnPath(
            "en",
            new URLSearchParams(),
            9,
            "dashboard_promises"
        );
        const query = new URLSearchParams(path.split("?")[1]);
        expect(query.get("type")).toBe("promises-to-pay");
        expect(query.get("reportId")).toBe("9");
    });
});

describe("main reports menu isolation", () => {
    it("does not treat dashboard_activities as the main reports menu context", () => {
        expect(DASHBOARD_ACTIVITIES_CONTEXT).not.toBe(MAIN_REPORTS_MENU_CONTEXT);
    });
});
