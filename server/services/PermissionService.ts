import { DbClient, prisma } from "@/lib/prisma";

export class PermissionService {
    private static instance: PermissionService;
    private constructor() { }

    public static getInstance(): PermissionService {
        if (!PermissionService.instance) {
            PermissionService.instance = new PermissionService();
        }
        return PermissionService.instance;
    }

    /**
     * Check if a role has a specific permission for an account
     * @param accountId Account ID
     * @param role User role
     * @param permission Permission key
     * @returns boolean indicating if the role has the permission
     */
    public async hasPermission(
        accountId: number,
        role: string,
        permission: string
    ): Promise<boolean> {
        // Normalize role to handle old role names
        const normalizedRole = this.normalizeRole(role, accountId);

        if (!normalizedRole) {
            return false;
        }

        // System_Administrator always has all permissions for any account
        if (normalizedRole === "System_Administrator") {
            return true;
        }

        // Admin role from account_id 10013 always has all permissions
        if (accountId === 10013 && normalizedRole === "archaser_admin") {
            return true;
        }

        try {
            const rolePermission = await prisma.rolePermission.findUnique({
                where: {
                    account_id_role_permission_key: {
                        account_id: accountId,
                        role: normalizedRole as any,
                        permission_key: permission,
                    },
                },
            });

            return !!rolePermission;
        } catch (error: any) {
            // If role is still invalid, log and return false
            console.error(
                `Invalid role for permission check: ${role} (normalized: ${normalizedRole})`,
                error
            );
            return false;
        }
    }

    /**
     * Normalize role name to match Prisma enum values
     * Maps old role names to current enum values
     * @param role User role
     * @param accountId Account ID (for Admin role mapping)
     * @returns Normalized role name
     */
    private normalizeRole(
        role: string | null | undefined,
        accountId?: number
    ): string | null {
        if (!role) return null;

        // Normalize to handle case variations
        const normalizedInput = role.trim();

        // Map old role names to current enum values (case-insensitive)
        // NOTE: Account_Manager is now a real role, so it should NOT be mapped to Collection_Manager
        const roleMap: Record<string, string> = {
            "account manager": "Account_Manager",
            "Account Manager": "Account_Manager", // Map display name to enum value
            "archaser admin": "archaser_admin",
            "ARchaser Admin": "archaser_admin",
            "collection manager": "Collection_Manager",
            "Collection Manager": "Collection_Manager",
            "system administrator": "System_Administrator",
            "System Administrator": "System_Administrator",
            "collection agent": "Collection_Agent",
            "Collection Agent": "Collection_Agent",
            "data analyst": "Data_Analyst",
            "Data Analyst": "Data_Analyst",
            "customer service representative":
                "Customer_Service_Representative",
            "Customer Service Representative":
                "Customer_Service_Representative",
            "it support": "IT_Support",
            "IT Support": "IT_Support",
        };

        // Special handling for "Admin" role based on account ID (case-insensitive)
        if (normalizedInput.toLowerCase() === "admin") {
            return accountId === 10013
                ? "archaser_admin"
                : "System_Administrator";
        }

        // Check if role needs mapping (case-insensitive)
        const lowerInput = normalizedInput.toLowerCase();
        for (const [key, value] of Object.entries(roleMap)) {
            if (key.toLowerCase() === lowerInput) {
                return value;
            }
        }

        // Check if role is already a valid enum value (case-insensitive)
        const validEnumValues = [
            "System_Administrator",
            "archaser_admin",
            "Collection_Manager",
            "Account_Manager",
            "Collection_Agent",
            "Data_Analyst",
            "Customer_Service_Representative",
            "IT_Support",
            "Bookkeeper",
            "CFO",
            "Auditor",
        ];

        for (const enumValue of validEnumValues) {
            if (enumValue.toLowerCase() === lowerInput) {
                return enumValue;
            }
        }

        // Return role as-is if it matches a known pattern (fallback)
        return normalizedInput;
    }

