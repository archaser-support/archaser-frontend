import { NextApiRequest } from "next";
import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { prisma } from "@/lib/prisma";
import { getCookieName } from "@/utils/authUtils";

import { BusinessUnitService } from "./BusinessUnitService";
import { PermissionService } from "./PermissionService";

interface UserInfo {
    userId: string;
    accountId: number;
    role: string;
    isCollectionManager: boolean;
    isAccountManager?: boolean; // Field to indicate if user is Account Manager (Collection Manager)
    viewAsUserId?: string; // New field to store the selected user's ID
    viewAsUserRole?: string; // New field to store the view-as user's role
    viewAsUserAccountId?: number; // New field to store the view-as user's customer ID
    businessUnitId?: number | null; // New field to store user's business unit ID
}

export class AccessControlService {
    private static instance: AccessControlService;
    private constructor() { }

    public static getInstance(): AccessControlService {
        if (!AccessControlService.instance) {
            AccessControlService.instance = new AccessControlService();
        }
        return AccessControlService.instance;
    }

    /**
     * Get user information from the request token
     * @param request NextRequest object
     * @returns UserInfo object containing user details
     * @throws Error if user is unauthorized
     */
    public async getUserInfo(
        request: NextApiRequest | NextRequest
    ): Promise<UserInfo> {
        const isSecure =
            process.env.NODE_ENV === "production" &&
            process.env.NEXT_PUBLIC_BASE_URL?.startsWith("https://");

        const token = await getToken({
            req: request,
            secret: process.env.NEXTAUTH_SECRET,
            cookieName: getCookieName(isSecure ?? false),
        });

        if (!token) {
            throw new Error("Unauthorized");
        }
        // ... rest of the function ...
        const userRole = (token.role as string) || "Auditor"; // Default to Auditor if role is NULL

        let viewAsUserRole: string | undefined;
        let viewAsUserAccountId: number | undefined;

        // If viewing as another user, fetch their role and account_id
        if (token.view_as_user_id) {
            // First check if they are already in the token
            if (token.view_as_user_role && token.view_as_user_account_id) {
                viewAsUserRole = token.view_as_user_role as string;
                viewAsUserAccountId = token.view_as_user_account_id as number;
            } else {
                try {
                    const viewAsUser = await prisma.user.findUnique({
                        where: { id: token.view_as_user_id as string },
                        select: {
                            role: true,
                            account_id: true,
                        },
                    });
                    viewAsUserRole = (viewAsUser?.role as string) || undefined;
                    viewAsUserAccountId = viewAsUser?.account_id || undefined;
                } catch {
                    // Silently handle error
                }
            }
        }

        // Fetch current user's business_unit_id if not in token
        let businessUnitId: number | null = (token.business_unit_id as number) || null;
        if (businessUnitId === null) {
            try {
                const currentUser = await prisma.user.findUnique({
                    where: { id: token.id as string },
                    select: { business_unit_id: true },
                });
                businessUnitId = currentUser?.business_unit_id || null;
            } catch {
                // Silently handle error
            }
        }

        // If viewing as another user, use their business_unit_id
        let effectiveBusinessUnitId = businessUnitId;
        if (token.view_as_user_id) {
            // No easy way to get business_unit_id from token for view-as user currently without further hydration
            // Keeping the DB fetch for this specific field for now but prioritizing view-as context
            try {
                const viewAsUser = await prisma.user.findUnique({
                    where: { id: token.view_as_user_id as string },
                    select: { business_unit_id: true },
                });
                effectiveBusinessUnitId = viewAsUser?.business_unit_id || null;
            } catch {
                // Silently handle error
            }
        }

        const userInfo = {
            userId: token.id as string,
            accountId: token.account_id as number,
            role: userRole,
            // Temporary backward compatibility: also check for old "Account_Manager" role during migration
            isCollectionManager:
                userRole === "Collection_Manager" ||
                userRole === "Account_Manager",
            isAccountManager:
                userRole === "Collection_Manager" ||
                userRole === "Account_Manager",
            viewAsUserId: token.view_as_user_id as string | undefined,
            viewAsUserRole,
            viewAsUserAccountId,
            businessUnitId: effectiveBusinessUnitId,
        };

        return userInfo;
    }

