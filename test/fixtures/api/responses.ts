/**
 * API Response Fixtures
 * 
 * Test data fixtures for API response tests
 */

export const mockApiResponses = {
    successResponse: {
        data: {},
        status: 200,
    },

    errorResponse: {
        error: "An error occurred",
        status: 500,
    },

    unauthorizedResponse: {
        error: "Unauthorized",
        status: 401,
    },

    notFoundResponse: {
        error: "Not found",
        status: 404,
    },

    validationErrorResponse: {
        error: "Validation failed",
        status: 400,
        details: [],
    },
};

/**
 * Creates a mock API response with optional overrides
 */
export const createMockResponse = (overrides = {}) => ({
    ...mockApiResponses.successResponse,
    ...overrides,
});

