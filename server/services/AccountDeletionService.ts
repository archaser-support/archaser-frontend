/**
 * Account Deletion Service
 * GDPR-compliant account soft deletion with anonymization
 */

import { prisma } from "@/lib/prisma";
import { LogService } from "./LogService";
import { FileDeletionService } from "./FileDeletionService";
import { LogLevel } from "@/types/enums";
import { ReportService } from "./ReportService";
import {
    anonymizeAccountFields,
    anonymizeUserFields,
    anonymizeContactFields,
    anonymizeActivityContent,
    containsPII,
} from "@/utils/dataAnonymization";

const GRACE_PERIOD_DAYS = 30;
const ARCHASER_ADMIN_ACCOUNT_ID = 10013;

export interface AccountDeletionResult {
    success: boolean;
    accountId: number;
    deletedAt: Date;
    gracePeriodEnds: Date;
    message: string;
    errors?: string[];
}

export interface AccountRestorationResult {
    success: boolean;
    accountId: number;
    restoredAt: Date;
    message: string;
    errors?: string[];
}

export interface AnonymizationResult {
    success: boolean;
    accountId: number;
    anonymizedAt: Date;
    usersAnonymized: number;
    contactsAnonymized: number;
    activitiesAnonymized: number;
    filesDeleted: number;
    errors: string[];
}

export class AccountDeletionService {
    private logService: LogService;
    private fileDeletionService: FileDeletionService;
    private reportService: ReportService;

    constructor() {
        this.logService = LogService.getInstance();
        this.fileDeletionService = new FileDeletionService();
        this.reportService = ReportService.getInstance();
    }

