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

describe("ReportExecutionService customer policy fields on Invoice reports", () => {
    const service = ReportExecutionService.getInstance() as any;

    it("resolves Customer.InsurancePolicy.policy_number from joined CustomerPolicy", async () => {
        const config: ReportConfig = {
            tables: ["Invoice", "Customer"],
            fields: [
                { table: "Invoice", field: "invoice_number" },
                {
                    table: "Customer",
                    field: "InsurancePolicy.policy_number",
                },
            ],
        };

        const formatted = await service.formatSingleRow(
            {
                id: 101,
                invoice_number: "INV-1",
                customer_id: 55,
                policy_id: 7,
                InsurancePolicy: {
                    policy_number: "POL-INVOICE",
                },
                Customer: {
                    id: 55,
                    CustomerPolicy: [
                        {
                            is_active: true,
                            insurance_policy_id: 99,
                            InsurancePolicy: {
                                policy_number: "POL-CURRENT",
                            },
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

        expect(formatted["Customer.InsurancePolicy.policy_number"]).toBe(
            "POL-INVOICE"
        );
    });

    it("resolves Customer.policy_id from active CustomerPolicy as policy number", async () => {
        const config: ReportConfig = {
            tables: ["Invoice", "Customer"],
            fields: [
                { table: "Customer", field: "policy_id" },
            ],
        };

        const formatted = await service.formatSingleRow(
            {
                id: 102,
                customer_id: 56,
                Customer: {
                    id: 56,
                    CustomerPolicy: [
                        {
                            is_active: true,
                            insurance_policy_id: 9,
                            InsurancePolicy: {
                                policy_number: "POL-999",
                            },
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

        expect(formatted["Customer.policy_id"]).toBe("POL-999");
    });

    it("executes and sorts by Customer.InsurancePolicy.policy_number in memory", async () => {
        const { prisma } = await import("@/lib/prisma");

        const mockReport = {
            id: 1,
            account_id: 1,
            name: "Test Report",
            report_config: {
                tables: ["Customer"],
                fields: [
                    { table: "Customer", field: "id" },
                    { table: "Customer", field: "InsurancePolicy.policy_number" },
                ],
            },
        };

        const mockCustomers = [
            {
                id: 1,
                CustomerPolicy: [
                    {
                        is_active: true,
                        insurance_policy_id: 10,
                        InsurancePolicy: {
                            policy_number: "POL-B",
                        },
                    },
                ],
            },
            {
                id: 2,
                CustomerPolicy: [
                    {
                        is_active: true,
                        insurance_policy_id: 11,
                        InsurancePolicy: {
                            policy_number: "POL-A",
                        },
                    },
                ],
            },
        ];

        (prisma.report.findUnique as any).mockResolvedValue(mockReport);
        (prisma.customer.findMany as any).mockResolvedValue(mockCustomers);
        (prisma.customer.count as any).mockResolvedValue(2);
        (prisma.account.findUnique as any).mockResolvedValue({ id: 1, currency: "USD", has_credit_insurance: true });

        const result = await ReportExecutionService.getInstance().executeReport({
            reportId: 1,
            accountId: 1,
            sortField: "Customer.InsurancePolicy.policy_number",
            sortDirection: "asc",
            page: 1,
            limit: 2,
            locale: "en-US",
            timezone: "UTC",
        });

        console.log("RESULT DATA:", JSON.stringify(result.data, null, 2));
        expect(result.data).toHaveLength(2);
        // POL-A (id: 2) should be first when sorted asc
        expect(result.data[0].id).toBe(2);
        expect(result.data[0]["Customer.InsurancePolicy.policy_number"]).toBe("POL-A");
        // POL-B (id: 1) should be second
        expect(result.data[1].id).toBe(1);
        expect(result.data[1]["Customer.InsurancePolicy.policy_number"]).toBe("POL-B");
    });

    it("resolves Customer policy-backed fields (like approved_limit) from historic CustomerPolicy matching Invoice.policy_id", async () => {
        const config: ReportConfig = {
            tables: ["Invoice", "Customer"],
            fields: [
                { table: "Invoice", field: "invoice_number" },
                {
                    table: "Customer",
                    field: "approved_limit",
                },
            ],
        };

        const formatted = await service.formatSingleRow(
            {
                id: 101,
                invoice_number: "INV-1",
                customer_id: 55,
                policy_id: 7,
                Customer: {
                    id: 55,
                    CustomerPolicy: [
                        {
                            is_active: true,
                            approved_limit: 5000,
                            insurance_policy_id: 99,
                        },
                        {
                            is_active: false,
                            approved_limit: 2000,
                            insurance_policy_id: 7,
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

        expect(formatted["Customer.approved_limit"]).toBe(2000);
    });

    it("formats Invoice.capacity_gap_amount using account currency, not customer currency", async () => {
        const config: ReportConfig = {
            tables: ["Invoice"],
            fields: [
                { table: "Invoice", field: "capacity_gap_amount" },
            ],
        };

        const formatted = await service.formatSingleRow(
            {
                id: 101,
                customer_currency: "EUR",
                limit_assessed_currency: "EUR",
                capacity_gap_amount: 1176,
            },
            config,
            "Invoice",
            0,
            null,
            null,
            undefined,
            "en-US",
            undefined,
            "ILS"
        );

        expect(formatted["Invoice.capacity_gap_amount"]).toBe(1176);
        expect(
            formatted["___formatted_Invoice.capacity_gap_amount"]
        ).toContain("ILS");
        expect(
            formatted["___formatted_Invoice.capacity_gap_amount"]
        ).not.toContain("EUR");
    });
});
