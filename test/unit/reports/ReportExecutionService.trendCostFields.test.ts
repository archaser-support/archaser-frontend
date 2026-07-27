import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { ReportExecutionService } from "@/server/services/ReportExecutionService";
import { ReportConfig } from "@/server/services/ReportService";

vi.mock("@/lib/prisma", () => {
    const mockAccount = {
        findUnique: vi.fn(),
    };
    return {
        prisma: {
            report: {
                findUnique: vi.fn(),
            },
            customer: {
                findMany: vi.fn(),
                count: vi.fn(),
            },
            account: mockAccount,
            Account: mockAccount,
        },
    };
});

describe("ReportExecutionService trend-cost change fields", () => {
    const service = ReportExecutionService.getInstance() as any;

    it("resolves Customer.total_daily_cost_change from joined Customer latest trend row", async () => {
        const config: ReportConfig = {
            tables: ["Invoice", "Customer"],
            fields: [
                { table: "Invoice", field: "invoice_number" },
                { table: "Customer", field: "total_daily_cost_change" },
                { table: "Customer", field: "policy_cost_currency" },
            ],
        };

        const formatted = await service.formatSingleRow(
            {
                id: 101,
                invoice_number: "INV-1",
                customer_id: 55,
                Customer: {
                    id: 55,
                    CustomerPolicyTrend: [
                        {
                            snapshot_date: new Date("2026-06-01"),
                            total_daily_cost: new Prisma.Decimal("50"),
                            policy_cost_currency: "USD",
                        },
                        {
                            snapshot_date: new Date("2026-06-28"),
                            total_daily_cost: new Prisma.Decimal("250.75"),
                            policy_cost_currency: "EUR",
                        },
                    ],
                },
            },
            config,
            "Invoice",
            0,
            null,
            null
        );

        expect(formatted["Customer.total_daily_cost_change"]).toBe(250.75);
        expect(formatted["Customer.policy_cost_currency"]).toBe("EUR");
    });

    it("formats cost_calculation_method with human-readable label", async () => {
        const config: ReportConfig = {
            tables: ["Customer"],
            fields: [{ table: "Customer", field: "cost_calculation_method" }],
        };

        const formatted = await service.formatSingleRow(
            {
                id: 1,
                CustomerPolicyTrend: [
                    {
                        snapshot_date: new Date("2026-06-28"),
                        cost_calculation_method: "ActualSales",
                    },
                ],
            },
            config,
            "Customer",
            0,
            null,
            null
        );

        expect(formatted["Customer.cost_calculation_method"]).toBe("ActualSales");
        expect(
            formatted["___formatted_Customer.cost_calculation_method"]
        ).toBe("Actual Sales");
    });

    it("exports raw amount and currency without combined FX formatting", async () => {
        const config: ReportConfig = {
            tables: ["Customer"],
            fields: [
                { table: "Customer", field: "total_daily_cost_change" },
                { table: "Customer", field: "policy_cost_currency" },
            ],
        };

        const formatted = await service.formatSingleRow(
            {
                id: 1,
                CustomerPolicyTrend: [
                    {
                        snapshot_date: new Date("2026-06-28"),
                        total_daily_cost: new Prisma.Decimal("123.45"),
                        policy_cost_currency: "EUR",
                    },
                ],
            },
            config,
            "Customer",
            0,
            null,
            null,
            undefined,
            "en-US",
            undefined,
            "USD"
        );

        expect(formatted["Customer.total_daily_cost_change"]).toBe(123.45);
        expect(formatted["Customer.policy_cost_currency"]).toBe("EUR");
        expect(
            formatted["___formatted_Customer.total_daily_cost_change"]
        ).toBeUndefined();
    });

    it("executes Customer report filtered and sorted by total_daily_cost_change", async () => {
        const { prisma } = await import("@/lib/prisma");

        const mockReport = {
            id: 1,
            account_id: 1,
            name: "Trend cost change report",
            report_config: {
                tables: ["Customer"],
                fields: [
                    { table: "Customer", field: "id" },
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
            },
        };

        const mockCustomers = [
            {
                id: 1,
                CustomerPolicyTrend: [
                    {
                        snapshot_date: new Date("2026-06-28"),
                        total_daily_cost: new Prisma.Decimal("300"),
                    },
                    {
                        snapshot_date: new Date("2026-06-01"),
                        total_daily_cost: new Prisma.Decimal("999"),
                    },
                ],
            },
            {
                id: 2,
                CustomerPolicyTrend: [
                    {
                        snapshot_date: new Date("2026-06-28"),
                        total_daily_cost: new Prisma.Decimal("500"),
                    },
                ],
            },
            {
                id: 3,
                CustomerPolicyTrend: [
                    {
                        snapshot_date: new Date("2026-06-28"),
                        total_daily_cost: null,
                    },
                ],
            },
        ];

        (prisma.report.findUnique as any).mockResolvedValue(mockReport);
        (prisma.customer.findMany as any).mockResolvedValue(mockCustomers);
        (prisma.customer.count as any).mockResolvedValue(3);
        (prisma.account.findUnique as any).mockResolvedValue({
            id: 1,
            currency: "USD",
            has_credit_insurance: true,
        });

        const result = await ReportExecutionService.getInstance().executeReport({
            reportId: 1,
            accountId: 1,
            sortField: "Customer.total_daily_cost_change",
            sortDirection: "desc",
            page: 1,
            limit: 10,
            locale: "en-US",
            timezone: "UTC",
        });

        expect(result.data).toHaveLength(2);
        expect(result.data[0].id).toBe(2);
        expect(result.data[0]["Customer.total_daily_cost_change"]).toBe(500);
        expect(result.data[1].id).toBe(1);
        expect(result.data[1]["Customer.total_daily_cost_change"]).toBe(300);
    });

    it("fails saved report execution when credit insurance is disabled and config references trend cost change", async () => {
        const { prisma } = await import("@/lib/prisma");

        (prisma.report.findUnique as any).mockResolvedValue({
            id: 2,
            account_id: 1,
            name: "Disabled product report",
            report_config: {
                tables: ["Customer"],
                fields: [{ table: "Customer", field: "total_daily_cost_change" }],
            },
        });
        (prisma.account.findUnique as any).mockResolvedValue({
            id: 1,
            currency: "USD",
            has_credit_insurance: false,
        });

        await expect(
            ReportExecutionService.getInstance().executeReport({
                reportId: 2,
                accountId: 1,
                page: 1,
                limit: 10,
            })
        ).rejects.toThrow(
            "Credit insurance is not enabled for this account; this report cannot be run."
        );
    });
});