    /**
     * Get all permissions for a role in an account
     * @param accountId Account ID
     * @param role User role
     * @returns Array of permission keys
     */
    public async getRolePermissions(
        accountId: number,
        role: string
    ): Promise<string[]> {
        // Normalize role to handle old role names
        const normalizedRole = this.normalizeRole(role, accountId);

        if (!normalizedRole) {
            // If role is null or invalid, return empty permissions
            return [];
        }

        // System_Administrator: load from DB so edits persist; if never customized return all keys. UAM permissions are always merged in.
        if (normalizedRole === "System_Administrator") {
            const rolePermissions = await prisma.rolePermission.findMany({
                where: {
                    account_id: accountId,
                    role: normalizedRole as any,
                },
                select: { permission_key: true },
            });
            const dbKeys = rolePermissions.map(
                (rp: { permission_key: string }) => rp.permission_key
            );
            const lockedKeys =
                this.getLockedUserAccessManagementPermissionKeys();
            if (dbKeys.length === 0) {
                return this.getAllPermissionKeys();
            }
            return Array.from(new Set([...dbKeys, ...lockedKeys]));
        }

        // Admin role from account_id 10013 always has all permissions
        if (accountId === 10013 && normalizedRole === "archaser_admin") {
            // Return all available permissions
            return this.getAllPermissionKeys();
        }

        try {
            // Prisma enum values in queries should use the enum key (with underscores)
            // Prisma will automatically convert to the mapped database value (with spaces)
            // So we use normalizedRole directly, which should be the enum key like "Account_Manager"
            const rolePermissions = await prisma.rolePermission.findMany({
                where: {
                    account_id: accountId,
                    role: normalizedRole as any, // Type assertion needed because Prisma enum types are strict
                },
                select: {
                    permission_key: true,
                },
            });

            const permissionKeys = rolePermissions.map(
                (rp: { permission_key: string }) => rp.permission_key
            );

            return permissionKeys;
        } catch (error: any) {
            // If role is still invalid, log and return empty permissions
            console.error(
                `Invalid role for permissions query: ${role} (normalized: ${normalizedRole})`,
                error
            );
            return [];
        }
    }

    /**
     * Get all available permission keys
     * @returns Array of all permission keys
     */
    public getAllPermissionKeys(): string[] {
        return [
            // Import Permissions
            "import_customer",
            "import_invoice",
            "import_contact",
            "import_payment",
            "import_policy",
            // Export Permissions
            "export_data",
            // Permission Management
            "manage_users",
            "view_users",
            "view_roles",
            "manage_security_role",
            // Activity Management
            "create_log_activity",
            "send_email",
            "view_follow_up_reminders",
            // Activity Sequences
            "manage_activity_sequence",
            "view_activity_sequences",
            // Sequence Containers
            "manage_sequence_container",
            // Business Units
            "manage_business_units",
            "view_business_units",
            // Settings
            "view_settings",
            // System Logs
            "view_system_logs",
            // View-As
            "use_view_as",
            // Disputes
            "create_dispute",
            "assign_dispute",
            "resolve_dispute",
            // Customers
            "create_customer",
            "edit_customer",
            "delete_customer",
            // Contacts
            "manage_contacts",
            "view_contacts",
            // Templates
            "view_templates",
            "edit_templates",
            // Bank Accounts
            "view_banks",
            "edit_bank_account",
            // Invoices
            "create_invoice",
            "edit_invoice",
            "delete_invoice",
            "view_invoices",
            // Operation Dashboard
            "view_operation_dashboard",
            // Financial Dashboard
            "view_financial_dashboard",
            // Credit Insurance dashboard (Credit Dashboard page)
            "view_credit_dashboard",
            // Credit Insurance — policy configuration (Settings)
            "update_insurance_policy",
            // Billing ERP connector (pilot)
            "view_billing_connector",
            "manage_billing_connector",
            // Reporting
            "view_reports",
            "create_report",
            "edit_report",
            "delete_report",
            "share_report",
            "schedule_report",
            "export_report",
        ];
    }