    /**
     * Get the effective user ID considering view-as functionality
     * @param userInfo UserInfo object
     * @returns The effective user ID (either view-as user or actual user)
     */
    public getEffectiveUserId(userInfo: UserInfo): string {
        if (userInfo.viewAsUserId) {
            return userInfo.viewAsUserId;
        }
        return userInfo.userId;
    }

    /**
     * Generate owner filter based on user permissions and ID
     * @param userId User's ID
     * @param hasViewAsPermission Whether user has use_view_as permission (replaces isCollectionManager)
     * @param viewAsUserId Optional view-as user ID
     * @param viewAsUserRole Optional role of the user being viewed as (for permission check)
     * @param viewAsUserAccountId Optional account ID of the user being viewed as (for permission check)
     * @returns Prisma filter object for owner access
     */
    public async getOwnerFilter(
        userId: string,
        hasViewAsPermission: boolean,
        viewAsUserId?: string,
        viewAsUserRole?: string,
        viewAsUserAccountId?: number
    ) {
        // If no userId, return empty filter
        if (!userId) {
            return {};
        }

        // If viewing as another user, check their permissions
        if (viewAsUserId && viewAsUserRole && viewAsUserAccountId) {
            // Check if view-as user has use_view_as permission
            const { PermissionService } = await import("@/server/services/PermissionService");
            const permissionService = PermissionService.getInstance();
            const viewAsHasPermission = await permissionService.hasPermission(
                viewAsUserAccountId,
                viewAsUserRole,
                "use_view_as"
            );

            // Users with use_view_as permission should see all customers (no owner filter)
            if (viewAsHasPermission) {
                return {};
            }

            // Users without use_view_as permission should only see assigned/unassigned customers
            const filter = {
                OR: [{ owner_id: viewAsUserId }, { owner_id: null }],
            };
            return filter;
        }

        // Users with use_view_as permission should see all customers (no owner filter)
        if (hasViewAsPermission) {
            return {};
        }

        // For regular users without use_view_as permission, apply owner filter
        const filter = {
            OR: [{ owner_id: userId }, { owner_id: null }],
        };
        return filter;
    }

    /**
     * Generate business unit filter based on user's BU and hierarchy
     * @param userBuId User's business unit ID
     * @param isAdmin Whether user is admin (account_id === 10013)
     * @param accountId Account ID to check if user's BU is primary (required for non-admin users)
     * @returns Prisma filter object for BU access, or empty object if admin
     */
    public async getBusinessUnitFilter(
        userBuId: number | null | undefined,
        isAdmin: boolean,
        accountId?: number
    ): Promise<any> {
        // Admin users see all customers regardless of BU
        if (isAdmin) {
            return {};
        }

        // If user has no BU assigned, they cannot see any customers
        // (per requirements: only primary BU users can see customers with no BU)
        if (!userBuId) {
            // Return a filter that matches nothing (impossible condition)
            return {
                id: -1, // This will never match any customer
            };
        }

        // Get all descendant BU IDs
        const descendantIds =
            await BusinessUnitService.getBusinessUnitHierarchy(userBuId);

        // Check if user's BU is the primary BU for their account
        // Only primary BU users can see customers with no business unit
        let includeNullBU = false;
        if (accountId) {
            const userBU = await prisma.businessUnit.findUnique({
                where: { id: userBuId },
                select: { is_primary: true, account_id: true },
            });
            // Only include null BU if:
            // 1. User's BU is primary
            // 2. User's BU belongs to the same account
            includeNullBU =
                userBU?.is_primary === true &&
                userBU?.account_id === accountId;
        }

        // User can see customers where:
        // 1. Customer's BU matches user's BU
        // 2. Customer's BU is a descendant of user's BU
        // 3. Customer's BU is null (only if user's BU is primary)
        const conditions: any[] = [
            { business_unit_id: userBuId },
            ...(descendantIds.length > 0
                ? [{ business_unit_id: { in: descendantIds } }]
                : []),
        ];

        if (includeNullBU) {
            conditions.push({ business_unit_id: null });
        }

        const filter = {
            OR: conditions,
        };

        return filter;
    }

