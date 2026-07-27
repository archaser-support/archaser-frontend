import { BusinessUnit, Prisma } from "@prisma/client";

import { DbClient, prisma } from "@/lib/prisma";

export class BusinessUnitService {
    /**
     * Get business unit by ID
     */
    static async getBusinessUnitById(
        id: number,
        includeRelations: boolean = true
    ): Promise<BusinessUnit | null> {
        return await prisma.businessUnit.findUnique({
            where: { id },
            include: includeRelations
                ? {
                    Parent: true,
                    Children: true,
                }
                : undefined,
        });
    }

    /**
     * Get all business units for an account
     */
    static async getBusinessUnitsByAccount(
        accountId: number,
        includeInactive: boolean = false
    ): Promise<BusinessUnit[]> {
        const where: Prisma.BusinessUnitWhereInput = {
            account_id: accountId,
        };

        if (!includeInactive) {
            where.status = "Active";
        }

        return await prisma.businessUnit.findMany({
            where,
            include: {
                Parent: true,
            },
            orderBy: {
                name: "asc",
            },
        });
    }

    /**
     * Get only active business units for an account (used for form dropdowns)
     */
    static async getActiveBusinessUnitsByAccount(
        accountId: number
    ): Promise<BusinessUnit[]> {
        return this.getBusinessUnitsByAccount(accountId, false);
    }

    /**
     * Sort business units hierarchically (depth-first: parent then its children).
     * Roots (parent_id null or parent not in list) are sorted by name.
     * Children under each parent are sorted by name.
     */
    static sortBusinessUnitsHierarchically<T extends { id: number; parent_id: number | null; name: string }>(
        businessUnits: T[]
    ): T[] {
        const idSet = new Set(businessUnits.map((bu) => bu.id));
        const result: T[] = [];

        const addWithChildren = (bu: T) => {
            result.push(bu);
            const children = businessUnits.filter((b) => b.parent_id === bu.id);
            children.sort((a, b) =>
                a.name.localeCompare(b.name, undefined, {
                    sensitivity: "base",
                    numeric: true,
                })
            );
            children.forEach((c) => addWithChildren(c));
        };

        const roots = businessUnits.filter((b) => {
            if (!b.parent_id) return true;
            return !idSet.has(b.parent_id);
        });
        roots.sort((a, b) =>
            a.name.localeCompare(b.name, undefined, {
                sensitivity: "base",
                numeric: true,
            })
        );
        roots.forEach((r) => addWithChildren(r));

        return result;
    }

