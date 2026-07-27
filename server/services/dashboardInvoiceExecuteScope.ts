import {
    DashboardBusinessUnitAccessDeniedError,
    parseDashboardBusinessUnitIdParam,
    resolveDashboardBusinessUnitFilter,
} from "@/server/services/DashboardBusinessUnitFilterService";
import { AccessControlService } from "@/server/services/AccessControlService";

export interface DashboardInvoiceExecuteScopeInput {
    /** Query or body businessUnitId (dashboard picker). */
    businessUnitIdParam?: string | string[] | number | null;
    userBusinessUnitId: number | null | undefined;
    isAdmin: boolean;
    accountId: number;
    userId: string;
    hasViewAsPermission: boolean;
    viewAsUserId?: string;
    viewAsUserRole?: string;
    viewAsUserAccountId?: number;
}

export interface DashboardInvoiceExecuteScopeResult {
    businessUnitFilter: Record<string, unknown>;
    ownerFilter: Record<string, unknown>;
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
 * Resolve owner + URL/session business-unit scope the same way chart-details does.
 */
export async function resolveDashboardInvoiceExecuteScope(
    input: DashboardInvoiceExecuteScopeInput,
    accessControl: AccessControlService = AccessControlService.getInstance()
): Promise<DashboardInvoiceExecuteScopeResult> {
    const selectedBusinessUnitId = normalizeBusinessUnitIdParam(
        input.businessUnitIdParam
    );

    const { filter: businessUnitFilter } =
        await resolveDashboardBusinessUnitFilter({
            userBusinessUnitId: input.userBusinessUnitId,
            isAdmin: input.isAdmin,
            accountId: input.accountId,
            selectedBusinessUnitId,
        });

    const ownerFilter = input.isAdmin
        ? {}
        : await accessControl.getOwnerFilter(
              input.userId,
              input.hasViewAsPermission,
              input.viewAsUserId,
              input.viewAsUserRole,
              input.viewAsUserAccountId
          );

    return { businessUnitFilter, ownerFilter };
}
