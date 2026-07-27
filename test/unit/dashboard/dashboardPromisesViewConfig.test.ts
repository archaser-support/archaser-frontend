import { describe, it, expect } from "vitest";

import {
    getViewConfig,
    isValidContext,
    MAIN_REPORTS_MENU_CONTEXT,
} from "@/shared/utils/viewConfigs";
import { DASHBOARD_PROMISES_CONTEXT } from "@/shared/dashboard/dashboardInvoiceReportAccess";

describe("viewConfigs dashboard_promises", () => {
    it("registers CustomerCollectionPeriod-backed operation-dashboard context", () => {
        expect(isValidContext(DASHBOARD_PROMISES_CONTEXT)).toBe(true);
        const config = getViewConfig(DASHBOARD_PROMISES_CONTEXT);
        expect(config?.tableName).toBe("CustomerCollectionPeriod");
        expect(config?.defaultSort).toEqual({
            field: "Customer.name",
            sort: "asc",
        });
        expect(config?.linkHandlers?.customer?.(10)).toContain("/customers/");
        expect(config?.currencyColumns?.promise_to_pay_amount).toEqual({
            amountField: "promise_to_pay_amount",
            currencyField: "currency",
        });
    });

    it("is not the main reports menu context", () => {
        expect(DASHBOARD_PROMISES_CONTEXT).not.toBe(MAIN_REPORTS_MENU_CONTEXT);
    });
});
