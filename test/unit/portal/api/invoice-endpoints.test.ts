/**
 * Unit Test: Portal Invoice Endpoints API
 * 
 * Tests: Portal invoice endpoints functionality including customer invoice retrieval
 * 
 * 📚 Documentation:
 * - Unit Testing Guide: docs/unit-testing-guide.md
 * - Best Practices: docs/development-guides/unit-testing-best-practices.md
 */

import { NextApiRequest, NextApiResponse } from "next";
import { createMocks } from "node-mocks-http";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import handler from "@/pages/api/customers/[customerUUID]/invoices";
import { createPrismaMock } from "@/test/mocks/prisma";

// Mock Prisma
vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    return {
        prisma: createPrismaMock(),
    };
});

// Mock PortalService - cannot use top-level variables in mock factory
vi.mock("@/server/services/PortalService", () => ({
    PortalService: {
        getCustomerInvoices: vi.fn(),
    },
}));

// Import after mocks
import { prisma } from "@/lib/prisma";
import { PortalService } from "@/server/services/PortalService";

describe("Portal Invoice Endpoints API", () => {
    let mockPrisma: any;
    let mockGetCustomerInvoices: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        vi.clearAllMocks();
        const { prisma: prismaInstance } = await import("@/lib/prisma");
        mockPrisma = prismaInstance;
        // Get the mocked PortalService instance
        const ps = PortalService as any;
        mockGetCustomerInvoices = ps.getCustomerInvoices as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("GET /api/customers/[customerUUID]/invoices", () => {
        it("should return 200 with customer invoices data", async () => {
            // Arrange
            const mockCustomerData = {
                invoices: [
                    {
                        id: 1,
                        invoiceNumber: "INV-001",
                        amount: 1000,
                        outstandingDebt: 500,
                        dueDate: "2025-01-15T00:00:00.000Z",
                    },
                ],
                logo: "logo-url",
                customerName: "Test Account",
                language: "English",
            };

            mockGetCustomerInvoices.mockResolvedValueOnce(mockCustomerData);

            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
                method: "GET",
                query: {
                    customerUUID: "11111111-1111-1111-1111-111111111111",
                },
            });

            // Act
            await handler(req, res);

            // Assert
            expect(res._getStatusCode()).toBe(200);
            const responseData = JSON.parse(res._getData());
            expect(responseData).toEqual(mockCustomerData);
            expect(responseData.invoices).toHaveLength(1);
            expect(responseData.customerName).toBe("Test Account");
            expect(mockGetCustomerInvoices).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111");
            expect(mockGetCustomerInvoices).toHaveBeenCalledTimes(1);
        });

        it("should return 405 when method is not GET", async () => {
            // Arrange
            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
                method: "POST",
                query: {
                    customerUUID: "11111111-1111-1111-1111-111111111111",
                },
            });

            // Act
            await handler(req, res);

            // Assert
            expect(res._getStatusCode()).toBe(405);
            const responseData = JSON.parse(res._getData());
            expect(responseData.error).toBe("Method not allowed");
            expect(mockGetCustomerInvoices).not.toHaveBeenCalled();
        });

        it("should return 400 when customerUUID is missing", async () => {
            // Arrange
            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
                method: "GET",
                query: {},
            });

            // Act
            await handler(req, res);

            // Assert
            expect(res._getStatusCode()).toBe(400);
            const responseData = JSON.parse(res._getData());
            expect(responseData.error).toBe("Invalid customerUUID parameter");
            expect(mockGetCustomerInvoices).not.toHaveBeenCalled();
        });

        it("should return 400 when customerUUID is not a string", async () => {
            // Arrange
            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
                method: "GET",
                query: {
                    customerUUID: 123,
                },
            });

            // Act
            await handler(req, res);

            // Assert
            expect(res._getStatusCode()).toBe(400);
            const responseData = JSON.parse(res._getData());
            expect(responseData.error).toBe("Invalid customerUUID parameter");
            expect(mockGetCustomerInvoices).not.toHaveBeenCalled();
        });

        it("should return 400 when customerUUID is an array", async () => {
            // Arrange
            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
                method: "GET",
                query: {
                    customerUUID: ["11111111-1111-1111-1111-111111111111"],
                },
            });

            // Act
            await handler(req, res);

            // Assert
            expect(res._getStatusCode()).toBe(400);
            const responseData = JSON.parse(res._getData());
            expect(responseData.error).toBe("Invalid customerUUID parameter");
            expect(mockGetCustomerInvoices).not.toHaveBeenCalled();
        });

        it("should return 404 when customer is not found", async () => {
            // Arrange
            mockGetCustomerInvoices.mockResolvedValueOnce(null);

            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
                method: "GET",
                query: {
                    customerUUID: "22222222-2222-2222-2222-222222222222",
                },
            });

            // Act
            await handler(req, res);

            // Assert
            expect(res._getStatusCode()).toBe(404);
            const responseData = JSON.parse(res._getData());
            expect(responseData.error).toBe("Customer not found");
            expect(mockGetCustomerInvoices).toHaveBeenCalledWith("22222222-2222-2222-2222-222222222222");
        });

        it("should return 500 when service throws an error", async () => {
            // Arrange
            const errorMessage = "Database connection error";
            mockGetCustomerInvoices.mockRejectedValueOnce(new Error(errorMessage));

            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
                method: "GET",
                query: {
                    customerUUID: "11111111-1111-1111-1111-111111111111",
                },
            });

            // Act
            await handler(req, res);

            // Assert
            expect(res._getStatusCode()).toBe(500);
            const responseData = JSON.parse(res._getData());
            expect(responseData.error).toBe("Failed to fetch customer invoices");
            expect(responseData.details).toBe(errorMessage);
            expect(mockGetCustomerInvoices).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111");
        });

        it("should handle empty invoices array", async () => {
            // Arrange
            const mockCustomerData = {
                invoices: [],
                logo: "logo-url",
                customerName: "Test Account",
                language: "English",
            };

            mockGetCustomerInvoices.mockResolvedValueOnce(mockCustomerData);

            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
                method: "GET",
                query: {
                    customerUUID: "11111111-1111-1111-1111-111111111111",
                },
            });

            // Act
            await handler(req, res);

            // Assert
            expect(res._getStatusCode()).toBe(200);
            const responseData = JSON.parse(res._getData());
            expect(responseData.invoices).toEqual([]);
            expect(responseData.invoices).toHaveLength(0);
            expect(responseData.customerName).toBe("Test Account");
        });

        it("should handle customer with multiple invoices", async () => {
            // Arrange
            const mockCustomerData = {
                invoices: [
                    {
                        id: 1,
                        invoiceNumber: "INV-001",
                        amount: 1000,
                        outstandingDebt: 500,
                    },
                    {
                        id: 2,
                        invoiceNumber: "INV-002",
                        amount: 2000,
                        outstandingDebt: 2000,
                    },
                    {
                        id: 3,
                        invoiceNumber: "INV-003",
                        amount: 1500,
                        outstandingDebt: 0,
                    },
                ],
                logo: "logo-url",
                customerName: "Test Account",
                language: "English",
            };

            mockGetCustomerInvoices.mockResolvedValueOnce(mockCustomerData);

            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
                method: "GET",
                query: {
                    customerUUID: "11111111-1111-1111-1111-111111111111",
                },
            });

            // Act
            await handler(req, res);

            // Assert
            expect(res._getStatusCode()).toBe(200);
            const responseData = JSON.parse(res._getData());
            expect(responseData.invoices).toHaveLength(3);
            expect(responseData.invoices[0].invoiceNumber).toBe("INV-001");
            expect(responseData.invoices[1].invoiceNumber).toBe("INV-002");
            expect(responseData.invoices[2].invoiceNumber).toBe("INV-003");
        });

        it("should handle different customerUUID formats", async () => {
            // Arrange
            const mockCustomerData = {
                invoices: [],
                logo: "logo-url",
                customerName: "Test Account",
                language: "Hebrew",
            };

            const testUUIDs = [
                "33333333-3333-3333-3333-333333333333",
                "44444444-4444-4444-4444-444444444444",
                "55555555-5555-5555-5555-555555555555",
                "66666666-6666-6666-6666-666666666666",
            ];

            for (const uuid of testUUIDs) {
                vi.clearAllMocks();
                mockGetCustomerInvoices.mockResolvedValueOnce(mockCustomerData);

                const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
                    method: "GET",
                    query: {
                        customerUUID: uuid,
                    },
                });

                // Act
                await handler(req, res);

                // Assert
                expect(res._getStatusCode()).toBe(200);
                expect(mockGetCustomerInvoices).toHaveBeenCalledWith(uuid);
            }
        });
    });
});
