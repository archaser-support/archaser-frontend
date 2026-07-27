/**
 * Fixtures for overdue-notification integration e2e tests.
 * Overdue flow: handleOverdueInvoices -> processAutomatedCollectionPeriods -> activityWorkflowManager.
 * Fixture contact: email ofir.amitai@gmail.com, mobile 972542278407.
 */

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { getSystemUserId } from "../../server/services/UserService";

const INVOICE_STATUS_DUE = "Due";
const INVOICE_STATUS_PAID = "Paid";
const INVOICE_STATUS_OVERDUE = "Overdue";

const OVERDUE_CONTACT_EMAIL = "ofir.amitai@gmail.com";
const OVERDUE_CONTACT_MOBILE = "972542278407";

// InvoiceStatus table is replaced by enum

export interface OverdueNotificationTestAccount {
    id: number;
}

export interface OverdueNotificationTestCustomer {
    id: number;
    customer_uuid: string;
    account_id: number;
    company_id: number;
}

export interface OverdueNotificationTestInvoice {
    id: number;
    invoice_number: string;
    customer_id: number;
    due_date: Date;
}

export interface OverdueNotificationTestData {
    accountId: number;
    customer: OverdueNotificationTestCustomer;
    sequenceContainerId: number;
    overdueSequenceId: number;
    templateId: number;
    invoice: OverdueNotificationTestInvoice;
    contactId: number;
}

const E2E_ACCOUNT_NAME = "E2E Overdue Notification Test Account";

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
            email: `system-overdue-${accountId}@audit.local`,
            username: `system_e2e_overdue_${accountId}`,
            modified_at: now,
            account_id: accountId,
            status: "Active",
            first_name: "System",
            last_name: "User",
            name: "System User",
            is_audit_user: true,
            sidebar_collapsed: false,
        },
        update: {
            account_id: accountId,
            status: "Active",
            is_audit_user: true,
            sidebar_collapsed: false,
        },
    });
}

