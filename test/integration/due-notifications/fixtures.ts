/**
 * Fixtures for due-notification integration e2e tests.
 * Uses prisma from vitest.integration.setup so the same DB is used by processDueNotifications (lib/prisma).
 */

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { getSystemUserId } from "../../server/services/UserService";

const INVOICE_STATUS_DUE = "Due";
const INVOICE_STATUS_PAID = "Paid";
const INVOICE_STATUS_OVERDUE = "Overdue";

export const INVOICE_STATUS = {
    DUE: INVOICE_STATUS_DUE,
    PAID: INVOICE_STATUS_PAID,
    OVERDUE: INVOICE_STATUS_OVERDUE,
};
export async function hasDueNotificationStateColumn(prisma: PrismaClient): Promise<boolean> {
    try {
        await prisma.$queryRawUnsafe(
            "SELECT due_notification_state FROM \"Invoice\" LIMIT 1"
        );
        return true;
    } catch {
        return false;
    }
}

export async function ensureInvoiceStatuses(prisma: PrismaClient): Promise<void> {
    // Deprecated
}

export interface DueNotificationTestAccount {
    id: number;
}

export interface DueNotificationTestCustomer {
    id: number;
    customer_uuid: string;
    account_id: number;
    company_id: number;
}

export interface DueNotificationTestInvoice {
    id: number;
    invoice_number: string;
    customer_id: number;
    due_date: Date;
}

export interface DueNotificationTestData {
    accountId: number;
    customer: DueNotificationTestCustomer;
    sequenceContainerId: number;
    dueSequenceId: number;
    templateId: number;
    invoice: DueNotificationTestInvoice;
    contactId: number;
}

const E2E_ACCOUNT_NAME = "E2E Due Notification Test Account";

/**
 * Ensure the system user exists for an account (required for Activity.created_by when processDueNotifications runs).
 */
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
            email: `system-${accountId}@audit.local`,
            username: `system_e2e_due_notif_${accountId}`,
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

/**
 * Get or create test account for due-notification e2e.
 * Also ensures the system user exists so processDueNotifications can create activities (Activity.created_by FK).
 */
