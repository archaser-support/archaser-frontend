import { describe, it, expect } from "vitest";

import { getViewConfig, isValidContext } from "@/shared/utils/viewConfigs";
import { DASHBOARD_ACTIVITIES_CONTEXT } from "@/shared/dashboard/dashboardInvoiceReportAccess";
import { MAIN_REPORTS_MENU_CONTEXT } from "@/shared/utils/viewConfigs";

describe("viewConfigs dashboard_activities", () => {
    it("registers Activity-backed operation-dashboard context", () => {
        expect(isValidContext(DASHBOARD_ACTIVITIES_CONTEXT)).toBe(true);
        const config = getViewConfig(DASHBOARD_ACTIVITIES_CONTEXT);
        expect(config?.tableName).toBe("Activity");
        expect(config?.entityNameField).toBe("title");
        expect(config?.defaultSort).toEqual({
            field: "Customer.name",
            sort: "asc",
        });
        expect(config?.linkHandlers?.customer?.(10)).toContain("/customers/");
    });

    it("is not the main reports menu context", () => {
        expect(DASHBOARD_ACTIVITIES_CONTEXT).not.toBe(MAIN_REPORTS_MENU_CONTEXT);
    });
});
