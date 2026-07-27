import { LogLevel } from "@/types/MongoLog";
import { mongoLogService } from "./MongoLogService";
import {
    getUserInfoFromRequest,
    calculateFieldDiff,
    sanitizeDataForLogging,
    formatAuditLogMessage,
    extractUserName,
} from "@/server/utils/auditLogHelpers";

/**
 * Settings Audit Log Service
 *
 * This service provides specialized audit logging for settings page operations.
 * It wraps MongoLogService with settings-specific formatting and structure.
 */
export class SettingsAuditLogService {
    private static instance: SettingsAuditLogService;

    private constructor() {}

    public static getInstance(): SettingsAuditLogService {
        if (!SettingsAuditLogService.instance) {
            SettingsAuditLogService.instance = new SettingsAuditLogService();
        }
        return SettingsAuditLogService.instance;
    }

    /**
     * Log a create operation
     * @param entityType Type of entity (e.g., "users", "bank-accounts")
     * @param entityId ID of the created entity
     * @param userId User ID who performed the operation
     * @param accountId Account ID
     * @param data Created entity data
     * @param metadata Optional additional metadata
     */
    async logCreate(
        entityType: string,
        entityId: string | number,
        userId: string,
        accountId: number,
        data: Record<string, any>,
        metadata?: Record<string, any>
    ): Promise<void> {
        try {
            const sanitizedData = sanitizeDataForLogging(data);
            // Extract userName from metadata if available
            const userName = metadata?.userName;

            // Extract entity name for "users" entity type
            const entityName =
                entityType === "users" ? extractUserName(data) : undefined;

            const message = formatAuditLogMessage(
                "CREATE",
                entityType,
                entityId,
                userName,
                undefined,
                entityName
            );

            await mongoLogService.logMessage({
                timestamp: new Date(),
                level: LogLevel.INFO,
                message,
                source: `settings.${entityType}`,
                details: {
                    operation: "CREATE",
                    entityType,
                    entityId: String(entityId),
                    userId,
                    accountId,
                    newData: sanitizedData,
                    metadata,
                },
                account_id: accountId,
                user_id: parseInt(userId, 10) || undefined,
                sub_source: entityType,
            });
        } catch (error) {
            // Log error but don't throw - audit logging failures shouldn't break the operation
            console.error(
                `[SettingsAuditLogService] Failed to log CREATE operation:`,
                error instanceof Error ? error.message : error
            );
        }
    }

    /**
     * Log an update operation with field-level diff
     * @param entityType Type of entity
     * @param entityId ID of the updated entity
     * @param userId User ID who performed the operation
     * @param accountId Account ID
     * @param oldData Original entity data
     * @param newData Updated entity data
     * @param changedFields Optional pre-calculated changed fields (will be calculated if not provided)
     * @param metadata Optional additional metadata
     */
    async logUpdate(
        entityType: string,
        entityId: string | number,
        userId: string,
        accountId: number,
        oldData: Record<string, any>,
        newData: Record<string, any>,
        changedFields?: Record<string, { old: any; new: any }>,
        metadata?: Record<string, any>
    ): Promise<void> {
        try {
            const sanitizedOldData = sanitizeDataForLogging(oldData);
            const sanitizedNewData = sanitizeDataForLogging(newData);

            // Calculate diff if not provided
            const diff =
                changedFields ||
                calculateFieldDiff(sanitizedOldData, sanitizedNewData);

            // Extract userName from metadata if available
            const userName = metadata?.userName;

            // Extract entity name for "users" entity type (prefer newData, fallback to oldData)
            const entityName =
                entityType === "users"
                    ? extractUserName(newData) || extractUserName(oldData)
                    : undefined;

            const message = formatAuditLogMessage(
                "UPDATE",
                entityType,
                entityId,
                userName,
                diff,
                entityName
            );

            await mongoLogService.logMessage({
                timestamp: new Date(),
                level: LogLevel.INFO,
                message,
                source: `settings.${entityType}`,
                details: {
                    operation: "UPDATE",
                    entityType,
                    entityId: String(entityId),
                    userId,
                    accountId,
                    oldData: sanitizedOldData,
                    newData: sanitizedNewData,
                    changedFields: diff,
                    metadata,
                },
                account_id: accountId,
                user_id: parseInt(userId, 10) || undefined,
                sub_source: entityType,
            });
        } catch (error) {
            // Log error but don't throw - audit logging failures shouldn't break the operation
            console.error(
                `[SettingsAuditLogService] Failed to log UPDATE operation:`,
                error instanceof Error ? error.message : error
            );
        }
    }

