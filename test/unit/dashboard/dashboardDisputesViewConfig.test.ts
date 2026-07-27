import { describe, it, expect } from "vitest";

import { getViewConfig, isValidContext, MAIN_REPORTS_MENU_CONTEXT } from "@/shared/utils/viewConfigs";
import { DASHBOARD_DISPUTES_CONTEXT } from "@/shared/dashboard/dashboardInvoiceReportAccess";

describe("viewConfigs dashboard_disputes", () => {
    it("registers Dispute-backed operation-dashboard context", () => {
        expect(isValidContext(DASHBOARD_DISPUTES_CONTEXT)).toBe(true);
        const config = getViewConfig(DASHBOARD_DISPUTES_CONTEXT);
        expect(config?.tableName).toBe("Dispute");
        expect(config?.defaultSort).toEqual({
            field: "Customer.name",
            sort: "asc",
        });
        expect(config?.linkHandlers?.customer?.(10)).toContain("/customers/");
    });

    it("is not the main reports menu context", () => {
        expect(DASHBOARD_DISPUTES_CONTEXT).not.toBe(MAIN_REPORTS_MENU_CONTEXT);
    });
});
