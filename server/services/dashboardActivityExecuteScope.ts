/**
 * Resolve created_by identity + expand activity markers for dashboard_activities execute.
 * Mirrors getOperationDashboardDetails agent-set / system / portal rules.
 */

import { prisma } from "@/lib/prisma";
import {
    DashboardBusinessUnitAccessDeniedError,
    parseDashboardBusinessUnitIdParam,
    resolveDashboardBusinessUnitFilter,
} from "@/server/services/DashboardBusinessUnitFilterService";
import type { Filter } from "@/server/services/ReportExecutionService.types";
import {
    DASHBOARD_ACTIVITY_IDENTITY_FILTER_FIELD,
    DASHBOARD_TOTAL_CALLS_FILTER_FIELD,
    expandDashboardTotalCallsWhere,
    type DashboardActivityIdentityMode,
} from "@/shared/dashboard/dashboardActivityChartFilters";
import { getPortalUserId, getSystemUserId } from "@/server/services/UserService";

export interface DashboardActivityExecuteScopeInput {
    businessUnitIdParam?: string | string[] | number | null;
    userBusinessUnitId: number | null | undefined;
    isAdmin: boolean;
    accountId: number;
    selectedUserId?: string | null;
}

export interface DashboardActivityExecuteScopeResult {
    /**
     * Customer BU filter for ReportQueryBuilder.
     * Empty for master admin (account 10013) to match details API asymmetry.
     */
    businessUnitFilter: Record<string, unknown>;
    /** Raw BU filter used when resolving agent User.business_unit_id. */
    agentBusinessUnitFilter: Record<string, unknown>;
}

export interface PreparedDashboardActivityExecuteFilters {
    filters: Filter[];
    primaryWhereExtras?: Record<string, unknown>;
}

function normalizeBusinessUnitIdParam(
    value: string | string[] | number | null | undefined
): number | null {
    if (value === null || value === undefined || value === "") {
        return null;
    }
    if (typeof value === "number") {
        if (Number.isNaN(value)) {
            throw new DashboardBusinessUnitAccessDeniedError();
        }
        return value;
    }
    return parseDashboardBusinessUnitIdParam(value);
}

function isAuditUserId(userId: string): boolean {
    return (
        userId.startsWith("11111111-1111-1111-1111-") ||
        userId.startsWith("00000000-0000-0000-0000-")
    );
}

/**
 * Extract User.business_unit_id constraint from a Customer-shaped BU filter,
 * matching getOperationDashboardDetails agent resolution.
 */
export function businessUnitFilterToUserConstraint(
    buFilter: Record<string, unknown>
): Record<string, unknown> | null {
    if (!buFilter || Object.keys(buFilter).length === 0) {
        return null;
    }
    const businessUnitId = buFilter.business_unit_id as
        | number
        | { in?: Array<number | null> }
        | undefined;
    if (businessUnitId == null) {
        return null;
    }
    if (typeof businessUnitId === "number") {
        return { business_unit_id: businessUnitId };
    }
    if (Array.isArray(businessUnitId.in)) {
        const nonNullIds = businessUnitId.in.filter(
            (id): id is number => id !== null
        );
        if (nonNullIds.length > 0) {
            return { business_unit_id: { in: nonNullIds } };
        }
        return { business_unit_id: null };
    }
    return null;
}

/**
 * Resolve URL/session BU for activity execute.
 * Customer BU is skipped for master admin (details parity); agent resolution
 * still receives the raw filter when non-admin.
 */
export async function resolveDashboardActivityExecuteScope(
    input: DashboardActivityExecuteScopeInput
): Promise<DashboardActivityExecuteScopeResult> {
    const selectedBusinessUnitId = normalizeBusinessUnitIdParam(
        input.businessUnitIdParam
    );

    const { filter } = await resolveDashboardBusinessUnitFilter({
        userBusinessUnitId: input.userBusinessUnitId,
        isAdmin: input.isAdmin,
        accountId: input.accountId,
        selectedBusinessUnitId,
    });

    // Details API: Customer BU only when !isAdmin (account !== 10013).
    const businessUnitFilter = input.isAdmin ? {} : filter;

    return {
        businessUnitFilter,
        agentBusinessUnitFilter: input.isAdmin ? {} : filter,
    };
}