    /**
     * Log a delete operation
     * @param entityType Type of entity
     * @param entityId ID of the deleted entity
     * @param userId User ID who performed the operation
     * @param accountId Account ID
     * @param deletedData Deleted entity data (captured before deletion)
     * @param metadata Optional additional metadata
     */
    async logDelete(
        entityType: string,
        entityId: string | number,
        userId: string,
        accountId: number,
        deletedData: Record<string, any>,
        metadata?: Record<string, any>
    ): Promise<void> {
        try {
            const sanitizedData = sanitizeDataForLogging(deletedData);
            // Extract userName from metadata if available
            const userName = metadata?.userName;

            // Extract entity name for "users" entity type
            const entityName =
                entityType === "users"
                    ? extractUserName(deletedData)
                    : undefined;

            const message = formatAuditLogMessage(
                "DELETE",
                entityType,
                entityId,
                userName,
                undefined,
                entityName
            );

            await mongoLogService.logMessage({
                timestamp: new Date(),
                level: LogLevel.INFO,
                message,
                source: `settings.${entityType}`,
                details: {
                    operation: "DELETE",
                    entityType,
                    entityId: String(entityId),
                    userId,
                    accountId,
                    oldData: sanitizedData,
                    metadata,
                },
                account_id: accountId,
                user_id: parseInt(userId, 10) || undefined,
                sub_source: entityType,
            });
        } catch (error) {
            // Log error but don't throw - audit logging failures shouldn't break the operation
            console.error(
                `[SettingsAuditLogService] Failed to log DELETE operation:`,
                error instanceof Error ? error.message : error
            );
        }
    }

    /**
     * Log a failed operation
     * @param entityType Type of entity
     * @param operation Operation type that failed
     * @param userId User ID who attempted the operation
     * @param accountId Account ID
     * @param error Error that occurred
     * @param attemptedData Optional data that was attempted to be saved
     */
    async logFailedOperation(
        entityType: string,
        operation: "CREATE" | "UPDATE" | "DELETE",
        userId: string,
        accountId: number,
        error: Error | string,
        attemptedData?: Record<string, any>
    ): Promise<void> {
        try {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            const sanitizedData = attemptedData
                ? sanitizeDataForLogging(attemptedData)
                : undefined;

            // Convert operation to lowercase for the message
            const operationLower = operation.toLowerCase();
            const message = `User ${userId} failed to ${operationLower} ${entityType}: ${errorMessage}`;

            await mongoLogService.logMessage({
                timestamp: new Date(),
                level: LogLevel.WARNING,
                message,
                source: `settings.${entityType}`,
                details: {
                    operation: `FAILED_${operation}`,
                    entityType,
                    userId,
                    accountId,
                    error: errorMessage,
                    attemptedData: sanitizedData,
                },
                account_id: accountId,
                user_id: parseInt(userId, 10) || undefined,
                sub_source: entityType,
            });
        } catch (logError) {
            // Log error but don't throw - audit logging failures shouldn't break the operation
            console.error(
                `[SettingsAuditLogService] Failed to log FAILED operation:`,
                logError instanceof Error ? logError.message : logError
            );
        }
    }
}

// Export singleton instance
export const settingsAuditLogService = SettingsAuditLogService.getInstance();