export async function getOrCreateOverdueNotificationAccount(
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
                company_number: `E2E-OVERDUE-${Date.now()}`,
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
 * Create a customer (Company) for overdue tests. Default collection_status Inactive.
 * Optionally pass sequence_container_id, country_id, language for template/timezone tests.
 */
export async function createOverdueNotificationCustomer(
    prisma: PrismaClient,
    accountId: number,
    options: {
        sequence_container_id?: number | null;
        country_id?: number | null;
        collection_status?: "Active" | "Inactive";
        previous_category?: string;
    } = {}
): Promise<OverdueNotificationTestCustomer> {
    // InvoiceStatus records are no longer used
    const now = new Date();
    const company = await prisma.company.create({
        data: {
            name: `E2E Overdue Notif Company ${Date.now()}`,
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
            collection_status: options.collection_status ?? "Inactive",
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

/**
 * Create contact for overdue notifications. Default: email ofir.amitai@gmail.com, mobile 972542278407.
 */
export async function createOverdueNotificationContact(
    prisma: PrismaClient,
    companyId: number,
    customerId: number,
    options: { email?: string; mobile?: string } = {}
): Promise<number> {
    const contact = await prisma.contact.create({
        data: {
            company_id: companyId,
            customer_id: customerId,
            first_name: "E2E",
            last_name: "Overdue Contact",
            email: options.email ?? OVERDUE_CONTACT_EMAIL,
            mobile: options.mobile ?? OVERDUE_CONTACT_MOBILE,
            status: "Active",
            receives_standard_reminder: true,
            receives_escalated_reminder: true,
        },
        select: { id: true },
    });
    return contact.id;
}

/**
 * Create overdue sequence step (step_type "overdue") and template.
 */
export async function createOverdueSequenceAndTemplate(
    prisma: PrismaClient,
    accountId: number,
    options: {
        step?: number;
        last_category_step?: boolean;
        time_of_day?: string;
        sequence_container_id?: number | null;
    } = {}
): Promise<{ sequenceContainerId: number; overdueSequenceId: number; templateId: number }> {
    const container = await prisma.sequenceContainer.create({
        data: {
            account_id: accountId,
            name: `E2E Overdue Container ${Date.now()}`,
            category: "Automated",
            is_default: false,
            active: true,
        },
        select: { id: true },
    });
    const template = await prisma.activitiesTemplate.create({
        data: {
            account_id: accountId,
            name: `E2E Overdue Template ${Date.now()}`,
            category: "Automated",
            active: true,
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

/**
 * Create an invoice. For overdue flow use due_date in the past, status_id 13 (DUE), outstanding_debt > 0.
 * For credit-invoice test use amount < 0 and appropriate customer_outstanding_debt.
 */
export async function createOverdueNotificationInvoice(
    prisma: PrismaClient,
    customerId: number,
    accountId: number,
    options: {
        due_date?: Date;
        status?: string;
        amount?: number;
        outstanding_debt?: number;
        customer_outstanding_debt?: number;
    } = {}
): Promise<OverdueNotificationTestInvoice> {
    const now = new Date();
    const pastDueDate = options.due_date ?? (() => {
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
            invoice_number: `E2E-OVERDUE-INV-${Date.now()}`,
            invoice_date: now,
            due_date: pastDueDate,
            amount,
            outstanding_debt: outstanding,
            customer_outstanding_debt: customerOutstanding,
            status: (options.status as any) || "DUE",
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

/**
 * Create full test data: account, customer (Inactive), contact (fixture email/mobile),
 * overdue sequence step, template, and past-due DUE invoice.
 */
export async function createOverdueNotificationTestData(
    prisma: PrismaClient,
    options: {
        due_date?: Date;
        invoice_status?: string;
        amount?: number;
        outstanding_debt?: number;
        customer_outstanding_debt?: number;
        collection_status?: "Active" | "Inactive";
    } = {}
): Promise<OverdueNotificationTestData> {
    const accountId = await getOrCreateOverdueNotificationAccount(prisma);
    const { sequenceContainerId, overdueSequenceId, templateId } =
        await createOverdueSequenceAndTemplate(prisma, accountId);
    const customer = await createOverdueNotificationCustomer(prisma, accountId, {
        sequence_container_id: sequenceContainerId,
        collection_status: options.collection_status ?? "Inactive",
    });
    const contactId = await createOverdueNotificationContact(
        prisma,
        customer.company_id,
        customer.id
    );
    const invoice = await createOverdueNotificationInvoice(prisma, customer.id, accountId, {
        due_date: options.due_date,
        status: (options.invoice_status as any) || "DUE",
        amount: options.amount,
        outstanding_debt: options.outstanding_debt,
        customer_outstanding_debt: options.customer_outstanding_debt,
    });
    return {
        accountId,
        customer,
        sequenceContainerId,
        overdueSequenceId,
        templateId,
        invoice,
        contactId,
    };
}

/**
 * Clean up overdue-notification test data.
 */
export async function cleanupOverdueNotificationTestData(
    prisma: PrismaClient,
    data: {
        accountId: number;
        customer: OverdueNotificationTestCustomer;
        invoice?: OverdueNotificationTestInvoice;
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
    await prisma.invoice.deleteMany({
        where: { customer_id: customerId },
    });
    await prisma.contact.deleteMany({
        where: { customer_id: customerId },
    });
    if (data.overdueSequenceId) {
        await prisma.activitiesSequence.deleteMany({
            where: { id: data.overdueSequenceId },
        }).catch(() => {});
    }
    if (data.sequenceContainerId) {
        await prisma.sequenceContainer.deleteMany({
            where: { id: data.sequenceContainerId },
        }).catch(() => {});
    }
    if (data.templateId) {
        await prisma.activitiesTemplate.deleteMany({
            where: { id: data.templateId },
        }).catch(() => {});
    }
    await prisma.customerCollectionPeriod.deleteMany({
        where: { customer_id: customerId },
    });
    await prisma.customer.delete({
        where: { id: customerId },
    }).catch(() => {});
    await prisma.company.delete({
        where: { id: data.customer.company_id },
    }).catch(() => {});
}

export { INVOICE_STATUS_DUE, INVOICE_STATUS_PAID, INVOICE_STATUS_OVERDUE, OVERDUE_CONTACT_EMAIL, OVERDUE_CONTACT_MOBILE };
