/**
 * Resolve dispute agent OR membership + Customer owner/BU for dashboard_disputes execute.
 * Mirrors getOperationDashboardDetails disputes-created / disputes-closed rules.
 */

import { AccessControlService } from "@/server/services/AccessControlService";
import {
    DashboardBusinessUnitAccessDeniedError,
    parseDashboardBusinessUnitIdParam,
    resolveDashboardBusinessUnitFilter,
} from "@/server/services/DashboardBusinessUnitFilterService";
import {
    resolveDashboardActivityAgentIds,
} from "@/server/services/dashboardActivityExecuteScope";
import type { Filter } from "@/server/services/ReportExecutionService.types";
import {
    DASHBOARD_DISPUTE_FAMILY_FILTER_FIELD,
    expandDashboardDisputeFamilyWhere,
    type DashboardDisputeChartFamily,
} from "@/shared/dashboard/dashboardDisputeChartFilters";
import { getPortalUserId, getSystemUserId } from "@/server/services/UserService";

export interface DashboardDisputeExecuteScopeInput {
    businessUnitIdParam?: string | string[] | number | null;
    userBusinessUnitId: number | null | undefined;
    isAdmin: boolean;
    accountId: number;
    userId: string;
    hasViewAsPermission: boolean;
    viewAsUserId?: string;
    viewAsUserRole?: string;
    viewAsUserAccountId?: number;
    selectedUserId?: string | null;
}

export interface DashboardDisputeExecuteScopeResult {
    businessUnitFilter: Record<string, unknown>;
    agentBusinessUnitFilter: Record<string, unknown>;
    ownerFilter: Record<string, unknown>;
}

export interface PreparedDashboardDisputeExecuteFilters {
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

/**
 * Resolve URL/session BU + Customer owner scope for dispute execute.
 * Customer BU skipped for master admin (details parity).
 */
export async function resolveDashboardDisputeExecuteScope(
    input: DashboardDisputeExecuteScopeInput,
    accessControl: AccessControlService = AccessControlService.getInstance()
): Promise<DashboardDisputeExecuteScopeResult> {
    const selectedBusinessUnitId = normalizeBusinessUnitIdParam(
        input.businessUnitIdParam
    );

    const { filter } = await resolveDashboardBusinessUnitFilter({
        userBusinessUnitId: input.userBusinessUnitId,
        isAdmin: input.isAdmin,
        accountId: input.accountId,
        selectedBusinessUnitId,
    });

    const businessUnitFilter = input.isAdmin ? {} : filter;
    const agentBusinessUnitFilter = input.isAdmin ? {} : filter;

    const ownerFilter = input.isAdmin
        ? {}
        : await accessControl.getOwnerFilter(
              input.userId,
              input.hasViewAsPermission,
              input.viewAsUserId,
              input.viewAsUserRole,
              input.viewAsUserAccountId
          );

    return {
        businessUnitFilter,
        agentBusinessUnitFilter,
        ownerFilter,
    };
}

/**
 * Query agent ID set for dispute drills — same Active-user resolution as details,
 * then push system/portal when no selectedUserId (legacy agentIds behavior).
 */
export async function resolveDashboardDisputeAgentIds(input: {
    accountId: number;
    selectedUserId?: string | null;
    agentBusinessUnitFilter: Record<string, unknown>;
    isAdmin: boolean;
}): Promise<string[]> {
    const agentIds = await resolveDashboardActivityAgentIds(input);
    if (!input.selectedUserId) {
        agentIds.push(
            getSystemUserId(input.accountId),
            getPortalUserId(input.accountId)
        );
    }
    return agentIds;
}

/**
 * Strip dispute family marker and expand into primaryWhereExtras.
 */
export async function prepareDashboardDisputeExecuteFilters(
    filters: Filter[] | undefined,
    options: {
        accountId: number;
        selectedUserId?: string | null;
        agentBusinessUnitFilter: Record<string, unknown>;
        isAdmin: boolean;
    }
): Promise<PreparedDashboardDisputeExecuteFilters> {
    if (!filters?.length) {
        return { filters: filters ?? [] };
    }

    const familyIndex = filters.findIndex(
        (f) =>
            f.table === "Dispute" &&
            f.field === DASHBOARD_DISPUTE_FAMILY_FILTER_FIELD
    );

    if (familyIndex < 0) {
        return { filters };
    }

    const family = String(
        filters[familyIndex].value
    ) as DashboardDisputeChartFamily;
    const rest = filters.filter((_, i) => i !== familyIndex);

    const agentIds = await resolveDashboardDisputeAgentIds({
        accountId: options.accountId,
        selectedUserId: options.selectedUserId,
        agentBusinessUnitFilter: options.agentBusinessUnitFilter,
        isAdmin: options.isAdmin,
    });

    const primaryWhereExtras = expandDashboardDisputeFamilyWhere(family, {
        agentIds,
        systemUserId: getSystemUserId(options.accountId),
        portalUserId: getPortalUserId(options.accountId),
    });

    return {
        filters: rest,
        primaryWhereExtras,
    };
}
