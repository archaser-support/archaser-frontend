import { describe, expect, it } from "vitest";

import { applyFormulasToRows } from "@/server/services/reportFormulaExecution";
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
                    expression: "[Invoice.amount]*[Customer.cost_percent]/100",
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
        expect(warnings).toEqual([
            {
                formulaId: "premium",
                label: "Insurance Premium",
                invalidCount: 1,
            },
        ]);
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
