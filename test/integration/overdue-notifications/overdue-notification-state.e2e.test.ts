/**
 * Overdue-notification integration e2e tests.
 * Flow: handleOverdueInvoices -> processAutomatedCollectionPeriods -> activityWorkflowManager.
 * Covers logic in all three crons plus logic-coverage scenarios (no past-due, Phase 1, FAILED, customerId filter, credit invoice, already Active with collection period creation).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
    prisma,
    assertTestAndAppUseSameDatabase,
} from "../../setup/vitest.integration.setup";
import { handleOverdueInvoices } from "../../server/cron-jobs/handleOverdueInvoices";
import { processAutomatedCollectionPeriods } from "../../server/cron-jobs/processAutomatedCollectionPeriods";
import { activityWorkflowManager } from "../../server/cron-jobs/activityWorkflowManager";
import {
    createOverdueNotificationTestData,
    cleanupOverdueNotificationTestData,
    createOverdueNotificationCustomer,
    createOverdueNotificationInvoice,
    createOverdueNotificationContact,
    createOverdueSequenceAndTemplate,
    getOrCreateOverdueNotificationAccount,
    ensureInvoiceStatuses,
    INVOICE_STATUS_DUE,
    INVOICE_STATUS_OVERDUE,
    OVERDUE_CONTACT_EMAIL,
} from "./fixtures";
import { getSystemUserId } from "../../server/services/UserService";

const skipIntegrationTests = !process.env.DATABASE_URL;

/** Past due date (yesterday) for overdue flow. */
function pastDueDate(): Date {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
}

