import { describe, it, expect, vi, beforeEach } from "vitest";

import { resolveDashboardInvoiceExecuteScope } from "@/server/services/dashboardInvoiceExecuteScope";
import { DashboardBusinessUnitAccessDeniedError } from "@/server/services/DashboardBusinessUnitFilterService";

vi.mock("@/server/services/DashboardBusinessUnitFilterService", async () => {
    const actual = await vi.importActual<
        typeof import("@/server/services/DashboardBusinessUnitFilterService")
    >("@/server/services/DashboardBusinessUnitFilterService");
    return {
        ...actual,
        resolveDashboardBusinessUnitFilter: vi.fn(),
    };
});

import { resolveDashboardBusinessUnitFilter } from "@/server/services/DashboardBusinessUnitFilterService";

describe("resolveDashboardInvoiceExecuteScope", () => {
    const getOwnerFilter = vi.fn();
    const accessControl = {
        getOwnerFilter,
    } as any;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(resolveDashboardBusinessUnitFilter).mockResolvedValue({
            filter: { business_unit_id: 42 },
            selectedBusinessUnitId: 42,
        });
        getOwnerFilter.mockResolvedValue({
            OR: [{ owner_id: "user-1" }, { owner_id: null }],
        });
    });

    it("applies URL businessUnitId and owner filter like chart-details", async () => {
        const result = await resolveDashboardInvoiceExecuteScope(
            {
                businessUnitIdParam: "42",
                userBusinessUnitId: 10,
                isAdmin: false,
                accountId: 5,
                userId: "user-1",
                hasViewAsPermission: false,
            },
            accessControl
        );

        expect(resolveDashboardBusinessUnitFilter).toHaveBeenCalledWith({
            userBusinessUnitId: 10,
            isAdmin: false,
            accountId: 5,
            selectedBusinessUnitId: 42,
        });
        expect(getOwnerFilter).toHaveBeenCalledWith(
            "user-1",
            false,
            undefined,
            undefined,
            undefined
        );
        expect(result.businessUnitFilter).toEqual({ business_unit_id: 42 });
        expect(result.ownerFilter).toEqual({
            OR: [{ owner_id: "user-1" }, { owner_id: null }],
        });
    });

    it("skips owner filter for admin account", async () => {
        const result = await resolveDashboardInvoiceExecuteScope(
            {
                businessUnitIdParam: null,
                userBusinessUnitId: 10,
                isAdmin: true,
                accountId: 10013,
                userId: "admin",
                hasViewAsPermission: true,
            },
            accessControl
        );

        expect(getOwnerFilter).not.toHaveBeenCalled();
        expect(result.ownerFilter).toEqual({});
    });

    it("propagates inaccessible business unit errors", async () => {
        vi.mocked(resolveDashboardBusinessUnitFilter).mockRejectedValue(
            new DashboardBusinessUnitAccessDeniedError()
        );

        await expect(
            resolveDashboardInvoiceExecuteScope(
                {
                    businessUnitIdParam: "99",
                    userBusinessUnitId: 10,
                    isAdmin: false,
                    accountId: 5,
                    userId: "user-1",
                    hasViewAsPermission: false,
                },
                accessControl
            )
        ).rejects.toThrow(DashboardBusinessUnitAccessDeniedError);
    });
});
