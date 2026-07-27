import { describe, expect, it } from "vitest";

import { ReportQueryBuilder } from "@/server/services/ReportQueryBuilder";
import { ReportConfig } from "@/server/services/ReportService";

describe("ReportQueryBuilder policy filters", () => {
    const builder = new ReportQueryBuilder();

    it("applies Invoice.InsurancePolicy.policy_number via Invoice.some on Customer reports", () => {
        const config: ReportConfig = {
            tables: ["Customer", "Invoice"],
            fields: [
                { table: "Customer", field: "id" },
                { table: "Invoice", field: "invoice_number" },
            ],
            filters: [
                {
                    table: "Invoice",
                    field: "InsurancePolicy.policy_number",
                    operator: "in",
                    value: ["POL-123"],
                },
            ],
        };

        const { where } = builder.buildQuery(config, 1);

        expect(where.Invoice).toEqual({
            some: {
                InsurancePolicy: {
                    policy_number: { in: ["POL-123"] },
                },
            },
        });
    });

    it("applies Customer.InsurancePolicy.policy_number via CustomerPolicy.some on Customer reports", () => {
        const config: ReportConfig = {
            tables: ["Customer"],
            fields: [{ table: "Customer", field: "id" }],
            filters: [
                {
                    table: "Customer",
                    field: "InsurancePolicy.policy_number",
                    operator: "equals",
                    value: "POL-ABC",
                },
            ],
        };

        const { where } = builder.buildQuery(config, 1);

        expect(where.CustomerPolicy).toEqual({
            some: {
                InsurancePolicy: {
                    policy_number: { equals: "POL-ABC" },
                },
            },
        });
    });

    it("applies Invoice.InsurancePolicy.policy_number directly on Invoice reports", () => {
        const config: ReportConfig = {
            tables: ["Invoice"],
            fields: [{ table: "Invoice", field: "invoice_number" }],
            filters: [
                {
                    table: "Invoice",
                    field: "InsurancePolicy.policy_number",
                    operator: "equals",
                    value: "POL-XYZ",
                },
            ],
        };

        const { where } = builder.buildQuery(config, 1);

        expect(where.InsurancePolicy).toEqual({
            policy_number: { equals: "POL-XYZ" },
        });
    });

    it("merges multiple cross-table dotted filters on the same relation", () => {
        const config: ReportConfig = {
            tables: ["Customer", "Invoice"],
            fields: [
                { table: "Customer", field: "id" },
                { table: "Invoice", field: "invoice_number" },
            ],
            filters: [
                {
                    table: "Invoice",
                    field: "InsurancePolicy.policy_number",
                    operator: "equals",
                    value: "POL-1",
                },
                {
                    table: "Invoice",
                    field: "status",
                    operator: "equals",
                    value: "Open",
                },
            ],
        };

        const { where } = builder.buildQuery(config, 1);

        expect(where.Invoice).toEqual({
            some: {
                InsurancePolicy: {
                    policy_number: { equals: "POL-1" },
                },
                status: { equals: "Open" },
            },
        });
    });

    it("applies is_not_empty on Invoice.InsurancePolicy.policy_number without invalid null equals", () => {
        const config: ReportConfig = {
            tables: ["Customer", "Invoice"],
            fields: [
                { table: "Customer", field: "id" },
                { table: "Invoice", field: "invoice_number" },
            ],
            filters: [
                {
                    table: "Invoice",
                    field: "InsurancePolicy.policy_number",
                    operator: "is_not_empty",
                    value: null,
                },
            ],
        };

        const { where } = builder.buildQuery(config, 1);

        expect(where.Invoice).toEqual({
            some: {
                InsurancePolicy: {
                    policy_number: { not: { equals: "" } },
                },
            },
        });
    });
});

