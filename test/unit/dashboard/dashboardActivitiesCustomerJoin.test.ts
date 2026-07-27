import { describe, it, expect } from "vitest";

import {
    DATE_FIELDS_BY_TABLE,
    RELATION_MAP,
} from "@/server/services/ReportExecutionService.constants";
import { LogService } from "@/server/services/LogService";
import { ReportQueryBuilder } from "@/server/services/ReportQueryBuilder";
import type { ReportConfig } from "@/server/services/ReportService";

describe("dashboard activities report Customer join", () => {
    it("maps Activity → Customer in RELATION_MAP", () => {
        expect(RELATION_MAP.Activity).toEqual({ Customer: "Customer" });
    });

    it("treats call_time as an Activity date field for formatting", () => {
        expect(DATE_FIELDS_BY_TABLE.Activity).toContain("call_time");
    });

    it("selects Customer.customer_number when Activity is primary", () => {
        const builder = new ReportQueryBuilder(LogService.getInstance());
        const config: ReportConfig = {
            tables: ["Activity"],
            fields: [
                { table: "Activity", field: "id" },
                { table: "Customer", field: "name" },
                { table: "Customer", field: "customer_number" },
                { table: "Activity", field: "call_time" },
                { table: "Activity", field: "call_direction" },
            ],
            filters: [],
            sorting: [],
            grouping: [],
        };

        const { select } = builder.buildQuery(config, 10117);

        expect(select?.Customer?.select?.customer_number).toBe(true);
        expect(select?.Customer?.select?.Company?.select?.name).toBe(true);
        expect(select?.actual_delivery_time).toBe(true);
        expect(select?.title_params).toBe(true);
    });
});