    /**
     * Get permissions grouped by category with subcategories
     * @returns Object with category names as keys and nested subcategory objects as values
     */
    public getPermissionsByCategory(): Record<
        string,
        Record<string, string[]>
    > {
        return {
            customer_data_management: {
                customers: [
                    "create_customer",
                    "edit_customer",
                    "delete_customer",
                ],
                contacts: ["view_contacts", "manage_contacts"],
            },
            collection_operations: {
                activities: [
                    "create_log_activity",
                    "send_email",
                    "view_follow_up_reminders",
                ],
                disputes: [
                    "create_dispute",
                    "assign_dispute",
                    "resolve_dispute",
                ],
                sequences: [
                    "view_activity_sequences",
                    "manage_activity_sequence",
                    "manage_sequence_container",
                ],
            },
            user_access_management: {
                users: ["view_users", "manage_users"],
                roles: ["view_roles", "manage_security_role"],
                special_access: ["use_view_as"],
            },
            system_configuration: {
                settings: [
                    "view_settings",
                    "view_system_logs",
                    "update_insurance_policy",
                    "view_billing_connector",
                    "manage_billing_connector",
                ],
                business_units: [
                    "view_business_units",
                    "manage_business_units",
                ],
                templates: ["view_templates", "edit_templates"],
                financial: ["view_banks", "edit_bank_account"],
            },
            analytics_reporting: {
                import_export: [
                    "import_customer",
                    "import_invoice",
                    "import_contact",
                    "import_payment",
                    "import_policy",
                    "export_data",
                ],
                reports: [
                    "view_reports",
                    "create_report",
                    "edit_report",
                    "delete_report",
                    "share_report",
                    "schedule_report",
                    "export_report",
                ],
                dashboards: [
                    "view_operation_dashboard",
                    "view_financial_dashboard",
                    "view_credit_dashboard",
                ],
            },
        };
    }

    /**
     * Get permissions grouped by category (flat structure for backward compatibility)
     * @returns Object with category names as keys and permission arrays as values
     * @deprecated Use getPermissionsByCategory() instead for nested structure
     */
    public getPermissionsByCategoryFlat(): Record<string, string[]> {
        const nested = this.getPermissionsByCategory();
        const flat: Record<string, string[]> = {};

        for (const [category, subcategories] of Object.entries(nested)) {
            flat[category] = [];
            for (const permissions of Object.values(subcategories)) {
                flat[category].push(...permissions);
            }
        }

        return flat;
    }

    /**
     * Permission keys under User & Access Management that are locked for System_Administrator (always remain enabled).
     */
    public getLockedUserAccessManagementPermissionKeys(): string[] {
        const categories = this.getPermissionsByCategory();
        const uam = categories.user_access_management;
        if (!uam) return [];
        return Object.values(uam).flat();
    }

    /**
     * Permission keys removed when an account is credit-insurance-only (no collection product).
     */
    private getCreditOnlyRestrictedPermissionKeys(): string[] {
        const categories = this.getPermissionsByCategory();
        const collectionOpFlat = Object.values(
            categories.collection_operations
        ).flat();
        const collectionStyleDashboardKeys =
            categories.analytics_reporting.dashboards.filter(
                (p) => p !== "view_credit_dashboard"
            );
        return [
            ...collectionOpFlat,
            ...collectionStyleDashboardKeys,
            "view_templates",
            "edit_templates",
            "view_banks",
            "edit_bank_account",
            "use_view_as",
        ];
    }

