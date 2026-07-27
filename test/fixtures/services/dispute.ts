/**
 * Dispute Service Fixtures
 * 
 * Test data fixtures for dispute-related tests
 */

export const mockDisputeData = {
    validDispute: {
        id: 1,
        customer_id: 1,
        customer_id: 1,
        dispute_reason_id: 1,
        status: "Open" as const,
        created_at: new Date("2024-01-01T12:00:00Z"),
        modified_at: new Date("2024-01-01T12:00:00Z"),
        created_by: "user1",
        modified_by: "user1",
    },

    resolvedDispute: {
        id: 1,
        customer_id: 1,
        customer_id: 1,
        dispute_reason_id: 1,
        status: "Resolved" as const,
        resolved_at: new Date("2024-01-02T12:00:00Z"),
        created_at: new Date("2024-01-01T12:00:00Z"),
        modified_at: new Date("2024-01-02T12:00:00Z"),
        created_by: "user1",
        modified_by: "user1",
    },

    disputeWithReason: {
        id: 1,
        customer_id: 1,
        customer_id: 1,
        dispute_reason_id: 1,
        status: "Open" as const,
        created_at: new Date("2024-01-01T12:00:00Z"),
        modified_at: new Date("2024-01-01T12:00:00Z"),
        created_by: "user1",
        modified_by: "user1",
        disputeReason: {
            id: 1,
            name: "Test Reason",
            account_id: 1,
        },
    },
};

/**
 * Creates a mock dispute with optional overrides
 */
export const createMockDispute = (overrides = {}) => ({
    ...mockDisputeData.validDispute,
    ...overrides,
});

