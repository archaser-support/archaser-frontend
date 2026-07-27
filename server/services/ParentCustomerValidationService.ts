import { prisma } from "@/lib/prisma";
import { LogLevel } from "@/types/enums";

import { BusinessUnitService } from "./BusinessUnitService";
import { LogService } from "./LogService";

export interface ValidationResult {
    isValid: boolean;
    error?: string;
    errorCode?: string;
}

export interface UserAccessInfo {
    userId: string;
    accountId: number;
    role: string;
    businessUnitId?: number | null;
    isAccountManager?: boolean;
}

export class ParentCustomerValidationService {
    private static instance: ParentCustomerValidationService;
    private logService = LogService.getInstance();

    private constructor() {}

    public static getInstance(): ParentCustomerValidationService {
        if (!ParentCustomerValidationService.instance) {
            ParentCustomerValidationService.instance =
                new ParentCustomerValidationService();
        }
        return ParentCustomerValidationService.instance;
    }

    /**
     * Validate parent customer assignment
     * @param customerId The customer ID being updated
     * @param parentCustomerId The parent customer ID (can be null to remove parent)
     * @param userAccessInfo Optional user access information for permission checks
     * @returns Validation result with error message if invalid
     */
    public async validateParentCustomer(
        customerId: number,
        parentCustomerId: number | null,
        userAccessInfo?: UserAccessInfo
    ): Promise<ValidationResult> {
        // If removing parent (setting to null), no validation needed
        if (parentCustomerId === null) {
            return { isValid: true };
        }

        // Check for self-reference
        if (customerId === parentCustomerId) {
            return {
                isValid: false,
                error: "Customer cannot be its own parent",
                errorCode: "SELF_REFERENCE",
            };
        }

        // Check if parent customer exists
        const parentCustomer = await prisma.customer.findUnique({
            where: { id: parentCustomerId },
            select: { id: true, account_id: true },
        });

        if (!parentCustomer) {
            return {
                isValid: false,
                error: "Parent customer not found",
                errorCode: "PARENT_NOT_FOUND",
            };
        }

        // Get current customer to check account_id
        const currentCustomer = await prisma.customer.findUnique({
            where: { id: customerId },
            select: { id: true, account_id: true },
        });

        if (!currentCustomer) {
            return {
                isValid: false,
                error: "Customer not found",
                errorCode: "CUSTOMER_NOT_FOUND",
            };
        }

        // Check if parent belongs to same account
        if (parentCustomer.account_id !== currentCustomer.account_id) {
            return {
                isValid: false,
                error: "Parent customer must belong to the same account",
                errorCode: "DIFFERENT_ACCOUNT",
            };
        }

        // Check business unit permissions if user access info is provided
        if (userAccessInfo) {
            // Only check account_id 10013 - Admin role is handled by PermissionService
            const isAdmin = userAccessInfo.accountId === 10013;

            // Admin users can assign any parent customer (within same account)
            if (!isAdmin) {
                // Get parent customer's business unit
                const parentCustomerWithBU = await prisma.customer.findUnique({
                    where: { id: parentCustomerId },
                    select: { business_unit_id: true } as any,
                });

                if (parentCustomerWithBU) {
                    const parentBuId = (parentCustomerWithBU as any)
                        .business_unit_id;
                    const userBuId = userAccessInfo.businessUnitId || null;

                    // Check if user can access the parent customer based on BU permissions
                    const canAccess =
                        await BusinessUnitService.canUserAccessCustomer(
                            userBuId,
                            parentBuId
                        );

                    if (!canAccess) {
                        await this.logService.logMessage(
                            LogLevel.WARNING,
                            `User ${userAccessInfo.userId} attempted to assign parent customer ${parentCustomerId} without BU access`,
                            "ParentCustomerValidationService",
                            {
                                userId: userAccessInfo.userId,
                                customerId,
                                parentCustomerId,
                                userBuId,
                                parentBuId,
                            }
                        );
                        return {
                            isValid: false,
                            error: "You do not have permission to assign this parent customer",
                            errorCode: "ACCESS_DENIED_BUSINESS_UNIT",
                        };
                    }
                }
            }
        }

        // Check for circular relationships
        const hasCircularRelationship = await this.checkCircularRelationship(
            customerId,
            parentCustomerId
        );

        if (hasCircularRelationship) {
            return {
                isValid: false,
                error: "Cannot create circular relationship",
                errorCode: "CIRCULAR_RELATIONSHIP",
            };
        }

        return { isValid: true };
    }

    /**
     * Check if assigning a parent would create a circular relationship
     * @param customerId The customer ID being updated
     * @param potentialParentId The potential parent customer ID
     * @returns true if circular relationship would be created
     */
    public async checkCircularRelationship(
        customerId: number,
        potentialParentId: number
    ): Promise<boolean> {
        // If customer is trying to be its own parent, it's circular
        if (customerId === potentialParentId) {
            return true;
        }

        // Traverse up the parent chain from the potential parent
        // If we encounter the customerId, it means a cycle would be created
        const visited = new Set<number>();
        let currentParentId: number | null = potentialParentId;

        while (currentParentId !== null) {
            // If we've seen this parent before, there's a cycle
            if (visited.has(currentParentId)) {
                return true;
            }

            // If the potential parent is the customer itself, it's circular
            if (currentParentId === customerId) {
                return true;
            }

            visited.add(currentParentId);

            // Get the parent of the current parent
            const parentResult = await (prisma.customer.findUnique({
                where: { id: currentParentId },
                select: { parent_customer_id: true },
            } as any) as Promise<{ parent_customer_id: number | null } | null>);

            if (!parentResult || !parentResult.parent_customer_id) {
                break;
            }

            currentParentId = parentResult.parent_customer_id;
        }

        return false;
    }
}
