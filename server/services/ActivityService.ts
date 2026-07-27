import {
    Prisma,
    activity_type,
    contact_status,
    delivery_status,
    email_status,
    type Activity,
} from "@prisma/client";
import moment from "moment-timezone";

import { DbClient, prisma } from "@/lib/prisma";
import { EmailService } from "@/server/EmailService";
import { ActivityStatus, LogLevel } from "@/types/enums";
import { isCreditOnlyAccount } from "@/shared/utils/accountProducts";
import { getCustomerPortalUrl } from "@/utils/appUrls";
import {
    formatDateForDisplay as formatDateForDisplayUtil,
    formatDuration,
    scheduleDateTime,
} from "@/utils/datetimeOperations";

import { BusinessService } from "./BusinessService";
import { CommunicationLearningService } from "./CommunicationLearningService";
import { LanguageResolutionService } from "./LanguageResolutionService";
import { LogService } from "./LogService";
import { SMSVendorService } from "./SMSVendorService";
import {
    PORTAL_USER_ID,
    findUserById,
    getPortalUserId,
    getSystemUserId,
} from "./UserService";

// Types
interface PromiseToPayParams {
    customerId: number;
    accountId: number;
    periodId: number;
    promiseDate: Date | string;
    callType: string;
    durationSec: number;
    comment: string;
    userName: string; // Keep for backward compatibility
    userId?: string; // Add new userId parameter
    timezone: string;
    contact: {
        id?: number;
        name: string | null;
    };
    isPortal: boolean;
}

/**
 * Unified interface for activity content generation parameters
 */
interface ActivityContentParams {
    type: activity_type;
    contact?: {
        id?: number;
        name: string | null;
    };
    contactId?: number; // Add contact ID parameter
    callType?: string;
    durationSec?: number;
    comment?: string;
    resolutionComment?: string;
    callOutcome?: string;
    followUpTime?: Date | null;
    promiseDate?: Date;
    timezone?: string;
    isPortal?: boolean;
    disputeId?: number;
    disputeResolution?: string;
    disputeStatus?: string;
    disputeReason?: string;
    disputedInvoices?: string[];
    contactInfo?: {
        reasonName: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
    };
    assigneeName?: string;
    assignedBy?: string;
    assigneeId?: string; // Add user ID for assignee
    assignedById?: string; // Add user ID for assigned by
    agentName?: string;
    agentId?: string; // Add user ID for agent
}

interface ActivityError extends Error {
    code?: string;
    details?: any;
}