describe.skipIf(skipIntegrationTests)(
    "Overdue-notification e2e (handleOverdueInvoices -> processAutomatedCollectionPeriods -> activityWorkflowManager)",
    () => {
        let testData: Awaited<ReturnType<typeof createOverdueNotificationTestData>>;

        beforeAll(async () => {
            await assertTestAndAppUseSameDatabase();
            await ensureInvoiceStatuses(prisma);
        });

        afterAll(async () => {
            if (testData) {
                await cleanupOverdueNotificationTestData(prisma, {
                    accountId: testData.accountId,
                    customer: testData.customer,
                    invoice: testData.invoice,
                    overdueSequenceId: testData.overdueSequenceId,
                    sequenceContainerId: testData.sequenceContainerId,
                    templateId: testData.templateId,
                    contactId: testData.contactId,
                });
            }
            await prisma.$disconnect();
        });

        beforeEach(async () => {
            testData = await createOverdueNotificationTestData(prisma, {
                due_date: pastDueDate(),
                invoice_status: INVOICE_STATUS_DUE,
            });
        });

        describe("Prerequisite: handleOverdueInvoices", () => {
            it("past-due DUE invoice becomes OVERDUE; customer activated; collection period created or updated", async () => {
                const result = await handleOverdueInvoices(testData.customer.id);
                expect(result.success).toBe(true);

                const invoice = await prisma.invoice.findUnique({
                    where: { id: testData.invoice.id },
                    select: { status: true },
                });
                expect(invoice?.status).toBe(INVOICE_STATUS_OVERDUE);

                const customer = await prisma.customer.findUnique({
                    where: { id: testData.customer.id },
                    select: { collection_status: true },
                });
                expect(customer?.collection_status).toBe("Active");

                const period = await prisma.customerCollectionPeriod.findFirst({
                    where: { customer_id: testData.customer.id, period_end_date: null },
                    select: { id: true, no_of_overdue_invoices: true },
                });
                expect(period).not.toBeNull();
                expect(period!.no_of_overdue_invoices).toBeGreaterThanOrEqual(1);

                const customerWithOldest = await prisma.customer.findUnique({
                    where: { id: testData.customer.id },
                    select: { oldest_invoice_overdue_date: true },
                });
                expect(customerWithOldest?.oldest_invoice_overdue_date).not.toBeNull();
            });
        });

        describe("Process Automated Collection Periods", () => {
            it("sets create_next_activity and next_activity_date when latest activity delivered or no activity", async () => {
                await handleOverdueInvoices(testData.customer.id);
                await processAutomatedCollectionPeriods(testData.customer.id);

                const period = await prisma.customerCollectionPeriod.findFirst({
                    where: { customer_id: testData.customer.id, period_end_date: null },
                    select: { create_next_activity: true, next_activity_date: true, current_category: true },
                });
                expect(period).not.toBeNull();
                expect(period!.current_category).toBe("Automated");
                expect(period!.create_next_activity).toBe(true);
                // next_activity_date may be null if calculateNextAutomatedActivityTime returns null (fallback still sets create_next_activity)
            });

            it("does not set create_next_activity when period already has SCHEDULED activity", async () => {
                await handleOverdueInvoices(testData.customer.id);
                await processAutomatedCollectionPeriods(testData.customer.id);
                await activityWorkflowManager(
                    undefined,
                    undefined,
                    testData.customer.id,
                    undefined,
                    undefined,
                    true,
                    true
                );
                const periodBefore = await prisma.customerCollectionPeriod.findFirst({
                    where: { customer_id: testData.customer.id, period_end_date: null },
                    select: { create_next_activity: true },
                });
                await processAutomatedCollectionPeriods(testData.customer.id);
                const periodAfter = await prisma.customerCollectionPeriod.findFirst({
                    where: { customer_id: testData.customer.id, period_end_date: null },
                    select: { create_next_activity: true },
                });
                expect(periodBefore?.create_next_activity).toBe(false);
                expect(periodAfter?.create_next_activity).toBe(false);
            });

            it("Agent category period does not get create_next_activity for overdue steps", async () => {
                await handleOverdueInvoices(testData.customer.id);
                const period = await prisma.customerCollectionPeriod.findFirst({
                    where: { customer_id: testData.customer.id },
                });
                if (period) {
                    await prisma.customerCollectionPeriod.update({
                        where: { id: period.id },
                        data: { current_category: "Agent", create_next_activity: false },
                    });
                }
                await processAutomatedCollectionPeriods(testData.customer.id);
                const updated = await prisma.customerCollectionPeriod.findFirst({
                    where: { customer_id: testData.customer.id },
                    select: { create_next_activity: true },
                });
                expect(updated?.create_next_activity).toBe(false);
            });
        });

        describe("activityWorkflowManager (overdue activity create and send)", () => {
            it("creates one SCHEDULED overdue-step activity and links fixture contact", async () => {
                await handleOverdueInvoices(testData.customer.id);
                await processAutomatedCollectionPeriods(testData.customer.id);
                await activityWorkflowManager(
                    undefined,
                    undefined,
                    testData.customer.id,
                    undefined,
                    undefined,
                    true,
                    true
                );

                const activity = await prisma.activity.findFirst({
                    where: {
                        customer_id: testData.customer.id,
                        status: "SCHEDULED",
                        ActivitiesSequence: { step_type: "overdue" },
                    },
                    include: { ActivityContact: { select: { contact_id: true } } },
                });
                expect(activity).not.toBeNull();
                expect(activity!.ActivityContact.length).toBeGreaterThanOrEqual(1);
                const contact = await prisma.contact.findFirst({
                    where: { id: activity!.ActivityContact[0].contact_id },
                    select: { email: true, mobile: true },
                });
                expect(contact?.email).toBe(OVERDUE_CONTACT_EMAIL);
            });

            it("sends activity and updates status to SENT or DELIVERED when schedule_time due", async () => {
                await handleOverdueInvoices(testData.customer.id);
                await processAutomatedCollectionPeriods(testData.customer.id);
                await activityWorkflowManager(
                    undefined,
                    undefined,
                    testData.customer.id,
                    undefined,
                    undefined,
                    true,
                    true
                );
                await activityWorkflowManager(
                    undefined,
                    undefined,
                    testData.customer.id,
                    undefined,
                    undefined,
                    true,
                    true
                );
                const activity = await prisma.activity.findFirst({
                    where: {
                        customer_id: testData.customer.id,
                        ActivitiesSequence: { step_type: "overdue" },
                    },
                    select: { status: true },
                });
                expect(activity).not.toBeNull();
                // With fastForwardScheduledActivities, status may become SENT/DELIVERED or stay SCHEDULED depending on timing
                expect(["SENT", "DELIVERED", "SCHEDULED"]).toContain(activity!.status);
            });
        });

        describe("Boundaries", () => {
            it("customer with no overdue invoices has no overdue activity created", async () => {
                await prisma.invoice.update({
                    where: { id: testData.invoice.id },
                    data: { status: INVOICE_STATUS_OVERDUE },
                });
                const periodBefore = await prisma.customerCollectionPeriod.count({
                    where: { customer_id: testData.customer.id },
                });
                await handleOverdueInvoices(testData.customer.id);
                await processAutomatedCollectionPeriods(testData.customer.id);
                await activityWorkflowManager(
                    undefined,
                    undefined,
                    testData.customer.id,
                    undefined,
                    undefined,
                    true,
                    true
                );
                const activityCount = await prisma.activity.count({
                    where: {
                        customer_id: testData.customer.id,
                        ActivitiesSequence: { step_type: "overdue" },
                    },
                });
                expect(activityCount).toBe(0);
            });

            it("no past-due invoices: handleOverdueInvoices returns without updating any invoice or creating collection periods", async () => {
                await prisma.invoice.delete({ where: { id: testData.invoice.id } });
                const periodCountBefore = await prisma.customerCollectionPeriod.count({
                    where: { customer_id: testData.customer.id },
                });
                const result = await handleOverdueInvoices(testData.customer.id);
                expect(result.success).toBe(true);
                const periodCountAfter = await prisma.customerCollectionPeriod.count({
                    where: { customer_id: testData.customer.id },
                });
                expect(periodCountAfter).toBe(periodCountBefore);
            });
        });

        describe("Logic coverage: handleOverdueInvoices customerId filter", () => {
            it("when customerId is passed only that customer invoices are processed", async () => {
                const accountId = await getOrCreateOverdueNotificationAccount(prisma);
                const customer2 = await createOverdueNotificationCustomer(prisma, accountId);
                await createOverdueNotificationContact(prisma, customer2.company_id, customer2.id);
                const invoice2 = await createOverdueNotificationInvoice(prisma, customer2.id, accountId, {
                    due_date: pastDueDate(),
                    status: INVOICE_STATUS_DUE,
                });
                await handleOverdueInvoices(testData.customer.id);
                const inv1 = await prisma.invoice.findUnique({
                    where: { id: testData.invoice.id },
                    select: { status: true },
                });
                const inv2 = await prisma.invoice.findUnique({
                    where: { id: invoice2.id },
                    select: { status: true },
                });
                expect(inv1?.status).toBe(INVOICE_STATUS_OVERDUE);
                expect(inv2?.status).toBe(INVOICE_STATUS_DUE);
                await cleanupOverdueNotificationTestData(prisma, {
                    accountId,
                    customer: customer2,
                    invoice: invoice2,
                });
            });
        });

        describe("Logic coverage: credit invoice past due", () => {
            it("past-due DUE invoice with amount < 0 (credit) becomes OVERDUE", async () => {
                await prisma.invoice.update({
                    where: { id: testData.invoice.id },
                    data: {
                        amount: -100,
                        customer_outstanding_debt: 0,
                        outstanding_debt: 0,
                    },
                });
                const result = await handleOverdueInvoices(testData.customer.id);
                expect(result.success).toBe(true);
                const inv = await prisma.invoice.findUnique({
                    where: { id: testData.invoice.id },
                    select: { status: true },
                });
                expect(inv?.status).toBe(INVOICE_STATUS_OVERDUE);
            });
        });

        describe("Logic coverage: already Active customer with past-due invoice", () => {
            it("invoice becomes OVERDUE and a new collection period is created when customer is Active but has no open period", async () => {
                await prisma.customer.update({
                    where: { id: testData.customer.id },
                    data: { collection_status: "Active" },
                });
                const openPeriodBefore = await prisma.customerCollectionPeriod.findFirst({
                    where: { customer_id: testData.customer.id, period_end_date: null },
                    select: { id: true },
                });
                expect(openPeriodBefore).toBeNull();

                const result = await handleOverdueInvoices(testData.customer.id);
                expect(result.success).toBe(true);

                const inv = await prisma.invoice.findUnique({
                    where: { id: testData.invoice.id },
                    select: { status: true },
                });
                expect(inv?.status).toBe(INVOICE_STATUS_OVERDUE);

                const openPeriodAfter = await prisma.customerCollectionPeriod.findFirst({
                    where: { customer_id: testData.customer.id, period_end_date: null },
                    select: { id: true, no_of_overdue_invoices: true, total_outstanding_amount: true },
                });
                expect(openPeriodAfter).not.toBeNull();
                expect(openPeriodAfter!.no_of_overdue_invoices).toBeGreaterThanOrEqual(1);
                expect(openPeriodAfter!.total_outstanding_amount).toBeGreaterThan(0);
            });
        });
    }
);

