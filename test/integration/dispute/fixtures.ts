/**
 * Fixtures for dispute process integration e2e tests.
 * Dispute flow: DisputeService create/resolve/cancel, collection period, activityWorkflowManager.
 */

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import {
    getSystemUserId,
    getPortalUserId,
} from "../../server/services/UserService";

const INVOICE_STATUS_DUE = "Due";
const INVOICE_STATUS_PAID = "Paid";
const INVOICE_STATUS_OVERDUE = "Overdue";

export const INVOICE_STATUS = {
    DUE: INVOICE_STATUS_DUE,
    PAID: INVOICE_STATUS_PAID,
    OVERDUE: INVOICE_STATUS_OVERDUE,
};

export async function ensureInvoiceStatuses(
    _prisma: PrismaClient
): Promise<void> {
    // Deprecated: InvoiceStatus is now an enum
}

export interface DisputeTestCustomer {
    id: number;
    customer_uuid: string;
    account_id: number;
    company_id: number;
}

export interface DisputeTestInvoice {
    id: number;
    invoice_number: string;
    customer_id: number;
    due_date: Date;
}

export interface DisputeTestData {
    accountId: number;
    customer: DisputeTestCustomer;
    periodId: number;
    contactId: number;
    sequenceContainerId: number;
    overdueSequenceId: number;
    templateId: number;
    invoice: DisputeTestInvoice;
    disputeReasonId: number;
    testUserId: string;
}

const E2E_ACCOUNT_NAME = "E2E Dispute Process Test Account";

export async function ensureSystemUserForAccount(
    prisma: PrismaClient,
    accountId: number
): Promise<void> {
    const systemUserId = getSystemUserId(accountId);
    const now = new Date();
    await prisma.user.upsert({
        where: { id: systemUserId },
        create: {
            id: systemUserId,
            email: `system-dispute-${accountId}@audit.local`,
            username: `system_e2e_dispute_${accountId}`,
            modified_at: now,
            account_id: accountId,
            status: "Active",
            first_name: "System",
            last_name: "User",
            name: "System User",
            is_audit_user: true,
        },
        update: {
            account_id: accountId,
            status: "Active",
            is_audit_user: true,
        },
    });
}

export async function ensurePortalUserForAccount(
    prisma: PrismaClient,
    accountId: number
): Promise<void> {
    const portalUserId = getPortalUserId(accountId);
    const now = new Date();
    await prisma.user.upsert({
        where: { id: portalUserId },
        create: {
            id: portalUserId,
            email: `portal-${accountId}@system.local`,
            username: `portal_e2e_${accountId}`,
            modified_at: now,
            account_id: accountId,
            status: "Active",
            first_name: "Portal",
            last_name: "User",
            name: "Portal User",
        },
        update: {
            account_id: accountId,
            status: "Active",
        },
    });
}

export async function getOrCreateDisputeAccount(
    prisma: PrismaClient
): Promise<number> {
    let account = await prisma.account.findFirst({
        where: { name: E2E_ACCOUNT_NAME },
        select: { id: true },
    });
    if (!account) {
        const created = await prisma.account.create({
            data: {
                name: E2E_ACCOUNT_NAME,
                company_number: `E2E-DISPUTE-${Date.now()}`,
                status: "Active",
                promise_to_pay: 14,
            },
            select: { id: true },
        });
        account = created;
    }
    await ensureSystemUserForAccount(prisma, account.id);
    return account.id;
}

/**
 * Create customer with Company and CustomerCollectionPeriod (Automated, optional previous_category).
 */
export async function createDisputeCustomer(
    prisma: PrismaClient,
    accountId: number,
    options: {
        sequence_container_id?: number | null;
        country_id?: number | null;
        collection_status?: "Active" | "Inactive";
        previous_category?: string | null;
    } = {}
): Promise<DisputeTestCustomer> {
    await ensureInvoiceStatuses(prisma);
    const now = new Date();
    const company = await prisma.company.create({
        data: {
            name: `E2E Dispute Company ${Date.now()}`,
            modified_at: now,
        },
    });
    const customer = await prisma.customer.create({
        data: {
            account_id: accountId,
            customer_uuid: randomUUID(),
            type: "Company",
            modified_at: now,
            company_id: company.id,
            sequence_container_id: options.sequence_container_id ?? undefined,
            country_id: options.country_id ?? undefined,
            collection_status: options.collection_status ?? "Active",
            CustomerCollectionPeriod: {
                create: {
                    period_start_date: now,
                    modified_at: now,
                    total_outstanding_amount: 0,
                    current_category: "Automated",
                    previous_category: (options.previous_category as any) ?? undefined,
                },
            },
        },
        select: { id: true, customer_uuid: true, account_id: true, company_id: true },
    });
    return {
        id: customer.id,
        customer_uuid: customer.customer_uuid!,
        account_id: customer.account_id,
        company_id: customer.company_id!,
    };
}

