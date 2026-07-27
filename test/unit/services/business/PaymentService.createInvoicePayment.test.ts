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

describe("PaymentService.createInvoicePayment", () => {
    let mockPrisma: any;
    let paymentService: PaymentService;

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
});

