import { describe, expect, it } from "vitest";

import { ReportExecutionService } from "@/server/services/ReportExecutionService";
import { ReportConfig } from "@/server/services/ReportService";
import { REPORT_METADATA } from "@/server/services/reportMetadata";

describe("ReportExecutionService BusinessUnit on Customer reports", () => {
    const service = ReportExecutionService.getInstance() as any;

    it("formats Customer.BusinessUnit.name from the BusinessUnit relation", async () => {
        const config: ReportConfig = {
            tables: ["Customer"],
            fields: [{ table: "Customer", field: "BusinessUnit.name" }],
        };

        const formatted = await service.formatSingleRow(
            {
                id: 1,
                BusinessUnit: { name: "North Division" },
            },
            config,
            "Customer",
            0,
            null,
            null
        );

        expect(formatted["Customer.BusinessUnit.name"]).toBe("North Division");
    });

    it("groups rows by Customer.BusinessUnit.name with SUM aggregation", () => {
        const config: ReportConfig = {
            tables: ["Customer", "Invoice"],
            fields: [
                { table: "Customer", field: "BusinessUnit.name" },
                { table: "Invoice", field: "amount", aggregation: "SUM" },
            ],
            grouping: ["Customer.BusinessUnit.name"],
        };
        const rows = [
            {
                id: 1,
                "Customer.BusinessUnit.name": "North",
                "Invoice.amount": 100,
            },
            {
                id: 2,
                "Customer.BusinessUnit.name": "North",
                "Invoice.amount": 50,
            },
            {
                id: 3,
                "Customer.BusinessUnit.name": "South",
                "Invoice.amount": 80,
            },
        ];

        const grouped = service.applyGroupingAndAggregation(
            rows,
            config,
            "Customer",
            "en-US",
            "USD"
        );

        expect(grouped).toHaveLength(2);
        expect(grouped).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    "Customer.BusinessUnit.name": "North",
                    "Invoice.amount__SUM": 150,
                }),
                expect.objectContaining({
                    "Customer.BusinessUnit.name": "South",
                    "Invoice.amount__SUM": 80,
                }),
            ])
        );
    });

    it("supports multi-dimension grouping with Business Unit and collection status", () => {
        const config: ReportConfig = {
            tables: ["Customer"],
            fields: [
                { table: "Customer", field: "BusinessUnit.name" },
                { table: "Customer", field: "collection_status" },
                { table: "Customer", field: "id", aggregation: "COUNT" },
            ],
            grouping: [
                "Customer.BusinessUnit.name",
                "Customer.collection_status",
            ],
        };
        const rows = [
            {
                id: 1,
                "Customer.BusinessUnit.name": "North",
                "Customer.collection_status": "Active",
                "Customer.id": 1,
            },
            {
                id: 2,
                "Customer.BusinessUnit.name": "North",
                "Customer.collection_status": "Active",
                "Customer.id": 2,
            },
            {
                id: 3,
                "Customer.BusinessUnit.name": "North",
                "Customer.collection_status": "Inactive",
                "Customer.id": 3,
            },
        ];

        const grouped = service.applyGroupingAndAggregation(
            rows,
            config,
            "Customer",
            "en-US",
            "USD"
        );

        expect(grouped).toHaveLength(2);
        const activeNorth = grouped.find(
            (row: Record<string, unknown>) =>
                row["Customer.BusinessUnit.name"] === "North" &&
                row["Customer.collection_status"] === "Active"
        );
        expect(activeNorth).toMatchObject({
            "Customer.BusinessUnit.name": "North",
            "Customer.collection_status": "Active",
            "Customer.id__COUNT": 2,
        });
    });
});

describe("report metadata BusinessUnit field", () => {
    it("registers BusinessUnit.name on the Customer table", () => {
        const customerTable = REPORT_METADATA.tables.find(
            (table) => table.name === "Customer"
        );
        const buField = customerTable?.fields.find(
            (field) => field.name === "BusinessUnit.name"
        );

        expect(buField).toMatchObject({
            name: "BusinessUnit.name",
            type: "string",
            label: "Business Unit",
            translationKey: "business_unit",
            translationNamespace: "customers",
        });
    });
});
