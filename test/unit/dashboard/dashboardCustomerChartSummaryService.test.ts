import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
    prisma: {
        customer: {
            findMany: vi.fn(),
            count: vi.fn(),
        },
    },
}));

vi.mock("@/server/services/ReportQueryBuilder", () => ({
    ReportQueryBuilder: class {
        buildQuery() {
            return { where: { account_id: 1 } };
        }
    },
}));

import { prisma } from "@/lib/prisma";
import { getDashboardCustomerChartSummary } from "@/server/services/dashboardCustomerChartSummaryService";

describe("getDashboardCustomerChartSummary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns null for parent overdue", async () => {
        const result = await getDashboardCustomerChartSummary({
            type: "overdue-amount",
            viewMode: "parent",
            accountId: 1,
        });
        expect(result).toBeNull();
    });

    it("returns null for non-customer types", async () => {
        const result = await getDashboardCustomerChartSummary({
            type: "collected-mtd",
            accountId: 1,
        });
        expect(result).toBeNull();
    });

    it("sums outstanding for overdue child", async () => {
        vi.mocked(prisma.customer.findMany).mockResolvedValue([
            {
                CustomerCollectionPeriod: [
                    { total_outstanding_amount: 100 },
                ],
            },
            {
                CustomerCollectionPeriod: [
                    { total_outstanding_amount: 50 },
                ],
            },
        ] as any);

        const result = await getDashboardCustomerChartSummary({
            type: "overdue-customers",
            viewMode: "child",
            accountId: 1,
        });

        expect(result).toEqual({ totalRecords: 2, totalAmount: 150 });
    });

    it("counts active-customers without amount", async () => {
        vi.mocked(prisma.customer.count).mockResolvedValue(4);

        const result = await getDashboardCustomerChartSummary({
            type: "active-customers",
            period: "2026-07",
            accountId: 1,
            now: new Date(2026, 6, 12),
        });

        expect(result).toEqual({ totalRecords: 4, totalAmount: 0 });
        expect(prisma.customer.count).toHaveBeenCalled();
    });
});
