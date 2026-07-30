import { beforeEach, describe, expect, it, vi } from "vitest";

import { ImportPaymentService } from "@/server/services/import/ImportPaymentService";
import { createPrismaMock } from "@/test/mocks/prisma";

const mockCreateInvoicePayment = vi.fn();
const mockCreateDeferredInvoicePayment = vi.fn();

const { prismaHolder } = vi.hoisted(() => ({
    prismaHolder: {
        prisma: null as ReturnType<typeof createPrismaMock> | null,
    },
}));

vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    prismaHolder.prisma = createPrismaMock();
    return {
        prismaJobs: () => prismaHolder.prisma!,
    };
});

vi.mock("@/server/services/CustomerService", () => ({
    CustomerService: {
        findCustomersByCustomerNumber: vi.fn(),
    },
}));

vi.mock("@/server/services/PaymentService", () => ({
    PaymentService: vi.fn().mockImplementation(() => ({
        createInvoicePayment: mockCreateInvoicePayment,
        createDeferredInvoicePayment: mockCreateDeferredInvoicePayment,
    })),
}));

describe("ImportPaymentService", () => {
    let mockPrisma: ReturnType<typeof createPrismaMock>;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockPrisma = prismaHolder.prisma!;
        const { CustomerService } = await import(
            "@/server/services/CustomerService"
        );
        vi.mocked(
            CustomerService.findCustomersByCustomerNumber
        ).mockResolvedValue(new Map([["CUST-1", 42]]));
    });

    it("skips existing payment by account_id, customer_id, and reference", async () => {
        mockPrisma.invoice.findFirst.mockResolvedValue({ id: 100 });
        mockPrisma.invoicePayment.findFirst.mockResolvedValue({ id: 999 });

        const service = new ImportPaymentService();
        const results = await service.importPayments(
            [
                {
                    account_id: 1,
                    customer_number: "CUST-1",
                    invoice_number: "INV-1",
                    payment_date: "2024-01-01",
                    amount: 100,
                    customer_amount: 100,
                    customer_currency: "USD",
                    reference: "PAY-REF-1",
                },
            ],
            1
        );

        expect(results).toEqual([
            {
                index: 0,
                success: true,
                skipped: true,
                invoicePaymentId: 999,
                customerId: 42,
                message: "import.results.paymentSkipped",
            },
        ]);
        expect(mockCreateInvoicePayment).not.toHaveBeenCalled();
    });

    it("creates deferred payment when invoice does not exist", async () => {
        mockPrisma.invoice.findFirst.mockResolvedValue(null);
        mockPrisma.invoicePayment.findFirst.mockResolvedValue(null);
        mockCreateDeferredInvoicePayment.mockResolvedValue({ id: 777 });

        const service = new ImportPaymentService();
        const results = await service.importPayments(
            [
                {
                    account_id: 1,
                    customer_number: "CUST-1",
                    invoice_number: "INV-MISSING",
                    payment_date: "2024-01-01",
                    amount: 100,
                    customer_amount: 100,
                    customer_currency: "USD",
                    reference: "PAY-DEFERRED",
                },
            ],
            1
        );

        expect(results[0]).toEqual({
            index: 0,
            success: true,
            deferred: true,
            invoicePaymentId: 777,
            customerId: 42,
            message: "import.results.paymentDeferred",
        });
        expect(mockCreateDeferredInvoicePayment).toHaveBeenCalledWith(
            expect.objectContaining({
                invoice_number: "INV-MISSING",
                amount: 100,
                customer_amount: 100,
                customer_currency: "USD",
                reference: "PAY-DEFERRED",
            })
        );
        expect(mockCreateInvoicePayment).not.toHaveBeenCalled();
    });

    it("uses customer_amount as base amount for deferred rows when amount omitted", async () => {
        mockPrisma.invoice.findFirst.mockResolvedValue(null);
        mockPrisma.invoicePayment.findFirst.mockResolvedValue(null);
        mockCreateDeferredInvoicePayment.mockResolvedValue({ id: 778 });

        const service = new ImportPaymentService();
        await service.importPayments(
            [
                {
                    account_id: 1,
                    customer_number: "CUST-1",
                    invoice_number: "INV-MISSING",
                    payment_date: "2024-01-01",
                    customer_amount: 250,
                    customer_currency: "USD",
                    reference: "PAY-DEFERRED-NO-BASE",
                },
            ],
            1
        );

        expect(mockCreateDeferredInvoicePayment).toHaveBeenCalledWith(
            expect.objectContaining({
                amount: 250,
                customer_amount: 250,
            })
        );
    });

    it("creates payment when reference does not exist yet", async () => {
        mockPrisma.invoice.findFirst.mockResolvedValue({
            id: 100,
            amount: 1000,
            customer_amount: 1000,
            customer_currency: "USD",
        });
        mockPrisma.invoicePayment.findFirst.mockResolvedValue(null);
        mockCreateInvoicePayment.mockResolvedValue({
            invoicePayment: { id: 555 },
            updatedInvoice: {},
        });

        const service = new ImportPaymentService();
        const results = await service.importPayments(
            [
                {
                    account_id: 1,
                    customer_number: "CUST-1",
                    invoice_number: "INV-1",
                    payment_date: "2024-01-01",
                    amount: 100,
                    customer_amount: 100,
                    customer_currency: "USD",
                    reference: "PAY-REF-NEW",
                    payment_method: "Wire",
                },
            ],
            1
        );

        expect(results[0]).toMatchObject({
            index: 0,
            success: true,
            invoicePaymentId: 555,
            customerId: 42,
        });
        expect(mockCreateInvoicePayment).toHaveBeenCalledWith(
            expect.objectContaining({
                amount: 100,
                customer_amount: 100,
                customer_currency: "USD",
            }),
            { skipArPostIngest: true }
        );
    });

    it("derives base amount when omitted and passes resolved amount to create", async () => {
        mockPrisma.invoice.findFirst.mockResolvedValue({
            id: 100,
            amount: 1000,
            customer_amount: 1200,
            customer_currency: "EUR",
        });
        mockPrisma.invoicePayment.findFirst.mockResolvedValue(null);
        mockCreateInvoicePayment.mockResolvedValue({
            invoicePayment: { id: 556 },
            updatedInvoice: {},
        });

        const record = {
            account_id: 1,
            company_code: "COMP001",
            customer_number: "CUST-1",
            invoice_number: "INV-1",
            payment_date: "2024-01-01",
            customer_amount: 600,
            customer_currency: "EUR",
            reference: "PAY-DERIVED",
        };

        const service = new ImportPaymentService();
        const results = await service.importPayments([record], 1);

        expect(results[0]).toMatchObject({
            index: 0,
            success: true,
            invoicePaymentId: 556,
        });
        expect(record.amount).toBe(500);
        expect(mockCreateInvoicePayment).toHaveBeenCalledWith(
            expect.objectContaining({
                amount: 500,
                customer_amount: 600,
                customer_currency: "EUR",
                invoice_number: "INV-1",
            }),
            { skipArPostIngest: true }
        );
    });

    it("returns resolver error without creating payment when derivation fails", async () => {
        mockPrisma.invoice.findFirst.mockResolvedValue({
            id: 100,
            amount: 1000,
            customer_amount: 1200,
            customer_currency: "EUR",
        });
        mockPrisma.invoicePayment.findFirst.mockResolvedValue(null);

        const service = new ImportPaymentService();
        const results = await service.importPayments(
            [
                {
                    account_id: 1,
                    customer_number: "CUST-1",
                    invoice_number: "INV-1",
                    payment_date: "2024-01-01",
                    customer_amount: 600,
                    customer_currency: "USD",
                    reference: "PAY-MISMATCH",
                },
            ],
            1
        );

        expect(results[0]).toEqual({
            index: 0,
            success: false,
            message: "import.validation.paymentCurrencyMismatch",
        });
        expect(mockCreateInvoicePayment).not.toHaveBeenCalled();
    });
});
