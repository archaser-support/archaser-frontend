import { describe, it, expect } from "vitest";

import { REPORT_METADATA } from "@/server/services/reportMetadata";
import {
    DATE_FIELDS_BY_TABLE,
    DATE_ONLY_FIELDS_BY_TABLE,
    MODEL_NAME_MAP,
    ONE_TO_MANY_MAP,
    RELATION_MAP,
} from "@/server/services/ReportExecutionService.constants";
import { getVirtualFieldConfig } from "@/server/services/ReportExecutionService.virtualFields";
import { ReportQueryBuilder } from "@/server/services/ReportQueryBuilder";
import type { ReportConfig } from "@/server/services/ReportService";
import { expandDashboardPromiseActivityWhere } from "@/shared/dashboard/dashboardPromisePeriodMembership";

describe("CustomerCollectionPeriod report table foundation", () => {
    it("exposes CCP in report metadata with promise drill fields", () => {
        const table = REPORT_METADATA.tables.find(
            (t) => t.name === "CustomerCollectionPeriod"
        );
        expect(table).toBeDefined();
        const fieldNames = table!.fields.map((f) => f.name);
        expect(fieldNames).toEqual(
            expect.arrayContaining([
                "id",
                "customer_id",
                "period_start_date",
                "period_end_date",
                "promise_to_pay_date",
                "promise_to_pay_amount",
                "currency",
                "current_category",
                "created_at",
            ])
        );
        expect(MODEL_NAME_MAP.CustomerCollectionPeriod).toBe(
            "customerCollectionPeriod"
        );
    });

    it("registers CCP → Customer/Activity relations and Activity one-to-many", () => {
        expect(RELATION_MAP.CustomerCollectionPeriod).toEqual({
            Customer: "Customer",
            Activity: "Activity",
        });
        expect(ONE_TO_MANY_MAP.CustomerCollectionPeriod).toContain("Activity");
    });

    it("registers CCP date and date-only fields", () => {
        expect(DATE_FIELDS_BY_TABLE.CustomerCollectionPeriod).toEqual(
            expect.arrayContaining([
                "promise_to_pay_date",
                "period_start_date",
                "period_end_date",
                "created_at",
            ])
        );
        expect(DATE_ONLY_FIELDS_BY_TABLE.CustomerCollectionPeriod).toEqual(
            expect.arrayContaining([
                "promise_to_pay_date",
                "period_start_date",
                "period_end_date",
            ])
        );
    });

    it("resolves Customer.name virtual field for CCP primary rows", () => {
        const config = getVirtualFieldConfig(
            "CustomerCollectionPeriod",
            "Customer.name"
        );
        expect(config).toBeDefined();
        expect(
            config!.extractor({
                Customer: {
                    Company: { name: "Acme" },
                },
            })
        ).toBe("Acme");
    });
});

describe("ReportQueryBuilder CustomerCollectionPeriod scoping", () => {
    const builder = new ReportQueryBuilder();

    const baseConfig: ReportConfig = {
        tables: ["CustomerCollectionPeriod"],
        fields: [
            { table: "CustomerCollectionPeriod", field: "id" },
            { table: "CustomerCollectionPeriod", field: "promise_to_pay_amount" },
            { table: "Customer", field: "name" },
        ],
        filters: [],
        sorting: [],
        grouping: [],
    };

    it("scopes account_id through Customer (no account_id on CCP)", () => {
        const { where } = builder.buildQuery(baseConfig, 42);
        expect(where.account_id).toBeUndefined();
        expect(where.Customer).toEqual(
            expect.objectContaining({ account_id: 42 })
        );
    });

    it("merges BU and owner access into Customer like Dispute", () => {
        const { where } = builder.buildQuery(
            baseConfig,
            42,
            undefined,
            undefined,
            { business_unit_id: 7 },
            { OR: [{ owner_id: "u1" }, { owner_id: null }] }
        );

        expect(where.Customer).toEqual({
            AND: [
                expect.objectContaining({
                    account_id: 42,
                    business_unit_id: 7,
                }),
                { OR: [{ owner_id: "u1" }, { owner_id: null }] },
            ],
        });
    });

    it("merges Activity.some filters for promise membership fields", () => {
        const { where } = builder.buildQuery(
            baseConfig,
            42,
            [
                {
                    table: "CustomerCollectionPeriod",
                    field: "promise_to_pay_amount",
                    operator: "is_not_empty",
                    value: true,
                },
                {
                    table: "Activity",
                    field: "type",
                    operator: "equals",
                    value: "Promise_to_pay",
                },
                {
                    table: "Activity",
                    field: "status",
                    operator: "equals",
                    value: "COMPLETED",
                },
            ]
        );

        expect(where.promise_to_pay_amount).toBeDefined();
        expect(where.Activity?.some).toEqual(
            expect.objectContaining({
                type: expect.anything(),
                status: expect.anything(),
            })
        );
    });
});

describe("expandDashboardPromiseActivityWhere", () => {
    it("matches legacy promises-to-pay Activity.some membership", () => {
        const start = new Date("2026-07-01T00:00:00.000Z");
        const end = new Date("2026-07-12T23:59:59.999Z");
        expect(
            expandDashboardPromiseActivityWhere({
                start,
                end,
                agentIdsExclAudit: ["a1", "a2"],
            })
        ).toEqual({
            promise_to_pay_amount: { not: null },
            Activity: {
                some: {
                    created_by: { in: ["a1", "a2"] },
                    type: "Promise_to_pay",
                    status: "COMPLETED",
                    created_at: { gte: start, lte: end },
                },
            },
        });
    });
});
