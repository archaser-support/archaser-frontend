import {
    CustomerDispute,
    category,
} from "@prisma/client";

import { DbClient, prisma } from "@/lib/prisma";
import { EmailService } from "@/server/EmailService";
import { LogLevel, ActivityStatus } from "@/types/enums";
import { disputeEmailTemplate } from "@/utils/email-template";
import { resolveCustomerFirstCurrency } from "@/utils/stringFormatters";

import { ActivityService } from "./ActivityService";
import { CollectionPeriodService } from "./CollectionPeriodService";
import ControlCenterRealtimeService from "./ControlCenterRealtimeService";
import { CustomerService } from "./CustomerService";
import { InternalEmailTemplateService } from "./InternalEmailTemplateService";
import { INVOICE_STATUS } from "./InvoiceService";
import { LogService } from "./LogService";
import NotificationRealtimeService from "./NotificationRealtimeService";
import NotificationService from "./NotificationService";
import { DueNotificationService } from "./DueNotificationService";
import {
    getUsersByAccountId,
    PORTAL_USER_ID,
    getPortalUserId,
} from "./UserService";

interface CreateDisputeParams {
    customerId: number;
    userName: string;
    userId?: string; // Make userId optional since it's not always needed
    comment?: string;
    callType?: "incoming" | "outgoing";
    callOutcome?: string; // Add call outcome
    durationSec?: number; // Add duration
    invoiceIds?: number[];
    reasonId?: number;
    contactId?: number; // Add contact ID parameter
    contactInfo?: {
        reasonName: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
    };
    translate?: (key: string) => string;
    isPortal?: boolean; // Add parameter to distinguish portal vs LogActivity disputes
    locale?: string; // Add locale parameter for translation
}
export class DisputeService {
    private logService = LogService.getInstance();
    private internalEmailTemplateService = new InternalEmailTemplateService();
    private customerService: CustomerService;
    private activityService: ActivityService;
    private dueNotificationService: DueNotificationService;
    private disputeId: number;
    private userComment: string;
    private loggedInUserId: string;
    private customerId: number;
    private accountId: number;

    constructor() {
        this.customerService = new CustomerService();
        this.activityService = new ActivityService();
        this.dueNotificationService = new DueNotificationService();
        this.userComment = "";
        this.loggedInUserId = "";
        this.disputeId = 0;
        this.customerId = 0;
        this.accountId = 0;
    }

    public setDisputeId(disputeId: number) {
        this.disputeId = disputeId;
        if (!disputeId) throw new Error("Dispute ID is required");
    }

    public setCustomerId(customerId: number) {
        this.customerId = customerId;
        if (!customerId) throw new Error("Customer ID is required");
    }

    public setUserComment(comment: string) {
        this.userComment = comment || "";
    }

    public setLoggedInUserId(userId: string) {
        if (!userId) {
            throw new Error("Logged in user ID is required");
        }

        this.loggedInUserId = userId;
    }

    public setAccountId(accountId: number) {
        this.accountId = accountId;
        if (!accountId) throw new Error("Account ID is required");
    }

    private translate(key: string): string {
        return key; // Simple fallback translation
    }

    private async getCollectionPeriodId(customerId: number): Promise<number> {
        try {
            const currentCollectionPeriod =
                await prisma.customerCollectionPeriod.findFirst({
                    where: {
                        customer_id: customerId,
                        period_end_date: null, // Current active period
                    },
                    select: { id: true },
                });

            return currentCollectionPeriod?.id || 0;
        } catch {
            return 0;
        }
    }

    private async sendEmailToAssignee({
        assigneeName,
        assigneeEmail,
        customerName,
        invoiceNumbers,
        disputeId,
        disputedAmount,
        disputeReason,
        dateOfDispute,
        customerId,
        userComment,
        accountId,
    }: {
        assigneeName: string;
        assigneeEmail: string;
        invoiceNumbers: string;
        disputeId: string;
        disputedAmount: string;
        disputeReason: string;
        dateOfDispute: string;
        customerId: string;
        userComment: string;
        customerName: string;
        accountId: number;
    }) {
        // Get the configurable template
        const template = await this.internalEmailTemplateService.getTemplate(
            "dispute_assignment",
            accountId
        );

        if (!template) {
            // Fallback to hardcoded template if no configurable template exists
            const emailBody = disputeEmailTemplate(
                assigneeName, // Assignee name
                customerName, // Customer name
                invoiceNumbers, // Invoice numbers
                disputeId, // Dispute ID
                disputedAmount, // Disputed amount
                disputeReason, // Dispute reason
                dateOfDispute, // Date of dispute
                customerId, // Dispute link
                userComment ?? ""
            );

            const emailService = new EmailService();
            await emailService.setCustomerSenderNameAndReplyToEmail(accountId);
            await emailService.sendEmail(
                assigneeEmail,
                "New Dispute Assigned",
                emailBody
            );

            // Note: Activity is created separately by the calling method (assignUserToDispute)
            // to avoid duplicate activities
            return;
        }

        // Replace template variables
        const variables = {
            assignee_name: assigneeName,
            customer_name: customerName,
            invoice_numbers: invoiceNumbers,
            dispute_id: disputeId,
            disputed_amount: disputedAmount,
            dispute_reason: disputeReason,
            date_of_dispute: dateOfDispute,
            user_comment: userComment || "No comments",
            dispute_link: `${process.env.NEXTAUTH_URL}/app/customers/${customerId}?activeTab=outstanding-activities-tab&openDispute=${disputeId}`,
        };

        const emailSubject =
            this.internalEmailTemplateService.replaceTemplateVariables(
                template.subject,
                variables
            );
        const emailBody =
            this.internalEmailTemplateService.replaceTemplateVariables(
                template.content,
                variables
            );

        const emailService = new EmailService();
        await emailService.setCustomerSenderNameAndReplyToEmail(accountId);
        await emailService.sendEmail(assigneeEmail, emailSubject, emailBody);

        // Note: Activity is created separately by the calling method (assignUserToDispute)
        // to avoid duplicate activities
    }

