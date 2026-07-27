/**
 * API Request Fixtures
 * 
 * Test data fixtures for API request tests
 */

export const mockApiData = {
    validRequest: {
        body: {},
        query: {},
        headers: {},
    },

    accountCreationRequest: {
        body: {
            name: "Test Account",
            email: "test@example.com",
            password: "TestPassword123!",
        },
        query: {},
        headers: {},
    },

    disputeResolutionRequest: {
        body: {
            disputeId: 1,
            resolution: "Resolved",
        },
        query: {},
        headers: {},
    },

    authenticatedRequest: {
        body: {},
        query: {},
        headers: {
            authorization: "Bearer test-token",
        },
    },
};

/**
 * Creates a mock API request with optional overrides
 */
export const createMockRequest = (overrides = {}) => ({
    ...mockApiData.validRequest,
    ...overrides,
});

