/**
 * DueNotificationService - Processes due invoice notifications
 *
 * Sends notifications for invoices that are due (or due in N days) based on
 * ActivitiesSequence steps with step_type='due' and days_before_due.
 *
 * Flow:
 * 1. Find due steps (step_type='due') from all Automated sequence containers
 * 2. For each step, find invoices due on target date (today + days_before_due)
 * 3. For each invoice: check deduplication, get contacts, create Activity, send
 */

import { DbClient, prisma } from "@/lib/prisma";
import { ActivityStatus } from "@/types/enums";
import { scheduleDateTime } from "@/utils/datetimeOperations";

import { EmailService } from "../EmailService";
import { ActivityService } from "./ActivityService";
import { SMSVendorService } from "./SMSVendorService";
import { getSystemUserId } from "./UserService";

const INVOICE_STATUS_DUE = "Due";
const BATCH_SIZE = 100;
const LOOK_AHEAD_DAYS = 15; // Pre-create activities for invoices due within the next 15 days

export class DueNotificationService {
    private activityService: ActivityService;
    private emailService: EmailService;
    private smsVendorService: SMSVendorService;

    constructor() {
        this.activityService = new ActivityService();
        this.emailService = new EmailService();
        this.smsVendorService = new SMSVendorService();
    }

    /**
     * Process due notifications for all accounts with due steps
     */
    async processDueNotifications(options?: {
        customerId?: number;
        logCallback?: (
            message: string,
            level: "INFO" | "ERROR" | "WARNING" | "DEBUG",
            parameters?: any
        ) => void;
        stepCollector?: {
            addStep: (
                step: string,
                message: string,
                level?: "INFO" | "ERROR" | "WARNING" | "DEBUG",
                parameters?: any,
                results?: any,
                duration?: number
            ) => void;
        };
        skipSmsSend?: boolean;
        fastForwardScheduledActivities?: boolean;
    }): Promise<{
        success: boolean;
        processed: number;
        sent: number;
        skipped: number;
        errors: string[];
    }> {
        const logCallback = options?.logCallback;
        const stepCollector = options?.stepCollector;
        const customerId = options?.customerId;
        const skipSmsSend = options?.skipSmsSend;
        const fastForwardScheduledActivities = options?.fastForwardScheduledActivities;
        const stats = { processed: 0, sent: 0, skipped: 0, errors: [] as string[] };

        try {
            const now = new Date();
            // Use UTC for "today" so nearest-only filter and invoice window align regardless of server TZ
            const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
            const lookAheadEnd = new Date(today);
            lookAheadEnd.setUTCDate(lookAheadEnd.getUTCDate() + LOOK_AHEAD_DAYS);
            lookAheadEnd.setUTCHours(23, 59, 59, 999);

            stepCollector?.addStep(
                "FETCH_STEPS",
                `Fetching due notification steps (${LOOK_AHEAD_DAYS}-day look-ahead window, nearest only)`,
                "INFO",
                {
                    today: today.toISOString().split('T')[0],
                    lookAheadEnd: lookAheadEnd.toISOString().split('T')[0],
                    lookAheadDays: LOOK_AHEAD_DAYS
                }
            );

            // 1. Get all due steps from Automated sequences
            let customerAccountId: number | undefined;
            if (customerId) {
                const customer = await prisma.customer.findUnique({
                    where: { id: customerId },
                    select: { account_id: true }
                });
                customerAccountId = customer?.account_id;
            }

            const dueSteps = await prisma.activitiesSequence.findMany({
                where: {
                    category: "Automated",
                    active: true,
                    step_type: "due",
                    days_before_due: { not: null },
                    ...(customerAccountId ? { account_id: customerAccountId } : {})
                },
                include: {
                    ActivitiesTemplate: {
                        include: {
                            ActivityTemplateLanguage: true,
                        },
                    },
                },
                orderBy: { days_before_due: "desc" },
            });

            if (dueSteps.length === 0) {
                stepCollector?.addStep(
                    "NO_STEPS",
                    "No due notification steps configured",
                    "INFO"
                );
                logCallback?.("No due notification steps configured", "INFO");
                return { success: true, ...stats };
            }

            stepCollector?.addStep(
                "STEPS_FOUND",
                `Found ${dueSteps.length} due notification steps`,
                "INFO",
                {
                    count: dueSteps.length,
                    steps: dueSteps.map(s => ({
                        id: s.id,
                        account: s.account_id,
                        days_before: s.days_before_due,
                        container: s.sequence_container_id
                    }))
                }
            );

            logCallback?.(
                `Found ${dueSteps.length} due notification steps`,
                "DEBUG",
                { steps: dueSteps.map(s => ({ id: s.id, account: s.account_id, days_before: s.days_before_due })) }
            );

            const accountIds = Array.from(
                new Set(dueSteps.map((s) => s.account_id))
            );
            const defaultContainers = await prisma.sequenceContainer.findMany({
                where: {
                    account_id: { in: accountIds },
                    category: "Automated",
                    is_default: true,
                    active: true,
                },
                select: { id: true, account_id: true },
            });
            const defaultContainerByAccount = new Map(
                defaultContainers.map((c) => [c.account_id, c.id])
            );

            logCallback?.(
                `Found ${defaultContainers.length} default containers`,
                "DEBUG",
                { containers: Array.from(defaultContainerByAccount.entries()) }
            );

            // 2. For each due step, find invoices due within the look-ahead window
            for (const step of dueSteps) {
                const daysBeforeDue = step.days_before_due ?? 0;

                // Invoice due date range: today through today + LOOK_AHEAD_DAYS (UTC)
                const earliestInvoiceDueDate = new Date(today);
                const latestInvoiceDueDate = new Date(lookAheadEnd);

                logCallback?.(
                    `Processing step ${step.id}: ${daysBeforeDue} days before due (look-ahead: ${LOOK_AHEAD_DAYS} days)`,
                    "DEBUG",
                    {
                        step_id: step.id,
                        account_id: step.account_id,
                        container_id: step.sequence_container_id,
                        days_before_due: daysBeforeDue,
                        earliest_invoice_due: earliestInvoiceDueDate.toISOString().split('T')[0],
                        latest_invoice_due: latestInvoiceDueDate.toISOString().split('T')[0],
                        lookAheadDays: LOOK_AHEAD_DAYS
                    }
                );

                const invoicesRaw = await prisma.invoice.findMany({
                    where: {
                        status: INVOICE_STATUS_DUE,
                        outstanding_debt: { gt: 0 },
                        due_date: {
                            gte: earliestInvoiceDueDate,
                            lte: latestInvoiceDueDate,
                        },
                        customer_id: customerId ?? { not: null },
                        Customer: {
                            account_id: step.account_id,
                        },
                    },
                    include: {
                        Customer: {
                            select: {
                                id: true,
                                account_id: true,
                                type: true,
                                email: true,
                                customer_uuid: true,
                                language: true,
                                sequence_container_id: true,
                                Person: {
                                    select: {
                                        first_name: true,
                                        last_name: true,
                                        mobile: true,
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
                                                last_name: true,
                                                phone: true,
                                                receives_standard_reminder: true,
                                                receives_escalated_reminder: true,
                                            },
                                        },
                                    },
                                },
                                country_id: true,
                                Country: { select: { iso2: true } },
                                State: { select: { iso2: true } },
                            },
                        },
                        Account: {
                            select: {
                                id: true,
                                name: true,
                                logo: true,
                                sub_domain: true,
                                sms_fallback_enabled: true,
                                sms_from_name: true,
                            },
                        },
                    },
                    orderBy: [{ due_date: "asc" }, { id: "asc" }],
                    take: BATCH_SIZE,
                });

                // Exclude invoices that already have this due step, except "skip_due_to_dispute" (re-evaluate after dispute resolution)
                const stepKey = String(step.id);
                const invoices = invoicesRaw.filter((inv) => {
                    const state = inv.due_notification_state as Record<string, string> | null | undefined;
                    const stepState = state?.[stepKey];
                    return stepState === undefined || stepState === "skip_due_to_dispute";
                });

                stepCollector?.addStep(
                    `INVOICES_STEP_${step.id}`,
                    `Found ${invoices.length} invoices for step ${step.id}`,
                    "INFO",
                    {
                        step_id: step.id,
                        invoice_count: invoices.length,
                        earliest_invoice_due: earliestInvoiceDueDate.toISOString().split('T')[0],
                        latest_invoice_due: latestInvoiceDueDate.toISOString().split('T')[0]
                    }
                );

                logCallback?.(
                    `Found ${invoices.length} invoices for step ${step.id}`,
                    "DEBUG",
                    {
                        step_id: step.id,
                        invoice_count: invoices.length,
                        earliest_invoice_due: earliestInvoiceDueDate.toISOString().split('T')[0],
                        latest_invoice_due: latestInvoiceDueDate.toISOString().split('T')[0]
                    }
                );

                // Group invoices by customer AND notification send date
                // This ensures that invoices with different notification dates aren't consolidated
                const invoicesByCustomerAndDate = new Map<string, any[]>();
                for (const invoice of invoices) {
                    if (!invoice.customer_id || !invoice.due_date) continue;

                    // Calculate the notification send date for this invoice (UTC for consistent todayKey match)
                    const notificationDate = new Date(invoice.due_date);
                    notificationDate.setUTCDate(notificationDate.getUTCDate() - (step.days_before_due ?? 0));
                    const dateKey = notificationDate.toISOString().split('T')[0];

                    // Create a composite key: customer_id + notification_date
                    const groupKey = `${invoice.customer_id}_${dateKey}`;

                    const groupInvoices = invoicesByCustomerAndDate.get(groupKey) || [];
                    groupInvoices.push(invoice);
                    invoicesByCustomerAndDate.set(groupKey, groupInvoices);
                }

                // Nearest notification > now: one group per customer whose schedule_time is the smallest that is still > now
                const now = new Date();
                const groupsByCustomer = new Map<number, Array<{ dateKey: string; invoices: any[] }>>();
                for (const [groupKey, groupInvoices] of Array.from(invoicesByCustomerAndDate.entries())) {
                    const customerIdNum = groupInvoices[0]?.customer_id;
                    if (customerIdNum == null) continue;
                    const dateKey = groupKey.substring(groupKey.indexOf("_") + 1);
                    if (!groupsByCustomer.has(customerIdNum)) {
                        groupsByCustomer.set(customerIdNum, []);
                    }
                    groupsByCustomer.get(customerIdNum)!.push({ dateKey, invoices: groupInvoices });
                }
                for (const [, groupList] of Array.from(groupsByCustomer.entries())) {
                    groupList.sort((a: { dateKey: string }, b: { dateKey: string }) => a.dateKey.localeCompare(b.dateKey));
                }

                stepCollector?.addStep(
                    `PROCESS_STEP_${step.id}`,
                    `Processing step ${step.id}: ${daysBeforeDue} days before due (nearest notification > now, one per customer)`,
                    "INFO",
                    {
                        step_id: step.id,
                        account_id: step.account_id,
                        container_id: step.sequence_container_id,
                        days_before_due: daysBeforeDue,
                        customers_with_groups: groupsByCustomer.size,
                    }
                );

                for (const [customerIdNum, groupList] of Array.from(groupsByCustomer.entries())) {
                    const firstGroup = groupList[0];
                    const customer = firstGroup.invoices[0]?.Customer;
                    if (!customer) {
                        stats.skipped += groupList.reduce((s: number, g: { invoices: any[] }) => s + g.invoices.length, 0);
                        continue;
                    }

                    const stepContainerId = step.sequence_container_id;
                    const customerContainerId = customer.sequence_container_id;

                    if (stepContainerId !== null) {
                        const defaultContainerId = defaultContainerByAccount.get(
                            step.account_id
                        );
                        const customerUsesStepContainer =
                            customerContainerId === stepContainerId ||
                            (customerContainerId === null &&
                                defaultContainerId === stepContainerId);
                        if (!customerUsesStepContainer) {
                            const skipped = groupList.reduce((s: number, g: { invoices: any[] }) => s + g.invoices.length, 0);
                            logCallback?.(
                                `Skipping ${skipped} invoice(s) for customer ${customerIdNum}: container mismatch`,
                                "DEBUG",
                                {
                                    customer_id: customerIdNum,
                                    step_container_id: stepContainerId,
                                    customer_container_id: customerContainerId,
                                    default_container_id: defaultContainerId
                                }
                            );
                            stats.skipped += skipped;
                            continue;
                        }
                    }

                    let processed = false;
                    for (const { dateKey, invoices: customerInvoices } of groupList) {
                        const [y, m, d] = dateKey.split("-").map(Number);
                        const notificationSendDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
                        try {
                            const scheduleResult = await scheduleDateTime({
                                baseDate: notificationSendDate,
                                timeOfDay: step.time_of_day ?? "09:00",
                                daysToAdd: 0,
                                customerCountry: customer.Country?.iso2,
                                customerState: customer.State?.iso2,
                                skipWeekends: true,
                                skipHolidays: true,
                            });
                            if (!fastForwardScheduledActivities && scheduleResult.scheduledTime <= now) continue;
                        } catch {
                            continue;
                        }

                        try {
                            logCallback?.(
                                `Processing ${customerInvoices.length} invoice(s) for customer ${customerIdNum} for step ${step.id} (nearest: ${dateKey})`,
                                "DEBUG",
                                { customer_id: customerIdNum, step_id: step.id, dateKey }
                            );

                            const result = await this.processInvoicesForDueStep(
                                customerInvoices,
                                step,
                                logCallback,
                                { skipSmsSend, fastForwardScheduledActivities }
                            );

                            stats.processed += customerInvoices.length;
                            stats.sent += result.sentCount;
                            stats.skipped += result.skippedCount;
                            processed = true;

                            if (result.sent) {
                                logCallback?.(
                                    `Successfully sent notification for ${result.sentCount} invoice(s) for customer ${customerIdNum}`,
                                    "INFO",
                                    { customer_id: customerIdNum, step_id: step.id }
                                );
                            }
                        } catch (err) {
                            const error = err as Error;
                            const errorMessage = `Customer ${customerIdNum}: ${error.message}`;
                            stats.errors.push(errorMessage);

                            console.error(`[DueNotificationService] Error processing invoices for customer ${customerIdNum}:`, {
                                customer_id: customerIdNum,
                                step_id: step.id,
                                error: error.message,
                                stack: error.stack
                            });

                            stepCollector?.addStep(
                                "CUSTOMER_PROCESS_ERROR",
                                errorMessage,
                                "ERROR",
                                {
                                    customer_id: customerIdNum,
                                    step_id: step.id,
                                    error: error.message,
                                    stack: error.stack,
                                }
                            );

                            logCallback?.(
                                `Error processing invoices for customer ${customerIdNum}: ${error.message}`,
                                "ERROR",
                                {
                                    customer_id: customerIdNum,
                                    step_id: step.id,
                                    error: error.message,
                                    stack: error.stack
                                }
                            );
                        }
                        break;
                    }
                    if (!processed) {
                        stats.skipped += groupList.reduce((s: number, g: { invoices: any[] }) => s + g.invoices.length, 0);
                    }
                }
            }

