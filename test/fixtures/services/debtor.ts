/**
 * Customer Service Fixtures
 * 
 * Test data fixtures for customer-related tests
 */

export const mockCustomerData = {
    validCustomer: {
        id: 1,
        name: "Test Customer",
        account_id: 1,
        client_type: "Company" as const,
        created_at: new Date("2024-01-01T12:00:00Z"),
        modified_at: new Date("2024-01-01T12:00:00Z"),
        status: "Active" as const,
    },

    customerWithCollectionPeriod: {
        id: 1,
        name: "Test Customer",
        account_id: 1,
        client_type: "Company" as const,
        created_at: new Date("2024-01-01T12:00:00Z"),
        modified_at: new Date("2024-01-01T12:00:00Z"),
        status: "Active" as const,
        collectionPeriod: {
            id: 1,
            customer_id: 1,
            category: "New" as const,
            start_date: new Date("2024-01-01"),
            end_date: null,
        },
    },
};

/**
 * Creates a mock customer with optional overrides
 */
export const createMockCustomer = (overrides = {}) => ({
    ...mockCustomerData.validCustomer,
    ...overrides,
});

