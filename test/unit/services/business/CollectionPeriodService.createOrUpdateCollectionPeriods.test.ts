import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    syncCustomerInsuranceFields: vi.fn().mockResolvedValue(undefined),
    invalidateDashboardCacheForAccounts: vi.fn().mockResolvedValue(undefined),
    logMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", async (importOriginal) => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    const actual = await importOriginal<typeof import("@/lib/prisma")>();
    return {
        ...actual,
        prisma: createPrismaMock(),
    };
});

vi.mock("@/server/services/creditInsurance/syncCustomerInsuranceFields", () => ({
    syncCustomerInsuranceFields: mocks.syncCustomerInsuranceFields,
}));

vi.mock("@/server/utils/cacheInvalidationHelper", () => ({
    invalidateDashboardCacheForAccounts: mocks.invalidateDashboardCacheForAccounts,
}));

vi.mock("@/server/services/ActivityService", () => ({
    ActivityService: class {
        cancelScheduledActivities = vi.fn().mockResolvedValue(undefined);
        createActivityWithFormattedDescription = vi
            .fn()
            .mockResolvedValue(undefined);
    },
}));

const mockLogServiceInstance = {
    logMessage: mocks.logMessage,
};

vi.mock("@/server/services/LogService", () => ({
    LogService: {
        getInstance: vi.fn(() => mockLogServiceInstance),
    },
}));

import { prisma } from "@/lib/prisma";
import { createMockAccount } from "@/test/fixtures/services/account";
import { createMockCollectionPeriod } from "@/test/fixtures/services/collectionPeriod";
import {
    createMockAggregatedData,
    createMockCustomer,
} from "@/test/fixtures/services/customer";
import { CollectionPeriodService } from "@/server/services/CollectionPeriodService";

