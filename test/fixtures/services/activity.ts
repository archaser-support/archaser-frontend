/**
 * Activity Service Fixtures
 * 
 * Test data fixtures for activity-related tests
 */

import { delivery_status } from "@prisma/client";

export const mockActivityData = {
    validActivity: {
        id: BigInt(1),
        activity_id: BigInt(123),
        contact_id: 456,
        type: "SMS" as const,
        is_last_step: false,
        status: delivery_status.Sent,
        account_id: 1,
        created_at: new Date("2024-01-01T12:00:00Z"),
        modified_at: new Date("2024-01-01T12:00:00Z"),
    },

    deliveredActivity: {
        id: BigInt(1),
        activity_id: BigInt(123),
        contact_id: 456,
        type: "SMS" as const,
        status: delivery_status.Delivered,
        delivered_at: new Date("2024-01-01T12:00:00Z"),
        account_id: 1,
        created_at: new Date("2024-01-01T12:00:00Z"),
        modified_at: new Date("2024-01-01T12:00:00Z"),
    },

    failedActivity: {
        id: BigInt(1),
        activity_id: BigInt(123),
        contact_id: 456,
        type: "SMS" as const,
        status: delivery_status.Failed,
        failed_at: new Date("2024-01-01T12:00:00Z"),
        failure_reason: "Network error",
        account_id: 1,
        created_at: new Date("2024-01-01T12:00:00Z"),
        modified_at: new Date("2024-01-01T12:00:00Z"),
    },

    emailActivity: {
        id: BigInt(2),
        activity_id: BigInt(124),
        contact_id: 457,
        type: "Email" as const,
        status: delivery_status.Sent,
        account_id: 1,
        created_at: new Date("2024-01-01T12:00:00Z"),
        modified_at: new Date("2024-01-01T12:00:00Z"),
    },
};

/**
 * Creates a mock activity with optional overrides
 */
export const createMockActivity = (overrides = {}) => ({
    ...mockActivityData.validActivity,
    ...overrides,
});

/**
 * Mock activity contact with nested relationships
 */
export const mockActivityContactData = {
    validActivityContact: {
        id: 1,
        activity_id: BigInt(123),
        contact_id: 456,
        Activity: {
            id: BigInt(123),
            type: "SMS" as const,
            is_last_step: false,
            ActivitiesSequence: {
                id: 1,
                category: "Automated" as const,
                step: 1,
            },
            CustomerCollectionPeriod: {
                id: 1,
                current_category: "Automated" as const,
            },
            Customer: {
                company_id: 1,
                Customer: {
                    wait_days_after_automated: 1,
                },
            },
        },
        Contact: {
            id: 456,
            mobile: "+1234567890",
            first_name: "John",
            company_wide_address: false,
            receives_escalated_reminder: true,
            receives_standard_reminder: true,
            status: "Active",
        },
    },

    activityContactWithoutRelations: {
        id: 1,
        activity_id: BigInt(123),
        contact_id: 456,
        Activity: {
            id: BigInt(123),
            type: "SMS" as const,
            is_last_step: false,
            ActivitiesSequence: null,
            CustomerCollectionPeriod: null,
            Customer: null,
        },
        Contact: {
            id: 456,
            mobile: "+1234567890",
            first_name: "John",
            company_wide_address: false,
            receives_escalated_reminder: true,
            receives_standard_reminder: true,
            status: "Active",
        },
    },
};

/**
 * Creates a mock activity contact with optional overrides
 */
export const createMockActivityContact = (overrides = {}) => ({
    ...mockActivityContactData.validActivityContact,
    ...overrides,
});

