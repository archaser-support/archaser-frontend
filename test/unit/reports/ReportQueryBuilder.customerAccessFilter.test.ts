import { describe, it, expect } from "vitest";

import { ReportQueryBuilder } from "@/server/services/ReportQueryBuilder";
import type { ReportConfig } from "@/server/services/ReportService";

describe("ReportQueryBuilder customerAccessFilter", () => {
    const builder = new ReportQueryBuilder();

    it("ANDs owner scope into existing Customer filters for Invoice reports", () => {
        const config: ReportConfig = {
            tables: ["Invoice"],
            fields: [
                { table: "Invoice", field: "invoice_number" },
                { table: "Customer", field: "collection_status" },
            ],
            filters: [
                {
                    table: "Customer",
                    field: "collection_status",
                    operator: "equals",
                    value: "Active",
                },
            ],
            sorting: [],
            grouping: [],
        };

        const { where } = builder.buildQuery(
            config,
            1,
            undefined,
            undefined,
            { business_unit_id: 7 },
            { OR: [{ owner_id: "u1" }, { owner_id: null }] }
        );

        expect(where.account_id).toBe(1);
        expect(where.Customer).toEqual({
            AND: [
                expect.objectContaining({
                    collection_status: expect.anything(),
                }),
                { OR: [{ owner_id: "u1" }, { owner_id: null }] },
            ],
        });
    });
});
