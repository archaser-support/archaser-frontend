import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";
import { CustomerCheckpointService } from "@/server/services/customerCheckpoint/CustomerCheckpointService";
import {
    CUSTOMER_CHECKPOINT_SCHEMA_VERSION,
    CustomerCheckpointNotFoundError,
} from "@/server/services/customerCheckpoint/types";
import { createPrismaMock } from "@/test/mocks/prisma";

const mocks = vi.hoisted(() => ({
    recalculateAllAmountsForCustomers: vi.fn().mockResolvedValue(new Map()),
    syncCustomerInsuranceFields: vi.fn().mockResolvedValue(undefined),
    invalidateDashboardCacheForAccount: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    return {
        prisma: createPrismaMock(),
    };
});

vi.mock("@/server/services/CustomerService", () => ({
    CustomerService: {
        recalculateAllAmountsForCustomers: mocks.recalculateAllAmountsForCustomers,
    },
}));

vi.mock("@/server/services/creditInsurance/syncCustomerInsuranceFields", () => ({
    syncCustomerInsuranceFields: mocks.syncCustomerInsuranceFields,
}));

vi.mock("@/server/utils/cacheInvalidationHelper", () => ({
    invalidateDashboardCacheForAccount: mocks.invalidateDashboardCacheForAccount,
}));

const prismaMock = prisma as ReturnType<typeof createPrismaMock>;

function mockEmptyCustomerSubtree(customerId = 42) {
    const customer = {
        id: customerId,
        account_id: 7,
        customer_number: "C-001",
        type: "Company",
        collection_status: "Inactive",
    };

    prismaMock.customer.findUnique.mockResolvedValue(customer);
    prismaMock.invoice.findMany.mockResolvedValue([]);
    prismaMock.invoicePayment.findMany.mockResolvedValue([]);
    prismaMock.payment.findMany.mockResolvedValue([]);
    prismaMock.customerCollectionPeriod.findMany.mockResolvedValue([]);
    prismaMock.activity.findMany.mockResolvedValue([]);
    prismaMock.customerDispute.findMany.mockResolvedValue([]);
    prismaMock.customerAggregatedData.findUnique.mockResolvedValue(null);
    prismaMock.customerPolicy.findMany.mockResolvedValue([]);
    prismaMock.customerTopUp.findMany.mockResolvedValue([]);
    prismaMock.contact.findMany.mockResolvedValue([]);
    prismaMock.customerBanks.findMany.mockResolvedValue([]);

    return customer;
}

describe("CustomerCheckpointService capture", () => {
    const service = CustomerCheckpointService.getInstance();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("captures an empty-ish customer with schemaVersion 1", async () => {
        mockEmptyCustomerSubtree();

        const payload = await service.captureCustomerSubtree(42);

        expect(payload.schemaVersion).toBe(CUSTOMER_CHECKPOINT_SCHEMA_VERSION);
        expect(payload.tables.customer.id).toBe(42);
        expect(payload.tables.invoices).toEqual([]);
        expect(payload.tables.invoicePayments).toEqual([]);
        expect(payload.tables.payments).toEqual([]);
        expect(payload.tables.aggregatedData).toBeNull();
        expect(payload.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("includes invoices and payments in payload row counts", async () => {
        mockEmptyCustomerSubtree();
        prismaMock.invoice.findMany.mockResolvedValue([
            { id: 1, customer_id: 42, invoice_number: "INV-1" },
            { id: 2, customer_id: 42, invoice_number: "INV-2" },
        ]);
        prismaMock.invoicePayment.findMany.mockResolvedValue([
            {
                id: 10,
                customer_id: 42,
                reference: "PAY-1",
                invoice_id: 1,
            },
        ]);
        prismaMock.payment.findMany.mockResolvedValue([
            { id: 20, customer_id: 42, amount: 100 },
        ]);

        const payload = await service.captureCustomerSubtree(42);

        expect(payload.tables.invoices).toHaveLength(2);
        expect(payload.tables.invoicePayments).toHaveLength(1);
        expect(payload.tables.payments).toHaveLength(1);
    });

    it("loads activity contacts and dispute invoices for related rows", async () => {
        mockEmptyCustomerSubtree();
        prismaMock.activity.findMany.mockResolvedValue([
            { id: BigInt(100), customer_id: 42 },
        ]);
        prismaMock.customerDispute.findMany.mockResolvedValue([
            { id: 5, customer_id: 42 },
        ]);
        prismaMock.activityContact.findMany.mockResolvedValue([
            { id: 1, activity_id: BigInt(100), contact_id: 9 },
        ]);
        prismaMock.disputeInvoice.findMany.mockResolvedValue([
            { id: 2, dispute_id: 5, invoice_id: 1 },
        ]);

        const payload = await service.captureCustomerSubtree(42);

        expect(prismaMock.activityContact.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { activity_id: { in: [BigInt(100)] } },
            })
        );
        expect(prismaMock.disputeInvoice.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { dispute_id: { in: [5] } },
            })
        );
        expect(payload.tables.activities[0]?.id).toBe("100");
        expect(payload.tables.activityContacts).toHaveLength(1);
        expect(payload.tables.disputeInvoices).toHaveLength(1);
    });

    it("throws when customer does not exist", async () => {
        prismaMock.customer.findUnique.mockResolvedValue(null);

        await expect(service.captureCustomerSubtree(999)).rejects.toThrow(
            "Customer not found"
        );
    });
});

