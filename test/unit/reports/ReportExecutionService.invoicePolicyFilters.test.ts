import { describe, expect, it } from "vitest";

import { ReportExecutionService } from "@/server/services/ReportExecutionService";
import { Filter } from "@/server/services/ReportExecutionService.types";

describe("ReportExecutionService invoice policy in-memory filters", () => {
    const service = ReportExecutionService.getInstance() as any;

    const invoicePolicyFilter: Filter = {
        table: "Invoice",
        field: "InsurancePolicy.policy_number",
        operator: "equals",
        value: "POL-123",
    };

    it("matches invoice rows by nested InsurancePolicy.policy_number", () => {
        const matches = service.matchesFilter(
            {
                id: 1,
                policy_id: 10,
                InsurancePolicy: { policy_number: "POL-123" },
            },
            invoicePolicyFilter,
            "Invoice"
        );

        expect(matches).toBe(true);
    });

    it("rejects invoice rows with a different policy number", () => {
        const matches = service.matchesFilter(
            {
                id: 2,
                policy_id: 11,
                InsurancePolicy: { policy_number: "POL-999" },
            },
            invoicePolicyFilter,
            "Invoice"
        );

        expect(matches).toBe(false);
    });
});
