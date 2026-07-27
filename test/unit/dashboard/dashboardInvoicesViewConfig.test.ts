import { describe, it, expect } from "vitest";

import {
    getViewConfig,
    isValidContext,
} from "@/shared/utils/viewConfigs";
import { DASHBOARD_INVOICES_CONTEXT } from "@/shared/dashboard/dashboardInvoiceReportAccess";

describe("viewConfigs dashboard_invoices", () => {
    it("registers Invoice-backed chart-details context", () => {
        expect(isValidContext(DASHBOARD_INVOICES_CONTEXT)).toBe(true);
        const config = getViewConfig(DASHBOARD_INVOICES_CONTEXT);
        expect(config?.tableName).toBe("Invoice");
        expect(config?.entityNameField).toBe("invoice_number");
        expect(config?.defaultSort).toEqual({
            field: "invoice_number",
            sort: "asc",
        });
        expect(config?.linkHandlers?.invoice?.(10)).toContain("/invoices/10");
    });
});
