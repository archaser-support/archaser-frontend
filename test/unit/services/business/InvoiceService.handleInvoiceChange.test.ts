import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    recalculateAllAmountsForCustomers: vi.fn().mockResolvedValue(new Map()),
    cancelDueNotificationsForInvoices: vi.fn().mockResolvedValue(undefined),
    syncCustomerInsuranceFields: vi.fn().mockResolvedValue(undefined),
    invalidateDashboardCacheForAccount: vi.fn().mockResolvedValue(undefined),
    logMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    return {
        prisma: createPrismaMock(),
    };
});

vi.mock("@/server/services/CustomerService", () => ({
    CustomerService: {
        recalculateAllAmountsForCustomers:
            mocks.recalculateAllAmountsForCustomers,
    },
}));

vi.mock("@/server/services/DueNotificationService", () => ({
    DueNotificationService: class {
        cancelDueNotificationsForInvoices =
            mocks.cancelDueNotificationsForInvoices;
    },
}));

vi.mock("@/server/services/creditInsurance/syncCustomerInsuranceFields", () => ({
    syncCustomerInsuranceFields: mocks.syncCustomerInsuranceFields,
}));

vi.mock("@/server/utils/cacheInvalidationHelper", () => ({
    invalidateDashboardCacheForAccount: mocks.invalidateDashboardCacheForAccount,
}));

const mockLogServiceInstance = {
    logMessage: mocks.logMessage,
};
vi.mock("@/server/services/LogService", () => ({
    LogService: {
        getInstance: vi.fn(() => mockLogServiceInstance),
    },
    LogLevel: {
        ERROR: "ERROR",
        INFO: "INFO",
    },
}));

import { prisma } from "@/lib/prisma";
import { InvoiceService } from "@/server/services/InvoiceService";

describe("InvoiceService.handleInvoiceChange", () => {
    let mockPrisma: any;
    let service: InvoiceService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma = prisma;
        mockPrisma.$transaction.mockImplementation((callback: any) =>
            callback(mockPrisma)
        );
        mockPrisma.invoice.findUnique.mockResolvedValue({
            status: "Paid",
        });
        mockPrisma.invoice.update.mockResolvedValue({});
        service = new InvoiceService();
    });

    it("wraps invoice-change cascade in a transaction", async () => {
        await service.handleInvoiceChange({
            id: 1,
            account_id: 7,
            customer_id: 4,
            invoice_number: "INV-1",
            status: "Due",
            customer_total_paid: 100,
            customer_net_amount: 0,
        } as any);

        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
        expect(mocks.cancelDueNotificationsForInvoices).toHaveBeenCalledWith(
            [1],
            undefined,
            mockPrisma
        );
        expect(mocks.recalculateAllAmountsForCustomers).toHaveBeenCalledWith(
            [4],
            undefined,
            {
                dbClient: mockPrisma,
                runPostCommitEffects: false,
            }
        );
        expect(mocks.syncCustomerInsuranceFields).toHaveBeenNthCalledWith(1, 4, {
            dbClient: mockPrisma,
            runFollowUpEffects: false,
            invoiceIds: [1],
        });
        expect(mocks.syncCustomerInsuranceFields).toHaveBeenNthCalledWith(2, 4, {
            invoiceIds: [1],
        });
        expect(mocks.invalidateDashboardCacheForAccount).toHaveBeenCalledWith(7);
        expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
            where: { id: 1 },
            data: {
                due_notification_state: {},
                zero_limit_alert: false,
            },
        });
    });
});
