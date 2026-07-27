import type { NextApiRequest, NextApiResponse } from "next";
import { createMocks } from "node-mocks-http";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getUserInfo: vi.fn(),
    getOwnerFilter: vi.fn(),
    getBusinessUnitFilter: vi.fn(),
    getEffectiveUserId: vi.fn(),
    hasPermission: vi.fn(),
}));

vi.mock("@/utils/apiRateLimiter", () => ({
    rateLimit: (handler: unknown) => handler,
}));

vi.mock("@/utils/errorHandler", () => ({
    errorHandler: (handler: unknown) => handler,
}));

vi.mock("@/lib/prisma", async (importOriginal) => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    const actual = await importOriginal<typeof import("@/lib/prisma")>();
    return {
        ...actual,
        prisma: createPrismaMock(),
    };
});

vi.mock("@/server/services/AccessControlService", () => ({
    AccessControlService: {
        getInstance: () => ({
            getUserInfo: mocks.getUserInfo,
            getOwnerFilter: mocks.getOwnerFilter,
            getBusinessUnitFilter: mocks.getBusinessUnitFilter,
            getEffectiveUserId: mocks.getEffectiveUserId,
        }),
    },
}));

vi.mock("@/server/services/PermissionService", () => ({
    PermissionService: {
        getInstance: () => ({
            hasPermission: mocks.hasPermission,
        }),
    },
}));

import { prisma } from "@/lib/prisma";
import handler from "@/pages/api/entities/[...path]";

describe("GET /api/entities/customers?stats=true", () => {
    let mockPrisma: ReturnType<typeof createPrismaMock>;

    function createPrismaMock() {
        return prisma as unknown as ReturnType<
            typeof import("@/test/mocks/prisma").createPrismaMock
        >;
    }

    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma = createPrismaMock();

        mocks.getUserInfo.mockResolvedValue({
            accountId: 10013,
            userId: "admin-user",
            role: "System_Administrator",
            businessUnitId: null,
            viewAsUserId: null,
            viewAsUserRole: null,
            viewAsUserAccountId: null,
        });
        mocks.getEffectiveUserId.mockReturnValue("admin-user");
        mocks.getOwnerFilter.mockResolvedValue({});
        mocks.getBusinessUnitFilter.mockResolvedValue({});
        mocks.hasPermission.mockResolvedValue(true);

        mockPrisma.customer.count
            .mockResolvedValueOnce(3)
            .mockResolvedValueOnce(2)
            .mockResolvedValueOnce(1);
        mockPrisma.customer.aggregate.mockResolvedValue({
            _sum: {
                total_due_amount: 27500,
                total_overdue_amount: 948025.36,
                no_of_due_invoices: 940,
                number_of_overdue_invoices: 60,
            },
        });
        mockPrisma.account.findUnique.mockResolvedValue({ currency: "ILS" });
        mockPrisma.customer.groupBy.mockResolvedValue([
            {
                collection_status: "Active",
                _count: { collection_status: 2 },
            },
            {
                collection_status: "Inactive",
                _count: { collection_status: 1 },
            },
        ]);
    });

    it("returns total_due_amount and total_overdue_amount from customer aggregates", async () => {
        const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
            method: "GET",
            query: {
                path: ["customers"],
                stats: "true",
            },
        });

        await handler(req, res);

        expect(res._getStatusCode()).toBe(200);
        const body = res._getJSONData();

        expect(body.counts.total_due_amount).toBe(27500);
        expect(body.counts.total_overdue_amount).toBe(948025.36);
        expect(body.counts.open_invoice_count).toBe(1000);
        expect(body.counts.total_customers).toBe(3);
        expect(body.counts.average_outstanding_per_customer).toBeCloseTo(
            27500 / 3
        );
        expect(mockPrisma.customer.aggregate).toHaveBeenCalledWith({
            where: { account_id: 10013 },
            _sum: {
                total_due_amount: true,
                total_overdue_amount: true,
                no_of_due_invoices: true,
                number_of_overdue_invoices: true,
            },
        });
        expect(body.counts).not.toHaveProperty("total_overdue_invoices");
        expect(body.counts).not.toHaveProperty("total_outstanding_amount");
    });

    it("scopes due-amount aggregate to account, owner, and business-unit filters", async () => {
        mocks.getUserInfo.mockResolvedValue({
            accountId: 42,
            userId: "collector-1",
            role: "Collector",
            businessUnitId: 7,
            viewAsUserId: null,
            viewAsUserRole: null,
            viewAsUserAccountId: null,
        });
        mocks.getOwnerFilter.mockResolvedValue({ owner_id: "collector-1" });
        mocks.getBusinessUnitFilter.mockResolvedValue({ business_unit_id: 7 });

        mockPrisma.customer.count.mockReset();
        mockPrisma.customer.count
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(0);
        mockPrisma.customer.aggregate.mockResolvedValue({
            _sum: {
                total_due_amount: 13500,
                total_overdue_amount: 1200,
                no_of_due_invoices: 8,
                number_of_overdue_invoices: 2,
            },
        });
        mockPrisma.customer.groupBy.mockResolvedValue([
            {
                collection_status: "Active",
                _count: { collection_status: 1 },
            },
        ]);

        const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
            method: "GET",
            query: {
                path: ["customers"],
                stats: "true",
            },
        });

        await handler(req, res);

        expect(res._getStatusCode()).toBe(200);
        expect(res._getJSONData().counts.total_due_amount).toBe(13500);
        expect(mockPrisma.customer.aggregate).toHaveBeenCalledWith({
            where: {
                account_id: 42,
                owner_id: "collector-1",
                business_unit_id: 7,
            },
            _sum: {
                total_due_amount: true,
                total_overdue_amount: true,
                no_of_due_invoices: true,
                number_of_overdue_invoices: true,
            },
        });
    });
});