    public async createDispute(
        params: CreateDisputeParams
    ): Promise<CustomerDispute> {
        return prisma.$transaction(
            async (tx) => {
                try {
                    // Check if collection period exists
                    let period =
                        await this.customerService.getCustomerCollectionPeriod(
                            params.customerId
                        );

                    const customer = await tx.customer.findUnique({
                        where: { id: params.customerId },
                        select: {
                            account_id: true,
                            total_due_amount: true,
                            customer_due_amount1: true,
                            customer_due_amount2: true,
                        },
                    });
                    if (!customer) throw new Error("Customer not found");

                    // Fetch Account separately since Customer doesn't have Account relation
                    const account = customer.account_id
                        ? await tx.account.findUnique({
                            where: { id: customer.account_id },
                            select: {
                                currency: true,
                                category_for_new_collection: true,
                            },
                        })
                        : null;

                    // If no collection period exists, create one for dispute using existing service
                    if (!period) {
                        // Check if customer has any due invoices
                        const hasDueInvoices =
                            (customer.total_due_amount || 0) > 0 ||
                            (customer.customer_due_amount1 || 0) > 0 ||
                            (customer.customer_due_amount2 || 0) > 0;

                        if (!hasDueInvoices) {
                            throw new Error(
                                "No collection period found and no due invoices to dispute"
                            );
                        }

                        // Use existing CollectionPeriodService to create collection period
                        const collectionPeriodService =
                            new CollectionPeriodService();
                        const customerData = [
                            {
                                customerId: params.customerId,
                                amounts: {
                                    total_outstanding_amount:
                                        customer.total_due_amount || 0,
                                    customer_outstanding_amount1:
                                        customer.customer_due_amount1 || 0,
                                    customer_outstanding_amount2:
                                        customer.customer_due_amount2 || 0,
                                    customer_currency1:
                                        resolveCustomerFirstCurrency({
                                            accountCurrency: account?.currency,
                                        }),
                                    customer_currency2: null,
                                    no_of_overdue_invoices: 0, // No overdue invoices for due-only scenario
                                },
                                customerInfo: {
                                    ...customer,
                                    category_for_new_collection: "Dispute", // Override to start in Dispute category
                                },
                                oldestOverdueDate: new Date(), // Use current date for due invoices
                            },
                        ];

                        const collectionPeriodResults =
                            await collectionPeriodService.createOrUpdateCollectionPeriods(
                                customerData,
                                {},
                                tx as DbClient
                            );
                        const result = collectionPeriodResults.get(
                            params.customerId
                        );

                        if (!result || result.errors.length > 0) {
                            throw new Error(
                                `Failed to create collection period: ${result?.errors.join(", ") || "Unknown error"}`
                            );
                        }

                        // Get the created collection period
                        period = await tx.customerCollectionPeriod.findUnique({
                            where: { id: result.collectionPeriodId },
                        });

                        if (!period) {
                            throw new Error(
                                "Collection period was created but could not be retrieved"
                            );
                        }

                        // Log the creation
                        await this.logService.logMessage(
                            LogLevel.INFO,
                            `Collection period created for dispute on due invoices using CollectionPeriodService`,
                            "DisputeService.createDispute",
                            {
                                customerId: params.customerId,
                                collectionPeriodId: period.id,
                                step: "COLLECTION_PERIOD_CREATED_FOR_DISPUTE",
                            },
                            customer.account_id
                        );
                    } else {
                        // Collection period exists, update category to Dispute
                        await this.customerService.updateCollectionPeriodCategory(
                            period.id,
                            "Dispute",
                            period.current_category as category,
                            customer.account_id,
                            params.customerId,
                            {
                                userId: params.userId, // Pass userId for proper tracking
                                isManualCategoryChange: false, // Automatic category change when dispute is created
                                dbClient: tx as DbClient,
                                runPostCommitEffects: false,
                            }
                        );
                    }

                    let reasonId = params.reasonId;
                    if (!reasonId && params.contactInfo) {
                        const r = await tx.disputeReason.findFirst({
                            where: {
                                name: params.contactInfo.reasonName,
                                account_id: customer.account_id,
                            },
                            select: { id: true },
                        });
                        if (!r) throw new Error("Dispute reason not found");
                        reasonId = r.id;
                    }

                    // Get invoice numbers for the old field
                    let invoiceNumbers: string | undefined;
                    let invoiceIds: number[] = [];

                    if (params.invoiceIds) {
                        const invoices = await tx.invoice.findMany({
                            where: {
                                id: { in: params.invoiceIds },
                                customer_id: params.customerId,
                            },
                            select: { invoice_number: true, id: true },
                        });
                        invoiceNumbers = invoices
                            .map((inv) => inv.invoice_number)
                            .filter(Boolean)
                            .join(",");
                        invoiceIds = invoices.map((inv) => inv.id);
                    }

                    if (
                        params.contactInfo?.reasonName ===
                        "I am not working there anymore" ||
                        params.contactInfo?.reasonName ===
                        "Not the right contact person in the company" ||
                        params.contactInfo?.reasonName ===
                        "Contact Information Issue"
                    ) {
                        // Note: This query may be slow for customers with many overdue invoices
                        // Consider adding a database index on (customer_id, status) if not present
                        const invoices = await tx.invoice.findMany({
                            where: {
                                customer_id: params.customerId,
                                status: "Overdue",
                            },
                            select: { invoice_number: true, id: true },
                            take: 100, // Limit to prevent excessive data for customers with many invoices
                        });
                        invoiceNumbers = invoices
                            .map((inv) => inv.invoice_number)
                            .filter(Boolean)
                            .join(",");
                        invoiceIds = invoices.map((inv) => inv.id);
                    }

                    // Reject if any invoice is already in another open dispute (same customer)
                    if (invoiceIds.length > 0) {
                        const alreadyInOpenDispute = await tx.disputeInvoice.findFirst({
                            where: {
                                invoice_id: { in: invoiceIds },
                                CustomerDispute: {
                                    customer_id: params.customerId,
                                    dispute_status: {
                                        in: ["New", "Under_Review", "Awaiting_Update"],
                                    },
                                },
                            },
                            select: { invoice_id: true },
                        });
                        if (alreadyInOpenDispute) {
                            throw new Error(
                                "One or more invoices are already associated with another open dispute"
                            );
                        }
                    }

                    // Set audit fields - use appropriate audit user ID based on context
                    let auditUserId: string | null = null;
                    if (params.isPortal || params.userId === PORTAL_USER_ID) {
                        // Use portal_user_id for portal disputes
                        auditUserId = getPortalUserId(customer.account_id);
                    } else {
                        // Use system_user_id for system-generated disputes, or userId for regular disputes
                        // For now, disputes are typically user-initiated, so use userId if available
                        auditUserId = params.userId || null;
                    }

                    // Get customer owner for dispute attribution
                    const customerOwner = await tx.customer.findUnique({
                        where: { id: params.customerId },
                        select: { owner_id: true },
                    });

                    const dispute = await tx.customerDispute.create({
                        data: {
                            customer_id: params.customerId,
                            customer_comment: params.comment,
                            dispute_reason_id: reasonId,
                            customer_collection_period_id: period.id,
                            dispute_status: "New",
                            contact_first_name: params.contactInfo?.firstName,
                            contact_last_name: params.contactInfo?.lastName,
                            contact_email: params.contactInfo?.email,
                            contact_mobile: params.contactInfo?.phone,
                            // Keep the old field for backward compatibility
                            invoices_in_dispute: invoiceNumbers,
                            // Set audit fields for proper attribution
                            created_by: auditUserId,
                            modified_by: auditUserId,
                            // Set owner to customer's owner for proper agent attribution
                            owner_id: customerOwner?.owner_id || auditUserId,
                            // Add the new relationship
                            DisputeInvoice:
                                invoiceIds.length > 0
                                    ? {
                                        create: invoiceIds.map(
                                            (invoiceId) => ({
                                                invoice_id: invoiceId,
                                                created_by: auditUserId,
                                                modified_by: auditUserId,
                                            })
                                        ),
                                    }
                                    : undefined,
                        },
                        include: {
                            Customer: true,
                            DisputeInvoice: {
                                include: {
                                    Invoice: true,
                                },
                            },
                        },
                    });

                    // Get dispute reason name for the title
                    let disputeReasonName = "Unknown";
                    if (params.contactInfo?.reasonName) {
                        disputeReasonName = params.contactInfo.reasonName;
                    } else if (reasonId) {
                        const reason = await tx.disputeReason.findUnique({
                            where: { id: reasonId },
                            select: { name: true },
                        });
                        disputeReasonName = reason?.name || "Unknown";
                    }

                    // Create dispute activity using the proper activity service method
                    await this.activityService.createActivityWithFormattedDescription(
                        {
                            customer_id: params.customerId,
                            collection_period_id: period.id,
                            type: "Dispute",
                            title: params.isPortal
                                ? "{{disputes.fields.filed_portal_title}}"
                                : "{{disputes.fields.filed_title}}",
                            comment: params.comment || "",
                            disputeId: dispute.id,
                            disputeStatus: "New",
                            disputeReason: disputeReasonName,
                            disputedInvoices: invoiceNumbers
                                ? invoiceNumbers.split(",")
                                : undefined,
                            contactInfo: params.contactInfo, // Pass contact information for dispute contact display
                            contact_id: params.contactId, // Pass contact ID for database lookup
                            account_id: customer.account_id,
                            actual_delivery_time: new Date(),
                            schedule_time: new Date(),
                            status: ActivityStatus.DISPUTE,
                            isPortal: params.isPortal || false,
                            assigneeName: params.userName, // This will be used as userName parameter and agentName internally
                            assignedBy: params.userName, // This will be used as assignedBy parameter
                            agentId: params.userId, // Pass userId as agentId for proper user tracking and Agent field resolution
                            userId: params.userId, // Pass userId for audit tracking
                            // translated at display time
                            locale: params.locale, // Pass the locale
                            callType: params.callType, // Pass call type
                            callOutcome: params.callOutcome, // Pass call outcome
                            durationSec: params.durationSec, // Pass duration
                            titleParams: {
                                disputeId: dispute.id.toString(),
                                userId: params.userId, // Use actual userId if available, otherwise will fallback to created_by in display
                                disputeReason: disputeReasonName,
                            },
                            dbClient: tx as DbClient,
                            runPostCommitEffects: false,
                        }
                    );

                    // Cancel all scheduled automated activities for this collection period

                    await this.activityService.cancelScheduledActivities(
                        period.id,
                        "Dispute Opened"
                    );

                    // Cancel scheduled due notifications for disputed invoices
                    if (invoiceIds.length > 0) {
                        await this.dueNotificationService.cancelDueNotificationsForInvoices(
                            invoiceIds,
                            (message, level, params) => {
                                let logLevel = LogLevel.INFO;
                                switch (level) {
                                    case "ERROR": logLevel = LogLevel.ERROR; break;
                                    case "WARNING": logLevel = LogLevel.WARNING; break;
                                    case "DEBUG": logLevel = LogLevel.DEBUG; break;
                                }
                                this.logService.logMessage(
                                    logLevel,
                                    message,
                                    "DisputeService.createDispute",
                                    params
                                );
                            }
                        );
                    }

                    // Trigger real-time Control Center update
                    try {
                        const realtimeService =
                            ControlCenterRealtimeService.getInstance();
                        await realtimeService.triggerUpdate(
                            `Dispute created for customer ${params.customerId} by ${params.userName}`,
                            {
                                userId: params.userName, // User who created the dispute
                                source: "user-action", // Mark as user action
                            }
                        );
                    } catch {
                        // Failed to trigger real-time update
                    }

                    // Create notification for dispute creation
                    try {
                        const notificationService =
                            NotificationService.getInstance();

                        if (params.isPortal) {
                            // For portal disputes, create notifications for all customer users
                            await this.createPortalDisputeNotifications(
                                customer.account_id,
                                dispute.id,
                                params.customerId,
                                disputeReasonName,
                                invoiceNumbers || "",
                                params.comment || "",
                                params.translate
                            );
                        } else {
                            // For regular disputes, create notification for the specific user
                            if (params.userId) {
                                await notificationService.createDisputeNotification(
                                    params.userId,
                                    customer.account_id,
                                    dispute.id,
                                    params.customerId,
                                    "created",
                                    {
                                        reasonName: disputeReasonName,
                                        invoiceNumbers,
                                        comment: params.comment,
                                    },
                                    params.translate
                                );
                            }
                        }
                    } catch (notificationError) {
                        // Failed to create notification
                        await this.logService.logMessage(
                            LogLevel.ERROR,
                            "DisputeService.createDispute - Failed to create notification",
                            "DisputeService",
                            {
                                error:
                                    notificationError instanceof Error
                                        ? notificationError.message
                                        : String(notificationError),
                            },
                            undefined, // accountId
                            undefined, // userId
                            undefined, // jobId
                            undefined // correlationId
                        );
                    }

                    // Invalidate operation dashboard cache (async, don't wait)
                    // Disputes affect operation dashboard stats
                    (async () => {
                        try {
                            const {
                                invalidateOperationDashboardCacheForAccount,
                            } = await import(
                                "@/server/utils/cacheInvalidationHelper"
                            );
                            await invalidateOperationDashboardCacheForAccount(
                                customer.account_id
                            );
                        } catch (error) {
                            // Cache invalidation failure should not break dispute creation
                            console.error(
                                "Failed to invalidate operation dashboard cache:",
                                error
                            );
                        }
                    })();

                    return dispute;
                } catch (error: any) {
                    await this.logService.logMessage(
                        LogLevel.ERROR,
                        "DisputeService.createDispute",
                        "DisputeService",
                        {
                            error:
                                error instanceof Error
                                    ? error.message
                                    : String(error),
                        },
                        undefined, // accountId
                        undefined, // userId
                        undefined, // jobId
                        undefined // correlationId
                    );
                    throw error;
                }
            },
            {
                timeout: 15000, // Increase timeout to 15 seconds for slow invoice queries
            }
        );
    }