    /**
     * Generate business unit filter for users (excludes null BU by default)
     * @param userBuId User's business unit ID
     * @param isAdmin Whether user is admin (account_id === 10013)
     * @param includeNullBU Whether to include users with no BU assigned (default: false)
     * @returns Prisma filter object for user BU access
     */
    public async getUserBusinessUnitFilter(
        userBuId: number | null | undefined,
        isAdmin: boolean,
        includeNullBU: boolean = false
    ): Promise<any> {
        // Admin users see all users regardless of BU
        if (isAdmin) {
            return {};
        }

        // If user has no BU assigned, they can only see users with no BU
        if (!userBuId) {
            return {
                business_unit_id: null,
            };
        }

        // Get all descendant BU IDs
        const descendantIds =
            await BusinessUnitService.getBusinessUnitHierarchy(userBuId);

        // User can see other users where:
        // 1. User's BU matches their BU
        // 2. User's BU is a descendant of their BU
        // 3. Optionally: User has no BU (if includeNullBU is true)
        const conditions: any[] = [
            { business_unit_id: userBuId },
            ...(descendantIds.length > 0
                ? [{ business_unit_id: { in: descendantIds } }]
                : []),
        ];

        if (includeNullBU) {
            conditions.push({ business_unit_id: null });
        }

        const filter = {
            OR: conditions,
        };

        return filter;
    }

    /**
     * Build business unit filter for a specific table
     * Handles tables with direct business_unit_id and tables that filter through Customer relationship
     * @param primaryTable Table name (Customer, Invoice, Payment, Activity, Contact, Dispute, etc.)
     * @param userBuId User's business unit ID
     * @param isAdmin Whether user is admin (account_id === 10013)
     * @param accountId Account ID to check if user's BU is primary
     * @returns Prisma filter object for BU access, or empty object if admin
     */
    public async buildBusinessUnitFilterForTable(
        primaryTable: string,
        userBuId: number | null | undefined,
        isAdmin: boolean,
        accountId?: number
    ): Promise<any> {
        // Get the base business unit filter
        const baseFilter = await this.getBusinessUnitFilter(userBuId, isAdmin, accountId);

        // If no filter (admin) or empty filter, return empty object
        if (!baseFilter || Object.keys(baseFilter).length === 0) {
            return {};
        }

        // Tables with direct business_unit_id column
        const tablesWithDirectBU = ["Customer", "User", "DashboardCache"];

        if (tablesWithDirectBU.includes(primaryTable)) {
            // Direct filter on business_unit_id
            return baseFilter;
        }

        // Tables that filter through Customer relationship
        if (primaryTable === "Contact") {
            // Contact -> Company -> Customer relationship
            return {
                Company: {
                    Customer: {
                        some: baseFilter,
                    },
                },
            };
        }

        if (primaryTable === "Dispute") {
            // Dispute (CustomerDispute) -> Customer relationship
            return {
                Customer: baseFilter,
            };
        }

        // For Invoice, Payment, Activity - filter through Customer relationship
        if (["Invoice", "Payment", "Activity"].includes(primaryTable)) {
            return {
                Customer: baseFilter,
            };
        }

        // For other tables, return empty filter (no BU restriction)
        // This allows flexibility for future tables that might not need BU filtering
        return {};
    }

    /**
     * Get access control filter for a request
     * @param request NextRequest object
     * @returns Prisma filter object for access control
     */
    public async getAccessControlFilter(request: NextApiRequest | NextRequest) {
        const userInfo = await this.getUserInfo(request);

        // Check for broader access via use_view_as permission
        const { PermissionService } = await import("@/server/services/PermissionService");
        const permissionService = PermissionService.getInstance();
        const effectiveAccountId = userInfo.viewAsUserAccountId || userInfo.accountId;
        const effectiveRole = userInfo.viewAsUserRole || userInfo.role;
        const hasViewAsPermission = await permissionService.hasPermission(
            effectiveAccountId,
            effectiveRole,
            "use_view_as"
        );

        return await this.getOwnerFilter(
            userInfo.userId,
            hasViewAsPermission,
            userInfo.viewAsUserId,
            userInfo.viewAsUserRole,
            userInfo.viewAsUserAccountId
        );
    }

    /**
     * Check if user has required role
     * @param request NextRequest object
     * @param requiredRole Role required for access
     * @returns boolean indicating if user has required role
     */
    public async hasRole(
        request: NextRequest,
        requiredRole: string
    ): Promise<boolean> {
        const { role } = await this.getUserInfo(request);
        return role === requiredRole;
    }

