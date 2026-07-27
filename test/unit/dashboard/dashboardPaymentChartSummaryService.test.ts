import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
    prisma: {
        invoicePayment: {
            findMany: vi.fn(),
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
import { getDashboardPaymentChartSummary } from "@/server/services/dashboardPaymentChartSummaryService";

describe("getDashboardPaymentChartSummary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns null without period", async () => {
        const result = await getDashboardPaymentChartSummary({
            type: "collected-mtd",
            accountId: 1,
        });
        expect(result).toBeNull();
    });

    it("sums payment amounts for collected-mtd", async () => {
        vi.mocked(prisma.invoicePayment.findMany).mockResolvedValue([
            { amount: 10 },
            { amount: 25 },
        ] as any);

        const result = await getDashboardPaymentChartSummary({
            type: "collected-mtd",
            period: "2026-07",
            accountId: 1,
        });

        expect(result).toEqual({ totalRecords: 2, totalAmount: 35 });
    });
});