describe("ReportQueryBuilder cross-table dotted filters", () => {
    const builder = new ReportQueryBuilder();

    it("applies Customer.State.name on Invoice-primary reports", () => {
        const config: ReportConfig = {
            tables: ["Invoice", "Customer"],
            fields: [
                { table: "Invoice", field: "invoice_number" },
                { table: "Customer", field: "id" },
            ],
            filters: [
                {
                    table: "Customer",
                    field: "State.name",
                    operator: "equals",
                    value: "California",
                },
            ],
        };

        const { where } = builder.buildQuery(config, 1);

        expect(where.Customer).toEqual({
            State: {
                name: { equals: "California" },
            },
        });
    });

    it("applies Customer.Country.name on Invoice-primary reports", () => {
        const config: ReportConfig = {
            tables: ["Invoice", "Customer"],
            fields: [
                { table: "Invoice", field: "invoice_number" },
                { table: "Customer", field: "id" },
            ],
            filters: [
                {
                    table: "Customer",
                    field: "Country.name",
                    operator: "in",
                    value: ["United States", "Canada"],
                },
            ],
        };

        const { where } = builder.buildQuery(config, 1);

        expect(where.Customer).toEqual({
            Country: {
                name: { in: ["United States", "Canada"] },
            },
        });
    });

    it("applies Customer.BusinessUnit.name equals on Customer-primary reports", () => {
        const config: ReportConfig = {
            tables: ["Customer"],
            fields: [{ table: "Customer", field: "name" }],
            filters: [
                {
                    table: "Customer",
                    field: "BusinessUnit.name",
                    operator: "equals",
                    value: "North Division",
                },
            ],
        };

        const { where } = builder.buildQuery(config, 1);

        expect(where.BusinessUnit).toEqual({
            name: { equals: "North Division" },
        });
    });

    it("applies Customer.BusinessUnit.name in on Customer-primary reports", () => {
        const config: ReportConfig = {
            tables: ["Customer"],
            fields: [{ table: "Customer", field: "name" }],
            filters: [
                {
                    table: "Customer",
                    field: "BusinessUnit.name",
                    operator: "in",
                    value: ["North Division", "South Division"],
                },
            ],
        };

        const { where } = builder.buildQuery(config, 1);

        expect(where.BusinessUnit).toEqual({
            name: { in: ["North Division", "South Division"] },
        });
    });

    it("combines BusinessUnit.name filter with another Customer filter", () => {
        const config: ReportConfig = {
            tables: ["Customer"],
            fields: [{ table: "Customer", field: "name" }],
            filters: [
                {
                    table: "Customer",
                    field: "BusinessUnit.name",
                    operator: "equals",
                    value: "North Division",
                },
                {
                    table: "Customer",
                    field: "collection_status",
                    operator: "equals",
                    value: "Active",
                },
            ],
        };

        const { where } = builder.buildQuery(config, 1);

        expect(where.BusinessUnit).toEqual({
            name: { equals: "North Division" },
        });
        expect(where.collection_status).toEqual({ equals: "Active" });
    });
});

describe("ReportQueryBuilder trend-cost filters", () => {
    const builder = new ReportQueryBuilder();

    it("applies Customer.total_daily_cost_change via CustomerPolicyTrend.some on Customer reports", () => {
        const config: ReportConfig = {
            tables: ["Customer"],
            fields: [
                { table: "Customer", field: "id" },
                { table: "Customer", field: "total_daily_cost_change" },
            ],
            filters: [
                {
                    table: "Customer",
                    field: "total_daily_cost_change",
                    operator: "greater_than",
                    value: 100,
                },
            ],
        };

        const { where, select } = builder.buildQuery(config, 1);

        expect(where.CustomerPolicyTrend).toEqual({
            some: {
                total_daily_cost: { gt: 100 },
            },
        });
        expect(select.CustomerPolicyTrend).toMatchObject({
            orderBy: { snapshot_date: "desc" },
            take: 1,
            select: { total_daily_cost: true },
        });
    });

    it("applies Customer.policy_cost_snapshot_date via snapshot_date column", () => {
        const config: ReportConfig = {
            tables: ["Customer"],
            fields: [{ table: "Customer", field: "id" }],
            filters: [
                {
                    table: "Customer",
                    field: "policy_cost_snapshot_date",
                    operator: "greater_than_or_equal",
                    value: "2026-06-01",
                },
            ],
        };

        const { where } = builder.buildQuery(config, 1);

        expect(where.CustomerPolicyTrend).toEqual({
            some: {
                snapshot_date: {
                    gte: new Date("2026-06-01T00:00:00.000Z"),
                },
            },
        });
    });

    it("applies Customer.total_daily_cost_change on Invoice-primary reports via Customer relation", () => {
        const config: ReportConfig = {
            tables: ["Invoice", "Customer"],
            fields: [
                { table: "Invoice", field: "invoice_number" },
                { table: "Customer", field: "total_daily_cost_change" },
            ],
            filters: [
                {
                    table: "Customer",
                    field: "total_daily_cost_change",
                    operator: "is_not_empty",
                    value: null,
                },
            ],
        };

        const { where } = builder.buildQuery(config, 1);

        expect(where.Customer).toEqual({
            CustomerPolicyTrend: {
                some: {
                    total_daily_cost: { not: null },
                },
            },
        });
    });
});

describe("ReportQueryBuilder BusinessUnit select", () => {
    const builder = new ReportQueryBuilder();

    it("includes BusinessUnit.name in Prisma select for Customer-primary reports", () => {
        const config: ReportConfig = {
            tables: ["Customer"],
            fields: [{ table: "Customer", field: "BusinessUnit.name" }],
        };

        const { select } = builder.buildQuery(config, 1);

        expect(select).toMatchObject({
            id: true,
            BusinessUnit: {
                select: {
                    name: true,
                },
            },
        });
    });
});
