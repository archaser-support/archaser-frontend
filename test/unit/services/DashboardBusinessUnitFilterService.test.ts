import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccessControlService } from "@/server/services/AccessControlService";
import {
    DashboardBusinessUnitAccessDeniedError,
    parseDashboardBusinessUnitIdParam,
    resolveDashboardBusinessUnitFilter,
} from "@/server/services/DashboardBusinessUnitFilterService";
import { BusinessUnitService } from "@/server/services/BusinessUnitService";

vi.mock("@/server/services/AccessControlService", () => ({
    AccessControlService: {
        getInstance: vi.fn(),
    },
}));

vi.mock("@/server/services/BusinessUnitService", () => ({
    BusinessUnitService: {
        getBusinessUnitHierarchy: vi.fn(),
    },
}));

vi.mock("@/lib/prisma", () => ({
    prisma: {
        businessUnit: {
            findFirst: vi.fn(),
        },
    },
}));

import { prisma } from "@/lib/prisma";

describe("DashboardBusinessUnitFilterService", () => {
    const getBusinessUnitFilter = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(AccessControlService.getInstance).mockReturnValue({
            getBusinessUnitFilter,
        } as unknown as AccessControlService);
    });

    describe("parseDashboardBusinessUnitIdParam", () => {
        it("returns null when param is absent or empty", () => {
            expect(parseDashboardBusinessUnitIdParam(undefined)).toBeNull();
            expect(parseDashboardBusinessUnitIdParam("")).toBeNull();
        });

        it("parses numeric business unit id", () => {
            expect(parseDashboardBusinessUnitIdParam("42")).toBe(42);
        });

        it("throws when param is not numeric", () => {
            expect(() => parseDashboardBusinessUnitIdParam("abc")).toThrow(
                DashboardBusinessUnitAccessDeniedError
            );
        });
    });

    describe("resolveDashboardBusinessUnitFilter", () => {
        it("returns access-control filter for All selection (leaf user)", async () => {
            const expectedFilter = {
                OR: [{ business_unit_id: 10 }],
            };
            getBusinessUnitFilter.mockResolvedValue(expectedFilter);

            const result = await resolveDashboardBusinessUnitFilter({
                userBusinessUnitId: 10,
                isAdmin: false,
                accountId: 5,
                selectedBusinessUnitId: null,
            });

            expect(result).toEqual({
                filter: expectedFilter,
                selectedBusinessUnitId: null,
            });
            expect(getBusinessUnitFilter).toHaveBeenCalledWith(10, false, 5);
        });

        it("returns access-control filter for parent user with All selection", async () => {
            const expectedFilter = {
                OR: [
                    { business_unit_id: 10 },
                    { business_unit_id: { in: [11, 12] } },
                ],
            };
            getBusinessUnitFilter.mockResolvedValue(expectedFilter);

            const result = await resolveDashboardBusinessUnitFilter({
                userBusinessUnitId: 10,
                isAdmin: false,
                accountId: 5,
            });

            expect(result.filter).toEqual(expectedFilter);
            expect(result.selectedBusinessUnitId).toBeNull();
        });

        it("narrows to a specific child business unit", async () => {
            vi.mocked(BusinessUnitService.getBusinessUnitHierarchy).mockResolvedValue(
                [11, 12]
            );

            const result = await resolveDashboardBusinessUnitFilter({
                userBusinessUnitId: 10,
                isAdmin: false,
                accountId: 5,
                selectedBusinessUnitId: 11,
            });

            expect(result).toEqual({
                filter: { business_unit_id: 11 },
                selectedBusinessUnitId: 11,
            });
        });

        it("includes null-BU customers only through All selection for primary users", async () => {
            const expectedFilter = {
                OR: [
                    { business_unit_id: 10 },
                    { business_unit_id: { in: [11] } },
                    { business_unit_id: null },
                ],
            };
            getBusinessUnitFilter.mockResolvedValue(expectedFilter);

            const allResult = await resolveDashboardBusinessUnitFilter({
                userBusinessUnitId: 10,
                isAdmin: false,
                accountId: 5,
                selectedBusinessUnitId: null,
            });

            expect(allResult.filter).toEqual(expectedFilter);

            vi.mocked(BusinessUnitService.getBusinessUnitHierarchy).mockResolvedValue(
                [11]
            );

            const specificResult = await resolveDashboardBusinessUnitFilter({
                userBusinessUnitId: 10,
                isAdmin: false,
                accountId: 5,
                selectedBusinessUnitId: 11,
            });

            expect(specificResult.filter).toEqual({ business_unit_id: 11 });
        });

        it("rejects inaccessible business unit ids with 403 error", async () => {
            vi.mocked(BusinessUnitService.getBusinessUnitHierarchy).mockResolvedValue(
                [11]
            );

            await expect(
                resolveDashboardBusinessUnitFilter({
                    userBusinessUnitId: 10,
                    isAdmin: false,
                    accountId: 5,
                    selectedBusinessUnitId: 99,
                })
            ).rejects.toThrow(DashboardBusinessUnitAccessDeniedError);
        });

        it("returns unrestricted filter for archaser admin with All selection", async () => {
            getBusinessUnitFilter.mockResolvedValue({});

            const result = await resolveDashboardBusinessUnitFilter({
                userBusinessUnitId: 10,
                isAdmin: true,
                accountId: 5,
                selectedBusinessUnitId: null,
            });

            expect(result).toEqual({
                filter: {},
                selectedBusinessUnitId: null,
            });
        });

        it("narrows archaser admin to a valid account business unit", async () => {
            vi.mocked(prisma.businessUnit.findFirst).mockResolvedValue({
                id: 20,
            } as never);

            const result = await resolveDashboardBusinessUnitFilter({
                userBusinessUnitId: 10,
                isAdmin: true,
                accountId: 5,
                selectedBusinessUnitId: 20,
            });

            expect(result).toEqual({
                filter: { business_unit_id: 20 },
                selectedBusinessUnitId: 20,
            });
            expect(prisma.businessUnit.findFirst).toHaveBeenCalledWith({
                where: { id: 20, account_id: 5 },
                select: { id: true },
            });
        });

        it("rejects archaser admin selection when business unit is not on account", async () => {
            vi.mocked(prisma.businessUnit.findFirst).mockResolvedValue(null);

            await expect(
                resolveDashboardBusinessUnitFilter({
                    userBusinessUnitId: 10,
                    isAdmin: true,
                    accountId: 5,
                    selectedBusinessUnitId: 20,
                })
            ).rejects.toThrow(DashboardBusinessUnitAccessDeniedError);
        });

        it("uses the provided user business unit tree (View As context)", async () => {
            vi.mocked(BusinessUnitService.getBusinessUnitHierarchy).mockResolvedValue(
                [31]
            );

            const result = await resolveDashboardBusinessUnitFilter({
                userBusinessUnitId: 30,
                isAdmin: false,
                accountId: 5,
                selectedBusinessUnitId: 31,
            });

            expect(result.selectedBusinessUnitId).toBe(31);
            expect(BusinessUnitService.getBusinessUnitHierarchy).toHaveBeenCalledWith(
                30
            );
        });
    });
});
