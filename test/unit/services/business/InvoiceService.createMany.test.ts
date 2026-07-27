import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    findCustomersByCustomerNumber: vi.fn(),
    sweepReportingBreachForOverdueInvoiceIds: vi
        .fn()
        .mockResolvedValue(undefined),
    syncInvoiceReportingBreach: vi.fn().mockResolvedValue(undefined),
    loadEffectiveInsuranceForCustomers: vi
        .fn()
        .mockResolvedValue(new Map()),
    invalidateDashboardCacheForAccount: vi.fn().mockResolvedValue(undefined),
    logMessage: vi.fn().mockResolvedValue(undefined),
    syncCustomerInsuranceFields: vi.fn().mockResolvedValue(undefined),
    restampCustomerOpenInvoiceLimitAssessment: vi.fn().mockResolvedValue(0),
    resolveEffectiveApprovedLimit: vi.fn().mockResolvedValue({
        topUpTotalInLimitCurrency: 0,
    }),
}));

vi.mock("@/lib/prisma", async (importOriginal) => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    const actual = await importOriginal<typeof import("@/lib/prisma")>();
    return {
        ...actual,
        prisma: createPrismaMock(),
    };
});

vi.mock("@/server/services/CustomerService", () => ({
    CustomerService: {
        findCustomersByCustomerNumber: mocks.findCustomersByCustomerNumber,
        recalculateAllAmountsForCustomers: vi.fn().mockResolvedValue(new Map()),
    },
}));

vi.mock("@/server/services/creditInsurance/loadEffectiveInsuranceForCustomers", () => ({
    loadEffectiveInsuranceForCustomers: mocks.loadEffectiveInsuranceForCustomers,
}));

vi.mock("@/server/services/creditInsurance/syncInvoiceReportingBreach", () => ({
    sweepReportingBreachForOverdueInvoiceIds:
        mocks.sweepReportingBreachForOverdueInvoiceIds,
    syncInvoiceReportingBreach: mocks.syncInvoiceReportingBreach,
}));

vi.mock("@/server/utils/cacheInvalidationHelper", () => ({
    invalidateDashboardCacheForAccount: mocks.invalidateDashboardCacheForAccount,
}));

vi.mock("@/server/services/creditInsurance/syncCustomerInsuranceFields", () => ({
    syncCustomerInsuranceFields: mocks.syncCustomerInsuranceFields,
}));

vi.mock(
    "@/server/services/creditInsurance/restampCustomerLimitAssessment",
    async (importOriginal) => {
        const actual = await importOriginal<
            typeof import("@/server/services/creditInsurance/restampCustomerLimitAssessment")
        >();
        return {
            ...actual,
            restampCustomerOpenInvoiceLimitAssessment:
                mocks.restampCustomerOpenInvoiceLimitAssessment,
        };
    }
);

vi.mock(
    "@/server/services/creditInsurance/resolveEffectiveApprovedLimit",
    () => ({
        resolveEffectiveApprovedLimit: mocks.resolveEffectiveApprovedLimit,
    })
);

const mockLogServiceInstance = {
    logMessage: mocks.logMessage,
};

vi.mock("@/server/services/LogService", () => ({
    LogService: {
        getInstance: vi.fn(() => mockLogServiceInstance),
    },
}));

import { prisma } from "@/lib/prisma";
import { InvoiceService } from "@/server/services/InvoiceService";