    /**
     * Get all descendants of a business unit recursively
     */
    static async getBusinessUnitHierarchy(buId: number): Promise<number[]> {
        try {
            const descendantIds: number[] = [];
            const visited = new Set<number>();

            const getDescendants = async (id: number) => {
                if (visited.has(id)) {
                    return; // Prevent circular references
                }
                visited.add(id);

                const children = await prisma.businessUnit.findMany({
                    where: { parent_id: id },
                    select: { id: true },
                });

                for (const child of children) {
                    descendantIds.push(child.id);
                    await getDescendants(child.id);
                }
            };

            await getDescendants(buId);
            return descendantIds;
        } catch (error) {
            console.error("Error in getBusinessUnitHierarchy", {
                buId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /**
     * Get ancestor business unit IDs (walk parent_id up to root).
     */
    static async getAncestorBusinessUnitIds(buId: number): Promise<number[]> {
        const ids: number[] = [];
        let currentId: number | null = buId;
        const visited = new Set<number>();

        while (currentId && !visited.has(currentId)) {
            visited.add(currentId);
            const bu: { parent_id: number | null } | null =
                await prisma.businessUnit.findUnique({
                    where: { id: currentId },
                    select: { parent_id: true },
                });
            if (!bu || bu.parent_id == null) break;
            ids.push(bu.parent_id);
            currentId = bu.parent_id;
        }
        return ids;
    }

    /**
     * Get business unit IDs for users who can access this customer
     * (customer's BU + all its ancestors). Returns null if customer has no BU (no extra filter).
     */
    static async getBusinessUnitIdsThatCanAccessCustomer(
        customerBuId: number | null | undefined
    ): Promise<number[] | null> {
        if (customerBuId == null) return null;
        const ancestorIds = await this.getAncestorBusinessUnitIds(customerBuId);
        return [customerBuId, ...ancestorIds];
    }

    /**
     * Check if a user can access a customer based on BU hierarchy
     */
    static async canUserAccessCustomer(
        userBuId: number | null,
        customerBuId: number | null
    ): Promise<boolean> {
        try {
            // If customer has no BU, users with no BU can access them
            // Users with BU can also access customers with no BU
            if (!customerBuId) {
                return true;
            }

            // If user has no BU, they can only access customers with no BU
            // (which we already handled above, so this shouldn't be reached)
            if (!userBuId) {
                return false;
            }

            // If user's BU matches customer's BU, allow access
            if (userBuId === customerBuId) {
                return true;
            }

            // Check if customer's BU is a descendant of user's BU
            const descendants = await this.getBusinessUnitHierarchy(userBuId);
            return descendants.includes(customerBuId);
        } catch (error) {
            console.error(
                "[BusinessUnitService] Error checking customer access:",
                error
            );
            throw error;
        }
    }

    /**
     * Get all accessible business unit IDs for a user (their BU + all descendants)
     */
    static async getAccessibleBusinessUnitIds(
        userBuId: number | null,
        isAdmin: boolean
    ): Promise<number[] | null> {
        // Admin users can access all business units
        if (isAdmin) {
            return null; // null means "all BUs"
        }

        // If user has no BU, they can't access any BU-specific resources
        if (!userBuId) {
            return [];
        }

        // Get user's BU and all descendants
        const descendants = await this.getBusinessUnitHierarchy(userBuId);
        return [userBuId, ...descendants];
    }

    /**
     * Check if a user can access a specific business unit by external ID
     */
    static async canUserAccessBusinessUnitByExternalId(
        externalId: string,
        userBuId: number | null,
        accountId: number,
        isAdmin: boolean
    ): Promise<boolean> {
        try {
            // Trim and validate external ID
            const trimmedExternalId = externalId?.trim();
            if (!trimmedExternalId || trimmedExternalId === "") {
                // Empty external ID means no business unit assignment, which is allowed
                return true;
            }

            // Admin users can access all business units
            if (isAdmin) {
                return true;
            }

            // Find the business unit by external ID
            const targetBu = await prisma.businessUnit.findFirst({
                where: {
                    external_id: trimmedExternalId,
                    account_id: accountId,
                },
                select: { id: true },
            });

            // If BU doesn't exist, we'll handle that separately in validation
            // But for security, we should still block access if user doesn't have admin privileges
            if (!targetBu) {
                // Don't block on non-existent BU, let normal validation handle it
                return true;
            }

            // Check if user can access this BU
            const accessibleBuIds = await this.getAccessibleBusinessUnitIds(
                userBuId,
                isAdmin
            );

            // null means admin (can access all)
            if (accessibleBuIds === null) {
                return true;
            }

            // Check if the target BU is in the accessible list
            const hasAccess = accessibleBuIds.includes(targetBu.id);

            return hasAccess;
        } catch (error) {
            console.error(
                "[BusinessUnitService] Error checking business unit access:",
                error
            );
            throw error;
        }
    }

    /**
     * Validate if a business unit can be deleted
     */
    static async validateBusinessUnitDeletion(
        buId: number,
        reassignToBusinessUnitId?: number | null
    ): Promise<{ canDelete: boolean; reason?: string }> {
        const bu = await prisma.businessUnit.findUnique({
            where: { id: buId },
            include: {
                Children: true,
                User: true,
                Customer: true,
            },
        });

        if (!bu) {
            return { canDelete: false, reason: "Business unit not found" };
        }

        // Prevent deletion if primary
        if (bu.is_primary) {
            return {
                canDelete: false,
                reason: "Cannot delete primary business unit",
            };
        }

        // Prevent deletion if has children
        if (bu.Children.length > 0) {
            return {
                canDelete: false,
                reason: "Cannot delete business unit with children",
            };
        }

        // If reassignToBusinessUnitId is provided, validate it exists and belongs to same account
        if (reassignToBusinessUnitId) {
            const targetBU = await prisma.businessUnit.findUnique({
                where: { id: reassignToBusinessUnitId },
                select: { id: true, account_id: true, status: true },
            });

            if (!targetBU) {
                return {
                    canDelete: false,
                    reason: "Target business unit for reassignment not found",
                };
            }

            if (targetBU.account_id !== bu.account_id) {
                return {
                    canDelete: false,
                    reason: "Target business unit must belong to the same account",
                };
            }

            if (targetBU.status !== "Active") {
                return {
                    canDelete: false,
                    reason: "Target business unit must be active",
                };
            }

            if (targetBU.id === buId) {
                return {
                    canDelete: false,
                    reason: "Cannot reassign users to the same business unit being deleted",
                };
            }
        } else {
            // Prevent deletion if assigned to users (only if no reassignment target provided)
            if (bu.User.length > 0) {
                return {
                    canDelete: false,
                    reason: "Cannot delete business unit assigned to users",
                };
            }
        }

        // Prevent deletion if assigned to customers
        if (bu.Customer.length > 0) {
            return {
                canDelete: false,
                reason: "Cannot delete business unit assigned to customers",
            };
        }

        return { canDelete: true };
    }

    /**
     * Create primary business unit for a new account
     */
    static async createPrimaryBusinessUnit(
        accountId: number,
        userId?: string,
        name?: string,
        dbClient: DbClient = prisma
    ): Promise<BusinessUnit> {
        // Check if primary BU already exists for this account
        const existingPrimary = await dbClient.businessUnit.findFirst({
            where: {
                account_id: accountId,
                is_primary: true,
            },
        });

        if (existingPrimary) {
            throw new Error(
                "Primary business unit already exists for this account"
            );
        }

        // Get account name for default BU name
        const account = await dbClient.account.findUnique({
            where: { id: accountId },
            select: { name: true },
        });

        const buName =
            name || (account?.name ? `${account.name} Primary` : "Primary");

        return await dbClient.businessUnit.create({
            data: {
                account_id: accountId,
                name: buName,
                status: "Active",
                is_primary: true,
                created_by: userId,
                modified_by: userId,
            },
        });
    }

    /**
     * Validate if a business unit's status can be changed
     */
    static async validateBusinessUnitStatusChange(
        buId: number,
        newStatus: "Active" | "Inactive"
    ): Promise<{ canChange: boolean; reason?: string }> {
        const bu = await prisma.businessUnit.findUnique({
            where: { id: buId },
        });

        if (!bu) {
            return { canChange: false, reason: "Business unit not found" };
        }

        // Prevent deactivation if primary
        if (bu.is_primary && newStatus === "Inactive") {
            return {
                canChange: false,
                reason: "Cannot deactivate primary business unit",
            };
        }

        return { canChange: true };
    }

    /**
     * Check for circular parent references
     */
    static async checkCircularReference(
        buId: number,
        parentId: number | null
    ): Promise<boolean> {
        if (!parentId) {
            return false; // No parent, no circular reference
        }

        // If setting parent to self, it's circular
        if (buId === parentId) {
            return true;
        }

        // Check if the proposed parent is a descendant of this BU
        const descendants = await this.getBusinessUnitHierarchy(buId);
        return descendants.includes(parentId);
    }

    /**
     * Create a business unit
     */
    static async createBusinessUnit(
        data: {
            name: string;
            account_id: number;
            parent_id?: number | null;
            external_id?: string | null;
            status?: "Active" | "Inactive";
        },
        userId?: string
    ): Promise<BusinessUnit> {
        // Validate parent belongs to same account
        if (data.parent_id) {
            const parent = await prisma.businessUnit.findUnique({
                where: { id: data.parent_id },
                select: { account_id: true },
            });

            if (!parent || parent.account_id !== data.account_id) {
                throw new Error(
                    "Parent business unit must belong to the same account"
                );
            }

            // Check for circular reference - since this is a new BU, we can't check against its own ID
            // But we can check if parent would create a cycle by checking if parent is a descendant of any existing BU
            // For now, we'll do a simpler check: ensure parent exists and belongs to account
        }

        return await prisma.businessUnit.create({
            data: {
                name: data.name,
                account_id: data.account_id,
                parent_id: data.parent_id || null,
                external_id: data.external_id || null,
                status: data.status || "Active",
                created_by: userId,
                modified_by: userId,
            },
        });
    }

    /**
     * Update a business unit
     */
    static async updateBusinessUnit(
        id: number,
        data: Prisma.BusinessUnitUpdateInput,
        userId?: string
    ): Promise<BusinessUnit> {
        const existing = await prisma.businessUnit.findUnique({
            where: { id },
            select: { account_id: true, is_primary: true },
        });

        if (!existing) {
            throw new Error("Business unit not found");
        }

        // Prevent updating is_primary
        if (data.is_primary !== undefined) {
            throw new Error("Cannot update is_primary field");
        }

        // Prevent updating account_id (check relation instead)
        if (data.Account !== undefined) {
            throw new Error("Cannot update account_id");
        }

        // Validate parent if being updated
        if (data.Parent?.connect?.id) {
            const parent = await prisma.businessUnit.findUnique({
                where: { id: data.Parent.connect.id },
                select: { account_id: true },
            });

            if (!parent || parent.account_id !== existing.account_id) {
                throw new Error(
                    "Parent business unit must belong to the same account"
                );
            }

            // Check for circular reference
            const isCircular = await this.checkCircularReference(
                id,
                data.Parent.connect.id
            );
            if (isCircular) {
                throw new Error("Circular parent reference detected");
            }
        }

        // Build update data, separating scalar fields from relation fields
        // Only include scalar fields that Prisma accepts
        const modified_ata: any = {
            modified_at: new Date(),
        };

        // Add scalar fields from data
        if (data.name !== undefined) modified_ata.name = data.name;
        if (data.external_id !== undefined)
            modified_ata.external_id = data.external_id;
        if (data.status !== undefined) modified_ata.status = data.status;

        // Add relation fields if they exist
        if (data.Parent !== undefined) {
            modified_ata.Parent = data.Parent;
        }

        // Set modified_by using the relation field approach
        if (userId !== undefined) {
            modified_ata.User_BusinessUnit_modified_byToUser = userId
                ? { connect: { id: userId } }
                : { disconnect: true };
        }

        return await prisma.businessUnit.update({
            where: { id },
            data: modified_ata,
        });
    }

    /**
     * Delete a business unit
     * @param id Business unit ID to delete
     * @param reassignToBusinessUnitId Optional business unit ID to reassign users to
     */
    static async deleteBusinessUnit(
        id: number,
        reassignToBusinessUnitId?: number | null
    ): Promise<void> {
        const validation = await this.validateBusinessUnitDeletion(
            id,
            reassignToBusinessUnitId
        );
        if (!validation.canDelete) {
            throw new Error(validation.reason);
        }

        // If reassignToBusinessUnitId is provided, reassign all users first
        if (reassignToBusinessUnitId) {
            await prisma.user.updateMany({
                where: {
                    business_unit_id: id,
                },
                data: {
                    business_unit_id: reassignToBusinessUnitId,
                },
            });
        }

        await prisma.businessUnit.delete({
            where: { id },
        });
    }

    /**
     * Update business unit status
     */
    static async updateBusinessUnitStatus(
        id: number,
        status: "Active" | "Inactive",
        userId?: string
    ): Promise<BusinessUnit> {
        const validation = await this.validateBusinessUnitStatusChange(
            id,
            status
        );
        if (!validation.canChange) {
            throw new Error(validation.reason);
        }

        return await prisma.businessUnit.update({
            where: { id },
            data: {
                status,
                modified_at: new Date(),
                User_BusinessUnit_modified_byToUser: userId
                    ? { connect: { id: userId } }
                    : { disconnect: true },
            },
        });
    }
}
