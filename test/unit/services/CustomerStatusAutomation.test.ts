import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock } from "../../../test/mocks/prisma";
import { CustomerService } from "../../server/services/CustomerService";
import { CustomerAggregationService } from "../../server/services/CustomerAggregationService";

// Mock Prisma
vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    const mock = createPrismaMock();
    return {
        prisma: mock,
        prismaWeb: () => mock,
        prismaJobs: () => mock,
        prismaCron: () => mock,
    };
});

// Mock CustomerAggregationService
vi.mock("@/server/services/CustomerAggregationService", () => {
    return {
        CustomerAggregationService: {
            getInstance: vi.fn().mockReturnValue({
                recalculateParentsForChildren: vi.fn().mockResolvedValue({ skippedParents: 0, uniqueParents: 0 }),
            }),
        },
    };
});

// Mock LogService
vi.mock("@/server/services/LogService", () => {
    return {
        LogService: {
            getInstance: vi.fn().mockReturnValue({
                logMessage: vi.fn().mockResolvedValue({}),
            }),
        },
    };
});

import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as ReturnType<typeof createPrismaMock>;

describe("Customer Status Automation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should set customer status to Active if there are due invoices", async () => {
        const customerId = 1;
        const dueData = { no_of_due_invoices: 1, total_due_amount: 100 };
        const overdueData = { no_of_overdue_invoices: 0, total_outstanding_amount: 0 };

        // Mock calculateDueAmountsForCustomers and calculateOutstandingAmountsForCustomers
        vi.spyOn(CustomerService as any, "calculateDueAmountsForCustomers").mockResolvedValue(new Map([[customerId, dueData]]));
        vi.spyOn(CustomerService as any, "calculateOutstandingAmountsForCustomers").mockResolvedValue(new Map([[customerId, overdueData]]));

        // Mock findMany for cache invalidation
        (mockPrisma.customer.findMany as any).mockResolvedValue([{ account_id: 1 }]);

        await CustomerService.recalculateAllAmountsForCustomers([customerId]);

        expect(mockPrisma.customer.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: customerId },
            data: expect.objectContaining({
                collection_status: "Active",
            }),
        }));
    });

    it("should set customer status to Active if there are overdue invoices", async () => {
        const customerId = 1;
        const dueData = { no_of_due_invoices: 0, total_due_amount: 0 };
        const overdueData = { no_of_overdue_invoices: 1, total_outstanding_amount: 100 };

        vi.spyOn(CustomerService as any, "calculateDueAmountsForCustomers").mockResolvedValue(new Map([[customerId, dueData]]));
        vi.spyOn(CustomerService as any, "calculateOutstandingAmountsForCustomers").mockResolvedValue(new Map([[customerId, overdueData]]));

        // Mock findMany for cache invalidation
        (mockPrisma.customer.findMany as any).mockResolvedValue([{ account_id: 1 }]);

        await CustomerService.recalculateAllAmountsForCustomers([customerId]);

        expect(mockPrisma.customer.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: customerId },
            data: expect.objectContaining({
                collection_status: "Active",
            }),
        }));
    });

    it("should set customer status to Inactive if there are no due or overdue invoices", async () => {
        const customerId = 1;
        const dueData = { no_of_due_invoices: 0, total_due_amount: 0 };
        const overdueData = { no_of_overdue_invoices: 0, total_outstanding_amount: 0 };

        vi.spyOn(CustomerService as any, "calculateDueAmountsForCustomers").mockResolvedValue(new Map([[customerId, dueData]]));
        vi.spyOn(CustomerService as any, "calculateOutstandingAmountsForCustomers").mockResolvedValue(new Map([[customerId, overdueData]]));

        // Mock findMany for cache invalidation
        (mockPrisma.customer.findMany as any).mockResolvedValue([{ account_id: 1 }]);

        await CustomerService.recalculateAllAmountsForCustomers([customerId]);

        expect(mockPrisma.customer.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: customerId },
            data: expect.objectContaining({
                collection_status: "Inactive",
            }),
        }));
    });

    it("zeros customer totals when recalculation finds no open due or overdue invoices", async () => {
        const customerId = 1;
        vi.spyOn(CustomerService as any, "calculateDueAmountsForCustomers").mockResolvedValue(
            new Map()
        );
        vi.spyOn(CustomerService as any, "calculateOutstandingAmountsForCustomers").mockResolvedValue(
            new Map()
        );
        (mockPrisma.customer.findMany as any).mockResolvedValue([{ account_id: 1 }]);

        await CustomerService.recalculateAllAmountsForCustomers([customerId]);

        expect(mockPrisma.customer.update).toHaveBeenCalledWith({
            where: { id: customerId },
            data: expect.objectContaining({
                collection_status: "Inactive",
                total_due_amount: 0,
                no_of_due_invoices: 0,
                total_overdue_amount: 0,
                number_of_overdue_invoices: 0,
            }),
        });
    });
});
