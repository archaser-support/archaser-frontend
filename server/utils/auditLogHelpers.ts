import { NextApiRequest } from "next";

import { AccessControlService } from "@/server/services/AccessControlService";

/**
 * User information extracted from request
 */
export interface UserInfoFromRequest {
    userId: string;
    accountId: number;
    userName?: string;
    accountName?: string;
}

/**
 * Extract user information from request
 * @param request NextApiRequest object
 * @returns UserInfoFromRequest object containing user details
 */
export async function getUserInfoFromRequest(
    request: NextApiRequest
): Promise<UserInfoFromRequest> {
    try {
        const accessControl = AccessControlService.getInstance();
        const userInfo = await accessControl.getUserInfo(request);

        const userId = accessControl.getEffectiveUserId(userInfo);
        const accountId = userInfo.viewAsUserAccountId || userInfo.accountId;

        if (!userId || !accountId) {
            throw new Error("Missing user ID or account ID");
        }

        // Optionally fetch user name and account name for better log messages
        // This is optional to avoid performance impact
        let userName: string | undefined;
        let accountName: string | undefined;

        try {
            const { prisma } = await import("@/lib/prisma");
            const [user, account] = await Promise.all([
                prisma.user.findUnique({
                    where: { id: userId },
                    select: { name: true },
                }),
                prisma.account.findUnique({
                    where: { id: accountId },
                    select: { name: true },
                }),
            ]);
            userName = user?.name || undefined;
            accountName = account?.name || undefined;
        } catch {
            // Silently fail - these are optional fields
        }

        return {
            userId,
            accountId,
            userName,
            accountName,
        };
    } catch (error) {
        throw new Error(
            `Failed to extract user info from request: ${
                error instanceof Error ? error.message : "Unknown error"
            }`
        );
    }
}

/**
 * Calculate field differences between old and new data
 * @param oldData Original data object
 * @param newData Updated data object
 * @returns Object with changed fields showing old and new values
 */
export function calculateFieldDiff(
    oldData: Record<string, any>,
    newData: Record<string, any>
): Record<string, { old: any; new: any }> {
    const changedFields: Record<string, { old: any; new: any }> = {};

    // Check all keys from both objects
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

    for (const key of Array.from(allKeys)) {
        const oldValue = oldData[key];
        const newValue = newData[key];

        // Deep comparison for objects and arrays
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            changedFields[key] = {
                old: oldValue,
                new: newValue,
            };
        }
    }

    return changedFields;
}

/**
 * Extract user name from user data object
 * @param userData User data object (can be from oldData or newData)
 * @returns User name string or undefined if not available
 */
export function extractUserName(
    userData: Record<string, any>
): string | undefined {
    if (!userData) return undefined;

    // Try name field first
    if (
        userData.name &&
        typeof userData.name === "string" &&
        userData.name.trim()
    ) {
        return userData.name.trim();
    }

    // Try first_name + last_name
    const firstName = userData.first_name?.trim() || "";
    const lastName = userData.last_name?.trim() || "";
    if (firstName || lastName) {
        return `${firstName} ${lastName}`.trim();
    }

    // Fall back to email
    if (
        userData.email &&
        typeof userData.email === "string" &&
        userData.email.trim()
    ) {
        return userData.email.trim();
    }

    return undefined;
}

/**
 * Sanitize data by removing sensitive fields before logging
 * @param data Data object to sanitize
 * @returns Sanitized data object
 */
export function sanitizeDataForLogging(
    data: Record<string, any>
): Record<string, any> {
    const sensitiveFields = [
        "password",
        "token",
        "secret",
        "api_key",
        "apiKey",
        "access_token",
        "refresh_token",
        "authorization",
        "auth",
        "credentials",
        "credentials_encrypted",
        "client_secret",
    ];

    const sanitized = { ...data };

    for (const field of sensitiveFields) {
        // Check for exact matches and case variations
        const keys = Object.keys(sanitized);
        for (const key of keys) {
            if (
                key.toLowerCase().includes(field.toLowerCase()) ||
                key === field
            ) {
                sanitized[key] = "[REDACTED]";
            }
        }
    }

    return sanitized;
}

/**
 * Format audit log message for human readability
 * @param operation Operation type (CREATE, UPDATE, DELETE)
 * @param entityType Type of entity being operated on
 * @param entityId ID of the entity
 * @param userName Optional user name (the person performing the action)
 * @param changedFields Optional changed fields for UPDATE operations
 * @param entityName Optional entity name (the entity being operated on, e.g., user name when entityType is "users")
 * @returns Formatted log message
 */
export function formatAuditLogMessage(
    operation: "CREATE" | "UPDATE" | "DELETE",
    entityType: string,
    entityId: string | number,
    userName?: string,
    changedFields?: Record<string, { old: any; new: any }>,
    entityName?: string
): string {
    const userPart = userName || "User";

    // Use entity name if provided, otherwise fall back to showing the ID
    // For "users" entity type, we want to show the user's name instead of the ID
    const entityPart = entityName
        ? `${entityType} ${entityName}`
        : `${entityType} \`${entityId}\``;

    // Convert operation to lowercase for the message
    const operationLower = operation.toLowerCase();
    const pastTense =
        operationLower === "create"
            ? "created"
            : operationLower === "update"
              ? "updated"
              : "deleted";

    if (operation === "UPDATE" && changedFields) {
        const fieldCount = Object.keys(changedFields).length;
        const fieldNames = Object.keys(changedFields).join(", ");
        return `${userPart} ${pastTense} ${entityPart} (${fieldCount} field${fieldCount !== 1 ? "s" : ""} changed: ${fieldNames})`;
    }

    return `${userPart} ${pastTense} ${entityPart}`;
}