export async function createDisputeContact(
    prisma: PrismaClient,
    companyId: number,
    customerId: number,
    options: { email?: string } = {}
): Promise<number> {
    const contact = await prisma.contact.create({
        data: {
            company_id: companyId,
            customer_id: customerId,
            first_name: "E2E",
            last_name: "Dispute Contact",
            email: options.email ?? `e2e-dispute-${Date.now()}@test.example`,
            status: "Active",
            receives_standard_reminder: true,
            receives_escalated_reminder: false,
        },
        select: { id: true },
    });
    return contact.id;
}

/**
 * Create overdue sequence step and template (category Automated).
 */
export async function createDisputeSequenceAndTemplate(
    prisma: PrismaClient,
    accountId: number,
    options: {
        step?: number;
        last_category_step?: boolean;
        time_of_day?: string;
        sequence_container_id?: number | null;
    } = {}
): Promise<{
    sequenceContainerId: number;
    overdueSequenceId: number;
    templateId: number;
}> {
    const container = await prisma.sequenceContainer.create({
        data: {
            account_id: accountId,
            name: `E2E Dispute Container ${Date.now()}`,
            category: "Automated",
            is_default: false,
            active: true,
        },
        select: { id: true },
    });
    const template = await prisma.activitiesTemplate.create({
        data: {
            account_id: accountId,
            name: `E2E Dispute Template ${Date.now()}`,
            category: "Automated",
            active: true,
            ActivityTemplateLanguage: {
                create: {
                    language: "en",
                    email_subject: "Overdue reminder",
                    email_content: "Test content",
                    sms_content: "Test SMS"
                }
            }
        },
        select: { id: true },
    });
    const overdueStep = await prisma.activitiesSequence.create({
        data: {
            account_id: accountId,
            sequence_container_id: container.id,
            category: "Automated",
            active: true,
            step_type: "overdue",
            step: options.step ?? 1,
            time_of_day: options.time_of_day ?? "09:00",
            activity_type: "Email",
            activity_template_id: template.id,
            last_category_step: options.last_category_step ?? false,
            days_from_prev_step: null,
            send_to_standard_contacts: true,
            send_to_escalated_contacts: false,
        },
        select: { id: true },
    });
    return {
        sequenceContainerId: container.id,
        overdueSequenceId: overdueStep.id,
        templateId: template.id,
    };
}

export async function createDisputeInvoice(
    prisma: PrismaClient,
    customerId: number,
    accountId: number,
    options: {
        due_date?: Date;
        status?: any;
        amount?: number;
        outstanding_debt?: number;
        customer_outstanding_debt?: number;
    } = {}
): Promise<DisputeTestInvoice> {
    const now = new Date();
    const pastDue = options.due_date ?? (() => {
        const d = new Date(now);
        d.setDate(d.getDate() - 1);
        return d;
    })();
    const amount = options.amount ?? 1000;
    const outstanding = options.outstanding_debt ?? amount;
    const customerOutstanding = options.customer_outstanding_debt ?? outstanding;
    const inv = await prisma.invoice.create({
        data: {
            customer_id: customerId,
            account_id: accountId,
            invoice_number: `E2E-DISPUTE-INV-${Date.now()}`,
            invoice_date: now,
            due_date: pastDue,
            amount,
            outstanding_debt: outstanding,
            customer_outstanding_debt: customerOutstanding,
            status: (options.status as any) ?? INVOICE_STATUS_OVERDUE,
            modified_at: now,
        },
        select: { id: true, invoice_number: true, customer_id: true, due_date: true },
    });
    return {
        id: inv.id,
        invoice_number: inv.invoice_number!,
        customer_id: inv.customer_id!,
        due_date: inv.due_date!,
    };
}

export async function createDisputeReason(
    prisma: PrismaClient,
    accountId: number,
    name: string = "E2E Dispute Reason"
): Promise<number> {
    const reason = await prisma.disputeReason.create({
        data: {
            account_id: accountId,
            name,
            status: "Active",
            editable: true,
        },
        select: { id: true },
    });
    return reason.id;
}

