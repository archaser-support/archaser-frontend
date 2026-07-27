import { describe, expect, it } from "vitest";
import type { GridSortModel } from "@mui/x-data-grid";

/**
 * Mirrors ViewBasedDataGrid report_config.sorting → GridSortModel mapping.
 */
function reportConfigToSortModel(
    sorting: Array<{ field: string; direction?: string }> | undefined,
    fallback: GridSortModel[0]
): GridSortModel {
    if (Array.isArray(sorting) && sorting.length > 0 && sorting[0]?.field) {
        const direction = String(sorting[0].direction || "ASC").toLowerCase();
        return [
            {
                field: sorting[0].field,
                sort: direction === "desc" ? "desc" : "asc",
            },
        ];
    }
    return [fallback];
}

describe("dashboard report default sort from report_config", () => {
    const fallback = { field: "name", sort: "asc" as const };

    it("maps ASC sorting from report_config", () => {
        expect(
            reportConfigToSortModel(
                [{ field: "invoice_number", direction: "ASC" }],
                fallback
            )
        ).toEqual([{ field: "invoice_number", sort: "asc" }]);
    });

    it("maps DESC sorting from report_config", () => {
        expect(
            reportConfigToSortModel(
                [{ field: "days_overdue", direction: "DESC" }],
                fallback
            )
        ).toEqual([{ field: "days_overdue", sort: "desc" }]);
    });

    it("falls back to context defaultSort when sorting is empty", () => {
        expect(reportConfigToSortModel([], fallback)).toEqual([fallback]);
        expect(reportConfigToSortModel(undefined, fallback)).toEqual([
            fallback,
        ]);
    });
});
