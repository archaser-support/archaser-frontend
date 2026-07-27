import { describe, expect, it, vi, beforeEach } from "vitest";

import { ReportExecutionService } from "@/server/services/ReportExecutionService";

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

describe("ReportExecutionService in-memory sort pagination", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("paginates small datasets correctly without double-paginating", async () => {
        const { prisma } = await import("@/lib/prisma");

        // Mock report config
        (prisma.report.findUnique as any).mockResolvedValue({
            id: 1,
            account_id: 1,
            name: "Test Report",
            report_config: {
                tables: ["Customer"],
                fields: [
                    { table: "Customer", field: "id" },
                    { table: "Customer", field: "name" }
                ],
            },
        });

        // Mock account config
        (prisma.account.findUnique as any).mockResolvedValue({
            id: 1,
            currency: "USD",
            has_credit_insurance: false,
        });

        // Mock total records count = 25
        (prisma.customer.count as any).mockResolvedValue(25);

        // Mock database records (25 customers)
        const mockCustomers = Array.from({ length: 25 }, (_, i) => ({
            id: i + 1,
            Company: { name: `Company ${String.fromCharCode(65 + (i % 26))}` },
            Person: null,
        }));
        (prisma.customer.findMany as any).mockResolvedValue(mockCustomers);

        const service = ReportExecutionService.getInstance();

        // Page 1: should return 20 records
        const resultPage1 = await service.executeReport({
            reportId: 1,
            accountId: 1,
            sortField: "name",
            sortDirection: "asc",
            page: 1,
            limit: 20,
            locale: "en-US",
            timezone: "UTC",
        });

        expect(resultPage1.totalRecords).toBe(25);
        expect(resultPage1.data).toHaveLength(20);

        // Page 2: should return 5 records (not 0 due to double-pagination)
        const resultPage2 = await service.executeReport({
            reportId: 1,
            accountId: 1,
            sortField: "name",
            sortDirection: "asc",
            page: 2,
            limit: 20,
            locale: "en-US",
            timezone: "UTC",
        });

        expect(resultPage2.totalRecords).toBe(25);
        expect(resultPage2.data).toHaveLength(5);
    });
});
