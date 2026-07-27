/**
 * Unit Test: linkDeferredPaymentAndRecalc
 *
 * Tests: deferred payment promotion, invoice recalc, idempotent re-link guard
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

import {
    linkDeferredPaymentAndRecalc,
    recalculateInvoiceFromLinkedPayments,
    runInvoicePaymentSideEffects,
} from "@/server/services/invoicePayment/linkDeferredPaymentAndRecalc";
import { validateInvoicePaymentFields } from "@/server/services/invoicePayment/validateInvoicePaymentFields";
import { createPrismaMock } from "@/test/mocks/prisma";

vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    return {
        prisma: createPrismaMock(),
    };
});

const mockSyncCustomerInsuranceFields = vi.fn().mockResolvedValue(undefined);

vi.mock("@/server/services/CustomerService", () => ({
    CustomerService: {
        recalculateAllAmountsForCustomers: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock("@/server/services/creditInsurance/syncCustomerInsuranceFields", () => ({
    syncCustomerInsuranceFields: mockSyncCustomerInsuranceFields,
}));

vi.mock("@/server/utils/cacheInvalidationHelper", () => ({
    invalidateDashboardCacheForAccount: vi.fn().mockResolvedValue(undefined),
}));

describe("validateInvoicePaymentFields", () => {
    it("requires invoice_number when invoice_id is null", () => {
        expect(() =>
            validateInvoicePaymentFields({ invoice_id: null, invoice_number: "" })
        ).toThrow("invoice_number is required when invoice_id is null");
    });

    it("allows deferred payment when invoice_number is set", () => {
        expect(() =>
            validateInvoicePaymentFields({
                invoice_id: null,
                invoice_number: "INV-100",
            })
        ).not.toThrow();
    });

    it("allows linked payment without invoice_number", () => {
        expect(() =>
            validateInvoicePaymentFields({ invoice_id: 1 })
        ).not.toThrow();
    });
});

describe("linkDeferredPaymentAndRecalc", () => {
    let mockPrisma: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        const { prisma } = await import("@/lib/prisma");
        mockPrisma = prisma;
        mockPrisma.$transaction.mockImplementation((callback: any) =>
            callback(mockPrisma)
        );
    });

    it("links a deferred payment and recalculates invoice totals", async () => {
        const deferredPayment = {
            id: 10,
            invoice_id: null,
            invoice_number: "INV-001",
            customer_id: 1,
            account_id: 1,
            amount: 500,
            customer_amount: 500,
        };

        mockPrisma.invoicePayment.findUnique.mockResolvedValue(deferredPayment);
        mockPrisma.invoicePayment.update.mockResolvedValue({
            ...deferredPayment,
            invoice_id: 5,
        });
        mockPrisma.invoicePayment.aggregate.mockResolvedValue({
            _sum: { amount: 500, customer_amount: 500 },
        });
        mockPrisma.invoice.findUnique.mockResolvedValue({
            id: 5,
            net_amount: 1000,
            customer_net_amount: 1000,
            status: "Due",
        });
        mockPrisma.invoice.update.mockResolvedValue({
            id: 5,
            total_paid: 500,
            customer_total_paid: 500,
            outstanding_debt: 500,
            customer_outstanding_debt: 500,
            status: "Due",
        });

        const result = await linkDeferredPaymentAndRecalc({
            invoicePaymentId: 10,
            invoiceId: 5,
        });

        expect(mockPrisma.invoicePayment.update).toHaveBeenCalledWith({
            where: { id: 10 },
            data: { invoice_id: 5 },
        });
        expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
            where: { id: 5 },
            data: expect.objectContaining({
                total_paid: 500,
                customer_total_paid: 500,
                outstanding_debt: 500,
                customer_outstanding_debt: 500,
            }),
        });
        expect(result.alreadyLinked).toBe(false);
        expect(result.updatedInvoice.total_paid).toBe(500);

        const { CustomerService } = await import("@/server/services/CustomerService");
        expect(CustomerService.recalculateAllAmountsForCustomers).toHaveBeenCalledWith(
            [1]
        );
        expect(mockSyncCustomerInsuranceFields).toHaveBeenCalledWith(1, {
            invoiceIds: [5],
        });
    });

    it("marks invoice as Paid when customer outstanding reaches zero", async () => {
        mockPrisma.invoicePayment.findUnique.mockResolvedValue({
            id: 10,
            invoice_id: null,
            customer_id: 1,
            account_id: 1,
        });
        mockPrisma.invoicePayment.update.mockResolvedValue({
            id: 10,
            invoice_id: 5,
            customer_id: 1,
            account_id: 1,
        });
        mockPrisma.invoicePayment.aggregate.mockResolvedValue({
            _sum: { amount: 1000, customer_amount: 1000 },
        });
        mockPrisma.invoice.findUnique.mockResolvedValue({
            id: 5,
            net_amount: 1000,
            customer_net_amount: 1000,
            status: "Due",
        });
        mockPrisma.invoice.update.mockResolvedValue({
            id: 5,
            status: "Paid",
        });

        await linkDeferredPaymentAndRecalc({
            invoicePaymentId: 10,
            invoiceId: 5,
        });

        expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
            where: { id: 5 },
            data: expect.objectContaining({
                status: "Paid",
                zero_limit_alert: false,
                reporting_breach: false,
            }),
        });
    });

    it("is idempotent when payment is already linked to the same invoice", async () => {
        const linkedPayment = {
            id: 10,
            invoice_id: 5,
            customer_id: 1,
            account_id: 1,
        };
        const invoice = {
            id: 5,
            total_paid: 500,
            outstanding_debt: 500,
        };

        mockPrisma.invoicePayment.findUnique.mockResolvedValue(linkedPayment);
        mockPrisma.invoice.findUnique.mockResolvedValue(invoice);

        const result = await linkDeferredPaymentAndRecalc({
            invoicePaymentId: 10,
            invoiceId: 5,
        });

        expect(mockPrisma.invoicePayment.update).not.toHaveBeenCalled();
        expect(mockPrisma.invoice.update).not.toHaveBeenCalled();
        expect(result.alreadyLinked).toBe(true);

        const { CustomerService } = await import("@/server/services/CustomerService");
        expect(CustomerService.recalculateAllAmountsForCustomers).not.toHaveBeenCalled();
        expect(mockSyncCustomerInsuranceFields).not.toHaveBeenCalled();
    });

    it("recalculates when forceRecalc is true and payment is already linked", async () => {
        const linkedPayment = {
            id: 10,
            invoice_id: 5,
            customer_id: 1,
            account_id: 1,
        };

        mockPrisma.invoicePayment.findUnique.mockResolvedValue(linkedPayment);
        mockPrisma.invoicePayment.aggregate.mockResolvedValue({
            _sum: { amount: 150, customer_amount: 150 },
        });
        mockPrisma.invoice.findUnique.mockResolvedValue({
            id: 5,
            net_amount: 250,
            customer_net_amount: 250,
            status: "Due",
        });
        mockPrisma.invoice.update.mockResolvedValue({
            id: 5,
            total_paid: 150,
            outstanding_debt: 100,
        });

        const result = await linkDeferredPaymentAndRecalc({
            invoicePaymentId: 10,
            invoiceId: 5,
            forceRecalc: true,
        });

        expect(mockPrisma.invoicePayment.update).not.toHaveBeenCalled();
        expect(mockPrisma.invoice.update).toHaveBeenCalled();
        expect(result.alreadyLinked).toBe(true);
        expect(result.updatedInvoice.outstanding_debt).toBe(100);
    });

    it("throws when payment is linked to a different invoice", async () => {
        mockPrisma.invoicePayment.findUnique.mockResolvedValue({
            id: 10,
            invoice_id: 99,
            customer_id: 1,
            account_id: 1,
        });

        await expect(
            linkDeferredPaymentAndRecalc({
                invoicePaymentId: 10,
                invoiceId: 5,
            })
        ).rejects.toThrow(
            "InvoicePayment 10 is already linked to invoice 99"
        );
    });

    it("throws when payment is not found", async () => {
        mockPrisma.invoicePayment.findUnique.mockResolvedValue(null);

        await expect(
            linkDeferredPaymentAndRecalc({
                invoicePaymentId: 10,
                invoiceId: 5,
            })
        ).rejects.toThrow("InvoicePayment 10 not found");
    });
});

describe("recalculateInvoiceFromLinkedPayments", () => {
    let mockPrisma: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        const { prisma } = await import("@/lib/prisma");
        mockPrisma = prisma;
    });

    it("aggregates only linked payments for the invoice", async () => {
        mockPrisma.invoicePayment.aggregate.mockResolvedValue({
            _sum: { amount: 800, customer_amount: 800 },
        });
        mockPrisma.invoice.findUnique.mockResolvedValue({
            id: 5,
            net_amount: 1000,
            customer_net_amount: 1000,
            status: "Due",
        });
        mockPrisma.invoice.update.mockResolvedValue({ id: 5 });

        await recalculateInvoiceFromLinkedPayments(mockPrisma, 5);

        expect(mockPrisma.invoicePayment.aggregate).toHaveBeenCalledWith({
            where: { invoice_id: 5 },
            _sum: { amount: true, customer_amount: true },
        });
    });
});

describe("runInvoicePaymentSideEffects", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("runs customer recalc, insurance sync, and cache invalidation", async () => {
        await runInvoicePaymentSideEffects({
            customerId: 1,
            accountId: 2,
            invoiceId: 5,
        });

        const { CustomerService } = await import("@/server/services/CustomerService");
        expect(CustomerService.recalculateAllAmountsForCustomers).toHaveBeenCalledWith(
            [1]
        );
        expect(mockSyncCustomerInsuranceFields).toHaveBeenCalledWith(1, {
            invoiceIds: [5],
        });

        const { invalidateDashboardCacheForAccount } = await import(
            "@/server/utils/cacheInvalidationHelper"
        );
        expect(invalidateDashboardCacheForAccount).toHaveBeenCalledWith(2);
    });
});