/**
 * Resolve Active agent IDs for the account (audit UUID prefixes stripped),
 * optionally narrowed by selectedUserId and User BU — same as details.
 */
export async function resolveDashboardActivityAgentIds(input: {
    accountId: number;
    selectedUserId?: string | null;
    agentBusinessUnitFilter: Record<string, unknown>;
    isAdmin: boolean;
}): Promise<string[]> {
    const collectionAgentsWhere: Record<string, unknown> = {
        account_id: input.accountId,
        status: "Active",
        deactivated_at: null,
    };

    if (input.selectedUserId) {
        collectionAgentsWhere.id = input.selectedUserId;
    }

    if (!input.isAdmin) {
        const userBu = businessUnitFilterToUserConstraint(
            input.agentBusinessUnitFilter
        );
        if (userBu) {
            Object.assign(collectionAgentsWhere, userBu);
        }
    }

    const collectionAgents = await prisma.user.findMany({
        where: collectionAgentsWhere,
        select: { id: true },
    });

    const filteredAgents = collectionAgents.filter(
        (agent) => !isAuditUserId(agent.id)
    );

    let agentIds = filteredAgents.map((agent) => agent.id);

    if (input.selectedUserId) {
        if (agentIds.includes(input.selectedUserId)) {
            agentIds = [input.selectedUserId];
        } else {
            agentIds = [];
        }
    }

    return agentIds;
}

export function resolveCreatedByForIdentityMode(input: {
    identityMode: DashboardActivityIdentityMode;
    accountId: number;
    agentIds: string[];
    selectedUserId?: string | null;
}): string | { in: string[] } {
    const systemUserId = getSystemUserId(input.accountId);
    const portalUserId = getPortalUserId(input.accountId);

    if (input.identityMode === "system") {
        return systemUserId;
    }
    if (input.identityMode === "portal") {
        return portalUserId;
    }

    // Match details: when no selected user, push system/portal onto the query set.
    let queryIds = [...input.agentIds];
    if (!input.selectedUserId) {
        queryIds.push(systemUserId, portalUserId);
    }

    if (input.identityMode === "agents_excl_audit") {
        queryIds = queryIds.filter(
            (id) => id !== systemUserId && id !== portalUserId
        );
    }

    return { in: queryIds };
}

/**
 * Strip identity / total-calls markers and expand into primaryWhereExtras.
 */
export async function prepareDashboardActivityExecuteFilters(
    filters: Filter[] | undefined,
    options: {
        accountId: number;
        selectedUserId?: string | null;
        agentBusinessUnitFilter: Record<string, unknown>;
        isAdmin: boolean;
    }
): Promise<PreparedDashboardActivityExecuteFilters> {
    if (!filters?.length) {
        return { filters: filters ?? [] };
    }

    const identityIndex = filters.findIndex(
        (f) =>
            f.table === "Activity" &&
            f.field === DASHBOARD_ACTIVITY_IDENTITY_FILTER_FIELD
    );
    const totalCallsIndex = filters.findIndex(
        (f) =>
            f.table === "Activity" &&
            f.field === DASHBOARD_TOTAL_CALLS_FILTER_FIELD
    );

    if (identityIndex < 0 && totalCallsIndex < 0) {
        return { filters };
    }

    const identityMode =
        identityIndex >= 0
            ? (String(filters[identityIndex].value) as DashboardActivityIdentityMode)
            : null;

    const rest = filters.filter(
        (_, i) => i !== identityIndex && i !== totalCallsIndex
    );

    const primaryWhereExtras: Record<string, unknown> = {};

    if (identityMode) {
        const agentIds = await resolveDashboardActivityAgentIds({
            accountId: options.accountId,
            selectedUserId: options.selectedUserId,
            agentBusinessUnitFilter: options.agentBusinessUnitFilter,
            isAdmin: options.isAdmin,
        });
        primaryWhereExtras.created_by = resolveCreatedByForIdentityMode({
            identityMode,
            accountId: options.accountId,
            agentIds,
            selectedUserId: options.selectedUserId,
        });
    }

    if (totalCallsIndex >= 0) {
        Object.assign(primaryWhereExtras, expandDashboardTotalCallsWhere());
    }

    return {
        filters: rest,
        primaryWhereExtras:
            Object.keys(primaryWhereExtras).length > 0
                ? primaryWhereExtras
                : undefined,
    };
}
