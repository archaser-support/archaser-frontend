/**
 * Unit Test: ParentCustomerValidationService
 * 
 * Tests: Parent customer validation logic including self-reference, circular relationships, and account validation
 * 
 * 📚 Documentation:
 * - Unit Testing Guide: docs/unit-testing-guide.md
 * - Best Practices: docs/development-guides/unit-testing-best-practices.md
 * 
 * 🚨 CRITICAL: Don't mock the class you're testing! Mock only dependencies.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { createPrismaMock } from "@/test/mocks/prisma";
import {
    createMockParentCustomer,
    createMockChildCustomer,
    createMockCustomerWithParent,
    mockParentCustomerData,
} from "@/test/fixtures/services/customer";

// Mock dependencies
vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    return {
        prisma: createPrismaMock(),
    };
});

vi.mock("@/server/services/LogService", () => ({
    LogService: {
        getInstance: vi.fn(() => ({
            log: vi.fn(),
            logMessage: vi.fn().mockResolvedValue(undefined),
        })),
    },
}));

// Mock BusinessUnitService - cannot use top-level variables in mock factory
vi.mock("@/server/services/BusinessUnitService", () => ({
    BusinessUnitService: {
        canUserAccessCustomer: vi.fn(),
    },
}));

// Import real class after mocks
import { prisma } from "@/lib/prisma";
import { BusinessUnitService } from "@/server/services/BusinessUnitService";
import { ParentCustomerValidationService } from "@/server/services/ParentCustomerValidationService";

describe("ParentCustomerValidationService", () => {
    let service: ParentCustomerValidationService;
    const mockPrisma = prisma as ReturnType<typeof createPrismaMock>;
    let mockCanUserAccessCustomer: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        vi.clearAllMocks();
        service = ParentCustomerValidationService.getInstance();
        // Get the mocked BusinessUnitService instance
        const bus = BusinessUnitService as any;
        mockCanUserAccessCustomer = bus.canUserAccessCustomer as ReturnType<typeof vi.fn>;
        // Default: allow access
        mockCanUserAccessCustomer.mockResolvedValue(true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("validateParentCustomer", () => {
        describe("success cases", () => {
            it("should return valid when removing parent (setting to null)", async () => {
                // Arrange
                const customerId = 1;
                const parentCustomerId = null;

                // Act
                const result = await service.validateParentCustomer(customerId, parentCustomerId);

                // Assert
                expect(result.isValid).toBe(true);
                expect(result.error).toBeUndefined();
                expect(mockPrisma.customer.findUnique).not.toHaveBeenCalled();
            });

            it("should return valid when parent customer exists and belongs to same account", async () => {
                // Arrange
                const customer = createMockChildCustomer({ parent_customer_id: null });
                const parent = createMockParentCustomer();

                mockPrisma.customer.findUnique
                    .mockResolvedValueOnce({
                        id: parent.id,
                        account_id: parent.account_id,
                    } as any)
                    .mockResolvedValueOnce({
                        id: customer.id,
                        account_id: customer.account_id,
                    } as any)
                    // Mock circular relationship check
                    .mockResolvedValueOnce({
                        parent_customer_id: null,
                    } as any);

                // Act
                const result = await service.validateParentCustomer(customer.id, parent.id);

                // Assert
                expect(result.isValid).toBe(true);
                expect(result.error).toBeUndefined();
                expect(mockPrisma.customer.findUnique).toHaveBeenCalledTimes(3);
            });
        });

        describe("error cases", () => {
            it("should return invalid when customer tries to be its own parent", async () => {
                // Arrange
                const customerId = 1;
                const parentCustomerId = 1;

                // Act
                const result = await service.validateParentCustomer(customerId, parentCustomerId);

                // Assert
                expect(result.isValid).toBe(false);
                expect(result.error).toBe("Customer cannot be its own parent");
                expect(result.errorCode).toBe("SELF_REFERENCE");
                expect(mockPrisma.customer.findUnique).not.toHaveBeenCalled();
            });

            it("should return invalid when parent customer does not exist", async () => {
                // Arrange
                const customerId = 1;
                const parentCustomerId = 999;

                mockPrisma.customer.findUnique.mockResolvedValueOnce(null);

                // Act
                const result = await service.validateParentCustomer(customerId, parentCustomerId);

                // Assert
                expect(result.isValid).toBe(false);
                expect(result.error).toBe("Parent customer not found");
                expect(result.errorCode).toBe("PARENT_NOT_FOUND");
            });

            it("should return invalid when customer does not exist", async () => {
                // Arrange
                const customerId = 999;
                const parentCustomerId = 2;
                const accountId = 100;

                mockPrisma.customer.findUnique
                    .mockResolvedValueOnce({
                        id: parentCustomerId,
                        account_id: accountId,
                    } as any)
                    .mockResolvedValueOnce(null);

                // Act
                const result = await service.validateParentCustomer(customerId, parentCustomerId);

                // Assert
                expect(result.isValid).toBe(false);
                expect(result.error).toBe("Customer not found");
                expect(result.errorCode).toBe("CUSTOMER_NOT_FOUND");
            });

            it("should return invalid when parent belongs to different account", async () => {
                // Arrange
                const customer = createMockChildCustomer({ account_id: 100 });
                const parent = createMockParentCustomer({ account_id: 200 });

                mockPrisma.customer.findUnique
                    .mockResolvedValueOnce({
                        id: parent.id,
                        account_id: parent.account_id,
                    } as any)
                    .mockResolvedValueOnce({
                        id: customer.id,
                        account_id: customer.account_id,
                    } as any);

                // Act
                const result = await service.validateParentCustomer(customer.id, parent.id);

                // Assert
                expect(result.isValid).toBe(false);
                expect(result.error).toBe("Parent customer must belong to the same account");
                expect(result.errorCode).toBe("DIFFERENT_ACCOUNT");
            });

            it("should return valid when parent belongs to same account and user has BU access", async () => {
                // Arrange
                const customer = createMockChildCustomer({ account_id: 100 });
                const parent = createMockParentCustomer({ account_id: 100, business_unit_id: 10 }); // Same account, same BU

                mockPrisma.customer.findUnique
                    .mockResolvedValueOnce({
                        id: parent.id,
                        account_id: parent.account_id,
                    } as any)
                    .mockResolvedValueOnce({
                        id: customer.id,
                        account_id: customer.account_id,
                    } as any)
                    // Mock BU check - parent customer with BU
                    .mockResolvedValueOnce({
                        business_unit_id: 10,
                    } as any)
                    // Mock circular relationship check
                    .mockResolvedValueOnce({
                        parent_customer_id: null,
                    } as any);

                mockCanUserAccessCustomer.mockResolvedValueOnce(true);

                const userAccessInfo = {
                    userId: "user-123",
                    accountId: 100,
                    role: "User",
                    businessUnitId: 10,
                    isAccountManager: false,
                };

                // Act
                const result = await service.validateParentCustomer(
                    customer.id,
                    parent.id,
                    userAccessInfo
                );

                // Assert
                expect(result.isValid).toBe(true);
                expect(result.error).toBeUndefined();
                expect(mockCanUserAccessCustomer).toHaveBeenCalledWith(10, 10);
            });

            it("should return invalid when user does not have BU access to parent customer", async () => {
                // Arrange
                const customer = createMockChildCustomer({ account_id: 100 });
                const parent = createMockParentCustomer({ account_id: 100, business_unit_id: 20 }); // Different BU

                mockPrisma.customer.findUnique
                    .mockResolvedValueOnce({
                        id: parent.id,
                        account_id: parent.account_id,
                    } as any)
                    .mockResolvedValueOnce({
                        id: customer.id,
                        account_id: customer.account_id,
                    } as any)
                    // Mock BU check - parent customer with different BU
                    .mockResolvedValueOnce({
                        business_unit_id: 20,
                    } as any);

                mockCanUserAccessCustomer.mockResolvedValueOnce(false);

                const userAccessInfo = {
                    userId: "user-123",
                    accountId: 100,
                    role: "User",
                    businessUnitId: 10, // User's BU is 10, parent's BU is 20
                    isAccountManager: false,
                };

                // Act
                const result = await service.validateParentCustomer(
                    customer.id,
                    parent.id,
                    userAccessInfo
                );

                // Assert
                expect(result.isValid).toBe(false);
                expect(result.error).toBe("You do not have permission to assign this parent customer");
                expect(result.errorCode).toBe("ACCESS_DENIED_BUSINESS_UNIT");
                expect(mockCanUserAccessCustomer).toHaveBeenCalledWith(10, 20);
            });

            it("should return valid when admin user assigns parent (bypasses BU check)", async () => {
                // Arrange
                const customer = createMockChildCustomer({ account_id: 100 });
                const parent = createMockParentCustomer({ account_id: 100, business_unit_id: 20 }); // Different BU

                mockPrisma.customer.findUnique
                    .mockResolvedValueOnce({
                        id: parent.id,
                        account_id: parent.account_id,
                    } as any)
                    .mockResolvedValueOnce({
                        id: customer.id,
                        account_id: customer.account_id,
                    } as any)
                    // Mock circular relationship check
                    .mockResolvedValueOnce({
                        parent_customer_id: null,
                    } as any);

                const userAccessInfo = {
                    userId: "admin-123",
                    accountId: 10013, // Admin account
                    role: "Admin",
                    businessUnitId: 10,
                    isAccountManager: false,
                };

                // Act
                const result = await service.validateParentCustomer(
                    customer.id,
                    parent.id,
                    userAccessInfo
                );

                // Assert
                // Admin users can assign any parent customer (within same account)
                expect(result.isValid).toBe(true);
                expect(result.error).toBeUndefined();
            });

            it("should return invalid when assignment would create circular relationship", async () => {
                // Arrange
                const customer = createMockChildCustomer();
                const parent = createMockParentCustomer();

                mockPrisma.customer.findUnique
                    .mockResolvedValueOnce({
                        id: parent.id,
                        account_id: parent.account_id,
                    } as any)
                    .mockResolvedValueOnce({
                        id: customer.id,
                        account_id: customer.account_id,
                    } as any)
                    // Circular relationship check - parent's parent is the customer
                    .mockResolvedValueOnce({
                        parent_customer_id: customer.id,
                    } as any);

                // Act
                const result = await service.validateParentCustomer(customer.id, parent.id);

                // Assert
                expect(result.isValid).toBe(false);
                expect(result.error).toBe("Cannot create circular relationship");
                expect(result.errorCode).toBe("CIRCULAR_RELATIONSHIP");
            });
        });
    });

    describe("checkCircularRelationship", () => {
        describe("success cases", () => {
            it("should return false when no circular relationship exists", async () => {
                // Arrange
                const customerId = 1;
                const potentialParentId = 2;

                mockPrisma.customer.findUnique.mockResolvedValueOnce({
                    parent_customer_id: null,
                } as any);

                // Act
                const result = await service.checkCircularRelationship(customerId, potentialParentId);

                // Assert
                expect(result).toBe(false);
            });

            it("should return false when parent chain does not include customer", async () => {
                // Arrange
                const customerId = 1;
                const potentialParentId = 2;

                mockPrisma.customer.findUnique
                    .mockResolvedValueOnce({
                        parent_customer_id: 3,
                    } as any)
                    .mockResolvedValueOnce({
                        parent_customer_id: null,
                    } as any);

                // Act
                const result = await service.checkCircularRelationship(customerId, potentialParentId);

                // Assert
                expect(result).toBe(false);
            });
        });

        describe("error cases", () => {
            it("should return true when customer tries to be its own parent", async () => {
                // Arrange
                const customerId = 1;
                const potentialParentId = 1;

                // Act
                const result = await service.checkCircularRelationship(customerId, potentialParentId);

                // Assert
                expect(result).toBe(true);
                expect(mockPrisma.customer.findUnique).not.toHaveBeenCalled();
            });

            it("should return true when parent chain includes customer", async () => {
                // Arrange
                const customerId = 1;
                const potentialParentId = 2;

                // Parent 2's parent is customer 1 (circular)
                mockPrisma.customer.findUnique.mockResolvedValueOnce({
                    parent_customer_id: customerId,
                } as any);

                // Act
                const result = await service.checkCircularRelationship(customerId, potentialParentId);

                // Assert
                expect(result).toBe(true);
            });

            it("should return true when parent chain has a cycle", async () => {
                // Arrange
                const customerId = 1;
                const potentialParentId = 2;

                // Parent 2's parent is 3, 3's parent is 2 (cycle)
                mockPrisma.customer.findUnique
                    .mockResolvedValueOnce({
                        parent_customer_id: 3,
                    } as any)
                    .mockResolvedValueOnce({
                        parent_customer_id: 2,
                    } as any);

                // Act
                const result = await service.checkCircularRelationship(customerId, potentialParentId);

                // Assert
                expect(result).toBe(true);
            });
        });
    });
});

