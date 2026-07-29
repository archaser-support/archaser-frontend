import { describe, expect, it } from "vitest";

import {
    buildEditTimeFormulaReference,
    expressionToEditTime,
    expressionToStorage,
    formulaLabelCollidesWithField,
} from "@/shared/reportFormula/editTimeExpression";
import { findFormulasDependingOnFormula } from "@/shared/reportFormula/formulaDependencies";
import { validateFormulaDraft } from "@/shared/reportFormula/validateFormulaDraft";
import type { ReportFormula } from "@/shared/reportFormula/types";

const TABLES_METADATA = [
    {
        name: "Invoice",
        fields: [{ name: "amount", type: "number" }],
    },
    {
        name: "Customer",
        fields: [{ name: "cost_percent", type: "number" }],
    },
];

const ALLOWED = new Set(["Invoice.amount", "Customer.cost_percent"]);

const premium: ReportFormula = {
    id: "premium",
    label: "Insurance Premium",
    expression: "[Invoice.amount]*[Customer.cost_percent]",
    format: "number",
};

const total: ReportFormula = {
    id: "total",
    label: "Total Cost",
    expression: "[formula:premium]+1",
    format: "number",
};

describe("edit-time formula expression conversion", () => {
    it("builds spaced edit-time formula tokens", () => {
        expect(buildEditTimeFormulaReference("Insurance Premium")).toBe(
            "[Insurance Premium]"
        );
    });

    it("converts storage formula ids to labels for editing", () => {
        expect(
            expressionToEditTime("[formula:premium]+[Invoice.amount]", [
                premium,
                total,
            ])
        ).toBe("[Insurance Premium]+[Invoice.amount]");
    });

    it("converts edit-time labels (including spaces) to formula ids on save", () => {
        expect(
            expressionToStorage(
                "[Insurance Premium] + 1",
                [premium],
                ALLOWED
            )
        ).toBe("[formula:premium] + 1");
    });

    it("lets allowed field references win over formula labels", () => {
        const collidingLabelFormula: ReportFormula = {
            id: "spoof",
            label: "Invoice.amount",
            expression: "[Customer.cost_percent]",
            format: "number",
        };
        expect(
            expressionToStorage(
                "[Invoice.amount]+1",
                [collidingLabelFormula],
                ALLOWED
            )
        ).toBe("[Invoice.amount]+1");
    });

    it("detects labels that collide with allowed field names", () => {
        expect(formulaLabelCollidesWithField("Invoice.amount", ALLOWED)).toBe(
            "Invoice.amount"
        );
        expect(
            formulaLabelCollidesWithField("invoice.amount", ALLOWED)
        ).toBe("Invoice.amount");
        expect(formulaLabelCollidesWithField("Premium", ALLOWED)).toBeNull();
    });
});

describe("validateFormulaDraft edit-time chaining", () => {
    it("accepts spaced formula labels and persists [formula:<id>]", () => {
        const result = validateFormulaDraft({
            label: "Total Cost",
            expression: "[Insurance Premium]+1",
            format: "number",
            aggregation: "",
            editingId: null,
            locale: "en",
            reportTableNames: ["Invoice", "Customer"],
            tablesMetadata: TABLES_METADATA,
            existingFormulas: [premium],
            isGrouped: false,
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.formula.expression).toBe("[formula:premium]+1");
        }
    });

    it("rejects a formula label that matches an allowed field name", () => {
        const result = validateFormulaDraft({
            label: "Invoice.amount",
            expression: "[Customer.cost_percent]",
            format: "number",
            aggregation: "",
            editingId: null,
            locale: "en",
            reportTableNames: ["Invoice", "Customer"],
            tablesMetadata: TABLES_METADATA,
            existingFormulas: [],
            isGrouped: false,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.errorCode).toBe("label_collides_with_field");
        }
    });
});

describe("formula delete dependency lookup", () => {
    it("names formulas that depend on the target", () => {
        const dependents = findFormulasDependingOnFormula(
            [premium, total],
            "premium"
        );
        expect(dependents.map((f) => f.label)).toEqual(["Total Cost"]);
    });

    it("returns empty when nothing depends on the formula", () => {
        expect(
            findFormulasDependingOnFormula([premium, total], "total")
        ).toEqual([]);
    });
});