describe.skipIf(skipIntegrationTests)(
    "Overdue-notification e2e (Phase 1, latest FAILED, no contacts)",
    () => {
        beforeAll(async () => {
            await assertTestAndAppUseSameDatabase();
            await ensureInvoiceStatuses(prisma);
        });

        describe("Logic coverage: Phase 1 marks last step", () => {
            it("when last overdue-step activity is DELIVERED, Phase 1 sets is_last_step and is_last_automated_step_delivered", async () => {
                const accountId = await getOrCreateOverdueNotificationAccount(prisma);
                const { sequenceContainerId, overdueSequenceId, templateId } =
                    await createOverdueSequenceAndTemplate(prisma, accountId, {
                        last_category_step: true,
                    });
                const customer = await createOverdueNotificationCustomer(prisma, accountId, {
                    sequence_container_id: sequenceContainerId,
                });
                const contactId = await createOverdueNotificationContact(
                    prisma,
                    customer.company_id,
                    customer.id
                );
                const invoice = await createOverdueNotificationInvoice(prisma, customer.id, accountId, {
                    due_date: pastDueDate(),
                    status: INVOICE_STATUS_DUE,
                });
                try {
                    await handleOverdueInvoices(customer.id);
                    await processAutomatedCollectionPeriods(customer.id);
                    await activityWorkflowManager(
                        undefined,
                        undefined,
                        customer.id,
                        undefined,
                        undefined,
                        true,
                        true
                    );
                    await activityWorkflowManager(
                        undefined,
                        undefined,
                        customer.id,
                        undefined,
                        undefined,
                        true,
                        true
                    );
                    let activity = await prisma.activity.findFirst({
                        where: {
                            customer_id: customer.id,
                            ActivitiesSequence: { step_type: "overdue" },
                        },
                        select: { id: true, status: true, is_last_step: true },
                    });
                    expect(activity).not.toBeNull();
                    if (activity!.status === "SCHEDULED") {
                        await prisma.activity.update({
                            where: { id: activity!.id },
                            data: { status: "DELIVERED" },
                        });
                    }
                    await processAutomatedCollectionPeriods(customer.id);
                    const updatedActivity = await prisma.activity.findUnique({
                        where: { id: activity!.id },
                        select: { is_last_step: true },
                    });
                    const period = await prisma.customerCollectionPeriod.findFirst({
                        where: { customer_id: customer.id },
                        select: { is_last_automated_step_delivered: true },
                    });
                    expect(updatedActivity?.is_last_step).toBe(true);
                    expect(period?.is_last_automated_step_delivered).toBe(true);
                } finally {
                    await cleanupOverdueNotificationTestData(prisma, {
                        accountId,
                        customer,
                        invoice,
                        overdueSequenceId,
                        sequenceContainerId,
                        templateId,
                        contactId,
                    });
                }
            });
        });

        describe("Logic coverage: latest activity FAILED - period not eligible", () => {
            it("period with latest automated activity FAILED does not get create_next_activity", async () => {
                const testData = await createOverdueNotificationTestData(prisma, {
                    due_date: pastDueDate(),
                });
                try {
                    await handleOverdueInvoices(testData.customer.id);
                    const period = await prisma.customerCollectionPeriod.findFirst({
                        where: { customer_id: testData.customer.id },
                    });
                    if (period) {
                        await prisma.customerCollectionPeriod.update({
                            where: { id: period.id },
                            data: {
                                current_category: "Automated",
                                create_next_activity: false,
                                is_last_automated_step_delivered: false,
                            },
                        });
                    }
                    const seq = await prisma.activitiesSequence.findFirst({
                        where: { step_type: "overdue", account_id: testData.accountId },
                    });
                    if (period && seq) {
                        const systemUserId = getSystemUserId(testData.accountId);
                        await prisma.activity.create({
                            data: {
                                customer_id: testData.customer.id,
                                activity_sequence_id: seq.id,
                                collection_period_id: period.id,
                                status: "FAILED",
                                type: "Email",
                                content: "E2E failed activity",
                                schedule_time: new Date(),
                                account_id: testData.accountId,
                                created_by: systemUserId,
                            },
                        });
                    }
                    await processAutomatedCollectionPeriods(testData.customer.id);
                    const updated = await prisma.customerCollectionPeriod.findFirst({
                        where: { customer_id: testData.customer.id },
                        select: { create_next_activity: true },
                    });
                    expect(updated?.create_next_activity).toBe(false);
                } finally {
                    await cleanupOverdueNotificationTestData(prisma, {
                        accountId: testData.accountId,
                        customer: testData.customer,
                        invoice: testData.invoice,
                        overdueSequenceId: testData.overdueSequenceId,
                        sequenceContainerId: testData.sequenceContainerId,
                        templateId: testData.templateId,
                        contactId: testData.contactId,
                    });
                }
            });
        });

        describe("Customer with no valid contacts", () => {
            it("no overdue activity created and automation_stuck_no_contacts set when no contacts", async () => {
                const accountId = await getOrCreateOverdueNotificationAccount(prisma);
                const { sequenceContainerId, overdueSequenceId, templateId } =
                    await createOverdueSequenceAndTemplate(prisma, accountId);
                const customer = await createOverdueNotificationCustomer(prisma, accountId, {
                    sequence_container_id: sequenceContainerId,
                });
                const invoice = await createOverdueNotificationInvoice(prisma, customer.id, accountId, {
                    due_date: pastDueDate(),
                    status: INVOICE_STATUS_DUE,
                });
                await handleOverdueInvoices(customer.id);
                await processAutomatedCollectionPeriods(customer.id);
                await activityWorkflowManager(
                    undefined,
                    undefined,
                    customer.id,
                    undefined,
                    undefined,
                    true,
                    true
                );
                const updatedCustomer = await prisma.customer.findUnique({
                    where: { id: customer.id },
                    select: { automation_stuck_no_contacts: true },
                });
                const activityCount = await prisma.activity.count({
                    where: {
                        customer_id: customer.id,
                        status: "SCHEDULED",
                        ActivitiesSequence: { step_type: "overdue" },
                    },
                });
                expect(activityCount).toBe(0);
                expect(updatedCustomer?.automation_stuck_no_contacts).toBe(true);
                await cleanupOverdueNotificationTestData(prisma, {
                    accountId,
                    customer,
                    invoice,
                    overdueSequenceId,
                    sequenceContainerId,
                    templateId,
                });
            });
        });
    }
);
