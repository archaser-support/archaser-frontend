import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { AccessControlService } from "@/server/services/AccessControlService";
import {
    DashboardBusinessUnitAccessDeniedError,
    resolveDashboardBusinessUnitFilterFromRequest,
} from "@/server/services/DashboardBusinessUnitFilterService";
import { BusinessUnitService } from "@/server/services/BusinessUnitService";
import { PermissionService } from "@/server/services/PermissionService";

import { authOptions } from "@/server/auth/authOptions";

export type CreditDashboardAccessDenied =
    | { status: 401; error: string }
    | { status: 403; error: string };

export type CreditDashboardAccessContext = {
    accountId: number;
    role: string;
    isAdmin: boolean;
    businessUnitFilter: Record<string, unknown>;
    selectedBusinessUnitId: number | null;
    accessibleBusinessUnitIds: number[] | null;
};

export async function authorizeCreditDashboardRequest(
    req: NextApiRequest,
    res: NextApiResponse,
    permission = "view_credit_dashboard"
): Promise<CreditDashboardAccessContext | CreditDashboardAccessDenied> {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) {
        return { status: 401, error: "Unauthorized" };
    }

    const access = AccessControlService.getInstance();
    const userInfo = await access.getUserInfo(req);
    const accountId = userInfo.viewAsUserAccountId || userInfo.accountId;
    const role = userInfo.viewAsUserRole || userInfo.role;
    const isAdmin = userInfo.accountId === 10013;

    const [account, allowed] = await Promise.all([
        prisma.account.findUnique({
            where: { id: accountId },
            select: { has_credit_insurance: true },
        }),
        PermissionService.getInstance().hasPermission(
            accountId,
            role,
            permission
        ),
    ]);

    if (!account?.has_credit_insurance) {
        return {
            status: 403,
            error: "Credit insurance is not enabled for this account",
        };
    }
    if (!allowed) {
        return { status: 403, error: "Forbidden" };
    }

    try {
        const { filter, selectedBusinessUnitId } =
            await resolveDashboardBusinessUnitFilterFromRequest(
                req,
                userInfo.businessUnitId,
                isAdmin,
                accountId
            );

        const accessibleBusinessUnitIds =
            await BusinessUnitService.getAccessibleBusinessUnitIds(
                userInfo.businessUnitId ?? null,
                isAdmin
            );

        return {
            accountId,
            role,
            isAdmin,
            businessUnitFilter: filter,
            selectedBusinessUnitId,
            accessibleBusinessUnitIds,
        };
    } catch (error) {
        if (error instanceof DashboardBusinessUnitAccessDeniedError) {
            return {
                status: 403,
                error: "Access denied: business unit not accessible",
            };
        }
        throw error;
    }
}