describe("InvoiceService.createMany", () => {
    let mockPrisma: any;
    let service: InvoiceService;

    beforeEach(() => {
        vi.clearAllMocks();

        mockPrisma = prisma;
        mockPrisma.$transaction.mockImplementation((callback: any) =>
            callback(mockPrisma)
        );
        mockPrisma.$queryRaw.mockResolvedValue([]);
        mockPrisma.insurancePolicy = {
            findMany: vi.fn().mockResolvedValue([]),
        };
        mockPrisma.account.findUnique.mockResolvedValue({
            balance_evaluation_method: "Invoice-Based",
        });
        mockPrisma.invoice.createMany.mockResolvedValue({ count: 1 });
        mockPrisma.invoice.update.mockResolvedValue({});
        mockPrisma.invoice.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.invoicePayment.create.mockResolvedValue({ id: 500 });
        mockPrisma.invoice.findMany.mockResolvedValue([
            {
                id: 101,
                account_id: 7,
                customer_id: 11,
                invoice_number: "INV-1",
                status: "Due",
                amount: 100,
                net_amount: 100,
                customer_amount: 100,
                customer_net_amount: 100,
                total_paid: 40,
                customer_total_paid: 40,
                outstanding_debt: 60,
                customer_outstanding_debt: 60,
                customer_currency: "USD",
                due_date: new Date("2026-05-15T00:00:00.000Z"),
                invoice_date: new Date("2026-05-01T00:00:00.000Z"),
            },
        ]);

        mocks.findCustomersByCustomerNumber.mockResolvedValue(
            new Map([["C-1", 11]])
        );

        service = new InvoiceService();
        vi.spyOn(InvoiceService, "getInvoicesByInvoiceNumber").mockResolvedValue(
            new Map()
        );
        vi.spyOn(service, "handleInvoiceChange").mockResolvedValue(undefined);
        vi.spyOn(
            service as unknown as {
                syncOldestOverdueDateOnImportedInvoices: (
                    affectedInvoices: Array<{
                        id: number;
                        customer_id: number | null;
                    }>,
                    dbClient?: unknown
                ) => Promise<void>;
            },
            "syncOldestOverdueDateOnImportedInvoices"
        ).mockResolvedValue(undefined);
    });

    it("keeps invoice import writes inside one transaction", async () => {
        const result = await service.createMany([
            {
                account_id: 7,
                customer_number: "C-1",
                status: "Due",
                invoice_date: "2026-05-01",
                due_date: "2026-05-15",
                amount: 100,
                customer_amount: 100,
                total_paid: 40,
                customer_total_paid: 40,
                customer_currency: "USD",
                invoice_number: "INV-1",
            },
        ]);

        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
        expect(mockPrisma.invoice.createMany).toHaveBeenCalledTimes(1);
        expect(mockPrisma.invoicePayment.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                invoice_id: 101,
                amount: 40,
                customer_id: 11,
                account_id: 7,
                customer_amount: 40,
                payment_method: "Import",
            }),
        });
        expect(service.handleInvoiceChange).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 101,
                customer_id: 11,
            }),
            {
                runPostCommitEffects: false,
                skipInsuranceRecompute: true,
            }
        );
        expect(
            mocks.sweepReportingBreachForOverdueInvoiceIds
        ).toHaveBeenCalledWith([101]);
        expect(mocks.invalidateDashboardCacheForAccount).toHaveBeenCalledWith(7);
        expect(mocks.restampCustomerOpenInvoiceLimitAssessment).toHaveBeenCalledWith(
            11,
            { accountCurrency: null }
        );
        expect(mocks.syncCustomerInsuranceFields).toHaveBeenCalledTimes(1);
        expect(mocks.syncCustomerInsuranceFields).toHaveBeenCalledWith(11, {
            invoiceIds: [101],
        });
        expect(result.affectedCustomerIds).toEqual([11]);
        expect(result.results).toEqual([
            expect.objectContaining({
                index: 0,
                success: true,
                invoiceId: 101,
            }),
        ]);
    });

    it("updates only payment fields when re-importing an existing invoice", async () => {
        vi.spyOn(InvoiceService, "getInvoicesByInvoiceNumber").mockResolvedValue(
            new Map([
                [
                    "INV-EXISTING",
                    {
                        id: 202,
                        status: "Due",
                        customer_id: 11,
                    },
                ],
            ])
        );

        const existingDueDate = new Date("2026-01-10T00:00:00.000Z");
        const existingInvoiceDate = new Date("2026-01-01T00:00:00.000Z");

        mockPrisma.invoice.findUnique.mockResolvedValue({
            id: 202,
            total_paid: 20,
            customer_total_paid: 20,
            amount: 100,
            customer_amount: 100,
        });

        mockPrisma.invoice.findMany.mockResolvedValue([
            {
                id: 202,
                account_id: 7,
                customer_id: 11,
                invoice_number: "INV-EXISTING",
                status: "Due",
                amount: 100,
                net_amount: 100,
                customer_amount: 100,
                customer_net_amount: 100,
                total_paid: 60,
                customer_total_paid: 60,
                outstanding_debt: 40,
                customer_outstanding_debt: 40,
                customer_currency: "USD",
                due_date: existingDueDate,
                invoice_date: existingInvoiceDate,
                payment_term: 30,
                target_reporting_date: new Date("2026-02-01T00:00:00.000Z"),
            },
        ]);

        const result = await service.createMany([
            {
                account_id: 7,
                customer_number: "C-1",
                status: "Overdue",
                invoice_date: "2026-06-01",
                due_date: "2026-06-15",
                amount: 999,
                customer_amount: 999,
                total_paid: 60,
                customer_total_paid: 60,
                customer_currency: "USD",
                invoice_number: "INV-EXISTING",
            },
        ]);

        expect(mockPrisma.invoice.createMany).not.toHaveBeenCalled();
        expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
            where: { id: 202 },
            data: {
                total_paid: 60,
                customer_total_paid: 60,
            },
        });
        expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
            where: { id: 202 },
            data: expect.objectContaining({
                outstanding_debt: 40,
                customer_outstanding_debt: 40,
            }),
        });
        expect(mockPrisma.invoice.update).not.toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    due_date: expect.anything(),
                }),
            })
        );
        expect(mockPrisma.invoicePayment.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                invoice_id: 202,
                amount: 40,
                customer_amount: 40,
                payment_method: "Import",
            }),
        });
        expect(result.results).toEqual([
            expect.objectContaining({
                index: 0,
                success: true,
                invoiceId: 202,
            }),
        ]);
        expect(mocks.syncCustomerInsuranceFields).toHaveBeenCalledWith(11, {
            invoiceIds: [202],
        });
        expect(mocks.restampCustomerOpenInvoiceLimitAssessment).not.toHaveBeenCalled();
    });

    it("fails when invoice number belongs to a different customer", async () => {
        vi.spyOn(InvoiceService, "getInvoicesByInvoiceNumber").mockResolvedValue(
            new Map([
                [
                    "INV-OTHER-CUSTOMER",
                    {
                        id: 303,
                        status: "Due",
                        customer_id: 99,
                    },
                ],
            ])
        );
        mockPrisma.invoice.findMany.mockResolvedValue([]);

        const result = await service.createMany([
            {
                account_id: 7,
                customer_number: "C-1",
                status: "Due",
                invoice_date: "2026-05-01",
                due_date: "2026-05-15",
                amount: 100,
                customer_amount: 100,
                total_paid: 0,
                customer_total_paid: 0,
                customer_currency: "USD",
                invoice_number: "INV-OTHER-CUSTOMER",
            },
        ]);

        expect(mockPrisma.invoice.createMany).not.toHaveBeenCalled();
        expect(result.results).toEqual([
            expect.objectContaining({
                index: 0,
                success: false,
                message:
                    "import.results.processingFailed: Invoice number already assigned to another customer",
            }),
        ]);
    });

    it("stamps dual-currency import limit_assessed_amount using base-currency outstanding", async () => {
        mocks.loadEffectiveInsuranceForCustomers.mockResolvedValue(
            new Map([
                [
                    11,
                    {
                        id: 11,
                        reporting_days: 30,
                        max_allowed_mep: 90,
                        max_payment_term: null,
                        overdue_block: false,
                        excluded_from_policy: false,
                        credit_score_input_date: null,
                        policy_id: 5,
                        limit_type: "DCL",
                        credit_score: null,
                        active_customer_since: null,
                        approved_limit: 10_000,
                        approved_limit_currency: "ILS",
                    },
                ],
            ])
        );
        mockPrisma.account.findUnique.mockResolvedValue({
            balance_evaluation_method: "Invoice-Based",
            currency: "ILS",
        });
        mockPrisma.insurancePolicy.findMany.mockResolvedValue([
            {
                id: 5,
                end_date: null,
                score_validity_period_months: 12,
                min_credit_score: 0,
                dcl_customer_since_months: 0,
            },
        ]);
        mockPrisma.invoice.createMany.mockResolvedValue({ count: 3 });
        mockPrisma.invoice.findMany
            .mockResolvedValueOnce([])
            .mockResolvedValue([
                {
                    id: 101,
                    account_id: 7,
                    customer_id: 11,
                    invoice_number: "INV-1",
                    status: "Due",
                    amount: 5000,
                    net_amount: 5000,
                    customer_amount: 1000,
                    customer_net_amount: 1000,
                    total_paid: 0,
                    customer_total_paid: 0,
                    outstanding_debt: 5000,
                    customer_outstanding_debt: 1000,
                    customer_currency: "GBP",
                    due_date: new Date("2026-07-02T00:00:00.000Z"),
                    invoice_date: new Date("2026-06-22T00:00:00.000Z"),
                },
                {
                    id: 102,
                    account_id: 7,
                    customer_id: 11,
                    invoice_number: "INV-2",
                    status: "Due",
                    amount: 4500,
                    net_amount: 4500,
                    customer_amount: 1000,
                    customer_net_amount: 1000,
                    total_paid: 0,
                    customer_total_paid: 0,
                    outstanding_debt: 4500,
                    customer_outstanding_debt: 1000,
                    customer_currency: "GBP",
                    due_date: new Date("2026-09-02T00:00:00.000Z"),
                    invoice_date: new Date("2026-06-23T00:00:00.000Z"),
                },
                {
                    id: 103,
                    account_id: 7,
                    customer_id: 11,
                    invoice_number: "INV-3",
                    status: "Due",
                    amount: 4000,
                    net_amount: 4000,
                    customer_amount: 1000,
                    customer_net_amount: 1000,
                    total_paid: 0,
                    customer_total_paid: 0,
                    outstanding_debt: 4000,
                    customer_outstanding_debt: 1000,
                    customer_currency: "GBP",
                    due_date: new Date("2026-07-02T00:00:00.000Z"),
                    invoice_date: new Date("2026-06-24T00:00:00.000Z"),
                },
            ]);

        await service.createMany([
            {
                account_id: 7,
                customer_number: "C-1",
                status: "Due",
                invoice_date: "2026-06-22",
                due_date: "2026-07-02",
                amount: 5000,
                customer_amount: 1000,
                customer_currency: "GBP",
                invoice_number: "INV-1",
            },
            {
                account_id: 7,
                customer_number: "C-1",
                status: "Due",
                invoice_date: "2026-06-23",
                due_date: "2026-09-02",
                amount: 4500,
                customer_amount: 1000,
                customer_currency: "GBP",
                invoice_number: "INV-2",
            },
            {
                account_id: 7,
                customer_number: "C-1",
                status: "Due",
                invoice_date: "2026-06-24",
                due_date: "2026-07-02",
                amount: 4000,
                customer_amount: 1000,
                customer_currency: "GBP",
                invoice_number: "INV-3",
            },
        ]);

        expect(mockPrisma.invoice.createMany).toHaveBeenCalledTimes(1);
        const createdRows = mockPrisma.invoice.createMany.mock.calls[0][0].data;
        expect(createdRows).toHaveLength(3);
        expect(createdRows[0].outstanding_debt).toBe(5000);
        expect(createdRows[1].outstanding_debt).toBe(4500);
        expect(createdRows[2].outstanding_debt).toBe(4000);
        expect(Number(createdRows[0].limit_assessed_amount)).toBe(5000);
        expect(Number(createdRows[1].limit_assessed_amount)).toBe(4500);
        expect(Number(createdRows[2].limit_assessed_amount)).toBe(500);
        expect(mocks.restampCustomerOpenInvoiceLimitAssessment).toHaveBeenCalledWith(
            11,
            { accountCurrency: "ILS" }
        );
    });
});