    /**
     * Soft delete an account (marks as deleted, keeps data for grace period)
     * @param accountId - Account ID to delete
     * @param deletedBy - User ID of admin performing deletion
     * @returns Deletion result
     */
    async softDeleteAccount(
        accountId: number,
        deletedBy: string
    ): Promise<AccountDeletionResult> {
        try {
            // Validation
            const validation = await this.validateDeletion(
                accountId,
                deletedBy
            );
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            // Check if already deleted
            const account = await prisma.account.findUnique({
                where: { id: accountId },
                select: { deleted_at: true, name: true },
            });

            if (account?.deleted_at) {
                throw new Error("Account is already deleted");
            }

            const deletedAt = new Date();
            const gracePeriodEnds = new Date(deletedAt);
            gracePeriodEnds.setDate(
                gracePeriodEnds.getDate() + GRACE_PERIOD_DAYS
            );

            // Soft delete the account
            await prisma.account.update({
                where: { id: accountId },
                data: {
                    deleted_at: deletedAt,
                    deleted_by: deletedBy,
                },
            });

            // Soft delete all users in the account
            await prisma.user.updateMany({
                where: {
                    account_id: accountId,
                    deactivated_at: null,
                },
                data: {
                    deactivated_at: deletedAt,
                },
            });

            // Log the deletion
            await this.logService.logMessage(
                LogLevel.INFO,
                `Account ${accountId} (${account?.name}) soft deleted by user ${deletedBy}`,
                "AccountDeletionService",
                {
                    accountId,
                    accountName: account?.name,
                    deletedBy,
                    deletedAt: deletedAt.toISOString(),
                    gracePeriodEnds: gracePeriodEnds.toISOString(),
                }
            );

            return {
                success: true,
                accountId,
                deletedAt,
                gracePeriodEnds,
                message: `Account deleted successfully. Grace period ends on ${gracePeriodEnds.toLocaleDateString()}`,
            };
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to soft delete account ${accountId}: ${error.message}`,
                "AccountDeletionService",
                { accountId, deletedBy, error: error.message }
            );

            throw error;
        }
    }

    /**
     * Restore a deleted account within grace period
     * @param accountId - Account ID to restore
     * @param restoredBy - User ID of admin performing restoration
     * @returns Restoration result
     */
    async restoreAccount(
        accountId: number,
        restoredBy: string
    ): Promise<AccountRestorationResult> {
        try {
            // Validation
            const validation = await this.validateRestoration(
                accountId,
                restoredBy
            );
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            const account = await prisma.account.findUnique({
                where: { id: accountId },
                select: { deleted_at: true, name: true },
            });

            if (!account?.deleted_at) {
                throw new Error("Account is not deleted");
            }

            // Check if within grace period
            const gracePeriodEnds = new Date(account.deleted_at);
            gracePeriodEnds.setDate(
                gracePeriodEnds.getDate() + GRACE_PERIOD_DAYS
            );

            if (new Date() > gracePeriodEnds) {
                throw new Error(
                    "Grace period has expired. Account cannot be restored."
                );
            }

            const restoredAt = new Date();

            // Restore the account
            await prisma.account.update({
                where: { id: accountId },
                data: {
                    deleted_at: null,
                    deleted_by: null,
                },
            });

            // Restore all users in the account
            await prisma.user.updateMany({
                where: {
                    account_id: accountId,
                    deactivated_at: account.deleted_at,
                },
                data: {
                    deactivated_at: null,
                },
            });

            // Sync system reports from master admin account to this restored account
            // so its views match the current master definitions.
            await this.reportService.syncSystemReportsToAccount(
                accountId,
                undefined,
                restoredBy
            );

            // Log the restoration
            await this.logService.logMessage(
                LogLevel.INFO,
                `Account ${accountId} (${account?.name}) restored by user ${restoredBy}`,
                "AccountDeletionService",
                {
                    accountId,
                    accountName: account?.name,
                    restoredBy,
                    restoredAt: restoredAt.toISOString(),
                }
            );

            return {
                success: true,
                accountId,
                restoredAt,
                message: "Account restored successfully",
            };
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to restore account ${accountId}: ${error.message}`,
                "AccountDeletionService",
                { accountId, restoredBy, error: error.message }
            );

            throw error;
        }
    }

    /**
     * Anonymize account data (called after grace period expires)
     * @param accountId - Account ID to anonymize
     * @returns Anonymization result
     */
    async anonymizeAccount(accountId: number): Promise<AnonymizationResult> {
        const errors: string[] = [];
        let usersAnonymized = 0;
        let contactsAnonymized = 0;
        let activitiesAnonymized = 0;
        let filesDeleted = 0;

        try {
            await this.logService.logMessage(
                LogLevel.INFO,
                `Starting anonymization for account ${accountId}`,
                "AccountDeletionService",
                { accountId }
            );

            // Verify account is deleted and grace period has expired
            const account = await prisma.account.findUnique({
                where: { id: accountId },
                select: { deleted_at: true, name: true },
            });

            if (!account?.deleted_at) {
                throw new Error("Account is not deleted");
            }

            const gracePeriodEnds = new Date(account.deleted_at);
            gracePeriodEnds.setDate(
                gracePeriodEnds.getDate() + GRACE_PERIOD_DAYS
            );

            if (new Date() < gracePeriodEnds) {
                throw new Error("Grace period has not expired yet");
            }

            // Anonymize account data
            const accountFields = anonymizeAccountFields(accountId);
            await prisma.account.update({
                where: { id: accountId },
                data: accountFields,
            });

            // Anonymize users
            const users = await prisma.user.findMany({
                where: { account_id: accountId },
                select: { id: true },
            });

            for (const user of users) {
                try {
                    // Extract numeric ID from user ID string for anonymization
                    const numericId =
                        parseInt(user.id.replace(/\D/g, "")) || accountId;
                    const userFields = anonymizeUserFields(user.id, numericId);

                    await prisma.user.update({
                        where: { id: user.id },
                        data: userFields,
                    });
                    usersAnonymized++;
                } catch (error: any) {
                    errors.push(
                        `Failed to anonymize user ${user.id}: ${error.message}`
                    );
                }
            }

            // Anonymize contacts
            const contacts = await prisma.contact.findMany({
                where: {
                    Customer: {
                        account_id: accountId,
                    },
                },
                select: { id: true },
            });

            for (const contact of contacts) {
                try {
                    const contactFields = anonymizeContactFields(contact.id);

                    await prisma.contact.update({
                        where: { id: contact.id },
                        data: contactFields,
                    });
                    contactsAnonymized++;
                } catch (error: any) {
                    errors.push(
                        `Failed to anonymize contact ${contact.id}: ${error.message}`
                    );
                }
            }

            // Anonymize activities (remove email/phone from content)
            const activities = await prisma.activity.findMany({
                where: { account_id: accountId },
                select: { id: true, title: true, content: true },
            });

            for (const activity of activities) {
                try {
                    let needsUpdate = false;
                    const modified_ata: any = {};

                    if (activity.title && containsPII(activity.title)) {
                        modified_ata.title = anonymizeActivityContent(
                            activity.title
                        );
                        needsUpdate = true;
                    }

                    if (activity.content && containsPII(activity.content)) {
                        modified_ata.content = anonymizeActivityContent(
                            activity.content
                        );
                        needsUpdate = true;
                    }

                    if (needsUpdate) {
                        await prisma.activity.update({
                            where: { id: activity.id },
                            data: modified_ata,
                        });
                        activitiesAnonymized++;
                    }
                } catch (error: any) {
                    errors.push(
                        `Failed to anonymize activity ${activity.id}: ${error.message}`
                    );
                }
            }

            // Delete files
            const fileResult =
                await this.fileDeletionService.deleteAccountFiles(accountId);
            filesDeleted = fileResult.filesDeleted;
            errors.push(...fileResult.errors);

            const anonymizedAt = new Date();

            await this.logService.logMessage(
                LogLevel.INFO,
                `Account ${accountId} anonymization completed`,
                "AccountDeletionService",
                {
                    accountId,
                    anonymizedAt: anonymizedAt.toISOString(),
                    usersAnonymized,
                    contactsAnonymized,
                    activitiesAnonymized,
                    filesDeleted,
                    errorCount: errors.length,
                }
            );

            return {
                success: errors.length === 0,
                accountId,
                anonymizedAt,
                usersAnonymized,
                contactsAnonymized,
                activitiesAnonymized,
                filesDeleted,
                errors,
            };
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to anonymize account ${accountId}: ${error.message}`,
                "AccountDeletionService",
                { accountId, error: error.message }
            );

            throw error;
        }
    }

    /**
     * Get accounts that need anonymization (grace period expired)
     * @returns Array of account IDs
     */
    async getAccountsForAnonymization(): Promise<number[]> {
        const gracePeriodDate = new Date();
        gracePeriodDate.setDate(gracePeriodDate.getDate() - GRACE_PERIOD_DAYS);

        const accounts = await prisma.account.findMany({
            where: {
                deleted_at: {
                    not: null,
                    lt: gracePeriodDate,
                },
            },
            select: { id: true },
        });

        return accounts.map((account) => account.id);
    }

    /**
     * Calculate days remaining in grace period
     * @param deletedAt - Deletion timestamp
     * @returns Days remaining (negative if expired)
     */
    calculateGracePeriodDays(deletedAt: Date): number {
        const gracePeriodEnds = new Date(deletedAt);
        gracePeriodEnds.setDate(gracePeriodEnds.getDate() + GRACE_PERIOD_DAYS);

        const now = new Date();
        const diffTime = gracePeriodEnds.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays;
    }

    /**
     * Validate deletion request
     */
    private async validateDeletion(
        accountId: number,
        deletedBy: string
    ): Promise<{
        valid: boolean;
        error?: string;
    }> {
        // Check if account exists
        const account = await prisma.account.findUnique({
            where: { id: accountId },
        });

        if (!account) {
            return { valid: false, error: "Account not found" };
        }

        // Check if user is Archaser Admin
        const user = await prisma.user.findUnique({
            where: { id: deletedBy },
            select: { account_id: true },
        });

        if (!user || user.account_id !== ARCHASER_ADMIN_ACCOUNT_ID) {
            return {
                valid: false,
                error: "Only Archaser Admin can delete accounts",
            };
        }

        // Cannot delete own account
        if (user.account_id === accountId) {
            return { valid: false, error: "Cannot delete your own account" };
        }

        return { valid: true };
    }

    /**
     * Validate restoration request
     */
    private async validateRestoration(
        accountId: number,
        restoredBy: string
    ): Promise<{
        valid: boolean;
        error?: string;
    }> {
        // Check if account exists
        const account = await prisma.account.findUnique({
            where: { id: accountId },
        });

        if (!account) {
            return { valid: false, error: "Account not found" };
        }

        // Check if user is Archaser Admin
        const user = await prisma.user.findUnique({
            where: { id: restoredBy },
            select: { account_id: true },
        });

        if (!user || user.account_id !== ARCHASER_ADMIN_ACCOUNT_ID) {
            return {
                valid: false,
                error: "Only Archaser Admin can restore accounts",
            };
        }

        return { valid: true };
    }
}
