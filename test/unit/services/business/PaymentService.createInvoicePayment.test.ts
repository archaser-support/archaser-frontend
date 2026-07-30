/**
 * Unit Test: PaymentService.createInvoicePayment
 * 
 * Tests: Payment creation functionality including invoice updates, outstanding calculations, and status changes
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

import { PaymentService } from "@/server/services/PaymentService";
import { createMockPayment, createMockPaymentInput } from "@/test/fixtures/services/payment";
import { createPrismaMock } from "@/test/mocks/prisma";

// Mock dependencies
vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    return {
        prisma: createPrismaMock(),
    };
});

const mockLogServiceInstance = {
    logMessage: vi.fn().mockResolvedValue(undefined),
};
const mockSyncCustomerInsuranceFields = vi.fn().mockResolvedValue(undefined);

vi.mock("@/server/services/LogService", () => ({
    LogService: {
        getInstance: vi.fn(() => mockLogServiceInstance),
    },
    LogLevel: {
        ERROR: "ERROR",
        INFO: "INFO",
    },
}));

vi.mock("@/server/services/CustomerService", () => ({
    CustomerService: {
        recalculateAllAmountsForCustomers: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock("@/server/services/creditInsurance/syncCustomerInsuranceFields", () => ({
    syncCustomerInsuranceFields: mockSyncCustomerInsuranceFields,
}));

const mockEnqueueAsOfRewrite = vi.fn().mockResolvedValue(undefined);
const mockRunArPostIngestForCustomers = vi.fn().mockResolvedValue({
    replayStats: null,
    maturityResult: null,
});
const FIXED_TODAY_UTC = new Date("2026-07-29T00:00:00.000Z");

vi.mock("@/server/services/creditInsurance/asOfRewriteQueue", () => ({
    enqueueAsOfRewrite: (...args: unknown[]) => mockEnqueueAsOfRewrite(...args),
}));

vi.mock("@/server/services/import/arPostIngestForCustomers", () => ({
    runArPostIngestForCustomers: (...args: unknown[]) =>
        mockRunArPostIngestForCustomers(...args),
}));

vi.mock("@/shared/creditInsurance/insurancePolicyLifecycle", async () => {
    const actual = await vi.importActual<
        typeof import("@/shared/creditInsurance/insurancePolicyLifecycle")
    >("@/shared/creditInsurance/insurancePolicyLifecycle");
    return {
        ...actual,
        startOfTodayUtc: vi.fn(() => new Date(FIXED_TODAY_UTC)),
    };
});

describe("PaymentService.createInvoicePayment", () => {
    let mockPrisma: any;
    let paymentService: PaymentService;

    async function stubSuccessfulPaymentCreate(paymentData: {
        invoice_id: number;
        customer_id: number;
        account_id: number;
        amount: number;
        customer_amount: number;
        customer_currency: string;
        payment_date: Date;
        payment_method: string;
        reference: string;
    }) {
        mockPrisma.invoicePayment.create.mockResolvedValue({
            id: 1,
            ...paymentData,
        });
        mockPrisma.invoicePayment.aggregate.mockResolvedValue({
            _sum: {
                amount: paymentData.amount,
                customer_amount: paymentData.customer_amount,
            },
        });
        mockPrisma.invoice.update.mockResolvedValue({
            id: paymentData.invoice_id,
            total_paid: paymentData.amount,
            customer_total_paid: paymentData.customer_amount,
            outstanding_debt: 500.0,
            customer_outstanding_debt: 500.0,
            status_id: 1,
        });
    }

    beforeEach(async () => {
        vi.clearAllMocks();
        
        const { prisma } = await import("@/lib/prisma");
        mockPrisma = prisma;
        mockPrisma.$transaction.mockImplementation((callback: any) =>
            callback(mockPrisma)
        );
        
        paymentService = new PaymentService();

        // Default invoice mock
        mockPrisma.invoice.findUnique.mockResolvedValue({
            id: 1,
            invoice_number: "INV001",
            net_amount: 1000.0,
            customer_net_amount: 1000.0,
            status: "Due", // DUE
        });
    });

    describe("create payment", () => {
        it("should create a payment and update invoice", async () => {
            // Arrange
            const paymentData = {
                invoice_id: 1,
                customer_id: 1,
                account_id: 1,
                amount: 500.0,
                customer_amount: 500.0,
                customer_currency: "USD",
                payment_date: new Date("2024-01-15"),
                payment_method: "Bank Transfer",
                reference: "PAY-001",
            };

            mockPrisma.invoicePayment.create.mockResolvedValue({
                id: 1,
                ...paymentData,
            });

            mockPrisma.invoicePayment.aggregate.mockResolvedValue({
                _sum: {
                    amount: 500.0,
                    customer_amount: 500.0,
                },
            });

            mockPrisma.invoice.update.mockResolvedValue({
                id: 1,
                total_paid: 500.0,
                customer_total_paid: 500.0,
                outstanding_debt: 500.0,
                customer_outstanding_debt: 500.0,
                status_id: 1,
            });

            // Act
            const result = await paymentService.createInvoicePayment(paymentData);

            // Assert
            expect(mockPrisma.invoicePayment.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    invoice_id: 1,
                    invoice_number: "INV001",
                    amount: 500.0,
                    customer_amount: 500.0,
                    customer_currency: "USD",
                    payment_date: paymentData.payment_date,
                    payment_method: "Bank Transfer",
                    reference: "PAY-001",
                    customer_id: 1,
                    account_id: 1,
                }),
            });
            expect(mockPrisma.invoicePayment.aggregate).toHaveBeenCalledWith({
                where: { invoice_id: 1 },
                _sum: {
                    amount: true,
                    customer_amount: true,
                },
            });
            expect(result.invoicePayment).toBeDefined();
            expect(result.updatedInvoice).toBeDefined();
        });

        it("should calculate outstanding debt correctly", async () => {
            // Arrange
            const paymentData = {
                invoice_id: 1,
                customer_id: 1,
                account_id: 1,
                amount: 300.0,
                customer_amount: 300.0,
                customer_currency: "USD",
                payment_date: new Date("2024-01-15"),
                payment_method: "Bank Transfer",
                reference: "PAY-001",
            };

            mockPrisma.invoice.findUnique.mockResolvedValue({
                id: 1,
                net_amount: 1000.0,
                customer_net_amount: 1000.0,
                status_id: 1,
            });

            mockPrisma.invoicePayment.create.mockResolvedValue({
                id: 1,
                ...paymentData,
            });

            mockPrisma.invoicePayment.aggregate.mockResolvedValue({
                _sum: {
                    amount: 300.0,
                    customer_amount: 300.0,
                },
            });

            mockPrisma.invoice.update.mockResolvedValue({
                id: 1,
                outstanding_debt: 700.0,
                customer_outstanding_debt: 700.0,
            });

            // Act
            const result = await paymentService.createInvoicePayment(paymentData);

            // Assert
            expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: expect.objectContaining({
                    total_paid: 300.0,
                    customer_total_paid: 300.0,
                    outstanding_debt: 700.0,
                    customer_outstanding_debt: 700.0,
                }),
            });
        });

        it("should update invoice status to PAID when fully paid", async () => {
            // Arrange
            const paymentData = {
                invoice_id: 1,
                customer_id: 1,
                account_id: 1,
                amount: 1000.0,
                customer_amount: 1000.0,
                customer_currency: "USD",
                payment_date: new Date("2024-01-15"),
                payment_method: "Bank Transfer",
                reference: "PAY-001",
            };

            mockPrisma.invoice.findUnique.mockResolvedValue({
                id: 1,
                net_amount: 1000.0,
                customer_net_amount: 1000.0,
                status_id: 1,
            });

            mockPrisma.invoicePayment.create.mockResolvedValue({
                id: 1,
                ...paymentData,
            });

            mockPrisma.invoicePayment.aggregate.mockResolvedValue({
                _sum: {
                    amount: 1000.0,
                    customer_amount: 1000.0,
                },
            });

            mockPrisma.invoice.update.mockResolvedValue({
                id: 1,
                status: "Paid", // PAID
            });

            // Act
            const result = await paymentService.createInvoicePayment(paymentData);

            // Assert
            expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: expect.objectContaining({
                    status: "Paid", // PAID
                }),
            });
        });

        it("should handle different currencies correctly", async () => {
            // Arrange
            const paymentData = {
                invoice_id: 1,
                customer_id: 1,
                account_id: 1,
                amount: 1000.0,
                customer_amount: 1200.0, // Different currency
                customer_currency: "EUR",
                payment_date: new Date("2024-01-15"),
                payment_method: "Bank Transfer",
                reference: "PAY-001",
            };

            mockPrisma.invoice.findUnique.mockResolvedValue({
                id: 1,
                net_amount: 1000.0,
                customer_net_amount: 1200.0,
                status_id: 1,
            });

            mockPrisma.invoicePayment.create.mockResolvedValue({
                id: 1,
                ...paymentData,
            });

            mockPrisma.invoicePayment.aggregate.mockResolvedValue({
                _sum: {
                    amount: 1000.0,
                    customer_amount: 1200.0,
                },
            });

            mockPrisma.invoice.update.mockResolvedValue({
                id: 1,
                customer_outstanding_debt: 0.0,
            });

            // Act
            await paymentService.createInvoicePayment(paymentData);

            // Assert
            expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: expect.objectContaining({
                    customer_total_paid: 1200.0,
                    customer_outstanding_debt: 0.0,
                }),
            });
        });

        it("should recalculate customer amounts after payment", async () => {
            // Arrange
            const paymentData = {
                invoice_id: 1,
                customer_id: 1,
                account_id: 1,
                amount: 500.0,
                customer_amount: 500.0,
                customer_currency: "USD",
                payment_date: new Date("2024-01-15"),
                payment_method: "Bank Transfer",
                reference: "PAY-001",
            };

            mockPrisma.invoicePayment.create.mockResolvedValue({
                id: 1,
                ...paymentData,
            });

            mockPrisma.invoicePayment.aggregate.mockResolvedValue({
                _sum: {
                    amount: 500.0,
                    customer_amount: 500.0,
                },
            });

            mockPrisma.invoice.update.mockResolvedValue({
                id: 1,
            });

            // Act
            await paymentService.createInvoicePayment(paymentData);

            // Assert
            const { CustomerService } = await import("@/server/services/CustomerService");
            expect(CustomerService.recalculateAllAmountsForCustomers).toHaveBeenCalledWith([1]);
        });
    });

    describe("error handling", () => {
        it("should throw error when invoice not found", async () => {
            // Arrange
            const paymentData = {
                invoice_id: 999,
                customer_id: 1,
                account_id: 1,
                amount: 500.0,
                customer_amount: 500.0,
                customer_currency: "USD",
                payment_date: new Date("2024-01-15"),
                payment_method: "Bank Transfer",
                reference: "PAY-001",
            };

            mockPrisma.invoicePayment.create.mockResolvedValue({
                id: 1,
                ...paymentData,
            });

            mockPrisma.invoicePayment.aggregate.mockResolvedValue({
                _sum: {
                    amount: 500.0,
                    customer_amount: 500.0,
                },
            });

            mockPrisma.invoice.findUnique.mockResolvedValue(null);

            // Act & Assert
            await expect(
                paymentService.createInvoicePayment(paymentData)
            ).rejects.toThrow("Invoice 999 not found");
        });

        it("should log error and rethrow when payment creation fails", async () => {
            // Arrange
            const paymentData = {
                invoice_id: 1,
                customer_id: 1,
                account_id: 1,
                amount: 500.0,
                customer_amount: 500.0,
                customer_currency: "USD",
                payment_date: new Date("2024-01-15"),
                payment_method: "Bank Transfer",
                reference: "PAY-001",
            };
            const error = new Error("Database error");

            mockPrisma.invoicePayment.create.mockRejectedValue(error);

            // Act & Assert
            await expect(
                paymentService.createInvoicePayment(paymentData)
            ).rejects.toThrow("Database error");

            expect(mockLogServiceInstance.logMessage).toHaveBeenCalled();
        });
    });

    describe("aggregate calculations", () => {
        it("should handle multiple payments on same invoice", async () => {
            // Arrange
            const paymentData = {
                invoice_id: 1,
                customer_id: 1,
                account_id: 1,
                amount: 300.0,
                customer_amount: 300.0,
                customer_currency: "USD",
                payment_date: new Date("2024-01-15"),
                payment_method: "Bank Transfer",
                reference: "PAY-002",
            };

            mockPrisma.invoice.findUnique.mockResolvedValue({
                id: 1,
                net_amount: 1000.0,
                customer_net_amount: 1000.0,
                status_id: 1,
            });

            mockPrisma.invoicePayment.create.mockResolvedValue({
                id: 2,
                ...paymentData,
            });

            // Simulate existing payment of 500
            mockPrisma.invoicePayment.aggregate.mockResolvedValue({
                _sum: {
                    amount: 800.0, // 500 + 300
                    customer_amount: 800.0,
                },
            });

            mockPrisma.invoice.update.mockResolvedValue({
                id: 1,
                outstanding_debt: 200.0,
            });

            // Act
            await paymentService.createInvoicePayment(paymentData);

            // Assert
            expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: expect.objectContaining({
                    total_paid: 800.0,
                    customer_total_paid: 800.0,
                    outstanding_debt: 200.0,
                    customer_outstanding_debt: 200.0,
                }),
            });
        });

        it("should handle null aggregate sums", async () => {
            // Arrange
            const paymentData = {
                invoice_id: 1,
                customer_id: 1,
                account_id: 1,
                amount: 500.0,
                customer_amount: 500.0,
                customer_currency: "USD",
                payment_date: new Date("2024-01-15"),
                payment_method: "Bank Transfer",
                reference: "PAY-001",
            };

            mockPrisma.invoicePayment.create.mockResolvedValue({
                id: 1,
                ...paymentData,
            });

            mockPrisma.invoicePayment.aggregate.mockResolvedValue({
                _sum: {
                    amount: null,
                    customer_amount: null,
                },
            });

            mockPrisma.invoice.update.mockResolvedValue({
                id: 1,
            });

            // Act
            await paymentService.createInvoicePayment(paymentData);

            // Assert
            expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: expect.objectContaining({
                    total_paid: 0,
                    customer_total_paid: 0,
                }),
            });
        });
    });

    describe("AR post-ingest for backdated vs same-day", () => {
        it("runs chronological AR replay + live refresh when payment_date is before today", async () => {
            const paymentData = {
                invoice_id: 1,
                customer_id: 42,
                account_id: 7,
                amount: 500.0,
                customer_amount: 500.0,
                customer_currency: "USD",
                payment_date: new Date("2026-07-24T12:00:00.000Z"),
                payment_method: "Bank Transfer",
                reference: "PAY-BACKDATED",
            };
            await stubSuccessfulPaymentCreate(paymentData);

            await paymentService.createInvoicePayment(paymentData);

            expect(mockEnqueueAsOfRewrite).toHaveBeenCalledWith(
                expect.objectContaining({
                    accountId: 7,
                    customerIds: [42],
                    fromDate: paymentData.payment_date,
                    toDate: FIXED_TODAY_UTC,
                })
            );
            expect(mockRunArPostIngestForCustomers).toHaveBeenCalledWith({
                accountId: 7,
                customerIds: [42],
                runMaturity: false,
                runLiveRefresh: true,
            });
        });

        it("does not run full AR post-ingest when payment_date is today", async () => {
            const paymentData = {
                invoice_id: 1,
                customer_id: 42,
                account_id: 7,
                amount: 500.0,
                customer_amount: 500.0,
                customer_currency: "USD",
                payment_date: new Date("2026-07-29T15:30:00.000Z"),
                payment_method: "Bank Transfer",
                reference: "PAY-SAME-DAY",
            };
            await stubSuccessfulPaymentCreate(paymentData);

            await paymentService.createInvoicePayment(paymentData);

            expect(mockEnqueueAsOfRewrite).toHaveBeenCalled();
            expect(mockRunArPostIngestForCustomers).not.toHaveBeenCalled();
        });

        it("skips AR post-ingest when skipArPostIngest is set (import batch path)", async () => {
            const paymentData = {
                invoice_id: 1,
                customer_id: 42,
                account_id: 7,
                amount: 500.0,
                customer_amount: 500.0,
                customer_currency: "USD",
                payment_date: new Date("2026-07-24T12:00:00.000Z"),
                payment_method: "Bank Transfer",
                reference: "PAY-IMPORT",
            };
            await stubSuccessfulPaymentCreate(paymentData);

            await paymentService.createInvoicePayment(paymentData, {
                skipArPostIngest: true,
            });

            expect(mockEnqueueAsOfRewrite).toHaveBeenCalled();
            expect(mockRunArPostIngestForCustomers).not.toHaveBeenCalled();
        });
    });
});

