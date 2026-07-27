/**
 * Prisma Mock Factory
 * 
 * Creates a reusable Prisma client mock for unit tests.
 * This factory provides all common Prisma methods for all models.
 * 
 * Usage:
 * ```typescript
 * import { createPrismaMock } from "@/test/mocks/prisma";
 * 
 * vi.mock("@/lib/prisma", () => ({
 *     prisma: createPrismaMock(),
 * }));
 * ```
 */

import { vi } from "vitest";

/**
 * Creates a standard Prisma model mock with all common CRUD operations
 */
function createModelMock() {
    return {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
        updateMany: vi.fn(),
        upsert: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
        aggregate: vi.fn(),
        createMany: vi.fn(),
    };
}

/**
 * Creates a comprehensive Prisma client mock
 * 
 * @returns A mock Prisma client with all models and common methods
 */
export function createPrismaMock() {
    return {
        // Common Prisma methods
        $transaction: vi.fn(),
        $connect: vi.fn(),
        $disconnect: vi.fn(),
        $use: vi.fn(),
        $queryRaw: vi.fn(),
        $executeRaw: vi.fn(),

        // Account and related models
        account: createModelMock(),
        accountBankAccounts: createModelMock(),
        accountSMSProviderPreferences: createModelMock(),
        businessUnit: createModelMock(),
        insurancePolicy: createModelMock(),

        // Customer and related models
        customer: createModelMock(),
        customerBanks: createModelMock(),
        customerBankAccounts: createModelMock(),
        customerCollectionPeriod: createModelMock(),
        customerDispute: createModelMock(),
        customerPolicy: createModelMock(),



        // Invoice and payment models
        invoice: createModelMock(),
        invoicePayment: createModelMock(),
        payment: createModelMock(),

        // Activity models
        activity: createModelMock(),
        activityContact: createModelMock(),
        activityAttachment: createModelMock(),
        activitiesSequence: createModelMock(),
        activitiesTemplate: createModelMock(),
        activityTemplate: createModelMock(),
        activityTemplateLanguage: createModelMock(),
        activitySequence: createModelMock(),

        // Sequence and container models
        sequenceContainer: createModelMock(),

        // Dispute models
        dispute: createModelMock(),
        disputeInvoice: createModelMock(),
        disputeReason: createModelMock(),
        disputeReasonLanguage: createModelMock(),

        // Contact and person models
        contact: createModelMock(),
        person: createModelMock(),
        company: createModelMock(),

        // User and account models
        user: createModelMock(),
        role: createModelMock(),
        rolePermission: createModelMock(),
        securityRole: createModelMock(),

        // Import and job models
        importJob: createModelMock(),
        importRecord: createModelMock(),

        // Notification and log models
        notification: createModelMock(),
        notificationRuleSet: createModelMock(),
        notificationRule: createModelMock(),
        notificationRuleRoleDefault: createModelMock(),
        notificationRuleUserOverride: createModelMock(),
        notificationDeliveryLog: createModelMock(),
        log: createModelMock(),

        // Cron job models
        cronJob: createModelMock(),

        // Location models
        country: createModelMock(),
        state: createModelMock(),

        // SMS and email models
        smsVendor: createModelMock(),
        internalEmailTemplate: createModelMock(),

        // Learning and communication models
        communicationLearningData: createModelMock(),

        // Additional models that may be needed
        customerBankAccount: createModelMock(),

        // Customer aggregated data model
        customerAggregatedData: createModelMock(),
        customerCheckpoint: createModelMock(),
        customerTopUp: createModelMock(),
    };
}

/**
 * Type helper for Prisma mock
 */
export type PrismaMock = ReturnType<typeof createPrismaMock>;

