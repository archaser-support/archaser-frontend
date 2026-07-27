import { priority } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import NotificationService from "@/server/services/NotificationService";

/**
 * Service for sending notifications to system administrators
 */
export class AdminNotificationService {
    private static instance: AdminNotificationService;

    private constructor() {}

    public static getInstance(): AdminNotificationService {
        if (!AdminNotificationService.instance) {
            AdminNotificationService.instance = new AdminNotificationService();
        }
        return AdminNotificationService.instance;
    }

    /**
     * Find system administrator users for a specific account
     * Returns users with System_Administrator or archaser_admin roles under the same account
     * @param accountId - Account ID to filter administrators by
     */
    async findAdminUsersByAccount(accountId: number | null): Promise<
        Array<{
            id: string;
            email: string | null;
            name: string | null;
            account_id: number | null;
        }>
    > {
        try {
            if (!accountId) {
                return [];
            }

            const adminUsers = await prisma.user.findMany({
                where: {
                    role: {
                        in: ["System_Administrator", "archaser_admin"] as any,
                    },
                    account_id: accountId, // Only admins in the same account
                    deactivated_at: null, // Exclude deactivated users
                },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    account_id: true,
                },
            });

            return adminUsers;
        } catch (error) {
            console.error("Error finding admin users by account:", error);
            return [];
        }
    }

    /**
     * Send account lock notification to all system administrators via notification center
     * @param lockedUserId - ID of the user whose account was locked
     * @param lockedUserEmail - Email of the user whose account was locked
     * @param lockedUserAccountId - Account ID of the locked user
     * @param failedAttempts - Number of failed login attempts
     * @param lockTime - Timestamp when the account was locked
     */
    async sendAccountLockNotification(
        lockedUserId: string,
        lockedUserEmail: string,
        lockedUserAccountId: number | null,
        failedAttempts: number,
        lockTime: Date
    ): Promise<void> {
        try {
            if (!lockedUserAccountId) {
                console.warn(
                    `[AdminNotificationService] Cannot send account lock notification: locked user ${lockedUserEmail} has no account_id`
                );
                return;
            }

            const adminUsers =
                await this.findAdminUsersByAccount(lockedUserAccountId);

            if (adminUsers.length === 0) {
                console.warn(
                    `[AdminNotificationService] No admin users found in account ${lockedUserAccountId} to send account lock notification`
                );
                return;
            }

            const notificationService = NotificationService.getInstance();

            // Create notification for each admin user in the same account
            const notificationPromises = adminUsers.map(async (admin) => {
                try {
                    const notification =
                        await notificationService.createNotification({
                            type: "Primary",
                            title: "Account Locked - Multiple Failed Login Attempts",
                            message: `User account ${lockedUserEmail} has been locked due to ${failedAttempts} failed login attempts at ${lockTime.toLocaleString()}. Please review and take appropriate action.`,
                            priority: "High" as priority,
                            userId: admin.id,
                            accountId: lockedUserAccountId,
                            actionUrl: `/app/settings/users/${lockedUserId}`,
                            metadata: {
                                lockedUserId,
                                lockedUserEmail,
                                failedAttempts,
                                lockTime: lockTime.toISOString(),
                                type: "account_lock",
                            },
                        });
                    return notification;
                } catch (error) {
                    console.error(
                        `[AdminNotificationService] Failed to create account lock notification for admin ${admin.id}:`,
                        error
                    );
                    if (error instanceof Error) {
                        console.error(
                            `[AdminNotificationService] Error details: ${error.message}`,
                            error.stack
                        );
                    }
                    throw error;
                }
            });

            const results = await Promise.allSettled(notificationPromises);
            const successCount = results.filter(
                (r) => r.status === "fulfilled"
            ).length;
            const failureCount = results.filter(
                (r) => r.status === "rejected"
            ).length;
        } catch (error) {
            // Don't throw - notification failures shouldn't block the login flow
            console.error(
                "[AdminNotificationService] Error sending account lock notification:",
                error
            );
            if (error instanceof Error) {
                console.error(
                    "[AdminNotificationService] Error stack:",
                    error.stack
                );
            }
        }
    }
}
