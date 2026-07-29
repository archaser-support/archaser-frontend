import { describe, expect, it } from "vitest";

import { applyFormulasToRows, aggregateFormulaColumnsInGroupedRows } from "@/server/services/reportFormulaExecution";
import type { ReportConfig } from "@/server/services/ReportService";
import { extractCustomerPolicyReportField } from "@/server/utils/reportCustomerPolicyFields";
import {
    normalizeFormulaExpression,
    parseFormulaExpression,
} from "@/shared/reportFormula/parser";

describe("report formula execution and monthly report shape", () => {
    const metadataTables = [
        {
            name: "Invoice",
            fields: [{ name: "amount", type: "number" }],
        },
        {
            name: "Customer",
            fields: [
                { name: "name", type: "string" },
                { name: "cost_percent", type: "number" },
                { name: "registration_fee_percent", type: "number" },
            ],
        },
    ];

    it("evaluates Monthly Report premium formula per row with decimal precision", () => {
        const config: ReportConfig = {
            tables: ["Invoice", "Customer"],
            fields: [
                { table: "Customer", field: "name" },
                { table: "Invoice", field: "amount" },
                { table: "Customer", field: "cost_percent" },
            ],
            formulas: [
                {
                    id: "premium",
                    label: "Insurance Premium",
                    expression: "[Invoice.amount]*[Customer.cost_percent]",
                    format: "number",
                },
            ],
        };

        const { rows, warnings } = applyFormulasToRows(
            [
                {
                    id: 1,
                    "Customer.name": "Acme",
                    "Invoice.amount": 1000,
                    "Customer.cost_percent": 5,
                },
                {
                    id: 2,
                    "Customer.name": "Acme",
                    "Invoice.amount": 200,
                    "Customer.cost_percent": 10,
                },
                {
                    id: 3,
                    "Customer.name": "Globex",
                    "Invoice.amount": 100,
                    "Customer.cost_percent": null,
                },
            ],
            config,
            { locale: "en-US", metadataTables }
        );

        expect(rows[0]["formula:premium"]).toBe(50);
        expect(rows[1]["formula:premium"]).toBe(20);
        expect(rows[2]["formula:premium"]).toBeNull();
        // Null rate → blank cell, no invalid-calculation warning
        expect(warnings).toEqual([]);
    });

    it("auto-scales registration_fee_percent by 100 in formulas", () => {
        const config: ReportConfig = {
            tables: ["Invoice", "Customer"],
            fields: [
                { table: "Invoice", field: "amount" },
                { table: "Customer", field: "registration_fee_percent" },
            ],
            formulas: [
                {
                    id: "fee",
                    label: "Registration Fee",
                    expression:
                        "[Invoice.amount]*[Customer.registration_fee_percent]",
                    format: "number",
                },
            ],
        };

        const { rows, warnings } = applyFormulasToRows(
            [
                {
                    id: 1,
                    "Invoice.amount": 1000,
                    "Customer.registration_fee_percent": 2.5,
                },
            ],
            config,
            { locale: "en-US", metadataTables }
        );

        expect(rows[0]["formula:fee"]).toBe(25);
        expect(warnings).toEqual([]);
    });

    it("formats percentage formula results from fraction values", () => {
        const config: ReportConfig = {
            tables: ["Customer"],
            fields: [{ table: "Customer", field: "cost_percent" }],
            formulas: [
                {
                    id: "rate",
                    label: "Rate",
                    expression: "[Customer.cost_percent]",
                    format: "percentage",
                },
            ],
        };

        const { rows } = applyFormulasToRows(
            [{ id: 1, "Customer.cost_percent": 3 }],
            config,
            { locale: "en-US", metadataTables }
        );

        expect(rows[0]["formula:rate"]).toBe(0.03);
        expect(String(rows[0]["___formatted_formula:rate"])).toMatch(/3%/);
    });

    it("returns blank for division by zero and accumulates warnings", () => {
        const config: ReportConfig = {
            tables: ["Invoice"],
            fields: [{ table: "Invoice", field: "amount" }],
            formulas: [
                {
                    id: "f1",
                    label: "Ratio",
                    expression: "[Invoice.amount]/0",
                    format: "number",
                },
            ],
        };

        const { rows, warnings } = applyFormulasToRows(
            [{ id: 1, "Invoice.amount": 10 }],
            config,
            { locale: "en-US", metadataTables }
        );

        expect(rows[0]["formula:f1"]).toBeNull();
        expect(warnings[0]?.invalidCount).toBe(1);
    });

    it("resolves canonical [Invoice.amount] from aggregated Invoice.amount__SUM row keys", () => {
        const config: ReportConfig = {
            tables: ["Invoice", "Customer"],
            fields: [
                { table: "Customer", field: "name" },
                {
                    table: "Invoice",
                    field: "amount",
                    aggregation: "SUM",
                },
            ],
            grouping: ["Customer.name"],
            formulas: [
                {
                    id: "f2",
                    label: "Formula 2",
                    expression: "[Invoice.amount]*1.2",
                    format: "number",
                    aggregation: "SUM",
                },
            ],
        };

        const { rows, warnings } = applyFormulasToRows(
            [
                {
                    id: "1-1",
                    "Customer.name": "Acme",
                    "Invoice.amount__SUM": 100,
                },
                {
                    id: "1-2",
                    "Customer.name": "Acme",
                    "Invoice.amount__SUM": 50,
                },
            ],
            config,
            { locale: "en-US", metadataTables }
        );

        expect(rows[0]["formula:f2"]).toBe(120);
        expect(rows[1]["formula:f2"]).toBe(60);
        expect(warnings).toEqual([]);
    });

    it("resolves [Invoice.amount] from aliased aggregated column keys", () => {
        const config: ReportConfig = {
            tables: ["Invoice", "Customer"],
            fields: [
                { table: "Customer", field: "name" },
                {
                    table: "Invoice",
                    field: "amount",
                    aggregation: "SUM",
                    alias: "Amount SUM",
                },
            ],
            grouping: ["Customer.name"],
            formulas: [
                {
                    id: "f2",
                    label: "Formula 2",
                    expression: "[Invoice.amount]*1.2",
                    format: "number",
                    aggregation: "SUM",
                },
            ],
        };

        const { rows, warnings } = applyFormulasToRows(
            [
                {
                    id: "1-1",
                    "Customer.name": "Acme",
                    "Amount SUM": 200,
                },
            ],
            config,
            { locale: "en-US", metadataTables }
        );

        expect(rows[0]["formula:f2"]).toBe(240);
        expect(warnings).toEqual([]);
    });

    it("skips null canonical key and uses Invoice.amount__SUM fallback", () => {
        const config: ReportConfig = {
            tables: ["Invoice"],
            fields: [
                {
                    table: "Invoice",
                    field: "amount",
                    aggregation: "SUM",
                },
            ],
            formulas: [
                {
                    id: "f2",
                    label: "Formula 2",
                    expression: "[Invoice.amount]*1.2",
                    format: "number",
                },
            ],
        };

        const { rows, warnings } = applyFormulasToRows(
            [
                {
                    id: 1,
                    "Invoice.amount": null,
                    "Invoice.amount__SUM": 80,
                },
            ],
            config,
            { locale: "en-US", metadataTables }
        );

        expect(rows[0]["formula:f2"]).toBe(96);
        expect(warnings).toEqual([]);
    });

    it("formats currency formulas using __currency_ from the amount operand, not row.currency", () => {
        const config: ReportConfig = {
            tables: ["Invoice", "Customer"],
            fields: [
                { table: "Invoice", field: "amount" },
                { table: "Customer", field: "cost_percent" },
            ],
            formulas: [
                {
                    id: "prem",
                    label: "Prem Cost",
                    expression: "[Invoice.amount]*[Customer.cost_percent]",
                    format: "currency",
                    currencySource: "Invoice.amount",
                },
            ],
        };

        const { rows } = applyFormulasToRows(
            [
                {
                    id: 1,
                    "Invoice.amount": 1000,
                    "Customer.cost_percent": 0.02,
                    currency: "GBP",
                    "__currency_Invoice.amount": "ILS",
                },
            ],
            config,
            {
                locale: "en-US",
                accountCurrency: "ILS",
                metadataTables: [
                    {
                        name: "Invoice",
                        fields: [{ name: "amount", type: "amount" }],
                    },
                    {
                        name: "Customer",
                        fields: [{ name: "cost_percent", type: "percentage" }],
                    },
                ],
            }
        );

        // 1000 * (0.02 / 100) = 0.2 — currency from amount operand, not row.currency
        expect(rows[0]["formula:prem"]).toBe(0.2);
        expect(rows[0]["___formatted_formula:prem"]).toContain("ILS");
        expect(rows[0]["___formatted_formula:prem"]).not.toContain("GBP");
    });

    it("does not re-count row-level null formula values during group aggregation", () => {
        const formulas = [
            {
                id: "f2",
                label: "Formula 2",
                expression: "[Invoice.amount]*1.2",
                format: "number" as const,
                aggregation: "SUM" as const,
            },
        ];

        const { warnings } = aggregateFormulaColumnsInGroupedRows(
            [
                { id: 1, "formula:f2": null },
                { id: 2, "formula:f2": null },
                { id: 3, "formula:f2": 12 },
            ],
            formulas,
            { locale: "en-US", sampleRow: { id: 3, "formula:f2": 12 } }
        );

        expect(warnings).toEqual([]);
    });

    it("normalizes locale decimal constants and rejects prohibited tokens", () => {
        expect(normalizeFormulaExpression("1,5+[Invoice.amount]", ",")).toBe(
            "1.5+[Invoice.amount]"
        );
        expect(() => parseFormulaExpression("eval(1)")).toThrow(
            /prohibited/i
        );
    });

    it("soft-extracts registration_fee_percent from CustomerPolicy when present", () => {
        expect(
            extractCustomerPolicyReportField(
                {
                    CustomerPolicy: [
                        {
                            is_active: true,
                            registration_fee_percent: 2.5,
                        },
                    ],
                },
                "registration_fee_percent"
            )
        ).toBe(2.5);

        expect(
            extractCustomerPolicyReportField(
                {
                    CustomerPolicy: [{ is_active: true }],
                },
                "registration_fee_percent"
            )
        ).toBeNull();
    });
});