export async function getOrCreateDueNotificationAccount(
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
                company_number: `E2E-DUE-${Date.now()}`,
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
 * Create a customer with Company, Contact (for due notifications), and collection period.
 */
export async function createDueNotificationCustomer(
    prisma: PrismaClient,
    accountId: number,
    options: { sequence_container_id?: number | null; country_id?: number | null; previous_category?: string; } = {}
): Promise<DueNotificationTestCustomer> {
    await ensureInvoiceStatuses(prisma);
    const now = new Date();
    const company = await prisma.company.create({
        data: {
            name: `E2E Due Notif Company ${Date.now()}`,
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
 * Create a Contact linked to the customer's company and customer_id (so due notification job finds it).
 */
export async function createDueNotificationContact(
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
            last_name: "Contact",
            email: options.email ?? `e2e-${Date.now()}@test.example`,
            status: "Active",
            receives_standard_reminder: true,
            receives_escalated_reminder: false,
        },
        select: { id: true },
    });
    return contact.id;
}

/**
 * Create sequence container, template, and a due step (step_type 'due', days_before_due).
 */
export async function createDueSequenceAndTemplate(
    prisma: PrismaClient,
    accountId: number,
    options: {
        days_before_due?: number;
        time_of_day?: string;
        sequence_container_id?: number | null;
    } = {}
): Promise<{ sequenceContainerId: number; dueSequenceId: number; templateId: number }> {
    const container = await prisma.sequenceContainer.create({
        data: {
            account_id: accountId,
            name: `E2E Due Container ${Date.now()}`,
            category: "Automated",
            is_default: false,
            active: true,
        },
        select: { id: true },
    });
    const template = await prisma.activitiesTemplate.create({
        data: {
            account_id: accountId,
            name: `E2E Due Template ${Date.now()}`,
            category: "Automated",
            active: true,
            ActivityTemplateLanguage: {
                create: {
                    language: "en",
                    email_subject: "Due reminder",
                    email_content: "Test content",
                    sms_content: "Test SMS"
                }
            }
        },
        select: { id: true },
    });
    const dueStep = await prisma.activitiesSequence.create({
        data: {
            account_id: accountId,
            sequence_container_id: container.id,
            category: "Automated",
            active: true,
            step_type: "due",
            step: null,
            days_before_due: options.days_before_due ?? 7,
            time_of_day: options.time_of_day ?? "09:00",
            activity_type: "Email",
            activity_template_id: template.id,
            last_category_step: false,
            days_from_prev_step: null,
            send_to_standard_contacts: true,
            send_to_escalated_contacts: false,
        },
        select: { id: true },
    });
    return {
        sequenceContainerId: container.id,
        dueSequenceId: dueStep.id,
        templateId: template.id,
    };
}

/**
 * Create an invoice with due_date and optional due_notification_state.
 */
export async function createDueNotificationInvoice(
    prisma: PrismaClient,
    customerId: number,
    accountId: number,
    options: {
        due_date?: Date;
        status?: any;
        due_notification_state?: object | null;
    } = {}
): Promise<DueNotificationTestInvoice> {
    const now = new Date();
    const dueDate = options.due_date ?? (() => {
        const d = new Date(now);
        d.setDate(d.getDate() + 7);
        return d;
    })();
    const inv = await prisma.invoice.create({
        data: {
            customer_id: customerId,
            account_id: accountId,
            invoice_number: `E2E-INV-${Date.now()}`,
            invoice_date: now,
            due_date: dueDate,
            amount: 1000,
            outstanding_debt: 1000,
            customer_outstanding_debt: 1000,
            status: options.status ?? INVOICE_STATUS_DUE,
            modified_at: now,
            due_notification_state: options.due_notification_state ?? undefined,
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
 * Create full test data: account, customer with contact, sequence container, due step, template, invoice.
 */
export async function createDueNotificationTestData(
    prisma: PrismaClient,
    options: {
        due_date_offset_days?: number;
        days_before_due?: number;
        time_of_day?: string;
        invoice_status?: any;
        due_notification_state?: object | null;
        /** When true, set due_date using UTC so notification_send_date (due_date - days_before_due) is today UTC. Use for "nearest only" tests. */
        useUtcForDueDate?: boolean;
    } = {}
): Promise<DueNotificationTestData> {
    const accountId = await getOrCreateDueNotificationAccount(prisma);
    const { sequenceContainerId, dueSequenceId, templateId } =
        await createDueSequenceAndTemplate(prisma, accountId, {
            days_before_due: options.days_before_due ?? 7,
            time_of_day: options.time_of_day,
        });
    const customer = await createDueNotificationCustomer(prisma, accountId, {
        sequence_container_id: sequenceContainerId,
    });
    const contactId = await createDueNotificationContact(
        prisma,
        customer.company_id,
        customer.id
    );
    // Use due_date_offset_days so notificationSendDate (= due_date - days_before_due) is in the future (avoids timezone edge cases).
    // When useUtcForDueDate, due_date is UTC midnight + offset so service's "today" (UTC) filter matches.
    const dueDate = (() => {
        const d = new Date();
        const offset = options.due_date_offset_days ?? 8;
        if (options.useUtcForDueDate) {
            d.setUTCHours(0, 0, 0, 0);
            d.setUTCDate(d.getUTCDate() + offset);
        } else {
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() + offset);
        }
        return d;
    })();
    const invoice = await createDueNotificationInvoice(prisma, customer.id, accountId, {
        due_date: dueDate,
        status: options.invoice_status ?? INVOICE_STATUS_DUE,
        due_notification_state: options.due_notification_state ?? undefined,
    });
    return {
        accountId,
        customer,
        sequenceContainerId,
        dueSequenceId,
        templateId,
        invoice,
        contactId,
    };
}

/**
 * Get or create a test User for the account (for dispute e2e - Activity.created_by FK).
 */
export async function getOrCreateDueNotificationTestUser(
    prisma: PrismaClient,
    accountId: number
): Promise<string> {
    const existing = await prisma.user.findFirst({
        where: { account_id: accountId },
        select: { id: true },
    });
    if (existing) return existing.id;
    const id = `e2e-due-notif-user-${accountId}-${Date.now()}`;
    const now = new Date();
    await prisma.user.create({
        data: {
            id,
            email: `e2e-due-${accountId}@test.example`,
            username: `e2e_due_${accountId}_${Date.now()}`,
            modified_at: now,
            account_id: accountId,
            status: "Active",
        },
    });
    return id;
}

/**
 * Create a dispute reason for the account (for dispute e2e).
 */
export async function createDueNotificationDisputeReason(
    prisma: PrismaClient,
    accountId: number,
    name: string = "E2E Due Notif Dispute Reason"
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

/**
 * Clean up test data by account/customer/invoice/activity (for due-notification e2e).
 */
export async function cleanupDueNotificationTestData(
    prisma: PrismaClient,
    data: {
        accountId: number;
        customer: DueNotificationTestCustomer;
        invoice?: DueNotificationTestInvoice;
        dueSequenceId?: number;
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
    if (data.dueSequenceId) {
        await prisma.activitiesSequence.deleteMany({
            where: { id: data.dueSequenceId },
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