describe("CustomerCheckpointService save and status", () => {
    const service = CustomerCheckpointService.getInstance();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("upserts checkpoint on save and returns status with row counts", async () => {
        mockEmptyCustomerSubtree();
        const savedAt = new Date("2026-07-05T10:00:00.000Z");
        prismaMock.customerCheckpoint.upsert.mockResolvedValue({
            saved_at: savedAt,
            saved_by: "user-1",
        });

        const status = await service.saveCustomerCheckpoint(42, 7, "user-1");

        expect(prismaMock.customerCheckpoint.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { customer_id: 42 },
                create: expect.objectContaining({
                    customer_id: 42,
                    account_id: 7,
                    saved_by: "user-1",
                }),
                update: expect.objectContaining({
                    account_id: 7,
                    saved_by: "user-1",
                }),
            })
        );
        expect(status.exists).toBe(true);
        expect(status.savedAt).toBe(savedAt.toISOString());
        expect(status.savedBy).toBe("user-1");
        expect(status.rowCounts).toEqual({
            invoices: 0,
            invoicePayments: 0,
            payments: 0,
            collectionPeriods: 0,
            activities: 0,
            activityContacts: 0,
            disputes: 0,
            disputeInvoices: 0,
            customerPolicies: 0,
            customerTopUps: 0,
            contacts: 0,
            customerBanks: 0,
            hasAggregatedData: false,
        });
    });

    it("rejects save when requireEmptyArBaseline and customer has AR rows", async () => {
        mockEmptyCustomerSubtree();
        prismaMock.invoice.findMany.mockResolvedValue([
            { id: 1, customer_id: 42, invoice_number: "INV-1" },
        ]);

        await expect(
            service.saveCustomerCheckpoint(42, 7, "user-1", undefined, {
                requireEmptyArBaseline: true,
            })
        ).rejects.toThrow(
            "Checkpoint baseline must not include invoices or invoice payments"
        );
        expect(prismaMock.customerCheckpoint.upsert).not.toHaveBeenCalled();
    });

    it("overwrites prior checkpoint on second save", async () => {
        mockEmptyCustomerSubtree();
        prismaMock.invoice.findMany
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                { id: 1, customer_id: 42, invoice_number: "INV-1" },
            ]);

        prismaMock.customerCheckpoint.upsert
            .mockResolvedValueOnce({
                saved_at: new Date("2026-07-05T10:00:00.000Z"),
                saved_by: "user-1",
            })
            .mockResolvedValueOnce({
                saved_at: new Date("2026-07-05T11:00:00.000Z"),
                saved_by: "user-2",
            });

        const first = await service.saveCustomerCheckpoint(42, 7, "user-1");
        const second = await service.saveCustomerCheckpoint(42, 7, "user-2");

        expect(prismaMock.customerCheckpoint.upsert).toHaveBeenCalledTimes(2);
        expect(first.savedBy).toBe("user-1");
        expect(second.savedBy).toBe("user-2");
        expect(second.rowCounts?.invoices).toBe(1);

        const secondUpsertCall =
            prismaMock.customerCheckpoint.upsert.mock.calls[1]?.[0];
        const secondPayload = secondUpsertCall?.update?.payload;
        expect(secondPayload.tables.invoices).toHaveLength(1);
    });

    it("returns null status when no checkpoint exists", async () => {
        prismaMock.customerCheckpoint.findUnique.mockResolvedValue(null);

        const status = await service.getCheckpointStatus(42);

        expect(status).toBeNull();
    });

    it("returns savedAt and row counts when checkpoint exists", async () => {
        const savedAt = new Date("2026-07-05T09:30:00.000Z");
        prismaMock.customerCheckpoint.findUnique.mockResolvedValue({
            saved_at: savedAt,
            saved_by: "user-abc",
            payload: {
                schemaVersion: 1,
                capturedAt: savedAt.toISOString(),
                tables: {
                    customer: { id: 42 },
                    invoices: [{ id: 1 }],
                    invoicePayments: [],
                    payments: [],
                    collectionPeriods: [],
                    activities: [],
                    activityContacts: [],
                    disputes: [],
                    disputeInvoices: [],
                    aggregatedData: null,
                    customerPolicies: [],
                    customerTopUps: [],
                    contacts: [],
                    customerBanks: [],
                },
            },
        });

        const status = await service.getCheckpointStatus(42);

        expect(status).toEqual({
            exists: true,
            savedAt: savedAt.toISOString(),
            savedBy: "user-abc",
            rowCounts: expect.objectContaining({
                invoices: 1,
                hasAggregatedData: false,
            }),
        });
    });
});

