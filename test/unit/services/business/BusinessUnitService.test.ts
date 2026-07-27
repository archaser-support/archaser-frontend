import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { prisma } from '@/lib/prisma';
import { BusinessUnitService } from '@/server/services/BusinessUnitService';
import { createPrismaMock } from '@/test/mocks/prisma';

// Mock prisma - use async import to avoid hoisting issues
vi.mock('@/lib/prisma', async () => {
    const { createPrismaMock } = await import('@/test/mocks/prisma');
    return {
        prisma: createPrismaMock(),
    };
});

describe('BusinessUnitService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('createPrimaryBusinessUnit', () => {
        it('should create a primary business unit for a new account', async () => {
            const accountId = 1;
            const userId = 'user-1';
            const accountName = 'Test Account';

            (prisma.businessUnit.findFirst as any).mockResolvedValue(null);
            (prisma.account.findUnique as any).mockResolvedValue({ name: accountName });
            (prisma.businessUnit.create as any).mockResolvedValue({
                id: 1,
                account_id: accountId,
                name: `${accountName} Primary`,
                status: 'Active',
                is_primary: true,
                created_by: userId,
                modified_by: userId,
            });

            const result = await BusinessUnitService.createPrimaryBusinessUnit(
                accountId,
                userId
            );

            expect(result.is_primary).toBe(true);
            expect(result.name).toBe(`${accountName} Primary`);
            expect(prisma.businessUnit.findFirst).toHaveBeenCalledWith({
                where: {
                    account_id: accountId,
                    is_primary: true,
                },
            });
            expect(prisma.businessUnit.create).toHaveBeenCalledWith({
                data: {
                    account_id: accountId,
                    name: `${accountName} Primary`,
                    status: 'Active',
                    is_primary: true,
                    created_by: userId,
                    modified_by: userId,
                },
            });
        });

        it('should throw error if primary BU already exists', async () => {
            const accountId = 1;
            const userId = 'user-1';

            (prisma.businessUnit.findFirst as any).mockResolvedValue({
                id: 1,
                is_primary: true,
            });

            await expect(
                BusinessUnitService.createPrimaryBusinessUnit(accountId, userId)
            ).rejects.toThrow('Primary business unit already exists for this account');
        });

        it('should use default name if account name is not available', async () => {
            const accountId = 1;
            const userId = 'user-1';

            (prisma.businessUnit.findFirst as any).mockResolvedValue(null);
            (prisma.account.findUnique as any).mockResolvedValue(null);
            (prisma.businessUnit.create as any).mockResolvedValue({
                id: 1,
                name: 'Primary',
                is_primary: true,
            });

            const result = await BusinessUnitService.createPrimaryBusinessUnit(
                accountId,
                userId
            );

            expect(result.name).toBe('Primary');
        });
    });

    describe('createBusinessUnit', () => {
        it('should create a business unit with valid data', async () => {
            const data = {
                name: 'Test BU',
                account_id: 1,
                status: 'Active' as const,
            };
            const userId = 'user-1';

            (prisma.businessUnit.create as any).mockResolvedValue({
                id: 1,
                ...data,
                created_by: userId,
                modified_by: userId,
            });

            const result = await BusinessUnitService.createBusinessUnit(data, userId);

            expect(result.name).toBe(data.name);
            expect(prisma.businessUnit.create).toHaveBeenCalledWith({
                data: {
                    name: data.name,
                    account_id: data.account_id,
                    parent_id: null,
                    external_id: null,
                    status: 'Active',
                    created_by: userId,
                    modified_by: userId,
                },
            });
        });

        it('should validate parent belongs to same account', async () => {
            const data = {
                name: 'Test BU',
                account_id: 1,
                parent_id: 2,
            };
            const userId = 'user-1';

            (prisma.businessUnit.findUnique as any).mockResolvedValue({
                id: 2,
                account_id: 2, // Different account
            });

            await expect(
                BusinessUnitService.createBusinessUnit(data, userId)
            ).rejects.toThrow('Parent business unit must belong to the same account');
        });

        it('should create BU with parent if parent belongs to same account', async () => {
            const data = {
                name: 'Child BU',
                account_id: 1,
                parent_id: 2,
            };
            const userId = 'user-1';

            (prisma.businessUnit.findUnique as any).mockResolvedValue({
                id: 2,
                account_id: 1, // Same account
            });
            (prisma.businessUnit.create as any).mockResolvedValue({
                id: 3,
                ...data,
            });

            const result = await BusinessUnitService.createBusinessUnit(data, userId);

            expect(result.parent_id).toBe(2);
        });
    });

    describe('updateBusinessUnit', () => {
        it('should update business unit name', async () => {
            const id = 1;
            const modified_ata = {
                name: 'Updated Name',
            };
            const userId = 'user-1';

            (prisma.businessUnit.findUnique as any).mockResolvedValue({
                id,
                account_id: 1,
                is_primary: false,
            });
            (prisma.businessUnit.update as any).mockResolvedValue({
                id,
                ...modified_ata,
            });

            const result = await BusinessUnitService.updateBusinessUnit(
                id,
                modified_ata,
                userId
            );

            expect(result.name).toBe('Updated Name');
            expect(prisma.businessUnit.update).toHaveBeenCalledWith({
                where: { id },
                data: {
                    ...modified_ata,
                    User_BusinessUnit_modified_byToUser: { connect: { id: userId } },
                    modified_at: expect.any(Date),
                },
            });
        });

        it('should prevent updating is_primary field', async () => {
            const id = 1;
            const modified_ata = {
                is_primary: false,
            };

            (prisma.businessUnit.findUnique as any).mockResolvedValue({
                id,
                account_id: 1,
                is_primary: true,
            });

            await expect(
                BusinessUnitService.updateBusinessUnit(id, modified_ata)
            ).rejects.toThrow('Cannot update is_primary field');
        });

        it('should prevent circular parent reference', async () => {
            const id = 1;
            const modified_ata = {
                Parent: {
                    connect: { id: 2 },
                },
            };

            (prisma.businessUnit.findUnique as any).mockResolvedValue({
                id,
                account_id: 1,
                is_primary: false,
            });
            (prisma.businessUnit.findMany as any).mockResolvedValue([
                { id: 2 }, // Parent is a descendant, creating circular reference
            ]);

            await expect(
                BusinessUnitService.updateBusinessUnit(id, modified_ata)
            ).rejects.toThrow('Circular parent reference detected');
        });
    });

    describe('updateBusinessUnitStatus', () => {
        it('should update status to Active', async () => {
            const id = 1;
            const userId = 'user-1';

            (prisma.businessUnit.findUnique as any).mockResolvedValue({
                id,
                is_primary: false,
            });
            (prisma.businessUnit.update as any).mockResolvedValue({
                id,
                status: 'Active',
            });

            const result = await BusinessUnitService.updateBusinessUnitStatus(
                id,
                'Active',
                userId
            );

            expect(result.status).toBe('Active');
        });

        it('should prevent deactivating primary BU', async () => {
            const id = 1;

            (prisma.businessUnit.findUnique as any).mockResolvedValue({
                id,
                is_primary: true,
            });

            await expect(
                BusinessUnitService.updateBusinessUnitStatus(id, 'Inactive')
            ).rejects.toThrow('Cannot deactivate primary business unit');
        });
    });

    describe('deleteBusinessUnit', () => {
        it('should delete business unit if valid', async () => {
            const id = 1;

            (prisma.businessUnit.findUnique as any).mockResolvedValue({
                id,
                is_primary: false,
                Children: [],
                User: [],
                Customer: [],
            });
            (prisma.businessUnit.delete as any).mockResolvedValue({ id });

            await BusinessUnitService.deleteBusinessUnit(id);

            expect(prisma.businessUnit.delete).toHaveBeenCalledWith({
                where: { id },
            });
        });

        it('should prevent deleting primary BU', async () => {
            const id = 1;

            (prisma.businessUnit.findUnique as any).mockResolvedValue({
                id,
                is_primary: true,
                Children: [],
                User: [],
                Customer: [],
            });

            await expect(BusinessUnitService.deleteBusinessUnit(id)).rejects.toThrow(
                'Cannot delete primary business unit'
            );
        });

        it('should prevent deleting BU with children', async () => {
            const id = 1;

            (prisma.businessUnit.findUnique as any).mockResolvedValue({
                id,
                is_primary: false,
                Children: [{ id: 2 }],
                User: [],
                Customer: [],
            });

            await expect(BusinessUnitService.deleteBusinessUnit(id)).rejects.toThrow(
                'Cannot delete business unit with children'
            );
        });

        it('should prevent deleting BU assigned to users', async () => {
            const id = 1;

            (prisma.businessUnit.findUnique as any).mockResolvedValue({
                id,
                is_primary: false,
                Children: [],
                User: [{ id: 'user-1' }],
                Customer: [],
            });

            await expect(BusinessUnitService.deleteBusinessUnit(id)).rejects.toThrow(
                'Cannot delete business unit assigned to users'
            );
        });

        it('should prevent deleting BU assigned to customers', async () => {
            const id = 1;

            (prisma.businessUnit.findUnique as any).mockResolvedValue({
                id,
                is_primary: false,
                Children: [],
                User: [],
                Customer: [{ id: 1 }],
            });

            await expect(BusinessUnitService.deleteBusinessUnit(id)).rejects.toThrow(
                'Cannot delete business unit assigned to customers'
            );
        });
    });

    describe('getBusinessUnitHierarchy', () => {
        it('should return all descendant IDs recursively', async () => {
            const buId = 1;

            // Mock hierarchy: 1 -> [2, 3], 2 -> [4], 3 -> []
            const mockFindMany = prisma.businessUnit.findMany as any;
            mockFindMany
                .mockResolvedValueOnce([{ id: 2 }, { id: 3 }]) // Children of 1
                .mockResolvedValueOnce([{ id: 4 }]) // Children of 2
                .mockResolvedValueOnce([]) // Children of 3
                .mockResolvedValueOnce([]); // Children of 4

            const result = await BusinessUnitService.getBusinessUnitHierarchy(buId);

            // Order doesn't matter, just check all descendants are included
            expect(result).toHaveLength(3);
            expect(result).toContain(2);
            expect(result).toContain(3);
            expect(result).toContain(4);
        });

        it('should handle BU with no children', async () => {
            const buId = 1;

            (prisma.businessUnit.findMany as any).mockResolvedValue([]);

            const result = await BusinessUnitService.getBusinessUnitHierarchy(buId);

            expect(result).toEqual([]);
        });

        it('should prevent infinite loops from circular references', async () => {
            const buId = 1;

            // Simulate circular reference: 1 -> 2 -> 1
            (prisma.businessUnit.findMany as any)
                .mockResolvedValueOnce([{ id: 2 }]) // Children of 1
                .mockResolvedValueOnce([{ id: 1 }]) // Children of 2 (circular)
                .mockResolvedValueOnce([]); // Children of 1 (already visited)

            const result = await BusinessUnitService.getBusinessUnitHierarchy(buId);

            // Should only include 2 once, not create infinite loop
            expect(result).toEqual([2, 1]);
        });
    });

    describe('getActiveBusinessUnitsByAccount', () => {
        it('should return only active business units for an account', async () => {
            const accountId = 1;
            const mockBUs = [
                { id: 1, name: 'BU 1', status: 'Active' },
                { id: 2, name: 'BU 2', status: 'Active' },
            ];

            (prisma.businessUnit.findMany as any).mockResolvedValue(mockBUs);

            const result = await BusinessUnitService.getActiveBusinessUnitsByAccount(
                accountId
            );

            expect(result).toEqual(mockBUs);
            expect(prisma.businessUnit.findMany).toHaveBeenCalledWith({
                where: {
                    account_id: accountId,
                    status: 'Active',
                },
                include: {
                    Parent: true,
                },
                orderBy: {
                    name: 'asc',
                },
            });
        });
    });

    describe('checkCircularReference', () => {
        it('should return false if no parent', async () => {
            const result = await BusinessUnitService.checkCircularReference(1, null);
            expect(result).toBe(false);
        });

        it('should return true if parent is self', async () => {
            const result = await BusinessUnitService.checkCircularReference(1, 1);
            expect(result).toBe(true);
        });

        it('should return true if parent is a descendant', async () => {
            const buId = 1;
            const parentId = 3;

            (prisma.businessUnit.findMany as any).mockResolvedValue([
                { id: 2 },
                { id: 3 },
            ]);

            const result = await BusinessUnitService.checkCircularReference(
                buId,
                parentId
            );

            expect(result).toBe(true);
        });

        it('should return false if parent is not a descendant', async () => {
            const buId = 1;
            const parentId = 5;

            (prisma.businessUnit.findMany as any).mockResolvedValue([
                { id: 2 },
                { id: 3 },
            ]);

            const result = await BusinessUnitService.checkCircularReference(
                buId,
                parentId
            );

            expect(result).toBe(false);
        });
    });

    // Customer Access Control
    describe("Customer Access Control", () => {
        describe("canUserAccessCustomer", () => {
            it("should allow access when customer has no business unit", async () => {
                const result = await BusinessUnitService.canUserAccessCustomer(1, null);

                expect(result).toBe(true);
                expect(prisma.businessUnit.findMany).not.toHaveBeenCalled();
            });

            it("should deny access when user has no BU and customer has BU", async () => {
                const result = await BusinessUnitService.canUserAccessCustomer(null, 1);

                expect(result).toBe(false);
                expect(prisma.businessUnit.findMany).not.toHaveBeenCalled();
            });

            it("should allow access when user's BU matches customer's BU", async () => {
                const result = await BusinessUnitService.canUserAccessCustomer(1, 1);

                expect(result).toBe(true);
                expect(prisma.businessUnit.findMany).not.toHaveBeenCalled();
            });

            it("should allow access when customer's BU is a descendant of user's BU", async () => {
                vi.spyOn(
                    BusinessUnitService,
                    "getBusinessUnitHierarchy"
                ).mockResolvedValue([2, 3, 4]);

                const result = await BusinessUnitService.canUserAccessCustomer(1, 2);

                expect(result).toBe(true);
                expect(BusinessUnitService.getBusinessUnitHierarchy).toHaveBeenCalledWith(1);
            });

            it("should deny access when customer's BU is not in user's hierarchy", async () => {
                vi.spyOn(
                    BusinessUnitService,
                    "getBusinessUnitHierarchy"
                ).mockResolvedValue([2, 3]);

                const result = await BusinessUnitService.canUserAccessCustomer(1, 5);

                expect(result).toBe(false);
                expect(BusinessUnitService.getBusinessUnitHierarchy).toHaveBeenCalledWith(1);
            });

            it("should deny access when customer's BU is a parent of user's BU", async () => {
                vi.spyOn(
                    BusinessUnitService,
                    "getBusinessUnitHierarchy"
                ).mockResolvedValue([]);

                const result = await BusinessUnitService.canUserAccessCustomer(2, 1);

                expect(result).toBe(false);
            });

            it("should deny access when customer's BU is a sibling of user's BU", async () => {
                vi.spyOn(
                    BusinessUnitService,
                    "getBusinessUnitHierarchy"
                ).mockResolvedValue([]);

                const result = await BusinessUnitService.canUserAccessCustomer(2, 3);

                expect(result).toBe(false);
            });

            it("should allow access for grandchildren (multiple levels deep)", async () => {
                vi.spyOn(
                    BusinessUnitService,
                    "getBusinessUnitHierarchy"
                ).mockResolvedValue([2, 3, 4]);

                const result = await BusinessUnitService.canUserAccessCustomer(1, 4);

                expect(result).toBe(true);
            });
        });

        describe("Customer View Restrictions - Edge Cases", () => {
            it("should handle null user BU and null customer BU", async () => {
                const result = await BusinessUnitService.canUserAccessCustomer(null, null);

                expect(result).toBe(true);
            });

            it("should handle undefined user BU", async () => {
                const result = await BusinessUnitService.canUserAccessCustomer(undefined as any, 1);

                expect(result).toBe(false);
            });

            it("should handle undefined customer BU", async () => {
                const result = await BusinessUnitService.canUserAccessCustomer(1, undefined as any);

                expect(result).toBe(true);
            });
        });

        describe("Customer View Restrictions - Hierarchical Scenarios", () => {
            it("should allow user in parent BU to see customers in child BU", async () => {
                vi.spyOn(
                    BusinessUnitService,
                    "getBusinessUnitHierarchy"
                ).mockResolvedValue([2, 3]);

                const result = await BusinessUnitService.canUserAccessCustomer(1, 2);

                expect(result).toBe(true);
            });

            it("should allow user in parent BU to see customers in grandchild BU", async () => {
                vi.spyOn(
                    BusinessUnitService,
                    "getBusinessUnitHierarchy"
                ).mockResolvedValue([2, 3, 4]);

                const result = await BusinessUnitService.canUserAccessCustomer(1, 4);

                expect(result).toBe(true);
            });

            it("should deny user in child BU access to customers in parent BU", async () => {
                vi.spyOn(
                    BusinessUnitService,
                    "getBusinessUnitHierarchy"
                ).mockResolvedValue([]);

                const result = await BusinessUnitService.canUserAccessCustomer(2, 1);

                expect(result).toBe(false);
            });

            it("should deny user in child BU access to customers in sibling BU", async () => {
                vi.spyOn(
                    BusinessUnitService,
                    "getBusinessUnitHierarchy"
                ).mockResolvedValue([]);

                const result = await BusinessUnitService.canUserAccessCustomer(2, 3);

                expect(result).toBe(false);
            });

            it("should allow user in child BU to see customers in same child BU", async () => {
                const result = await BusinessUnitService.canUserAccessCustomer(2, 2);

                expect(result).toBe(true);
            });

            it("should allow user in child BU to see customers in their own descendants", async () => {
                vi.spyOn(
                    BusinessUnitService,
                    "getBusinessUnitHierarchy"
                ).mockResolvedValue([4]);

                const result = await BusinessUnitService.canUserAccessCustomer(2, 4);

                expect(result).toBe(true);
            });
        });
    });

    // Import Validation
    describe("Import Validation", () => {
        describe("getAccessibleBusinessUnitIds", () => {
            it("should return null for admin users", async () => {
                const result = await BusinessUnitService.getAccessibleBusinessUnitIds(
                    1,
                    true
                );
                expect(result).toBeNull();
            });

            it("should return empty array for users with no business unit", async () => {
                const result = await BusinessUnitService.getAccessibleBusinessUnitIds(
                    null,
                    false
                );
                expect(result).toEqual([]);
            });

            it("should return user's BU and descendants", async () => {
                vi.spyOn(
                    BusinessUnitService,
                    "getBusinessUnitHierarchy"
                ).mockResolvedValue([2, 3, 4]);

                const result = await BusinessUnitService.getAccessibleBusinessUnitIds(
                    1,
                    false
                );

                expect(result).toEqual([1, 2, 3, 4]);
            });
        });

        describe("canUserAccessBusinessUnitByExternalId", () => {
            it("should allow admin users to access any business unit", async () => {
                const result =
                    await BusinessUnitService.canUserAccessBusinessUnitByExternalId(
                        "BU-001",
                        null,
                        10013,
                        true
                    );

                expect(result).toBe(true);
                expect(prisma.businessUnit.findFirst).not.toHaveBeenCalled();
            });

            it("should allow access if business unit doesn't exist (let normal validation handle it)", async () => {
                (prisma.businessUnit.findFirst as any).mockResolvedValue(null);

                const result =
                    await BusinessUnitService.canUserAccessBusinessUnitByExternalId(
                        "NONEXISTENT",
                        1,
                        10014,
                        false
                    );

                expect(result).toBe(true);
            });

            it("should deny access if user has no BU and target BU exists", async () => {
                (prisma.businessUnit.findFirst as any).mockResolvedValue({ id: 5 });
                vi.spyOn(
                    BusinessUnitService,
                    "getAccessibleBusinessUnitIds"
                ).mockResolvedValue([]);

                const result =
                    await BusinessUnitService.canUserAccessBusinessUnitByExternalId(
                        "BU-001",
                        null,
                        10014,
                        false
                    );

                expect(result).toBe(false);
            });

            it("should allow access if business unit is in user's accessible list", async () => {
                (prisma.businessUnit.findFirst as any).mockResolvedValue({ id: 2 });
                vi.spyOn(
                    BusinessUnitService,
                    "getAccessibleBusinessUnitIds"
                ).mockResolvedValue([1, 2, 3, 4]);

                const result =
                    await BusinessUnitService.canUserAccessBusinessUnitByExternalId(
                        "BU-001",
                        1,
                        10014,
                        false
                    );

                expect(result).toBe(true);
            });

            it("should deny access if business unit is not in user's accessible list", async () => {
                (prisma.businessUnit.findFirst as any).mockResolvedValue({ id: 10 });
                vi.spyOn(
                    BusinessUnitService,
                    "getAccessibleBusinessUnitIds"
                ).mockResolvedValue([1, 2, 3, 4]);

                const result =
                    await BusinessUnitService.canUserAccessBusinessUnitByExternalId(
                        "BU-RESTRICTED",
                        1,
                        10014,
                        false
                    );

                expect(result).toBe(false);
            });
        });

        describe("Import Validation Scenarios", () => {
            it("should block import when user tries to import to inaccessible BU", async () => {
                (prisma.businessUnit.findFirst as any).mockResolvedValue({ id: 5 });
                vi.spyOn(
                    BusinessUnitService,
                    "getAccessibleBusinessUnitIds"
                ).mockResolvedValue([2, 3, 4]);

                const result =
                    await BusinessUnitService.canUserAccessBusinessUnitByExternalId(
                        "C2",
                        2,
                        10014,
                        false
                    );

                expect(result).toBe(false);
            });

            it("should allow import when user has access to the BU", async () => {
                (prisma.businessUnit.findFirst as any).mockResolvedValue({ id: 3 });
                vi.spyOn(
                    BusinessUnitService,
                    "getAccessibleBusinessUnitIds"
                ).mockResolvedValue([2, 3, 4]);

                const result =
                    await BusinessUnitService.canUserAccessBusinessUnitByExternalId(
                        "C1.1",
                        2,
                        10014,
                        false
                    );

                expect(result).toBe(true);
            });

            it("should allow Account_Manager to import to any BU", async () => {
                const result =
                    await BusinessUnitService.canUserAccessBusinessUnitByExternalId(
                        "C2",
                        null,
                        10014,
                        true
                    );

                expect(result).toBe(true);
                expect(prisma.businessUnit.findFirst).not.toHaveBeenCalled();
            });
        });

        describe("Edge Cases and Error Handling", () => {
            it("should allow empty string external ID (no BU assignment)", async () => {
                const result =
                    await BusinessUnitService.canUserAccessBusinessUnitByExternalId(
                        "",
                        1,
                        10014,
                        false
                    );

                expect(result).toBe(true);
                expect(prisma.businessUnit.findFirst).not.toHaveBeenCalled();
            });

            it("should trim external ID before validation", async () => {
                (prisma.businessUnit.findFirst as any).mockResolvedValue({ id: 2 });
                vi.spyOn(
                    BusinessUnitService,
                    "getAccessibleBusinessUnitIds"
                ).mockResolvedValue([1, 2, 3]);

                const result =
                    await BusinessUnitService.canUserAccessBusinessUnitByExternalId(
                        "  BU-001  ",
                        1,
                        10014,
                        false
                    );

                expect(result).toBe(true);
                expect(prisma.businessUnit.findFirst).toHaveBeenCalledWith({
                    where: {
                        external_id: "BU-001",
                        account_id: 10014,
                    },
                    select: { id: true },
                });
            });

            it("should handle database errors gracefully", async () => {
                (prisma.businessUnit.findFirst as any).mockRejectedValue(
                    new Error("Database connection error")
                );

                await expect(
                    BusinessUnitService.canUserAccessBusinessUnitByExternalId(
                        "BU-001",
                        1,
                        10014,
                        false
                    )
                ).rejects.toThrow("Database connection error");
            });
        });
    });
});

