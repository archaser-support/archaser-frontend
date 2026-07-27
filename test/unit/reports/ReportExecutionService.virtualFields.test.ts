import { describe, expect, it } from "vitest";

import { getVirtualFieldConfig } from "@/server/services/ReportExecutionService.virtualFields";

describe("ReportExecutionService virtual fields", () => {
    it("treats Customer.name as an in-memory sort field", () => {
        const config = getVirtualFieldConfig("Customer", "name");

        expect(config).toBeDefined();
        expect(config?.requiresInMemorySort).toBe(true);
        expect(config?.extractor).toBeTypeOf("function");
    });

    it("extracts Person or Company name for Customer.name sorting", () => {
        const config = getVirtualFieldConfig("Customer", "name");
        const extractor = config?.extractor;

        expect(
            extractor?.({
                Company: { name: "Acme Corp" },
                Person: { first_name: "Jane", last_name: "Doe" },
            })
        ).toBe("Acme Corp");

        expect(
            extractor?.({
                Company: null,
                Person: { first_name: "Jane", last_name: "Doe" },
            })
        ).toBe("Jane Doe");
    });
});
