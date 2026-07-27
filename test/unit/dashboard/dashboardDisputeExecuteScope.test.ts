import { describe, it, expect, vi, beforeEach } from "vitest";

import {
    prepareDashboardDisputeExecuteFilters,
    resolveDashboardDisputeExecuteScope,
} from "@/server/services/dashboardDisputeExecuteScope";
import { DASHBOARD_DISPUTE_FAMILY_FILTER_FIELD } from "@/shared/dashboard/dashboardDisputeChartFilters";
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

describe("resolveDashboardDisputeExecuteScope", () => {
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
        const result = await resolveDashboardDisputeExecuteScope(
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
        const result = await resolveDashboardDisputeExecuteScope(
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

describe("prepareDashboardDisputeExecuteFilters", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(prisma.user.findMany).mockResolvedValue([
            { id: "agent-1" },
        ] as any);
    });

    it("expands created marker into primaryWhereExtras with audit exclusion", async () => {
        const prepared = await prepareDashboardDisputeExecuteFilters(
            [
                {
                    table: "Dispute",
                    field: "created_at",
                    operator: "between",
                    value: ["2026-07-01", "2026-07-12"],
                },
                {
                    table: "Dispute",
                    field: DASHBOARD_DISPUTE_FAMILY_FILTER_FIELD,
                    operator: "equals",
                    value: "created",
                },
            ],
            {
                accountId: 5,
                selectedUserId: null,
                agentBusinessUnitFilter: {},
                isAdmin: true,
            }
        );

        expect(prepared.filters).toEqual([
            {
                table: "Dispute",
                field: "created_at",
                operator: "between",
                value: ["2026-07-01", "2026-07-12"],
            },
        ]);
        const systemUserId = getSystemUserId(5);
        const portalUserId = getPortalUserId(5);
        expect(prepared.primaryWhereExtras?.created_by).toEqual({
            notIn: [portalUserId, systemUserId],
        });
        expect(prepared.primaryWhereExtras?.OR).toEqual([
            {
                created_by: {
                    in: ["agent-1", systemUserId, portalUserId],
                },
            },
            {
                owner_id: {
                    in: ["agent-1", systemUserId, portalUserId],
                },
            },
        ]);
    });

    it("expands closed marker with modified_by audit exclusion", async () => {
        const prepared = await prepareDashboardDisputeExecuteFilters(
            [
                {
                    table: "Dispute",
                    field: DASHBOARD_DISPUTE_FAMILY_FILTER_FIELD,
                    operator: "equals",
                    value: "closed",
                },
            ],
            {
                accountId: 5,
                selectedUserId: "agent-1",
                agentBusinessUnitFilter: {},
                isAdmin: true,
            }
        );

        const systemUserId = getSystemUserId(5);
        const portalUserId = getPortalUserId(5);
        expect(prepared.primaryWhereExtras?.modified_by).toEqual({
            notIn: [portalUserId, systemUserId],
        });
        expect(prepared.primaryWhereExtras?.OR).toEqual([
            { created_by: { in: ["agent-1"] } },
            { owner_id: { in: ["agent-1"] } },
            { modified_by: { in: ["agent-1"] } },
        ]);
    });
});