    /**
     * Create notifications for all users of a customer when a portal dispute is created
     * Excludes users with Collection_Manager role
     */
    private async createPortalDisputeNotifications(
        accountId: number,
        disputeId: number,
        customerId: number,
        reasonName: string,
        invoiceNumbers: string,
        comment: string,
        translate?: (key: string, params?: Record<string, any>) => string
    ): Promise<void> {
        try {
            // Get all users for this customer
            const allCustomerUsers = await getUsersByAccountId(accountId);

            // Filter out users with Collection_Manager role
            const customerUsers = allCustomerUsers.filter(
                (user) =>
                    user.role !== null &&
                    (user.role as string) !== "Collection_Manager"
            );

            const filteredOutCount =
                allCustomerUsers.length - customerUsers.length;
            if (filteredOutCount > 0) {
                await this.logService.logMessage(
                    LogLevel.ERROR,
                    "DisputeService.createPortalDisputeNotifications",
                    `Filtered out ${filteredOutCount} Collection_Manager users from dispute notifications for customer ${accountId}`
                );
            }

            if (customerUsers.length === 0) {
                await this.logService.logMessage(
                    LogLevel.ERROR,
                    "DisputeService.createPortalDisputeNotifications",
                    `No eligible users found for customer ${accountId} (excluding Collection_Manager role), skipping portal dispute notifications`
                );
                return;
            }

            const notificationService = NotificationService.getInstance();
            const realtimeService = NotificationRealtimeService.getInstance();

            // Create notification for each user
            const notificationPromises = customerUsers.map(async (user) => {
                try {
                    return await notificationService.createDisputeNotification(
                        user.id,
                        accountId,
                        disputeId,
                        customerId,
                        "created",
                        {
                            reasonName,
                            invoiceNumbers,
                            comment,
                            source: "portal", // Mark as coming from portal
                        },
                        translate
                    );
                } catch (error) {
                    await this.logService.logMessage(
                        LogLevel.ERROR,
                        "DisputeService.createPortalDisputeNotifications",
                        `Failed to create notification for user ${user.id}: ${error}`
                    );
                    return null;
                }
            });

            // Wait for all notifications to be created
            const notifications = await Promise.all(notificationPromises);
            const successfulNotifications = notifications.filter(
                (n) => n !== null
            );

            await this.logService.logMessage(
                LogLevel.ERROR,
                "DisputeService.createPortalDisputeNotifications",
                `Created ${successfulNotifications.length} notifications for ${customerUsers.length} users for portal dispute ${disputeId}`
            );

            // Broadcast real-time update to all connected users
            try {
                // Get stats for the first user to use for broadcasting
                const firstUser = customerUsers[0];
                const stats = await notificationService.getNotificationStats(
                    firstUser.id,
                    accountId
                );

                await realtimeService.triggerNotificationUpdate(
                    "", // Empty userId means broadcast to all users
                    accountId,
                    `New portal dispute created: Dispute #${disputeId} for customer ${customerId}`,
                    stats
                );
            } catch (realtimeError) {
                await this.logService.logMessage(
                    LogLevel.ERROR,
                    "DisputeService.createPortalDisputeNotifications",
                    `Failed to broadcast real-time update: ${realtimeError}`
                );
            }
        } catch (error) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "DisputeService.createPortalDisputeNotifications",
                `Error creating portal dispute notifications: ${error}`
            );
            throw error;
        }
    }

    public async getDisputeById(
        disputeId: number
    ): Promise<CustomerDispute | null> {
        try {
            return await prisma.customerDispute.findUnique({
                where: { id: disputeId },
                include: {
                    Customer: true,
                    DisputeReason: true,
                    DisputeInvoice: {
                        include: {
                            Invoice: true,
                        },
                    },
                },
            });
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "DisputeService.getDisputeById",
                "DisputeService",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                undefined, // accountId
                undefined, // userId
                undefined, // jobId
                undefined // correlationId
            );
            throw error;
        }
    }

    public async assignUserToDispute(
        assigneeId: string,
        translate?: (key: string) => string
    ): Promise<CustomerDispute> {
        // Validate that the dispute exists and belongs to the customer
        const dispute = await prisma.customerDispute.findFirst({
            where: {
                id: this.disputeId,
            },
            include: {
                Customer: {
                    select: {
                        account_id: true,
                        email: true,
                        // Note: Account removed from Customer select since Customer doesn't have Account relation
                        // Fetch Account separately using customer.account_id if needed
                        Company: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
                DisputeReason: true,
                User_CustomerDispute_owner_idToUser: true,
                DisputeInvoice: {
                    include: {
                        Invoice: true,
                    },
                },
            },
        });

        if (!dispute) {
            throw new Error("Dispute not found");
        }

        // Update the dispute

        const updatedDispute = await prisma.customerDispute.update({
            where: { id: this.disputeId },
            data: {
                owner_id: assigneeId || dispute.owner_id,
            },
            include: {
                Customer: true,
                DisputeReason: true,
                User_CustomerDispute_owner_idToUser: true,
                DisputeInvoice: {
                    include: {
                        Invoice: true,
                    },
                },
            },
        });

        // Validate assignee if provided and different from
        // Skip if assigning the same user (no-op assignment)
        if (assigneeId && assigneeId !== dispute.owner_id) {
            const assignee = await prisma.user.findUnique({
                where: { id: assigneeId },
                select: { name: true, email: true },
            });

            if (!assignee) {
                throw new Error("Invalid assignee ID");
            }

            const invoiceNumbers =
                (dispute as any).DisputeInvoice?.map(
                    (invoice: any) => invoice.Invoice.invoice_number
                ).join(",") ?? "";
            const disputedAmount =
                (dispute as any).DisputeInvoice?.reduce(
                    (acc: number, invoice: any) =>
                        acc + (invoice.Invoice.amount ?? 0),
                    0
                ).toString() ?? "";

            // Check if a similar activity was recently created (within last 5 minutes) to prevent duplicates
            const recentActivity = await prisma.activity.findFirst({
                where: {
                    customer_id: dispute.customer_id,
                    title: {
                        contains: "New Dispute Assigned",
                    },
                    created_at: {
                        gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
                    },
                },
                orderBy: {
                    created_at: "desc",
                },
            });

            // Only send email if no recent similar activity exists
            if (!recentActivity) {
                // Try to send email to assignee, but don't fail if email sending fails
                try {
                    await this.sendEmailToAssignee({
                        assigneeName: assignee.name ?? "",
                        assigneeEmail: assignee.email ?? "",
                        customerName: dispute.Customer.Company?.name ?? "",
                        invoiceNumbers: invoiceNumbers ?? "",
                        disputeId: dispute.id.toString(),
                        disputedAmount: disputedAmount,
                        disputeReason: dispute.DisputeReason?.name ?? "",
                        dateOfDispute: dispute.created_at.toLocaleDateString(),
                        customerId: dispute.customer_id.toString(),
                        userComment: this.userComment,
                        accountId: dispute.Customer.account_id,
                    });
                    // Email sent successfully
                } catch {
                    // Email sending failed, but continuing with dispute assignment
                    // Don't throw error - email failure shouldn't prevent dispute assignment
                }
            }

            // Get the current user's name (the one doing the assignment)
            const currentUser = await prisma.user.findUnique({
                where: { id: this.loggedInUserId },
                select: { name: true, first_name: true, last_name: true },
            });

            const currentUserName =
                currentUser?.name ||
                `${currentUser?.first_name || ""} ${currentUser?.last_name || ""}`.trim() ||
                "Unknown User";

            // create activity
            // Validate collection period ID
            // If no collection period ID, try to find the current one
            let collectionPeriodId = dispute.customer_collection_period_id ?? 0;
            if (!collectionPeriodId) {
                try {
                    const currentCollectionPeriod =
                        await prisma.customerCollectionPeriod.findFirst({
                            where: {
                                customer_id: dispute.customer_id,
                                period_end_date: null, // Current active period
                            },
                            select: { id: true },
                        });

                    if (currentCollectionPeriod) {
                        collectionPeriodId = currentCollectionPeriod.id;
                    }
                } catch (_collectionError) {
                    // Handle collection error silently
                }
            }

            // Check if assignment activity was recently created to prevent duplicates
            // Look for activities with dispute assignment patterns in title
            const recentAssignmentActivity = await prisma.activity.findFirst({
                where: {
                    customer_id: dispute.customer_id,
                    OR: [
                        { title: { contains: "New Dispute Assigned" } },
                        { title: { contains: "Dispute Assignment" } },
                    ],
                    created_at: {
                        gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
                    },
                },
                orderBy: {
                    created_at: "desc",
                },
            });

            if (!recentAssignmentActivity) {
                const activityParams = {
                    customerId: dispute.customer_id,
                    accountId: dispute.Customer.account_id,
                    collectionPeriodId: collectionPeriodId,
                    assigneeId: assigneeId,
                    assigneeName: assignee.name ?? "",
                    userName: currentUserName,
                    assignedBy: this.loggedInUserId,
                    userComment: this.userComment,
                    disputeId: dispute.id,
                    // translated at display time
                };

                try {
                    await this.activityService.createAssignUserToDisputeActivity(
                        activityParams
                    );
                } catch (_activityError) {
                    // Activity creation failed but dispute assignment succeeded
                }
            }

            // Create notification for dispute assignment
            try {
                const notificationService = NotificationService.getInstance();

                // Fetch customer owner and name for notification title
                const customerForDispute = await prisma.customer.findUnique({
                    where: { id: dispute.customer_id },
                    select: {
                        owner_id: true,
                        customer_number: true,
                        Person: { select: { first_name: true, last_name: true } },
                        Company: { select: { name: true } },
                    },
                });
                const customerOwnerId = customerForDispute?.owner_id ?? null;
                const customerName = customerForDispute?.Person
                    ? `${customerForDispute.Person.first_name ?? ""} ${customerForDispute.Person.last_name ?? ""}`.trim()
                    : customerForDispute?.Company?.name ||
                      `Customer #${customerForDispute?.customer_number ?? dispute.customer_id}`;

                // Recipients: assignee + customer owner (if different from each other and from assigning user)
                const recipientIds = new Set<string>();
                // Only notify assignee if they are not the one doing the assignment
                if (assigneeId !== this.loggedInUserId) {
                    recipientIds.add(assigneeId);
                }
                // Notify customer owner if different from assigning user and assignee
                if (
                    customerOwnerId &&
                    customerOwnerId !== this.loggedInUserId
                ) {
                    recipientIds.add(customerOwnerId);
                }

                for (const recipientId of Array.from(recipientIds)) {
                    const isAssignee = recipientId === assigneeId;
                    const notificationTitle = isAssignee
                        ? `${currentUserName} assigned a dispute to you under ${customerName}`
                        : `${currentUserName} assigned a dispute to ${assignee.name || assigneeId} under ${customerName}`;
                    const notificationMessage = isAssignee
                        ? `Dispute #${dispute.id} has been assigned to you by ${currentUserName}`
                        : `Dispute #${dispute.id} has been assigned to ${assignee.name || assigneeId} by ${currentUserName}`;
                    await notificationService.createDisputeNotification(
                        recipientId,
                        dispute.Customer.account_id,
                        dispute.id,
                        dispute.customer_id,
                        "assigned",
                        {
                            assignedBy: currentUserName,
                            assignedByUserId: this.loggedInUserId,
                            assignedToUserId: assigneeId,
                            assignedToName: assignee.name || assigneeId,
                            reasonName: dispute.DisputeReason?.name,
                            comment: this.userComment,
                            customTitle: notificationTitle,
                            customMessage: notificationMessage,
                        }
                    );
                }

                // Broadcast real-time update to all connected users
                try {
                    const realtimeService =
                        NotificationRealtimeService.getInstance();

                    // Get stats for the current user (the one doing the assignment)
                    const currentUserStats =
                        await notificationService.getNotificationStats(
                            this.loggedInUserId,
                            dispute.Customer.account_id
                        );

                    // Broadcast to all users (no specific userId)
                    await realtimeService.triggerNotificationUpdate(
                        "", // Empty userId means broadcast to all
                        dispute.Customer.account_id,
                        `User assigned to dispute ${dispute.id}`,
                        currentUserStats
                    );
                    // Real-time notification update sent successfully
                } catch {
                    // Failed to broadcast notification update - not critical
                }
            } catch {
                // Failed to create notification - not critical
            }
        }

        return updatedDispute;
    }

    /**
     * Unified method to update dispute status
     */
    public async updateDisputeStatus(
        disputeStatus: CustomerDispute["dispute_status"],
        translate?: (key: string) => string,
        userId?: string
    ): Promise<CustomerDispute> {
        try {
            if (!disputeStatus) {
                throw new Error("Dispute status is required");
            }

            if (!this.disputeId || !this.customerId || !this.accountId) {
                throw new Error(
                    "Dispute ID, Customer ID, and Customer ID are required"
                );
            }

            // Find the dispute
            const dispute = await prisma.customerDispute.findFirst({
                where: {
                    id: this.disputeId,
                    customer_id: this.customerId,
                    Customer: {
                        account_id: this.accountId,
                    },
                },
                include: {
                    Customer: {
                        // Note: Account removed from Customer include since Customer doesn't have Account relation
                        // Fetch Account separately using customer.account_id if needed
                    },
                    DisputeReason: true,
                },
            });

            if (!dispute) {
                throw new Error("Dispute not found");
            }

            // Update the dispute status
            const updatedDispute = await prisma.customerDispute.update({
                where: {
                    id: this.disputeId,
                },
                data: {
                    dispute_status: disputeStatus,
                    modified_at: new Date(),
                    closed_at:
                        disputeStatus === "Resolved" ||
                            disputeStatus === "Cancelled"
                            ? new Date()
                            : null,
                },
                include: {
                    Customer: {
                        // Note: Account removed from Customer include since Customer doesn't have Account relation
                        // Fetch Account separately using customer.account_id if needed
                    },
                    DisputeReason: true,
                },
            });

            // Create activity for the status update
            await this.activityService.createActivityWithFormattedDescription({
                customer_id: dispute.customer_id,
                collection_period_id:
                    dispute.customer_collection_period_id ?? 0,
                type: "Dispute",
                title: `{{disputes.fields.status_updated}}`,
                comment: "", // Remove automatic comment
                disputeId: dispute.id,
                disputeStatus: disputeStatus,
                account_id: dispute.Customer.account_id,
                actual_delivery_time: new Date(),
                schedule_time: new Date(),
                status: ActivityStatus.COMPLETED,
                agentId: this.loggedInUserId || "System", // Pass userId as agentId for proper user tracking
                userId: userId || this.loggedInUserId, // Pass userId for audit tracking
                // translated at display time
                titleParams: {
                    status: disputeStatus as any,
                    disputeId: dispute.id.toString(),
                    userId: userId || this.loggedInUserId || "System",
                },
            });

            // Invalidate operation dashboard cache after dispute status update
            if (
                disputeStatus === "Resolved" ||
                disputeStatus === "Cancelled"
            ) {
                try {
                    const { invalidateOperationDashboardCacheForAccount } =
                        await import("@/server/utils/cacheInvalidationHelper");
                    await invalidateOperationDashboardCacheForAccount(
                        dispute.Customer.account_id
                    );
                } catch (error) {
                    // Cache invalidation failure should not break the status update
                    console.error(
                        "Failed to invalidate operation dashboard cache:",
                        error
                    );
                }
            }

            return updatedDispute;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "DisputeService.updateDisputeStatus",
                "DisputeService",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                undefined, // accountId
                undefined, // userId
                undefined, // jobId
                undefined // correlationId
            );
            throw error;
        }
    }

    /**
     * Unified method to resolve dispute (status + resolution)
     */
    public async resolveDispute(
        disputeStatus: CustomerDispute["dispute_status"],
        disputeResolution: CustomerDispute["dispute_resolution"],
        comment?: string,
        translate?: (key: string) => string
    ): Promise<CustomerDispute> {
        try {
            // Validate inputs
            if (!disputeStatus || !disputeResolution) {
                throw new Error("Dispute status and resolution are required");
            }

            if (disputeStatus !== "Resolved") {
                throw new Error('Dispute status must be "Resolved"');
            }

            if (!this.disputeId || !this.customerId || !this.accountId) {
                throw new Error(
                    "Dispute ID, Customer ID, and Customer ID are required"
                );
            }

            // Find the dispute
            const dispute = await prisma.customerDispute.findFirst({
                where: {
                    id: this.disputeId,
                    customer_id: this.customerId,
                    Customer: {
                        account_id: this.accountId,
                    },
                },
                include: {
                    Customer: {
                        // Note: Account removed from Customer include since Customer doesn't have Account relation
                        // Fetch Account separately using customer.account_id if needed
                    },
                    DisputeReason: true,
                    DisputeInvoice: {
                        include: {
                            Invoice: true,
                        },
                    },
                },
            });

            if (!dispute) {
                throw new Error("Dispute not found");
            }

            if (!dispute.customer_collection_period_id) {
                await this.logService.logMessage(
                    LogLevel.ERROR,
                    "DisputeService.resolveDispute",
                    `Dispute has no collection period`,
                    { error: "Dispute has no collection period" }
                );
                throw new Error("Dispute has no collection period");
            }

            const updatedDispute = await prisma.$transaction(async (tx) => {
                const nextDispute = await tx.customerDispute.update({
                    where: { id: this.disputeId },
                    data: {
                        dispute_status: disputeStatus,
                        dispute_resolution: disputeResolution,
                        resolution_comment: comment || "",
                        modified_at: new Date(),
                        closed_at: new Date(),
                        modified_by: this.loggedInUserId || "system",
                    },
                    include: {
                        Customer: {},
                        DisputeReason: true,
                        DisputeInvoice: {
                            include: {
                                Invoice: true,
                            },
                        },
                    },
                });

                const title = `{{disputes.fields.resolved}}`;
                const titleParams = {
                    disputeId: dispute.id.toString(),
                    userId: this.loggedInUserId || "system",
                    resolution: disputeResolution,
                };

                await this.activityService.createActivityWithFormattedDescription({
                    customer_id: dispute.customer_id,
                    collection_period_id: dispute.customer_collection_period_id,
                    type: "Dispute",
                    title: title,
                    comment: "",
                    resolutionComment:
                        nextDispute.resolution_comment || undefined,
                    disputeId: dispute.id,
                    disputeResolution: disputeResolution,
                    disputeStatus: disputeStatus,
                    account_id: dispute.Customer.account_id,
                    actual_delivery_time: new Date(),
                    schedule_time: new Date(),
                    status: ActivityStatus.COMPLETED,
                    agentId: this.loggedInUserId || "System",
                    userId: this.loggedInUserId,
                    systemGenerated: true,
                    titleParams: titleParams,
                    dbClient: tx as DbClient,
                    runPostCommitEffects: false,
                });

                await this.handlePostDisputeResolution(
                    dispute.id,
                    dispute.customer_id,
                    this.loggedInUserId,
                    translate || this.translate,
                    tx as DbClient
                );

                return nextDispute;
            });

            // Invalidate operation dashboard cache after dispute resolution
            try {
                const { invalidateOperationDashboardCacheForAccount } =
                    await import("@/server/utils/cacheInvalidationHelper");
                await invalidateOperationDashboardCacheForAccount(
                    dispute.Customer.account_id
                );
            } catch (error) {
                // Cache invalidation failure should not break the dispute resolution
                console.error(
                    "Failed to invalidate operation dashboard cache:",
                    error
                );
            }

            return updatedDispute;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "DisputeService.resolveDispute",
                "DisputeService",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                undefined, // accountId
                undefined, // userId
                undefined, // jobId
                undefined // correlationId
            );
            throw error;
        }
    }

    /**
     * Handle all post-dispute-resolution steps: collection period update (when applicable)
     * and due-notification handling for disputed invoices. Runs even when there is no collection period.
     */
    public async handlePostDisputeResolution(
        disputeId: number,
        customerId: number,
        userId?: string,
        translate?: (key: string) => string,
        dbClient?: DbClient
    ): Promise<boolean> {
        const client = dbClient ?? prisma;
        const dispute = await client.customerDispute.findUnique({
            where: { id: disputeId },
            include: {
                CustomerCollectionPeriod: true,
                DisputeInvoice: { select: { invoice_id: true } },
            },
        });

        // Always run due-notification handling for disputed invoice IDs
        const disputedInvoiceIds = (dispute?.DisputeInvoice ?? []).map((di) => di.invoice_id);
        if (disputedInvoiceIds.length > 0) {
            await this.handleDueNotificationAfterDisputeResolution(
                customerId,
                disputedInvoiceIds,
                client
            );
        }

        // Check if there are any other open disputes for the same customer
        const otherOpenDisputes = await client.customerDispute.findMany({
            where: {
                customer_id: customerId,
                dispute_status: {
                    notIn: ["Resolved", "Cancelled"],
                },
            },
            select: { id: true, dispute_status: true },
        });

        // Only update collection period if no other open disputes exist
        if (otherOpenDisputes.length === 0 && dispute) {

            if (
                dispute.customer_collection_period_id &&
                dispute.CustomerCollectionPeriod
            ) {
                const collectionPeriod = dispute.CustomerCollectionPeriod;

                // Check if there are any overdue invoices remaining
                const overdueInvoices = await client.invoice.findMany({
                    where: {
                        customer_id: customerId,
                        status: "Overdue",
                        customer_outstanding_debt: { gt: 0 },
                    },
                    select: { id: true },
                });

                if (overdueInvoices.length === 0) {
                    // No overdue invoices remaining - close collection period
                    const collectionPeriodService =
                        new CollectionPeriodService();
                    const closureResult =
                        await collectionPeriodService.closeCollectionPeriod(
                            collectionPeriod.id,
                            {
                                reason: "Dispute resolved and no overdue invoices remaining",
                                logContext: {
                                    processName:
                                        "DisputeService.handlePostDisputeResolution",
                                    customerId: customerId,
                                },
                            },
                            dbClient
                        );

                    if (closureResult.success) {
                        await this.logService.logMessage(
                            LogLevel.INFO,
                            `Collection period closed after dispute resolution - no overdue invoices remaining`,
                            "DisputeService.handlePostDisputeResolution",
                            {
                                customerId: customerId,
                                disputeId: disputeId,
                                collectionPeriodId: collectionPeriod.id,
                                step: "COLLECTION_PERIOD_CLOSED_NO_OVERDUE",
                            }
                        );
                    }

                    return true; // Collection period was closed
                } else {
                    // Overdue invoices still exist - revert to previous category
                    if (collectionPeriod.previous_category) {
                        const customer = await client.customer.findUnique({
                            where: { id: customerId },
                            select: { account_id: true },
                        });
                        if (!customer) return false;

                        const result =
                            await this.updateCollectionPeriodCategory(
                                collectionPeriod.id,
                                collectionPeriod.previous_category,
                                false,
                                translate,
                                userId,
                                dbClient
                            );

                        await this.logService.logMessage(
                            LogLevel.INFO,
                            `Collection period reverted to previous category after dispute resolution`,
                            "DisputeService.handlePostDisputeResolution",
                            {
                                customerId: customerId,
                                disputeId: disputeId,
                                collectionPeriodId: collectionPeriod.id,
                                previousCategory:
                                    collectionPeriod.previous_category,
                                step: "COLLECTION_PERIOD_REVERTED",
                            }
                        );

                        // Cache invalidation is already handled in updateCollectionPeriodCategory
                        return result !== null;
                    } else {
                        // No previous category – period was created only for this dispute; close it
                        const collectionPeriodService =
                            new CollectionPeriodService();
                        const closureResult =
                            await collectionPeriodService.closeCollectionPeriod(
                                collectionPeriod.id,
                                {
                                    reason:
                                        "Dispute resolved; collection period was created only for this dispute (no previous category)",
                                    logContext: {
                                        processName:
                                            "DisputeService.handlePostDisputeResolution",
                                        customerId: customerId,
                                    },
                                },
                                dbClient
                            );

                        if (closureResult.success) {
                            await this.logService.logMessage(
                                LogLevel.INFO,
                                `Collection period closed after dispute resolution (period was created only for dispute)`,
                                "DisputeService.handlePostDisputeResolution",
                                {
                                    customerId: customerId,
                                    disputeId: disputeId,
                                    collectionPeriodId: collectionPeriod.id,
                                    step: "COLLECTION_PERIOD_CLOSED_NO_PREVIOUS_CATEGORY",
                                }
                            );
                        }
                        return closureResult.success;
                    }
                }
            } else {
                await this.logService.logMessage(
                    LogLevel.ERROR,
                    "DisputeService.handlePostDisputeResolution",
                    `No collection period found for dispute ${disputeId}`,
                    {
                        error: `No collection period found for dispute ${disputeId}`,
                    }
                );
                await this.logService.logMessage(
                    LogLevel.ERROR,
                    "DisputeService.handlePostDisputeResolution",
                    `Dispute data: ${JSON.stringify(dispute)}`,
                    { error: `Dispute data: ${JSON.stringify(dispute)}` }
                );
                return false;
            }
        } else {
            return false;
        }
    }

    /**
     * After dispute resolution: for each disputed invoice and each due step, either add the invoice
     * back to an existing SCHEDULED due activity if schedule time has not passed, or set
     * due_notification_state[step] = "skip_due_to_dispute" so the invoice is included in the next due step when the job runs.
     */
    private async handleDueNotificationAfterDisputeResolution(
        customerId: number,
        disputedInvoiceIds: number[],
        dbClient: DbClient = prisma
    ): Promise<void> {
        const customer = await dbClient.customer.findUnique({
            where: { id: customerId },
            select: { account_id: true, sequence_container_id: true },
        });
        if (!customer) return;

        const dueSteps = await dbClient.activitiesSequence.findMany({
            where: {
                account_id: customer.account_id,
                category: "Automated",
                active: true,
                step_type: "due",
            },
            select: { id: true },
        });
        if (dueSteps.length === 0) return;

        const now = new Date();
        for (const invoiceId of disputedInvoiceIds) {
            const invoice = await dbClient.invoice.findUnique({
                where: { id: invoiceId },
                select: { invoice_number: true, due_notification_state: true },
            });
            if (!invoice) continue;

            const state = (invoice.due_notification_state as Record<string, string> | null) ?? {};
            for (const step of dueSteps) {
                const stepKey = String(step.id);
                const existing = await dbClient.activity.findFirst({
                    where: {
                        customer_id: customerId,
                        activity_sequence_id: step.id,
                        status: "SCHEDULED",
                        schedule_time: { gt: now },
                    },
                    select: { id: true, title_params: true },
                });
                if (existing) {
                    const params = (existing.title_params as { invoiceNumber?: string }) ?? {};
                    const numbers = (params.invoiceNumber ?? "")
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                    if (!numbers.includes(invoice.invoice_number ?? "")) {
                        numbers.push(invoice.invoice_number ?? "");
                        await dbClient.activity.update({
                            where: { id: existing.id },
                            data: {
                                title_params: { ...params, invoiceNumber: numbers.join(", "), count: numbers.length },
                            } as any,
                        });
                    }
                    state[stepKey] = "scheduled";
                } else {
                    state[stepKey] = "skip_due_to_dispute";
                }
            }
            await dbClient.invoice.update({
                where: { id: invoiceId },
                data: { due_notification_state: state as object },
            });
        }
    }

    /**
     * Centralized function to update collection period category
     */
    public async updateCollectionPeriodCategory(
        collectionPeriodId: number,
        newCategory: string,
        preservePreviousCategory: boolean = false,
        translate?: (key: string) => string,
        userId?: string,
        dbClient?: DbClient
    ) {
        const client = dbClient ?? prisma;
        // Get the current collection period
        const collectionPeriod =
            await client.customerCollectionPeriod.findUnique({
                where: { id: collectionPeriodId },
                include: {
                    Customer: {
                        select: {
                            account_id: true,
                        },
                    },
                },
            });

        if (!collectionPeriod) {
            return;
        }

        // Determine if we should update the category
        if (collectionPeriod.current_category === newCategory) {
            return null; // Return null to indicate no change was made
        }

        if (preservePreviousCategory) {
            // Keep the existing previous_category if it's different from the new category
            // previousCategoryToSet =
            //     collectionPeriod.previous_category !== newCategory
            //         ? collectionPeriod.previous_category
            //         : collectionPeriod.current_category;
        } else {
            // Always set previous_category to current_category when changing
            // previousCategoryToSet = collectionPeriod.current_category;
        }

        // Use the centralized CustomerService to update category
        // Note: CustomerService is already imported at the top of the file
        const customerService = new CustomerService();

        const result = await customerService.updateCollectionPeriodCategory(
            collectionPeriodId,
            newCategory as any,
            collectionPeriod.current_category as any,
            collectionPeriod.Customer.account_id,
            collectionPeriod.customer_id,
            {
                preservePreviousCategory,
                reason: "Dispute resolution category change",
                userId: userId || "system",
                translate: translate,
                dbClient,
                runPostCommitEffects: dbClient == null,
                // CRITICAL: Don't reset step to 0 when reverting to Automated
                // This allows the automated sequence to resume from where it left off
                resetStepToZero: false,
            }
        );

        if (!result) {
            throw new Error("Failed to update collection period category");
        }

        const updatedCollectionPeriod = result;

        // Note: Promise to pay category changes are now handled by CustomerService
        // Cache invalidation is already handled in updateCollectionPeriodCategory

        return updatedCollectionPeriod;
    }

    /**
     * Unified method to cancel dispute
     */
    public async cancelDispute(
        disputeResolution: CustomerDispute["dispute_resolution"],
        comment?: string,
        translate?: (key: string) => string
    ): Promise<CustomerDispute> {
        try {
            // Validate inputs
            if (!disputeResolution) {
                throw new Error("Dispute resolution is required");
            }

            if (!this.disputeId || !this.customerId || !this.accountId) {
                throw new Error(
                    "Dispute ID, Customer ID, and Customer ID are required"
                );
            }

            // Find the dispute
            const dispute = await prisma.customerDispute.findFirst({
                where: {
                    id: this.disputeId,
                    customer_id: this.customerId,
                    Customer: {
                        account_id: this.accountId,
                    },
                },
                include: {
                    Customer: {
                        // Note: Account removed from Customer include since Customer doesn't have Account relation
                        // Fetch Account separately using customer.account_id if needed
                    },
                    DisputeReason: true,
                    DisputeInvoice: {
                        include: {
                            Invoice: true,
                        },
                    },
                },
            });

            if (!dispute) {
                throw new Error("Dispute not found");
            }

            if (!dispute.customer_collection_period_id) {
                await this.logService.logMessage(
                    LogLevel.ERROR,
                    "DisputeService.cancelDispute",
                    `Dispute has no collection period`,
                    { error: "Dispute has no collection period" }
                );
                throw new Error("Dispute has no collection period");
            }

            // Update the dispute
            const updatedDispute = await prisma.customerDispute.update({
                where: { id: this.disputeId },
                data: {
                    dispute_status:
                        "Cancelled" as CustomerDispute["dispute_status"],
                    resolution_comment:
                        comment ||
                        "The dispute was canceled and replaced by a new dispute.",
                    dispute_resolution: disputeResolution,
                    modified_at: new Date(),
                    closed_at: new Date(),
                    modified_by: this.loggedInUserId || "system",
                },
                include: {
                    Customer: {
                        // Note: Account removed from Customer include since Customer doesn't have Account relation
                        // Fetch Account separately using customer.account_id if needed
                    },
                    DisputeReason: true,
                    DisputeInvoice: {
                        include: {
                            Invoice: true,
                        },
                    },
                },
            });

            // Create activity for the dispute cancellation
            await this.activityService.createActivityWithFormattedDescription({
                customer_id: dispute.customer_id,
                collection_period_id: dispute.customer_collection_period_id,
                type: "Dispute",
                title: `{{disputes.fields.cancelled}}`,
                comment: comment || "Dispute was cancelled",
                disputeId: dispute.id,
                disputeResolution: disputeResolution,
                disputeStatus: "Cancelled",
                account_id: dispute.Customer.account_id,
                actual_delivery_time: new Date(),
                schedule_time: new Date(),
                status: ActivityStatus.COMPLETED,
                agentId: this.loggedInUserId || "System", // Pass userId as agentId for proper user tracking
                userId: this.loggedInUserId, // Pass userId for audit tracking
                // translated at display time
                systemGenerated: true,
            });

            // Invalidate dashboard cache after dispute cancellation
            try {
                const {
                    invalidateDashboardCacheForAccount,
                    invalidateOperationDashboardCacheForAccount,
                } = await import("@/server/utils/cacheInvalidationHelper");
                await invalidateDashboardCacheForAccount(
                    dispute.Customer.account_id
                );
                await invalidateOperationDashboardCacheForAccount(
                    dispute.Customer.account_id
                );
            } catch (error) {
                // Cache invalidation failure should not break the dispute cancellation
                console.error("Failed to invalidate dashboard cache:", error);
            }

            return updatedDispute;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "DisputeService.cancelDispute",
                "DisputeService",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                undefined, // accountId
                undefined, // userId
                undefined, // jobId
                undefined // correlationId
            );
            throw error;
        }
    }

    /**
     * Unified method to assign user to dispute
     */
    public async assignUser(
        assignedUserId: string,
        assignedBy: string,
        translate?: (key: string) => string
    ): Promise<CustomerDispute> {
        try {
            if (!assignedUserId) {
                throw new Error("Assigned user ID is required");
            }

            if (!this.disputeId || !this.customerId || !this.accountId) {
                throw new Error(
                    "Dispute ID, Customer ID, and Customer ID are required"
                );
            }

            // Find the dispute
            const dispute = await prisma.customerDispute.findFirst({
                where: {
                    id: this.disputeId,
                    customer_id: this.customerId,
                    Customer: {
                        account_id: this.accountId,
                    },
                },
                include: {
                    Customer: {
                        // Note: Account removed from Customer include since Customer doesn't have Account relation
                        // Fetch Account separately using customer.account_id if needed
                    },
                    DisputeReason: true,
                },
            });

            if (!dispute) {
                throw new Error("Dispute not found");
            }

            // Get the assigned user's name
            const assignedUser = await prisma.user.findFirst({
                where: {
                    id: assignedUserId,
                    account_id: this.accountId,
                    status: "Active",
                },
            });

            if (!assignedUser) {
                throw new Error("Assigned user not found or not active");
            }

            const assignedUserName =
                `${assignedUser.first_name || ""} ${assignedUser.last_name || ""}`.trim() ||
                assignedUser.name ||
                "Unknown User";

            // Update the dispute with the assigned user
            const updatedDispute = await prisma.customerDispute.update({
                where: {
                    id: this.disputeId,
                },
                data: {
                    owner_id: assignedUserId,
                    modified_at: new Date(),
                },
                include: {
                    Customer: {
                        // Note: Account removed from Customer include since Customer doesn't have Account relation
                        // Fetch Account separately using customer.account_id if needed
                    },
                    DisputeReason: true,
                },
            });

            // Create activity for the dispute assignment
            await this.activityService.createActivityWithFormattedDescription({
                customer_id: dispute.customer_id,
                collection_period_id:
                    dispute.customer_collection_period_id ?? 0,
                type: "Dispute",
                title: "{{disputes.fields.assigned}}",
                titleParams: {
                    disputeId: dispute.id.toString(),
                    userId: this.loggedInUserId,
                    assigneeId: assignedUserId,
                },
                comment: `Dispute assigned to: ${assignedUserName}`,
                disputeId: dispute.id,
                disputeStatus: dispute.dispute_status || undefined,
                assigneeName: assignedUserName,
                assignedBy: assignedBy,
                agentId: this.loggedInUserId || "System", // Pass userId as agentId for proper user tracking
                userId: this.loggedInUserId, // Pass userId for audit tracking
                account_id: dispute.Customer.account_id,
                actual_delivery_time: new Date(),
                schedule_time: new Date(),
                status: ActivityStatus.COMPLETED,
                // translated at display time
                systemGenerated: true,
            });

            return updatedDispute;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "DisputeService.assignUser",
                "DisputeService",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                undefined, // accountId
                undefined, // userId
                undefined, // jobId
                undefined // correlationId
            );
            throw error;
        }
    }
}
