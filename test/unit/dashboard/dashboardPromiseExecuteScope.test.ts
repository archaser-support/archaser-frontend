import { describe, it, expect, vi, beforeEach } from "vitest";

import {
    prepareDashboardPromiseExecuteFilters,
    resolveDashboardPromiseExecuteScope,
} from "@/server/services/dashboardPromiseExecuteScope";
import { DASHBOARD_PROMISE_ACTIVITY_FILTER_FIELD } from "@/shared/dashboard/dashboardPromiseChartFilters";
import { getPortalUserId, getSystemUserId } from "@/server/services/UserService";

vi.mock("@/server/services/DashboardBusinessUnitFilterService", async () => {
    const actual = await vi.importActual<
        typeof import("@/server/services/DashboardBusinessUnitFilterService")
    >("@/server/services/DashboardBusinessUnitFilterService");
    return {
        ...actual,
        resolveDashboardBusinessUnitFilter: vi.fn(),
    };
});

vi.mock("@/lib/prisma", () => ({
    prisma: {
        user: {
            findMany: vi.fn(),
        },
    },
}));

import { resolveDashboardBusinessUnitFilter } from "@/server/services/DashboardBusinessUnitFilterService";
import { prisma } from "@/lib/prisma";

describe("resolveDashboardPromiseExecuteScope", () => {
    const getOwnerFilter = vi.fn();
    const accessControl = { getOwnerFilter } as any;

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

    it("applies Customer owner + BU for non-admin", async () => {
        const result = await resolveDashboardPromiseExecuteScope(
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

        expect(result.businessUnitFilter).toEqual({ business_unit_id: 42 });
        expect(result.ownerFilter).toEqual({
            OR: [{ owner_id: "user-1" }, { owner_id: null }],
        });
    });

    it("skips Customer BU and owner for master admin", async () => {
        const result = await resolveDashboardPromiseExecuteScope(
            {
                businessUnitIdParam: "42",
                userBusinessUnitId: 10,
                isAdmin: true,
                accountId: 10013,
                userId: "admin",
                hasViewAsPermission: true,
            },
            accessControl
        );

        expect(result.businessUnitFilter).toEqual({});
        expect(result.ownerFilter).toEqual({});
        expect(getOwnerFilter).not.toHaveBeenCalled();
    });
});

describe("prepareDashboardPromiseExecuteFilters", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(prisma.user.findMany).mockResolvedValue([
            { id: "agent-1" },
        ] as any);
    });

    it("expands promise-activity marker into Activity.some membership", async () => {
        const prepared = await prepareDashboardPromiseExecuteFilters(
            [
                {
                    table: "CustomerCollectionPeriod",
                    field: DASHBOARD_PROMISE_ACTIVITY_FILTER_FIELD,
                    operator: "equals",
                    value: {
                        start: "2026-07-01T00:00:00.000Z",
                        end: "2026-07-12T00:00:00.000Z",
                    },
                },
            ],
            {
                accountId: 5,
                selectedUserId: null,
                agentBusinessUnitFilter: {},
                isAdmin: true,
            }
        );

        expect(prepared.filters).toEqual([]);
        const systemUserId = getSystemUserId(5);
        const portalUserId = getPortalUserId(5);
        expect(prepared.primaryWhereExtras).toEqual({
            promise_to_pay_amount: { not: null },
            Activity: {
                some: {
                    created_by: {
                        in: ["agent-1"].filter(
                            (id) => id !== systemUserId && id !== portalUserId
                        ),
                    },
                    type: "Promise_to_pay",
                    status: "COMPLETED",
                    created_at: {
                        gte: new Date("2026-07-01T00:00:00.000Z"),
                        lte: new Date("2026-07-12T00:00:00.000Z"),
                    },
                },
            },
        });
    });

    it("excludes system/portal from Activity.created_by even if in agent set", async () => {
        const systemUserId = getSystemUserId(5);
        const portalUserId = getPortalUserId(5);
        vi.mocked(prisma.user.findMany).mockResolvedValue([
            { id: "agent-1" },
            { id: systemUserId },
            { id: portalUserId },
        ] as any);

        const prepared = await prepareDashboardPromiseExecuteFilters(
            [
                {
                    table: "CustomerCollectionPeriod",
                    field: DASHBOARD_PROMISE_ACTIVITY_FILTER_FIELD,
                    operator: "equals",
                    value: {
                        start: "2026-07-01T00:00:00.000Z",
                        end: "2026-07-12T00:00:00.000Z",
                    },
                },
            ],
            {
                accountId: 5,
                selectedUserId: null,
                agentBusinessUnitFilter: {},
                isAdmin: true,
            }
        );

        expect(
            (prepared.primaryWhereExtras as any)?.Activity?.some?.created_by
        ).toEqual({ in: ["agent-1"] });
    });

    it("leaves non-marker filters untouched when marker missing", async () => {
        const prepared = await prepareDashboardPromiseExecuteFilters(
            [
                {
                    table: "CustomerCollectionPeriod",
                    field: "currency",
                    operator: "equals",
                    value: "USD",
                },
            ],
            {
                accountId: 5,
                selectedUserId: null,
                agentBusinessUnitFilter: {},
                isAdmin: true,
            }
        );

        expect(prepared.filters).toHaveLength(1);
        expect(prepared.primaryWhereExtras).toBeUndefined();
    });
});
