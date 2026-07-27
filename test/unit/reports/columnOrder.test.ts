import { describe, expect, it } from "vitest";

import {
    buildColumnListItems,
    insertKeyIntoColumnOrder,
    reorderColumnOrder,
    syncFieldsOrderFromColumnOrder,
} from "@/shared/reportFormula/columnOrder";
import type { ReportFormula } from "@/shared/reportFormula/types";

describe("columnOrder list helpers", () => {
    const fields = [
        { table: "Customer", field: "name" },
        { table: "Invoice", field: "amount", aggregation: "SUM" as const },
    ];

    const formulas: ReportFormula[] = [
        {
            id: "f1",
            label: "Premium",
            expression: "[Invoice.amount]/100",
            format: "number",
        },
    ];

    it("buildColumnListItems interleaves fields and formulas from columnOrder", () => {
        const items = buildColumnListItems(fields, formulas, [
            "Customer.name",
            "formula:f1",
            "Invoice.amount__SUM",
        ]);

        expect(items).toHaveLength(3);
        expect(items[0]).toMatchObject({
            kind: "field",
            outputKey: "Customer.name",
        });
        expect(items[1]).toMatchObject({
            kind: "formula",
            outputKey: "formula:f1",
            formula: formulas[0],
        });
        expect(items[2]).toMatchObject({
            kind: "field",
            outputKey: "Invoice.amount__SUM",
        });
    });

    it("buildColumnListItems defaults to fields then formulas", () => {
        const items = buildColumnListItems(fields, formulas);
        expect(items.map((item) => item.outputKey)).toEqual([
            "Customer.name",
            "Invoice.amount__SUM",
            "formula:f1",
        ]);
    });

    it("reorderColumnOrder moves keys without losing entries", () => {
        const order = ["a", "b", "c", "formula:f1"];
        expect(reorderColumnOrder(order, 0, 2)).toEqual([
            "b",
            "a",
            "c",
            "formula:f1",
        ]);
    });

    it("insertKeyIntoColumnOrder inserts at index", () => {
        expect(
            insertKeyIntoColumnOrder(["a", "c"], "b", 1)
        ).toEqual(["a", "b", "c"]);
    });

    it("syncFieldsOrderFromColumnOrder reorders fields to match columnOrder", () => {
        const synced = syncFieldsOrderFromColumnOrder(fields, [
            "Invoice.amount__SUM",
            "Customer.name",
        ]);
        expect(synced.map((field) => `${field.table}.${field.field}`)).toEqual([
            "Invoice.amount",
            "Customer.name",
        ]);
    });
});
