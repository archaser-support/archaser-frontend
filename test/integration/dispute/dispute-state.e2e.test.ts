/**
 * Dispute process integration e2e tests.
 * Flow: DisputeService create/resolve/cancel, collection period, activityWorkflowManager.
 * Covers: main flow, boundaries, logic coverage (multiple disputes, multiple invoices, invoice already in open dispute), portal-created disputes.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
    prisma,
    assertTestAndAppUseSameDatabase,
} from "../../setup/vitest.integration.setup";
import { DisputeService } from "../../server/services/DisputeService";
import { processAutomatedCollectionPeriods } from "../../server/cron-jobs/processAutomatedCollectionPeriods";
import { activityWorkflowManager } from "../../server/cron-jobs/activityWorkflowManager";
import {
    createDisputeTestData,
    cleanupDisputeTestData,
    createDisputeCustomer,
    createDisputeContact,
    createDisputeInvoice,
    createDisputeReason,
    createDisputeSequenceAndTemplate,
    getOrCreateDisputeAccount,
    ensureInvoiceStatuses,
    ensurePortalUserForAccount,
    getOrCreateDisputeTestUser,
    INVOICE_STATUS,
} from "./fixtures";
import { getPortalUserId } from "../../server/services/UserService";

const skipIntegrationTests = !process.env.DATABASE_URL;

describe.skipIf(skipIntegrationTests)(
    "Dispute process e2e (DisputeService create/resolve/cancel)",
    () => {
        let testData: Awaited<ReturnType<typeof createDisputeTestData>>;

        beforeAll(async () => {
            await assertTestAndAppUseSameDatabase();
            await ensureInvoiceStatuses(prisma);
        });

        afterAll(async () => {
            if (testData) {
                await cleanupDisputeTestData(prisma, {
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
            testData = await createDisputeTestData(prisma, {
                previous_category: "Automated",
            });
        });

        describe("Prerequisite", () => {
            it("test data has customer with collection period Automated and overdue invoice", async () => {
                const period = await prisma.customerCollectionPeriod.findFirst({
                    where: { customer_id: testData.customer.id, period_end_date: null },
                    select: { id: true, current_category: true, previous_category: true },
                });
                expect(period).not.toBeNull();
                expect(period!.current_category).toBe("Automated");
                expect(period!.previous_category).toBe("Automated");
                const inv = await prisma.invoice.findUnique({
                    where: { id: testData.invoice.id },
                    select: { status: true },
                });
                expect(inv?.status).toBe(INVOICE_STATUS.OVERDUE);
            });
        });

        describe("Main flow – Create dispute", () => {
            it("create dispute sets period category to Dispute and creates Dispute activity", async () => {
                const disputeService = new DisputeService();
                disputeService.setLoggedInUserId(testData.testUserId);
                await disputeService.createDispute({
                    customerId: testData.customer.id,
                    userName: "e2e-test",
                    invoiceIds: [testData.invoice.id],
                    reasonId: testData.disputeReasonId,
                    comment: "E2E dispute",
                });

                const period = await prisma.customerCollectionPeriod.findFirst({
                    where: { customer_id: testData.customer.id, period_end_date: null },
                    select: { current_category: true },
                });
                expect(period?.current_category).toBe("Dispute");

                const disputeActivity = await prisma.activity.findFirst({
                    where: {
                        customer_id: testData.customer.id,
                        type: "Dispute",
                    },
                    select: { id: true },
                });
                expect(disputeActivity).not.toBeNull();
            });

            it("create dispute cancels SCHEDULED activities for the collection period", async () => {
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
                const scheduledBefore = await prisma.activity.count({
                    where: {
                        customer_id: testData.customer.id,
                        status: "SCHEDULED",
                        collection_period_id: testData.periodId,
                    },
                });
                expect(scheduledBefore).toBeGreaterThanOrEqual(1);

                const disputeService = new DisputeService();
                disputeService.setLoggedInUserId(testData.testUserId);
                await disputeService.createDispute({
                    customerId: testData.customer.id,
                    userName: "e2e-test",
                    invoiceIds: [testData.invoice.id],
                    reasonId: testData.disputeReasonId,
                    comment: "E2E dispute",
                });

                const scheduledAfter = await prisma.activity.count({
                    where: {
                        customer_id: testData.customer.id,
                        status: "SCHEDULED",
                        collection_period_id: testData.periodId,
                    },
                });
                expect(scheduledAfter).toBe(0);
            });
        });

        describe("Main flow – Resolve dispute (revert to Automated)", () => {
            it("resolve dispute reverts period to previous_category when no other open disputes", async () => {
                const disputeService = new DisputeService();
                disputeService.setLoggedInUserId(testData.testUserId);
                await disputeService.createDispute({
                    customerId: testData.customer.id,
                    userName: "e2e-test",
                    invoiceIds: [testData.invoice.id],
                    reasonId: testData.disputeReasonId,
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
                resolveService.setLoggedInUserId(testData.testUserId);
                await resolveService.resolveDispute("Resolved", "Accepted", "E2E resolution");

                const period = await prisma.customerCollectionPeriod.findFirst({
                    where: { customer_id: testData.customer.id, period_end_date: null },
                    select: { current_category: true },
                });
                expect(period?.current_category).toBe("Automated");
            });

            it("resolve dispute when period was created only for dispute (no previous_category) closes the collection period", async () => {
                const accountId = await getOrCreateDisputeAccount(prisma);
                const { sequenceContainerId, overdueSequenceId, templateId } =
                    await createDisputeSequenceAndTemplate(prisma, accountId);
                const customer = await createDisputeCustomer(prisma, accountId, {
                    sequence_container_id: sequenceContainerId,
                    previous_category: "Automated",
                });
                const contactId = await createDisputeContact(
                    prisma,
                    customer.company_id,
                    customer.id
                );
                const invoice = await createDisputeInvoice(prisma, customer.id, accountId, {
                    status: INVOICE_STATUS.OVERDUE,
                    customer_outstanding_debt: 500,
                });
                await prisma.customer.update({
                    where: { id: customer.id },
                    data: {
                        total_due_amount: 500,
                        customer_due_amount1: 500,
                    },
                });
                const disputeReasonId = await createDisputeReason(prisma, accountId);
                const testUserId = await getOrCreateDisputeTestUser(prisma, accountId);

                await prisma.customerCollectionPeriod.deleteMany({
                    where: { customer_id: customer.id },
                });

                const disputeService = new DisputeService();
                disputeService.setLoggedInUserId(testUserId);
                await disputeService.createDispute({
                    customerId: customer.id,
                    userName: "e2e-test",
                    invoiceIds: [invoice.id],
                    reasonId: disputeReasonId,
                    comment: "Dispute on period created for dispute only",
                });

                const dispute = await prisma.customerDispute.findFirst({
                    where: { customer_id: customer.id },
                    orderBy: { id: "desc" },
                    select: { id: true, customer_collection_period_id: true },
                });
                expect(dispute).not.toBeNull();
                expect(dispute!.customer_collection_period_id).not.toBeNull();

                const resolveService = new DisputeService();
                resolveService.setDisputeId(dispute!.id);
                resolveService.setCustomerId(customer.id);
                resolveService.setAccountId(accountId);
                resolveService.setLoggedInUserId(testUserId);
                await resolveService.resolveDispute("Resolved", "Accepted", "Resolved");

                const openPeriod = await prisma.customerCollectionPeriod.findFirst({
                    where: {
                        customer_id: customer.id,
                        period_end_date: null,
                    },
                    select: { id: true },
                });
                expect(openPeriod).toBeNull();

                const closedPeriod = await prisma.customerCollectionPeriod.findFirst({
                    where: { id: dispute!.customer_collection_period_id! },
                    select: { period_end_date: true },
                });
                expect(closedPeriod).not.toBeNull();
                expect(closedPeriod!.period_end_date).not.toBeNull();

                await cleanupDisputeTestData(prisma, {
                    customer,
                    invoice,
                    contactId,
                    overdueSequenceId,
                    sequenceContainerId,
                    templateId,
                });
            });
        });

        describe("Boundaries", () => {
            it("createDispute throws when no collection period and no due invoices", async () => {
                const accountId = await getOrCreateDisputeAccount(prisma);
                const customer = await createDisputeCustomer(prisma, accountId, {});
                await prisma.customerCollectionPeriod.deleteMany({
                    where: { customer_id: customer.id },
                });
                await prisma.customer.update({
                    where: { id: customer.id },
                    data: {
                        total_due_amount: 0,
                        customer_due_amount1: 0,
                        customer_due_amount2: 0,
                    },
                });
                const disputeReasonId = await createDisputeReason(prisma, accountId);
                const disputeService = new DisputeService();
                disputeService.setLoggedInUserId(await getOrCreateDisputeTestUser(prisma, accountId));
                await expect(
                    disputeService.createDispute({
                        customerId: customer.id,
                        userName: "e2e-test",
                        reasonId: disputeReasonId,
                        comment: "No invoices",
                    })
                ).rejects.toThrow("No collection period found and no due invoices to dispute");
                await cleanupDisputeTestData(prisma, {
                    customer,
                    contactId: undefined,
                    overdueSequenceId: undefined,
                    sequenceContainerId: undefined,
                    templateId: undefined,
                });
            });

            it("createDispute throws when invoice already in another open dispute", async () => {
                const disputeService = new DisputeService();
                disputeService.setLoggedInUserId(testData.testUserId);
                await disputeService.createDispute({
                    customerId: testData.customer.id,
                    userName: "e2e-test",
                    invoiceIds: [testData.invoice.id],
                    reasonId: testData.disputeReasonId,
                    comment: "First dispute",
                });
                await expect(
                    disputeService.createDispute({
                        customerId: testData.customer.id,
                        userName: "e2e-test",
                        invoiceIds: [testData.invoice.id],
                        reasonId: testData.disputeReasonId,
                        comment: "Second dispute same invoice",
                    })
                ).rejects.toThrow("already associated with another open dispute");
            });
        });

        describe("Logic coverage", () => {
            it("resolve when other open disputes exist – category not reverted", async () => {
                const disputeService = new DisputeService();
                disputeService.setLoggedInUserId(testData.testUserId);
                await disputeService.createDispute({
                    customerId: testData.customer.id,
                    userName: "e2e-test",
                    invoiceIds: [testData.invoice.id],
                    reasonId: testData.disputeReasonId,
                    comment: "First",
                });
                const secondInvoice = await createDisputeInvoice(
                    prisma,
                    testData.customer.id,
                    testData.accountId,
                    { status: INVOICE_STATUS.OVERDUE }
                );
                await disputeService.createDispute({
                    customerId: testData.customer.id,
                    userName: "e2e-test",
                    invoiceIds: [secondInvoice.id],
                    reasonId: testData.disputeReasonId,
                    comment: "Second",
                });
                const disputes = await prisma.customerDispute.findMany({
                    where: { customer_id: testData.customer.id },
                    orderBy: { id: "asc" },
                });
                expect(disputes.length).toBe(2);
                const first = disputes[0];
                const resolveService = new DisputeService();
                resolveService.setDisputeId(first.id);
                resolveService.setCustomerId(testData.customer.id);
                resolveService.setAccountId(testData.accountId);
                resolveService.setLoggedInUserId(testData.testUserId);
                await resolveService.resolveDispute("Resolved", "Accepted", "Resolved first");

                const period = await prisma.customerCollectionPeriod.findFirst({
                    where: { customer_id: testData.customer.id, period_end_date: null },
                    select: { current_category: true },
                });
                expect(period?.current_category).toBe("Dispute");
            });

            it("cancel dispute leaves period category as Dispute", async () => {
                const disputeService = new DisputeService();
                disputeService.setLoggedInUserId(testData.testUserId);
                await disputeService.createDispute({
                    customerId: testData.customer.id,
                    userName: "e2e-test",
                    invoiceIds: [testData.invoice.id],
                    reasonId: testData.disputeReasonId,
                    comment: "E2E",
                });
                const dispute = await prisma.customerDispute.findFirst({
                    where: { customer_id: testData.customer.id },
                    orderBy: { id: "desc" },
                });
                expect(dispute).not.toBeNull();
                const cancelService = new DisputeService();
                cancelService.setDisputeId(dispute!.id);
                cancelService.setCustomerId(testData.customer.id);
                cancelService.setAccountId(testData.accountId);
                cancelService.setLoggedInUserId(testData.testUserId);
                await cancelService.cancelDispute("Cancelled", "Cancel comment");

                const period = await prisma.customerCollectionPeriod.findFirst({
                    where: { customer_id: testData.customer.id, period_end_date: null },
                    select: { current_category: true },
                });
                expect(period?.current_category).toBe("Dispute");
            });
        });

        describe("Multiple invoices for one dispute", () => {
            it("create dispute with two invoices creates two DisputeInvoice rows", async () => {
                const secondInvoice = await createDisputeInvoice(
                    prisma,
                    testData.customer.id,
                    testData.accountId,
                    { status: INVOICE_STATUS.OVERDUE }
                );
                const disputeService = new DisputeService();
                disputeService.setLoggedInUserId(testData.testUserId);
                await disputeService.createDispute({
                    customerId: testData.customer.id,
                    userName: "e2e-test",
                    invoiceIds: [testData.invoice.id, secondInvoice.id],
                    reasonId: testData.disputeReasonId,
                    comment: "Multi-invoice dispute",
                });
                const dispute = await prisma.customerDispute.findFirst({
                    where: { customer_id: testData.customer.id },
                    orderBy: { id: "desc" },
                    include: { DisputeInvoice: true },
                });
                expect(dispute).not.toBeNull();
                expect(dispute!.DisputeInvoice.length).toBe(2);
            });
        });

        describe("Portal-created disputes", () => {
            it("create dispute with isPortal true sets created_by to portal user and activity title filed_portal_title", async () => {
                await ensurePortalUserForAccount(prisma, testData.accountId);
                const disputeService = new DisputeService();
                await disputeService.createDispute({
                    customerId: testData.customer.id,
                    userName: "Portal User",
                    userId: "portal_user",
                    invoiceIds: [testData.invoice.id],
                    reasonId: testData.disputeReasonId,
                    comment: "Portal dispute",
                    isPortal: true,
                });
                const dispute = await prisma.customerDispute.findFirst({
                    where: { customer_id: testData.customer.id },
                    orderBy: { id: "desc" },
                    select: { id: true, created_by: true },
                });
                expect(dispute).not.toBeNull();
                expect(dispute!.created_by).toBe(getPortalUserId(testData.accountId));

                const activity = await prisma.activity.findFirst({
                    where: {
                        customer_id: testData.customer.id,
                        type: "Dispute",
                    },
                    orderBy: { id: "desc" },
                    select: { title: true },
                });
                expect(activity?.title).toContain("filed_portal_title");
            });
        });
    }
);
