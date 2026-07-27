import { describe, it, expect } from "vitest";

import { getUserRelationNameForReportTable } from "@/server/services/ReportExecutionService.constants";

describe("getUserRelationNameForReportTable", () => {
    it("maps Dispute report table to CustomerDispute User relations", () => {
        expect(
            getUserRelationNameForReportTable("Dispute", "created_by")
        ).toBe("User_CustomerDispute_created_byToUser");
        expect(
            getUserRelationNameForReportTable("Dispute", "modified_by")
        ).toBe("User_CustomerDispute_modified_byToUser");
    });

    it("keeps Activity / Customer naming as User_{Table}_{field}ToUser", () => {
        expect(
            getUserRelationNameForReportTable("Activity", "created_by")
        ).toBe("User_Activity_created_byToUser");
        expect(
            getUserRelationNameForReportTable("Customer", "modified_by")
        ).toBe("User_Customer_modified_byToUser");
    });
});
