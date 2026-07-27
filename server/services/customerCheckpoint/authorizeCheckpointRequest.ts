import type { NextApiRequest, NextApiResponse } from "next";

import { prisma } from "@/lib/prisma";
import { AccessControlService } from "@/server/services/AccessControlService";
import { BusinessUnitService } from "@/server/services/BusinessUnitService";
import { PermissionService } from "@/server/services/PermissionService";
import { getSessionOrTestAuth } from "@/utils/testAuthHelper";

export type CheckpointAccessDenied =
    | { status: 401; error: string; code?: string }
    | { status: 403; error: string; code?: string }
    | { status: 404; error: string; code?: string };

export type CheckpointAuthContext = {
    customerId: number;
    accountId: number;
    userId: string;
};

async function resolveCustomerId(
    customerUUID: string | string[] | undefined,
    customerIdQuery: string | string[] | undefined
): Promise<number | null> {
    if (customerIdQuery) {
        const id = parseInt(String(customerIdQuery), 10);
        if (Number.isFinite(id)) {
            const customer = await prisma.customer.findFirst({
                where: { id },
                select: { id: true },
            });
            if (customer) return customer.id;
        }
    }

    const uuid = String(customerUUID ?? "");
    if (uuid && uuid !== "_" && uuid !== "undefined") {
        const customer = await prisma.customer.findFirst({
            where: { customer_uuid: uuid },
            select: { id: true },
        });
        if (customer) return customer.id;
    }

    return null;
}

export async function authorizeCheckpointRequest(
    req: NextApiRequest,
    res: NextApiResponse,
    options: { requireNonProduction?: boolean } = {}
): Promise<CheckpointAuthContext | CheckpointAccessDenied> {
    if (options.requireNonProduction && process.env.NODE_ENV === "production") {
        return {
            status: 403,
            error: "Customer checkpoints are not available in production",
            code: "CHECKPOINT_PRODUCTION_DISABLED",
        };
    }

    const { user } = await getSessionOrTestAuth(req, res);
    if (!user) {
        return { status: 401, error: "Unauthorized" };
    }

    const customerId = await resolveCustomerId(
        req.query.customerUUID,
        req.query.customer_id
    );
    if (!customerId) {
        return {
            status: 404,
            error: "Customer not found",
            code: "CUSTOMER_NOT_FOUND",
        };
    }

    const accessControl = AccessControlService.getInstance();
    const userInfo = await accessControl.getUserInfo(req);
    const effectiveAccountId =
        userInfo.viewAsUserAccountId || userInfo.accountId;
    const effectiveRole = userInfo.viewAsUserRole || userInfo.role;

    const permissionService = PermissionService.getInstance();
    const hasViewAsPermission = await permissionService.hasPermission(
        effectiveAccountId,
        effectiveRole,
        "use_view_as"
    );
    const isCollectionManagerOrSystemAdmin = hasViewAsPermission;
    const isAdmin = effectiveAccountId === 10013;

    const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: {
            id: true,
            account_id: true,
            owner_id: true,
            business_unit_id: true,
            Account: {
                select: { enable_customer_checkpoints: true },
            },
        },
    });

    if (!customer) {
        return {
            status: 404,
            error: "Customer not found",
            code: "CUSTOMER_NOT_FOUND",
        };
    }

    if (customer.account_id !== effectiveAccountId) {
        return {
            status: 403,
            error: "Access denied",
            code: "ACCESS_DENIED_ACCOUNT",
        };
    }

    if (!customer.Account?.enable_customer_checkpoints) {
        return {
            status: 403,
            error: "Customer checkpoints are not enabled for this account",
            code: "CHECKPOINTS_DISABLED",
        };
    }

    if (!isAdmin && !isCollectionManagerOrSystemAdmin) {
        const effectiveUserId = accessControl.getEffectiveUserId(userInfo);
        const hasOwnerAccess =
            !customer.owner_id || customer.owner_id === effectiveUserId;
        if (!hasOwnerAccess) {
            return {
                status: 403,
                error: "Access denied",
                code: "ACCESS_DENIED_OWNER",
            };
        }
    }

    if (!isAdmin && !isCollectionManagerOrSystemAdmin) {
        const canAccess = await BusinessUnitService.canUserAccessCustomer(
            userInfo.businessUnitId ?? null,
            customer.business_unit_id ?? null
        );
        if (!canAccess) {
            return {
                status: 403,
                error: "Access denied",
                code: "ACCESS_DENIED_BUSINESS_UNIT",
            };
        }
    }

    return {
        customerId: customer.id,
        accountId: customer.account_id,
        userId: accessControl.getEffectiveUserId(userInfo),
    };
}
