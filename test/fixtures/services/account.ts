/**
 * Account Service Fixtures
 *
 * Test data fixtures for account-related tests
 */

export const mockAccountData = {
    defaultAccount: {
        id: 1,
        currency: "USD",
        has_collection: true,
        category_for_new_collection: "Automated" as const,
    },

    nonCollectionAccount: {
        id: 2,
        currency: "EUR",
        has_collection: false,
        category_for_new_collection: "Agent" as const,
    },
};

/**
 * Creates a mock account with optional overrides
 */
export const createMockAccount = (overrides = {}) => ({
    ...mockAccountData.defaultAccount,
    ...overrides,
});
