/**
 * User Fixtures
 * 
 * Common test data fixtures for user-related tests
 */

export const mockUserData = {
    adminUser: {
        id: "admin1",
        email: "admin@test.com",
        role: "Admin" as const,
        account_id: 1,
        first_name: "Admin",
        last_name: "User",
        status: "Active" as const,
        created_at: new Date("2024-01-01T12:00:00Z"),
        modified_at: new Date("2024-01-01T12:00:00Z"),
    },

    regularUser: {
        id: "user1",
        email: "user@test.com",
        role: "User" as const,
        account_id: 1,
        first_name: "Regular",
        last_name: "User",
        status: "Active" as const,
        created_at: new Date("2024-01-01T12:00:00Z"),
        modified_at: new Date("2024-01-01T12:00:00Z"),
    },

    frozenUser: {
        id: "user2",
        email: "frozen@test.com",
        role: "User" as const,
        account_id: 1,
        first_name: "Frozen",
        last_name: "User",
        status: "Active" as const,
        is_frozen: true,
        frozen_at: new Date("2024-01-01T12:00:00Z"),
        created_at: new Date("2024-01-01T12:00:00Z"),
        modified_at: new Date("2024-01-01T12:00:00Z"),
    },

    deletedUser: {
        id: "user3",
        email: "deleted@test.com",
        role: "User" as const,
        account_id: 1,
        first_name: "Deleted",
        last_name: "User",
        status: "Deleted" as const,
        deleted_at: new Date("2024-01-01T12:00:00Z"),
        created_at: new Date("2024-01-01T12:00:00Z"),
        modified_at: new Date("2024-01-01T12:00:00Z"),
    },
};

/**
 * Creates a mock user with optional overrides
 */
export const createMockUser = (overrides = {}) => ({
    ...mockUserData.regularUser,
    ...overrides,
});

