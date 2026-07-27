import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

/**
 * Ensure required InvoiceStatus records exist (needed for CI database)
 * This creates the status records if they don't exist
 */
// No longer needed as InvoiceStatus table is replaced by enum

/**
 * Test data factory for portal E2E tests
 */

export interface TestCustomer {
    id: number;
    customer_uuid: string;
    account_id: number;
    name: string;
}

export interface TestInvoice {
    id: number;
    invoice_number: string;
    customer_id: number;
    amount: number;
    outstanding_debt: number;
}

export interface TestDisputeReason {
    id: number;
    name: string;
    account_id: number;
}

/**
 * Create a test customer with collection period
 */
export async function createTestCustomer(
    accountId: number,
    options: {
        name?: string;
        customer_uuid?: string;
        type?: "Person" | "Company";
    } = {}
): Promise<TestCustomer> {
    const customerUUID =
        options.customer_uuid || randomUUID();
    const now = new Date();
    const customerType = options.type || "Company";

    // Create Company or Person first
    let companyId: number | undefined;
    let personId: number | undefined;
    let customerName: string;

    if (customerType === "Company") {
        const company = await prisma.company.create({
            data: {
                name: options.name || `Test Company ${Date.now()}`,
                modified_at: now,
            },
        });
        companyId = company.id;
        customerName = company.name;
    } else {
        const nameParts = (options.name || "Test Person").split(" ");
        const person = await prisma.person.create({
            data: {
                first_name: nameParts[0] || "Test",
                last_name: nameParts.slice(1).join(" ") || "Person",
                modified_at: now,
            },
        });
        personId = person.id;
        customerName = `${person.first_name} ${person.last_name}`;
    }

    // Create customer with the company_id or person_id
    const customer = await prisma.customer.create({
        data: {
            account_id: accountId,
            customer_uuid: customerUUID,
            type: customerType,
            modified_at: now,
            company_id: companyId,
            person_id: personId,
            CustomerCollectionPeriod: {
                create: {
                    period_start_date: new Date(),
                    modified_at: now,
                    total_outstanding_amount: 0,
                    current_category: "Automated",
                },
            },
        },
        select: {
            id: true,
            customer_uuid: true,
            account_id: true,
            type: true,
        },
    });

    return {
        id: customer.id,
        customer_uuid: customer.customer_uuid || customerUUID,
        account_id: customer.account_id,
        name: customerName,
    };
}

/**
 * Create test invoices for a customer
 */
export async function createTestInvoices(
    customerId: number,
    accountId: number,
    count: number = 2,
    options: {
        amount?: number;
        outstanding_debt?: number;
        status?: string;
    } = {}
): Promise<TestInvoice[]> {
    // InvoiceStatus records are no longer used

    const invoices: TestInvoice[] = [];

    for (let i = 0; i < count; i++) {
        const now = new Date();
        const invoice = await prisma.invoice.create({
            data: {
                customer_id: customerId,
                account_id: accountId,
                invoice_number: `TEST-INV-${Date.now()}-${i}`,
                invoice_date: now,
                amount: options.amount || 1000 + i * 100,
                outstanding_debt: options.outstanding_debt || 1000 + i * 100,
                customer_outstanding_debt:
                    options.outstanding_debt || 1000 + i * 100,
                due_date: now,
                modified_at: now,
                status: (options.status as any) || "Due", // Default to Due
            },
            select: {
                id: true,
                invoice_number: true,
                customer_id: true,
                amount: true,
                outstanding_debt: true,
            },
        });

        invoices.push({
            id: invoice.id,
            invoice_number: invoice.invoice_number || "",
            customer_id: invoice.customer_id || customerId,
            amount: invoice.amount || 0,
            outstanding_debt: invoice.outstanding_debt || 0,
        });
    }

    return invoices;
}

/**
 * Create test dispute reason
 */
export async function createTestDisputeReason(
    accountId: number,
    name: string = "Test Dispute Reason"
): Promise<TestDisputeReason> {
    const reason = await prisma.disputeReason.create({
        data: {
            account_id: accountId,
            name,
            status: "Active",
            editable: true,
        },
        select: {
            id: true,
            name: true,
            account_id: true,
        },
    });

    return {
        id: reason.id,
        name: reason.name,
        account_id: reason.account_id || accountId,
    };
}

/**
 * Clean up test data
 */
export async function cleanupTestData(
    customerId: number
): Promise<void> {
    // Get customer to find company_id and person_id
    const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { company_id: true, person_id: true },
    });

    // Delete disputes
    await prisma.customerDispute.deleteMany({
        where: { customer_id: customerId },
    });

    // Delete invoices
    await prisma.invoice.deleteMany({
        where: { customer_id: customerId },
    });

    // Delete collection periods
    await prisma.customerCollectionPeriod.deleteMany({
        where: { customer_id: customerId },
    });

    // Delete customer
    await prisma.customer.delete({
        where: { id: customerId },
    });

    // Delete associated Company or Person
    if (customer?.company_id) {
        await prisma.company.delete({
            where: { id: customer.company_id },
        }).catch(() => {
            // Ignore if already deleted
        });
    }

    if (customer?.person_id) {
        await prisma.person.delete({
            where: { id: customer.person_id },
        }).catch(() => {
            // Ignore if already deleted
        });
    }
}

/**
 * Get or create test account
 */
export async function getOrCreateTestAccount(
    accountName: string = "E2E Test Account"
): Promise<number> {
    let account = await prisma.account.findFirst({
        where: { name: accountName },
        select: { id: true },
    });

    if (!account) {
        const newAccount = await prisma.account.create({
            data: {
                name: accountName,
                company_number: `E2E-TEST-${Date.now()}`,
                status: "Active",
                promise_to_pay: 14,
            },
            select: { id: true },
        });
        account = newAccount;
    }

    return account.id;
}