    /**
     * Check if user has any of the required roles
     * @param request NextRequest object
     * @param requiredRoles Array of roles that can access
     * @returns boolean indicating if user has any of the required roles
     */
    public async hasAnyRole(
        request: NextRequest,
        requiredRoles: string[]
    ): Promise<boolean> {
        const { role } = await this.getUserInfo(request);
        return requiredRoles.includes(role);
    }

    /**
     * Check if the current user is viewing as another user
     * @param request NextRequest object
     * @returns boolean indicating if user is in view-as mode
     */
    public async isViewingAsUser(request: NextRequest): Promise<boolean> {
        const userInfo = await this.getUserInfo(request);
        return !!userInfo.viewAsUserId;
    }

    /**
     * Get user access control filter based on role and account_id
     * @param userInfo UserInfo object containing user details
     * @param requestedAccountId Optional account_id from request query
     * @returns Prisma filter object for user access control
     */
    public async getUserAccessFilter(
        userInfo: UserInfo,
        requestedAccountId?: string
    ) {
        // If user has account_id 10013, they can see all users
        // Admin role is handled by PermissionService
        if (userInfo.accountId === 10013) {
            // For admin users viewing as another user, apply that user's restrictions
            if (
                userInfo.viewAsUserId &&
                userInfo.viewAsUserRole &&
                userInfo.viewAsUserAccountId
            ) {
                // Check if view-as user has use_view_as permission
                const { PermissionService } = await import("@/server/services/PermissionService");
                const permissionService = PermissionService.getInstance();
                const hasViewAsPermission = await permissionService.hasPermission(
                    userInfo.viewAsUserAccountId,
                    userInfo.viewAsUserRole,
                    "use_view_as"
                );

                // If view-as user doesn't have use_view_as permission, restrict to their account
                if (!hasViewAsPermission) {
                    return { account_id: userInfo.viewAsUserAccountId };
                }
            }

            // For admin users, if account_id is specified, filter by it
            if (requestedAccountId) {
                return { account_id: parseInt(requestedAccountId, 10) };
            }
            // For admin users with no account_id specified, return empty filter (show all)
            return {};
        }

        // For non-admin users, only show users from their account_id
        return { account_id: userInfo.accountId };
    }

    /**
     * Check if user can use view-as functionality
     * @param userInfo UserInfo object
     * @returns boolean indicating if user can use view-as
     */
    public async canUseViewAs(userInfo: UserInfo): Promise<boolean> {
        // Check account_id 10013
        if (userInfo.accountId === 10013) {
            return true;
        }

        // Check use_view_as permission
        const { PermissionService } = await import("@/server/services/PermissionService");
        const permissionService = PermissionService.getInstance();
        const effectiveAccountId = userInfo.viewAsUserAccountId || userInfo.accountId;
        const effectiveRole = userInfo.viewAsUserRole || userInfo.role;
        const hasViewAsPermission = await permissionService.hasPermission(
            effectiveAccountId,
            effectiveRole,
            "use_view_as"
        );
        return hasViewAsPermission;
    }

    /**
     * Check if user has a specific permission
     * @param userInfo UserInfo object
     * @param permission Permission key to check
     * @returns boolean indicating if user has the permission
     */
    public async checkPermission(
        userInfo: UserInfo,
        permission: string
    ): Promise<boolean> {
        const permissionService = PermissionService.getInstance();
        const effectiveRole = userInfo.viewAsUserRole || userInfo.role;
        const effectiveAccountId =
            userInfo.viewAsUserAccountId || userInfo.accountId;

        return await permissionService.hasPermission(
            effectiveAccountId,
            effectiveRole,
            permission
        );
    }

    /**
     * Check if user has a specific permission from a request
     * @param request NextRequest or NextApiRequest object
     * @param permission Permission key to check
     * @returns boolean indicating if user has the permission
     */
    public async checkPermissionFromRequest(
        request: NextApiRequest | NextRequest,
        permission: string
    ): Promise<boolean> {
        const userInfo = await this.getUserInfo(request);
        return await this.checkPermission(userInfo, permission);
    }
}
