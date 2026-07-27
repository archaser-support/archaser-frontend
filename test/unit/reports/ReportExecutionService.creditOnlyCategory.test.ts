import { describe, expect, it } from "vitest";

import { ReportExecutionService } from "@/server/services/ReportExecutionService";
import { ReportConfig } from "@/server/services/ReportService";

describe("ReportExecutionService credit-only category display", () => {
    const service = ReportExecutionService.getInstance() as any;

    it("blanks category and automation-stuck metadata for credit-only accounts", async () => {
        const config: ReportConfig = {
            tables: ["Customer"],
            fields: [{ table: "Customer", field: "category" }],
        };

        const formatted = await service.formatSingleRow(
            {
                id: 42,
                automation_stuck_no_contacts: true,
                CustomerCollectionPeriod: [
                    {
                        current_category: "Automated",
                        last_automated_step: 2,
                    },
                ],
            },
            config,
            "Customer",
            0,
            null,
            null,
            undefined,
            undefined,
            undefined,
            "USD",
            true
        );

        expect(formatted["Customer.category"]).toBeNull();
        expect(formatted["__automation_stuck_Customer.category"]).toBe(false);
    });

    it("keeps category formatting for collection accounts", async () => {
        const config: ReportConfig = {
            tables: ["Customer"],
            fields: [{ table: "Customer", field: "category" }],
        };

        const formatted = await service.formatSingleRow(
            {
                id: 43,
                automation_stuck_no_contacts: true,
                CustomerCollectionPeriod: [
                    {
                        current_category: "Automated",
                        last_automated_step: 2,
                    },
                ],
            },
            config,
            "Customer",
            0,
            null,
            null,
            undefined,
            undefined,
            undefined,
            "USD",
            false
        );

        expect(formatted["Customer.category"]).toBe("Automated (2)");
        expect(formatted["__automation_stuck_Customer.category"]).toBe(true);
    });
});
