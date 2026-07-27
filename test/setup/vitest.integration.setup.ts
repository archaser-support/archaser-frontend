import "dotenv/config";

import { PrismaClient } from "@prisma/client";

const DEFAULT_TEST_DB =
    "postgresql://postgres:password@localhost:5432/archaser_test";

if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = DEFAULT_TEST_DB;
}

// Create a separate Prisma client for integration tests (same DB as app when DATABASE_URL from .env)
export const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL || DEFAULT_TEST_DB,
        },
    },
});

const SAME_DB_MARKER_PREFIX = "E2E_SAME_DB_CHECK_";

/**
 * Asserts that the test Prisma client and the app Prisma client (from @/lib/prisma) use the same database.
 * Call this in beforeAll of suites that rely on both (e.g. due-notification e2e).
 * Throws if they see different data.
 */
export async function assertTestAndAppUseSameDatabase(): Promise<void> {
    const markerName = `${SAME_DB_MARKER_PREFIX}${Date.now()}`;
    const created = await prisma.account.create({
        data: {
            name: markerName,
            company_number: markerName,
            status: "Active",
            promise_to_pay: 0,
        },
        select: { id: true, name: true },
    });
    try {
        const { prisma: appPrisma } = await import("@/lib/prisma");
        const found = await appPrisma.account.findUnique({
            where: { id: created.id },
            select: { id: true },
        });
        if (!found) {
            throw new Error(
                "Same-DB check failed: test Prisma and app Prisma use different databases. " +
                    "Ensure DATABASE_URL is set (e.g. from .env) and the same in both."
            );
        }
    } finally {
        await prisma.account.delete({ where: { id: created.id } }).catch(() => {});
    }
}

// Setup function to run before all integration tests
export async function setupIntegrationTests() {
    await prisma.$connect();

    // Clean up any existing test data
    await prisma.activitiesSequence.deleteMany({
        where: { master_template: true },
    });
    await prisma.activitiesTemplate.deleteMany({
        where: { master_template: true },
    });
    await prisma.disputeReason.deleteMany({
        where: { master_template: true },
    });
    await prisma.customer.deleteMany({
        where: {
            name: {
                contains: "Test Customer",
            },
        },
    });
}

// Cleanup function to run after all integration tests
export async function cleanupIntegrationTests() {
    // Clean up test data
    await prisma.activitiesSequence.deleteMany({
        where: { master_template: true },
    });
    await prisma.activitiesTemplate.deleteMany({
        where: { master_template: true },
    });
    await prisma.disputeReason.deleteMany({
        where: { master_template: true },
    });
    await prisma.customer.deleteMany({
        where: {
            name: {
                contains: "Test Customer",
            },
        },
    });

    await prisma.$disconnect();
}

// Helper function to create test master data
export async function createTestMasterData() {
    // Create a dummy customer for master templates
    const dummyCustomer = await prisma.customer.create({
        data: {
            name: "Dummy Customer for Master Templates",
            company_number: "DUMMY-MASTER-001",
            status: "Active",
            promise_to_pay: 14,
            client_type: "Company",
            default_first_activity_delay_days: 7,
            currency: "USD",
            email_from: "dummy@example.com",
            email_from_name: "Dummy Customer",
        },
    });

    // Create master templates for testing
    const masterTemplates = await Promise.all([
        prisma.activitiesTemplate.create({
            data: {
                name: "Master Email Template 1",
                category: "Automated",
                active: true,
                master_template: true,
                email_subject: "Test Subject 1",
                email_content: "Test Content 1",
                sms_content: "Test SMS 1",
                whatsapp_content: "Test WhatsApp 1",
                account_id: dummyAccount.id,
            },
        }),
        prisma.activitiesTemplate.create({
            data: {
                name: "Master Email Template 2",
                category: "Automated",
                active: true,
                master_template: true,
                email_subject: "Test Subject 2",
                email_content: "Test Content 2",
                sms_content: "Test SMS 2",
                whatsapp_content: "Test WhatsApp 2",
                account_id: dummyAccount.id,
            },
        }),
        prisma.activitiesTemplate.create({
            data: {
                name: "Master SMS Template",
                category: "Automated",
                active: true,
                master_template: true,
                email_subject: "SMS Subject",
                email_content: "SMS Content",
                sms_content: "SMS Content",
                whatsapp_content: "SMS WhatsApp",
                account_id: dummyAccount.id,
            },
        }),
    ]);

    const masterTemplateIds = masterTemplates.map((t) => t.id);

    // Create master activity sequences
    const masterSequences = await Promise.all([
        prisma.activitiesSequence.create({
            data: {
                step: 1,
                active: true,
                activity_type: "Email",
                category: "Automated",
                days_from_prev_step: 0,
                days_after_start: 7,
                activity_template_id: masterTemplateIds[0],
                master_template: true,
                last_category_step: false,
                time_of_day: "09:00",
                account_id: dummyAccount.id,
            },
        }),
        prisma.activitiesSequence.create({
            data: {
                step: 2,
                active: true,
                activity_type: "Email",
                category: "Automated",
                days_from_prev_step: 3,
                days_after_start: 10,
                activity_template_id: masterTemplateIds[1],
                master_template: true,
                last_category_step: false,
                time_of_day: "09:00",
                account_id: dummyAccount.id,
            },
        }),
        prisma.activitiesSequence.create({
            data: {
                step: 3,
                active: true,
                activity_type: "SMS",
                category: "Automated",
                days_from_prev_step: 2,
                days_after_start: 12,
                activity_template_id: masterTemplateIds[2],
                master_template: true,
                last_category_step: true,
                time_of_day: "10:00",
                account_id: dummyAccount.id,
            },
        }),
    ]);

    const masterSequenceIds = masterSequences.map((s) => s.id);

    // Create master dispute reasons
    const masterDisputeReasons = await Promise.all([
        prisma.disputeReason.create({
            data: {
                name: "Test Dispute Reason 1",
                status: "Active",
                master_template: true,
                editable: true,
                account_id: dummyAccount.id,
            },
        }),
        prisma.disputeReason.create({
            data: {
                name: "Test Dispute Reason 2",
                status: "Active",
                master_template: true,
                editable: false,
                account_id: dummyAccount.id,
            },
        }),
    ]);

    const masterDisputeReasonIds = masterDisputeReasons.map((r) => r.id);

    return {
        dummyCustomer,
        masterTemplateIds,
        masterSequenceIds,
        masterDisputeReasonIds,
    };
}

// Helper function to cleanup test customer data
export async function cleanupTestCustomer(accountId: number) {
    if (accountId) {
        await prisma.activitiesSequence.deleteMany({
            where: { account_id: accountId },
        });
        await prisma.activitiesTemplate.deleteMany({
            where: { account_id: accountId },
        });
        await prisma.disputeReason.deleteMany({
            where: { account_id: accountId },
        });
        await prisma.customer.delete({
            where: { id: accountId },
        });
    }
}