    /**
     * Remove role permissions tied to disabled account products.
     */
    public async removeProductRolePermissions(
        accountId: number,
        options: {
            removeCollection?: boolean;
            removeCreditInsurance?: boolean;
            hasCollection?: boolean;
            hasCreditInsurance?: boolean;
        },
        dbClient: DbClient = prisma
    ): Promise<void> {
        if (accountId === 10013) {
            return;
        }

        const {
            removeCollection = false,
            removeCreditInsurance = false,
            hasCollection = true,
            hasCreditInsurance = false,
        } = options;

        if (removeCreditInsurance) {
            await (dbClient as any).rolePermission.deleteMany({
                where: {
                    account_id: accountId,
                    is_credit_insurance: true,
                    is_collection: false,
                },
            });

            await (dbClient as any).rolePermission.updateMany({
                where: {
                    account_id: accountId,
                    is_credit_insurance: true,
                    is_collection: true,
                },
                data: {
                    is_credit_insurance: false,
                    modified_at: new Date(),
                },
            });
        }

        if (removeCollection) {
            await (dbClient as any).rolePermission.deleteMany({
                where: {
                    account_id: accountId,
                    is_collection: true,
                    is_credit_insurance: false,
                },
            });

            await (dbClient as any).rolePermission.updateMany({
                where: {
                    account_id: accountId,
                    is_collection: true,
                    is_credit_insurance: true,
                },
                data: {
                    is_collection: false,
                    modified_at: new Date(),
                },
            });

            const isCreditOnly = hasCreditInsurance && !hasCollection;
            if (isCreditOnly) {
                const restrictedKeys = this.getCreditOnlyRestrictedPermissionKeys();
                await (dbClient as any).rolePermission.deleteMany({
                    where: {
                        account_id: accountId,
                        permission_key: {
                            in: restrictedKeys,
                        },
                    },
                });
            }
        }
    }

    /**
     * Update permissions for a role in an account
     * @param accountId Account ID
     * @param role User role
     * @param permissions Array of permission keys to set
     * @param userId User ID performing the update
     * @returns Promise<void>
     */
    public async updateRolePermissions(
        accountId: number,
        role: string,
        permissions: string[],
        userId: string,
        dbClient?: DbClient
    ): Promise<void> {
        // Normalize role to handle old role names
        const normalizedRole = this.normalizeRole(role, accountId);

        if (!normalizedRole) {
            throw new Error(`Invalid role: ${role}`);
        }

        // For System_Administrator: allow update but keep User & Access Management permissions locked (always enabled)
        let permissionsToSave = permissions;
        if (normalizedRole === "System_Administrator") {
            const lockedKeys = this.getLockedUserAccessManagementPermissionKeys();
            permissionsToSave = Array.from(
                new Set([...permissions, ...lockedKeys])
            );
        }

        // Cannot edit Admin role for account_id 10013
        if (accountId === 10013 && normalizedRole === "archaser_admin") {
            throw new Error(
                "Cannot modify permissions for archaser_admin role"
            );
        }

        // Get all available permissions
        const allPermissions = this.getAllPermissionKeys();

        const runWithClient = async (client: DbClient) => {
            await client.rolePermission.deleteMany({
                where: {
                    account_id: accountId,
                    role: normalizedRole as any,
                    permission_key: {
                        notIn: permissionsToSave,
                    },
                },
            });

            for (const permission of permissionsToSave) {
                if (!allPermissions.includes(permission)) {
                    continue;
                }

                await client.rolePermission.upsert({
                    where: {
                        account_id_role_permission_key: {
                            account_id: accountId,
                            role: normalizedRole as any,
                            permission_key: permission,
                        },
                    },
                    update: {
                        modified_by: userId,
                        modified_at: new Date(),
                    },
                    create: {
                        account_id: accountId,
                        role: normalizedRole as any,
                        permission_key: permission,
                        created_by: userId,
                        modified_by: userId,
                    },
                });
            }
        };

        if (dbClient) {
            await runWithClient(dbClient);
            return;
        }

        await prisma.$transaction(async (tx) => {
            await runWithClient(tx as DbClient);
        });
    }