type ActivityCreateInput = Prisma.ActivityCreateInput & {
    locale?: string;
    call_outcome?: string;
    follow_up_time?: Date | null;
    duration?: number | null;
    call_type?: string;
    status?: ActivityStatus;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
interface ActivityWithDetails extends Partial<Activity> {
    follow_up_time?: Date;
    amount?: number;
    dispute_reason?: string | number;
    note?: string;
    email_subject?: string;
    sms_content?: string;
    call_outcome?: string;
    duration?: number | null;
    call_type?: string;
    contact_name?: string;
    disputedInvoices?: string[];
    type?: activity_type;
    content?: string;
}

// Legacy constants removed - now using ActivityStatus enum and ActivityStatusMigrationService

export class ActivityService {
    private logService: LogService;
    private learningService: CommunicationLearningService;

    constructor() {
        this.logService = LogService.getInstance();
        this.learningService = new CommunicationLearningService();
    }

    private handleError(error: any, context: string): never {
        const activityError = new Error(
            `ActivityService.${context} failed: ${error.message || error.toString()}`
        ) as ActivityError;
        activityError.code = error.code;
        activityError.details = error;
        throw activityError;
    }

    public static getActivityScheduleStatusIDByType(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        _type: activity_type
    ): ActivityStatus {
        return ActivityStatus.SCHEDULED;
    }

    /* ********** CREATE ACTIVITY ********** */
    public async createActivity(
        data: ActivityCreateInput & {
            call_outcome?: string;
        },
        userId?: string
    ): Promise<Activity> {
        try {
            return await prisma.activity.create({
                data: {
                    ...(data as any),
                    created_by: userId,
                    modified_by: userId,
                },
            });
        } catch (error) {
            throw this.handleError(error, "createActivity");
        }
    }

    /* ********** CREATE ACTIVITY WITH FORMATTED DESCRIPTION ********** */
    public async createActivityWithFormattedDescription(params: {
        customer_id: number;
        /** When omitted or null, activity is still attached to the customer (no open collection period). */
        collection_period_id?: number | null;
        type: activity_type;
        title: string;
        content?: string;
        contact?: {
            id: number;
            name: string | null;
        };
        callType?: string;
        durationSec?: number;
        comment?: string;
        resolutionComment?: string;
        callOutcome?: string;
        followUpTime?: Date | null;
        promiseDate?: Date;
        timezone?: string;
        isPortal?: boolean;
        disputeReason?: string;
        disputedInvoices?: string[];
        contactInfo?: {
            reasonName: string;
            firstName?: string;
            lastName?: string;
            email?: string;
            phone?: string;
        };
        account_id: number;
        contact_id?: number;
        schedule_time?: Date;
        actual_delivery_time?: Date;
        status?: ActivityStatus;
        disputeId?: number;
        disputeResolution?: string;
        disputeStatus?: string;
        assigneeName?: string;
        assignedBy?: string;
        assigneeId?: string; // Add user ID for assignee
        assignedById?: string; // Add user ID for assigned by
        agentId?: string; // Add user ID for agent
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        translate?: (key: string) => string; // Add translation function parameter
        systemGenerated?: boolean; // Add system generated parameter
        locale?: string; // Add locale parameter for date formatting
        userId?: string; // User ID for audit tracking
        activity_template?: number; // Add activity template ID
        dbClient?: DbClient;
        runPostCommitEffects?: boolean;
        titleParams?: {
            // Common parameters for all activity types
            step?: string;
            contacts?: string;
            time?: string;
            userName?: string;
            userId?: string; // Add userId field for tracking who created the activity

            // Call activity parameters
            callType?: string;
            contact?: string;
            outcome?: string;

            // Dispute parameters
            disputeReason?: string;
            disputeId?: string;
            resolution?: string;
            assignedBy?: string;
            assigneeName?: string;
            assigneeId?: string;
            status?: ActivityStatus;

            // Category change parameters
            oldCategory?: string;
            newCategory?: string;

            // Other parameters
            reason?: string; // Add reason parameter for collection period closure
            invoiceNumber?: string;
        }; // Add title parameters for placeholder replacement
    }): Promise<Activity> {
        try {
            const dbClient = params.dbClient ?? prisma;
            const runPostCommitEffects =
                params.runPostCommitEffects ?? params.dbClient == null;

            const hasExplicitTransactionClient =
                params.dbClient != null && params.dbClient !== prisma;
            if (hasExplicitTransactionClient && runPostCommitEffects) {
                throw new Error(
                    "createActivityWithFormattedDescription post-commit effects require a committed client"
                );
            }

            const content =
                params.content ||
                (await this.generateActivityDescription({
                    type: params.type,
                    contact: params.contact,
                    contactId: params.contact_id,
                    callType: params.callType,
                    durationSec: params.durationSec,
                    comment: params.comment,
                    resolutionComment: params.resolutionComment,
                    callOutcome: params.callOutcome,
                    followUpTime: params.followUpTime,
                    promiseDate: params.promiseDate,
                    timezone: params.timezone,
                    isPortal: params.isPortal,
                    disputeId: params.disputeId,
                    disputeResolution: params.disputeResolution,
                    disputeStatus: params.disputeStatus,
                    disputeReason: params.disputeReason,
                    disputedInvoices: params.disputedInvoices,
                    contactInfo: params.contactInfo,
                    assigneeName: params.assigneeName,
                    assignedBy: params.assignedBy,
                    assigneeId: params.assigneeId,
                    assignedById: params.assignedById,
                    agentName: params.assigneeName,
                    agentId: params.agentId,
                    // DO NOT pass translate function - content should be generated with translation keys
                    // Translation will happen in formatContent() when fetching for display
                }));

            // Store the translation key and parameters in the database - DO NOT format yet
            // Formatting will happen during display in formatTitleForDisplay
            let formattedContent = content;

            // Ensure userId is in titleParams if it's provided in params but missing from titleParams
            const titleParamsWithUserId = params.titleParams
                ? {
                    ...params.titleParams,
                    // Add userId to titleParams if it's missing but available in params
                    ...(params.titleParams.userId
                        ? {}
                        : params.userId
                            ? { userId: params.userId }
                            : {}),
                }
                : params.userId
                    ? { userId: params.userId }
                    : undefined;

            // Only format the content if it contains translation keys or parameters
            if (
                params.translate &&
                content &&
                (content.includes("{{") || content.includes("→"))
            ) {
                try {
                    formattedContent = await this.formatTitleForDisplay(
                        content,
                        params.translate,
                        titleParamsWithUserId,
                        params.locale
                    );
                } catch {
                    formattedContent = content;
                }
            }

            const activityData: any = {
                customer_id: params.customer_id,
                collection_period_id:
                    params.collection_period_id === undefined
                        ? null
                        : params.collection_period_id,
                type: params.type,
                title: params.title, // Store the ORIGINAL translation key, not the formatted title
                content: formattedContent, // Use the formatted content with translated parameters
                schedule_time: params.schedule_time || new Date(),
                actual_delivery_time: params.actual_delivery_time || null,
                status: params.status || ActivityStatus.COMPLETED,
                account_id: params.account_id,
                contact_id: params.contact_id,
                system_generated: params.systemGenerated || false,
                call_outcome: params.callOutcome || null, // Store call outcome in dedicated field
                activity_template: params.activity_template || null,
            };

            if (titleParamsWithUserId) {
                activityData.title_params = titleParamsWithUserId;
            }

            // Set audit fields - use appropriate audit user ID based on context
            let auditUserId: string | null = null;
            if (params.systemGenerated) {
                // Use system_user_id for system-generated activities
                auditUserId = getSystemUserId(params.account_id);
            } else if (params.isPortal || params.userId === PORTAL_USER_ID) {
                // Use portal_user_id for portal activities
                auditUserId = getPortalUserId(params.account_id);
            } else {
                // Use the provided userId for regular user activities
                auditUserId = params.userId || null;
            }

            const savedActivity = await dbClient.activity.create({
                data: {
                    ...activityData,
                    created_by: auditUserId,
                    modified_by: auditUserId,
                },
            });

            if (runPostCommitEffects) {
                // Invalidate operation dashboard cache (async, don't wait)
                // Activities affect operation dashboard stats
                (async () => {
                    try {
                        const { invalidateOperationDashboardCacheForAccount } =
                            await import(
                                "@/server/utils/cacheInvalidationHelper"
                            );
                        await invalidateOperationDashboardCacheForAccount(
                            params.account_id
                        );
                    } catch (error) {
                        // Cache invalidation failure should not break activity creation
                        console.error(
                            "Failed to invalidate operation dashboard cache:",
                            error
                        );
                    }
                })();

                // If this is a scheduled activity (not immediate), generate calculation text
                // Calculate and store schedule calculation including weekend/holiday skipping
                // This ensures admins can see why a date was chosen via the tooltip in ActivityTimeline
                if (params.schedule_time && params.schedule_time > new Date()) {
                    try {
                        await scheduleDateTime({
                            baseDate: params.schedule_time,
                            timeOfDay: params.schedule_time
                                .toTimeString()
                                .slice(0, 5), // Extract HH:mm
                            daysToAdd: 0,
                            skipWeekends: true,
                            skipHolidays: true, // Skip holidays by default to avoid scheduling on non-business days
                            businessHoursOnly: true,
                            returnUTC: true,
                            activityId: Number(savedActivity.id),
                        });
                    } catch {
                        // eslint-disable-next-line no-empty
                        // Don't fail the activity creation if calculation fails
                    }
                }
            }

            return savedActivity;
        } catch (error) {
            // Log error
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Error in createActivityWithFormattedDescription: ${(error as Error).message}`,
                "ActivityService.createActivityWithFormattedDescription"
            );
            throw this.handleError(
                error,
                "createActivityWithFormattedDescription"
            );
        }
    }

    /* ********** CREATE ACTIVITIES ********** */
    public async createActivities(
        data: Prisma.ActivityCreateManyInput[]
    ): Promise<void> {
        try {
            await prisma.activity.createMany({
                data,
                skipDuplicates: true,
            });
        } catch (error) {
            throw this.handleError(error, "createActivities");
        }
    }

    /* ********** CREATE PROMISE TO PAY ACTIVITY ********** */
    public async createPromiseToPayLoggedActivity(
        params: PromiseToPayParams
    ): Promise<Activity[]> {
        try {
            const {
                customerId,
                periodId,
                promiseDate,
                callType,
                durationSec,
                comment,
                timezone,
                contact,
                isPortal,
                accountId,
            } = params;

            let convertedPromiseDate: Date;
            if (typeof promiseDate === "string") {
                const [year, month, day] = promiseDate.split("-").map(Number);
                convertedPromiseDate = new Date(Date.UTC(year, month - 1, day));
            } else {
                convertedPromiseDate = new Date(promiseDate);
            }

            // Only cancel non-Promise-to-Pay scheduled activities
            // This prevents cancelling existing Promise to Pay scheduled activities
            // when creating a new Promise to Pay entry
            await this.cancelNonPromiseToPayScheduledActivities(
                periodId,
                params.userId
            );

            const content = await this.generateActivityDescription({
                type: "Call" as activity_type,
                contact,
                callType,
                durationSec,
                comment,
                callOutcome: "promise_to_pay",
                promiseDate: convertedPromiseDate,
                timezone,
                isPortal,
            });

            const title = isPortal
                ? "{{activities.fields.activity_promise_to_pay_from_portal}}"
                : "{{activities.fields.activity_promise_to_pay_logged}}";

            const hasValidContactId =
                typeof contact?.id === "number" &&
                Number.isFinite(contact.id) &&
                contact.id > 0;

            const activityData = {
                customer_id: customerId,
                collection_period_id: periodId,
                type: "Promise_to_pay" as activity_type,
                title: title,
                content,
                schedule_time: moment().utc().toDate(),
                status: ActivityStatus.COMPLETED,
                account_id: accountId,
                ...(hasValidContactId ? { contact_id: contact.id } : {}),
                system_generated: true,
                title_params: {
                    userId: params.userId || params.userName, // Use userId if available, fallback to userName
                    date: convertedPromiseDate.toISOString(),
                },
            };

            // Set audit fields - use actual user ID if provided, otherwise use portal/system user
            let auditUserId: string | null = null;
            if (params.userId && params.userId !== PORTAL_USER_ID) {
                // Use the actual user ID who created the promise
                auditUserId = params.userId;
            } else if (isPortal || params.userId === PORTAL_USER_ID) {
                // Use portal_user_id for portal activities
                auditUserId = getPortalUserId(accountId);
            } else {
                // Use system_user_id as last resort
                auditUserId = getSystemUserId(accountId);
            }

            const activity = await prisma.activity.create({
                data: {
                    ...activityData,
                    created_by: auditUserId,
                    modified_by: auditUserId,
                } as any,
            });

            return [activity];
        } catch (error) {
            throw this.handleError(error, "createPromiseToPayActivity");
        }
    }

    public async createPromiseToPayScheduledActivity(
        collectionPeriodId: number,
        userId?: string
    ): Promise<void> {
        try {
            const collectionPeriod =
                await prisma.customerCollectionPeriod.findUnique({
                    where: { id: collectionPeriodId },
                    include: {
                        Customer: {
                            include: {
                                Person: true,
                                Company: {
                                    include: {
                                        Contact: {
                                            where: { status: contact_status.Active },
                                            orderBy: [
                                                {
                                                    receives_standard_reminder:
                                                        "desc",
                                                },
                                                {
                                                    receives_escalated_reminder:
                                                        "desc",
                                                },
                                            ],
                                            take: 1,
                                        },
                                    },
                                },
                                Country: true,
                                State: true,
                            },
                        },
                    },
                });

            if (!collectionPeriod) {
                throw new Error("Collection period not found");
            }

            // Cancel non-Promise-to-Pay scheduled activities
            await this.cancelNonPromiseToPayScheduledActivities(
                collectionPeriodId,
                userId
            );

            // Cancel existing Promise_to_pay scheduled activities to prevent duplicates
            // This is necessary when updating an existing Promise to Pay
            // Only cancel activities that don't match the current promise_to_pay_date
            await this.cancelPromiseToPayScheduledActivities(
                collectionPeriodId,
                userId,
                collectionPeriod.promise_to_pay_date
            );

            const customer = collectionPeriod.Customer;

            if (!customer) {
                throw new Error("Customer not found");
            }

            // Fetch Account separately using account_id
            const account = customer.account_id
                ? await prisma.account.findUnique({
                    where: { id: customer.account_id },
                    select: {
                        id: true,
                        name: true,
                        logo: true,
                        sub_domain: true,
                    },
                })
                : null;

            // Fetch ActivitiesSequence separately
            const activitiesSequence = customer.account_id
                ? await prisma.activitiesSequence.findMany({
                    where: {
                        account_id: customer.account_id,
                        category: "Promise_to_pay",
                        active: true,
                    },
                    include: {
                        ActivitiesTemplate: {
                            include: {
                                ActivityTemplateLanguage: true,
                            },
                        },
                    },
                    orderBy: { step: "asc" },
                })
                : [];

            // Attach Account to customer object for compatibility
            const customerWithAccount = {
                ...customer,
                Account: account,
            };

            const sequence = activitiesSequence || [];

            if (!sequence || sequence.length === 0) {
                return;
            }

            await Promise.all(
                sequence.map(async (step: any) => {
                    if (!step?.ActivitiesTemplate) return null;

                    try {
                        if (collectionPeriod.promise_to_pay_date === null) {
                            return null;
                        }

                        const scheduleDate = new Date(
                            collectionPeriod?.promise_to_pay_date
                        );

                        // Get the customer's timezone information
                        const customerCountry =
                            customerWithAccount?.Country?.iso2 ?? undefined;
                        const customerState =
                            customerWithAccount?.State?.iso2 ?? undefined;

                        // Calculate days to add based on activity sequence record
                        // For Promise to Pay activities, all steps use days_from_prev_step
                        const daysToAdd = step.days_from_prev_step ?? 0;

                        // Promise to Pay activities: preserve exact date, don't skip weekends or holidays
                        const scheduleResult = await scheduleDateTime({
                            baseDate: scheduleDate,
                            timeOfDay: step.time_of_day || "09:00",
                            daysToAdd: daysToAdd,
                            countryCode: customerCountry,
                            stateCode: customerState,
                            skipWeekends: true,
                            skipHolidays: true, // Skip weekends and holidays for reminders
                            businessHoursOnly: false,
                            returnUTC: true,
                            preserveInputDate: true,
                        });

                        // Use translation key for promise to pay scheduled activity title
                        const p2pTitle =
                            "{{activities.fields.activity_promise_to_pay_scheduled}}";

                        // Validate that title is not empty
                        if (!p2pTitle || p2pTitle.trim() === "") {
                            await this.logService.logMessage(
                                LogLevel.ERROR,
                                `Cannot create promise to pay scheduled activity: title is empty for step ${step.id}, customer ${customerWithAccount.id}`,
                                "ActivityService.createPromiseToPayScheduledActivity",
                                {
                                    stepId: step.id,
                                    customerId: customerWithAccount.id,
                                    accountId: customerWithAccount.account_id,
                                    collectionPeriodId,
                                }
                            );
                            return null;
                        }

                        // Prepare customer data for language-aware content generation
                        const customerData = {
                            account_id: customerWithAccount.account_id,
                            language: customerWithAccount.language,
                            Country: customerWithAccount.Country,
                            Account: account || {
                                id: customerWithAccount.account_id || 0,
                                name: null,
                                logo: null,
                                sub_domain: null,
                            },
                            Company: customerWithAccount.Company,
                            Person: customerWithAccount.Person,
                            customer_uuid: customerWithAccount.customer_uuid,
                            type: customerWithAccount.type as
                                | "Person"
                                | "Company",
                        };

                        // Generate language-aware content using consolidated helper
                        const { templateContent: p2pContent } =
                            await this.generateLanguageAwareContent(
                                step.ActivitiesTemplate,
                                customerData as any,
                                step.activity_type
                            );

                        // Validate that content is not empty before creating activity
                        if (!p2pContent || p2pContent.trim() === "") {
                            await this.logService.logMessage(
                                LogLevel.WARNING,
                                `Skipping promise to pay scheduled activity creation: template content is empty for template ${step.ActivitiesTemplate.id}, activity type ${step.activity_type}, customer ${customerWithAccount.id}`,
                                "ActivityService.createPromiseToPayScheduledActivity",
                                {
                                    templateId: step.ActivitiesTemplate.id,
                                    activityType: step.activity_type,
                                    customerId: customerWithAccount.id,
                                    accountId: customerWithAccount.account_id,
                                    collectionPeriodId,
                                    resolvedLanguage: customerData.language,
                                }
                            );
                            return null;
                        }

                        // Calculate contact count and time for title_params
                        const companyContacts =
                            customerWithAccount?.Company?.Contact ?? [];
                        const filteredContacts =
                            companyContacts.length > 0
                                ? companyContacts
                                : customerWithAccount?.email
                                    ? [{ id: 0 }]
                                    : [];
                        const contactCount = filteredContacts.length;
                        const contactDisplay = contactCount.toString();
                        const timeDisplay =
                            scheduleResult.scheduledTime.toISOString();

                        // Set audit fields - use system_user_id for system-generated scheduled activities
                        const accountId =
                            customerWithAccount.Account?.id ||
                            customerWithAccount.account_id;
                        const systemUserId = getSystemUserId(accountId);
                        const activity = await prisma.activity.create({
                            data: {
                                customer_id: customerWithAccount.id,
                                collection_period_id: collectionPeriodId,
                                type: "Promise_to_pay" as activity_type,
                                title: p2pTitle,
                                content: p2pContent,
                                schedule_time: scheduleResult.scheduledTime,
                                status: ActivityStatus.SCHEDULED,
                                account_id: accountId,
                                system_generated: true,
                                activity_sequence_id: step.id,
                                activity_template: step.ActivitiesTemplate.id,
                                title_params: {
                                    contacts: contactDisplay,
                                    time: timeDisplay,
                                    userId: userId || "system", // Use actual user ID or fallback to system
                                },
                                created_by: systemUserId,
                                modified_by: systemUserId,
                            } as any,
                        });

                        if (filteredContacts.length === 0) {
                            return activity;
                        }

                        await this.createActivityContacts(
                            activity.id,
                            filteredContacts,
                            "Scheduled",
                            step.activity_type
                        );

                        return activity;
                    } catch {
                        return null;
                    }
                })
            );
        } catch (error) {
            throw this.handleError(error, "createPromiseToPayActivity");
        }
    }

    /**
     * When an invoice last payment date is set: cancel prior SCHEDULED PTP rows for this invoice,
     * log a COMPLETED Promise_to_pay entry, and create Promise_to_pay sequence steps scheduled
     * from that date (same rules as collection-period PTP scheduling).
     */
    public async syncInvoiceLastPaymentPromiseActivities(params: {
        invoiceId: number;
        customerId: number;
        accountId: number;
        paymentDateUtc: Date;
        userId?: string | null;
    }): Promise<void> {
        try {
            const paymentDateYmd = moment
                .utc(params.paymentDateUtc)
                .format("YYYY-MM-DD");

            await prisma.activity.updateMany({
                where: {
                    invoice_id: params.invoiceId,
                    type: "Promise_to_pay",
                    status: ActivityStatus.SCHEDULED,
                },
                data: {
                    status: ActivityStatus.CANCELLED,
                    status_reason: "Updated invoice last payment date",
                    modified_at: new Date(),
                },
            });

            const customerFull = await prisma.customer.findUnique({
                where: { id: params.customerId },
                include: {
                    Country: true,
                    State: true,
                    Person: true,
                    Company: {
                        include: {
                            Contact: {
                                where: { status: contact_status.Active },
                                orderBy: [
                                    {
                                        receives_standard_reminder: "desc",
                                    },
                                    {
                                        receives_escalated_reminder: "desc",
                                    },
                                ],
                            },
                        },
                    },
                    Contact: {
                        where: { status: contact_status.Active },
                        orderBy: [
                            { receives_standard_reminder: "desc" },
                            { receives_escalated_reminder: "desc" },
                        ],
                    },
                },
            });

            if (!customerFull) {
                throw new Error("Customer not found");
            }

            const account = await prisma.account.findUnique({
                where: { id: params.accountId },
                select: {
                    id: true,
                    name: true,
                    logo: true,
                    sub_domain: true,
                },
            });

            const customerWithAccount = {
                ...customerFull,
                Account: account,
            };

            await prisma.activity.create({
                data: {
                    customer_id: params.customerId,
                    account_id: params.accountId,
                    invoice_id: params.invoiceId,
                    type: "Promise_to_pay",
                    title: "{{activities.fields.activity_promise_to_pay_logged}}",
                    content: paymentDateYmd,
                    schedule_time: params.paymentDateUtc,
                    status: ActivityStatus.COMPLETED,
                    system_generated: true,
                    title_params: {
                        userId: params.userId ?? null,
                        date: params.paymentDateUtc.toISOString(),
                    },
                    created_by: params.userId ?? null,
                    modified_by: params.userId ?? null,
                } as any,
            });

            const sequence = await prisma.activitiesSequence.findMany({
                where: {
                    account_id: params.accountId,
                    category: "Promise_to_pay",
                    active: true,
                },
                include: {
                    ActivitiesTemplate: {
                        include: {
                            ActivityTemplateLanguage: true,
                        },
                    },
                },
                orderBy: { step: "asc" },
            });

            if (!sequence.length) {
                return;
            }

            const companyContacts =
                customerWithAccount.Company?.Contact ?? [];
            const directContacts = customerWithAccount.Contact ?? [];
            const filteredContacts =
                companyContacts.length > 0 ? companyContacts : directContacts;

            const scheduleDate = new Date(params.paymentDateUtc);

            await Promise.all(
                sequence.map(async (step: any) => {
                    if (!step?.ActivitiesTemplate) {
                        return null;
                    }

                    try {
                        const customerCountry =
                            customerWithAccount.Country?.iso2 ?? undefined;
                        const customerState =
                            customerWithAccount.State?.iso2 ?? undefined;
                        const daysToAdd = step.days_from_prev_step ?? 0;

                        const scheduleResult = await scheduleDateTime({
                            baseDate: scheduleDate,
                            timeOfDay: step.time_of_day || "09:00",
                            daysToAdd,
                            countryCode: customerCountry,
                            stateCode: customerState,
                            skipWeekends: true,
                            skipHolidays: true,
                            businessHoursOnly: false,
                            returnUTC: true,
                            preserveInputDate: true,
                        });

                        const p2pTitle =
                            "{{activities.fields.activity_promise_to_pay_scheduled}}";

                        const customerData = {
                            account_id: customerWithAccount.account_id,
                            language: customerWithAccount.language,
                            Country: customerWithAccount.Country,
                            Account: account || {
                                id: customerWithAccount.account_id || 0,
                                name: null,
                                logo: null,
                                sub_domain: null,
                            },
                            Company: customerWithAccount.Company,
                            Person: customerWithAccount.Person,
                            customer_uuid: customerWithAccount.customer_uuid,
                            type: customerWithAccount.type as
                                | "Person"
                                | "Company",
                        };

                        const { templateContent: p2pContent } =
                            await this.generateLanguageAwareContent(
                                step.ActivitiesTemplate,
                                customerData as any,
                                step.activity_type
                            );

                        if (!p2pContent?.trim()) {
                            return null;
                        }

                        const contactDisplay = String(filteredContacts.length);
                        const timeDisplay =
                            scheduleResult.scheduledTime.toISOString();

                        const accountIdResolved =
                            customerWithAccount.Account?.id ??
                            customerWithAccount.account_id;
                        const systemUserId = getSystemUserId(accountIdResolved);

                        const activity = await prisma.activity.create({
                            data: {
                                customer_id: customerWithAccount.id,
                                collection_period_id: null,
                                invoice_id: params.invoiceId,
                                type: "Promise_to_pay" as activity_type,
                                title: p2pTitle,
                                content: p2pContent,
                                schedule_time: scheduleResult.scheduledTime,
                                status: ActivityStatus.SCHEDULED,
                                account_id: accountIdResolved,
                                system_generated: true,
                                activity_sequence_id: step.id,
                                activity_template: step.ActivitiesTemplate.id,
                                title_params: {
                                    contacts: contactDisplay,
                                    time: timeDisplay,
                                    userId: params.userId || "system",
                                    invoice_id: params.invoiceId,
                                },
                                created_by: systemUserId,
                                modified_by: systemUserId,
                            } as any,
                        });

                        if (filteredContacts.length === 0) {
                            return activity;
                        }

                        await prisma.activityContact.createMany({
                            data: filteredContacts.map((c: { id: number }) => ({
                                activity_id: activity.id,
                                contact_id: c.id,
                                status: delivery_status.Scheduled,
                                communication_channel: step.activity_type,
                            })),
                            skipDuplicates: true,
                        });

                        return activity;
                    } catch {
                        return null;
                    }
                })
            );
        } catch (error) {
            throw this.handleError(error, "syncInvoiceLastPaymentPromiseActivities");
        }
    }

    public async createScheduledDisputeResolvedActivity(disputeId: number) {
        try {
            const dispute = await prisma.customerDispute.findUnique({
                where: { id: disputeId },
                include: {
                    Customer: {
                        include: {
                            Country: true,
                            Person: true,
                            Company: {
                                include: {
                                    Contact: true,
                                },
                            },
                        },
                    },
                },
            });

            if (!dispute) {
                throw new Error("Dispute not found");
            }

            const customer = dispute.Customer;

            if (!customer) {
                throw new Error("Customer not found");
            }

            // Fetch Account separately using account_id
            const account = customer.account_id
                ? await prisma.account.findUnique({
                    where: { id: customer.account_id },
                    select: {
                        id: true,
                        name: true,
                        logo: true,
                        sub_domain: true,
                    },
                })
                : null;

            // Attach Account to customer object for compatibility
            const customerWithAccount = {
                ...customer,
                Account: account,
            };

            if (!dispute.customer_collection_period_id) {
                throw new Error("Collection period not found");
            }

            if (!dispute.dispute_resolution) {
                throw new Error("Dispute resolution not found");
            }

            // Skip email creation for cancelled disputes
            if (dispute.dispute_resolution === "Cancelled") {
                return;
            }

            const sequence = await prisma.activitiesSequence.findFirst({
                where: {
                    account_id: customerWithAccount.account_id,
                    category: "Dispute",
                    active: true,
                    ActivitiesTemplate: {
                        dispute_resolution: dispute.dispute_resolution,
                    },
                },
                include: {
                    ActivitiesTemplate: {
                        include: {
                            ActivityTemplateLanguage: true,
                        },
                    },
                },
            });

            if (!sequence) {
                // No activity sequence found for dispute resolution
                // This is expected when no custom dispute resolution templates are configured
                return;
            }

            if (!sequence.ActivitiesTemplate) {
                // No activity template found for sequence
                return;
            }

            // Get contacts based on customer type
            const contacts =
                customerWithAccount.type === "Company"
                    ? customerWithAccount.Company?.Contact || []
                    : customerWithAccount.email
                        ? [
                            {
                                id: 0,
                                email: customerWithAccount.email,
                                mobile:
                                    customerWithAccount.Person?.mobile || null,
                                first_name:
                                    customerWithAccount.Person?.first_name ||
                                    null,
                                company_wide_address: false,
                                receives_escalated_reminder: false,
                                receives_standard_reminder: false,
                            },
                        ]
                        : [];

            const filteredContacts = this.filterContactsBySequence(contacts, {
                send_to_standard_contacts:
                    sequence.send_to_standard_contacts || false,
                send_to_escalated_contacts:
                    sequence.send_to_escalated_contacts || false,
            });

            if (filteredContacts.length === 0) {
                // No contacts found for customer
                return;
            }

            const template = sequence.ActivitiesTemplate;

            // Prepare customer data for language-aware content generation
            const customerData = {
                account_id: customerWithAccount.account_id,
                language: customerWithAccount.language,
                Country: customerWithAccount.Country,
                Account: account || {
                    id: customerWithAccount.account_id || 0,
                    name: null,
                    logo: null,
                    sub_domain: null,
                },
                Company: customerWithAccount.Company,
                Person: customerWithAccount.Person,
                customer_uuid: customerWithAccount.customer_uuid,
                type: customerWithAccount.type as "Person" | "Company",
            };

            // Generate language-aware content using consolidated helper
            const { templateContent: disputeContent } =
                await this.generateLanguageAwareContent(
                    template,
                    customerData as any,
                    sequence.activity_type
                );

            // Get the user who resolved the dispute
            const resolvedByUserId = dispute.modified_by || "System";

            // Use translation key for title instead of email subject
            const disputeTitle =
                "{{activities.fields.activity_dispute_resolution_email_sent}}";

            // Prepare titleParams for title formatting
            // formatTitleForDisplay will translate the resolution value automatically
            const titleParams = {
                userId: resolvedByUserId,
                resolution: dispute.dispute_resolution,
            };

            const activity = await prisma.activity.create({
                data: {
                    customer_id: customerWithAccount.id,
                    collection_period_id: dispute.customer_collection_period_id,
                    type: sequence.activity_type,
                    title: disputeTitle,
                    title_params: titleParams as any,
                    content: disputeContent,
                    schedule_time: new Date(),
                    status: ActivityStatus.SCHEDULED,
                    account_id:
                        customerWithAccount.Account?.id ||
                        customerWithAccount.account_id,
                    activity_sequence_id: sequence.id,
                    activity_template: sequence.ActivitiesTemplate.id,
                    system_generated: true,
                },
            });

            await this.createActivityContacts(
                activity.id,
                filteredContacts,
                "Scheduled",
                sequence.activity_type
            );
        } catch (error) {
            throw this.handleError(
                error,
                "createScheduledDisputeResolvedActivity"
            );
        }
    }

    /* ********** CREATE AUTOMATED ACTIVITY ********** */
    public async createAutomatedActivity(
        collectionPeriod: {
            id: number;
            customer_id: number;
            last_automated_step: number | null;
            period_start_date: Date;
            Customer: {
                account_id: number;
                type: "Person" | "Company";
                email: string | null;
                customer_uuid: string;
                language: string | null;
                Person: {
                    mobile: string | null;
                    first_name: string | null;
                } | null;
                Company: {
                    name: string;
                    Contact: Array<{
                        id: number;
                        email: string | null;
                        mobile: string | null;
                        status: import("@prisma/client").contact_status | null;
                        first_name: string;

                        company_wide_address: boolean | null;
                        receives_standard_reminder: boolean | null;
                        receives_escalated_reminder: boolean | null;
                    }>;
                } | null;
                Country: {
                    id: number;
                    iso2: string | null;
                } | null;
                State: {
                    iso2: string | null;
                } | null;
                // Note: Account removed from Customer type since Customer doesn't have Account relation
                // Account will be fetched separately using customer.account_id
            };
        },
        nextSequence: {
            id: number;
            step: number;
            activity_type: Activity["type"];
            time_of_day: string | null;
            last_category_step: boolean;
            send_to_standard_contacts: boolean;
            send_to_escalated_contacts: boolean;
            days_from_prev_step?: number | null;
            ActivitiesTemplate?: {
                id: number;
                // sms_content/email_content/whatsapp_content/email_subject removed from ActivitiesTemplate;
                // content now lives exclusively in ActivityTemplateLanguage
                ActivityTemplateLanguage?: Array<{
                    language: string;
                    email_subject: string | null;
                    email_content: string | null;
                    sms_content: string | null;
                    whatsapp_content: string | null;
                }>;
            } | null;
        },
        nextActivityDate: { scheduledTime: Date; calculation: string } | null,
        nextActivityCalculation?: string // Add this parameter
    ): Promise<Activity> {
        const startTime = Date.now();
        let activity: Activity | null = null;
        const logDetails: any = {
            collectionPeriodId: collectionPeriod.id,
            customerId: collectionPeriod.customer_id,
            accountId: collectionPeriod.Customer.account_id,
            sequenceId: nextSequence.id,
            sequenceStep: nextSequence.step,
            activityType: nextSequence.activity_type,
        };

        try {
            // Step 1: Get all contacts for the customer
            // First, get contacts from main Contact table
            const mainContacts = await prisma.contact.findMany({
                where: { customer_id: collectionPeriod.customer_id },
                select: {
                    id: true,
                    email: true,
                    mobile: true,
                    first_name: true,
                    last_name: true,
                    company_wide_address: true,
                    receives_escalated_reminder: true,
                    receives_standard_reminder: true,
                },
            });

            // Then get contacts from type-specific sources
            const typeSpecificContacts =
                collectionPeriod.Customer.type === "Company"
                    ? collectionPeriod.Customer.Company?.Contact || []
                    : collectionPeriod.Customer.email
                        ? [
                            {
                                id: 0,
                                email: collectionPeriod.Customer.email,
                                mobile:
                                    collectionPeriod.Customer.Person?.mobile ||
                                    null,
                                first_name:
                                    collectionPeriod.Customer.Person
                                        ?.first_name || null,
                                last_name: null,
                                company_wide_address: false,
                                receives_escalated_reminder: false,
                                receives_standard_reminder: false,
                            },
                        ]
                        : [];

            // Combine all contacts (main contacts take priority)
            const contacts = [...mainContacts, ...typeSpecificContacts];
            logDetails.totalContactsRetrieved = contacts.length;
            logDetails.mainContactsCount = mainContacts.length;
            logDetails.typeSpecificContactsCount = typeSpecificContacts.length;

            if (contacts.length === 0) {
                throw new Error(
                    `No contacts found for customer ${collectionPeriod.customer_id}`
                );
            }

            // Step 2: Filter contacts by sequence
            const filteredContacts = this.filterContactsBySequence(
                contacts,
                nextSequence
            );
            logDetails.filteredContactsCount = filteredContacts.length;

            if (filteredContacts.length === 0) {
                throw new Error(
                    `No contacts found for customer ${collectionPeriod.customer_id} after filtering`
                );
            }

            // CRITICAL CHECK: Verify SMS capability if this is an SMS step
            // This ensures automation gets "stuck" if SMS is blocked, rather than creating an invalid activity
            if (nextSequence.activity_type === "SMS") {
                const countryId = collectionPeriod.Customer.Country?.id;
                const accountId = collectionPeriod.Customer.account_id;

                if (!countryId) {
                    throw new Error(
                        `No contacts found: Customer country is required for SMS activities (Customer: ${collectionPeriod.customer_id})`
                    );
                }

                const smsVendorService = new SMSVendorService();
                const isBlocked =
                    await smsVendorService.isSMSBlockedForCustomerCountry(
                        accountId,
                        countryId
                    );

                if (isBlocked) {
                    throw new Error(
                        `No contacts found: SMS is blocked for country ID ${countryId}. Please add country mapping to enable SMS.`
                    );
                }
            }

            if (!nextSequence.ActivitiesTemplate) {
                throw new Error(
                    `No activity template found for customer ${collectionPeriod.customer_id}`
                );
            }

            // Step 3: Use the already calculated schedule time (don't recalculate)
            const schedule_time =
                nextActivityDate?.scheduledTime ??
                collectionPeriod.period_start_date;

            // Only apply time of day if we don't have a calculated schedule time
            if (nextSequence.time_of_day && !nextActivityDate) {
                const [hours, minutes] = nextSequence.time_of_day
                    .split(":")
                    .map(Number);
                schedule_time.setUTCHours(hours, minutes, 0, 0);
            }
            logDetails.scheduleTime = schedule_time.toISOString();
            logDetails.scheduleCalculation =
                nextActivityDate?.calculation ||
                nextActivityCalculation ||
                null;
            logDetails.timeOfDayApplied = !!(
                nextSequence.time_of_day && !nextActivityDate
            );

            // Step 4: Generate language-aware content using consolidated helper
            // Fetch Account separately since Customer doesn't have Account relation
            const accountId = collectionPeriod.Customer.account_id;
            const account = accountId
                ? await prisma.account.findUnique({
                    where: { id: accountId },
                    select: {
                        id: true,
                        name: true,
                        logo: true,
                        sub_domain: true,
                    },
                })
                : null;

            if (!account) {
                throw new Error(
                    `Account not found for customer ${collectionPeriod.Customer.account_id}`
                );
            }

            const customerData = {
                ...collectionPeriod.Customer,
                Account: account,
            };
            const { templateContent: resolvedContent } =
                await this.generateLanguageAwareContent(
                    nextSequence.ActivitiesTemplate,
                    customerData as any,
                    nextSequence.activity_type
                );
            // Content is already language-aware and placeholders replaced in helper
            const content = resolvedContent;

            // Step 5: Create the activity
            // Generate proper automated step title with parameters
            const stepNumber = nextSequence.step?.toString() || "1";

            // Get the contact count (just the number, not "X contacts")
            let contactDisplay = "0";
            if (filteredContacts && filteredContacts.length > 0) {
                contactDisplay = filteredContacts.length.toString();
            }

            const timeDisplay = schedule_time.toISOString();

            activity = await this.createActivityWithFormattedDescription({
                customer_id: collectionPeriod.customer_id,
                collection_period_id: collectionPeriod.id,
                type: nextSequence.activity_type,
                title: "{{activities.fields.activity_automated_step_scheduled}}",
                titleParams: {
                    step: stepNumber.toString(),
                    contacts: contactDisplay,
                    time: timeDisplay,
                },
                account_id: collectionPeriod.Customer.account_id,
                schedule_time,
                systemGenerated: true,
                content: content,
            });

            // Store calculation details in the database

            // Update the activity with additional fields that createActivityWithFormattedDescription doesn't handle
            await prisma.activity.update({
                where: { id: activity.id },
                data: {
                    is_last_step: nextSequence.last_category_step,
                    activity_sequence_id: nextSequence.id,
                    activity_template:
                        nextSequence.ActivitiesTemplate?.id || null,
                    status: ActivityService.getActivityScheduleStatusIDByType(
                        nextSequence.activity_type
                    ),
                    schedule_time:
                        nextActivityDate?.scheduledTime ||
                        activity.schedule_time,
                    schedule_calculation:
                        nextActivityDate?.calculation ||
                        nextActivityCalculation ||
                        "",
                },
            });
            logDetails.activityId = activity.id.toString();
            logDetails.isLastStep = nextSequence.last_category_step;
            logDetails.activityTemplateId =
                nextSequence.ActivitiesTemplate?.id || null;

            // Step 6: Create ActivityContact records for all contacts
            let activityContactsSummary: {
                totalContacts: number;
                newContactsCreated: number;
                duplicatesSkipped: number;
                allContactsExisted: boolean;
            } | null = null;
            if (filteredContacts.length > 0) {
                activityContactsSummary = await this.createActivityContacts(
                    activity.id,
                    filteredContacts,
                    "Scheduled",
                    nextSequence.activity_type
                );
                // Handle case where createActivityContacts might return undefined (defensive)
                if (activityContactsSummary) {
                    logDetails.activityContactsCreated =
                        activityContactsSummary.newContactsCreated;
                    logDetails.activityContactsTotal =
                        activityContactsSummary.totalContacts;
                    logDetails.activityContactsDuplicatesSkipped =
                        activityContactsSummary.duplicatesSkipped;
                    logDetails.allContactsExisted =
                        activityContactsSummary.allContactsExisted;
                } else {
                    logDetails.activityContactsCreated =
                        filteredContacts.length;
                    logDetails.activityContactsTotal = filteredContacts.length;
                    logDetails.activityContactsDuplicatesSkipped = 0;
                    logDetails.allContactsExisted = false;
                }
            } else {
                logDetails.activityContactsCreated = 0;
                logDetails.activityContactsTotal = 0;
                logDetails.activityContactsDuplicatesSkipped = 0;
                logDetails.allContactsExisted = false;
            }

            // Single comprehensive log entry with all relevant information
            const duration = Date.now() - startTime;
            await this.logService.logMessage(
                LogLevel.INFO,
                `Automated activity created: ${activity.id} (step ${nextSequence.step}, ${filteredContacts.length} contacts, ${activityContactsSummary?.newContactsCreated || 0} created)`,
                "ActivityService.createAutomatedActivity",
                {
                    ...logDetails,
                    duration,
                    success: true,
                }
            );

            return activity;
        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            // Get correlation ID if available (from cron job context)
            const correlationId = LogService.getContext();

            // Log comprehensive error with all collected context
            await this.logService.logMessage(
                LogLevel.ERROR,
                `createAutomatedActivity failed: ${errorMessage}`,
                "ActivityService.createAutomatedActivity",
                {
                    ...logDetails,
                    duration,
                    success: false,
                    error: errorMessage,
                    stack: errorStack,
                    activityId: activity?.id?.toString() || null,
                },
                logDetails.accountId,
                undefined, // userId
                undefined, // jobId (will be set by activityWorkflowManager)
                correlationId || undefined
            );

            throw this.handleError(error, "createAutomatedActivity");
        }
    }

    /* ********** CREATE ACTIVITY CONTACT ********** */
    public async createActivityContacts(
        activity_id: bigint,
        contacts: Array<{
            id: number;
        }>,
        status: delivery_status,
        communication_channel?: activity_type,
        dbClient: DbClient = prisma
    ): Promise<{
        totalContacts: number;
        newContactsCreated: number;
        duplicatesSkipped: number;
        allContactsExisted: boolean;
    }> {
        try {
            // Check for existing ActivityContact records to prevent duplicates
            const existingContacts = await dbClient.activityContact.findMany({
                where: {
                    activity_id,
                    contact_id: {
                        in: contacts.map((contact) => contact.id),
                    },
                },
                select: {
                    contact_id: true,
                },
            });

            const existingContactIds = new Set(
                existingContacts.map((ac: any) => ac.contact_id)
            );
            const newContacts = contacts.filter(
                (contact) => !existingContactIds.has(contact.id)
            );

            if (newContacts.length === 0) {
                return {
                    totalContacts: contacts.length,
                    newContactsCreated: 0,
                    duplicatesSkipped: contacts.length,
                    allContactsExisted: true,
                };
            }

            const result = await dbClient.activityContact.createMany({
                data: newContacts.map((contact) => ({
                    activity_id,
                    contact_id: contact.id,
                    status,
                    communication_channel,
                })),
            });

            return {
                totalContacts: contacts.length,
                newContactsCreated: result.count,
                duplicatesSkipped: contacts.length - newContacts.length,
                allContactsExisted: false,
            };
        } catch (error) {
            // Log error but also throw to maintain error handling
            await this.logService.logMessage(
                LogLevel.ERROR,
                `createActivityContacts failed: ${(error as Error).message}`,
                "ActivityService.createActivityContacts",
                {
                    activity_id: activity_id.toString(),
                    contactsCount: contacts.length,
                }
            );

            throw this.handleError(error, "createActivityContacts");
        }
    }

    /* ********** UPDATE ACTIVITY CONTACT ********** */
    public async updateActivityContactStatus(
        id: number,
        status: delivery_status
    ) {
        try {
            await prisma.activityContact.update({
                where: { id },
                data: { status },
            });
        } catch (error) {
            throw this.handleError(error, "updateActivityContactStatus");
        }
    }

    /* ********** UPDATE ACTIVITY CONTACT STATUS BY MESSAGE ID ********** */
    public async updateActivityContactStatusByMessageId(
        message_id: string,
        status: delivery_status
    ) {
        try {
            const activityContacts = await prisma.activityContact.findFirst({
                where: { message_id },
                select: {
                    id: true,
                    activity_id: true,
                    Activity: {
                        select: {
                            status: true,
                            type: true,
                        },
                    },
                },
            });

            if (!activityContacts) {
                throw new Error("Activity contact not found");
            }

            await prisma.activityContact.update({
                where: { id: activityContacts.id },
                data: { status: status },
            });

            // Update activity status if email is scheduled or not delivered
            if (
                activityContacts.Activity.type === "Email" &&
                (activityContacts.Activity.status ===
                    ActivityStatus.SCHEDULED ||
                    activityContacts.Activity.status !==
                    ActivityStatus.DELIVERED)
            ) {
                const activityStatus =
                    status === "Delivered"
                        ? ActivityStatus.DELIVERED
                        : ActivityStatus.BOUNCED;

                await prisma.activity.update({
                    where: { id: activityContacts.activity_id },
                    data: { status: activityStatus },
                });
            }
        } catch (error) {
            throw this.handleError(
                error,
                "updateActivityContactStatusByMessageId"
            );
        }
    }

    /* ********** UPDATE ACTIVITY TITLE ********** */
    /**
     * Update activity title with proper translation key formatting
     */
    public async updateActivityTitle(
        activityId: number,
        title: string,
        titleParams?: any,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        translate?: (key: string) => string,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        locale?: string
    ): Promise<Activity> {
        try {
            // Ensure title has proper {{}} format if it's a translation key
            let formattedTitle = title;
            if (title.includes(".") && !title.startsWith("{{")) {
                formattedTitle = `{{${title}}}`;
            }

            const modified_ata: any = {
                title: formattedTitle,
                modified_at: new Date(),
            };

            if (titleParams) {
                modified_ata.title_params = titleParams;
            }

            const updatedActivity = await prisma.activity.update({
                where: { id: activityId },
                data: modified_ata,
            });

            return updatedActivity;
        } catch (error) {
            throw this.handleError(error, "updateActivityTitle");
        }
    }

    /* ********** CREATE ACTIVITY FOR ASSIGN USER TO DISPUTE ********** */
    public async createAssignUserToDisputeActivity(params: {
        customerId: number;
        accountId: number;
        collectionPeriodId: number;
        assigneeId: string;
        assigneeName: string;
        userName: string;
        assignedBy: string;
        userComment?: string;
        disputeId?: number;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        translate?: (key: string) => string;
    }): Promise<Activity> {
        try {
            if (!params.customerId) {
                throw new Error("customerId is required");
            }
            if (!params.accountId) {
                throw new Error("accountId is required");
            }
            if (!params.assigneeId) {
                throw new Error("assigneeId is required");
            }
            if (!params.assigneeName) {
                throw new Error("assigneeName is required");
            }
            if (!params.userName) {
                throw new Error("userName is required");
            }

            const activityParams = {
                customer_id: params.customerId,
                collection_period_id: params.collectionPeriodId,
                type: "Dispute" as activity_type,
                title: "{{disputes.fields.assigned}}",
                titleParams: {
                    disputeId: (params.disputeId || 0).toString(),
                    userId: params.assignedBy,
                    assigneeId: params.assigneeId,
                },
                comment: params.userComment || "",
                assigneeName: params.assigneeName,
                assignedBy: params.userName,
                assignedById: params.assignedBy,
                assigneeId: params.assigneeId,
                disputeId: params.disputeId,
                account_id: params.accountId,
                actual_delivery_time: new Date(),
                schedule_time: new Date(),
                status: ActivityStatus.COMPLETED,
                // translated at display time
            };

            const result =
                await this.createActivityWithFormattedDescription(
                    activityParams
                );

            return result;
        } catch (error) {
            throw this.handleError(error, "createAssignUserToDisputeActivity");
        }
    }

    /* ********** CREATE EMAIL ACTIVITY ********** */
    public async createEmailActivity(params: {
        customerId: number;
        accountId: number;
        collectionPeriodId: number;
        emailSubject: string;
        emailBody: string;
        recipientEmail: string;
        recipientName: string;
        messageId: string;
        activityType: string;
    }): Promise<Activity> {
        try {
            const activityData = {
                customer_id: params.customerId,
                collection_period_id: params.collectionPeriodId,
                type: "Email" as activity_type,
                title: params.emailSubject,
                content: params.emailBody,
                schedule_time: new Date(),
                actual_delivery_time: new Date(),
                status: ActivityStatus.DELIVERED,
                account_id: params.accountId,
                system_generated: true,
                created_by: getSystemUserId(params.accountId),
                modified_by: getSystemUserId(params.accountId),
            };

            const savedActivity = await prisma.activity.create({
                data: activityData,
            });

            return savedActivity;
        } catch (error) {
            throw this.handleError(error, "createEmailActivity");
        }
    }

    /* ********** CREATE AUTOMATED SCHEDULED ACTIVITIES ********** */
    public async createAutomatedScheduledActivities(
        collection_period_id: number
    ): Promise<void> {
        try {
            const collectionPeriod =
                await prisma.customerCollectionPeriod.findUnique({
                    where: { id: collection_period_id },
                    select: {
                        id: true,
                        customer_id: true,
                        last_automated_step: true,
                        period_start_date: true,
                        Customer: {
                            select: {
                                account_id: true,
                                type: true,
                                email: true,
                                customer_uuid: true,
                                language: true,
                                sequence_container_id: true,
                                Person: {
                                    select: {
                                        mobile: true,
                                        first_name: true,
                                    },
                                },
                                Company: {
                                    select: {
                                        name: true,
                                        Contact: {
                                            select: {
                                                id: true,
                                                email: true,
                                                mobile: true,
                                                status: true,
                                                first_name: true,
                                                company_wide_address: true,
                                                receives_standard_reminder: true,
                                                receives_escalated_reminder: true,
                                            },
                                        },
                                    },
                                },
                                Country: {
                                    select: {
                                        id: true,
                                        iso2: true,
                                    },
                                },
                                State: {
                                    select: {
                                        iso2: true,
                                    },
                                },
                                // Note: Account removed from Customer select since Customer doesn't have Account relation
                                // Fetch Account separately using customer.account_id if needed
                            },
                        },
                    },
                });

            if (!collectionPeriod)
                throw new Error("Collection period not found");

            // Get the sequence container ID - use customer's specific sequence or fall back to customer's default
            const sequenceContainerId =
                collectionPeriod.Customer.sequence_container_id ||
                (await prisma.sequenceContainer
                    .findFirst({
                        where: {
                            account_id: collectionPeriod.Customer.account_id,
                            category: "Automated",
                            is_default: true,
                            active: true,
                        },
                        select: { id: true },
                    })
                    .then((container) => container?.id)) ||
                null;

            const nextSequence = await prisma.activitiesSequence.findFirst({
                where: {
                    active: true,
                    category: "Automated",
                    account_id: collectionPeriod.Customer.account_id,
                    step: (collectionPeriod.last_automated_step ?? 0) + 1,
                    sequence_container_id: sequenceContainerId,
                    OR: [{ step_type: null }, { step_type: "overdue" }],
                },
                include: {
                    ActivitiesTemplate: {
                        include: {
                            ActivityTemplateLanguage: true,
                        },
                    },
                },
            });

            if (!nextSequence) return;

            await this.createAutomatedActivity(
                collectionPeriod,
                {
                    id: nextSequence.id,
                    step: nextSequence.step || 1,
                    activity_type: nextSequence.activity_type,
                    time_of_day: nextSequence.time_of_day,
                    last_category_step: nextSequence.last_category_step,
                    send_to_standard_contacts:
                        nextSequence.send_to_standard_contacts ?? false,
                    send_to_escalated_contacts:
                        nextSequence.send_to_escalated_contacts ?? false,
                    ActivitiesTemplate: nextSequence.ActivitiesTemplate
                        ? {
                            id: nextSequence.ActivitiesTemplate.id,
                            // email_subject/email_content/sms_content/whatsapp_content removed from ActivitiesTemplate
                            ActivityTemplateLanguage:
                                nextSequence.ActivitiesTemplate
                                    .ActivityTemplateLanguage,
                        }
                        : undefined,
                },
                null,
                undefined
            );

            await prisma.customerCollectionPeriod.update({
                where: { id: collection_period_id },
                data: {
                    last_automated_step: nextSequence.step,
                    create_next_activity: false,
                },
            });
        } catch (error) {
            throw this.handleError(error, "createAutomatedScheduledActivities");
        }
    }

    private filterContactsBySequence(
        contacts:
            | Array<{
                id: number;
                receives_standard_reminder: boolean | null;
                receives_escalated_reminder: boolean | null;
            }>
            | undefined,
        sequence: {
            send_to_standard_contacts: boolean;
            send_to_escalated_contacts: boolean;
        }
    ): Array<{
        id: number;
    }> {
        if (!contacts) return [];

        const filteredContacts = [];
        const addedContactIds = new Set<number>(); // Track added contact IDs to prevent duplicates

        for (const contact of contacts) {
            // Check if contact should be included for standard reminders
            // Explicitly check for true to handle null values correctly
            const shouldIncludeStandard =
                sequence.send_to_standard_contacts &&
                contact.receives_standard_reminder === true;

            // Check if contact should be included for escalated reminders
            // Explicitly check for true to handle null values correctly
            const shouldIncludeEscalated =
                sequence.send_to_escalated_contacts &&
                contact.receives_escalated_reminder === true;

            // Include contact if they match either criteria AND haven't been added yet
            if (
                (shouldIncludeStandard || shouldIncludeEscalated) &&
                !addedContactIds.has(contact.id)
            ) {
                filteredContacts.push(contact);
                addedContactIds.add(contact.id); // Mark as added to prevent duplicates
            }
        }

        return filteredContacts;
    }

    public async hasScheduledAutomatedActivities(
        collectionPeriodIds: number[]
    ): Promise<Map<number, boolean>> {
        try {
            await this.logService.logMessage(
                LogLevel.INFO,
                `Starting hasScheduledAutomatedActivities check for ${collectionPeriodIds.length} collection periods`,
                "ActivityService.hasScheduledAutomatedActivities"
            );

            const activities = await prisma.activity.findMany({
                where: {
                    collection_period_id: { in: collectionPeriodIds },
                    ActivitiesSequence: {
                        category: "Automated",
                    },
                    status: {
                        in: [ActivityStatus.SCHEDULED],
                    },
                },
                select: {
                    collection_period_id: true,
                },
            });

            await this.logService.logMessage(
                LogLevel.INFO,
                `Retrieved ${activities.length} scheduled automated activities`,
                "ActivityService.hasScheduledAutomatedActivities"
            );

            // Create a map of collection period IDs to boolean values
            const activityMap = new Map<number, boolean>();
            collectionPeriodIds.forEach((id) => {
                const hasActivity = activities.some(
                    (activity: any) => activity.collection_period_id === id
                );
                activityMap.set(id, hasActivity);
            });

            await this.logService.logMessage(
                LogLevel.INFO,
                "hasScheduledAutomatedActivities check completed",
                "ActivityService.hasScheduledAutomatedActivities"
            );

            return activityMap;
        } catch (error) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `hasScheduledAutomatedActivities failed: ${(error as Error).message}`,
                "ActivityService.hasScheduledAutomatedActivities"
            );

            throw error;
        }
    }

    /* ********** TRANSLATION UTILITIES ********** */

    /**
     * Translate activity content by replacing translation keys with translated text
     */
    private async translateActivityContent(
        content: string,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        translate?: (key: string) => string,
        locale?: string,
        dateLocale?: string, // Add separate parameter for date formatting locale
        timezone?: string
    ): Promise<string> {
        if (!content) {
            return content;
        }

        let processedContent = content;

        try {
            if (translate) {
                // Step 1: Replace all {{key}} patterns with translated text
                // This handles translation keys everywhere in the content
                processedContent = processedContent.replace(
                    /\{\{([a-zA-Z0-9_.]+)\}\}/g,
                    (match, key) => {
                        try {
                            // Skip special patterns like {{date:...}}, {{dateOnly:...}}, {{user:...}}
                            if (
                                key.startsWith("date:") ||
                                key.startsWith("dateOnly:") ||
                                key.startsWith("user:")
                            ) {
                                return match;
                            }

                            // Handle namespaced keys like "activities.fields.log_activity_comment" or "disputes.fields.reason"
                            // Use explicit ns option so backend t() looks up in the correct namespace (defaultNS is "common")
                            if (key.includes(".") && key.split(".").length >= 3) {
                                const parts = key.split(".");
                                const namespace = parts[0]; // e.g., "activities"
                                const keyPath = parts.slice(1).join("."); // e.g., "fields.log_activity_comment"
                                const tWithNs = translate as (
                                    k: string,
                                    optionsOrDef?: { ns?: string } | string
                                ) => string;

                                // Try namespace:key format first (e.g. "activities:fields.agent") - most reliable in i18next
                                const namespacedKey = `${namespace}:${keyPath}`;
                                let translated = tWithNs(namespacedKey);
                                if (
                                    translated &&
                                    translated !== namespacedKey &&
                                    translated !== keyPath
                                ) {
                                    return translated;
                                }
                                // Fallback: t(keyPath, { ns: namespace })
                                translated = tWithNs(keyPath, { ns: namespace });
                                if (
                                    translated &&
                                    translated !== keyPath &&
                                    translated !== key
                                ) {
                                    return translated;
                                }
                                return translate(key);
                            }

                            return translate(key);
                        } catch {
                            return match;
                        }
                    }
                );

                // Step 2: Handle HTML-specific cases (backward compatibility)
                // Replace keys in <strong> tags
                processedContent = processedContent.replace(
                    /<strong>([a-zA-Z0-9_.]+):<\/strong>/g,
                    (match, key) => {
                        try {
                            const translatedKey = translate(key);
                            return `<strong>${translatedKey}:</strong>`;
                        } catch {
                            return match;
                        }
                    }
                );

                // Step 3: Handle span tags with colons (use namespaced translation like Step 1)
                processedContent = processedContent.replace(
                    /<span[^>]*>\{\{([a-zA-Z0-9_.]+)\}\}:<\/span>/g,
                    (match, key) => {
                        try {
                            const tWithNs = translate as (
                                k: string,
                                optionsOrDef?: { ns?: string } | string
                            ) => string;
                            let translatedKey: string;
                            if (key.includes(".") && key.split(".").length >= 3) {
                                const parts = key.split(".");
                                const namespace = parts[0];
                                const keyPath = parts.slice(1).join(".");
                                // Prefer namespace:key format (e.g. "activities:fields.agent")
                                const namespacedKey = `${namespace}:${keyPath}`;
                                translatedKey = tWithNs(namespacedKey);
                                if (
                                    !translatedKey ||
                                    translatedKey === namespacedKey ||
                                    translatedKey === keyPath
                                ) {
                                    translatedKey = tWithNs(keyPath, {
                                        ns: namespace,
                                    });
                                }
                                if (
                                    !translatedKey ||
                                    translatedKey === keyPath ||
                                    translatedKey === key
                                ) {
                                    translatedKey = translate(key);
                                }
                            } else {
                                translatedKey = translate(key);
                            }
                            return match.replace(
                                `{{${key}}}:`,
                                `${translatedKey}:`
                            );
                        } catch {
                            return match;
                        }
                    }
                );

                // 4. Replace {{user:value}} with user names (value can be userId or legacy name)
                // Match any characters inside {{user:...}} to support existing content with {{user:Hebrew name}}
                const userMatches = processedContent.match(
                    /\{\{user:([^}]+)\}\}/g
                );

                if (userMatches) {
                    const { findUserById } = await import(
                        "@/server/services/UserService"
                    );
                    for (const match of userMatches) {
                        const value = match.replace(/\{\{user:([^}]+)\}\}/, "$1");
                        try {
                            const user = await findUserById(value);
                            if (user) {
                                let userName =
                                    user.first_name && user.last_name
                                        ? `${user.first_name} ${user.last_name}`.trim()
                                        : user.name || value;

                                // Translate portal user name if it contains a translation key
                                if (
                                    userName &&
                                    userName.includes(
                                        "{{users.values.portal_user}}"
                                    )
                                ) {
                                    try {
                                        let translated = false;

                                        if (translate) {
                                            // Try namespace:key format first (i18next format)
                                            const translated1 = translate(
                                                "users:values.portal_user"
                                            );
                                            if (
                                                translated1 &&
                                                translated1 !==
                                                "users:values.portal_user"
                                            ) {
                                                userName = translated1;
                                                translated = true;
                                            } else {
                                                // Fallback to dot notation
                                                const translated2 = translate(
                                                    "users.values.portal_user"
                                                );
                                                if (
                                                    translated2 &&
                                                    translated2 !==
                                                    "users.values.portal_user"
                                                ) {
                                                    userName = translated2;
                                                    translated = true;
                                                }
                                            }
                                        }

                                        // Final fallback if translation failed
                                        if (!translated) {
                                            userName = userName.replace(
                                                "{{users.values.portal_user}}",
                                                "Portal User"
                                            );
                                        }
                                    } catch {
                                        // If translation fails, use fallback
                                        userName = userName.replace(
                                            "{{users.values.portal_user}}",
                                            "Portal User"
                                        );
                                    }
                                }

                                processedContent = processedContent.replace(
                                    match,
                                    userName
                                );
                            } else {
                                // Legacy content may have {{user:displayName}}; use value as display text
                                processedContent = processedContent.replace(
                                    match,
                                    value
                                );
                            }
                        } catch (err) {
                            processedContent = processedContent.replace(
                                match,
                                value
                            );
                        }
                    }
                }
            }

            // 4. Handle date format {{date:...}} in the user's timezone
            processedContent = processedContent.replace(
                /\{\{date:([^}]+)\}\}/g,
                (match, dateString) => {
                    try {
                        const date = new Date(dateString);

                        if (!isNaN(date.getTime())) {
                            const formattedDateTime = formatDateForDisplayUtil(
                                date,
                                "datetime",
                                dateLocale || locale,
                                timezone
                            );
                            return formattedDateTime;
                        }
                        return match;
                    } catch {
                        return match;
                    }
                }
            );

            // 5. Handle date-only format {{dateOnly:...}} in the user's timezone
            processedContent = processedContent.replace(
                /\{\{dateOnly:([^}]+)\}\}/g,
                (match, dateString) => {
                    try {
                        const date = new Date(dateString);

                        if (!isNaN(date.getTime())) {
                            const formattedDate = formatDateForDisplayUtil(
                                date,
                                "date",
                                dateLocale || locale,
                                timezone
                            );

                            return formattedDate;
                        }
                        return match;
                    } catch {
                        return match;
                    }
                }
            );

            // 6. Handle HTML formatting
            if (/<[^>]*>/g.test(processedContent)) {
                return processedContent;
            }

            return processedContent.replace(/\n/g, "<br>");
        } catch {
            return content;
        }
    }

    /**
     * Enhanced translation that can handle nested keys using resources
     */
    private async translateActivityContentWithResources(
        content: string,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        translate: (key: string) => string,
        resources: any,
        locale: string
    ): Promise<string> {
        if (!content || !resources) {
            return await this.translateActivityContent(content, translate);
        }

        let processedContent = content;

        // Get the translation resources for the locale
        // Map full locale (e.g., en-US) to short locale (e.g., en)
        const shortLocale = locale.split("-")[0];
        const localeResources = resources[shortLocale] || resources[locale];

        // Check if localeResources has a 'translation' property or if it IS the translation data
        let translationData: any = null;
        if (localeResources?.translation) {
            translationData = localeResources.translation;
        } else if (localeResources) {
            // Maybe localeResources IS the translation data
            translationData = localeResources;
        } else {
            return await this.translateActivityContent(content, translate);
        }

        if (!translationData) {
            return await this.translateActivityContent(content, translate);
        }

        // Replace translation keys in the format {{key}} with translated text using nested key access
        processedContent = processedContent.replace(
            /\{\{([a-zA-Z0-9_.]+)\}\}/g,
            (match, key) => {
                try {
                    // Use nested key access for dot notation keys
                    const translatedText = translationData
                        ? this.getNestedTranslationValue(translationData, key)
                        : null;

                    if (translatedText && translatedText !== key) {
                        return translatedText;
                    } else {
                        // Fallback to original translate function
                        const fallbackResult = translate(key) || match;
                        return fallbackResult;
                    }
                } catch (error) {
                    console.error(
                        `[Translation] Error translating "${key}":`,
                        error
                    );
                    return match;
                }
            }
        );

        return processedContent;
    }

    /**
     * Helper method to get nested translation value using dot notation
     */
    private getNestedTranslationValue(obj: any, key: string): string | null {
        if (!obj || !key) {
            return null;
        }

        // Direct access to translation data using dot notation
        const keys = key.split(".");
        let current = obj;

        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];

            if (
                current &&
                typeof current === "object" &&
                current !== null &&
                k in current
            ) {
                current = current[k];
            } else {
                return null;
            }
        }

        const result = typeof current === "string" ? current : null;
        return result;
    }

    /* ********** GENERATE ACTIVITY TITLE ********** */
    public async generateActivityTitle(params: {
        type: activity_type;
        status: ActivityStatus;
        ActivitiesSequence?: {
            step: number | null;
            category: string;
        } | null;
        Account?: {
            Country?: {
                iso2: string | null;
            } | null;
            State?: {
                iso2: string | null;
            } | null;
        } | null;
        schedule_time: Date;
        title: string;
        content: string;
        ActivityContacts: {
            Contact: {
                email: string | null;
                mobile: string | null;
                first_name: string | null;
                last_name: string | null;
            };
            status: string;
        }[];
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        translate?: (key: string, params?: any) => string;
        resources?: any;
        titleParams?: any;
        locale?: string;
        timezone?: string;
    }): Promise<string> {
        if (params.translate && params.title) {
            try {
                // Get dateLocale from the titleParams or use locale as fallback
                const dateLocale =
                    (params.titleParams as any)?.dateLocale || params.locale;
                const result = await this.formatTitleForDisplay(
                    params.title,
                    params.translate,
                    params.titleParams,
                    params.locale, // Used for content translation language
                    params.resources,
                    params.timezone, // Used for date timezone conversion
                    dateLocale // Used for date formatting locale
                );
                return result;
            } catch (error) {
                console.error(
                    "[ActivityService.generateActivityTitle] Error in formatTitleForDisplay:",
                    error
                );
                return params.title || "";
            }
        }

        return params.title || "";
    }

    /**
     * Unified date formatting function for all date display needs
     * @param date - Date object or ISO string
     * @param format - Format type: 'title', 'time', 'date', 'datetime'
     * @param locale - User locale (e.g., 'en-US', 'he-IL')
     * @param timezone - User timezone (optional, defaults to UTC)
     * @returns Formatted date string
     */
    public async formatDateForDisplay(
        date: Date | string,
        format: "title" | "time" | "date" | "datetime" = "title",
        locale?: string,
        timezone?: string
    ): Promise<string> {
        try {
            // Use dynamic import for server-side compatibility
            const { formatDateForDisplay } = await import(
                "@/utils/datetimeOperations"
            );
            if (typeof formatDateForDisplay === "function") {
                return formatDateForDisplay(date, format, locale, timezone);
            } else {
                console.error(
                    "[ActivityService] formatDateForDisplay is not a function:",
                    typeof formatDateForDisplay
                );
                // Fallback to simple date formatting
                const dateObj =
                    typeof date === "string" ? new Date(date) : date;
                return dateObj.toLocaleString(locale || "en-US");
            }
        } catch (error) {
            console.error(
                "[ActivityService] Error in formatDateForDisplay:",
                error
            );
            // Fallback to simple date formatting
            const dateObj = typeof date === "string" ? new Date(date) : date;
            return dateObj.toLocaleString(locale || "en-US");
        }
    }

    /**
     * Format title for display through translation and parameter replacement
     */
    private async formatTitleForDisplay(
        title: string,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        translate: (key: string) => string,
        titleParams?: any,
        locale?: string,
        resources?: any,
        timezone?: string,
        dateLocale?: string // Add separate parameter for date formatting locale
    ): Promise<string> {
        if (!title || !translate) {
            return title || "";
        }

        let processedTitle = title;

        try {
            // Check if this is the old bracket format {{key}} vs a plain string
            const translationKeyCount = (title.match(/\{\{/g) || []).length;

            if (translationKeyCount > 0) {
                // Old format: bracket translation key like "{{activity.log_activity.call_activity}}"
                // Use the existing translateActivityContent method to handle it
                try {
                    if (resources && locale) {
                        processedTitle =
                            await this.translateActivityContentWithResources(
                                title,
                                translate,
                                resources,
                                locale
                            );
                    } else {
                        processedTitle = await this.translateActivityContent(
                            title,
                            translate
                        );
                    }
                } catch (error) {
                    console.error(
                        "[ActivityService.formatTitleForDisplay] Error translating bracket format:",
                        error
                    );
                    processedTitle = title;
                }
            } else if (translationKeyCount === 0 && !title.includes("{{")) {
                // Handle translation keys without brackets (new format)
                try {
                    const translatedResult = translate(title);
                    processedTitle = translatedResult || title;
                } catch (error) {
                    console.error(
                        "[ActivityService.formatTitleForDisplay] Error translating key without brackets:",
                        error
                    );
                    processedTitle = title;
                }
            } else if (
                translationKeyCount === 1 &&
                title.startsWith("{{") &&
                title.endsWith("}}")
            ) {
                // Old format: single translation key wrapped in brackets
                const translationKey = title.slice(2, -2); // Remove {{ and }}
                processedTitle = translate(translationKey);
            } else if (translationKeyCount > 1) {
                // Old format: multiple translation keys with brackets
                // This matches the logic used in translateActivityContent
                // Only process actual translation keys (containing dots), not parameter placeholders
                processedTitle = processedTitle.replace(
                    /\{\{([a-zA-Z0-9_.]+\.[a-zA-Z0-9_.]+)\}\}/g,
                    (match, key) => {
                        try {
                            const translatedKey = translate(key);
                            return translatedKey;
                        } catch {
                            return match;
                        }
                    }
                );
            } else {
                // Not a translation key, return as-is
                return title;
            }

            if (titleParams) {
                if (titleParams.userId) {
                    try {
                        const user = await findUserById(titleParams.userId);
                        if (user) {
                            let userName =
                                user.first_name && user.last_name
                                    ? `${user.first_name} ${user.last_name}`.trim()
                                    : user.name || titleParams.userId;

                            // Translate portal user name if it contains a translation key
                            if (
                                userName &&
                                userName.includes(
                                    "{{users.values.portal_user}}"
                                )
                            ) {
                                try {
                                    let translated = false;

                                    // Try to translate using resources if available
                                    if (resources && locale) {
                                        const localeKey =
                                            locale.split("-")[0] || "en";
                                        const localeResources =
                                            (resources as any)[localeKey] ||
                                            (resources as any)[locale] ||
                                            resources;

                                        // Use getNestedTranslationValue helper for proper nested access
                                        const translatedValue =
                                            this.getNestedTranslationValue(
                                                localeResources,
                                                "users.values.portal_user"
                                            );

                                        if (translatedValue) {
                                            userName = translatedValue;
                                            translated = true;
                                        }
                                    }

                                    // If still contains translation key, try translate function
                                    if (
                                        !translated &&
                                        userName.includes(
                                            "{{users.values.portal_user}}"
                                        )
                                    ) {
                                        if (translate) {
                                            // Try namespace:key format first (i18next format)
                                            const translated1 = translate(
                                                "users:values.portal_user"
                                            );
                                            if (
                                                translated1 &&
                                                translated1 !==
                                                "users:values.portal_user"
                                            ) {
                                                userName = translated1;
                                                translated = true;
                                            } else {
                                                // Fallback to dot notation
                                                const translated2 = translate(
                                                    "users.values.portal_user"
                                                );
                                                if (
                                                    translated2 &&
                                                    translated2 !==
                                                    "users.values.portal_user"
                                                ) {
                                                    userName = translated2;
                                                    translated = true;
                                                }
                                            }
                                        }
                                    }

                                    // Final fallback if translation still failed
                                    if (!translated) {
                                        userName = userName.replace(
                                            "{{users.values.portal_user}}",
                                            "Portal User"
                                        );
                                    }
                                } catch {
                                    // If translation fails, use fallback
                                    userName = userName.replace(
                                        "{{users.values.portal_user}}",
                                        "Portal User"
                                    );
                                }
                            }

                            processedTitle = processedTitle.replace(
                                /\{\{userId\}\}/g,
                                userName
                            );
                        } else {
                            processedTitle = processedTitle.replace(
                                /\{\{userId\}\}/g,
                                titleParams.userId
                            );
                        }
                    } catch {
                        processedTitle = processedTitle.replace(
                            /\{\{userId\}\}/g,
                            titleParams.userId
                        );
                    }
                }

                // Handle other parameter substitutions
                if (titleParams.step) {
                    processedTitle = processedTitle.replace(
                        /\{\{step\}\}/g,
                        titleParams.step
                    );
                }
                if (titleParams.contacts) {
                    processedTitle = processedTitle.replace(
                        /\{\{contacts\}\}/g,
                        titleParams.contacts
                    );
                }
                if (titleParams.invoiceNumber) {
                    processedTitle = processedTitle.replace(
                        /\{\{invoiceNumber\}\}/g,
                        titleParams.invoiceNumber
                    );
                }

                // CRITICAL FIX: Add support for {{count}} placeholder
                // Calculate count from invoiceNumber if not provided
                let countValue = titleParams.count;
                if (countValue === undefined || countValue === null) {
                    if (titleParams.invoiceNumber) {
                        if (Array.isArray(titleParams.invoiceNumber)) {
                            countValue = titleParams.invoiceNumber.length;
                        } else if (typeof titleParams.invoiceNumber === "string") {
                            // Handle comma-separated invoice numbers
                            countValue = titleParams.invoiceNumber.split(',').filter((s: string) => s.trim().length > 0).length;
                        } else {
                            countValue = 1;
                        }
                    }
                }

                if (countValue !== undefined && countValue !== null) {
                    processedTitle = processedTitle.replace(
                        /\{\{count\}\}/g,
                        String(countValue)
                    );
                }
                if (titleParams.time) {
                    // CRITICAL FIX: Use "datetime" format to match the right-hand side timeline display
                    // This ensures the time in the title uses the exact same formatting as the timeline
                    // Use dateLocale for date formatting, fallback to locale if not provided
                    const formattedTime = await this.formatDateForDisplay(
                        titleParams.time,
                        "datetime",
                        dateLocale || locale,
                        timezone
                    );
                    processedTitle = processedTitle.replace(
                        /\{\{time\}\}/g,
                        formattedTime
                    );
                }
                if (titleParams.userName) {
                    processedTitle = processedTitle.replace(
                        /\{\{userName\}\}/g,
                        titleParams.userName
                    );
                }
                if (titleParams.disputeReason) {
                    processedTitle = processedTitle.replace(
                        /\{\{disputeReason\}\}/g,
                        titleParams.disputeReason
                    );
                }
                if (titleParams.disputeId) {
                    processedTitle = processedTitle.replace(
                        /\{\{disputeId\}\}/g,
                        titleParams.disputeId
                    );
                }
                if (titleParams.resolution) {
                    // Translate the resolution parameter
                    // Map resolution values from enum to their translation keys
                    // Enum values: Denied, Cancelled, Accepted, Accepted_Settled_in_full, Accepted_Settled_partly, Admin_Fixed_Balance_Unchanged
                    // Translation keys in disputes.values: status_denied, status_cancelled, status_accepted, etc.
                    const normalizedResolution = titleParams.resolution
                        .toLowerCase()
                        .replace(/[_\s]/g, "_");
                    const resolutionKey = `disputes.values.status_${normalizedResolution}`;

                    // Try to use resources first for cross-namespace access
                    let translatedResolution = titleParams.resolution;
                    if (resources && locale) {
                        const shortLocale = locale.split("-")[0];
                        const localeResources =
                            resources[shortLocale] || resources[locale];
                        if (localeResources) {
                            translatedResolution =
                                this.getNestedTranslationValue(
                                    localeResources,
                                    resolutionKey
                                ) || titleParams.resolution;
                        } else {
                            translatedResolution =
                                translate(resolutionKey) ||
                                titleParams.resolution;
                        }
                    } else {
                        // Fallback to translate function if resources not available
                        translatedResolution =
                            translate(resolutionKey) || titleParams.resolution;
                    }
                    processedTitle = processedTitle.replace(
                        /\{\{resolution\}\}/g,
                        translatedResolution
                    );
                }
                if (titleParams.reason) {
                    // Translate the reason parameter if it's a translation key
                    const translatedReason =
                        titleParams.reason.startsWith(
                            "activity.collection_period_closure_comment_"
                        ) ||
                            titleParams.reason.startsWith(
                                "activities.fields.collection_period_closure_comment_"
                            )
                            ? translate(titleParams.reason) ||
                            titleParams.reason
                            : titleParams.reason;
                    processedTitle = processedTitle.replace(
                        /\{\{reason\}\}/g,
                        translatedReason
                    );
                }
                // Add parameter handlers for category changes
                if (titleParams.oldCategory) {
                    // Translate the oldCategory parameter using resources for cross-namespace access
                    let translatedOldCategory = titleParams.oldCategory;
                    if (
                        titleParams.oldCategory.startsWith(
                            "customers.values.category_"
                        )
                    ) {
                        if (resources && locale) {
                            const shortLocale = locale.split("-")[0];
                            const localeResources =
                                resources[shortLocale] || resources[locale];
                            if (localeResources) {
                                translatedOldCategory =
                                    this.getNestedTranslationValue(
                                        localeResources,
                                        titleParams.oldCategory
                                    ) || translatedOldCategory;
                            }
                        }
                        // Fallback to translate function if resources lookup failed or resources not available
                        if (translatedOldCategory === titleParams.oldCategory) {
                            translatedOldCategory =
                                translate(titleParams.oldCategory) ||
                                titleParams.oldCategory;
                        }
                    } else if (
                        titleParams.oldCategory.startsWith(
                            "customer.category_values."
                        )
                    ) {
                        // Legacy format fallback
                        translatedOldCategory =
                            translate(titleParams.oldCategory) ||
                            titleParams.oldCategory;
                    }
                    processedTitle = processedTitle.replace(
                        /\{\{oldCategory\}\}/g,
                        translatedOldCategory
                    );
                }
                if (titleParams.newCategory) {
                    // Translate the newCategory parameter using resources for cross-namespace access
                    let translatedNewCategory = titleParams.newCategory;
                    if (
                        titleParams.newCategory.startsWith(
                            "customers.values.category_"
                        )
                    ) {
                        if (resources && locale) {
                            const shortLocale = locale.split("-")[0];
                            const localeResources =
                                resources[shortLocale] || resources[locale];
                            if (localeResources) {
                                translatedNewCategory =
                                    this.getNestedTranslationValue(
                                        localeResources,
                                        titleParams.newCategory
                                    ) || translatedNewCategory;
                            }
                        }
                        // Fallback to translate function if resources lookup failed or resources not available
                        if (translatedNewCategory === titleParams.newCategory) {
                            translatedNewCategory =
                                translate(titleParams.newCategory) ||
                                titleParams.newCategory;
                        }
                    } else if (
                        titleParams.newCategory.startsWith(
                            "customer.category_values."
                        )
                    ) {
                        // Legacy format fallback
                        translatedNewCategory =
                            translate(titleParams.newCategory) ||
                            titleParams.newCategory;
                    }
                    processedTitle = processedTitle.replace(
                        /\{\{newCategory\}\}/g,
                        translatedNewCategory
                    );
                }

                // Add parameter handlers for call activities
                if (titleParams.callType) {
                    processedTitle = processedTitle.replace(
                        /\{\{callType\}\}/g,
                        titleParams.callType
                    );
                }
                if (titleParams.contact) {
                    processedTitle = processedTitle.replace(
                        /\{\{contact\}\}/g,
                        titleParams.contact
                    );
                }
                if (titleParams.outcome) {
                    processedTitle = processedTitle.replace(
                        /\{\{outcome\}\}/g,
                        titleParams.outcome
                    );
                }

                // Add parameter handlers for dispute assignments
                if (titleParams.assignedBy) {
                    processedTitle = processedTitle.replace(
                        /\{\{assignedBy\}\}/g,
                        titleParams.assignedBy
                    );
                }
                if (titleParams.assigneeName) {
                    processedTitle = processedTitle.replace(
                        /\{\{assigneeName\}\}/g,
                        titleParams.assigneeName
                    );
                }
                if (titleParams.assigneeId) {
                    try {
                        const assignee = await findUserById(
                            titleParams.assigneeId
                        );
                        if (assignee) {
                            const assigneeName =
                                assignee.first_name && assignee.last_name
                                    ? `${assignee.first_name} ${assignee.last_name}`.trim()
                                    : assignee.name || titleParams.assigneeId;
                            processedTitle = processedTitle.replace(
                                /\{\{assigneeId\}\}/g,
                                assigneeName
                            );
                        } else {
                            processedTitle = processedTitle.replace(
                                /\{\{assigneeId\}\}/g,
                                titleParams.assigneeId
                            );
                        }
                    } catch {
                        processedTitle = processedTitle.replace(
                            /\{\{assigneeId\}\}/g,
                            titleParams.assigneeId
                        );
                    }
                }

                // Add parameter handlers for status updates
                if (titleParams.status) {
                    // Translate the status parameter
                    // Normalize dispute status to snake_case for translation keys
                    const normalizedStatus = titleParams.status
                        .toLowerCase()
                        .replace(/[_\s]/g, "_");
                    const statusKey = `disputes:values.dispute_status_${normalizedStatus}`;
                    const translatedStatus =
                        (translate as any)(statusKey) || titleParams.status;
                    processedTitle = processedTitle.replace(
                        /\{\{status\}\}/g,
                        translatedStatus
                    );
                }

                // Add parameter handlers for promise to pay
                if (titleParams.date) {
                    // Use unified date formatting function for proper localization
                    // Use dateLocale for date formatting, fallback to locale if not provided
                    const formattedDate = await this.formatDateForDisplay(
                        titleParams.date,
                        "date",
                        dateLocale || locale,
                        timezone
                    );
                    processedTitle = processedTitle.replace(
                        /\{\{date\}\}/g,
                        formattedDate
                    );
                }
            }

            return processedTitle;
        } catch (error) {
            console.error(
                "[ActivityService.formatTitleForDisplay] Error in formatTitleForDisplay:",
                error
            );
            return title || ""; // Ensure we never return null/undefined
        }
    }

    /**
     * Format and translate activity content
     */
    public async formatContent(
        content: string,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        translate?: (key: string) => string,
        locale?: string,
        dateLocale?: string, // Add separate parameter for date formatting locale
        timezone?: string
    ): Promise<string> {
        if (!content) return "";

        if (translate) {
            const result = await this.translateActivityContent(
                content,
                translate,
                locale,
                dateLocale,
                timezone
            );
            return result;
        }

        return content;
    }

    /* ********** UNIFIED ACTIVITY CONTENT GENERATION SYSTEM ********** */

    /**
     * Unified content replacement utility with parameterized approach
     */
    private replaceContentMacros(
        content: string,
        replacements: Record<string, string>
    ): string {
        let result = content;

        for (const [macro, value] of Object.entries(replacements)) {
            const regex = new RegExp(`\\{${macro}\\}`, "g");
            if (result.match(regex)) {
                // console.log(`[ActivityService] Replaced standard macro {${macro}}`);
            }
            result = result.replace(regex, value);

            if (["link", "pay_now_link", "settle_payment"].includes(macro)) {
                const specialRegex = new RegExp(
                    `https://portal.archaser.com/en/app/%7B${macro}%7D`,
                    "g"
                );
                if (result.match(specialRegex)) {
                    // console.log(`[ActivityService] Replaced portal link macro %7B${macro}%7D`);
                }
                result = result.replace(specialRegex, value);
            }
        }

        return result;
    }

    /**
     * Unified customer content replacement
     */
    // eslint-disable-next-line no-dupe-class-members, @typescript-eslint/no-unused-vars, no-unused-vars
    public replaceCustomerContent(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        content: string,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        customer: {
            id: number;
            name: string | null;
            logo: string | null;
            sub_domain: string | null;
            contactId?: number;
        },
        portalPath?: string
    ): string;
    // eslint-disable-next-line no-dupe-class-members, @typescript-eslint/no-unused-vars, no-unused-vars
    public replaceCustomerContent(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        content: string,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        customer: {
            type: "Person" | "Company";
            customer_uuid: string;
            language?: string | null;
            Person?: { first_name: string | null } | null;
            Company?: { name: string } | null;
            Account: {
                id: number;
                name: string | null;
                logo: string | null;
                sub_domain: string | null;
            };
            contactId?: number;
        },
        portalPath?: string
    ): string;
    // eslint-disable-next-line no-dupe-class-members
    public replaceCustomerContent(
        content: string,
        customer: {
            id?: number;
            name?: string | null;
            logo?: string | null;
            sub_domain?: string | null;
            type?: "Person" | "Company";
            customer_uuid?: string;
            language?: string | null;
            Person?: { first_name: string | null } | null;
            Company?: { name: string } | null;
            Account?: {
                id: number;
                name: string | null;
                logo: string | null;
                sub_domain: string | null;
            };
            contactId?: number;
        },
        portalPath?: string
    ): string {
        // First overload: account-only data
        if (
            customer.id !== undefined &&
            customer.name !== undefined &&
            customer.Account === undefined
        ) {
            const host_url =
                process.env.NODE_ENV === "production" &&
                    process?.env?.NEXTAUTH_URL
                    ? new URL(process?.env?.NEXTAUTH_URL).hostname
                    : `localhost:${process.env.PORT || 3000}`;

            const customerName = customer.name || "";
            let logoHtml = "";

            if (customer.logo) {
                const logoUrl = `${process?.env?.NEXTAUTH_URL || `http://${host_url}`}/api/accounts/${customer.id}/logo?v=${Date.now()}`;
                logoHtml = `<img src="${logoUrl}" alt="${customerName} Logo" style="max-width: 200px; height: auto;" />`;
            }

            return this.replaceContentMacros(content, {
                account_name: customerName,
                customer_logo: logoHtml,
            });
        }

        // Second overload: full customer data with Account
        const customerName =
            (customer?.type === "Company"
                ? customer?.Company?.name
                : customer?.Person?.first_name) || "";

        // Generate URLs
        const generatedLink = getCustomerPortalUrl(
            customer?.customer_uuid || "",
            customer?.Account?.sub_domain || "",
            customer?.language,
            customer.contactId,
            portalPath
        );

        // All template button links should now point to the portal home page
        const generatedPayNowLink = getCustomerPortalUrl(
            customer?.customer_uuid || "",
            customer?.Account?.sub_domain || "",
            customer?.language,
            customer.contactId,
            ""
        );

        const generatedSettlePayment = getCustomerPortalUrl(
            customer?.customer_uuid || "",
            customer?.Account?.sub_domain || "",
            customer?.language,
            customer.contactId,
            ""
        );

        const generatedViewInvoiceLink = getCustomerPortalUrl(
            customer?.customer_uuid || "",
            customer?.Account?.sub_domain || "",
            customer?.language,
            customer.contactId,
            ""
        );

        /*
        console.log("[ActivityService] Generated Portal Links:", {
            link: generatedLink,
            pay_now: generatedPayNowLink,
            settle: generatedSettlePayment,
            view_invoice: generatedViewInvoiceLink
        });
        */

        return this.replaceContentMacros(content, {
            customer_name: customerName,
            debor_name: customerName, // Handle typo in template
            // Note: first_name is NOT replaced here - it should only be replaced by replaceContactContent
            link: generatedLink,
            pay_now_link: generatedPayNowLink,
            settle_payment: generatedSettlePayment,
            view_invoice_link: generatedViewInvoiceLink,
        });
    }

    /**
     * Unified contact content replacement
     */
    public replaceContactContent(
        content: string,
        contact: {
            first_name: string | null;
            last_name?: string | null;
            email?: string | null;
            phone?: string | null;
            mobile?: string | null;
            role?: string | null;
            company_wide_address?: boolean | null;
        }
    ): string {
        const greetingName = contact.first_name || "";
        const lastName = contact.last_name || "";
        const fullName =
            `${contact.first_name || ""} ${contact.last_name || ""}`.trim();

        return this.replaceContentMacros(content, {
            first_name: greetingName,
            last_name: lastName,
            contact_name: fullName,
            debor_name: greetingName, // Handle typo in template
            email: contact.email || "",
            phone: contact.phone || contact.mobile || "",
            mobile: contact.mobile || contact.phone || "",
            role: contact.role || "",
        });
    }

    /**
     * Process template content with all replacements
     * This is the consolidated template replacement function used by both
     * scheduled emails (activityWorkflowManager) and immediate emails (API)
     * For due notifications, pass optional invoice to replace invoice placeholders
     */
    public async processTemplateContent(
        content: string,
        account: {
            id: number;
            name: string | null;
            logo: string | null;
            sub_domain: string | null;
        },
        customer: {
            type: "Person" | "Company";
            customer_uuid: string;
            language?: string | null;
            Person?: { first_name: string | null } | null;
            Company?: { name: string } | null;
        },
        contact: {
            first_name: string | null;
            last_name?: string | null;
            email?: string | null;
            phone?: string | null;
            mobile?: string | null;
            role?: string | null;
            company_wide_address?: boolean | null;
            id?: number; // Add contact ID
        },
        resolvedLanguage?: string,
        invoice?: {
            invoice_number: string | null;
            due_date: Date | string | null;
            outstanding_debt: number | null;
            days_until_due?: number;
        },
        portalPath?: string
    ): Promise<string> {
        if (!content) return "";

        let processedContent = content;

        // First replace account content (account_name, customer_logo)
        processedContent = this.replaceCustomerContent(processedContent, {
            id: account.id,
            name: account.name,
            logo: account.logo,
            sub_domain: account.sub_domain,
        });

        // Then replace customer content (customer_name, link)
        processedContent = this.replaceCustomerContent(processedContent, {
            type: customer.type,
            customer_uuid: customer.customer_uuid,
            language: customer.language, // CRITICAL: Pass language to generate correct locale in portal URL
            Person: customer.Person,
            Company: customer.Company,
            Account: {
                id: account.id,
                name: account.name,
                logo: account.logo,
                sub_domain: account.sub_domain,
            },
            contactId: contact.id, // Pass contact ID for targeted portal link
        }, portalPath); // Pass portalPath if provided

        // Replace contact-specific content (first_name, last_name, email, phone, mobile, role)
        processedContent = this.replaceContactContent(processedContent, {
            first_name: contact.first_name,
            last_name: contact.last_name,
            email: contact.email,
            phone: contact.phone,
            mobile: contact.mobile,
            role: contact.role,
            company_wide_address: contact.company_wide_address,
        });

        // Replace invoice placeholders when present (due notifications)
        if (invoice) {
            processedContent = this.replaceInvoiceContent(
                processedContent,
                invoice
            );
        }

        // Handle date formatting templates (like {{dateOnly:...}})
        if (processedContent.includes("{{dateOnly:")) {
            processedContent = await this.formatContent(
                processedContent,
                undefined, // No translate function needed for content
                resolvedLanguage || customer.language || "en"
            );
        }

        return processedContent;
    }

    /**
     * Replace invoice placeholders in template content for due notifications.
     * Supports: {invoice_number}, {due_date}, {amount}, {days_until_due}
     */
    private replaceInvoiceContent(
        content: string,
        invoice: {
            invoice_number: string | null;
            due_date: Date | string | null;
            outstanding_debt: number | null;
            days_until_due?: number;
        }
    ): string {
        const dueDate = invoice.due_date
            ? new Date(invoice.due_date).toLocaleDateString()
            : "";
        const daysUntilDue =
            invoice.days_until_due ??
            (invoice.due_date
                ? Math.ceil(
                    (new Date(invoice.due_date).getTime() - Date.now()) /
                    (24 * 60 * 60 * 1000)
                )
                : 0);

        return this.replaceContentMacros(content, {
            invoice_number: invoice.invoice_number ?? "",
            due_date: dueDate,
            amount: String(invoice.outstanding_debt ?? 0),
            days_until_due: String(daysUntilDue),
        });
    }

    /**
     * Unified activity description generator
     * This replaces formatDescription(), generateActivityDescription(), and generateDescription()
     */
    public async generateActivityDescription(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        params: ActivityContentParams & { translate?: (key: string) => string }
    ): Promise<string> {
        const {
            type,
            contact,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
            contactId,
            callType,
            durationSec,
            comment,
            callOutcome,
            followUpTime,
            promiseDate,
            isPortal,
            disputeReason,
            disputedInvoices,
            contactInfo,
            assigneeName,
            assignedBy,
            assigneeId,
            assignedById,
            disputeId,
            agentName,
            agentId,
            timezone,
        } = params;

        const contentParts: string[] = [];

        // Helper function to create labeled value with semantic class names
        const createLabelValue = (
            labelKey: string,
            value: string,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
            translateFn?: (key: string) => string
        ) => {
            // Strip existing {{}} from labelKey if present to avoid double-wrapping
            const cleanLabelKey =
                labelKey.startsWith("{{") && labelKey.endsWith("}}")
                    ? labelKey.slice(2, -2)
                    : labelKey;

            // Check if the value is already wrapped in {{}} (is a translation key)
            // or if it starts with activity/activities/dispute namespace
            const isTranslationKey =
                value.startsWith("{{") ||
                value.startsWith("activity.") ||
                value.startsWith("activities.") ||
                value.startsWith("dispute.") ||
                value.startsWith("disputes.");

            // Always use translation keys for labels, never translate during generation
            const result = `
                <span class="activity-label-primary">{{${cleanLabelKey}}}:</span> 
                <span class="activity-value">${value}</span>
            `;

            return result;
        };

        switch (type) {
            case "Call":
                this.generateCallDescription({
                    callOutcome,
                    promiseDate,
                    isPortal,
                    contact,
                    callType,
                    durationSec,
                    comment,
                    followUpTime,
                    agentName,
                    agentId,
                    timezone,
                    createLabelValue,
                    contentParts,
                    // DO NOT pass translate function - content should be generated with translation keys
                    // Translation will happen in formatContent() when fetching for display
                });
                break;

            case "Dispute":
                await this.generateDisputeDescription({
                    contactInfo,
                    contactId: params.contactId,
                    disputeReason,
                    disputedInvoices,
                    comment,
                    resolutionComment: params.resolutionComment,
                    assigneeName,
                    assignedBy,
                    assigneeId,
                    assignedById,
                    disputeId,
                    disputeResolution: params.disputeResolution,
                    disputeStatus: params.disputeStatus,
                    callType: params.callType,
                    durationSec: params.durationSec,
                    agentName: params.assigneeName,
                    agentId: params.agentId,
                    timezone: params.timezone,
                    createLabelValue,
                    contentParts,
                    // DO NOT pass translate function - content should be generated with translation keys
                    // Translation will happen in formatContent() when fetching for display
                });
                break;

            case "Email":
                contentParts.push(
                    createLabelValue(
                        "{{activities.fields.email_sent}}",
                        comment || ""
                        // DO NOT pass translate function - content should be generated with translation keys
                    )
                );
                break;

            case "SMS":
                contentParts.push(
                    createLabelValue(
                        "{{activities.fields.sms_sent}}",
                        comment || ""
                        // DO NOT pass translate function - content should be generated with translation keys
                    )
                );
                break;

            case "Internal":
                // For generic comments, show the comment text and agent name
                if (comment?.trim()) {
                    contentParts.push(
                        createLabelValue(
                            "{{activities.fields.log_activity_comment}}",
                            comment
                            // DO NOT pass translate function - content should be generated with translation keys
                        )
                    );
                }

                // Add agent name if available - use user ID for data integrity
                if (params.assigneeName && params.assigneeName.trim()) {
                    const agentId = params.agentId || params.assigneeName;
                    contentParts.push(
                        createLabelValue(
                            "{{activities.fields.agent}}",
                            `{{user:${agentId}}}`
                            // DO NOT pass translate function - content should be generated with translation keys
                        )
                    );
                }
                break;

            case "Promise_to_pay":
                // Add promise date if available
                if (params.promiseDate) {
                    contentParts.push(
                        createLabelValue(
                            "{{activities.fields.log_activity_payment_date}}",
                            `{{dateOnly:${params.promiseDate.toISOString()}}}`
                            // DO NOT pass translate function - content should be generated with translation keys
                        )
                    );
                }

                // Add contact information if available
                if (params.contact?.name && params.contact.name !== "Unknown") {
                    contentParts.push(
                        createLabelValue(
                            "{{activities.fields.log_activity_contact}}",
                            params.contact.name
                            // DO NOT pass translate function - content should be generated with translation keys
                        )
                    );
                }

                // Add call direction and duration if available
                if (
                    params.callType &&
                    ["incoming", "outgoing"].includes(
                        params.callType.toLowerCase()
                    )
                ) {
                    const callDirectionLabel =
                        params.callType === "incoming"
                            ? "{{activities.fields.log_activity_incoming_call}}"
                            : "{{activities.fields.log_activity_outgoing_call}}";
                    contentParts.push(
                        createLabelValue(
                            "{{activities.fields.call_direction}}",
                            callDirectionLabel
                            // DO NOT pass translate function - content should be generated with translation keys
                        )
                    );
                }

                if (params.durationSec && params.durationSec > 0) {
                    const duration = formatDuration(params.durationSec, true);
                    contentParts.push(
                        createLabelValue(
                            "{{activities.fields.duration}}",
                            duration
                            // DO NOT pass translate function - content should be generated with translation keys
                        )
                    );
                }

                // Add comment if available
                if (comment?.trim()) {
                    contentParts.push(
                        createLabelValue(
                            "{{activities.fields.log_activity_comment}}",
                            comment
                            // DO NOT pass translate function - content should be generated with translation keys
                        )
                    );
                }

                // Add agent name if available - use user ID for data integrity
                if (params.assigneeName && params.assigneeName.trim()) {
                    const agentId = params.agentId || params.assigneeName;
                    contentParts.push(
                        createLabelValue(
                            "{{activities.fields.agent}}",
                            `{{user:${agentId}}}`
                            // DO NOT pass translate function - content should be generated with translation keys
                        )
                    );
                }

                // Add timezone if available
                if (params.timezone && params.timezone.trim()) {
                    contentParts.push(
                        createLabelValue(
                            "{{activities.fields.timezone}}",
                            params.timezone
                            // DO NOT pass translate function - content should be generated with translation keys
                        )
                    );
                }
                break;

            case "Agent":
                contentParts.push(
                    createLabelValue(
                        "{{activities.fields.follow_up}}",
                        comment || ""
                        // DO NOT pass translate function - content should be generated with translation keys
                    )
                );
                break;

            default:
                if (comment?.trim()) {
                    contentParts.push(
                        createLabelValue(
                            "{{activities.fields.log_activity_comment}}",
                            comment
                            // DO NOT pass translate function - content should be generated with translation keys
                        )
                    );
                }
                break;
        }

        const finalResult = contentParts.join("<br>");

        return finalResult;
    }

    /**
     * Helper method to generate call-specific descriptions
     */
    private generateCallDescription(params: {
        callOutcome?: string;
        promiseDate?: Date;
        isPortal?: boolean;
        contact?: { id?: number; name: string | null };
        callType?: string;
        durationSec?: number;
        comment?: string;
        followUpTime?: Date | null;
        agentName?: string;
        agentId?: string; // Add user ID for agent
        timezone?: string;
        createLabelValue: (
            labelKey: string,
            value: string,
            translateFn?: (key: string) => string
        ) => string;
        contentParts: string[];
        translate?: (key: string) => string;
    }): void {
        const {
            callOutcome,
            promiseDate,
            isPortal,
            contact,
            callType,
            durationSec,
            comment,
            followUpTime,
            agentName,
            agentId,
            timezone,
            createLabelValue,
            contentParts,
            translate,
        } = params;

        // Handle promise to pay activities
        if (callOutcome === "promise_to_pay" && promiseDate) {
            if (isPortal) {
                contentParts.push(
                    createLabelValue(
                        "{{activities.fields.log_activity_payment_date}}",
                        `{{dateOnly:${promiseDate.toISOString()}}}`
                    )
                );
            } else {
                if (contact?.name && contact.name !== "Unknown") {
                    contentParts.push(
                        createLabelValue(
                            "{{activities.fields.log_activity_contact}}",
                            contact.name
                        )
                    );
                }

                contentParts.push(
                    createLabelValue(
                        "{{activities.fields.log_activity_payment_date}}",
                        `{{dateOnly:${promiseDate.toISOString()}}}`
                    )
                );

                // Add call direction if available (regardless of duration)
                if (
                    callType &&
                    ["incoming", "outgoing"].includes(callType.toLowerCase())
                ) {
                    const callDirectionLabel =
                        callType === "incoming"
                            ? "{{activities.fields.log_activity_incoming_call}}"
                            : "{{activities.fields.log_activity_outgoing_call}}";
                    contentParts.push(
                        createLabelValue(
                            "{{activities.fields.call_direction}}",
                            callDirectionLabel
                        )
                    );
                }

                // Add duration if available
                if (durationSec && durationSec > 0) {
                    this.addCallDuration(
                        durationSec,
                        createLabelValue,
                        contentParts
                        // DO NOT pass translate function - content should be generated with translation keys
                    );
                }
            }

            if (comment?.trim()) {
                contentParts.push(
                    createLabelValue(
                        "{{activities.fields.log_activity_comment}}",
                        comment
                    )
                );
            }
        } else {
            // Regular call activities
            this.generateRegularCallDescription({
                contact,
                callOutcome,
                followUpTime,
                callType,
                durationSec,
                comment,
                agentName,
                agentId,
                timezone,
                createLabelValue,
                contentParts,
                // DO NOT pass translate function - content should be generated with translation keys
            });
        }
    }

    /**
     * Helper method to generate regular call descriptions
     */
    private generateRegularCallDescription(params: {
        contact?: { id?: number; name: string | null };
        callOutcome?: string;
        followUpTime?: Date | null;
        callType?: string;
        durationSec?: number;
        comment?: string;
        agentName?: string;
        agentId?: string; // Add user ID for agent
        timezone?: string;
        createLabelValue: (
            labelKey: string,
            value: string,
            translateFn?: (key: string) => string
        ) => string;
        contentParts: string[];
        translate?: (key: string) => string;
    }): void {
        const {
            contact,
            callOutcome,
            followUpTime,
            callType,
            durationSec,
            comment,
            agentName,
            agentId,
            timezone,
            createLabelValue,
            contentParts,
            translate,
        } = params;

        if (contact?.name && contact.name !== "Unknown Contact") {
            contentParts.push(
                createLabelValue(
                    "{{activities.fields.log_activity_contact}}",
                    contact.name
                    // DO NOT pass translate function - content should be generated with translation keys
                )
            );
        }

        if (callOutcome && callOutcome.trim()) {
            const callOutcomeKey = `{{activities.values.outcomes_${callOutcome}}}`;
            contentParts.push(
                createLabelValue(
                    "{{activities.fields.outcome}}",
                    callOutcomeKey
                    // DO NOT pass translate function - content should be generated with translation keys
                )
            );
        }

        if (followUpTime) {
            const followUpDate =
                followUpTime instanceof Date
                    ? followUpTime
                    : new Date(followUpTime);

            if (!isNaN(followUpDate.getTime())) {
                contentParts.push(
                    createLabelValue(
                        "{{activities.fields.log_activity_follow_up_time}}",
                        `{{date:${followUpDate.toISOString()}}}`
                    )
                );
            }
        }

        // Show call direction if available (regardless of duration)
        if (
            callType &&
            ["incoming", "outgoing"].includes(callType.toLowerCase())
        ) {
            const callDirectionLabel =
                callType === "incoming"
                    ? "{{activities.fields.log_activity_incoming_call}}"
                    : "{{activities.fields.log_activity_outgoing_call}}";
            // Store the translation key, not the translated value
            contentParts.push(
                createLabelValue(
                    "{{activities.fields.call_direction}}",
                    callDirectionLabel
                    // DO NOT pass translate function - content should be generated with translation keys
                )
            );
        }

        // Show duration only if there's an actual duration (call was made)
        if (durationSec && durationSec > 0) {
            this.addCallDuration(
                durationSec,
                createLabelValue,
                contentParts
                // DO NOT pass translate function - content should be generated with translation keys
            );
        }

        if (comment?.trim()) {
            contentParts.push(
                createLabelValue(
                    "{{activities.fields.log_activity_comment}}",
                    comment
                    // DO NOT pass translate function - content should be generated with translation keys
                )
            );
        }

        // Add agent name if available - use user ID for data integrity
        if (agentName && agentName.trim()) {
            const agentId = params.agentId || agentName;
            contentParts.push(
                createLabelValue(
                    "{{activities.fields.agent}}",
                    `{{user:${agentId}}}`
                    // DO NOT pass translate function - content should be generated with translation keys
                )
            );
        }

        // Add timezone if available
        if (timezone && timezone.trim()) {
            contentParts.push(
                createLabelValue(
                    "{{activities.fields.timezone}}",
                    timezone
                    // DO NOT pass translate function - content should be generated with translation keys
                )
            );
        }
    }

    /**
     * Helper method to add call duration details
     */
    private addCallDuration(
        durationSec: number,
        createLabelValue: (
            labelKey: string,
            value: string,
            translateFn?: (key: string) => string
        ) => string,
        contentParts: string[]
        // DO NOT pass translate function - content should be generated with translation keys
    ): void {
        const duration = formatDuration(durationSec, true);

        contentParts.push(
            createLabelValue(
                "{{activities.fields.duration}}",
                duration
                // DO NOT pass translate function - content should be generated with translation keys
            )
        );
    }

    /**
     * Helper method to generate dispute descriptions
     */
    private async generateDisputeDescription(params: {
        contactInfo?: {
            reasonName: string;
            firstName?: string;
            lastName?: string;
            email?: string;
            phone?: string;
        };
        contactId?: number; // Add contact ID parameter
        disputeReason?: string;
        disputedInvoices?: string[];
        comment?: string;
        resolutionComment?: string;
        assigneeName?: string;
        assignedBy?: string;
        assigneeId?: string; // Add user ID for assignee
        assignedById?: string; // Add user ID for assigned by
        agentName?: string;
        agentId?: string; // Add user ID for agent
        disputeId?: number;
        disputeResolution?: string;
        disputeStatus?: string;
        callType?: string;
        callOutcome?: string; // Add call outcome parameter
        durationSec?: number;
        timezone?: string;
        createLabelValue: (
            labelKey: string,
            value: string,
            translateFn?: (key: string) => string
        ) => string;
        contentParts: string[];
        translate?: (key: string) => string;
    }): Promise<void> {
        const {
            contactInfo,
            contactId,
            disputeReason,
            disputedInvoices,
            comment,
            resolutionComment,
            assigneeName,
            assignedBy,
            disputeId,
            disputeResolution,
            disputeStatus,
            callType,
            callOutcome, // Extract call outcome
            durationSec,
            agentName,
            timezone,
            createLabelValue,
            contentParts,
        } = params;

        // Dispute ID removed from display as requested

        // Handle dispute contact information
        let contactName = "";

        // First try to get contact name from contactId (preferred method)
        if (contactId) {
            try {
                const contact = await prisma.contact.findUnique({
                    where: { id: contactId },
                    select: {
                        first_name: true,
                        last_name: true,
                        email: true,
                        phone: true,
                        mobile: true,
                    },
                });

                if (contact) {
                    contactName = [contact.first_name, contact.last_name]
                        .filter(Boolean)
                        .join(" ");
                }
            } catch (error) {
                // eslint-disable-next-line no-empty
                // Ignore error - fallback to contactInfo
            }
        }

        // Fallback to contactInfo if no contactId or database fetch failed
        if (!contactName && contactInfo) {
            // Check for firstName/lastName combination
            if (contactInfo.firstName || contactInfo.lastName) {
                contactName = [contactInfo.firstName, contactInfo.lastName]
                    .filter(Boolean)
                    .join(" ");
            }
            // Check for name field (using type assertion for dynamic properties)
            else if ((contactInfo as any).name) {
                contactName = (contactInfo as any).name;
            }
            // Check for contactName field (using type assertion for dynamic properties)
            else if ((contactInfo as any).contactName) {
                contactName = (contactInfo as any).contactName;
            }
            // If no name found, use phone as fallback
            else if (contactInfo.phone) {
                contactName = `Phone: ${contactInfo.phone}`;
            }
        }

        // Add contact name to content if we have one
        if (contactName) {
            contentParts.push(
                createLabelValue(
                    "{{disputes.fields.contact}}",
                    contactName
                    // DO NOT pass translate function - content should be generated with translation keys
                )
            );
        }

        // Handle dispute resolution type with separate label
        if (disputeResolution) {
            // Convert resolution enum to snake_case translation key
            // e.g., "Accepted_Settled_in_full" -> "status_accepted_settled_in_full"
            const normalizedResolution = disputeResolution
                .toLowerCase()
                .replace(/[_\s]/g, "_");
            const resolutionKey = `status_${normalizedResolution}`;
            const translationKey = `{{disputes.values.${resolutionKey}}}`;
            contentParts.push(
                createLabelValue(
                    "{{disputes.fields.resolution}}",
                    translationKey
                    // DO NOT pass translate function - content should be generated with translation keys
                )
            );
        }

        // Handle resolution comment with separate label
        if (resolutionComment?.trim()) {
            contentParts.push(
                createLabelValue(
                    "{{activities.fields.resolution_comment}}",
                    resolutionComment
                    // DO NOT pass translate function - content should be generated with translation keys
                )
            );
        }

        // Handle dispute status
        if (disputeStatus) {
            // Normalize dispute status to snake_case for translation keys
            const normalizedStatus = disputeStatus
                .toLowerCase()
                .replace(/[_\s]/g, "_");
            const statusKey = `dispute_status_${normalizedStatus}`;
            const translationKey = `{{disputes.values.${statusKey}}}`;
            contentParts.push(
                createLabelValue(
                    "{{disputes.fields.status}}",
                    translationKey
                    // DO NOT pass translate function - content should be generated with translation keys
                )
            );
        }

        // Handle dispute reason (for both contact-based and regular disputes)
        if (contactInfo) {
            contentParts.push(
                createLabelValue(
                    "{{disputes.fields.reason}}",
                    contactInfo.reasonName
                    // DO NOT pass translate function - content should be generated with translation keys
                )
            );
        } else {
            // Handle regular disputes
            if (disputedInvoices && disputedInvoices.length > 0) {
                contentParts.push(
                    createLabelValue(
                        "{{disputes.fields.invoices}}",
                        disputedInvoices.join(", ")
                        // DO NOT pass translate function - content should be generated with translation keys
                    )
                );
            }

            if (disputeReason) {
                // Dispute reasons are user-defined strings from the database, not translation keys
                contentParts.push(
                    createLabelValue(
                        "{{disputes.fields.reason}}",
                        disputeReason
                        // DO NOT pass translate function - content should be generated with translation keys
                    )
                );
            }
        }

        if (comment?.trim()) {
            contentParts.push(
                createLabelValue(
                    "{{activities.fields.log_activity_comment}}",
                    comment
                    // DO NOT pass translate function - content should be generated with translation keys
                )
            );
        }

        // Add call direction if available (regardless of duration)
        if (
            callType &&
            ["incoming", "outgoing"].includes(callType.toLowerCase())
        ) {
            const callDirectionLabel =
                callType === "incoming"
                    ? "{{activities.fields.log_activity_incoming_call}}"
                    : "{{activities.fields.log_activity_outgoing_call}}";
            contentParts.push(
                createLabelValue(
                    "{{activities.fields.call_direction}}",
                    callDirectionLabel
                    // DO NOT pass translate function - content should be generated with translation keys
                )
            );
        }

        // Add duration if available
        if (durationSec && durationSec > 0) {
            const duration = formatDuration(durationSec, true);
            contentParts.push(
                createLabelValue(
                    "{{activities.fields.duration}}",
                    duration
                    // DO NOT pass translate function - content should be generated with translation keys
                )
            );
        }

        // Add agent name if available - use user ID for data integrity
        if (agentName && agentName.trim()) {
            // Prefer agentId (user ID) over agentName for proper user resolution
            // If agentId is not available, use agentName as fallback (will be resolved by formatContent)
            const agentId = params.agentId || agentName;
            contentParts.push(
                createLabelValue(
                    "{{activities.fields.agent}}",
                    `{{user:${agentId}}}`
                    // DO NOT pass translate function - content should be generated with translation keys
                )
            );
        }

        // Add timezone if available
        if (timezone && timezone.trim()) {
            contentParts.push(
                createLabelValue(
                    "{{activities.fields.timezone}}",
                    timezone
                    // DO NOT pass translate function - content should be generated with translation keys
                )
            );
        }

        // Add call outcome if available
        if (callOutcome && callOutcome.trim()) {
            const callOutcomeKey = `{{activities.values.outcomes_${callOutcome}}}`;
            contentParts.push(
                createLabelValue(
                    "{{activities.fields.outcome}}",
                    callOutcomeKey
                    // DO NOT pass translate function - content should be generated with translation keys
                )
            );
        }
    }

    /* ********** HANDLE EMAIL DELIVERY ********** */
    public async handleEmailDelivery(
        messageId: string,
        status: string
    ): Promise<void> {
        try {
            let activityStatus = ActivityStatus.FAILED;
            let contactEmailStatus: email_status = email_status.Bounced;
            let deliveryStatus: delivery_status = delivery_status.Failed;

            if (status === "Delivery") {
                activityStatus = ActivityStatus.DELIVERED;
                contactEmailStatus = email_status.Valid;
                deliveryStatus = delivery_status.Delivered;
            } else if (status === "Complaint") {
                contactEmailStatus = email_status.Bounced;
                deliveryStatus = delivery_status.Bounced;
            } else if (status === "Bounce") {
                contactEmailStatus = email_status.Bounced;
                deliveryStatus = delivery_status.Bounced;
            }

            const deliveryTime =
                activityStatus === ActivityStatus.DELIVERED
                    ? moment().utc().toDate()
                    : null;

            // Find the ActivityContact record using SES message ID
            const activityContact = await prisma.activityContact.findFirst({
                where: { ses_message_id: messageId },
                select: {
                    id: true,
                    activity_id: true,
                    contact_id: true,
                    communication_channel: true,
                    is_fallback_attempt: true,
                    Activity: {
                        select: {
                            id: true,
                            email: true,
                            is_last_step: true,
                            ActivitiesSequence: {
                                select: {
                                    id: true,
                                    category: true,
                                    step: true,
                                },
                            },
                            CustomerCollectionPeriod: {
                                select: {
                                    id: true,
                                    current_category: true,
                                    last_automated_step: true,
                                    is_last_automated_step_delivered: true,
                                },
                            },
                            Customer: {
                                select: {
                                    company_id: true,
                                    account_id: true,
                                    // Note: Account removed from Customer select since Customer doesn't have Account relation
                                    // Fetch Account separately using customer.account_id if needed
                                },
                            },
                        },
                    },
                    Contact: {
                        select: {
                            id: true,
                            email: true,
                            mobile: true,
                            first_name: true,
                            company_wide_address: true,
                            receives_escalated_reminder: true,
                            receives_standard_reminder: true,
                            status: true,
                            priority_level: true,
                            fallback_contact_id: true,
                        },
                    },
                },
            });

            if (!activityContact) {
                throw new Error(
                    `No activity contact found for message ID: ${messageId}`
                );
            }

            const activity = (activityContact as any).Activity;
            const eventTime = deliveryTime ?? moment().utc().toDate();
            const shouldHandleFallback =
                deliveryStatus === delivery_status.Failed &&
                !activityContact.is_fallback_attempt;
            let shouldAllowNextAutomatedActivity = false;

            await prisma.$transaction(async (tx: any) => {
                await tx.activityContact.update({
                    where: { id: activityContact.id },
                    data: {
                        status: deliveryStatus,
                        delivered_at: deliveryTime,
                        failed_at:
                            deliveryStatus === delivery_status.Failed
                                ? eventTime
                                : null,
                    },
                });

                await tx.contact.update({
                    where: { id: activityContact.contact_id },
                    data: {
                        email_status: contactEmailStatus,
                        status:
                            activityStatus !== ActivityStatus.DELIVERED
                                ? "Inactive"
                                : "Active",
                    },
                });

                const allActivityContacts = await tx.activityContact.findMany({
                    where: { activity_id: activity.id },
                    select: { status: true },
                });

                const anyDelivered = allActivityContacts.some(
                    (ac: any) => ac.status === delivery_status.Delivered
                );

                if (!anyDelivered) {
                    return;
                }

                await tx.activity.update({
                    where: { id: activity.id },
                    data: {
                        status: activityStatus,
                        status_reason: status,
                        actual_delivery_time: deliveryTime,
                    },
                });

                if (!activity.CustomerCollectionPeriod) {
                    return;
                }

                const collectionPeriod = activity.CustomerCollectionPeriod;

                if (activity.ActivitiesSequence?.category === "Automated") {
                    await tx.customerCollectionPeriod.update({
                        where: { id: collectionPeriod.id },
                        data: {
                            last_automated_step:
                                activity.ActivitiesSequence.step,
                        },
                    });
                }

                if (collectionPeriod.current_category !== "Automated") {
                    return;
                }

                if (activity.is_last_step) {
                    const accountId = activity.Customer?.account_id;
                    const account = accountId
                        ? await tx.account.findUnique({
                            where: { id: accountId },
                            select: {
                                wait_days_after_automated: true,
                            },
                        })
                        : null;

                    const nextCategoryDate = moment().utc().toDate();
                    const nextCategoryDateWithHours = new Date(nextCategoryDate);
                    nextCategoryDateWithHours.setHours(
                        nextCategoryDateWithHours.getHours() +
                        24 * (account?.wait_days_after_automated || 0)
                    );

                    if (
                        collectionPeriod.is_last_automated_step_delivered !==
                        false
                    ) {
                        await tx.customerCollectionPeriod.update({
                            where: { id: collectionPeriod.id },
                            data: {
                                next_category: "Agent",
                                next_category_date: nextCategoryDateWithHours,
                                is_last_automated_step_delivered: true,
                            },
                        });
                    }
                    return;
                }

                if (contactEmailStatus === email_status.Valid) {
                    shouldAllowNextAutomatedActivity = true;
                }
            });

            if (shouldHandleFallback) {
                await this.handleEmailFailure(activityContact);
            }

            if (
                shouldAllowNextAutomatedActivity &&
                activity.CustomerCollectionPeriod
            ) {
                const businessService = new BusinessService();
                await businessService.allowNextAutomatedActivity(
                    activity.CustomerCollectionPeriod.id
                );
            }

            // Record learning data for intelligent channel selection
            try {
                // Get the customer ID from the activity
                const activityDetails = await prisma.activity.findUnique({
                    where: { id: activity.id },
                    select: {
                        customer_id: true,
                        schedule_time: true,
                    },
                });

                if (activityDetails) {
                    await this.learningService.recordCommunicationOutcome({
                        customerId: activityDetails.customer_id,
                        contactId: activityContact.contact_id,
                        channel:
                            activityContact.communication_channel as activity_type,
                        activityId: activity.id,
                        sentAt: activityDetails.schedule_time,
                        responseReceivedAt:
                            deliveryStatus === delivery_status.Delivered
                                ? deliveryTime || undefined
                                : undefined,
                        responseChannel:
                            deliveryStatus === delivery_status.Delivered
                                ? (activityContact.communication_channel as activity_type)
                                : undefined,
                        success: deliveryStatus === delivery_status.Delivered,
                        contextData: {
                            messageId,
                            status,
                            isFallbackAttempt:
                                activityContact.is_fallback_attempt,
                            category: activity.ActivitiesSequence?.category,
                        },
                    });
                }
            } catch (learningError: any) {
                // Log learning error but don't fail the main process
                await this.logService.logMessage(
                    LogLevel.WARNING,
                    `Failed to record learning data for email delivery: ${learningError.message}`,
                    "ActivityService"
                );
            }
        } catch (error) {
            throw this.handleError(error, "handleEmailDelivery");
        }
    }

    /**
     * Handles email delivery failure by attempting fallback channels
     */
    private async handleEmailFailure(activityContact: any): Promise<void> {
        try {
            const contact = activityContact.Contact;
            const activity = activityContact.Activity;

            // Check if contact has mobile number for SMS fallback
            if (contact.mobile) {
                await this.attemptSMSFallback(activityContact);
            } else if (contact.fallback_contact_id) {
                // Try fallback contact
                await this.attemptFallbackContact(activityContact);
            } else {
                // Log that no fallback options are available
                await this.logService.logMessage(
                    LogLevel.WARNING,
                    `No fallback options available for contact ${contact.id}`,
                    "ActivityService",
                    { contactId: contact.id, activityId: activity.id }
                );
            }
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to handle email failure: ${error.message}`,
                "ActivityService",
                { activityContactId: activityContact.id }
            );
        }
    }

    /**
     * Attempts SMS fallback for a contact
     */
    private async attemptSMSFallback(activityContact: any): Promise<void> {
        try {
            const contact = activityContact.Contact;
            const activity = activityContact.Activity;

            // Get SMS content from activity
            const smsContent = activity.content; // You might want to get SMS-specific content

            // Get customer's country and account data for SMS vendor selection
            const customer = await prisma.customer.findUnique({
                where: { id: Number(activity.customer_id) },
                select: {
                    country_id: true,
                    account_id: true,
                    // Note: Account removed from Customer select since Customer doesn't have Account relation
                    // Fetch Account separately using customer.account_id if needed
                },
            });

            if (!customer?.country_id) {
                throw new Error("Customer country not found");
            }

            // Fetch Account separately for sms_from_name
            const account = customer.account_id
                ? await prisma.account.findUnique({
                    where: { id: customer.account_id },
                    select: { sms_from_name: true },
                })
                : null;

            // Use customer's SMS from name if available, otherwise fallback to "ARchaser"
            const senderName = account?.sms_from_name || "ARchaser";

            const smsVendorService = new SMSVendorService();
            const smsResponse = await smsVendorService.sendSMS(
                contact.mobile,
                senderName,
                smsContent,
                customer.country_id,
                Number(activity.id),
                customer.account_id
            );

            if (smsResponse.success) {
                // Create fallback ActivityContact record
                await prisma.activityContact.create({
                    data: {
                        activity_id: activity.id,
                        contact_id: contact.id,
                        message_id: smsResponse.messageId,
                        status: delivery_status.Sent,
                        sent_at: new Date(),
                        communication_channel: activity_type.SMS,
                        is_fallback_attempt: true,
                        original_contact_id: activityContact.id,
                        escalation_level: 2,
                    },
                });

                await this.logService.logMessage(
                    LogLevel.INFO,
                    `SMS fallback sent successfully to contact ${contact.id}`,
                    "ActivityService",
                    { contactId: contact.id, activityId: activity.id }
                );
            }
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `SMS fallback failed: ${error.message}`,
                "ActivityService",
                { activityContactId: activityContact.id }
            );
        }
    }

    /**
     * Attempts fallback to another contact
     */
    private async attemptFallbackContact(activityContact: any): Promise<void> {
        try {
            const contact = activityContact.Contact;
            const activity = activityContact.Activity;

            // Get fallback contact
            const fallbackContact = await prisma.contact.findUnique({
                where: { id: contact.fallback_contact_id },
                select: {
                    id: true,
                    email: true,
                    mobile: true,
                    phone: true,
                    first_name: true,
                    last_name: true,
                    role: true,
                    priority_level: true,
                    company_wide_address: true,
                },
            });

            if (!fallbackContact) {
                throw new Error("Fallback contact not found");
            }

            // Create fallback ActivityContact record
            await prisma.activityContact.create({
                data: {
                    activity_id: activity.id,
                    contact_id: fallbackContact.id,
                    message_id: null, // Will be set when email is sent
                    status: delivery_status.Scheduled,
                    communication_channel: activity_type.Email,
                    is_fallback_attempt: true,
                    original_contact_id: activityContact.id,
                    escalation_level: 2,
                },
            });

            // Send email to fallback contact
            if (fallbackContact.email) {
                const emailService = new EmailService();

                // Fetch Account separately for account_id
                const accountId = activity.Customer?.account_id;
                if (!accountId) {
                    throw new Error("Customer account_id not found");
                }

                await emailService.setCustomerSenderNameAndReplyToEmail(
                    accountId
                );

                const emailResponse = await emailService.sendEmail(
                    fallbackContact.email,
                    activity.title || "Payment Reminder",
                    this.replaceContactContent(activity.content, {
                        first_name: fallbackContact.first_name,
                        last_name: fallbackContact.last_name,
                        email: fallbackContact.email,
                        phone: fallbackContact.phone,
                        mobile: fallbackContact.mobile,
                        role: fallbackContact.role,
                        company_wide_address:
                            fallbackContact.company_wide_address || false,
                    })
                );

                // Update the fallback ActivityContact with message ID
                await prisma.activityContact.updateMany({
                    where: {
                        activity_id: activity.id,
                        contact_id: fallbackContact.id,
                        is_fallback_attempt: true,
                    },
                    data: {
                        message_id: emailResponse?.messageId,
                        status: delivery_status.Sent,
                        sent_at: new Date(),
                    },
                });

                await this.logService.logMessage(
                    LogLevel.INFO,
                    `Fallback email sent to contact ${fallbackContact.id}`,
                    "ActivityService",
                    {
                        fallbackContactId: fallbackContact.id,
                        activityId: activity.id,
                    }
                );
            }
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Fallback contact attempt failed: ${error.message}`,
                "ActivityService",
                { activityContactId: activityContact.id }
            );
        }
    }

    /* ********** HANDLE EMAIL ENGAGEMENT ********** */
    public async handleEmailEngagement(
        messageId: string,
        eventType: string,
        parsedMessage: any
    ): Promise<void> {
        try {
            // Find the ActivityContact record
            // Try SES message ID first (for webhook notifications), then custom message ID (for HTML tracking)
            let activityContact = await prisma.activityContact.findFirst({
                where: { ses_message_id: messageId },
                select: {
                    id: true,
                    activity_id: true,
                    contact_id: true,
                    email_opened_at: true,
                    email_clicked_at: true,
                    email_open_count: true,
                    email_click_count: true,
                    modified_at: true,
                    Activity: {
                        select: {
                            id: true,
                            type: true,
                            title: true,
                        },
                    },
                    Contact: {
                        select: {
                            id: true,
                            email: true,
                            first_name: true,
                        },
                    },
                },
            });

            // If not found by SES message ID, try custom message ID (for HTML tracking pixels)
            if (!activityContact) {
                activityContact = await prisma.activityContact.findFirst({
                    where: { message_id: messageId },
                    select: {
                        id: true,
                        activity_id: true,
                        contact_id: true,
                        email_opened_at: true,
                        email_clicked_at: true,
                        email_open_count: true,
                        email_click_count: true,
                        modified_at: true,
                        Activity: {
                            select: {
                                id: true,
                                type: true,
                                title: true,
                            },
                        },
                        Contact: {
                            select: {
                                id: true,
                                email: true,
                                first_name: true,
                            },
                        },
                    },
                });
            }

            if (!activityContact) {
                // Log the event but don't throw an error - this is normal for test scenarios
                await this.logService.logMessage(
                    LogLevel.WARNING,
                    `No activity contact found for message ID: ${messageId}`,
                    "Email Engagement",
                    {
                        messageId,
                        eventType,
                        timestamp: new Date().toISOString(),
                    }
                );
                return; // Exit gracefully without throwing an error
            }

            const currentTime = moment().utc().toDate();
            const modified_ata: any = {};

            // Deduplication logic: prevent multiple increments within a short window (e.g., 5 seconds)
            // This handles cases where both a tracking pixel AND an SES webhook fire for the same event.
            // We use modified_at compared with email_opened_at/clicked_at to identify the last event type.
            const lastEngagementAt = (activityContact as any).modified_at;
            const lastOpenAt = activityContact.email_opened_at;
            const lastClickAt = activityContact.email_clicked_at;

            const isRecent = lastEngagementAt &&
                (moment().diff(moment(lastEngagementAt), 'seconds') < 5);

            // If the last modification was an Open and it was recent, it's a duplicate open
            const isDuplicateOpen = isRecent && lastOpenAt &&
                (lastOpenAt.getTime() === lastEngagementAt?.getTime());

            // If the last modification was a Click and it was recent, it's a duplicate click
            const isDuplicateClick = isRecent && lastClickAt &&
                (lastClickAt.getTime() === lastEngagementAt?.getTime());

            if (eventType === "Open") {
                // Only increment if not a recent duplicate open
                if (!isDuplicateOpen) {
                    modified_ata.email_open_count = {
                        increment: 1,
                    };

                    // Set/update open time
                    modified_ata.email_opened_at = currentTime;
                }

                modified_ata.modified_at = currentTime;

                // Log the email open event
                await this.logService.logMessage(
                    LogLevel.INFO,
                    `Email opened for activity ${activityContact.Activity.id}`,
                    "Email Engagement",
                    {
                        activityId: activityContact.Activity.id,
                        contactId: activityContact.contact_id,
                        contactEmail: activityContact.Contact.email,
                        messageId: messageId,
                        userAgent: parsedMessage.open?.userAgent,
                        ipAddress: parsedMessage.open?.ipAddress,
                        timestamp: parsedMessage.open?.timestamp,
                    }
                );
            } else if (eventType === "Click") {
                // Only increment if not a recent duplicate click
                if (!isDuplicateClick) {
                    modified_ata.email_click_count = {
                        increment: 1,
                    };

                    // Set/update click time
                    modified_ata.email_clicked_at = currentTime;
                }

                // Always update modified_at and log
                modified_ata.modified_at = currentTime;

                // Log the email click event
                await this.logService.logMessage(
                    LogLevel.INFO,
                    `Email clicked for activity ${activityContact.Activity.id}`,
                    "Email Engagement",
                    {
                        activityId: activityContact.Activity.id,
                        contactId: activityContact.contact_id,
                        contactEmail: activityContact.Contact.email,
                        messageId: messageId,
                        link: parsedMessage.click?.link,
                        userAgent: parsedMessage.click?.userAgent,
                        ipAddress: parsedMessage.click?.ipAddress,
                        timestamp: parsedMessage.click?.timestamp,
                    }
                );
            }

            // Update the ActivityContact record
            if (Object.keys(modified_ata).length > 0) {
                await prisma.activityContact.update({
                    where: { id: activityContact.id },
                    data: modified_ata,
                });
            }
        } catch (error) {
            throw this.handleError(error, "handleEmailEngagement");
        }
    }

    /* ********** HANDLE SMS DELIVERY ********** */
    public async handleSMSDelivery(
        messageId: string,
        status: string,
        error?: string,
        timestamp?: string
    ): Promise<void> {
        try {
            let activityStatus: ActivityStatus = ActivityStatus.FAILED; // Failed
            let contactDeliveryStatus: delivery_status = delivery_status.Failed;
            let deliveryStatus: delivery_status = delivery_status.Failed;

            if (
                status === "delivered" ||
                status === "delivery" ||
                status === "1"
            ) {
                activityStatus = ActivityStatus.DELIVERED; // Delivered
                contactDeliveryStatus = delivery_status.Delivered;
                deliveryStatus = delivery_status.Delivered;
            } else if (
                status === "failed" ||
                status === "rejected" ||
                status === "undelivered" ||
                status === "0"
            ) {
                contactDeliveryStatus = delivery_status.Failed;
                deliveryStatus = delivery_status.Failed;
                activityStatus = ActivityStatus.FAILED;
            } else if (
                status === "sent" ||
                status === "queued" ||
                status === "accepted" ||
                status === "sending" ||
                status === "2"
            ) {
                contactDeliveryStatus = delivery_status.Sent;
                deliveryStatus = delivery_status.Sent;
                activityStatus = ActivityStatus.SCHEDULED;
            }

            const deliveryTime =
                activityStatus === ActivityStatus.DELIVERED
                    ? moment().utc().toDate()
                    : null;

            // Find the ActivityContact record with optimized query
            const activityContact = await prisma.activityContact.findFirst({
                where: { message_id: messageId },
                select: {
                    id: true,
                    activity_id: true,
                    contact_id: true,
                    Activity: {
                        select: {
                            id: true,
                            type: true,
                            is_last_step: true,
                            ActivitiesSequence: {
                                select: {
                                    id: true,
                                    category: true,
                                    step: true,
                                },
                            },
                            CustomerCollectionPeriod: {
                                select: {
                                    id: true,
                                    current_category: true,
                                    last_automated_step: true,
                                    is_last_automated_step_delivered: true,
                                },
                            },
                            Customer: {
                                select: {
                                    company_id: true,
                                    account_id: true,
                                    // Note: Account removed from Customer select since Customer doesn't have Account relation
                                    // Fetch Account separately using customer.account_id if needed
                                },
                            },
                        },
                    },
                },
            });

            if (!activityContact) {
                throw new Error(
                    `No activity contact found for message ID: ${messageId}`
                );
            }

            const activity = (activityContact as any).Activity;

            // Parse timestamp if provided, otherwise use current time
            const eventTime = timestamp
                ? new Date(timestamp)
                : moment().utc().toDate();

            // Use transaction to optimize database operations
            await prisma.$transaction(async (tx: any) => {
                // Update ActivityContact status
                await tx.activityContact.update({
                    where: { id: activityContact.id },
                    data: {
                        status: deliveryStatus,
                        delivered_at:
                            deliveryStatus === delivery_status.Delivered
                                ? eventTime
                                : null,
                        sent_at:
                            deliveryStatus === delivery_status.Sent
                                ? eventTime
                                : null,
                        failed_at:
                            deliveryStatus === delivery_status.Failed
                                ? eventTime
                                : null,
                        failure_reason: error || null,
                    },
                });

                // Check if all contacts for this activity have been processed
                const allActivityContacts = await tx.activityContact.findMany({
                    where: { activity_id: activity.id },
                    select: { status: true },
                });

                const allDelivered = allActivityContacts.every(
                    (ac: any) => ac.status === delivery_status.Delivered
                );
                const anyDelivered = allActivityContacts.some(
                    (ac: any) => ac.status === delivery_status.Delivered
                );
                const anySent = allActivityContacts.some(
                    (ac: any) => ac.status === delivery_status.Sent || ac.status === delivery_status.Delivered
                );

                // Update activity status if all contacts are delivered or any contact is delivered or sent
                if (allDelivered || anyDelivered || anySent) {
                    await tx.activity.update({
                        where: { id: activity.id },
                        data: {
                            status: activityStatus,
                            status_reason: status,
                            actual_delivery_time:
                                deliveryStatus === delivery_status.Delivered
                                    ? eventTime
                                    : null,
                        },
                    });

                    if (activity.CustomerCollectionPeriod) {
                        const collectionPeriod =
                            activity.CustomerCollectionPeriod;

                        if (
                            activity.ActivitiesSequence?.category ===
                            "Automated"
                        ) {
                            await tx.customerCollectionPeriod.update({
                                where: { id: collectionPeriod.id },
                                data: {
                                    last_automated_step:
                                        activity.ActivitiesSequence.step,
                                },
                            });
                        }

                        if (collectionPeriod.current_category === "Automated") {
                            if (activity.is_last_step) {
                                // Fetch Account separately for wait_days_after_automated
                                const accountId = activity.Customer?.account_id;
                                const account = accountId
                                    ? await prisma.account.findUnique({
                                        where: { id: accountId },
                                        select: {
                                            wait_days_after_automated: true,
                                        },
                                    })
                                    : null;

                                const nextCategoryDate = moment()
                                    .utc()
                                    .toDate();
                                const nextCategoryDateWithHours = new Date(
                                    nextCategoryDate
                                );
                                nextCategoryDateWithHours.setHours(
                                    nextCategoryDateWithHours.getHours() +
                                    24 *
                                    (account?.wait_days_after_automated ||
                                        0)
                                );

                                // Don't set next_category for manually changed customers
                                // If is_last_automated_step_delivered is false, it means this customer was manually changed
                                if (
                                    collectionPeriod.is_last_automated_step_delivered ===
                                    false
                                ) {
                                    // For manually changed customers: mark step as delivered but don't set next_category
                                    // This allows processAutomatedCollectionPeriods to pick them up later
                                    await tx.customerCollectionPeriod.update({
                                        where: { id: collectionPeriod.id },
                                        data: {
                                            is_last_automated_step_delivered: true,
                                        },
                                    });
                                } else {
                                    // Only set next_category for customers that were NOT manually changed
                                    await this.logService.logMessage(
                                        LogLevel.INFO,
                                        `[handleSMSDelivery] Setting next_category=Agent (activity is_last_step=true)`,
                                        "ActivityService.handleSMSDelivery",
                                        {
                                            activityId: activity.id,
                                            activityStep:
                                                (activity as any)
                                                    .ActivitiesSequence?.step,
                                            is_last_step: activity.is_last_step,
                                            collectionPeriodId:
                                                collectionPeriod.id,
                                            customerId:
                                                activity.customer_id,
                                        }
                                    );
                                    await tx.customerCollectionPeriod.update({
                                        where: { id: collectionPeriod.id },
                                        data: {
                                            next_category: "Agent",
                                            next_category_date:
                                                nextCategoryDateWithHours,
                                            is_last_automated_step_delivered: true,
                                        },
                                    });
                                }
                            } else if (
                                contactDeliveryStatus ===
                                delivery_status.Delivered
                            ) {
                                // Defer business service call outside transaction to avoid long-running operations
                                // This will be handled after the transaction completes
                            }
                        }
                    }
                }
            });

            // Handle business service call outside transaction for better performance
            if (
                activity.CustomerCollectionPeriod &&
                activity.CustomerCollectionPeriod.current_category ===
                "Automated" &&
                !activity.is_last_step &&
                contactDeliveryStatus === delivery_status.Delivered
            ) {
                const businessService = new BusinessService();
                await businessService.allowNextAutomatedActivity(
                    activity.CustomerCollectionPeriod.id
                );
            }
        } catch (error) {
            // Log the error before rethrowing for debugging
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            console.error(
                `[ActivityService.handleSMSDelivery] Error: ${errorMessage}`,
                error
            );
            throw this.handleError(error, "handleSMSDelivery");
        }
    }

    /* ********** DELETE PROMISE TO PAY ACTIVITIES ********** */
    public async deletePromiseToPayActivities(
        collection_period_id: number
    ): Promise<void> {
        try {
            await prisma.activity.deleteMany({
                where: {
                    collection_period_id,
                    ActivitiesSequence: {
                        category: "Promise_to_pay",
                    },
                    status: {
                        in: [ActivityStatus.SCHEDULED, ActivityStatus.PAUSED],
                    },
                },
            });
        } catch (error) {
            throw this.handleError(error, "deletePromiseToPayActivities");
        }
    }

    /* ********** DELETE SCHEDULED AND PAUSED ACTIVITIES ********** */
    public async deleteScheduledAndPausedActivities(
        collection_period_id: number
    ): Promise<void> {
        try {
            await prisma.activity.deleteMany({
                where: {
                    collection_period_id,
                    status: {
                        in: [ActivityStatus.SCHEDULED, ActivityStatus.PAUSED],
                    },
                },
            });
        } catch (error) {
            throw this.handleError(error, "deleteScheduledAndPausedActivities");
        }
    }

    public async createCategoryChangeActivity(params: {
        customerId: number;
        collectionId: number;
        accountId: number;
        currentCategory: string;
        nextCategory: string;
        userId?: string;
        isManual?: boolean;
        translate?: (key: string) => string;
        dbClient?: DbClient;
        runPostCommitEffects?: boolean;
    }): Promise<Activity> {
        try {
            const {
                customerId,
                collectionId,
                accountId,
                currentCategory,
                nextCategory,
                userId,
                isManual = false,
                translate,
            } = params;

            // Build title based on whether it's manual or automatic
            let title: string;
            let titleParams: any = {};

            // Always include userId in titleParams if provided, regardless of isManual
            if (userId) {
                titleParams.userId = userId;
            }

            // Store translation keys in title_params (not translated values)
            // Categories will be translated when displaying the activity
            if (isManual) {
                title = "{{activities.fields.category_change}}";

                const currentCategoryKey = `customers.values.category_${currentCategory.toLowerCase().replace(/[_\s]/g, "_")}`;
                const nextCategoryKey = `customers.values.category_${nextCategory.toLowerCase().replace(/[_\s]/g, "_")}`;

                titleParams = {
                    ...titleParams,
                    oldCategory: currentCategoryKey,
                    newCategory: nextCategoryKey,
                };
            } else {
                const currentCategoryKey = currentCategory
                    ? `customers.values.category_${currentCategory.toLowerCase().replace(/[_\s]/g, "_")}`
                    : "unknown";
                const nextCategoryKey = `customers.values.category_${nextCategory.toLowerCase().replace(/[_\s]/g, "_")}`;

                // Use different title format based on whether previous category exists
                if (!currentCategory) {
                    // No previous category - use "Category changed to" format
                    title = "{{activities.fields.category_change_to}}";
                    titleParams = {
                        ...titleParams,
                        newCategory: nextCategoryKey,
                    };
                } else {
                    // Previous category exists - use "Category changed from X to Y" format
                    title = "{{activities.fields.category_change}}";
                    titleParams = {
                        ...titleParams,
                        oldCategory: currentCategoryKey,
                        newCategory: nextCategoryKey,
                    };
                }
            }

            // Use the existing createActivityWithFormattedDescription method which handles translations properly
            // Pass userId explicitly to ensure it's available for audit tracking
            return await this.createActivityWithFormattedDescription({
                customer_id: customerId,
                collection_period_id: collectionId,
                type: "Internal",
                title,
                schedule_time: moment().utc().toDate(),
                actual_delivery_time: moment().utc().toDate(),
                status: ActivityStatus.COMPLETED,
                account_id: accountId,
                systemGenerated: true,
                // translated at display time
                userId: userId, // Pass userId for audit tracking
                dbClient: params.dbClient,
                runPostCommitEffects: params.runPostCommitEffects,
                titleParams,
            });
        } catch (error) {
            throw this.handleError(error, "createCategoryChangeActivity");
        }
    }

    /**
     * Consolidated method to generate language-aware content for scheduled activities
     * This method handles all the logic for language resolution and content selection
     * @param template The base activity template with language variants
     * @param customer The customer object with language info
     * @param activityType The type of activity (Email, SMS, WhatsApp, etc.)
     * @returns An object with resolved language, template content, and processed content
     */
    private async generateLanguageAwareContent(
        template: {
            id: number;
            // email_subject/email_content/sms_content/whatsapp_content removed from ActivitiesTemplate;
            // content now lives exclusively in ActivityTemplateLanguage
            ActivityTemplateLanguage?: Array<{
                language: string;
                email_subject: string | null;
                email_content: string | null;
                sms_content: string | null;
                whatsapp_content: string | null;
            }>;
        } | null,
        customer: {
            account_id: number;
            language: string | null;
            Country?: { id: number } | null;
            Account: {
                id: number;
                name: string | null;
                logo: string | null;
                sub_domain: string | null;
            };
            Company?: { name: string } | null;
            Person?: { first_name: string | null } | null;
            customer_uuid: string;
            type: "Person" | "Company";
        },
        activityType: Activity["type"]
    ): Promise<{
        templateContent: string;
        subject?: string | null;
        language: string;
    }> {
        if (!template) {
            throw new Error("Template not found");
        }

        // Step 1: Get account's default language
        const account = await prisma.account.findUnique({
            where: { id: customer.account_id },
            select: { default_language: true, use_customer_language: true },
        });

        const defaultLanguage = account?.default_language || "English";

        // Step 2: Determine the desired language for the customer (before checking template existence)
        // We need to know what language the customer SHOULD use, not what we CAN use
        let desiredLanguage: string;
        if (account?.use_customer_language) {
            // If customer language is enabled, determine based on customer's language or country
            if (customer.language) {
                desiredLanguage = customer.language;
            } else if (customer.Country?.id) {
                // Map country to language
                const countryLanguageMap: { [key: number]: string } = {
                    106: "Hebrew", // Israel
                    49: "German", // Germany
                    34: "Spanish", // Spain
                    33: "French", // France
                    39: "Italian", // Italy
                    351: "Portuguese", // Portugal
                };
                desiredLanguage =
                    countryLanguageMap[customer.Country.id] || defaultLanguage;
            } else {
                desiredLanguage = defaultLanguage;
            }
        } else {
            // If use_customer_language is disabled, use account's default language
            desiredLanguage = defaultLanguage;
        }

        // Step 3: Resolve the actual language to use (with template existence check)
        const resolvedLanguage =
            await LanguageResolutionService.resolveNotificationLanguage(
                customer.account_id,
                customer.language,
                customer.Country?.id || null,
                true
            );

        // Step 4: Check if customer's desired language template exists before selecting
        const customerLanguageTemplate =
            template.ActivityTemplateLanguage?.find(
                (lang) => lang.language === desiredLanguage
            );

        // Check if we should notify about missing template
        // Notify if: desired language template is missing AND desired language differs from default AND templates exist
        const shouldNotify =
            !customerLanguageTemplate &&
            desiredLanguage &&
            desiredLanguage !== defaultLanguage &&
            template.ActivityTemplateLanguage &&
            template.ActivityTemplateLanguage.length > 0; // Only notify if language templates exist but not for this language

        // Step 3.5: Create notification if template is missing for customer's language
        if (shouldNotify) {
            try {
                // Get customer ID from customer_uuid (using filter since customer_uuid is not unique)
                const customerRecord = await prisma.customer.findFirst({
                    where: {
                        customer_uuid: customer.customer_uuid,
                        account_id: customer.account_id,
                    },
                    select: { id: true },
                });

                // Get customer name
                let customerName = `Customer #${customer.customer_uuid || "unknown"}`;
                if (customer.Person?.first_name) {
                    customerName = customer.Person.first_name.trim();
                } else if (customer.Company?.name) {
                    customerName = customer.Company.name;
                }

                // Determine channel from activity type
                let channel: "Email" | "SMS" | "WhatsApp" = "Email";
                if (activityType === "SMS") {
                    channel = "SMS";
                } else if (activityType === "WhatsApp") {
                    channel = "WhatsApp";
                }

                // Only create notification if we found the customer ID
                if (customerRecord?.id) {
                    const NotificationService = (
                        await import("./NotificationService")
                    ).default;
                    const notificationService =
                        NotificationService.getInstance();
                    await notificationService.createTemplateMissingNotification(
                        customer.account_id,
                        customerRecord.id,
                        customerName,
                        desiredLanguage, // Use desired language, not resolved language
                        activityType,
                        channel,
                        template.id
                    );
                }
            } catch (notificationError) {
                // Log but don't fail the activity creation
                this.logService.logMessage(
                    LogLevel.ERROR,
                    `Failed to create template missing notification: ${notificationError}`,
                    "ActivityService.generateLanguageAwareContent",
                    {
                        accountId: customer.account_id,
                        resolvedLanguage,
                        activityType,
                        error:
                            notificationError instanceof Error
                                ? notificationError.message
                                : String(notificationError),
                    }
                );
            }
        }

        // Step 4: Get the appropriate content based on activity type
        // Find the template for the resolved language (the language we'll actually use)
        const languageTemplate =
            template.ActivityTemplateLanguage?.find(
                (lang) => lang.language === resolvedLanguage
            ) || customerLanguageTemplate; // Fallback to acc language template if resolved language template not found

        let templateContent = "";
        let subject: string | null = null;

        if (languageTemplate) {
            switch (activityType) {
                case "SMS":
                    templateContent = languageTemplate.sms_content ?? "";
                    break;
                case "WhatsApp":
                    templateContent = languageTemplate.whatsapp_content ?? "";
                    break;
                case "Email":
                    subject = languageTemplate.email_subject ?? null;
                    templateContent = languageTemplate.email_content ?? "";
                    break;
                default:
                    templateContent = languageTemplate.email_content ?? "";
                    break;
            }
        }

        // Note: There is no fallback to main-template content because the content
        // fields (email_content, sms_content, etc.) were removed from ActivitiesTemplate.
        // If no language template has content, templateContent will remain empty
        // and the caller's empty-content validator will handle it gracefully.

        // Step 5: Replace customer and customer content placeholders
        let processedContent = this.replaceCustomerContent(templateContent, {
            id: customer.Account.id,
            name: customer.Account.name || "",
            logo: customer.Account.logo || null,
            sub_domain: customer.Account.sub_domain || "",
        });

        const customerContentData: {
            type: "Person" | "Company";
            customer_uuid: string;
            Person?: { first_name: string | null } | null;
            Company?: { name: string } | null;
            Account: {
                id: number;
                name: string | null;
                logo: string | null;
                sub_domain: string | null;
            };
            language?: string | null;
        } = {
            type: customer.type,
            customer_uuid: customer.customer_uuid,
            Person: customer.Person,
            Company: customer.Company ? { name: customer.Company.name } : null,
            Account: {
                id: customer.Account.id,
                name: customer.Account.name || "",
                logo: customer.Account.logo || null,
                sub_domain: customer.Account.sub_domain || "",
            },
            language: customer.language || null,
        };
        processedContent = this.replaceCustomerContent(
            processedContent,
            customerContentData
        );

        return {
            templateContent: processedContent,
            subject,
            language: resolvedLanguage,
        };
    }

    /**
     * Helper method to select language-specific template content based on activity type
     * Logic: customer language → account default → English → main template
     * @param template The base activity template
     * @param customerLanguage The customer's preferred language
     * @param activityType The type of activity (Email, SMS, WhatsApp, etc.)
     * @param defaultLanguage The account's default language
     * @returns The appropriate template content (language-specific or fallback) and resolved language
     */
    private selectLanguageTemplate(
        template: {
            id: number;
            email_subject: string | null;
            email_content: string | null;
            sms_content: string | null;
            whatsapp_content: string | null;
            ActivityTemplateLanguage?: Array<{
                language: string;
                email_subject: string | null;
                email_content: string | null;
                sms_content: string | null;
                whatsapp_content: string | null;
            }>;
        } | null,
        customerLanguage: string | null,
        activityType: Activity["type"],
        defaultLanguage: string = "English"
    ): {
        languageTemplate: {
            id: number;
            subject: string | null;
            content: string | null;
            sms_content: string | null;
            whatsapp_content: string | null;
        };
        resolvedLanguage: string;
    } | null {
        if (!template) return null;

        const selectedLanguage = customerLanguage || "English";
        let resolvedLanguage: string = selectedLanguage;

        // Try 1: Find language-specific template for customer's language
        let languageTemplate = template.ActivityTemplateLanguage?.find(
            (lang: { language: string }) => lang.language === selectedLanguage
        );

        // Try 2: If not found and customer language is different from default, try default language template
        if (!languageTemplate && selectedLanguage !== defaultLanguage) {
            languageTemplate = template.ActivityTemplateLanguage?.find(
                (lang: { language: string }) =>
                    lang.language === defaultLanguage
            );

            if (languageTemplate) {
                resolvedLanguage = defaultLanguage;
            }
        }

        // Try 3: If still not found, use English template
        if (!languageTemplate) {
            languageTemplate = template.ActivityTemplateLanguage?.find(
                (lang: { language: string }) => lang.language === "English"
            );

            if (languageTemplate) {
                resolvedLanguage = "English";
            }
        }

        // Try 4: Fall back to main template (no language-specific version)
        // If we're using main template, set resolvedLanguage to defaultLanguage to indicate fallback
        if (!languageTemplate) {
            resolvedLanguage = defaultLanguage || "English";
        }
        const templateContent = languageTemplate || template;

        let subject: string | null = null;
        let content: string | null = null;

        switch (activityType) {
            case "Email":
                subject = templateContent.email_subject;
                content = templateContent.email_content;
                break;
            case "SMS":
                content = templateContent.sms_content;
                break;
            case "WhatsApp":
                content = templateContent.whatsapp_content;
                break;
            default:
                subject = templateContent.email_subject;
                content = templateContent.email_content;
                break;
        }

        return {
            languageTemplate: {
                id: template.id,
                subject,
                content,
                sms_content: templateContent.sms_content,
                whatsapp_content: templateContent.whatsapp_content,
            },
            resolvedLanguage,
        };
    }

    /* ********** CREATE COMMENT ACTIVITY WITHOUT COLLECTION PERIOD ********** */
    public async createCommentActivityWithoutCollectionPeriod(params: {
        customer_id: number;
        type: activity_type;
        title: string;
        comment: string;
        account_id: number;
        contact_id?: number;
        schedule_time?: Date;
        actual_delivery_time?: Date;
        status?: ActivityStatus;
    }): Promise<Activity> {
        try {
            const account = await prisma.account.findUnique({
                where: { id: params.account_id },
                select: {
                    has_collection: true,
                    has_credit_insurance: true,
                },
            });
            if (isCreditOnlyAccount(account)) {
                throw new Error(
                    "Collection periods are not available for credit-only accounts"
                );
            }

            // Create a default collection period if none exists
            const defaultCollectionPeriod =
                await prisma.customerCollectionPeriod.create({
                    data: {
                        customer_id: params.customer_id,
                        period_start_date: new Date(),
                        period_end_date: null,
                        current_category: "Agent",
                        priority: "Normal",
                        total_outstanding_amount: 0,
                        no_of_overdue_invoices: 0,
                        last_automated_step: null,
                        next_category: null,
                        next_category_date: null,
                        previous_category: null,
                        promise_to_pay_date: null,
                        last_dispute_date: null,
                        customer_outstanding_amount1: 0,
                        customer_outstanding_amount2: null,
                        customer_currency1: "USD",
                        customer_currency2: null,
                        last_call: null,
                        last_call_result: null,
                        follow_up_time: null,
                        promise_to_pay_amount: null,
                        promise_to_pay_count: 0,
                        create_next_activity: false,
                        next_activity_date: null,
                        is_last_automated_step_delivered: false,
                        currency: "USD",
                    },
                });

            const { syncCustomerInsuranceFields } = await import(
                "@/server/services/creditInsurance/syncCustomerInsuranceFields"
            );
            await syncCustomerInsuranceFields(params.customer_id);

            return await prisma.activity.create({
                data: {
                    customer_id: params.customer_id,
                    collection_period_id: defaultCollectionPeriod.id,
                    type: params.type,
                    title: params.title,
                    content: params.comment,
                    schedule_time: params.schedule_time || new Date(),
                    actual_delivery_time:
                        params.actual_delivery_time || new Date(),
                    status: params.status || ActivityStatus.COMPLETED,
                    account_id: params.account_id,
                    contact_id: params.contact_id,
                    system_generated: true,
                },
            });
        } catch (error) {
            throw this.handleError(
                error,
                "createCommentActivityWithoutCollectionPeriod"
            );
        }
    }

    /* ********** CANCEL SCHEDULED ACTIVITIES ********** */
    /**
     * Unified method to cancel scheduled activities
     * @param collection_period_id - The collection period ID
     * @param reason - Optional reason for cancellation (if provided, updates activity titles)
     * @param userId - Optional user ID for tracking who cancelled the activity
     */
    public async cancelScheduledActivities(
        collection_period_id: number,
        reason?: string,
        userId?: string,
        dbClient: DbClient = prisma
    ): Promise<void> {
        try {
            // Find all scheduled reminder activities for this collection period
            // Only cancel activities that are part of an activity sequence (reminder activities),
            // not logged activities (which have status COMPLETED anyway)
            const scheduledActivities = await dbClient.activity.findMany({
                where: {
                    collection_period_id,
                    status: {
                        in: [ActivityStatus.SCHEDULED],
                    },
                    // Only cancel scheduled reminder activities, not logged activities
                    ActivitiesSequence: {
                        isNot: null,
                    },
                },
                select: {
                    id: true,
                    title: true,
                    status: true,
                    type: true,
                    ActivitiesSequence: {
                        select: {
                            step: true,
                            category: true,
                            step_type: true,
                        },
                    },
                },
            });

            if (scheduledActivities.length === 0) {
                return;
            }

            if (reason) {
                // Update each scheduled activity with cancellation title
                const updatePromises = scheduledActivities.map(
                    (activity: any) => {
                        const cancelledStatus = this.getCancelledStatusForType(
                            activity.status
                        );

                        // Use proper translation key instead of generic cancellation message
                        let updatedTitle = activity.title;

                        if (activity.ActivitiesSequence?.step_type === "due") {
                            updatedTitle = `{{activities.fields.activity_due_notification_canceled}}`;
                        } else if (activity.type === "Promise_to_pay") {
                            updatedTitle = `{{activities.fields.activity_promise_to_pay_canceled}}`;
                        } else if (
                            activity.ActivitiesSequence?.category ===
                            "Automated" &&
                            activity.ActivitiesSequence?.step
                        ) {
                            updatedTitle = `{{activities.fields.activity_automated_step_canceled}}`;
                            updatedTitle = updatedTitle.replace(
                                "{{step}}",
                                activity.ActivitiesSequence.step.toString()
                            );
                        } else {
                            updatedTitle = `${activity.title}`;
                        }

                        const modified_ata: any = {
                            status: cancelledStatus,
                            title: updatedTitle,
                            schedule_time: new Date(),
                            modified_at: new Date(),
                        };

                        // Merge existing title_params to preserve count and other parameters
                        if (activity.title_params || userId) {
                            let params =
                                typeof activity.title_params === "string"
                                    ? JSON.parse(activity.title_params)
                                    : activity.title_params || {};

                            modified_ata.title_params = {
                                ...params,
                                userId: userId || "system",
                            };
                        }

                        // Special handling for Promise_to_pay activities
                        if (
                            activity.type === "Promise_to_pay" ||
                            activity.type === "Promise to pay"
                        ) {
                            // Clear content for cancelled Promise to Pay activities
                            // since the email was never sent, we shouldn't show the email template
                            modified_ata.content = "";
                        }

                        return dbClient.activity.update({
                            where: { id: activity.id },
                            data: modified_ata,
                        });
                    }
                );

                await Promise.all(updatePromises);
            } else {
                // Bulk update without changing titles
                await Promise.all([
                    dbClient.activity.updateMany({
                        where: {
                            collection_period_id,
                            status: ActivityStatus.SCHEDULED,
                        },
                        data: {
                            status: ActivityStatus.CANCELLED,
                            schedule_time: new Date(),
                        },
                    }),
                    dbClient.activity.updateMany({
                        where: {
                            collection_period_id,
                            status: ActivityStatus.SCHEDULED,
                        },
                        data: {
                            status: ActivityStatus.CANCELLED,
                            schedule_time: new Date(),
                        },
                    }),
                    dbClient.activity.updateMany({
                        where: {
                            collection_period_id,
                            status: ActivityStatus.SCHEDULED,
                        },
                        data: {
                            status: ActivityStatus.CANCELLED,
                            schedule_time: new Date(),
                        },
                    }),
                ]);
            }
        } catch (error) {
            throw this.handleError(error, "cancelScheduledActivities");
        }
    }

    /**
     * Cancel only non-Promise-to-Pay scheduled activities
     * This is used when creating Promise to Pay scheduled activities to avoid
     * cancelling existing Promise to Pay scheduled activities unnecessarily
     */
    private async cancelNonPromiseToPayScheduledActivities(
        collection_period_id: number,
        userId?: string
    ): Promise<void> {
        try {
            // Find all scheduled activities that are NOT Promise_to_pay
            const scheduledActivities = await prisma.activity.findMany({
                where: {
                    collection_period_id,
                    status: {
                        in: [ActivityStatus.SCHEDULED],
                    },
                    type: {
                        not: "Promise_to_pay",
                    },
                },
                select: {
                    id: true,
                    title: true,
                    status: true,
                    type: true,
                    ActivitiesSequence: {
                        select: {
                            step: true,
                            category: true,
                        },
                    },
                },
            });

            if (scheduledActivities.length === 0) {
                return;
            }

            // Update each scheduled activity with cancellation title
            const updatePromises = scheduledActivities.map((activity: any) => {
                const cancelledStatus = this.getCancelledStatusForType(
                    activity.status
                );

                // Use proper translation key instead of generic cancellation message
                let updatedTitle = activity.title;

                if (
                    activity.ActivitiesSequence?.category === "Automated" &&
                    activity.ActivitiesSequence?.step
                ) {
                    updatedTitle = `{{activities.fields.activity_automated_step_canceled}}`;
                    updatedTitle = updatedTitle.replace(
                        "{{step}}",
                        activity.ActivitiesSequence.step.toString()
                    );
                } else {
                    updatedTitle = `${activity.title}`;
                }

                const modified_ata: any = {
                    status: cancelledStatus,
                    title: updatedTitle,
                    schedule_time: new Date(),
                    modified_at: new Date(),
                };

                return prisma.activity.update({
                    where: { id: activity.id },
                    data: modified_ata,
                });
            });

            await Promise.all(updatePromises);
        } catch (error) {
            throw this.handleError(
                error,
                "cancelNonPromiseToPayScheduledActivities"
            );
        }
    }

    /**
     * Cancel existing Promise_to_pay scheduled activities to prevent duplicates
     * when creating new promise to pay scheduled activities
     * Only cancels activities that don't match the current promise_to_pay_date
     */
    private async cancelPromiseToPayScheduledActivities(
        collection_period_id: number,
        userId?: string,
        currentPromiseToPayDate?: Date | null
    ): Promise<void> {
        try {
            // Build where clause to exclude activities matching current promise date
            const whereClause: any = {
                collection_period_id,
                status: {
                    in: [ActivityStatus.SCHEDULED],
                },
                type: "Promise_to_pay",
            };

            // If we have a current promise date, only cancel activities scheduled for different dates
            if (currentPromiseToPayDate) {
                const promiseDate = new Date(currentPromiseToPayDate);
                const startOfDay = new Date(
                    Date.UTC(
                        promiseDate.getUTCFullYear(),
                        promiseDate.getUTCMonth(),
                        promiseDate.getUTCDate()
                    )
                );
                const endOfDay = new Date(startOfDay);
                endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

                // Only cancel activities that are NOT scheduled for the current promise date
                // Use AND to combine base conditions with date exclusion
                whereClause.AND = [
                    {
                        collection_period_id,
                        status: {
                            in: [ActivityStatus.SCHEDULED],
                        },
                        type: "Promise_to_pay",
                    },
                    {
                        OR: [
                            { schedule_time: { lt: startOfDay } },
                            { schedule_time: { gte: endOfDay } },
                        ],
                    },
                ];
                // Remove the duplicate fields from root level
                delete whereClause.collection_period_id;
                delete whereClause.status;
                delete whereClause.type;
            }

            // Find all scheduled Promise_to_pay activities that should be canceled
            const scheduledActivities = await prisma.activity.findMany({
                where: whereClause,
                select: {
                    id: true,
                    title: true,
                    status: true,
                    type: true,
                    schedule_time: true,
                },
            });

            if (scheduledActivities.length === 0) {
                return;
            }

            // Update each scheduled activity with cancellation
            const updatePromises = scheduledActivities.map((activity: any) => {
                const cancelledStatus = this.getCancelledStatusForType(
                    activity.status
                );

                // Use proper translation key for cancelled promise to pay
                const updatedTitle =
                    "{{activities.fields.activity_promise_to_pay_canceled}}";

                const modified_ata: any = {
                    status: cancelledStatus,
                    title: updatedTitle,
                    schedule_time: new Date(),
                    modified_at: new Date(),
                };

                return prisma.activity.update({
                    where: { id: activity.id },
                    data: modified_ata,
                });
            });

            await Promise.all(updatePromises);
        } catch (error) {
            throw this.handleError(
                error,
                "cancelPromiseToPayScheduledActivities"
            );
        }
    }

    /**
     * Helper method to get the cancelled status ID based on the scheduled status ID
     */
    private getCancelledStatusForType(scheduledStatus: any): ActivityStatus {
        // Handle both database enum and TypeScript enum values
        if (
            scheduledStatus === ActivityStatus.SCHEDULED ||
            scheduledStatus === "SCHEDULED"
        ) {
            return ActivityStatus.CANCELLED;
        }
        return ActivityStatus.CANCELLED;
    }

    public async createManualCategoryChangeActivity(params: {
        customerId: number;
        collectionId: number;
        accountId: number;
        currentCategory: string;
        nextCategory: string;
        userId?: string;
        translate?: (key: string) => string;
        dbClient?: DbClient;
        runPostCommitEffects?: boolean;
    }): Promise<Activity> {
        try {
            const {
                customerId,
                collectionId,
                accountId,
                currentCategory,
                nextCategory,
                userId,
                translate,
            } = params;

            // Use the new category change title format
            const title = "{{activities.fields.category_change}}";
            // Store translation keys in title_params (not translated values)
            // Categories will be translated when displaying the activity
            const titleParams = {
                userId: userId || "system",
                oldCategory: `customers.values.category_${currentCategory.toLowerCase().replace(/[_\s]/g, "_")}`,
                newCategory: `customers.values.category_${nextCategory.toLowerCase().replace(/[_\s]/g, "_")}`,
            };

            // Use the existing createActivityWithFormattedDescription method which handles translations properly
            return await this.createActivityWithFormattedDescription({
                customer_id: customerId,
                collection_period_id: collectionId,
                type: "Internal",
                title: title,
                schedule_time: moment().utc().toDate(),
                actual_delivery_time: moment().utc().toDate(),
                status: ActivityStatus.COMPLETED,
                account_id: accountId,
                systemGenerated: true,
                // translated at display time
                userId: userId, // Pass userId for audit tracking
                dbClient: params.dbClient,
                runPostCommitEffects: params.runPostCommitEffects,
                titleParams: titleParams,
            });
        } catch (error) {
            throw this.handleError(error, "createManualCategoryChangeActivity");
        }
    }

    /* ********** UPDATE SCHEDULED ACTIVITIES LANGUAGE ********** */
    /**
     * Update scheduled activities when customer language changes
     * This method updates the content, title, and subject of scheduled activities
     * to match the new customer language
     * @param customerId - The customer ID
     * @param newLanguage - The new language for the customer
     * @param accountId - The account ID
     * @param userId - Optional user ID for audit tracking
     * @returns Object with count of updated activities
     */
    public async updateScheduledActivitiesLanguage(
        customerId: number,
        newLanguage: string,
        accountId: number,
        userId?: string
    ): Promise<{ updatedCount: number }> {
        try {
            // Find all scheduled activities for this customer that have a template reference
            const scheduledActivities = await prisma.activity.findMany({
                where: {
                    customer_id: customerId,
                    status: ActivityStatus.SCHEDULED,
                    activity_template: {
                        not: null,
                    },
                },
                include: {
                    ActivitiesTemplate: {
                        include: {
                            ActivityTemplateLanguage: true,
                        },
                    },
                },
                orderBy: {
                    schedule_time: "asc",
                },
            });

            if (scheduledActivities.length === 0) {
                this.logService.logMessage(
                    LogLevel.INFO,
                    `No scheduled activities found for customer ${customerId}`,
                    "ActivityService.updateScheduledActivitiesLanguage",
                    { customerId, newLanguage, accountId }
                );
                return { updatedCount: 0 };
            }

            // Fetch customer data for language resolution
            const customer = await prisma.customer.findUnique({
                where: { id: customerId },
                include: {
                    Country: {
                        select: { id: true },
                    },
                    Account: {
                        select: {
                            id: true,
                            name: true,
                            logo: true,
                            sub_domain: true,
                        },
                    },
                    Person: {
                        select: { first_name: true },
                    },
                    Company: {
                        select: { name: true },
                    },
                },
            });

            if (!customer) {
                throw new Error(`Customer ${customerId} not found`);
            }

            // Update customer object with new language for content generation
            const customerWithNewLanguage = {
                ...customer,
                language: newLanguage,
            };

            // Process activities in batches of 50
            const BATCH_SIZE = 50;
            let updatedCount = 0;

            for (let i = 0; i < scheduledActivities.length; i += BATCH_SIZE) {
                const batch = scheduledActivities.slice(i, i + BATCH_SIZE);
                const updatePromises = batch.map(async (activity) => {
                    try {
                        if (!activity.ActivitiesTemplate) {
                            this.logService.logMessage(
                                LogLevel.WARNING,
                                `Activity ${activity.id} has no template, skipping`,
                                "ActivityService.updateScheduledActivitiesLanguage",
                                { activityId: activity.id, customerId }
                            );
                            return null;
                        }

                        // Generate language-aware content using the new language
                        const { templateContent, subject, language } =
                            await this.generateLanguageAwareContent(
                                activity.ActivitiesTemplate,
                                customerWithNewLanguage as any,
                                activity.type
                            );

                        // Prepare update data - only update content, not title
                        // The title is displayed in the timeline and should remain unchanged
                        const modified_ata: any = {
                            content: templateContent,
                            modified_at: new Date(),
                        };

                        if (userId) {
                            modified_ata.modified_by = userId;
                        }

                        // Note: We do NOT update the title field
                        // The title is what's shown in the activity timeline and should remain in its original format
                        // Only the email/SMS content body should be updated to the new language

                        // Update the activity
                        await prisma.activity.update({
                            where: { id: activity.id },
                            data: modified_ata,
                        });

                        this.logService.logMessage(
                            LogLevel.INFO,
                            `Updated activity ${activity.id} to language ${language}`,
                            "ActivityService.updateScheduledActivitiesLanguage",
                            {
                                activityId: activity.id,
                                customerId,
                                oldLanguage: customer.language,
                                newLanguage: language,
                                activityType: activity.type,
                            }
                        );

                        return activity.id;
                    } catch (error) {
                        this.logService.logMessage(
                            LogLevel.ERROR,
                            `Failed to update activity ${activity.id}: ${error instanceof Error ? error.message : String(error)}`,
                            "ActivityService.updateScheduledActivitiesLanguage",
                            {
                                activityId: activity.id,
                                customerId,
                                error:
                                    error instanceof Error
                                        ? error.message
                                        : String(error),
                            }
                        );
                        return null;
                    }
                });

                const results = await Promise.all(updatePromises);
                updatedCount += results.filter((r) => r !== null).length;
            }

            this.logService.logMessage(
                LogLevel.INFO,
                `Successfully updated ${updatedCount} scheduled activities for customer ${customerId}`,
                "ActivityService.updateScheduledActivitiesLanguage",
                {
                    customerId,
                    newLanguage,
                    updatedCount,
                    totalActivities: scheduledActivities.length,
                }
            );

            return { updatedCount };
        } catch (error) {
            throw this.handleError(error, "updateScheduledActivitiesLanguage");
        }
    }
}
