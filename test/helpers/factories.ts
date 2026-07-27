/**
 * Test Data Factories
 * 
 * Helper functions for creating test data with sensible defaults
 */

import { created_ate } from "@/test/fixtures/common/dates";
import { createMockUser } from "@/test/fixtures/common/users";
import { createMockActivity } from "@/test/fixtures/services/activity";
import { createMockCustomer } from "@/test/fixtures/services/customer";
import { createMockDispute } from "@/test/fixtures/services/dispute";
import { createMockInvoice } from "@/test/fixtures/services/invoice";

/**
 * Factory for creating test activities
 */
export const activityFactory = {
    create: createMockActivity,
    createMany: (count: number, overrides = {}) =>
        Array.from({ length: count }, (_, i) =>
            createMockActivity({ id: BigInt(i + 1), ...overrides })
        ),
};

/**
 * Factory for creating test invoices
 */
export const invoiceFactory = {
    create: createMockInvoice,
    createMany: (count: number, overrides = {}) =>
        Array.from({ length: count }, (_, i) =>
            createMockInvoice({ id: BigInt(i + 1), invoice_number: `INV-${i + 1}`, ...overrides })
        ),
};

/**
 * Factory for creating test customers
 */
export const customerFactory = {
    create: createMockCustomer,
    createMany: (count: number, overrides = {}) =>
        Array.from({ length: count }, (_, i) =>
            createMockCustomer({ id: i + 1, name: `Customer ${i + 1}`, ...overrides })
        ),
};

/**
 * Factory for creating test disputes
 */
export const disputeFactory = {
    create: createMockDispute,
    createMany: (count: number, overrides = {}) =>
        Array.from({ length: count }, (_, i) =>
            createMockDispute({ id: i + 1, ...overrides })
        ),
};

/**
 * Factory for creating test users
 */
export const userFactory = {
    create: createMockUser,
    createMany: (count: number, overrides = {}) =>
        Array.from({ length: count }, (_, i) =>
            createMockUser({ id: `user${i + 1}`, email: `user${i + 1}@test.com`, ...overrides })
        ),
};

/**
 * Factory for creating test dates
 */
export const dateFactory = {
    create: created_ate,
    today: () => created_ate(0),
    yesterday: () => created_ate(-1),
    tomorrow: () => created_ate(1),
    daysAgo: (days: number) => created_ate(-days),
    daysFromNow: (days: number) => created_ate(days),
};

