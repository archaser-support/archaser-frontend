import type { NextApiRequest, NextApiResponse } from "next";
import { createMocks } from "node-mocks-http";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getUserInfo: vi.fn(),
    getActiveCustomerPolicyRow: vi.fn(),
    updatePromiseToPay: vi.fn().mockResolvedValue(undefined),
    syncInvoiceLastPaymentPromiseActivities: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next-auth", () => ({
    getServerSession: vi.fn(),
}));

vi.mock("@/server/auth/authOptions", () => ({
    authOptions: {},
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
        }),
    },
}));

vi.mock("@/server/services/creditInsurance/resolveActiveCustomerPolicy", () => ({
    getActiveCustomerPolicyRow: mocks.getActiveCustomerPolicyRow,
}));

vi.mock("@/server/services/BusinessService", () => ({
    BusinessService: class {
        updatePromiseToPay = mocks.updatePromiseToPay;
    },
}));

vi.mock("@/server/services/ActivityService", () => ({
    ActivityService: class {
        syncInvoiceLastPaymentPromiseActivities =
            mocks.syncInvoiceLastPaymentPromiseActivities;
    },
}));

import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import handler from "@/pages/api/invoices/update-last-payment-date";
import { createMockAccount } from "@/test/fixtures/services/account";
import { createMockCollectionPeriod } from "@/test/fixtures/services/collectionPeriod";
import { createMockCustomer } from "@/test/fixtures/services/customer";
import { createMockInvoice } from "@/test/fixtures/services/invoice";
import { createMockUser } from "@/test/fixtures/common/users";

describe("POST /api/invoices/update-last-payment-date", () => {
    let mockPrisma: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma = prisma;
        mockPrisma.$transaction.mockImplementation((callback: any) =>
            callback(mockPrisma)
        );

        (getServerSession as any).mockResolvedValue({
            user: { id: "admin1" },
        });
        mocks.getUserInfo.mockResolvedValue({
            userId: "admin1",
        });
        mocks.getActiveCustomerPolicyRow.mockResolvedValue({
            max_allowed_mep: 5,
            reporting_days: 2,
        });
    });

    it("updates the invoice inside a transaction before routing to promise-to-pay", async () => {
        const invoice = createMockInvoice({ id: 99, customer_id: 1 });
        const customer = createMockCustomer({ id: 1, account_id: 7 });
        const account = createMockAccount({ id: 7, has_collection: true });
        const openCollectionPeriod = createMockCollectionPeriod({
            id: 55,
            customer_id: 1,
        });
        const user = createMockUser({
            id: "admin1",
            name: "Admin User",
            email: "admin@test.com",
        });

        mockPrisma.invoice.findUnique.mockResolvedValueOnce({
            id: Number(invoice.id),
            customer_id: invoice.customer_id,
        });
        mockPrisma.customer.findUnique.mockResolvedValueOnce({
            id: customer.id,
            account_id: customer.account_id,
        });
        mockPrisma.account.findUnique.mockResolvedValueOnce({
            id: account.id,
            has_collection: account.has_collection,
        });
        mockPrisma.invoice.update.mockResolvedValueOnce({});
        mockPrisma.customerCollectionPeriod.findFirst.mockResolvedValueOnce({
            id: openCollectionPeriod.id,
        });
        mockPrisma.user.findUnique.mockResolvedValueOnce({
            name: user.name,
            email: user.email,
        });

        const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
            method: "POST",
            body: {
                invoiceId: Number(invoice.id),
                lastPaymentDate: "2026-05-20",
            },
        });

        await handler(req, res);

        expect(res._getStatusCode()).toBe(200);
        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
        expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
            where: { id: 99 },
            data: {
                last_payment_date: new Date("2026-05-20T00:00:00.000Z"),
                target_mep_date: new Date("2026-05-25T00:00:00.000Z"),
                target_reporting_date: new Date("2026-05-22T00:00:00.000Z"),
            },
        });
        expect(mocks.updatePromiseToPay).toHaveBeenCalledWith(
            expect.objectContaining({
                customerId: 1,
                promiseDate: "2026-05-20",
                userId: "admin1",
                userName: "Admin User",
            })
        );
        expect(
            mocks.syncInvoiceLastPaymentPromiseActivities
        ).not.toHaveBeenCalled();
    });

    it("falls back to syncing invoice promise activities when no collection period is open", async () => {
        const invoice = createMockInvoice({ id: 100, customer_id: 2 });
        const customer = createMockCustomer({ id: 2, account_id: 8 });
        const account = createMockAccount({ id: 8, has_collection: true });

        mockPrisma.invoice.findUnique.mockResolvedValueOnce({
            id: Number(invoice.id),
            customer_id: invoice.customer_id,
        });
        mockPrisma.customer.findUnique.mockResolvedValueOnce({
            id: customer.id,
            account_id: customer.account_id,
        });
        mockPrisma.account.findUnique.mockResolvedValueOnce({
            id: account.id,
            has_collection: account.has_collection,
        });
        mockPrisma.invoice.update.mockResolvedValueOnce({});
        mockPrisma.customerCollectionPeriod.findFirst.mockResolvedValueOnce(null);

        const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
            method: "POST",
            body: {
                invoiceId: Number(invoice.id),
                lastPaymentDate: "2026-05-20",
            },
        });

        await handler(req, res);

        expect(res._getStatusCode()).toBe(200);
        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
        expect(
            mocks.syncInvoiceLastPaymentPromiseActivities
        ).toHaveBeenCalledWith({
            invoiceId: 100,
            customerId: 2,
            accountId: 8,
            paymentDateUtc: new Date("2026-05-20T00:00:00.000Z"),
            userId: "admin1",
        });
        expect(mocks.updatePromiseToPay).not.toHaveBeenCalled();
    });
});
