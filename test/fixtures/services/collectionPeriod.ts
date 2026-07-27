/**
 * Collection Period Fixtures
 *
 * Test data fixtures for collection-period-related tests
 */

export const mockCollectionPeriodData = {
    openCollectionPeriod: {
        id: 1,
        customer_id: 1,
        period_start_date: new Date("2024-01-01T00:00:00.000Z"),
        period_end_date: null,
        no_of_overdue_invoices: 2,
        total_outstanding_amount: 1000,
        current_category: "Automated" as const,
        last_automated_step: 0,
        create_next_activity: true,
    },

    closedCollectionPeriod: {
        id: 2,
        customer_id: 1,
        period_start_date: new Date("2024-01-01T00:00:00.000Z"),
        period_end_date: new Date("2024-02-01T00:00:00.000Z"),
        no_of_overdue_invoices: 0,
        total_outstanding_amount: 0,
        current_category: "Agent" as const,
        last_automated_step: 1,
        create_next_activity: false,
    },
};

/**
 * Creates a mock collection period with optional overrides
 */
export const createMockCollectionPeriod = (overrides = {}) => ({
    ...mockCollectionPeriodData.openCollectionPeriod,
    ...overrides,
});
