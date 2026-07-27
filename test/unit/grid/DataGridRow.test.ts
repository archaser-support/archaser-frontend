import { describe, it, expect } from "vitest";

import { resolveDataGridCellValue } from "@/shared/layout-components/grid/components/DataGridRow";

describe("resolveDataGridCellValue", () => {
    it("reads flat aggregated keys from the row", () => {
        const row = {
            id: "group-acme",
            "Invoice.amount__SUM": 150,
        };

        const value = resolveDataGridCellValue(
            row,
            { field: "Invoice.amount__SUM" },
            0
        );

        expect(value).toBe(150);
    });

    it("uses column valueGetter when present", () => {
        const row = {
            id: "group-acme",
            "Invoice.amount__SUM": 150,
        };

        const value = resolveDataGridCellValue(
            row,
            {
                field: "Invoice.amount__SUM",
                valueGetter: (params) =>
                    params.row["Invoice.amount__SUM"] as number,
            },
            0
        );

        expect(value).toBe(150);
    });

    it("returns row number for __rowNumber column", () => {
        const value = resolveDataGridCellValue(
            { id: "group-acme" },
            { field: "__rowNumber" },
            4
        );

        expect(value).toBe(5);
    });
});