    /**
     * Clone role permissions from one account to another
     * @param sourceAccountId Source account ID (master account)
     * @param targetAccountId Target account ID (new account)
     * @param userId User ID performing the clone
     * @returns Promise<void>
     */
    public async cloneRolePermissions(
        sourceAccountId: number,
        targetAccountId: number,
        userId: string,
        options?: {
            hasCollection?: boolean;
            hasCreditInsurance?: boolean;
        },
        dbClient: DbClient = prisma
    ): Promise<void> {
        const hasCollection = options?.hasCollection ?? true;
        const hasCreditInsurance = options?.hasCreditInsurance ?? false;

        // Get all role permissions from source account
        // Exclude archaser_admin role for accounts other than 10013
        const whereClause: any = {
            account_id: sourceAccountId,
        };

        // If target account is not 10013, exclude archaser_admin role
        if (targetAccountId !== 10013) {
            whereClause.role = {
                not: "archaser_admin",
            };
        }

        const sourcePermissions = await (dbClient as any).rolePermission.findMany({
            where: whereClause,
        });

        const restrictedForCreditOnly = new Set<string>(
            this.getCreditOnlyRestrictedPermissionKeys()
        );

        const isCreditOnly = hasCreditInsurance && !hasCollection;
        const filteredPermissions = isCreditOnly
            ? // Credit-only accounts inherit master permissions except collection-only keys.
              // Report/import permissions are collection-tagged on the master account but still required.
              sourcePermissions.filter(
                  (sourcePermission: any) =>
                      !restrictedForCreditOnly.has(
                          sourcePermission.permission_key
                      )
              )
            : sourcePermissions.filter((sourcePermission: any) => {
                  const collectionEnabled =
                      sourcePermission.is_collection !== false;
                  const creditEnabled =
                      sourcePermission.is_credit_insurance === true;

                  return (
                      (hasCollection && collectionEnabled) ||
                      (hasCreditInsurance && creditEnabled)
                  );
              });

        const finalPermissions = filteredPermissions;

        // Upsert permissions for target account (safe inside $transaction; create()+P2002 aborts the tx)
        for (const sourcePermission of finalPermissions) {
            await (dbClient as any).rolePermission.upsert({
                where: {
                    account_id_role_permission_key: {
                        account_id: targetAccountId,
                        role: sourcePermission.role,
                        permission_key: sourcePermission.permission_key,
                    },
                },
                update: {
                    is_collection: sourcePermission.is_collection ?? true,
                    is_credit_insurance:
                        sourcePermission.is_credit_insurance ?? false,
                    modified_by: userId,
                    modified_at: new Date(),
                },
                create: {
                    account_id: targetAccountId,
                    role: sourcePermission.role,
                    permission_key: sourcePermission.permission_key,
                    is_collection: sourcePermission.is_collection ?? true,
                    is_credit_insurance:
                        sourcePermission.is_credit_insurance ?? false,
                    created_by: userId,
                    modified_by: userId,
                },
            });
        }

        if (isCreditOnly) {
            await (dbClient as any).rolePermission.deleteMany({
                where: {
                    account_id: targetAccountId,
                    permission_key: {
                        in: Array.from(restrictedForCreditOnly),
                    },
                },
            });

            await this.ensureCreditInsuranceDashboardPermissions(
                targetAccountId,
                userId,
                dbClient
            );
        }
    }

    /**
     * Credit-only accounts need dashboard/policy permissions even when the master
     * account tags them as collection-only (e.g. view_credit_dashboard).
     */
    public async ensureCreditInsuranceDashboardPermissions(
        accountId: number,
        userId: string,
        dbClient: DbClient = prisma
    ): Promise<void> {
        const creditDashboardPerms = [
            "view_credit_dashboard",
            "update_insurance_policy",
        ];

        const roles = await (dbClient as any).rolePermission.findMany({
            where: { account_id: accountId },
            select: { role: true },
            distinct: ["role"],
        });

        for (const { role } of roles) {
            const existing = await this.getRolePermissions(accountId, role);
            const merged = Array.from(
                new Set([...existing, ...creditDashboardPerms])
            );
            if (merged.length === existing.length) {
                continue;
            }
            await this.updateRolePermissions(
                accountId,
                role,
                merged,
                userId,
                dbClient
            );
        }
    }
}
