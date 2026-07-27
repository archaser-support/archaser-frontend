import { describe, it, expect } from "vitest";

import { LogService } from "@/server/services/LogService";
import { ReportQueryBuilder } from "@/server/services/ReportQueryBuilder";
import type { ReportConfig } from "@/server/services/ReportService";
import { buildDashboardPaymentChartFilters } from "@/shared/dashboard/dashboardPaymentChartFilters";
import { linkedInvoicePaymentWhere } from "@/utils/invoicePaymentFilters";

describe("ReportQueryBuilder InvoicePayment linked invoice filter", () => {
    const builder = new ReportQueryBuilder(LogService.getInstance());

    it("maps invoice_id is_not_empty to scalar { gt: 0 }, not Invoice.id", () => {
        const config: ReportConfig = {
            tables: ["InvoicePayment"],
            fields: [{ table: "InvoicePayment", field: "id" }],
            filters: [],
            sorting: [],
            grouping: [],
        };

        const contract = buildDashboardPaymentChartFilters({
            type: "collected-mtd",
            period: "2026-07",
        });

        const { where } = builder.buildQuery(
            config,
            10117,
            contract.additionalFilters
        );

        expect(where.Invoice).toBeUndefined();
        expect(where.invoice_id).toEqual(linkedInvoicePaymentWhere.invoice_id);
        expect(where.payment_date).toEqual({
            gte: expect.any(Date),
            lte: expect.any(Date),
        });
    });
});
