import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { AccessControlService } from '@/server/services/AccessControlService';
import { BusinessUnitService } from '@/server/services/BusinessUnitService';

// Mock BusinessUnitService
vi.mock('@/server/services/BusinessUnitService', () => ({
    BusinessUnitService: {
        getBusinessUnitHierarchy: vi.fn(),
    },
}));

// Mock prisma
vi.mock('@/lib/prisma', () => ({
    prisma: {
        businessUnit: {
            findUnique: vi.fn(),
        },
    },
}));

describe('AccessControlService', () => {
    let accessControl: AccessControlService;

    beforeEach(() => {
        vi.clearAllMocks();
        accessControl = AccessControlService.getInstance();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getBusinessUnitFilter', () => {
        describe('Admin users', () => {
            it('should return empty filter for admin users', async () => {
                const isAdmin = true;
                const userBuId = 1;
                const accountId = 1;

                const result = await accessControl.getBusinessUnitFilter(userBuId, isAdmin, accountId);

                expect(result).toEqual({});
                expect(BusinessUnitService.getBusinessUnitHierarchy).not.toHaveBeenCalled();
            });
        });

        describe('Users without BU', () => {
            it('should return filter that matches nothing when user has no BU', async () => {
                const isAdmin = false;
                const userBuId = null;
                const accountId = 1;

                const result = await accessControl.getBusinessUnitFilter(userBuId, isAdmin, accountId);

                // Should return a filter that matches nothing (impossible condition)
                expect(result).toEqual({
                    id: -1,
                });
                expect(BusinessUnitService.getBusinessUnitHierarchy).not.toHaveBeenCalled();
            });

            it('should return filter that matches nothing when user has undefined BU', async () => {
                const isAdmin = false;
                const userBuId = undefined;
                const accountId = 1;

                const result = await accessControl.getBusinessUnitFilter(userBuId, isAdmin, accountId);

                // Should return a filter that matches nothing (impossible condition)
                expect(result).toEqual({
                    id: -1,
                });
                expect(BusinessUnitService.getBusinessUnitHierarchy).not.toHaveBeenCalled();
            });
        });

        describe('Users with BU', () => {
            it('should return filter for user BU, null BU (if primary), and descendant BUs', async () => {
                const isAdmin = false;
                const userBuId = 1;
                const accountId = 1;
                const descendantIds = [2, 3];

                (BusinessUnitService.getBusinessUnitHierarchy as any).mockResolvedValue(
                    descendantIds
                );

                // Mock primary BU
                const { prisma } = await import('@/lib/prisma');
                (prisma.businessUnit.findUnique as any).mockResolvedValue({
                    id: userBuId,
                    is_primary: true,
                    account_id: accountId,
                });

                const result = await accessControl.getBusinessUnitFilter(userBuId, isAdmin, accountId);

                expect(result).toEqual({
                    OR: [
                        { business_unit_id: userBuId },
                        { business_unit_id: { in: descendantIds } },
                        { business_unit_id: null },
                    ],
                });
                expect(BusinessUnitService.getBusinessUnitHierarchy).toHaveBeenCalledWith(
                    userBuId
                );
            });

            it('should return filter without null BU if user BU is not primary', async () => {
                const isAdmin = false;
                const userBuId = 1;
                const accountId = 1;

                (BusinessUnitService.getBusinessUnitHierarchy as any).mockResolvedValue([]);

                // Mock non-primary BU
                const { prisma } = await import('@/lib/prisma');
                (prisma.businessUnit.findUnique as any).mockResolvedValue({
                    id: userBuId,
                    is_primary: false,
                    account_id: accountId,
                });

                const result = await accessControl.getBusinessUnitFilter(userBuId, isAdmin, accountId);

                expect(result).toEqual({
                    OR: [
                        { business_unit_id: userBuId },
                    ],
                });
                expect(BusinessUnitService.getBusinessUnitHierarchy).toHaveBeenCalledWith(
                    userBuId
                );
            });

            it('should handle hierarchical BU structure correctly with primary BU', async () => {
                const isAdmin = false;
                const userBuId = 1;
                const accountId = 1;
                // Simulate: 1 -> [2, 3], 2 -> [4], 3 -> [5]
                const descendantIds = [2, 3, 4, 5];

                (BusinessUnitService.getBusinessUnitHierarchy as any).mockResolvedValue(
                    descendantIds
                );

                // Mock primary BU
                const { prisma } = await import('@/lib/prisma');
                (prisma.businessUnit.findUnique as any).mockResolvedValue({
                    id: userBuId,
                    is_primary: true,
                    account_id: accountId,
                });

                const result = await accessControl.getBusinessUnitFilter(userBuId, isAdmin, accountId);

                expect(result).toEqual({
                    OR: [
                        { business_unit_id: userBuId },
                        { business_unit_id: { in: descendantIds } },
                        { business_unit_id: null },
                    ],
                });
            });
        });

        describe('Edge cases', () => {
            it('should handle empty descendant array correctly with primary BU', async () => {
                const isAdmin = false;
                const userBuId = 1;
                const accountId = 1;

                (BusinessUnitService.getBusinessUnitHierarchy as any).mockResolvedValue([]);

                // Mock primary BU
                const { prisma } = await import('@/lib/prisma');
                (prisma.businessUnit.findUnique as any).mockResolvedValue({
                    id: userBuId,
                    is_primary: true,
                    account_id: accountId,
                });

                const result = await accessControl.getBusinessUnitFilter(userBuId, isAdmin, accountId);

                expect(result.OR).toHaveLength(2);
                expect(result.OR).not.toContainEqual(
                    expect.objectContaining({ business_unit_id: { in: expect.anything() } })
                );
            });

            it('should handle single descendant correctly with primary BU', async () => {
                const isAdmin = false;
                const userBuId = 1;
                const accountId = 1;
                const descendantIds = [2];

                (BusinessUnitService.getBusinessUnitHierarchy as any).mockResolvedValue(
                    descendantIds
                );

                // Mock primary BU
                const { prisma } = await import('@/lib/prisma');
                (prisma.businessUnit.findUnique as any).mockResolvedValue({
                    id: userBuId,
                    is_primary: true,
                    account_id: accountId,
                });

                const result = await accessControl.getBusinessUnitFilter(userBuId, isAdmin, accountId);

                expect(result).toEqual({
                    OR: [
                        { business_unit_id: userBuId },
                        { business_unit_id: { in: [2] } },
                        { business_unit_id: null },
                    ],
                });
            });
        });
    });

    describe('getUserBusinessUnitFilter', () => {
        describe('Admin users', () => {
            it('should return empty filter for admin users', async () => {
                const filter = await accessControl.getUserBusinessUnitFilter(69, true);
                
                expect(filter).toEqual({});
                expect(BusinessUnitService.getBusinessUnitHierarchy).not.toHaveBeenCalled();
            });
        });

        describe('Non-admin users', () => {
            it('should return filter for user BU only when no descendants', async () => {
                vi.mocked(BusinessUnitService.getBusinessUnitHierarchy).mockResolvedValue([]);

                const filter = await accessControl.getUserBusinessUnitFilter(69, false, false);

                expect(filter).toEqual({
                    OR: [
                        { business_unit_id: 69 }
                    ]
                });
                expect(BusinessUnitService.getBusinessUnitHierarchy).toHaveBeenCalledWith(69);
            });

            it('should include descendant BUs in filter', async () => {
                vi.mocked(BusinessUnitService.getBusinessUnitHierarchy).mockResolvedValue([70, 71]);

                const filter = await accessControl.getUserBusinessUnitFilter(69, false, false);

                expect(filter).toEqual({
                    OR: [
                        { business_unit_id: 69 },
                        { business_unit_id: { in: [70, 71] } }
                    ]
                });
            });

            it('should NOT include null BU by default', async () => {
                vi.mocked(BusinessUnitService.getBusinessUnitHierarchy).mockResolvedValue([70]);

                const filter = await accessControl.getUserBusinessUnitFilter(69, false, false);

                expect(filter.OR).not.toContainEqual({ business_unit_id: null });
                expect(filter.OR).toHaveLength(2); // Only user's BU and descendants
            });

            it('should include null BU when explicitly requested', async () => {
                vi.mocked(BusinessUnitService.getBusinessUnitHierarchy).mockResolvedValue([70]);

                const filter = await accessControl.getUserBusinessUnitFilter(69, false, true);

                expect(filter).toEqual({
                    OR: [
                        { business_unit_id: 69 },
                        { business_unit_id: { in: [70] } },
                        { business_unit_id: null }
                    ]
                });
            });

            it('should return only null BU filter when user has no BU', async () => {
                const filter = await accessControl.getUserBusinessUnitFilter(null, false, false);

                expect(filter).toEqual({
                    business_unit_id: null
                });
                expect(BusinessUnitService.getBusinessUnitHierarchy).not.toHaveBeenCalled();
            });

            it('should return only null BU filter when user BU is undefined', async () => {
                const filter = await accessControl.getUserBusinessUnitFilter(undefined, false, false);

                expect(filter).toEqual({
                    business_unit_id: null
                });
                expect(BusinessUnitService.getBusinessUnitHierarchy).not.toHaveBeenCalled();
            });
        });

        describe('Difference from getBusinessUnitFilter', () => {
            it('getUserBusinessUnitFilter should NOT include null BU by default, getBusinessUnitFilter only includes null if primary', async () => {
                vi.mocked(BusinessUnitService.getBusinessUnitHierarchy).mockResolvedValue([70]);

                const userFilter = await accessControl.getUserBusinessUnitFilter(69, false, false);
                
                // Mock non-primary BU
                const { prisma } = await import('@/lib/prisma');
                (prisma.businessUnit.findUnique as any).mockResolvedValue({
                    id: 69,
                    is_primary: false,
                    account_id: 1,
                });
                
                const customerFilter = await accessControl.getBusinessUnitFilter(69, false, 1);

                // getUserBusinessUnitFilter should NOT include null
                expect(userFilter.OR).not.toContainEqual({ business_unit_id: null });
                
                // getBusinessUnitFilter should NOT include null if BU is not primary
                expect(customerFilter.OR).not.toContainEqual({ business_unit_id: null });
            });

            it('getBusinessUnitFilter should include null BU only if user BU is primary', async () => {
                vi.mocked(BusinessUnitService.getBusinessUnitHierarchy).mockResolvedValue([70]);

                // Mock primary BU
                const { prisma } = await import('@/lib/prisma');
                (prisma.businessUnit.findUnique as any).mockResolvedValue({
                    id: 69,
                    is_primary: true,
                    account_id: 1,
                });
                
                const customerFilter = await accessControl.getBusinessUnitFilter(69, false, 1);

                // getBusinessUnitFilter SHOULD include null if BU is primary
                expect(customerFilter.OR).toContainEqual({ business_unit_id: null });
            });
        });

        describe('Sibling BU isolation', () => {
            it('should NOT include sibling BUs (only descendants)', async () => {
                // User is in BU 69
                // BU 70 is a sibling (same parent)
                // BU 71 is a child of BU 69
                vi.mocked(BusinessUnitService.getBusinessUnitHierarchy).mockResolvedValue([71]);

                const filter = await accessControl.getUserBusinessUnitFilter(69, false, false);

                expect(filter).toEqual({
                    OR: [
                        { business_unit_id: 69 },      // User's own BU
                        { business_unit_id: { in: [71] } }  // Only descendant BU 71
                    ]
                });

                // BU 70 (sibling) should NOT be included
                expect(filter.OR).not.toContainEqual({ business_unit_id: 70 });
                expect(filter.OR).not.toContainEqual({ business_unit_id: { in: [70] } });
            });
        });
    });
});

