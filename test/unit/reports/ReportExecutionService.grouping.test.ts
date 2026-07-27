import { describe, expect, it } from "vitest";

import { ReportExecutionService } from "@/server/services/ReportExecutionService";
import { ReportConfig } from "@/server/services/ReportService";

describe("ReportExecutionService grouping helpers", () => {
    const service = ReportExecutionService.getInstance() as any;

    it("groups rows and aggregates SUM values by grouping key", () => {
        const config: ReportConfig = {
            tables: ["Customer", "Invoice"],
            fields: [
                { table: "Customer", field: "name" },
                { table: "Invoice", field: "amount", aggregation: "SUM" },
            ],
            grouping: ["Customer.name"],
        };
        const rows = [
            { id: 1, "Customer.name": "Acme", "Invoice.amount": 100 },
            { id: 2, "Customer.name": "Acme", "Invoice.amount": 50 },
            { id: 3, "Customer.name": "Globex", "Invoice.amount": 80 },
        ];

        const grouped = service.applyGroupingAndAggregation(
            rows,
            config,
            "Customer",
            "en-US",
            "USD"
        );

        expect(grouped).toHaveLength(2);
        const acme = grouped.find((r: any) => r["Customer.name"] === "Acme");
        expect(acme).toMatchObject({
            "Customer.name": "Acme",
            "Invoice.amount__SUM": 150,
        });
        expect(acme["___formatted_Invoice.amount__SUM"]).toMatch(/150/);
        const globex = grouped.find((r: any) => r["Customer.name"] === "Globex");
        expect(globex).toMatchObject({
            "Customer.name": "Globex",
            "Invoice.amount__SUM": 80,
        });
        expect(globex["___formatted_Invoice.amount__SUM"]).toMatch(/80/);
    });

    it("matchesFilter compares Prisma-like Decimal values for numeric operators", () => {
        const decimalLike = {
            toNumber: () => 250,
            toString: () => "250",
        };
        expect(
            service.matchesFilter(
                { amount: decimalLike },
                {
                    table: "Invoice",
                    field: "amount",
                    operator: "greater_than",
                    value: 100,
                },
                "Invoice"
            )
        ).toBe(true);
        expect(
            service.matchesFilter(
                { amount: decimalLike },
                {
                    table: "Invoice",
                    field: "amount",
                    operator: "equals",
                    value: 250,
                },
                "Invoice"
            )
        ).toBe(true);
        expect(
            service.matchesFilter(
                { amount: decimalLike },
                {
                    table: "Invoice",
                    field: "amount",
                    operator: "less_than",
                    value: 100,
                },
                "Invoice"
            )
        ).toBe(false);
    });

    it("aggregates SUM when source rows use Decimal-like amount values", () => {
        const config: ReportConfig = {
            tables: ["Customer", "Invoice"],
            fields: [
                { table: "Customer", field: "name" },
                { table: "Invoice", field: "amount", aggregation: "SUM" },
            ],
            grouping: ["Customer.name"],
            filters: [
                {
                    table: "Invoice",
                    field: "amount",
                    operator: "greater_than",
                    value: 50,
                },
            ],
        };
        const decimal = (n: number) => ({
            toNumber: () => n,
            toString: () => String(n),
        });
        const rows = [
            {
                id: 1,
                "Customer.name": "Acme",
                "Invoice.amount__SUM": decimal(100),
            },
            {
                id: 2,
                "Customer.name": "Acme",
                "Invoice.amount__SUM": decimal(50),
            },
        ];

        const grouped = service.applyGroupingAndAggregation(
            rows,
            config,
            "Customer",
            "en-US",
            "USD"
        );

        expect(grouped).toHaveLength(1);
        expect(grouped[0]["Invoice.amount__SUM"]).toBe(150);
    });

    it("preserves __link_ metadata and customer_id on grouped rows", () => {
        const config: ReportConfig = {
            tables: ["Customer", "Invoice"],
            fields: [
                { table: "Customer", field: "name" },
                { table: "Invoice", field: "amount", aggregation: "SUM" },
            ],
            grouping: ["Customer.name"],
        };
        const rows = [
            {
                id: 1,
                customer_id: 101,
                "Customer.name": "Acme",
                "Invoice.amount": 100,
                "__link_Customer.name": { type: "customer", id: 101 },
            },
            {
                id: 2,
                customer_id: 101,
                "Customer.name": "Acme",
                "Invoice.amount": 50,
                "__link_Customer.name": { type: "customer", id: 101 },
            },
        ];

        const grouped = service.applyGroupingAndAggregation(
            rows,
            config,
            "Customer",
            "en-US",
            "USD"
        );

        expect(grouped).toHaveLength(1);
        expect(grouped[0]).toMatchObject({
            "Customer.name": "Acme",
            customer_id: 101,
            "__link_Customer.name": { type: "customer", id: 101 },
        });
    });

    it("returns a single aggregate row when no grouping exists but aggregation is configured", () => {
        const config: ReportConfig = {
            tables: ["Invoice"],
            fields: [{ table: "Invoice", field: "amount", aggregation: "SUM" }],
            grouping: [],
        };
        const rows = [
            { id: 1, "Invoice.amount": 10 },
            { id: 2, "Invoice.amount": 30 },
            { id: 3, "Invoice.amount": 5 },
        ];

        const grouped = service.applyGroupingAndAggregation(
            rows,
            config,
            "Invoice",
            "en-US",
            "USD"
        );
        expect(grouped).toHaveLength(1);
        expect(grouped[0]["Invoice.amount__SUM"]).toBe(45);
        expect(grouped[0]["___formatted_Invoice.amount__SUM"]).toMatch(/45/);
    });

    it("supports grouped COUNT and allows post-group sort/pagination flow", () => {
        const config: ReportConfig = {
            tables: ["Customer", "Invoice"],
            fields: [
                { table: "Customer", field: "name" },
                { table: "Invoice", field: "id", aggregation: "COUNT" },
            ],
            grouping: ["Customer.name"],
        };
        const rows = [
            { id: 1, "Customer.name": "C", "Invoice.id": 1 },
            { id: 2, "Customer.name": "A", "Invoice.id": 2 },
            { id: 3, "Customer.name": "A", "Invoice.id": 3 },
            { id: 4, "Customer.name": "B", "Invoice.id": 4 },
            { id: 5, "Customer.name": "B", "Invoice.id": 5 },
            { id: 6, "Customer.name": "B", "Invoice.id": 6 },
        ];

        const grouped = service.applyGroupingAndAggregation(
            rows,
            config,
            "Customer",
            "en-US",
            "USD"
        );
        grouped.sort((a: any, b: any) =>
            service.compareSortValues(
                a["Invoice.id__COUNT"],
                b["Invoice.id__COUNT"],
                false
            )
        );
        const paginated = grouped.slice(0, 2);

        expect(grouped.map((row: any) => row["Invoice.id__COUNT"])).toEqual([
            3, 2, 1,
        ]);
        expect(paginated).toHaveLength(2);
        expect(paginated[0]["Customer.name"]).toBe("B");
        expect(paginated[1]["Customer.name"]).toBe("A");
    });

    it("aggregates grouped formula columns and keeps formatted values", () => {
        const config: ReportConfig = {
            tables: ["Customer", "Invoice"],
            fields: [
                { table: "Customer", field: "name" },
                { table: "Invoice", field: "amount", aggregation: "SUM" },
            ],
            grouping: ["Customer.name"],
            formulas: [
                {
                    id: "f1",
                    label: "Premium",
                    expression: "[Invoice.amount]*[Customer.cost_percent]/100",
                    format: "number",
                    aggregation: "SUM",
                } as any,
            ],
        };

        const rows = [
            {
                id: 1,
                "Customer.name": "Acme",
                "Invoice.amount": 100,
                "Customer.cost_percent": 5,
                "formula:f1": 5,
                "___formatted_formula:f1": "5",
            },
            {
                id: 2,
                "Customer.name": "Acme",
                "Invoice.amount": 200,
                "Customer.cost_percent": 10,
                "formula:f1": 20,
                "___formatted_formula:f1": "20",
            },
        ];

        const grouped = service.applyGroupingAndAggregation(
            rows,
            config,
            "Customer",
            "en-US",
            "USD"
        );

        expect(grouped).toHaveLength(1);
        expect(grouped[0]["formula:f1"]).toBe(25);
        expect(grouped[0]["___formatted_formula:f1"]).toContain("25");
    });

    it("supports AVG/MIN/MAX formula aggregation and blanks mixed currencies", () => {
        const baseFields = [
            { table: "Customer", field: "name" },
            { table: "Invoice", field: "amount", aggregation: "SUM" as const },
        ];

        const avgConfig: ReportConfig = {
            tables: ["Customer", "Invoice"],
            fields: baseFields,
            grouping: ["Customer.name"],
            formulas: [
                {
                    id: "avg",
                    label: "Avg",
                    expression: "[Invoice.amount]",
                    format: "number",
                    aggregation: "AVG",
                } as any,
            ],
        };
        const avgRows = [
            {
                id: 1,
                "Customer.name": "Acme",
                "Invoice.amount": 10,
                "formula:avg": 10,
            },
            {
                id: 2,
                "Customer.name": "Acme",
                "Invoice.amount": 30,
                "formula:avg": 30,
            },
        ];
        const avgGrouped = service.applyGroupingAndAggregation(
            avgRows,
            avgConfig,
            "Customer",
            "en-US",
            "USD"
        );
        expect(avgGrouped[0]["formula:avg"]).toBe(20);

        const mixedConfig: ReportConfig = {
            tables: ["Customer", "Invoice"],
            fields: baseFields,
            grouping: ["Customer.name"],
            formulas: [
                {
                    id: "cur",
                    label: "Cur",
                    expression: "[Invoice.amount]",
                    format: "currency",
                    currencySource: "Invoice.amount",
                    aggregation: "SUM",
                } as any,
            ],
        };
        const mixedRows = [
            {
                id: 1,
                "Customer.name": "Acme",
                "Invoice.amount": 10,
                "formula:cur": 10,
                "__currency_Invoice.amount": "USD",
            },
            {
                id: 2,
                "Customer.name": "Acme",
                "Invoice.amount": 20,
                "formula:cur": 20,
                "__currency_Invoice.amount": "EUR",
            },
        ];
        const mixedGrouped = service.applyGroupingAndAggregation(
            mixedRows,
            mixedConfig,
            "Customer",
            "en-US",
            "USD"
        );
        expect(mixedGrouped[0]["formula:cur"]).toBeNull();
    });
});
