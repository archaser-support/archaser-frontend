import { prisma } from "@/lib/prisma";

import { AccessControlService } from "./AccessControlService";
import { BusinessUnitService } from "./BusinessUnitService";

export class DashboardBusinessUnitAccessDeniedError extends Error {
    constructor() {
        super("Access denied: business unit not accessible");
        this.name = "DashboardBusinessUnitAccessDeniedError";
    }
}

export interface ResolveDashboardBusinessUnitFilterInput {
    userBusinessUnitId: number | null | undefined;
    isAdmin: boolean;
    accountId: number;
    selectedBusinessUnitId?: number | null;
}

export interface ResolveDashboardBusinessUnitFilterResult {
    filter: Record<string, unknown>;
    /** Null means aggregate across all accessible business units ("All"). */
    selectedBusinessUnitId: number | null;
}

export function parseDashboardBusinessUnitIdParam(
    value: string | string[] | undefined
): number | null {
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw === undefined || raw === null || raw === "") {
        return null;
    }

    const parsed = parseInt(String(raw), 10);
    if (Number.isNaN(parsed)) {
        throw new DashboardBusinessUnitAccessDeniedError();
    }

    return parsed;
}

export async function resolveDashboardBusinessUnitFilter(
    input: ResolveDashboardBusinessUnitFilterInput
): Promise<ResolveDashboardBusinessUnitFilterResult> {
    const {
        userBusinessUnitId,
        isAdmin,
        accountId,
        selectedBusinessUnitId = null,
    } = input;

    if (selectedBusinessUnitId == null) {
        const accessControl = AccessControlService.getInstance();
        const filter = await accessControl.getBusinessUnitFilter(
            userBusinessUnitId,
            isAdmin,
            accountId
        );

        return {
            filter,
            selectedBusinessUnitId: null,
        };
    }

    if (isAdmin) {
        const businessUnit = await prisma.businessUnit.findFirst({
            where: {
                id: selectedBusinessUnitId,
                account_id: accountId,
            },
            select: { id: true },
        });

        if (!businessUnit) {
            throw new DashboardBusinessUnitAccessDeniedError();
        }

        return {
            filter: { business_unit_id: selectedBusinessUnitId },
            selectedBusinessUnitId,
        };
    }

    if (!userBusinessUnitId) {
        throw new DashboardBusinessUnitAccessDeniedError();
    }

    const descendantIds =
        await BusinessUnitService.getBusinessUnitHierarchy(userBusinessUnitId);
    const accessibleIds = new Set([userBusinessUnitId, ...descendantIds]);

    if (!accessibleIds.has(selectedBusinessUnitId)) {
        throw new DashboardBusinessUnitAccessDeniedError();
    }

    return {
        filter: { business_unit_id: selectedBusinessUnitId },
        selectedBusinessUnitId,
    };
}

export async function resolveDashboardBusinessUnitFilterFromRequest(
    request: { query: Record<string, string | string[] | undefined> },
    userBusinessUnitId: number | null | undefined,
    isAdmin: boolean,
    accountId: number
): Promise<ResolveDashboardBusinessUnitFilterResult> {
    const selectedBusinessUnitId = parseDashboardBusinessUnitIdParam(
        request.query.businessUnitId
    );

    return resolveDashboardBusinessUnitFilter({
        userBusinessUnitId,
        isAdmin,
        accountId,
        selectedBusinessUnitId,
    });
}