            stepCollector?.addStep(
                "DUE_NOTIFICATIONS_SUMMARY",
                `Process Due Notifications summary: ${stats.processed} processed, ${stats.sent} sent, ${stats.skipped} skipped, ${stats.errors.length} error(s)`,
                "INFO",
                {
                    processed: stats.processed,
                    sent: stats.sent,
                    skipped: stats.skipped,
                    errorsCount: stats.errors.length,
                    errors: stats.errors,
                }
            );

            return {
                success: stats.errors.length === 0,
                ...stats,
            };
        } catch (error) {
            const err = error as Error;
            stats.errors.push(err.message);
            stepCollector?.addStep(
                "CRITICAL_ERROR",
                `Due notification processing failed: ${err.message}`,
                "ERROR",
                {
                    error: err.message,
                    stack: err.stack,
                    processed: stats.processed,
                    sent: stats.sent,
                    skipped: stats.skipped,
                    errorsCount: stats.errors.length,
                }
            );
            logCallback?.(
                `Due notification processing failed: ${err.message}`,
                "ERROR"
            );
            return { success: false, ...stats };
        }
    }

    /**
     * Process invoices for a due step and create SCHEDULED activities.
     * Activities will be sent later by activityWorkflowManager when schedule_time arrives.
     */
    private async processInvoicesForDueStep(
        invoices: any[],
        step: any,
        logCallback?: (
            message: string,
            level: "INFO" | "ERROR" | "WARNING" | "DEBUG",
            parameters?: any
        ) => void,
        options?: {
            skipSmsSend?: boolean;
            fastForwardScheduledActivities?: boolean;
        }
    ): Promise<{ sent: boolean; sentCount: number; skippedCount: number }> {
        const customer = invoices[0]?.Customer;
        if (!customer) return { sent: false, sentCount: 0, skippedCount: invoices.length };

        const invoicesToProcess: any[] = [];
        let skippedCount = 0;

        for (const invoice of invoices) {
            if ((invoice.outstanding_debt ?? 0) <= 0) {
                skippedCount++;
                continue;
            }
            invoicesToProcess.push(invoice);
        }

        if (invoicesToProcess.length === 0) {
            return { sent: false, sentCount: 0, skippedCount };
        }

        const mainInvoice = invoicesToProcess[0];
        const invoiceNumbers = invoicesToProcess.map(i => i.invoice_number).join(", ");
        const totalOutstandingDebt = invoicesToProcess.reduce((sum, i) => sum + (i.outstanding_debt ?? 0), 0);

        const mainContacts = await prisma.contact.findMany({
            where: { customer_id: customer.id },
            select: {
                id: true,
                email: true,
                mobile: true,
                first_name: true,
                last_name: true,
                phone: true,
                receives_standard_reminder: true,
                receives_escalated_reminder: true,
            },
        });

        const typeSpecificContacts =
            customer.type === "Company"
                ? (customer.Company?.Contact ?? [])
                : customer.email
                    ? [
                        {
                            id: 0,
                            email: customer.email,
                            mobile: customer.Person?.mobile ?? null,
                            first_name: customer.Person?.first_name ?? null,
                            last_name: null,
                            phone: null,
                            receives_standard_reminder: true,
                            receives_escalated_reminder: false,
                        },
                    ]
                    : [];

        const allContacts = [...mainContacts, ...typeSpecificContacts].filter(
            (c) => c.id > 0
        );
        const contacts = this.filterContactsBySequence(allContacts, {
            send_to_standard_contacts: step.send_to_standard_contacts ?? false,
            send_to_escalated_contacts:
                step.send_to_escalated_contacts ?? false,
        });

        if (contacts.length === 0) {
            logCallback?.(
                `Customer ${customer.id}: No contacts for combined due notification (Invoices: ${invoiceNumbers})`,
                "WARNING"
            );
            await prisma.customer.update({
                where: { id: customer.id },
                data: { automation_stuck_no_contacts: true },
            });
            return { sent: false, sentCount: 0, skippedCount: skippedCount + invoicesToProcess.length };
        }

        // Calculate when the notification should actually be sent
        // For example: if invoice is due on Feb 20 and days_before_due=3,
        // notification should be sent on Feb 17. Use UTC to align with group filter (todayKey).
        const notificationSendDate = new Date(mainInvoice.due_date);
        notificationSendDate.setUTCDate(notificationSendDate.getUTCDate() - (step.days_before_due ?? 0));
        notificationSendDate.setUTCHours(0, 0, 0, 0);

        // Only create the activity if the notification send date is today or in the future (UTC)
        const nowUtc = new Date();
        nowUtc.setUTCHours(0, 0, 0, 0);

        if (notificationSendDate < nowUtc) {
            logCallback?.(
                `Skipping invoice ${mainInvoice.invoice_number}: notification date (${notificationSendDate.toISOString().split('T')[0]}) is in the past`,
                "DEBUG",
                {
                    invoice_id: mainInvoice.id,
                    due_date: mainInvoice.due_date,
                    days_before_due: step.days_before_due,
                    notification_date: notificationSendDate.toISOString().split('T')[0],
                    today_utc: nowUtc.toISOString().split('T')[0]
                }
            );
            return { sent: false, sentCount: 0, skippedCount: skippedCount + invoicesToProcess.length };
        }

        // Schedule the activity for the calculated notification send date
        // We use the notificationSendDate directly and set the time of day
        const scheduleResult = await scheduleDateTime({
            baseDate: notificationSendDate, // This is already the correct date (due_date - days_before_due)
            timeOfDay: step.time_of_day ?? "09:00",
            daysToAdd: 0, // Don't add any additional days - we already calculated the exact date
            customerCountry: customer.Country?.iso2,
            customerState: customer.State?.iso2,
            skipWeekends: true,
            skipHolidays: true,
        });

        // For testing: fast-forward sets schedule_time to 1 hour ago so activity is due immediately
        const scheduledTime = options?.fastForwardScheduledActivities
            ? new Date(Date.now() - 60 * 60 * 1000)
            : scheduleResult.scheduledTime;

        // Skip if schedule time is in the past (nearest > now)
        if (!options?.fastForwardScheduledActivities && scheduleResult.scheduledTime <= new Date()) {
            logCallback?.(
                `Skipping invoice ${mainInvoice.invoice_number}: schedule time (${scheduleResult.scheduledTime.toISOString()}) is not in the future`,
                "DEBUG",
                { invoice_id: mainInvoice.id, schedule_time: scheduleResult.scheduledTime.toISOString() }
            );
            return { sent: false, sentCount: 0, skippedCount: skippedCount + invoicesToProcess.length };
        }

        logCallback?.(
            `Scheduling activity for invoice ${mainInvoice.invoice_number} at ${scheduledTime.toISOString()}${options?.fastForwardScheduledActivities ? " (fast-forward for testing)" : ""}`,
            "DEBUG",
            {
                invoice_id: mainInvoice.id,
                due_date: mainInvoice.due_date,
                days_before_due: step.days_before_due,
                schedule_time: scheduledTime.toISOString(),
                time_of_day: step.time_of_day,
                fastForwardScheduledActivities: options?.fastForwardScheduledActivities,
            }
        );

        // Check for existing SCHEDULED activity (same customer, step, schedule date) to merge into
        const scheduleUtcDate = new Date(Date.UTC(
            scheduledTime.getUTCFullYear(),
            scheduledTime.getUTCMonth(),
            scheduledTime.getUTCDate()
        ));
        const scheduleUtcDateEnd = new Date(scheduleUtcDate);
        scheduleUtcDateEnd.setUTCDate(scheduleUtcDateEnd.getUTCDate() + 1);

        const existingActivity = await prisma.activity.findFirst({
            where: {
                customer_id: customer.id,
                activity_sequence_id: step.id,
                status: ActivityStatus.SCHEDULED,
                schedule_time: {
                    gte: scheduleUtcDate,
                    lt: scheduleUtcDateEnd,
                },
            },
        });

        if (existingActivity) {
            const mergeResult = await this.mergeInvoicesIntoDueActivity(
                existingActivity,
                invoicesToProcess,
                step,
                customer,
                contacts,
                logCallback
            );
            return mergeResult;
        }

        const activityContent = this.buildActivityContent(step, customer);
        const invoiceForTemplate = {
            invoice_number: invoiceNumbers,
            due_date: mainInvoice.due_date,
            outstanding_debt: totalOutstandingDebt,
            days_until_due: mainInvoice.due_date
                ? Math.ceil(
                    (new Date(mainInvoice.due_date).getTime() - Date.now()) /
                    (24 * 60 * 60 * 1000)
                )
                : 0,
        };
        const firstContact = contacts[0];
        const storedContent = await this.activityService.processTemplateContent(
            activityContent.content,
            mainInvoice.Account || {
                id: customer.account_id,
                name: null,
                logo: null,
                sub_domain: null,
            },
            {
                type: customer.type,
                customer_uuid: customer.customer_uuid,
                language: customer.language,
                Person: customer.Person,
                Company: customer.Company,
            },
            {
                id: firstContact.id,
                first_name: firstContact.first_name,
                last_name: firstContact.last_name,
                email: firstContact.email,
                mobile: firstContact.mobile,
                phone: firstContact.phone,
            },
            (customer.language as string) || "en",
            invoiceForTemplate
        );
        const storedSubject = await this.activityService.processTemplateContent(
            activityContent.subject,
            mainInvoice.Account || {
                id: customer.account_id,
                name: null,
                logo: null,
                sub_domain: null,
            },
            {
                type: customer.type,
                customer_uuid: customer.customer_uuid,
                language: customer.language,
                Person: customer.Person,
                Company: customer.Company,
            },
            {
                id: firstContact.id,
                first_name: firstContact.first_name,
                last_name: firstContact.last_name,
                email: firstContact.email,
                mobile: firstContact.mobile,
                phone: firstContact.phone,
            },
            (customer.language as string) || "en",
            invoiceForTemplate
        );

        const activity = await prisma.$transaction(async (tx) => {
            const activity = await tx.activity.create({
                data: {
                    customer_id: customer.id,
                    account_id: customer.account_id,
                    invoice_id: mainInvoice.id,
                    activity_sequence_id: step.id,
                    collection_period_id: null,
                    type: step.activity_type,
                    content: storedContent,
                    title: "{{activities.fields.activity_due_notification_scheduled}}",
                    title_params: {
                        contacts: contacts.length,
                        invoiceNumber: invoiceNumbers,
                        count: invoicesToProcess.length,
                        totalAmount: totalOutstandingDebt
                    },
                    schedule_time: scheduledTime,
                    status: ActivityStatus.SCHEDULED,
                    system_generated: true,
                    created_by: getSystemUserId(customer.account_id),
                    modified_by: getSystemUserId(customer.account_id),
                },
            });

            const stepKey = String(step.id);
            await Promise.all(
                invoicesToProcess.map((inv) => {
                    const current = (inv.due_notification_state as Record<string, string> | null) ?? {};
                    const next = { ...current, [stepKey]: "scheduled" };
                    return tx.invoice.update({
                        where: { id: inv.id },
                        data: { due_notification_state: next as any },
                    });
                })
            );

            await Promise.all(
                contacts.map((c) =>
                    tx.activityContact.create({
                        data: {
                            activity_id: activity.id,
                            contact_id: c.id,
                            status: "Scheduled",
                        },
                    })
                )
            );

            return activity;
        });

        // IMPORTANT: Activities are created with SCHEDULED status.
        // The activityWorkflowManager cron job will handle sending them when schedule_time arrives.
        // This allows for proper pre-scheduling and ensures notifications are sent at the correct time.
        logCallback?.(
            `Created scheduled activity ${activity.id} for ${contacts.length} contact(s). Will be sent by activityWorkflowManager at ${scheduledTime.toISOString()}${options?.fastForwardScheduledActivities ? " (fast-forward)" : ""}`,
            "INFO",
            {
                activity_id: activity.id,
                customer_id: customer.id,
                invoice_count: invoicesToProcess.length,
                contact_count: contacts.length,
                schedule_time: scheduledTime.toISOString(),
                step_id: step.id,
                fastForwardScheduledActivities: options?.fastForwardScheduledActivities,
            }
        );

        // Return success with contact count (not immediate send count)
        return {
            sent: true, // 'sent' means 'scheduled successfully'
            sentCount: contacts.length, // Number of contacts that will be notified
            skippedCount
        };
    }

    /**
     * Merge new invoices into an existing SCHEDULED due activity (same customer, step, schedule date).
     * Updates activity content and title_params; sets due_notification_state only for the new invoices.
     */
    private async mergeInvoicesIntoDueActivity(
        existingActivity: { id: number | bigint; title_params: unknown; content: string },
        invoicesToProcess: any[],
        step: any,
        customer: any,
        contacts: Array<{ id: number; first_name: string | null; last_name?: string | null; email?: string | null; mobile?: string | null; phone?: string | null }>,
        logCallback?: (
            message: string,
            level: "INFO" | "ERROR" | "WARNING" | "DEBUG",
            parameters?: any
        ) => void
    ): Promise<{ sent: boolean; sentCount: number; skippedCount: number }> {
        const titleParams = existingActivity.title_params as { invoiceNumber?: string } | null | undefined;
        const invoiceNumbersStr = titleParams?.invoiceNumber;
        const existingNumbers = invoiceNumbersStr
            ? (invoiceNumbersStr as string).split(',').map((s: string) => s.trim()).filter(Boolean)
            : [];

        if (existingNumbers.length === 0) {
            return { sent: false, sentCount: 0, skippedCount: invoicesToProcess.length };
        }

        const invoiceInclude = {
            Customer: {
                select: {
                    id: true,
                    account_id: true,
                    type: true,
                    email: true,
                    customer_uuid: true,
                    language: true,
                    sequence_container_id: true,
                    Person: { select: { first_name: true, last_name: true, mobile: true } },
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
                                    last_name: true,
                                    phone: true,
                                    receives_standard_reminder: true,
                                    receives_escalated_reminder: true,
                                },
                            },
                        },
                    },
                    country_id: true,
                    Country: { select: { iso2: true } },
                    State: { select: { iso2: true } },
                },
            },
            Account: {
                select: {
                    id: true,
                    name: true,
                    logo: true,
                    sub_domain: true,
                    sms_fallback_enabled: true,
                    sms_from_name: true,
                },
            },
        } as const;

        const existingInvoiceRecords = await prisma.invoice.findMany({
            where: {
                customer_id: customer.id,
                invoice_number: { in: existingNumbers },
            },
            include: invoiceInclude,
        });

        const seenIds = new Set<number>();
        const combinedInvoices: any[] = [];
        for (const inv of existingInvoiceRecords) {
            if (!seenIds.has(inv.id)) {
                seenIds.add(inv.id);
                combinedInvoices.push(inv);
            }
        }
        for (const inv of invoicesToProcess) {
            if (!seenIds.has(inv.id)) {
                seenIds.add(inv.id);
                combinedInvoices.push(inv);
            }
        }

        const combinedInvoiceNumbers = combinedInvoices.map((i) => i.invoice_number).join(", ");
        const totalOutstandingDebt = combinedInvoices.reduce((sum, i) => sum + (i.outstanding_debt ?? 0), 0);
        const mainInvoice = combinedInvoices[0];
        const firstContact = contacts[0];

        const activityContent = this.buildActivityContent(step, customer);
        const invoiceForTemplate = {
            invoice_number: combinedInvoiceNumbers,
            due_date: mainInvoice.due_date,
            outstanding_debt: totalOutstandingDebt,
            days_until_due: mainInvoice.due_date
                ? Math.ceil(
                    (new Date(mainInvoice.due_date).getTime() - Date.now()) /
                    (24 * 60 * 60 * 1000)
                )
                : 0,
        };

        const storedContent = await this.activityService.processTemplateContent(
            activityContent.content,
            mainInvoice.Account || {
                id: customer.account_id,
                name: null,
                logo: null,
                sub_domain: null,
            },
            {
                type: customer.type,
                customer_uuid: customer.customer_uuid,
                language: customer.language,
                Person: customer.Person,
                Company: customer.Company,
            },
            {
                id: firstContact.id,
                first_name: firstContact.first_name,
                last_name: firstContact.last_name,
                email: firstContact.email,
                mobile: firstContact.mobile,
                phone: firstContact.phone,
            },
            (customer.language as string) || "en",
            invoiceForTemplate
        );

        await prisma.$transaction(async (tx) => {
            await tx.activity.update({
                where: { id: existingActivity.id },
                data: {
                    content: storedContent,
                    title_params: {
                        contacts: contacts.length,
                        invoiceNumber: combinedInvoiceNumbers,
                        count: combinedInvoices.length,
                        totalAmount: totalOutstandingDebt
                    },
                    invoice_id: mainInvoice.id,
                },
            });

            const stepKey = String(step.id);
            await Promise.all(
                invoicesToProcess.map((inv) => {
                    const current = (inv.due_notification_state as Record<string, string> | null) ?? {};
                    const next = { ...current, [stepKey]: "scheduled" };
                    return tx.invoice.update({
                        where: { id: inv.id },
                        data: { due_notification_state: next as any },
                    });
                })
            );
        });

        logCallback?.(
            `Merged ${invoicesToProcess.length} invoice(s) into existing due activity ${existingActivity.id}`,
            "INFO",
            {
                activity_id: existingActivity.id,
                customer_id: customer.id,
                new_invoice_count: invoicesToProcess.length,
                total_invoice_count: combinedInvoices.length,
                step_id: step.id,
            }
        );

        return {
            sent: true,
            sentCount: contacts.length,
            skippedCount: 0,
        };
    }

    private filterContactsBySequence(
        contacts: Array<{
            id: number;
            first_name: string | null;
            last_name?: string | null;
            email?: string | null;
            mobile?: string | null;
            phone?: string | null;
            receives_standard_reminder?: boolean | null;
            receives_escalated_reminder?: boolean | null;
        }>,
        sequence: {
            send_to_standard_contacts: boolean;
            send_to_escalated_contacts: boolean;
        }
    ): typeof contacts {
        const result: typeof contacts = [];
        const added = new Set<number>();
        for (const c of contacts) {
            const includeStandard =
                sequence.send_to_standard_contacts &&
                c.receives_standard_reminder === true;
            const includeEscalated =
                sequence.send_to_escalated_contacts &&
                c.receives_escalated_reminder === true;
            if ((includeStandard || includeEscalated) && !added.has(c.id)) {
                result.push(c);
                added.add(c.id);
            }
        }
        return result;
    }

    /**
     * Build raw template content for due notification.
     * Invoice placeholders are replaced by ActivityService.processTemplateContent when sending.
     */
    private buildActivityContent(
        step: any,
        customer: any
    ): { subject: string; content: string } {
        const template = step.ActivitiesTemplate;
        const lang = (customer.language as string) || "English";
        const langTemplate = template?.ActivityTemplateLanguage?.find(
            (l: any) => l.language === lang
        );

        const subject =
            langTemplate?.email_subject ?? template?.email_subject ?? "";
        const content =
            step.activity_type === "SMS"
                ? (langTemplate?.sms_content ?? template?.sms_content ?? "")
                : (langTemplate?.email_content ?? template?.email_content ?? "");

        return { subject, content };
    }

    /**
     * Cancel scheduled due notifications for specific invoices.
     * If a notification contains multiple invoices and only some are disputed,
     * it cancels the original and recreates a new notification for the remaining invoices.
     */
    public async cancelDueNotificationsForInvoices(
        invoiceIds: number[],
        logCallback?: (
            message: string,
            level: "INFO" | "ERROR" | "WARNING" | "DEBUG",
            parameters?: any
        ) => void,
        dbClient?: DbClient
    ): Promise<void> {
        if (!invoiceIds.length) return;

        try {
            const client = dbClient ?? prisma;
            // Get details of disputed invoices to identify customers and invoice numbers
            const disputedInvoices = await client.invoice.findMany({
                where: { id: { in: invoiceIds } },
                select: { id: true, invoice_number: true, customer_id: true }
            });

            if (!disputedInvoices.length) return;

            // Group by customer to minimize queries
            const invoicesByCustomer = new Map<number, Set<string>>(); // customer_id -> Set of invoice_numbers
            const disputedInvoiceIds = new Set(invoiceIds);

            for (const inv of disputedInvoices) {
                if (!inv.customer_id || !inv.invoice_number) continue;
                const set = invoicesByCustomer.get(inv.customer_id) || new Set();
                set.add(inv.invoice_number);
                invoicesByCustomer.set(inv.customer_id, set);
            }

            for (const [customerId, disputedNumbers] of Array.from(invoicesByCustomer.entries())) {
                // Find all SCHEDULED due activities for this customer
                const scheduledActivities = await client.activity.findMany({
                    where: {
                        customer_id: customerId,
                        status: 'SCHEDULED', // Use string literal matching enum
                        ActivitiesSequence: {
                            step_type: 'due'
                        }
                    },
                    include: {
                        ActivitiesSequence: true,
                        ActivityContact: true
                    }
                });

                for (const activity of scheduledActivities) {
                    const titleParams = activity.title_params as any;
                    // Check for invoiceNumber (used in creation) or invoice_numbers (legacy/test)
                    const invoiceNumbersStr = titleParams?.invoiceNumber || titleParams?.invoice_numbers;

                    if (!titleParams || !invoiceNumbersStr) continue;

                    // Check if this activity includes any disputed invoices
                    const activityInvoiceNumbers = (invoiceNumbersStr as string)
                        .split(',')
                        .map(s => s.trim());

                    const hasDisputedInvoice = activityInvoiceNumbers.some(num => disputedNumbers.has(num));

                    if (hasDisputedInvoice) {
                        // Calculate remaining invoices
                        const remainingInvoiceNumbers = activityInvoiceNumbers.filter(num => !disputedNumbers.has(num));

                        const runCancellation = async (txClient: DbClient) => {
                            const cancelTitleParams = {
                                ...(typeof titleParams === 'object' && titleParams !== null ? titleParams : {}),
                            };
                            await txClient.activity.update({
                                where: { id: activity.id },
                                data: {
                                    status: 'CANCELLED',
                                    status_reason: 'Related invoice(s) disputed',
                                    title: '{{activities.fields.activity_due_notification_canceled}}',
                                    title_params: cancelTitleParams,
                                }
                            });

                            const stepKey = String(activity.activity_sequence_id);
                            const removedInvoiceIds = disputedInvoices
                                .filter((inv) => inv.customer_id === customerId && disputedNumbers.has(inv.invoice_number!))
                                .map((inv) => inv.id);
                            for (const invId of removedInvoiceIds) {
                                const inv = await txClient.invoice.findUnique({
                                    where: { id: invId },
                                    select: { due_notification_state: true },
                                });
                                if (inv?.due_notification_state && typeof inv.due_notification_state === 'object') {
                                    const state = { ...(inv.due_notification_state as Record<string, string>) };
                                    delete state[stepKey];
                                    await txClient.invoice.update({
                                        where: { id: invId },
                                        data: { due_notification_state: Object.keys(state).length ? state : {} },
                                    });
                                }
                            }

                            if (remainingInvoiceNumbers.length > 0) {
                                const remainingInvoices = await txClient.invoice.findMany({
                                    where: {
                                        invoice_number: { in: remainingInvoiceNumbers },
                                        customer_id: customerId
                                    }
                                });

                                if (remainingInvoices.length > 0) {
                                    const newMainInvoice = remainingInvoices[0];
                                    await txClient.activity.create({
                                        data: {
                                            account_id: activity.account_id,
                                            customer_id: activity.customer_id,
                                            type: activity.type,
                                            status: 'SCHEDULED',
                                            schedule_time: activity.schedule_time,
                                            activity_sequence_id: activity.activity_sequence_id,
                                            activity_template: activity.activity_template,
                                            collection_period_id: activity.collection_period_id,
                                            invoice_id: newMainInvoice.id,
                                            title: activity.title,
                                            content: activity.content,
                                            title_params: {
                                                ...titleParams,
                                                invoiceNumber: remainingInvoiceNumbers.join(', '),
                                                count: remainingInvoices.length
                                            },
                                            created_by: activity.created_by,
                                            ActivityContact: {
                                                create: activity.ActivityContact.map(ac => ({
                                                    contact_id: ac.contact_id,
                                                    status: 'Scheduled'
                                                }))
                                            }
                                        }
                                    });
                                }
                            }
                        };

                        if (dbClient) {
                            await runCancellation(dbClient);
                        } else {
                            await prisma.$transaction(async (tx) => {
                                await runCancellation(tx as DbClient);
                            });
                        }

                        logCallback?.(
                            `Cancelled due notification activity ${activity.id} because it contains disputed invoices`,
                            "INFO",
                            { activity_id: activity.id.toString(), disputed_invoices: Array.from(disputedNumbers) }
                        );

                        if (remainingInvoiceNumbers.length > 0) {
                            logCallback?.(
                                `Recreated due notification for remaining invoices`,
                                "INFO",
                                { original_activity: activity.id.toString(), new_invoice_numbers: remainingInvoiceNumbers }
                            );
                        }
                    }
                }
            }

        } catch (error) {
            console.error("Error cancelling due notifications:", error);
            logCallback?.(
                `Error cancelling due notifications: ${(error as Error).message}`,
                "ERROR"
            );
        }
    }
}