export async function getOrCreateDisputeTestUser(
    prisma: PrismaClient,
    accountId: number
): Promise<string> {
    const existing = await prisma.user.findFirst({
        where: { account_id: accountId },
        select: { id: true },
    });
    if (existing) return existing.id;
    const id = `e2e-dispute-user-${accountId}-${Date.now()}`;
    const now = new Date();
    await prisma.user.create({
        data: {
            id,
            email: `e2e-dispute-${accountId}@test.example`,
            username: `e2e_dispute_${accountId}_${Date.now()}`,
            modified_at: now,
            account_id: accountId,
            status: "Active",
        },
    });
    return id;
}

/**
 * Create full test data: account, customer with collection period, contact, sequence/template, invoice, dispute reason, test user.
 * For "multiple invoices" tests, call createDisputeInvoice again for a second invoice.
 */
export async function createDisputeTestData(
    prisma: PrismaClient,
    options: {
        previous_category?: string | null;
        invoice_status?: any;
    } = {}
): Promise<DisputeTestData> {
    const accountId = await getOrCreateDisputeAccount(prisma);
    const { sequenceContainerId, overdueSequenceId, templateId } =
        await createDisputeSequenceAndTemplate(prisma, accountId);
    const customer = await createDisputeCustomer(prisma, accountId, {
        sequence_container_id: sequenceContainerId,
        previous_category: options.previous_category ?? "Automated",
    });
    const period = await prisma.customerCollectionPeriod.findFirst({
        where: { customer_id: customer.id, period_end_date: null },
        select: { id: true },
    });
    if (!period) throw new Error("Collection period not created");
    const contactId = await createDisputeContact(
        prisma,
        customer.company_id,
        customer.id
    );
    const invoice = await createDisputeInvoice(prisma, customer.id, accountId, {
        status: options.invoice_status ?? INVOICE_STATUS_OVERDUE,
    });
    const disputeReasonId = await createDisputeReason(prisma, accountId);
    const testUserId = await getOrCreateDisputeTestUser(prisma, accountId);
    return {
        accountId,
        customer,
        periodId: period.id,
        contactId,
        sequenceContainerId,
        overdueSequenceId,
        templateId,
        invoice,
        disputeReasonId,
        testUserId,
    };
}

/**
 * Clean up dispute test data. Order: activities → DisputeInvoice → CustomerDispute → invoices → contacts → sequences/containers/templates → collection periods → customer → company.
 */
export async function cleanupDisputeTestData(
    prisma: PrismaClient,
    data: {
        customer: DisputeTestCustomer;
        invoice?: DisputeTestInvoice;
        overdueSequenceId?: number;
        sequenceContainerId?: number;
        templateId?: number;
        contactId?: number;
    }
): Promise<void> {
    const customerId = data.customer.id;
    await prisma.activity.deleteMany({
        where: { customer_id: customerId },
    });
    const disputeIds = await prisma.customerDispute.findMany({
        where: { customer_id: customerId },
        select: { id: true },
    });
    if (disputeIds.length > 0) {
        await prisma.disputeInvoice.deleteMany({
            where: { dispute_id: { in: disputeIds.map((d) => d.id) } },
        });
        await prisma.customerDispute.deleteMany({
            where: { customer_id: customerId },
        });
    }
    await prisma.invoice.deleteMany({
        where: { customer_id: customerId },
    });
    if (data.contactId !== undefined) {
        await prisma.contact.deleteMany({
            where: { customer_id: customerId },
        });
    }
    if (data.overdueSequenceId !== undefined) {
        await prisma.activitiesSequence.deleteMany({
            where: { id: data.overdueSequenceId },
        }).catch(() => { });
    }
    if (data.sequenceContainerId !== undefined) {
        await prisma.sequenceContainer.deleteMany({
            where: { id: data.sequenceContainerId },
        }).catch(() => { });
    }
    if (data.templateId !== undefined) {
        await prisma.activitiesTemplate.deleteMany({
            where: { id: data.templateId },
        }).catch(() => { });
    }
    await prisma.customerCollectionPeriod.deleteMany({
        where: { customer_id: customerId },
    });
    await prisma.customer.delete({
        where: { id: customerId },
    }).catch(() => { });
    await prisma.company.delete({
        where: { id: data.customer.company_id },
    }).catch(() => { });
}