describe("report formula chaining (formula→formula)", () => {
    const metadataTables = [
        {
            name: "Invoice",
            fields: [{ name: "amount", type: "amount" }],
        },
        {
            name: "Customer",
            fields: [
                { name: "cost_percent", type: "number" },
                { name: "registration_fee_percent", type: "number" },
            ],
        },
        {
            name: "Payment",
            fields: [{ name: "amount", type: "amount" }],
        },
    ];

    it("evaluates nested formulas from row-level raw values in topological order", () => {
        const config: ReportConfig = {
            tables: ["Invoice", "Customer"],
            fields: [
                { table: "Invoice", field: "amount" },
                { table: "Customer", field: "cost_percent" },
            ],
            // Total listed before Premium — topo order must still evaluate Premium first.
            formulas: [
                {
                    id: "total",
                    label: "Total",
                    expression: "[formula:premium]",
                    format: "number",
                },
                {
                    id: "premium",
                    label: "Premium",
                    expression: "[Invoice.amount]*[Customer.cost_percent]",
                    format: "number",
                },
            ],
        };

        const { rows, warnings } = applyFormulasToRows(
            [
                {
                    id: 1,
                    "Invoice.amount": 2000,
                    "Customer.cost_percent": 3,
                },
            ],
            config,
            { locale: "en-US", metadataTables }
        );

        expect(rows[0]["formula:premium"]).toBe(60);
        expect(rows[0]["formula:total"]).toBe(60);
        expect(warnings).toEqual([]);
    });

    it("aggregates each formula from its own row values when grouped", () => {
        const formulas = [
            {
                id: "premium",
                label: "Premium",
                expression: "[Invoice.amount]*[Customer.cost_percent]",
                format: "number" as const,
                aggregation: "SUM" as const,
            },
            {
                id: "total",
                label: "Total",
                expression: "[formula:premium]*2",
                format: "number" as const,
                aggregation: "SUM" as const,
            },
        ];

        const { rows } = applyFormulasToRows(
            [
                {
                    id: 1,
                    "Invoice.amount": 100,
                    "Customer.cost_percent": 10,
                },
                {
                    id: 2,
                    "Invoice.amount": 200,
                    "Customer.cost_percent": 10,
                },
            ],
            {
                tables: ["Invoice", "Customer"],
                fields: [
                    { table: "Invoice", field: "amount" },
                    { table: "Customer", field: "cost_percent" },
                ],
                formulas,
            },
            { locale: "en-US", metadataTables }
        );

        // Row premiums: 10 and 20; totals: 20 and 40
        expect(rows[0]["formula:premium"]).toBe(10);
        expect(rows[0]["formula:total"]).toBe(20);
        expect(rows[1]["formula:premium"]).toBe(20);
        expect(rows[1]["formula:total"]).toBe(40);

        const { groupedValues } = aggregateFormulaColumnsInGroupedRows(
            rows,
            formulas,
            { sampleRow: rows[0], locale: "en-US" }
        );

        expect(groupedValues["formula:premium"]).toBe(30);
        expect(groupedValues["formula:total"]).toBe(60);
    });

    it("warns only on the upstream formula when a dependent blanks from null", () => {
        const config: ReportConfig = {
            tables: ["Invoice"],
            fields: [{ table: "Invoice", field: "amount" }],
            formulas: [
                {
                    id: "premium",
                    label: "Premium",
                    expression: "[Invoice.amount]/0",
                    format: "number",
                },
                {
                    id: "total",
                    label: "Total",
                    expression: "[formula:premium]+1",
                    format: "number",
                },
            ],
        };

        const { rows, warnings } = applyFormulasToRows(
            [{ id: 1, "Invoice.amount": 10 }],
            config,
            { locale: "en-US", metadataTables }
        );

        expect(rows[0]["formula:premium"]).toBeNull();
        expect(rows[0]["formula:total"]).toBeNull();
        expect(warnings).toEqual([
            { formulaId: "premium", label: "Premium", invalidCount: 1 },
        ]);
    });

    it("inherits currencySource for compose-only Currency formulas that agree", () => {
        const config: ReportConfig = {
            tables: ["Invoice", "Customer"],
            fields: [
                { table: "Invoice", field: "amount" },
                { table: "Customer", field: "cost_percent" },
            ],
            formulas: [
                {
                    id: "premium",
                    label: "Premium",
                    expression: "[Invoice.amount]*[Customer.cost_percent]",
                    format: "currency",
                },
                {
                    id: "fee",
                    label: "Fee",
                    expression: "[Invoice.amount]*0.01",
                    format: "currency",
                },
                {
                    id: "total",
                    label: "Total",
                    expression: "[formula:premium]+[formula:fee]",
                    format: "currency",
                },
            ],
        };

        const { rows, warnings } = applyFormulasToRows(
            [
                {
                    id: 1,
                    "Invoice.amount": 1000,
                    "Customer.cost_percent": 5,
                    __currency_Invoice_amount: "EUR",
                    "__currency_Invoice.amount": "EUR",
                },
            ],
            config,
            { locale: "en-US", accountCurrency: "USD", metadataTables }
        );

        expect(rows[0]["formula:premium"]).toBe(50);
        expect(rows[0]["formula:fee"]).toBe(10);
        expect(rows[0]["formula:total"]).toBe(60);
        expect(String(rows[0]["___formatted_formula:total"])).toMatch(/€|EUR/);
        expect(warnings).toEqual([]);
    });
});
