/**
 * Resolve owner/BU + expand promise Activity.some membership for dashboard_promises.
 * Mirrors getOperationDashboardDetails promises-to-pay rules on CustomerCollectionPeriod.
 */

import { AccessControlService } from "@/server/services/AccessControlService";
import {
    DashboardBusinessUnitAccessDeniedError,
    parseDashboardBusinessUnitIdParam,
    resolveDashboardBusinessUnitFilter,
} from "@/server/services/DashboardBusinessUnitFilterService";
import { resolveDashboardActivityAgentIds } from "@/server/services/dashboardActivityExecuteScope";
import type { Filter } from "@/server/services/ReportExecutionService.types";
import {
    DASHBOARD_PROMISE_ACTIVITY_FILTER_FIELD,
    parsePromiseActivityMarkerValue,
} from "@/shared/dashboard/dashboardPromiseChartFilters";
import { expandDashboardPromiseActivityWhere } from "@/shared/dashboard/dashboardPromisePeriodMembership";
import { getPortalUserId, getSystemUserId } from "@/server/services/UserService";

export interface DashboardPromiseExecuteScopeInput {
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

export interface DashboardPromiseExecuteScopeResult {
    businessUnitFilter: Record<string, unknown>;
    agentBusinessUnitFilter: Record<string, unknown>;
    ownerFilter: Record<string, unknown>;
}

export interface PreparedDashboardPromiseExecuteFilters {
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
 * Resolve URL/session BU + Customer owner scope for promise execute.
 * Customer BU skipped for master admin (details parity).
 */
export async function resolveDashboardPromiseExecuteScope(
    input: DashboardPromiseExecuteScopeInput,
    accessControl: AccessControlService = AccessControlService.getInstance()
): Promise<DashboardPromiseExecuteScopeResult> {
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
 * Strip promise-activity marker and expand into primaryWhereExtras.
 */
export async function prepareDashboardPromiseExecuteFilters(
    filters: Filter[] | undefined,
    options: {
        accountId: number;
        selectedUserId?: string | null;
        agentBusinessUnitFilter: Record<string, unknown>;
        isAdmin: boolean;
    }
): Promise<PreparedDashboardPromiseExecuteFilters> {
    if (!filters?.length) {
        return { filters: filters ?? [] };
    }

    const markerIndex = filters.findIndex(
        (f) =>
            f.table === "CustomerCollectionPeriod" &&
            f.field === DASHBOARD_PROMISE_ACTIVITY_FILTER_FIELD
    );

    if (markerIndex < 0) {
        return { filters };
    }

    const range = parsePromiseActivityMarkerValue(filters[markerIndex].value);
    const rest = filters.filter((_, i) => i !== markerIndex);

    if (!range) {
        return { filters: rest };
    }

    const agentIds = await resolveDashboardActivityAgentIds({
        accountId: options.accountId,
        selectedUserId: options.selectedUserId,
        agentBusinessUnitFilter: options.agentBusinessUnitFilter,
        isAdmin: options.isAdmin,
    });

    // Match details: exclude system/portal from Activity.some created_by
    // even when they were present on the broader agent set.
    const systemUserId = getSystemUserId(options.accountId);
    const portalUserId = getPortalUserId(options.accountId);
    const agentIdsExclAudit = agentIds.filter(
        (id) => id !== systemUserId && id !== portalUserId
    );

    return {
        filters: rest,
        primaryWhereExtras: expandDashboardPromiseActivityWhere({
            start: range.start,
            end: range.end,
            agentIdsExclAudit,
        }),
    };
}
