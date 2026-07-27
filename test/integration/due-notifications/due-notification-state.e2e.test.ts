/**
 * Due-notification integration e2e tests.
 * Direct import of processDueNotifications; assertions via Prisma on Invoice.due_notification_state and Activity.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
    prisma,
    assertTestAndAppUseSameDatabase,
} from "../../setup/vitest.integration.setup";
import { processDueNotifications } from "../../server/cron-jobs/processDueNotifications";
import { activityWorkflowManager } from "../../server/cron-jobs/activityWorkflowManager";
import { InvoiceService } from "../../server/services/InvoiceService";
import {
    createDueNotificationTestData,
    cleanupDueNotificationTestData,
    createDueNotificationCustomer,
    createDueNotificationInvoice,
    createDueSequenceAndTemplate,
    getOrCreateDueNotificationAccount,
    createDueNotificationContact,
    ensureInvoiceStatuses,
    createDueNotificationDisputeReason,
    hasDueNotificationStateColumn,
    getOrCreateDueNotificationTestUser,
} from "./fixtures";
import { DisputeService } from "../../server/services/DisputeService";
import { getCountryTimezone } from "../../utils/datetimeOperations";
import moment from "moment-timezone";

const skipIntegrationTests = !process.env.DATABASE_URL;
const INVOICE_STATUS_DUE = 13;
const INVOICE_STATUS_PAID = 7;
const INVOICE_STATUS_OVERDUE = 3;

/** Title key set when a due notification activity is cancelled (DueNotificationService / handleInvoiceChange). */
const DUE_ACTIVITY_CANCELED_TITLE = "{{activities.fields.activity_due_notification_canceled}}";

