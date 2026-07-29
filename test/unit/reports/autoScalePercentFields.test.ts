import { describe, expect, it } from "vitest";

import {
    expressionHasRedundantAutoScalePercentDivision,
    isFormulaAutoScalePercentReference,
} from "@/shared/reportFormula/autoScalePercentFields";
import { validateFormulaDraft } from "@/shared/reportFormula/validateFormulaDraft";

describe("formula auto-scale percent fields", () => {
    it("recognizes only cost_percent and registration_fee_percent", () => {
        expect(
            isFormulaAutoScalePercentReference("Customer.cost_percent")
        ).toBe(true);
        expect(
            isFormulaAutoScalePercentReference(
                "Customer.registration_fee_percent"
            )
        ).toBe(true);
        expect(
            isFormulaAutoScalePercentReference("Customer.discount_percent")
        ).toBe(false);
        expect(isFormulaAutoScalePercentReference("Invoice.amount")).toBe(
            false
        );
    });

    it("detects redundant /100 after an auto-scaled rate field", () => {
        expect(
            expressionHasRedundantAutoScalePercentDivision(
                "[Invoice.amount]*[Customer.cost_percent]/100"
            )
        ).toBe(true);
        expect(
            expressionHasRedundantAutoScalePercentDivision(
                "[Invoice.amount]*[Customer.cost_percent]"
            )
        ).toBe(false);
        expect(
            expressionHasRedundantAutoScalePercentDivision(
                "[Invoice.amount]/100"
            )
        ).toBe(false);
    });

    it("returns a soft warning from validateFormulaDraft when /100 is redundant", () => {
        const result = validateFormulaDraft({
            label: "Premium",
            expression: "[Invoice.amount]*[Customer.cost_percent]/100",
            format: "number",
            aggregation: "",
            editingId: null,
            locale: "en",
            reportTableNames: ["Invoice", "Customer"],
            tablesMetadata: [
                {
                    name: "Invoice",
                    fields: [{ name: "amount", type: "number" }],
                },
                {
                    name: "Customer",
                    fields: [{ name: "cost_percent", type: "number" }],
                },
            ],
            existingFormulas: [],
            isGrouped: false,
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.warning?.messageKey).toBe(
                "formulas.redundant_percent_division_warning"
            );
        }
    });
});
