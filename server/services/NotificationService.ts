import { notification_type, priority } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { LogLevel } from "@/types/enums";
import { PermissionService } from "@/server/services/PermissionService";

import { LogService } from "./LogService";
import NotificationRealtimeService from "./NotificationRealtimeService";

export interface Notification {
    id: string;
    type: notification_type;
    title: string;
    message: string;
    priority: priority;
    timestamp: Date;
    actionUrl?: string;
    metadata?: Record<string, any>;
    userId: string;
    accountId: number;
}

export interface NotificationStats {
    total: number;
    byType: {
        controlCenter: number;
        disputes: number;
        invoices: number;
        activities: number;
        assignments: number;
        overdue: number;
        payments: number;
        system: number;
    };
    byPriority: {
        low: number;
        medium: number;
        high: number;
        urgent: number;
    };
}

class NotificationService {
    private static instance: NotificationService;

    private constructor() { }

    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    /**
     * Ensure follow-up reminder bell notifications exist for this user when follow-up is due soon.
     * Rule: create only when follow_up_time is within the next 10 minutes.
     * Scope: only schedule_follow_up activities (we use follow_up_time as source of truth and require an active period).
     */
    async ensureDueFollowUpReminderNotifications(
        userId: string,
        accountId: number
    ): Promise<void> {
        const now = new Date();
        const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const windowEnd = new Date(now.getTime() + 10 * 60 * 1000);
        const nowIso = now.toISOString();

        const user = (await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                role: true,
                business_unit_id: true,
                status: true,
                deactivated_at: true,
            } as any,
        })) as any;
        if (!user || user.status !== "Active" || user.deactivated_at) return;

        const permissionService = PermissionService.getInstance();
        const roleHasReminderPermission =
            user.role &&
            (await permissionService.hasPermission(
                accountId,
                user.role,
                "view_follow_up_reminders"
            ));
        if (!roleHasReminderPermission) return;

        // Pull candidate periods where follow-up is due soon.
        // If the user has reminder permission, include same-BU customers (when BU is set),
        // and always include directly owned customers.
        const whereCustomer: any = {
            account_id: accountId,
            OR: [{ owner_id: userId }],
        };
        if (user.business_unit_id != null) {
            whereCustomer.OR.push({
                business_unit_id: user.business_unit_id,
            });
        }

        const periods = (await prisma.customerCollectionPeriod.findMany({
            where: {
                period_end_date: null,
                follow_up_time: { gte: windowStart, lte: windowEnd },
                Customer: whereCustomer,
            } as any,
            select: {
                id: true,
                follow_up_time: true,
                customer_id: true,
                Activity: {
                    where: { call_outcome: "schedule_follow_up" } as any,
                    orderBy: { created_at: "desc" } as any,
                    take: 1,
                    select: {
                        User_Activity_created_byToUser: {
                            select: {
                                id: true,
                                name: true,
                                first_name: true,
                                last_name: true,
                                role: true,
                            } as any,
                        },
                    } as any,
                } as any,
                Customer: {
                    select: {
                        id: true,
                        owner_id: true,
                        business_unit_id: true,
                        Owner: {
                            select: {
                                id: true,
                                name: true,
                                first_name: true,
                                last_name: true,
                            } as any,
                        },
                    } as any,
                },
            } as any,
        })) as any[];

        if (!periods || periods.length === 0) return;

        // Dedupe: fetch existing follow-up reminder notifications for these periods for this user
        const existing = await prisma.notification.findMany({
            where: {
                user_id: userId,
                account_id: accountId,
                metadata: { path: ["followUpReminder"], equals: true },
            } as any,
            select: { id: true, metadata: true },
        });

        const hasExisting = (periodId: number, followUpIso: string) => {
            return existing.some((n) => {
                const m = (n.metadata as any) || null;
                return (
                    m?.followUpReminder === true &&
                    m?.kind === "pre10" &&
                    m?.customerCollectionPeriodId === periodId &&
                    m?.followUpTime === followUpIso
                );
            });
        };

        const createData: any[] = [];
        const superiorRoles = new Set([
            "Collection_Manager",
            "Account_Manager",
            "System_Administrator",
            "archaser_admin",
        ]);
        const currentUserIsSuperior =
            user.role != null && superiorRoles.has(user.role);
        for (const p of periods) {
            const followUpTime: Date | null = p.follow_up_time ?? null;
            if (!followUpTime) continue;
            const followUpIso = new Date(followUpTime).toISOString();
            if (hasExisting(p.id, followUpIso)) continue;

            const ownerId: string | null = p.Customer?.owner_id ?? null;
            const owner =
                p.Customer?.Owner?.name ||
                `${p.Customer?.Owner?.first_name || ""} ${p.Customer?.Owner?.last_name || ""}`.trim() ||
                "";
            const creator = Array.isArray(p.Activity)
                ? p.Activity[0]?.User_Activity_created_byToUser
                : null;
            const agentId: string | null = creator?.id ?? null;
            const agentName: string =
                creator?.name ||
                `${creator?.first_name || ""} ${creator?.last_name || ""}`.trim() ||
                "";
            const agentRole: string | null = creator?.role ?? null;
            const creatorIsSuperior =
                agentRole != null && superiorRoles.has(agentRole);

            if (
                creatorIsSuperior &&
                agentId &&
                userId !== agentId &&
                !currentUserIsSuperior
            ) {
                continue;
            }

            const title =
                agentId && agentName && userId !== agentId
                    ? `Follow up scheduled by ${agentName}`
                    : "Follow up scheduled";

            const actionUrl = `/app/customers/${p.customer_id}?activeTab=outstanding-activities-tab`;

            createData.push({
                id: crypto.randomUUID(),
                type: "Secondary",
                title,
                message: `Follow-up scheduled for ${followUpIso}${
                    owner ? ` (${owner})` : ""
                }`,
                priority: "Normal",
                user_id: userId,
                account_id: accountId,
                read: false,
                action_url: actionUrl,
                metadata: {
                    followUpReminder: true,
                    kind: "pre10",
                    remindAt: nowIso, // due now/soon; store for consistency
                    followUpTime: followUpIso,
                    customerCollectionPeriodId: p.id,
                    customerId: p.customer_id,
                    ownerId,
                    ownerName: owner,
                    agentId,
                    agentName,
                    businessUnitId: p.Customer?.business_unit_id ?? null,
                },
                created_at: now,
                modified_at: now,
            });
        }

        if (createData.length > 0) {
            await prisma.notification.createMany({ data: createData });
        }
    }

    /**
     * Create a new notification in the database
     */
    async createNotification(
        notification: Omit<Notification, "id" | "timestamp">,
        userId?: string
    ): Promise<Notification> {
        const logService = LogService.getInstance();

        try {
            const newNotification = await prisma.notification.create({
                data: {
                    id: crypto.randomUUID(),
                    type: notification.type,
                    title: notification.title,
                    message: notification.message,
                    priority: notification.priority,
                    user_id: notification.userId,
                    account_id: notification.accountId,
                    action_url: notification.actionUrl,
                    metadata: notification.metadata,
                    created_at: new Date(),
                    modified_at: new Date(),
                },
            });

            await logService.logMessage(
                LogLevel.INFO,
                `Notification created: ${notification.type} - ${notification.title}`,
                "NotificationService",
                {
                    notificationId: newNotification.id,
                    userId: notification.userId,
                }
            );

            // Broadcast real-time notification update to all users
            try {
                const realtimeService =
                    NotificationRealtimeService.getInstance();
                const updatedStats = await this.getNotificationStats(
                    notification.userId,
                    notification.accountId
                );

                // Broadcast to all users (no specific userId)
                await realtimeService.triggerNotificationUpdate(
                    "", // Empty userId means broadcast to all
                    notification.accountId,
                    `New ${notification.type} notification: ${notification.title}`,
                    updatedStats
                );
            } catch (realtimeError) {
                await logService.logMessage(
                    LogLevel.ERROR,
                    `Failed to broadcast real-time notification update: ${realtimeError}`,
                    "NotificationService",
                    {
                        notificationId: newNotification.id,
                        userId: notification.userId,
                    }
                );
            }

            return {
                id: newNotification.id,
                type: newNotification.type,
                title: newNotification.title,
                message: newNotification.message,
                priority: newNotification.priority,
                timestamp: newNotification.created_at,
                actionUrl: newNotification.action_url || undefined,
                metadata:
                    (newNotification.metadata as Record<string, any>) ||
                    undefined,
                userId: newNotification.user_id,
                accountId: newNotification.account_id,
            };
        } catch (error) {
            await logService.logMessage(
                LogLevel.ERROR,
                `Failed to create notification: ${error}`,
                "NotificationService",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                    notification,
                }
            );
            throw error;
        }
    }

    /**
     * Get notifications for a user
     */
    async getUserNotifications(
        userId: string,
        accountId: number,
        options: {
            limit?: number;
            offset?: number;
            type?: Notification["type"];
            priority?: Notification["priority"];
        } = {}
    ): Promise<Notification[]> {
        const { limit = 50, offset = 0, type, priority } = options;

        const where: any = {
            user_id: userId,
            account_id: accountId,
        };

        if (type) {
            where.type = type;
        }

        if (priority) {
            where.priority = priority;
        }

        const notifications = await prisma.notification.findMany({
            where,
            orderBy: { created_at: "desc" },
            take: limit,
            skip: offset,
        });

        return notifications.map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            message: n.message,
            priority: n.priority,
            timestamp: n.created_at,
            actionUrl: n.action_url ?? undefined,
            metadata: (n.metadata as Record<string, any>) || undefined,
            userId: n.user_id,
            accountId: n.account_id,
        }));
    }

    /**
     * Get notification statistics for a user
     */
    async getNotificationStats(
        userId: string,
        accountId: number,
        options?: { includeFollowUpReminders?: boolean }
    ): Promise<NotificationStats> {
        try {
            // Ensure due follow-up reminders exist (created only when <=10 minutes left)
            await this.ensureDueFollowUpReminderNotifications(userId, accountId);

            const notifications = await prisma.notification.findMany({
                where: {
                    user_id: userId,
                    account_id: accountId,
                },
            });

            const includeFollowUpReminders =
                options?.includeFollowUpReminders ?? true;
            const visibleNotifications = includeFollowUpReminders
                ? notifications
                : notifications.filter((notification: any) => {
                      const metadata = notification.metadata as any;
                      return metadata?.followUpReminder !== true;
                  });

            const stats: NotificationStats = {
                total: visibleNotifications.length,
                byType: {
                    controlCenter: 0,
                    disputes: 0,
                    invoices: 0,
                    activities: 0,
                    assignments: 0,
                    overdue: 0,
                    payments: 0,
                    system: 0,
                },
                byPriority: {
                    low: 0,
                    medium: 0,
                    high: 0,
                    urgent: 0,
                },
            };

            visibleNotifications.forEach((notification: any) => {
                // Count by type - map Primary/Secondary to meaningful categories based on metadata
                const metadata = notification.metadata as any;

                if (notification.type === "Primary") {
                    // Primary notifications are typically high-priority business events
                    if (metadata?.disputeId) {
                        stats.byType.disputes++;
                    } else if (metadata?.invoiceId) {
                        stats.byType.invoices++;
                    } else if (metadata?.activityId) {
                        stats.byType.activities++;
                    } else if (
                        metadata?.customerId &&
                        metadata?.action === "assigned"
                    ) {
                        stats.byType.assignments++;
                    } else if (metadata?.overdueCount) {
                        stats.byType.overdue++;
                    } else if (metadata?.paymentAmount) {
                        stats.byType.payments++;
                    } else {
                        // Default to system for Primary notifications without specific metadata
                        stats.byType.system++;
                    }
                } else if (notification.type === "Secondary") {
                    // Secondary notifications are typically lower-priority or informational
                    if (metadata?.disputeId) {
                        stats.byType.disputes++;
                    } else if (metadata?.invoiceId) {
                        stats.byType.invoices++;
                    } else if (metadata?.activityId) {
                        stats.byType.activities++;
                    } else if (
                        metadata?.customerId &&
                        metadata?.action === "assigned"
                    ) {
                        stats.byType.assignments++;
                    } else if (metadata?.overdueCount) {
                        stats.byType.overdue++;
                    } else if (metadata?.paymentAmount) {
                        stats.byType.payments++;
                    } else {
                        // Default to system for Secondary notifications without specific metadata
                        stats.byType.system++;
                    }
                }
            });

            // Count by priority - map database priority values to stats categories
            visibleNotifications.forEach((notification: any) => {
                const priority = notification.priority;
                if (priority === "Low") {
                    stats.byPriority.low++;
                } else if (priority === "Normal") {
                    stats.byPriority.medium++;
                } else if (priority === "High") {
                    stats.byPriority.high++;
                }
                // Note: 'urgent' is not supported in database, so it will always be 0
            });

            return stats;
        } catch (error) {
            console.error("Error in getNotificationStats:", error);
            // Return default stats instead of throwing
            return {
                total: 0,
                byType: {
                    controlCenter: 0,
                    disputes: 0,
                    invoices: 0,
                    activities: 0,
                    assignments: 0,
                    overdue: 0,
                    payments: 0,
                    system: 0,
                },
                byPriority: {
                    low: 0,
                    medium: 0,
                    high: 0,
                    urgent: 0,
                },
            };
        }
    }

    /**
     * Delete a specific notification
     */
    async deleteNotification(
        notificationId: string,
        userId: string,
        accountId: number
    ): Promise<void> {
        const logService = LogService.getInstance();

        try {
            const deletedNotification = await prisma.notification.deleteMany({
                where: {
                    id: notificationId,
                    user_id: userId,
                    account_id: accountId,
                },
            });

            if (deletedNotification.count === 0) {
                throw new Error("Notification not found or access denied");
            }

            await logService.logMessage(
                LogLevel.INFO,
                `Notification deleted: ${notificationId}`,
                "NotificationService",
                { notificationId, userId }
            );

            // Broadcast real-time notification update
            try {
                const realtimeService =
                    NotificationRealtimeService.getInstance();
                const updatedStats = await this.getNotificationStats(
                    userId,
                    accountId
                );

                await realtimeService.triggerNotificationUpdate(
                    userId,
                    accountId,
                    `Notification deleted: ${notificationId}`,
                    updatedStats
                );
            } catch (realtimeError) {
                await logService.logMessage(
                    LogLevel.ERROR,
                    `Failed to broadcast real-time notification deletion update: ${realtimeError}`,
                    "NotificationService",
                    { notificationId, userId }
                );
            }
        } catch (error) {
            await logService.logMessage(
                LogLevel.ERROR,
                `Failed to delete notification: ${error}`,
                "NotificationService",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                    notificationId,
                    userId,
                }
            );
            throw error;
        }
    }

    /**
     * Delete notifications by type for a user
     */
    async deleteNotificationsByType(
        userId: string,
        accountId: number,
        type: string
    ): Promise<void> {
        const logService = LogService.getInstance();

        try {
            const deletedNotifications = await prisma.notification.deleteMany({
                where: {
                    user_id: userId,
                    account_id: accountId,
                    type: type as any,
                },
            });

            if (deletedNotifications.count > 0) {
                await logService.logMessage(
                    LogLevel.INFO,
                    `Deleted ${deletedNotifications.count} ${type} notifications`,
                    "NotificationService",
                    { userId, count: deletedNotifications.count, type }
                );

                // Broadcast real-time notification update
                try {
                    const realtimeService =
                        NotificationRealtimeService.getInstance();
                    const updatedStats = await this.getNotificationStats(
                        userId,
                        accountId
                    );

                    await realtimeService.triggerNotificationUpdate(
                        userId,
                        accountId,
                        `Cleared ${deletedNotifications.count} ${type} notifications`,
                        updatedStats
                    );
                } catch (realtimeError) {
                    // Silent fail for cleanup broadcasts
                }
            }
        } catch (error) {
            await logService.logMessage(
                LogLevel.ERROR,
                `Failed to delete ${type} notifications: ${error}`,
                "NotificationService",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                    userId,
                    type,
                }
            );
            throw error;
        }
    }

    /**
     * Delete all notifications for a user
     */
    async deleteAllNotifications(
        userId: string,
        accountId: number
    ): Promise<void> {
        const logService = LogService.getInstance();

        try {
            const deletedNotifications = await prisma.notification.deleteMany({
                where: {
                    user_id: userId,
                    account_id: accountId,
                },
            });

            if (deletedNotifications.count > 0) {
                await logService.logMessage(
                    LogLevel.INFO,
                    `Deleted ${deletedNotifications.count} notifications`,
                    "NotificationService",
                    { userId, count: deletedNotifications.count }
                );

                // Broadcast real-time notification update
                try {
                    const realtimeService =
                        NotificationRealtimeService.getInstance();
                    const updatedStats = await this.getNotificationStats(
                        userId,
                        accountId
                    );

                    await realtimeService.triggerNotificationUpdate(
                        userId,
                        accountId,
                        `Cleared all ${deletedNotifications.count} notifications`,
                        updatedStats
                    );
                } catch (realtimeError) {
                    // Silent fail for cleanup broadcasts
                }
            }
        } catch (error) {
            await logService.logMessage(
                LogLevel.ERROR,
                `Failed to delete all notifications: ${error}`,
                "NotificationService",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                    userId,
                }
            );
            throw error;
        }
    }


    /**
     * Create dispute-related notifications
     */
    async createDisputeNotification(
        userId: string,
        accountId: number,
        disputeId: number,
        customerId: number,
        action: "created" | "assigned" | "resolved" | "updated",
        metadata?: Record<string, any>,
        translate?: (key: string, params?: Record<string, any>) => string
    ): Promise<Notification> {
        // Fetch customer information to get the name
        let customerName = `Customer #${customerId}`; // Fallback to ID if name fetch fails

        try {
            const customer = await prisma.customer.findUnique({
                where: { id: customerId },
                select: {
                    customer_number: true,
                    Person: {
                        select: { first_name: true, last_name: true }
                    },
                    Company: {
                        select: { name: true }
                    }
                }
            });

            if (customer) {
                if (customer.Person) {
                    customerName = `${customer.Person.first_name} ${customer.Person.last_name}`.trim();
                } else if (customer.Company) {
                    customerName = customer.Company.name;
                } else {
                    customerName = `Customer #${customer.customer_number || customerId}`;
                }
            }
        } catch (error) {
            // If we can't fetch customer info, use the fallback
        }

        // Use translations if available, otherwise fall back to English
        const getTitle = (action: string) => {
            if (translate) {
                return translate(`notifications:dispute.${action}`, {
                    customerName,
                    disputeId: disputeId.toString(),
                });
            }
            const fallbackTitles = {
                created: "New Dispute Filed",
                assigned: "Dispute Assigned to You",
                resolved: "Dispute Resolved",
                updated: "Dispute Updated",
            };
            return fallbackTitles[action as keyof typeof fallbackTitles] || action;
        };

        const getMessage = (action: string) => {
            if (translate) {
                return translate(`notifications:dispute.${action}_message`, {
                    customerName,
                    disputeId: disputeId.toString(),
                });
            }
            const fallbackMessages = {
                created: `A new dispute has been filed for ${customerName}`,
                assigned: `Dispute #${disputeId} has been assigned to you`,
                resolved: `Dispute #${disputeId} has been resolved`,
                updated: `Dispute #${disputeId} has been updated`,
            };
            return fallbackMessages[action as keyof typeof fallbackMessages] || action;
        };

        const title = metadata?.customTitle ?? getTitle(action);
        const message = metadata?.customMessage ?? getMessage(action);

        const priorities = {
            created: "High" as const,
            assigned: "High" as const,
            resolved: "Normal" as const,
            updated: "Normal" as const,
        };

        const { customTitle: _customTitle, customMessage: _customMessage, ...restMetadata } = metadata ?? {};
        return this.createNotification({
            type: "Primary",
            title,
            message,
            priority: priorities[action],
            userId,
            accountId,
            actionUrl: `/app/customers/${customerId}?activeTab=outstanding-activities-tab&openDispute=${disputeId}`,
            metadata: { disputeId, customerId, customerName, action, ...restMetadata },
        });
    }

    /**
     * Create invoice-related notifications
     */
    async createInvoiceNotification(
        userId: string,
        accountId: number,
        invoiceId: number,
        customerId: number,
        action: "overdue" | "paid" | "assigned" | "disputed",
        metadata?: Record<string, any>,
        translate?: (key: string, params?: Record<string, any>) => string
    ): Promise<Notification> {
        // Get invoice number and customer information for better display
        let invoiceNumber = `#${invoiceId}`;
        let customerName = `Customer ${customerId}`;

        try {
            const invoice = await prisma.invoice.findUnique({
                where: { id: invoiceId },
                select: {
                    invoice_number: true,
                    Customer: {
                        select: {
                            Person: {
                                select: {
                                    first_name: true,
                                    last_name: true
                                }
                            },
                            Company: {
                                select: {
                                    name: true
                                }
                            },
                            customer_number: true
                        }
                    }
                }
            });

            if (invoice?.invoice_number) {
                invoiceNumber = invoice.invoice_number;
            }

            if (invoice?.Customer) {
                const customer = invoice.Customer;
                if (customer.Person?.first_name && customer.Person?.last_name) {
                    customerName = `${customer.Person.first_name} ${customer.Person.last_name}`;
                } else if (customer.Company?.name) {
                    customerName = customer.Company.name;
                } else if (customer.customer_number) {
                    customerName = `Customer ${customer.customer_number}`;
                }
            }
        } catch (error) {
        }

        // Use translations if available, otherwise fall back to English
        const getTitle = (action: string) => {
            if (translate) {
                return translate(`notifications:invoice.${action}`, {
                    invoiceNumber,
                    customerName,
                });
            }
            const fallbackTitles = {
                overdue: "Invoice Overdue",
                paid: "Invoice Paid",
                assigned: "Invoice Assigned",
                disputed: "Invoice Disputed",
            };
            return fallbackTitles[action as keyof typeof fallbackTitles] || action;
        };

        const getMessage = (action: string) => {
            if (translate) {
                return translate(`notifications:invoice.${action}_message`, {
                    invoiceNumber,
                    invoiceId: invoiceId.toString(),
                    customerName,
                });
            }
            const fallbackMessages = {
                overdue: `Invoice ${invoiceNumber} for ${customerName} is now overdue`,
                paid: `Invoice ${invoiceNumber} for ${customerName} has been paid`,
                assigned: `Invoice ${invoiceNumber} for ${customerName} has been assigned to you`,
                disputed: `Invoice ${invoiceNumber} for ${customerName} has been disputed`,
            };
            return fallbackMessages[action as keyof typeof fallbackMessages] || action;
        };

        const title = getTitle(action);
        const message = getMessage(action);

        const priorities = {
            overdue: "High" as const,
            paid: "Normal" as const,
            assigned: "High" as const,
            disputed: "High" as const,
        };

        return this.createNotification({
            type: "Primary",
            title,
            message,
            priority: priorities[action],
            userId,
            accountId,
            actionUrl: `/app/customers/${customerId}/invoices/${invoiceId}`,
            metadata: { invoiceId, customerId, customerName, invoiceNumber, action, ...metadata },
        });
    }

    /**
     * Create activity-related notifications
     */
    async createActivityNotification(
        userId: string,
        accountId: number,
        activityId: number,
        customerId: number,
        activityType: string,
        action: "scheduled" | "completed" | "failed" | "delivered",
        metadata?: Record<string, any>
    ): Promise<Notification> {
        const titles = {
            scheduled: "Activity Scheduled",
            completed: "Activity Completed",
            failed: "Activity Failed",
            delivered: "Activity Delivered",
        };

        const messages = {
            scheduled: `${activityType} activity scheduled for customer ${customerId}`,
            completed: `${activityType} activity completed for customer ${customerId}`,
            failed: `${activityType} activity failed for customer ${customerId}`,
            delivered: `${activityType} activity delivered to customer ${customerId}`,
        };

        const priorities = {
            scheduled: "Low" as const,
            completed: "Normal" as const,
            failed: "High" as const,
            delivered: "Normal" as const,
        };

        return this.createNotification({
            type: "Secondary",
            title: titles[action],
            message: messages[action],
            priority: priorities[action],
            userId,
            accountId,
            actionUrl: `/app/customers/${customerId}/activities`,
            metadata: {
                activityId,
                customerId,
                activityType,
                action,
                ...metadata,
            },
        });
    }

    /**
     * Create assignment notifications
     */
    async createAssignmentNotification(
        userId: string,
        accountId: number,
        customerId: number,
        action: "assigned" | "reassigned" | "unassigned",
        assignedBy?: string,
        metadata?: Record<string, any>
    ): Promise<Notification> {
        const titles = {
            assigned: "Customer Assigned",
            reassigned: "Customer Reassigned",
            unassigned: "Customer Unassigned",
        };

        const messages = {
            assigned: `Customer ${customerId} has been assigned to you`,
            reassigned: `Customer ${customerId} has been reassigned to you`,
            unassigned: `Customer ${customerId} has been unassigned from you`,
        };

        const priorities = {
            assigned: "High" as const,
            reassigned: "High" as const,
            unassigned: "Normal" as const,
        };

        return this.createNotification({
            type: "Primary",
            title: titles[action],
            message: messages[action],
            priority: priorities[action],
            userId,
            accountId,
            actionUrl: `/app/customers/${customerId}`,
            metadata: { customerId, action, assignedBy, ...metadata },
        });
    }

    /**
     * Create overdue notifications
     */
    async createOverdueNotification(
        userId: string,
        accountId: number,
        customerId: number,
        overdueCount: number,
        totalAmount: number,
        metadata?: Record<string, any>
    ): Promise<Notification> {
        return this.createNotification({
            type: "Primary",
            title: "Overdue Invoices Alert",
            message: `Customer ${customerId} has ${overdueCount} overdue invoices totaling $${totalAmount.toFixed(2)}`,
            priority: "High",
            userId,
            accountId,
            actionUrl: `/app/customers/${customerId}`,
            metadata: { customerId, overdueCount, totalAmount, ...metadata },
        });
    }

    /**
     * Create payment notifications
     */
    async createPaymentNotification(
        userId: string,
        accountId: number,
        customerId: number,
        paymentAmount: number,
        invoiceCount: number,
        metadata?: Record<string, any>
    ): Promise<Notification> {
        return this.createNotification({
            type: "Primary",
            title: "Payment Received",
            message: `Payment of $${paymentAmount.toFixed(2)} received for ${invoiceCount} invoice(s) from customer ${customerId}`,
            priority: "Normal",
            userId,
            accountId,
            actionUrl: `/app/customers/${customerId}/payments`,
            metadata: { customerId, paymentAmount, invoiceCount, ...metadata },
        });
    }

    /**
     * Create system notifications
     */
    async createSystemNotification(
        userId: string,
        accountId: number,
        title: string,
        message: string,
        priority: Notification["priority"] = "Normal",
        actionUrl?: string,
        metadata?: Record<string, any>
    ): Promise<Notification> {
        return this.createNotification({
            type: "Secondary",
            title,
            message,
            priority,
            userId,
            accountId,
            actionUrl,
            metadata,
        });
    }

    /**
     * Create template missing notifications for all users in a customer
     * Notifies when a template is missing for the customer's language
     */
    async createTemplateMissingNotification(
        accountId: number,
        customerId: number,
        customerName: string,
        customerLanguage: string,
        activityType: string,
        channel: "Email" | "SMS" | "WhatsApp",
        templateId?: number,
        userId?: string
    ): Promise<void> {
        const logService = LogService.getInstance();

        try {
            // Get all active users for this customer
            const { getUsersByAccountId } = await import("./UserService");
            const users = await getUsersByAccountId(accountId);

            if (users.length === 0) {
                await logService.logMessage(
                    LogLevel.WARNING,
                    `No users found for customer ${accountId} to notify about missing template`,
                    "NotificationService",
                    { accountId, customerId, customerLanguage }
                );
                return;
            }

            // Get account name
            const account = await prisma.account.findUnique({
                where: { id: accountId },
                select: { name: true },
            });

            const accountName = account?.name || `Account #${accountId}`;

            // Create notification for each user
            const notificationPromises = users.map(async (user) => {
                // Skip if specific userId is provided and doesn't match
                if (userId && user.id !== userId) {
                    return null;
                }

                const title = "Template Missing for Activity";
                const message = `Could not create ${channel} activity for ${customerName} in ${customerLanguage} because there is no template for ${customerLanguage}.`;

                try {
                    return await this.createNotification(
                        {
                            type: "Primary",
                            title,
                            message,
                            priority: "High",
                            userId: user.id,
                            accountId,
                            actionUrl: `/app/customers/${customerId}?tab=general`,
                            metadata: {
                                customerId,
                                customerName,
                                customerLanguage,
                                activityType,
                                channel,
                                templateId,
                            },
                        },
                        userId || user.id
                    );
                } catch (error) {
                    await logService.logMessage(
                        LogLevel.ERROR,
                        `Failed to create template missing notification for user ${user.id}: ${error}`,
                        "NotificationService",
                        {
                            userId: user.id,
                            accountId,
                            customerId,
                            error: error instanceof Error ? error.message : String(error),
                        }
                    );
                    return null;
                }
            });

            const results = await Promise.all(notificationPromises);
            const successful = results.filter((r) => r !== null).length;

            await logService.logMessage(
                LogLevel.INFO,
                `Created ${successful} template missing notifications for ${users.length} users`,
                "NotificationService",
                {
                    accountId,
                    customerId,
                    customerLanguage,
                    channel,
                    totalUsers: users.length,
                    successfulNotifications: successful,
                }
            );
        } catch (error) {
            await logService.logMessage(
                LogLevel.ERROR,
                `Failed to create template missing notifications: ${error}`,
                "NotificationService",
                {
                    accountId,
                    customerId,
                    customerLanguage,
                    error: error instanceof Error ? error.message : String(error),
                }
            );
            // Don't throw - we don't want to break activity creation if notifications fail
        }
    }
}

export default NotificationService;