/** Due date = today UTC + days at noon UTC (so notification_send_date = today UTC when days_before_due = days; noon avoids TZ flip). */
function dueDateUtcTodayPlusDays(days: number): Date {
    const d = new Date();
    d.setUTCHours(12, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
}

const LOG_PREFIX = "[DueNotifE2E]";

/**
 * Diagnostic logs (test file only) to trace why activity is not created.
 * Remove or guard with a env flag before commit.
 * Finding: processDueNotifications uses BATCH_SIZE=100 per step with no orderBy;
 * the test invoice can be outside that batch so it is never processed.
 */

/** Debug: logCallback – only log when parameters mention our step or customer to reduce noise. */
function debugLogCallbackFor(stepId?: number, customerId?: number): (
    message: string,
    level: string,
    parameters?: unknown
) => void {
    return (message: string, level: string, parameters?: unknown) => {
        const params = parameters as Record<string, unknown> | undefined;
        const mentionStep =
            stepId != null &&
            (params?.step_id === stepId || String(params?.step_id) === String(stepId));
        const mentionCustomer =
            customerId != null &&
            (params?.customer_id === customerId ||
                String(params?.customer_id) === String(customerId));
        if (mentionStep || mentionCustomer || level === "ERROR") {
            console.log(`${LOG_PREFIX} [${level}] ${message}`, parameters ?? "");
        }
    };
}

/** Fallback when no filter: log everything (noisy). */
function debugLogCallback(
    message: string,
    level: string,
    parameters?: unknown
): void {
    console.log(`${LOG_PREFIX} [${level}] ${message}`, parameters ?? "");
}

/** Debug: stepCollector – only log steps for our step id to reduce noise (294 steps otherwise). */
function debugStepCollector(stepId?: number): {
    addStep: (
        step: string,
        message: string,
        level?: string,
        parameters?: unknown,
        results?: unknown,
        duration?: number
    ) => void;
} {
    return {
        addStep(step, message, _level, parameters) {
            const matchStep =
                stepId == null ||
                step === `INVOICES_STEP_${stepId}` ||
                step === `PROCESS_STEP_${stepId}` ||
                (parameters as Record<string, unknown>)?.step_id === stepId;
            if (matchStep || step === "STEPS_FOUND" || step === "COMPLETE") {
                console.log(`${LOG_PREFIX} STEP ${step}: ${message}`, parameters ?? "");
            }
        },
    };
}

describe.skipIf(skipIntegrationTests)(
    "Due-notification e2e (processDueNotifications)",
    () => {
        let testData: Awaited<ReturnType<typeof createDueNotificationTestData>>;
        let skipDueNotificationState = false;

        beforeAll(async () => {
            await assertTestAndAppUseSameDatabase();
            await ensureInvoiceStatuses(prisma);
            const hasColumn = await hasDueNotificationStateColumn(prisma);
            if (!hasColumn) skipDueNotificationState = true;
        });

        afterAll(async () => {
            if (testData) {
                await cleanupDueNotificationTestData(prisma, {
                    accountId: testData.accountId,
                    customer: testData.customer,
                    invoice: testData.invoice,
                    dueSequenceId: testData.dueSequenceId,
                    sequenceContainerId: testData.sequenceContainerId,
                    templateId: testData.templateId,
                    contactId: testData.contactId,
                });
            }
            await prisma.$disconnect();
        });

        beforeEach(async () => {
            // due_date_offset_days: 7 with days_before_due: 7 => notification_send_date = today UTC (nearest only)
            testData = await createDueNotificationTestData(prisma, {
                due_date_offset_days: 7,
                days_before_due: 7,
                useUtcForDueDate: true,
            });
        });

        it("first run creates activity and sets scheduled", async () => {
            if (skipDueNotificationState) return;
            const dueDate = dueDateUtcTodayPlusDays(7);
            await prisma.invoice.update({
                where: { id: testData.invoice.id },
                data: { due_date: dueDate },
            });
            const notifDate = new Date(dueDate);
            notifDate.setUTCDate(notifDate.getUTCDate() - 7);
            const todayUtc = new Date();
            todayUtc.setUTCHours(0, 0, 0, 0);
            console.log(`${LOG_PREFIX} BEFORE RUN:`, {
                customer_id: testData.customer.id,
                dueSequenceId: testData.dueSequenceId,
                accountId: testData.accountId,
                invoice_id: testData.invoice.id,
                due_date: dueDate.toISOString(),
                notification_send_date: notifDate.toISOString().split("T")[0],
                today_utc: todayUtc.toISOString().split("T")[0],
                sequence_container_id: testData.sequenceContainerId,
            });
            const result = await processDueNotifications(
                testData.customer.id,
                debugLogCallbackFor(testData.dueSequenceId, testData.customer.id),
                debugStepCollector(testData.dueSequenceId),
                { skipSmsSend: true, fastForwardScheduledActivities: true }
            );
            console.log(`${LOG_PREFIX} RESULT:`, {
                success: result.success,
                summary: result.summary,
            });
            expect(result.success).toBe(true);

            const activity = await prisma.activity.findFirst({
                where: {
                    customer_id: testData.customer.id,
                    activity_sequence_id: testData.dueSequenceId,
                    status: "SCHEDULED",
                },
            });
            const activityCount = await prisma.activity.count({
                where: {
                    customer_id: testData.customer.id,
                    activity_sequence_id: testData.dueSequenceId,
                },
            });
            const invoice = await prisma.invoice.findUnique({
                where: { id: testData.invoice.id },
                select: { due_notification_state: true },
            });
            const state = invoice?.due_notification_state as Record<string, string> | null;
            console.log(`${LOG_PREFIX} AFTER RUN:`, {
                activity_found: !!activity,
                activity_id: activity?.id,
                activity_count_for_step: activityCount,
                due_notification_state: state,
                state_for_step: state?.[String(testData.dueSequenceId)],
            });
            expect(activity).not.toBeNull();

            expect(state).not.toBeNull();
            expect(state?.[String(testData.dueSequenceId)]).toBe("scheduled");
        });

        it("second run does not duplicate", async () => {
            if (skipDueNotificationState) return;
            await prisma.invoice.update({
                where: { id: testData.invoice.id },
                data: { due_date: dueDateUtcTodayPlusDays(7) },
            });
            const firstResult = await processDueNotifications(
                testData.customer.id,
                debugLogCallbackFor(testData.dueSequenceId, testData.customer.id),
                debugStepCollector(testData.dueSequenceId),
                { skipSmsSend: true, fastForwardScheduledActivities: true }
            );
            console.log(`${LOG_PREFIX} second run / after 1st run:`, {
                summary: firstResult.summary,
            });
            await processDueNotifications(testData.customer.id, undefined, undefined, {
                skipSmsSend: true,
                fastForwardScheduledActivities: true,
            });
            const countBefore = await prisma.activity.count({
                where: {
                    customer_id: testData.customer.id,
                    activity_sequence_id: testData.dueSequenceId,
                },
            });
            await processDueNotifications(testData.customer.id, undefined, undefined, {
                skipSmsSend: true,
                fastForwardScheduledActivities: true,
            });
            const countAfter = await prisma.activity.count({
                where: {
                    customer_id: testData.customer.id,
                    activity_sequence_id: testData.dueSequenceId,
                },
            });
            expect(countAfter).toBe(countBefore);
            const inv = await prisma.invoice.findUnique({
                where: { id: testData.invoice.id },
                select: { due_notification_state: true },
            });
            const state = inv?.due_notification_state as Record<string, string> | null;
            expect(state?.[String(testData.dueSequenceId)]).toBe("scheduled");
        });

        it("second invoice same due date merges into existing activity", async () => {
            if (skipDueNotificationState) return;
            const dueDate = dueDateUtcTodayPlusDays(7);
            await prisma.invoice.update({
                where: { id: testData.invoice.id },
                data: { due_date: dueDate },
            });
            await processDueNotifications(testData.customer.id, undefined, undefined, {
                skipSmsSend: true,
                fastForwardScheduledActivities: true,
            });
            const countBefore = await prisma.activity.count({
                where: {
                    customer_id: testData.customer.id,
                    activity_sequence_id: testData.dueSequenceId,
                    status: "SCHEDULED",
                },
            });
            expect(countBefore).toBe(1);
            const secondInvoice = await createDueNotificationInvoice(prisma, testData.customer.id, testData.accountId, {
                due_date: dueDate,
            });
            await processDueNotifications(testData.customer.id, undefined, undefined, {
                skipSmsSend: true,
                fastForwardScheduledActivities: true,
            });
            const countAfter = await prisma.activity.count({
                where: {
                    customer_id: testData.customer.id,
                    activity_sequence_id: testData.dueSequenceId,
                    status: "SCHEDULED",
                },
            });
            expect(countAfter).toBe(1);
            const activity = await prisma.activity.findFirst({
                where: {
                    customer_id: testData.customer.id,
                    activity_sequence_id: testData.dueSequenceId,
                    status: "SCHEDULED",
                },
            });
            expect(activity).not.toBeNull();
            const titleParams = activity?.title_params as { count?: number; invoiceNumber?: string } | null;
            expect(titleParams?.count).toBe(2);
            expect(titleParams?.invoiceNumber).toContain(testData.invoice.invoice_number);
            expect(titleParams?.invoiceNumber).toContain(secondInvoice.invoice_number);
            await prisma.invoice.delete({ where: { id: secondInvoice.id } }).catch(() => {});
        });

        it("one notification per customer per calendar day (nearest only: only today)", async () => {
            if (skipDueNotificationState) return;
            await cleanupDueNotificationTestData(prisma, {
                accountId: testData.accountId,
                customer: testData.customer,
                invoice: testData.invoice,
                dueSequenceId: testData.dueSequenceId,
                sequenceContainerId: testData.sequenceContainerId,
                templateId: testData.templateId,
                contactId: testData.contactId,
            });
            const accountId = await getOrCreateDueNotificationAccount(prisma);
            const { sequenceContainerId, dueSequenceId: step7Id, templateId } =
                await createDueSequenceAndTemplate(prisma, accountId, {
                    days_before_due: 7,
                });
            const customer = await createDueNotificationCustomer(prisma, accountId, {
                sequence_container_id: sequenceContainerId,
            });
            await createDueNotificationContact(prisma, customer.company_id, customer.id);
            const dueDate = new Date();
            dueDate.setUTCHours(0, 0, 0, 0);
            dueDate.setUTCDate(dueDate.getUTCDate() + 7);
            const notifDate = new Date(dueDate);
            notifDate.setUTCDate(notifDate.getUTCDate() - 7);
            const invoice = await createDueNotificationInvoice(prisma, customer.id, accountId, {
                due_date: dueDate,
            });
            console.log(`${LOG_PREFIX} nearest only test:`, {
                customer_id: customer.id,
                step7Id,
                accountId,
                due_date: dueDate.toISOString().split("T")[0],
                notification_date: notifDate.toISOString().split("T")[0],
            });
            const runResult = await processDueNotifications(
                customer.id,
                debugLogCallbackFor(step7Id, customer.id),
                debugStepCollector(step7Id),
                { skipSmsSend: true, fastForwardScheduledActivities: true }
            );
            console.log(`${LOG_PREFIX} nearest only RESULT:`, {
                summary: runResult.summary,
            });
            const activities = await prisma.activity.findMany({
                where: { customer_id: customer.id, status: "SCHEDULED" },
            });
            expect(activities.length).toBe(1);
            const invAfter = await prisma.invoice.findUnique({
                where: { id: invoice.id },
                select: { due_notification_state: true },
            });
            const state = invAfter?.due_notification_state as Record<string, string> | null;
            expect(state?.[String(step7Id)]).toBe("scheduled");
            await cleanupDueNotificationTestData(prisma, {
                accountId,
                customer,
                invoice,
                dueSequenceId: step7Id,
                sequenceContainerId,
                templateId,
            });
        });

        it("on send sets due_notification_state to sent", async () => {
            if (skipDueNotificationState) return;
            await prisma.invoice.update({
                where: { id: testData.invoice.id },
                data: { due_date: dueDateUtcTodayPlusDays(7) },
            });
            await processDueNotifications(testData.customer.id, undefined, undefined, {
                skipSmsSend: true,
                fastForwardScheduledActivities: true,
            });
            await activityWorkflowManager(undefined, undefined, undefined, undefined, undefined, true);
            const inv = await prisma.invoice.findUnique({
                where: { id: testData.invoice.id },
                select: { due_notification_state: true },
            });
            const state = inv?.due_notification_state as Record<string, string> | null;
            const activityAfter = await prisma.activity.findFirst({
                where: {
                    customer_id: testData.customer.id,
                    activity_sequence_id: testData.dueSequenceId,
                },
                select: { status: true },
            });
            if (activityAfter?.status === "SENT" || activityAfter?.status === "DELIVERED") {
                expect(state?.[String(testData.dueSequenceId)]).toBe("sent");
            } else {
                expect(["scheduled", "sent"]).toContain(state?.[String(testData.dueSequenceId)] ?? "");
            }
        }, 25000);

        it("invoice paid clears state and cancels scheduled activity", async () => {
            if (skipDueNotificationState) return;
            await prisma.invoice.update({
                where: { id: testData.invoice.id },
                data: { due_date: dueDateUtcTodayPlusDays(7) },
            });
            await processDueNotifications(testData.customer.id, undefined, undefined, {
                skipSmsSend: true,
                fastForwardScheduledActivities: true,
            });
            await prisma.invoice.update({
                where: { id: testData.invoice.id },
                data: { status: INVOICE_STATUS_PAID, outstanding_debt: 0, customer_outstanding_debt: 0 },
            });
            const invoiceRecord = await prisma.invoice.findUnique({
                where: { id: testData.invoice.id },
            });
            expect(invoiceRecord).not.toBeNull();
            const invoiceService = new InvoiceService();
            await invoiceService.handleInvoiceChange(invoiceRecord!);
            const inv = await prisma.invoice.findUnique({
                where: { id: testData.invoice.id },
                select: { due_notification_state: true },
            });
            const state = inv?.due_notification_state as Record<string, unknown> | null;
            expect(state === null || Object.keys(state).length === 0).toBe(true);
            const scheduledActivity = await prisma.activity.findFirst({
                where: {
                    customer_id: testData.customer.id,
                    activity_sequence_id: testData.dueSequenceId,
                    status: "SCHEDULED",
                },
            });
            expect(scheduledActivity).toBeNull();
            const cancelledActivity = await prisma.activity.findFirst({
                where: {
                    customer_id: testData.customer.id,
                    activity_sequence_id: testData.dueSequenceId,
                    status: "CANCELLED",
                },
            });
            expect(cancelledActivity).not.toBeNull();
            expect(cancelledActivity?.title).toBe(DUE_ACTIVITY_CANCELED_TITLE);
        });

        it("look-ahead window: no activity beyond LOOK_AHEAD_DAYS", async () => {
            if (skipDueNotificationState) return;
            await cleanupDueNotificationTestData(prisma, {
                accountId: testData.accountId,
                customer: testData.customer,
                invoice: testData.invoice,
                dueSequenceId: testData.dueSequenceId,
                sequenceContainerId: testData.sequenceContainerId,
                templateId: testData.templateId,
                contactId: testData.contactId,
            });
            const accountId = await getOrCreateDueNotificationAccount(prisma);
            const { sequenceContainerId, dueSequenceId, templateId } =
                await createDueSequenceAndTemplate(prisma, accountId, { days_before_due: 7 });
            const customer = await createDueNotificationCustomer(prisma, accountId, {
                sequence_container_id: sequenceContainerId,
            });
            await createDueNotificationContact(prisma, customer.company_id, customer.id);
            const dueDate = new Date();
            dueDate.setHours(0, 0, 0, 0);
            dueDate.setDate(dueDate.getDate() + 20);
            const invoice = await createDueNotificationInvoice(prisma, customer.id, accountId, {
                due_date: dueDate,
            });
            await processDueNotifications(customer.id, undefined, undefined, {
                skipSmsSend: true,
            });
            const activity = await prisma.activity.findFirst({
                where: {
                    customer_id: customer.id,
                    activity_sequence_id: dueSequenceId,
                },
            });
            expect(activity).toBeNull();
            await cleanupDueNotificationTestData(prisma, {
                accountId,
                customer,
                invoice,
                dueSequenceId,
                sequenceContainerId,
                templateId,
            });
        });

        it("notification date in the past: no activity", async () => {
            if (skipDueNotificationState) return;
            await cleanupDueNotificationTestData(prisma, {
                accountId: testData.accountId,
                customer: testData.customer,
                invoice: testData.invoice,
                dueSequenceId: testData.dueSequenceId,
                sequenceContainerId: testData.sequenceContainerId,
                templateId: testData.templateId,
                contactId: testData.contactId,
            });
            const accountId = await getOrCreateDueNotificationAccount(prisma);
            const { sequenceContainerId, dueSequenceId, templateId } =
                await createDueSequenceAndTemplate(prisma, accountId, { days_before_due: 7 });
            const customer = await createDueNotificationCustomer(prisma, accountId, {
                sequence_container_id: sequenceContainerId,
            });
            await createDueNotificationContact(prisma, customer.company_id, customer.id);
            const dueDate = new Date();
            dueDate.setHours(0, 0, 0, 0);
            dueDate.setDate(dueDate.getDate() + 2);
            const invoice = await createDueNotificationInvoice(prisma, customer.id, accountId, {
                due_date: dueDate,
            });
            await processDueNotifications(customer.id, undefined, undefined, {
                skipSmsSend: true,
            });
            const activity = await prisma.activity.findFirst({
                where: {
                    customer_id: customer.id,
                    activity_sequence_id: dueSequenceId,
                },
            });
            expect(activity).toBeNull();
            await cleanupDueNotificationTestData(prisma, {
                accountId,
                customer,
                invoice,
                dueSequenceId,
                sequenceContainerId,
                templateId,
            });
        });

        describe("Customer with no valid contacts", () => {
            it("no due activity created and automation_stuck_no_contacts set when no contacts", async () => {
                const accountId = await getOrCreateDueNotificationAccount(prisma);
                const { sequenceContainerId, dueSequenceId, templateId } =
                    await createDueSequenceAndTemplate(prisma, accountId, { days_before_due: 3 });
                const customer = await createDueNotificationCustomer(prisma, accountId, {
                    sequence_container_id: sequenceContainerId,
                });
                // Do not create a contact - customer has no contacts for due notification
                const dueDate = new Date();
                dueDate.setUTCHours(12, 0, 0, 0);
                dueDate.setUTCDate(dueDate.getUTCDate() + 4);
                const invoice = await createDueNotificationInvoice(prisma, customer.id, accountId, {
                    due_date: dueDate,
                    status: INVOICE_STATUS_DUE,
                });
                await processDueNotifications(customer.id, undefined, undefined, {
                    skipSmsSend: true,
                });
                const activityCount = await prisma.activity.count({
                    where: {
                        customer_id: customer.id,
                        status: "SCHEDULED",
                        ActivitiesSequence: { step_type: "due" },
                    },
                });
                expect(activityCount).toBe(0);
                const updatedCustomer = await prisma.customer.findUnique({
                    where: { id: customer.id },
                    select: { automation_stuck_no_contacts: true },
                });
                expect(updatedCustomer?.automation_stuck_no_contacts).toBe(true);
                await cleanupDueNotificationTestData(prisma, {
                    accountId,
                    customer,
                    invoice,
                    dueSequenceId,
                    sequenceContainerId,
                    templateId,
                });
            });
        });

        it("invoice already has sent or skip state: no duplicate", async () => {
            if (skipDueNotificationState) return;
            await prisma.invoice.update({
                where: { id: testData.invoice.id },
                data: { due_date: dueDateUtcTodayPlusDays(7) },
            });
            await processDueNotifications(testData.customer.id, undefined, undefined, {
                skipSmsSend: true,
                fastForwardScheduledActivities: true,
            });
            await prisma.invoice.update({
                where: { id: testData.invoice.id },
                data: {
                    due_notification_state: {
                        [String(testData.dueSequenceId)]: "sent",
                    },
                },
            });
            const countBefore = await prisma.activity.count({
                where: {
                    customer_id: testData.customer.id,
                    activity_sequence_id: testData.dueSequenceId,
                },
            });
            await processDueNotifications(testData.customer.id, undefined, undefined, {
                skipSmsSend: true,
                fastForwardScheduledActivities: true,
            });
            const countAfter = await prisma.activity.count({
                where: {
                    customer_id: testData.customer.id,
                    activity_sequence_id: testData.dueSequenceId,
                },
            });
            expect(countAfter).toBe(countBefore);
        });

        it("customer with no valid contacts: no activity", async () => {
            if (skipDueNotificationState) return;
            await cleanupDueNotificationTestData(prisma, {
                accountId: testData.accountId,
                customer: testData.customer,
                invoice: testData.invoice,
                dueSequenceId: testData.dueSequenceId,
                sequenceContainerId: testData.sequenceContainerId,
                templateId: testData.templateId,
                contactId: testData.contactId,
            });
            const accountId = await getOrCreateDueNotificationAccount(prisma);
            const { sequenceContainerId, dueSequenceId, templateId } =
                await createDueSequenceAndTemplate(prisma, accountId, { days_before_due: 7 });
            const customer = await createDueNotificationCustomer(prisma, accountId, {
                sequence_container_id: sequenceContainerId,
            });
            await prisma.contact.deleteMany({ where: { customer_id: customer.id } });
            const dueDate = new Date();
            dueDate.setHours(0, 0, 0, 0);
            dueDate.setDate(dueDate.getDate() + 7);
            const invoice = await createDueNotificationInvoice(prisma, customer.id, accountId, {
                due_date: dueDate,
            });
            const result = await processDueNotifications(customer.id, undefined, undefined, {
                skipSmsSend: true,
            });
            expect(result.success).toBe(true);
            const activity = await prisma.activity.findFirst({
                where: {
                    customer_id: customer.id,
                    activity_sequence_id: dueSequenceId,
                },
            });
            expect(activity).toBeNull();
            await prisma.invoice.deleteMany({ where: { customer_id: customer.id } });
            await prisma.customerCollectionPeriod.deleteMany({ where: { customer_id: customer.id } });
            await prisma.customer.delete({ where: { id: customer.id } });
            await prisma.company.delete({ where: { id: customer.company_id } });
            await prisma.activitiesSequence.deleteMany({ where: { id: dueSequenceId } });
            await prisma.sequenceContainer.deleteMany({ where: { id: sequenceContainerId } });
            await prisma.activitiesTemplate.deleteMany({ where: { id: templateId } });
        });

        it("two customers same calendar day: two activities", async () => {
            if (skipDueNotificationState) return;
            await cleanupDueNotificationTestData(prisma, {
                accountId: testData.accountId,
                customer: testData.customer,
                invoice: testData.invoice,
                dueSequenceId: testData.dueSequenceId,
                sequenceContainerId: testData.sequenceContainerId,
                templateId: testData.templateId,
                contactId: testData.contactId,
            });
            const accountId = await getOrCreateDueNotificationAccount(prisma);
            const { sequenceContainerId, dueSequenceId, templateId } =
                await createDueSequenceAndTemplate(prisma, accountId, { days_before_due: 7 });
            const dueDate = new Date();
            dueDate.setUTCHours(0, 0, 0, 0);
            dueDate.setUTCDate(dueDate.getUTCDate() + 7);
            const cust1 = await createDueNotificationCustomer(prisma, accountId, {
                sequence_container_id: sequenceContainerId,
            });
            await createDueNotificationContact(prisma, cust1.company_id, cust1.id);
            await createDueNotificationInvoice(prisma, cust1.id, accountId, {
                due_date: dueDate,
            });
            const cust2 = await createDueNotificationCustomer(prisma, accountId, {
                sequence_container_id: sequenceContainerId,
            });
            await createDueNotificationContact(prisma, cust2.company_id, cust2.id);
            await createDueNotificationInvoice(prisma, cust2.id, accountId, {
                due_date: dueDate,
            });
            await processDueNotifications(cust1.id, undefined, undefined, {
                skipSmsSend: true,
                fastForwardScheduledActivities: true,
            });
            await processDueNotifications(cust2.id, undefined, undefined, {
                skipSmsSend: true,
                fastForwardScheduledActivities: true,
            });
            const activities = await prisma.activity.findMany({
                where: {
                    activity_sequence_id: dueSequenceId,
                    status: "SCHEDULED",
                },
            });
            expect(activities.length).toBe(2);
            await cleanupDueNotificationTestData(prisma, {
                accountId,
                customer: cust1,
                dueSequenceId,
                sequenceContainerId,
                templateId,
            });
            await prisma.activityContact.deleteMany({
                where: { Activity: { customer_id: cust2.id } },
            });
            await prisma.activity.deleteMany({ where: { customer_id: cust2.id } });
            await prisma.invoice.deleteMany({ where: { customer_id: cust2.id } });
            await prisma.contact.deleteMany({ where: { customer_id: cust2.id } });
            await prisma.customerCollectionPeriod.deleteMany({ where: { customer_id: cust2.id } });
            await prisma.customer.delete({ where: { id: cust2.id } });
            await prisma.company.delete({ where: { id: cust2.company_id } });
            await prisma.activitiesSequence.deleteMany({ where: { id: dueSequenceId } });
            await prisma.sequenceContainer.deleteMany({ where: { id: sequenceContainerId } });
            await prisma.activitiesTemplate.deleteMany({ where: { id: templateId } });
        });

        it("schedule time respects step time_of_day across timezones (UTC and others)", async () => {
            if (skipDueNotificationState) return;
            await cleanupDueNotificationTestData(prisma, {
                accountId: testData.accountId,
                customer: testData.customer,
                invoice: testData.invoice,
                dueSequenceId: testData.dueSequenceId,
                sequenceContainerId: testData.sequenceContainerId,
                templateId: testData.templateId,
                contactId: testData.contactId,
            });
            const accountId = await getOrCreateDueNotificationAccount(prisma);
            const { sequenceContainerId, dueSequenceId, templateId } =
                await createDueSequenceAndTemplate(prisma, accountId, {
                    days_before_due: 7,
                    time_of_day: "14:00",
                });

            const timezoneCases: Array<{ label: string; countryIso2: string | null }> = [
                { label: "UTC (no country)", countryIso2: null },
                { label: "Iceland (UTC+0)", countryIso2: "IS" },
                { label: "Cape Verde (UTC-1)", countryIso2: "CV" },
            ];

            for (const { label, countryIso2 } of timezoneCases) {
                let countryId: number | null = null;
                if (countryIso2) {
                    const country = await prisma.country.findFirst({
                        where: { iso2: countryIso2 },
                        select: { id: true },
                    });
                    if (!country) continue;
                    countryId = country.id;
                }

                const customer = await createDueNotificationCustomer(prisma, accountId, {
                    sequence_container_id: sequenceContainerId,
                    country_id: countryId,
                });
                await createDueNotificationContact(prisma, customer.company_id, customer.id);
                const dueDate = new Date();
                dueDate.setUTCHours(0, 0, 0, 0);
                dueDate.setUTCDate(dueDate.getUTCDate() + 7);
                await createDueNotificationInvoice(prisma, customer.id, accountId, {
                    due_date: dueDate,
                });
                await processDueNotifications(customer.id, undefined, undefined, {
                    skipSmsSend: true,
                    fastForwardScheduledActivities: false,
                });
                const activity = await prisma.activity.findFirst({
                    where: {
                        customer_id: customer.id,
                        activity_sequence_id: dueSequenceId,
                    },
                });
                expect(activity, `Activity for case "${label}"`).not.toBeNull();
                expect(activity?.schedule_time, `Schedule time for case "${label}"`).toBeDefined();
                if (activity?.schedule_time) {
                    const timezone =
                        countryIso2 === null ? "UTC" : getCountryTimezone(countryIso2);
                    const inTz = moment(activity.schedule_time).tz(timezone);
                    expect(
                        inTz.hour(),
                        `Case "${label}": expected hour 14 in ${timezone}, got ${inTz.format("HH:mm")}`
                    ).toBe(14);
                    expect(
                        inTz.minute(),
                        `Case "${label}": expected minute 0 in ${timezone}`
                    ).toBe(0);
                }
                await cleanupDueNotificationTestData(prisma, {
                    accountId,
                    customer,
                });
            }
            await prisma.activitiesSequence.deleteMany({ where: { id: dueSequenceId } }).catch(() => {});
            await prisma.sequenceContainer.deleteMany({ where: { id: sequenceContainerId } }).catch(() => {});
            await prisma.activitiesTemplate.deleteMany({ where: { id: templateId } }).catch(() => {});
        });

        it("only DUE-status invoices considered", async () => {
            if (skipDueNotificationState) return;
            await cleanupDueNotificationTestData(prisma, {
                accountId: testData.accountId,
                customer: testData.customer,
                invoice: testData.invoice,
                dueSequenceId: testData.dueSequenceId,
                sequenceContainerId: testData.sequenceContainerId,
                templateId: testData.templateId,
                contactId: testData.contactId,
            });
            const accountId = await getOrCreateDueNotificationAccount(prisma);
            const { sequenceContainerId, dueSequenceId, templateId } =
                await createDueSequenceAndTemplate(prisma, accountId, { days_before_due: 7 });
            const customer = await createDueNotificationCustomer(prisma, accountId, {
                sequence_container_id: sequenceContainerId,
            });
            await createDueNotificationContact(prisma, customer.company_id, customer.id);
            const dueDate = new Date();
            dueDate.setHours(0, 0, 0, 0);
            dueDate.setDate(dueDate.getDate() + 7);
            const invoice = await createDueNotificationInvoice(prisma, customer.id, accountId, {
                due_date: dueDate,
                status: INVOICE_STATUS_OVERDUE,
            });
            await processDueNotifications(customer.id, undefined, undefined, {
                skipSmsSend: true,
            });
            const activity = await prisma.activity.findFirst({
                where: {
                    customer_id: customer.id,
                    activity_sequence_id: dueSequenceId,
                },
            });
            expect(activity).toBeNull();
            await cleanupDueNotificationTestData(prisma, {
                accountId,
                customer,
                invoice,
                dueSequenceId,
                sequenceContainerId,
                templateId,
            });
        });

        it("full cancel of due activity clears state for all invoices", async () => {
            if (skipDueNotificationState) return;
            await prisma.invoice.update({
                where: { id: testData.invoice.id },
                data: { due_date: dueDateUtcTodayPlusDays(7) },
            });
            await processDueNotifications(testData.customer.id, undefined, undefined, {
                skipSmsSend: true,
                fastForwardScheduledActivities: true,
            });
            const activity = await prisma.activity.findFirst({
                where: {
                    customer_id: testData.customer.id,
                    activity_sequence_id: testData.dueSequenceId,
                    status: "SCHEDULED",
                },
            });
            expect(activity).not.toBeNull();
            const { DueNotificationService } = await import("../../../server/services/DueNotificationService");
            const dueSvc = new DueNotificationService();
            await dueSvc.cancelDueNotificationsForInvoices([testData.invoice.id]);
            const inv = await prisma.invoice.findUnique({
                where: { id: testData.invoice.id },
                select: { due_notification_state: true },
            });
            const state = inv?.due_notification_state as Record<string, unknown> | null;
            expect(state === null || state[String(testData.dueSequenceId)] === undefined).toBe(true);
            const cancelledActivity = await prisma.activity.findFirst({
                where: {
                    customer_id: testData.customer.id,
                    activity_sequence_id: testData.dueSequenceId,
                    status: "CANCELLED",
                },
            });
            expect(cancelledActivity).not.toBeNull();
            expect(cancelledActivity?.title).toBe(DUE_ACTIVITY_CANCELED_TITLE);
        });
    }
);

describe.skipIf(skipIntegrationTests)(
    "Dispute creation and resolution (due notifications)",
    () => {
        let testData: Awaited<ReturnType<typeof createDueNotificationTestData>>;
        let disputeReasonId: number;
        let skipDueNotificationState = false;
        let testUserId: string;

        beforeAll(async () => {
            await assertTestAndAppUseSameDatabase();
            await ensureInvoiceStatuses(prisma);
            const hasColumn = await hasDueNotificationStateColumn(prisma);
            if (!hasColumn) skipDueNotificationState = true;
        });

        afterAll(async () => {
            if (testData) {
                await prisma.customerDispute.deleteMany({
                    where: { customer_id: testData.customer.id },
                }).catch(() => {});
                if (disputeReasonId) {
                    await prisma.disputeReason.deleteMany({
                        where: { id: disputeReasonId },
                    }).catch(() => {});
                }
                await cleanupDueNotificationTestData(prisma, {
                    accountId: testData.accountId,
                    customer: testData.customer,
                    invoice: testData.invoice,
                    dueSequenceId: testData.dueSequenceId,
                    sequenceContainerId: testData.sequenceContainerId,
                    templateId: testData.templateId,
                    contactId: testData.contactId,
                });
            }
            await prisma.$disconnect();
        });

        beforeEach(async () => {
            testData = await createDueNotificationTestData(prisma, {
                due_date_offset_days: 7,
                days_before_due: 7,
                useUtcForDueDate: true,
            });
            testUserId = await getOrCreateDueNotificationTestUser(prisma, testData.accountId);
            disputeReasonId = await createDueNotificationDisputeReason(
                prisma,
                testData.accountId
            );
        });

        it("dispute creation cancels due notifications for disputed invoice", async () => {
            if (skipDueNotificationState) return;
            await prisma.invoice.update({
                where: { id: testData.invoice.id },
                data: { due_date: dueDateUtcTodayPlusDays(7) },
            });
            await processDueNotifications(testData.customer.id, undefined, undefined, {
                skipSmsSend: true,
                fastForwardScheduledActivities: true,
            });
            const stateBefore = await prisma.invoice.findUnique({
                where: { id: testData.invoice.id },
                select: { due_notification_state: true },
            });
            expect((stateBefore?.due_notification_state as Record<string, string>)?.[String(testData.dueSequenceId)]).toBe("scheduled");

            const disputeService = new DisputeService();
            disputeService.setLoggedInUserId(testUserId);
            await disputeService.createDispute({
                customerId: testData.customer.id,
                userName: "e2e-test",
                invoiceIds: [testData.invoice.id],
                reasonId: disputeReasonId,
                comment: "E2E dispute",
            });

            const inv = await prisma.invoice.findUnique({
                where: { id: testData.invoice.id },
                select: { due_notification_state: true },
            });
            const state = inv?.due_notification_state as Record<string, string> | null;
            expect(state?.[String(testData.dueSequenceId)]).toBeUndefined();
            const scheduledActivity = await prisma.activity.findFirst({
                where: {
                    customer_id: testData.customer.id,
                    activity_sequence_id: testData.dueSequenceId,
                    status: "SCHEDULED",
                },
            });
            expect(scheduledActivity).toBeNull();
        });

        it("dispute resolution re-add when SCHEDULED activity exists in future", async () => {
            if (skipDueNotificationState) return;
            await prisma.invoice.update({
                where: { id: testData.invoice.id },
                data: { due_date: dueDateUtcTodayPlusDays(7) },
            });
            const dueDate8 = dueDateUtcTodayPlusDays(8);
            const secondInvoice = await createDueNotificationInvoice(prisma, testData.customer.id, testData.accountId, {
                due_date: dueDate8,
            });
            await processDueNotifications(testData.customer.id, undefined, undefined, {
                skipSmsSend: true,
                fastForwardScheduledActivities: true,
            });
            const disputeService = new DisputeService();
            disputeService.setLoggedInUserId(testUserId);
            await disputeService.createDispute({
                customerId: testData.customer.id,
                userName: "e2e-test",
                invoiceIds: [testData.invoice.id],
                reasonId: disputeReasonId,
                comment: "E2E dispute",
            });
            const dispute = await prisma.customerDispute.findFirst({
                where: { customer_id: testData.customer.id },
                orderBy: { id: "desc" },
            });
            expect(dispute).not.toBeNull();
            const resolveService = new DisputeService();
            resolveService.setDisputeId(dispute!.id);
            resolveService.setCustomerId(testData.customer.id);
            resolveService.setAccountId(testData.accountId);
            resolveService.setLoggedInUserId(testUserId);
            await resolveService.resolveDispute("Resolved", "Accepted", "E2E resolution");
            // With nearest-only we do not create future activities; re-run due job so the resolved invoice gets scheduled for today
            await processDueNotifications(testData.customer.id, undefined, undefined, { skipSmsSend: true, fastForwardScheduledActivities: true });
            const inv = await prisma.invoice.findUnique({
                where: { id: testData.invoice.id },
                select: { due_notification_state: true },
            });
            const state = inv?.due_notification_state as Record<string, string> | null;
            expect(state?.[String(testData.dueSequenceId)]).toBe("scheduled");
            await prisma.invoice.delete({ where: { id: secondInvoice.id } }).catch(() => {});
        });

        it("dispute resolution skip_due_to_dispute when no future SCHEDULED", async () => {
            if (skipDueNotificationState) return;
            await prisma.invoice.update({
                where: { id: testData.invoice.id },
                data: { due_date: dueDateUtcTodayPlusDays(7) },
            });
            await processDueNotifications(testData.customer.id, undefined, undefined, {
                skipSmsSend: true,
                fastForwardScheduledActivities: true,
            });
            await activityWorkflowManager(undefined, undefined, undefined, undefined, undefined, true);
            const disputeService = new DisputeService();
            disputeService.setLoggedInUserId(testUserId);
            await disputeService.createDispute({
                customerId: testData.customer.id,
                userName: "e2e-test",
                invoiceIds: [testData.invoice.id],
                reasonId: disputeReasonId,
                comment: "E2E dispute",
            });
            const dispute = await prisma.customerDispute.findFirst({
                where: { customer_id: testData.customer.id },
                orderBy: { id: "desc" },
            });
            expect(dispute).not.toBeNull();
            const resolveService = new DisputeService();
            resolveService.setDisputeId(dispute!.id);
            resolveService.setCustomerId(testData.customer.id);
            resolveService.setAccountId(testData.accountId);
            resolveService.setLoggedInUserId(testUserId);
            await resolveService.resolveDispute("Resolved", "Accepted", "E2E resolution");
            const inv = await prisma.invoice.findUnique({
                where: { id: testData.invoice.id },
                select: { due_notification_state: true },
            });
            const state = inv?.due_notification_state as Record<string, string> | null;
            expect(state?.[String(testData.dueSequenceId)]).toBe("skip_due_to_dispute");
        }, 25000);
    }
);
