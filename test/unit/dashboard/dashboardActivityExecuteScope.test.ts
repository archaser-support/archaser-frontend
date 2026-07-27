import { describe, it, expect, vi, beforeEach } from "vitest";

import {
    businessUnitFilterToUserConstraint,
    prepareDashboardActivityExecuteFilters,
    resolveCreatedByForIdentityMode,
    resolveDashboardActivityExecuteScope,
} from "@/server/services/dashboardActivityExecuteScope";
import {
    DASHBOARD_ACTIVITY_IDENTITY_FILTER_FIELD,
    DASHBOARD_TOTAL_CALLS_FILTER_FIELD,
} from "@/shared/dashboard/dashboardActivityChartFilters";
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

describe("businessUnitFilterToUserConstraint", () => {
    it("maps scalar and in-list BU filters for User.business_unit_id", () => {
        expect(
            businessUnitFilterToUserConstraint({ business_unit_id: 42 })
        ).toEqual({ business_unit_id: 42 });
        expect(
            businessUnitFilterToUserConstraint({
                business_unit_id: { in: [1, 2, null] },
            })
        ).toEqual({ business_unit_id: { in: [1, 2] } });
        expect(
            businessUnitFilterToUserConstraint({
                business_unit_id: { in: [null] },
            })
        ).toEqual({ business_unit_id: null });
        expect(businessUnitFilterToUserConstraint({})).toBeNull();
    });
});

describe("resolveCreatedByForIdentityMode", () => {
    const accountId = 5;
    const systemUserId = getSystemUserId(accountId);
    const portalUserId = getPortalUserId(accountId);

    it("returns exact system / portal IDs for audit drills", () => {
        expect(
            resolveCreatedByForIdentityMode({
                identityMode: "system",
                accountId,
                agentIds: ["a1"],
            })
        ).toBe(systemUserId);
        expect(
            resolveCreatedByForIdentityMode({
                identityMode: "portal",
                accountId,
                agentIds: ["a1"],
            })
        ).toBe(portalUserId);
    });

    it("excludes system/portal for agents_excl_audit even when pushed", () => {
        expect(
            resolveCreatedByForIdentityMode({
                identityMode: "agents_excl_audit",
                accountId,
                agentIds: ["a1", "a2"],
                selectedUserId: null,
            })
        ).toEqual({ in: ["a1", "a2"] });
    });

    it("includes system/portal for all_agents_incl_audit when no selectedUserId", () => {
        expect(
            resolveCreatedByForIdentityMode({
                identityMode: "all_agents_incl_audit",
                accountId,
                agentIds: ["a1"],
                selectedUserId: null,
            })
        ).toEqual({ in: ["a1", systemUserId, portalUserId] });
    });

    it("does not re-add system/portal when selectedUserId is set", () => {
        expect(
            resolveCreatedByForIdentityMode({
                identityMode: "all_agents_incl_audit",
                accountId,
                agentIds: ["a1"],
                selectedUserId: "a1",
            })
        ).toEqual({ in: ["a1"] });
    });
});

describe("resolveDashboardActivityExecuteScope", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(resolveDashboardBusinessUnitFilter).mockResolvedValue({
            filter: { business_unit_id: 42 },
            selectedBusinessUnitId: 42,
        });
    });

    it("skips Customer and agent BU for master admin (details parity)", async () => {
        const result = await resolveDashboardActivityExecuteScope({
            businessUnitIdParam: "42",
            userBusinessUnitId: 10,
            isAdmin: true,
            accountId: 10013,
        });
        expect(result.businessUnitFilter).toEqual({});
        expect(result.agentBusinessUnitFilter).toEqual({});
    });

    it("applies Customer and agent BU for non-admin", async () => {
        const result = await resolveDashboardActivityExecuteScope({
            businessUnitIdParam: "42",
            userBusinessUnitId: 10,
            isAdmin: false,
            accountId: 5,
        });
        expect(result.businessUnitFilter).toEqual({ business_unit_id: 42 });
        expect(result.agentBusinessUnitFilter).toEqual({
            business_unit_id: 42,
        });
    });
});

describe("prepareDashboardActivityExecuteFilters", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(prisma.user.findMany).mockResolvedValue([
            { id: "agent-1" },
            { id: "11111111-1111-1111-1111-000000000005" },
        ] as any);
    });

    it("expands identity + total-calls markers into primaryWhereExtras", async () => {
        const prepared = await prepareDashboardActivityExecuteFilters(
            [
                {
                    table: "Activity",
                    field: "created_at",
                    operator: "between",
                    value: ["2026-07-01", "2026-07-12"],
                },
                {
                    table: "Activity",
                    field: DASHBOARD_ACTIVITY_IDENTITY_FILTER_FIELD,
                    operator: "equals",
                    value: "agents_excl_audit",
                },
                {
                    table: "Activity",
                    field: DASHBOARD_TOTAL_CALLS_FILTER_FIELD,
                    operator: "equals",
                    value: true,
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
                table: "Activity",
                field: "created_at",
                operator: "between",
                value: ["2026-07-01", "2026-07-12"],
            },
        ]);
        expect(prepared.primaryWhereExtras?.created_by).toEqual({
            in: ["agent-1"],
        });
        expect(prepared.primaryWhereExtras?.OR).toEqual([
            { type: { in: ["Call", "Promise_to_pay"] } },
            {
                AND: [
                    { type: "Dispute" },
                    {
                        title: {
                            contains: "filed",
                            mode: "insensitive",
                        },
                    },
                ],
            },
        ]);
        expect(prisma.user.findMany).toHaveBeenCalled();
    });

    it("scopes created_by to selectedUserId when present in agent set", async () => {
        vi.mocked(prisma.user.findMany).mockResolvedValue([
            { id: "agent-1" },
        ] as any);

        const prepared = await prepareDashboardActivityExecuteFilters(
            [
                {
                    table: "Activity",
                    field: DASHBOARD_ACTIVITY_IDENTITY_FILTER_FIELD,
                    operator: "equals",
                    value: "all_agents_incl_audit",
                },
            ],
            {
                accountId: 5,
                selectedUserId: "agent-1",
                agentBusinessUnitFilter: {},
                isAdmin: true,
            }
        );

        expect(prepared.primaryWhereExtras?.created_by).toEqual({
            in: ["agent-1"],
        });
    });

    it("resolves system identity to account system user id", async () => {
        const prepared = await prepareDashboardActivityExecuteFilters(
            [
                {
                    table: "Activity",
                    field: DASHBOARD_ACTIVITY_IDENTITY_FILTER_FIELD,
                    operator: "equals",
                    value: "system",
                },
            ],
            {
                accountId: 5,
                agentBusinessUnitFilter: {},
                isAdmin: true,
            }
        );

        expect(prepared.primaryWhereExtras?.created_by).toBe(
            getSystemUserId(5)
        );
    });
});
