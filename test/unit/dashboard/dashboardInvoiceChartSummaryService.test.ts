import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
    prisma: {
        invoice: {
            findMany: vi.fn(),
        },
    },
}));

vi.mock("@/server/services/ReportQueryBuilder", () => ({
    ReportQueryBuilder: class {
        buildQuery() {
            return { where: { account_id: 1 }, select: { id: true } };
        }
    },
}));

import { prisma } from "@/lib/prisma";
import { getDashboardInvoiceChartSummary } from "@/server/services/dashboardInvoiceChartSummaryService";

describe("getDashboardInvoiceChartSummary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns null for non-invoice chart types", async () => {
        const result = await getDashboardInvoiceChartSummary({
            type: "collected-mtd",
            accountId: 1,
        });
        expect(result).toBeNull();
        expect(prisma.invoice.findMany).not.toHaveBeenCalled();
    });

    it("returns null for maturity overview without daysRange", async () => {
        const result = await getDashboardInvoiceChartSummary({
            type: "receivables-maturity-schedule",
            accountId: 1,
        });
        expect(result).toBeNull();
    });

    it("returns null for maturity parent viewMode", async () => {
        const result = await getDashboardInvoiceChartSummary({
            type: "receivables-maturity-schedule",
            daysRange: "0-7 days",
            viewMode: "parent",
            accountId: 1,
        });
        expect(result).toBeNull();
    });

    it("aggregates overdue amount using invoice.amount", async () => {
        vi.mocked(prisma.invoice.findMany).mockResolvedValue([
            {
                amount: 100,
                total_paid: 10,
                outstanding_debt: 90,
                customer_outstanding_debt: 90,
            },
            {
                amount: 50,
                total_paid: 0,
                outstanding_debt: 50,
                customer_outstanding_debt: 50,
            },
        ] as any);

        const result = await getDashboardInvoiceChartSummary({
            type: "overdue-invoices",
            accountId: 1,
            now: new Date(2026, 6, 12),
        });

        expect(result).toEqual({
            totalRecords: 2,
            totalAmount: 150,
        });
    });

    it("aggregates aging using amount minus total_paid", async () => {
        vi.mocked(prisma.invoice.findMany).mockResolvedValue([
            {
                amount: 100,
                total_paid: 40,
                outstanding_debt: 60,
                customer_outstanding_debt: 60,
            },
        ] as any);

        const result = await getDashboardInvoiceChartSummary({
            type: "aging-portfolio",
            daysRange: "8_30",
            accountId: 1,
            now: new Date(2026, 6, 12),
        });

        expect(result).toEqual({
            totalRecords: 1,
            totalAmount: 60,
        });
    });
});