describe("CollectionPeriodService.createOrUpdateCollectionPeriods", () => {
    let mockPrisma: any;
    let service: CollectionPeriodService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma = prisma;
        mockPrisma.$transaction.mockImplementation((callback: any) =>
            callback(mockPrisma)
        );
        service = new CollectionPeriodService();
    });

    it("wraps existing collection-period updates in a transaction", async () => {
        const customerId = 11;
        const account = createMockAccount({ id: 7, currency: "EUR" });
        const customerInfo = {
            ...createMockCustomer({ id: customerId, account_id: account.id }),
            Account: account,
        };
        const amounts = createMockAggregatedData(customerId, {
            no_of_overdue_invoices: 3,
            total_outstanding_amount: 850,
            customer_outstanding_amount1: 500,
            customer_outstanding_amount2: 350,
            customer_currency1: "EUR",
            customer_currency2: "USD",
        });
        const existingCollectionPeriod = createMockCollectionPeriod({
            id: 44,
            customer_id: customerId,
        });

        mockPrisma.customerCollectionPeriod.findFirst.mockResolvedValueOnce(
            existingCollectionPeriod
        );
        mockPrisma.customerCollectionPeriod.update.mockResolvedValueOnce(
            existingCollectionPeriod
        );

        const result = await service.createOrUpdateCollectionPeriods([
            {
                customerId,
                amounts,
                customerInfo,
            },
        ]);

        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
        expect(mockPrisma.customerCollectionPeriod.update).toHaveBeenCalledWith({
            where: { id: 44 },
            data: {
                no_of_overdue_invoices: 3,
                currency: "EUR",
                customer_currency1: "EUR",
                customer_currency2: "USD",
                total_outstanding_amount: 850,
                customer_outstanding_amount1: 500,
                customer_outstanding_amount2: 350,
            },
        });
        expect(mocks.syncCustomerInsuranceFields).toHaveBeenCalledWith(11, {
            dbClient: mockPrisma,
            runFollowUpEffects: false,
        });
        expect(mocks.invalidateDashboardCacheForAccounts).toHaveBeenCalledWith([
            7,
        ]);
        expect(result.get(11)).toEqual({
            collectionPeriodId: 44,
            isNew: false,
            errors: [],
        });
    });

    it("creates a new collection period inside the transaction when missing", async () => {
        const customerId = 12;
        const account = createMockAccount({
            id: 9,
            currency: "USD",
            category_for_new_collection: "Agent",
        });
        const customerInfo = {
            ...createMockCustomer({ id: customerId, account_id: account.id }),
            Account: account,
        };
        const amounts = createMockAggregatedData(customerId, {
            no_of_overdue_invoices: 4,
            total_outstanding_amount: 1200,
            customer_outstanding_amount1: 1200,
            customer_outstanding_amount2: 0,
            customer_currency1: "USD",
            customer_currency2: "",
        });
        const createdCollectionPeriod = createMockCollectionPeriod({
            id: 55,
            customer_id: customerId,
            current_category: "Agent",
        });

        mockPrisma.customerCollectionPeriod.findFirst.mockResolvedValueOnce(null);
        mockPrisma.customerCollectionPeriod.create.mockResolvedValueOnce(
            createdCollectionPeriod
        );

        const result = await service.createOrUpdateCollectionPeriods([
            {
                customerId,
                amounts,
                customerInfo,
            },
        ]);

        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
        expect(mockPrisma.customerCollectionPeriod.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                customer_id: 12,
                no_of_overdue_invoices: 4,
                currency: "USD",
                customer_currency1: "USD",
                customer_currency2: "",
                total_outstanding_amount: 1200,
                customer_outstanding_amount1: 1200,
                customer_outstanding_amount2: 0,
                current_category: "Agent",
                last_automated_step: 0,
                create_next_activity: true,
            }),
        });
        expect(mocks.syncCustomerInsuranceFields).toHaveBeenCalledWith(12, {
            dbClient: mockPrisma,
            runFollowUpEffects: false,
        });
        expect(mocks.invalidateDashboardCacheForAccounts).toHaveBeenCalledWith([
            9,
        ]);
        expect(result.get(12)).toEqual({
            collectionPeriodId: 55,
            isNew: true,
            errors: [],
        });
    });

    it("skips creating a new collection period for credit-only accounts", async () => {
        const customerId = 13;
        const account = createMockAccount({
            id: 10,
            currency: "USD",
            has_collection: false,
            has_credit_insurance: true,
        });
        const customerInfo = {
            ...createMockCustomer({ id: customerId, account_id: account.id }),
            Account: account,
        };
        const amounts = createMockAggregatedData(customerId, {
            no_of_overdue_invoices: 2,
            total_outstanding_amount: 500,
            customer_outstanding_amount1: 500,
            customer_outstanding_amount2: 0,
            customer_currency1: "USD",
            customer_currency2: "",
        });

        mockPrisma.customerCollectionPeriod.findFirst.mockResolvedValueOnce(null);

        const result = await service.createOrUpdateCollectionPeriods([
            {
                customerId,
                amounts,
                customerInfo,
            },
        ]);

        expect(mockPrisma.customerCollectionPeriod.create).not.toHaveBeenCalled();
        expect(mocks.syncCustomerInsuranceFields).not.toHaveBeenCalled();
        expect(result.get(13)).toEqual({
            collectionPeriodId: 0,
            isNew: false,
            errors: [],
        });
    });

    it("still creates a collection period for dual-product accounts", async () => {
        const customerId = 14;
        const account = createMockAccount({
            id: 11,
            currency: "USD",
            has_collection: true,
            has_credit_insurance: true,
            category_for_new_collection: "Automated",
        });
        const customerInfo = {
            ...createMockCustomer({ id: customerId, account_id: account.id }),
            Account: account,
        };
        const amounts = createMockAggregatedData(customerId, {
            no_of_overdue_invoices: 1,
            total_outstanding_amount: 300,
            customer_outstanding_amount1: 300,
            customer_outstanding_amount2: 0,
            customer_currency1: "USD",
            customer_currency2: "",
        });
        const createdCollectionPeriod = createMockCollectionPeriod({
            id: 66,
            customer_id: customerId,
            current_category: "Automated",
        });

        mockPrisma.customerCollectionPeriod.findFirst.mockResolvedValueOnce(null);
        mockPrisma.customerCollectionPeriod.create.mockResolvedValueOnce(
            createdCollectionPeriod
        );

        const result = await service.createOrUpdateCollectionPeriods([
            {
                customerId,
                amounts,
                customerInfo,
            },
        ]);

        expect(mockPrisma.customerCollectionPeriod.create).toHaveBeenCalledTimes(1);
        expect(result.get(14)).toEqual({
            collectionPeriodId: 66,
            isNew: true,
            errors: [],
        });
    });

    it("still updates an existing open period for credit-only accounts", async () => {
        const customerId = 15;
        const account = createMockAccount({
            id: 12,
            currency: "EUR",
            has_collection: false,
            has_credit_insurance: true,
        });
        const customerInfo = {
            ...createMockCustomer({ id: customerId, account_id: account.id }),
            Account: account,
        };
        const amounts = createMockAggregatedData(customerId, {
            no_of_overdue_invoices: 1,
            total_outstanding_amount: 200,
            customer_outstanding_amount1: 200,
            customer_outstanding_amount2: 0,
            customer_currency1: "EUR",
            customer_currency2: "",
        });
        const existingCollectionPeriod = createMockCollectionPeriod({
            id: 77,
            customer_id: customerId,
            current_category: "Automated",
        });

        mockPrisma.customerCollectionPeriod.findFirst.mockResolvedValueOnce(
            existingCollectionPeriod
        );
        mockPrisma.customerCollectionPeriod.update.mockResolvedValueOnce(
            existingCollectionPeriod
        );

        const result = await service.createOrUpdateCollectionPeriods([
            {
                customerId,
                amounts,
                customerInfo,
            },
        ]);

        expect(mockPrisma.customerCollectionPeriod.create).not.toHaveBeenCalled();
        expect(mockPrisma.customerCollectionPeriod.update).toHaveBeenCalledTimes(1);
        expect(result.get(15)).toEqual({
            collectionPeriodId: 77,
            isNew: false,
            errors: [],
        });
    });

    it("fetches account product flags when Account is not embedded on customerInfo", async () => {
        const customerId = 16;
        const customerInfo = createMockCustomer({
            id: customerId,
            account_id: 13,
        });
        const amounts = createMockAggregatedData(customerId, {
            no_of_overdue_invoices: 1,
            total_outstanding_amount: 100,
            customer_outstanding_amount1: 100,
            customer_outstanding_amount2: 0,
            customer_currency1: "USD",
            customer_currency2: "",
        });

        mockPrisma.customerCollectionPeriod.findFirst.mockResolvedValueOnce(null);
        mockPrisma.account.findUnique.mockResolvedValueOnce({
            has_collection: false,
            has_credit_insurance: true,
        });

        const result = await service.createOrUpdateCollectionPeriods([
            {
                customerId,
                amounts,
                customerInfo,
            },
        ]);

        expect(mockPrisma.account.findUnique).toHaveBeenCalledWith({
            where: { id: 13 },
            select: {
                has_collection: true,
                has_credit_insurance: true,
            },
        });
        expect(mockPrisma.customerCollectionPeriod.create).not.toHaveBeenCalled();
        expect(result.get(16)).toEqual({
            collectionPeriodId: 0,
            isNew: false,
            errors: [],
        });
    });
});