function buildCheckpointPayload(customerId = 42) {
    return {
        schemaVersion: CUSTOMER_CHECKPOINT_SCHEMA_VERSION,
        capturedAt: "2026-07-05T10:00:00.000Z",
        tables: {
            customer: {
                id: customerId,
                customer_uuid: "uuid-42",
                account_id: 7,
                collection_status: "Active",
            },
            invoices: [{ id: 1, customer_id: customerId, invoice_number: "INV-1" }],
            invoicePayments: [
                {
                    id: 10,
                    customer_id: customerId,
                    invoice_id: 1,
                    reference: "PAY-REF-1",
                    account_id: 7,
                },
            ],
            payments: [],
            collectionPeriods: [],
            activities: [{ id: "100", customer_id: customerId, content: "note" }],
            activityContacts: [{ id: 1, activity_id: "100", contact_id: 5 }],
            disputes: [],
            disputeInvoices: [],
            aggregatedData: null,
            customerPolicies: [],
            customerTopUps: [],
            contacts: [{ id: 5, customer_id: customerId, email: "a@test.com" }],
            customerBanks: [],
        },
    };
}

describe("CustomerCheckpointService restore", () => {
    const service = CustomerCheckpointService.getInstance();

    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock.$transaction.mockImplementation(
            async (callback: (tx: typeof prismaMock) => Promise<unknown>) =>
                callback(prismaMock)
        );
        prismaMock.activityAttachment.deleteMany.mockResolvedValue({ count: 0 });
        prismaMock.activityContact.deleteMany.mockResolvedValue({ count: 0 });
        prismaMock.communicationLearningData.deleteMany.mockResolvedValue({
            count: 0,
        });
        prismaMock.activity.deleteMany.mockResolvedValue({ count: 0 });
        prismaMock.disputeInvoice.deleteMany.mockResolvedValue({ count: 0 });
        prismaMock.customerDispute.deleteMany.mockResolvedValue({ count: 0 });
        prismaMock.invoicePayment.deleteMany.mockResolvedValue({ count: 0 });
        prismaMock.payment.deleteMany.mockResolvedValue({ count: 0 });
        prismaMock.invoice.deleteMany.mockResolvedValue({ count: 0 });
        prismaMock.customerCollectionPeriod.deleteMany.mockResolvedValue({
            count: 0,
        });
        prismaMock.customerTopUp.deleteMany.mockResolvedValue({ count: 0 });
        prismaMock.customerPolicy.deleteMany.mockResolvedValue({ count: 0 });
        prismaMock.customerAggregatedData.deleteMany.mockResolvedValue({
            count: 0,
        });
        prismaMock.customerBanks.deleteMany.mockResolvedValue({ count: 0 });
        prismaMock.contact.deleteMany.mockResolvedValue({ count: 0 });
        prismaMock.contact.createMany.mockResolvedValue({ count: 1 });
        prismaMock.customerBanks.createMany.mockResolvedValue({ count: 0 });
        prismaMock.customerPolicy.createMany.mockResolvedValue({ count: 0 });
        prismaMock.customerTopUp.createMany.mockResolvedValue({ count: 0 });
        prismaMock.customerCollectionPeriod.createMany.mockResolvedValue({
            count: 0,
        });
        prismaMock.invoice.createMany.mockResolvedValue({ count: 1 });
        prismaMock.payment.createMany.mockResolvedValue({ count: 0 });
        prismaMock.invoicePayment.createMany.mockResolvedValue({ count: 1 });
        prismaMock.customerDispute.createMany.mockResolvedValue({ count: 0 });
        prismaMock.disputeInvoice.createMany.mockResolvedValue({ count: 0 });
        prismaMock.activity.createMany.mockResolvedValue({ count: 1 });
        prismaMock.activityContact.createMany.mockResolvedValue({ count: 1 });
        prismaMock.customer.update.mockResolvedValue({});
    });

    it("throws when no checkpoint exists", async () => {
        prismaMock.customerCheckpoint.findUnique.mockResolvedValue(null);

        await expect(service.restoreCustomerCheckpoint(42, 7)).rejects.toThrow(
            CustomerCheckpointNotFoundError
        );
    });

    it("deletes subtree in reverse FK order then re-inserts from payload", async () => {
        const payload = buildCheckpointPayload();
        prismaMock.customerCheckpoint.findUnique.mockResolvedValue({ payload });

        const summary = await service.restoreCustomerCheckpoint(42, 7);

        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
        expect(prismaMock.activityAttachment.deleteMany).toHaveBeenCalledBefore(
            prismaMock.activity.deleteMany as ReturnType<typeof vi.fn>
        );
        expect(prismaMock.invoicePayment.deleteMany).toHaveBeenCalledWith({
            where: { customer_id: 42 },
        });
        expect(prismaMock.invoicePayment.createMany).toHaveBeenCalledWith({
            data: expect.arrayContaining([
                expect.objectContaining({
                    id: 10,
                    reference: "PAY-REF-1",
                }),
            ]),
        });
        expect(prismaMock.customer.update).toHaveBeenCalledWith({
            where: { id: 42 },
            data: expect.objectContaining({
                customer_uuid: "uuid-42",
                collection_status: "Active",
            }),
        });
        expect(summary.rowCounts).toEqual(
            expect.objectContaining({
                invoices: 1,
                invoicePayments: 1,
                activities: 1,
            })
        );
        expect(summary.restoredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("restores activity rows with bigint primary keys", async () => {
        const payload = buildCheckpointPayload();
        prismaMock.customerCheckpoint.findUnique.mockResolvedValue({ payload });

        await service.restoreCustomerCheckpoint(42, 7);

        expect(prismaMock.activity.createMany).toHaveBeenCalledWith({
            data: expect.arrayContaining([
                expect.objectContaining({
                    id: BigInt(100),
                    customer_id: 42,
                }),
            ]),
        });
        expect(prismaMock.activityContact.createMany).toHaveBeenCalledWith({
            data: expect.arrayContaining([
                expect.objectContaining({
                    activity_id: BigInt(100),
                    contact_id: 5,
                }),
            ]),
        });
    });

    it("runs post-restore recalc and insurance sync once", async () => {
        const payload = buildCheckpointPayload();
        prismaMock.customerCheckpoint.findUnique.mockResolvedValue({ payload });

        await service.restoreCustomerCheckpoint(42, 7);

        expect(mocks.recalculateAllAmountsForCustomers).toHaveBeenCalledTimes(1);
        expect(mocks.recalculateAllAmountsForCustomers).toHaveBeenCalledWith([42]);
        expect(mocks.syncCustomerInsuranceFields).toHaveBeenCalledTimes(1);
        expect(mocks.syncCustomerInsuranceFields).toHaveBeenCalledWith(42);
        expect(mocks.invalidateDashboardCacheForAccount).toHaveBeenCalledWith(7);
    });

    it("clears invoice payments before re-insert so references are reusable", async () => {
        const payload = buildCheckpointPayload();
        prismaMock.customerCheckpoint.findUnique.mockResolvedValue({ payload });

        await service.restoreCustomerCheckpoint(42, 7);

        const deleteOrder =
            prismaMock.invoicePayment.deleteMany.mock.invocationCallOrder[0];
        const createOrder =
            prismaMock.invoicePayment.createMany.mock.invocationCallOrder[0];
        expect(deleteOrder).toBeLessThan(createOrder);
        expect(prismaMock.invoicePayment.createMany).toHaveBeenCalledWith({
            data: [
                expect.objectContaining({
                    reference: "PAY-REF-1",
                    account_id: 7,
                    customer_id: 42,
                }),
            ],
        });
    });
});
