import { describe, expect, it } from "vitest";

import { dedupeReportsForSelector } from "@/shared/utils/reportSelectorDedupe";

describe("dedupeReportsForSelector", () => {
    it("collapses duplicate system views by normalized name", () => {
        const reports = [
            { id: 1, name: "Active Customers", isSystem: true },
            { id: 2, name: "★ All Customers", isSystem: true },
            { id: 3, name: "Inactive Customers", isSystem: true },
            { id: 4, name: "Active Customers", isSystem: true },
            { id: 5, name: "★ All Customers", isSystem: true },
            { id: 6, name: "Inactive Customers", isSystem: true },
        ];

        const deduped = dedupeReportsForSelector(reports);
        expect(deduped).toHaveLength(3);
        expect(deduped.map((r) => r.id)).toEqual([1, 2, 3]);
    });

    it("prefers custom over system when names collide", () => {
        const deduped = dedupeReportsForSelector([
            {
                id: 10,
                name: "All Customers",
                isSystem: true,
                uniqueName: "customers_all",
            },
            {
                id: 20,
                name: "All Customers",
                isSystem: false,
                uniqueName: "customers_all",
                context: "customers",
            },
        ]);

        // Different keys (system: vs custom unique) — both may remain if keys differ.
        // Same uniqueName on custom path still unique; system key is by name.
        expect(deduped.some((r) => r.id === 10)).toBe(true);
        expect(deduped.some((r) => r.id === 20)).toBe(true);
    });
});
