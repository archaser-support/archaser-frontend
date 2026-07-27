import { describe, it, expect } from "vitest";

import { getViewConfig, isValidContext } from "@/shared/utils/viewConfigs";
import { DASHBOARD_PAYMENTS_CONTEXT } from "@/shared/dashboard/dashboardPaymentChartFilters";
import { REPORT_METADATA } from "@/server/services/reportMetadata";
import { MODEL_NAME_MAP } from "@/server/services/ReportExecutionService.constants";

describe("dashboard_payments InvoicePayment foundation", () => {
    it("registers viewConfig for InvoicePayment", () => {
        expect(isValidContext(DASHBOARD_PAYMENTS_CONTEXT)).toBe(true);
        const config = getViewConfig(DASHBOARD_PAYMENTS_CONTEXT);
        expect(config?.tableName).toBe("InvoicePayment");
        expect(config?.currencyColumns?.amount).toBeDefined();
        expect(config?.currencyColumns?.customer_amount).toBeDefined();
    });

    it("exposes InvoicePayment in report metadata and MODEL_NAME_MAP", () => {
        const table = REPORT_METADATA.tables.find(
            (t) => t.name === "InvoicePayment"
        );
        expect(table).toBeDefined();
        expect(table?.fields.some((f) => f.name === "payment_date")).toBe(true);
        expect(table?.fields.some((f) => f.name === "customer_amount")).toBe(
            true
        );
        expect(MODEL_NAME_MAP.InvoicePayment).toBe("invoicePayment");
    });
});
