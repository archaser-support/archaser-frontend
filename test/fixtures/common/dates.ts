/**
 * Date Fixtures
 * 
 * Common test data fixtures for date-related tests
 */

export const mockDateData = {
    today: new Date("2024-01-15T12:00:00Z"),
    yesterday: new Date("2024-01-14T12:00:00Z"),
    tomorrow: new Date("2024-01-16T12:00:00Z"),
    lastWeek: new Date("2024-01-08T12:00:00Z"),
    nextWeek: new Date("2024-01-22T12:00:00Z"),
    lastMonth: new Date("2023-12-15T12:00:00Z"),
    nextMonth: new Date("2024-02-15T12:00:00Z"),
    startOfYear: new Date("2024-01-01T00:00:00Z"),
    endOfYear: new Date("2024-12-31T23:59:59Z"),
};

/**
 * Helper function to create a date with optional offset in days
 */
export const created_ate = (daysOffset = 0): Date => {
    const date = new Date(mockDateData.today);
    date.setDate(date.getDate() + daysOffset);
    return date;
};

/**
 * Helper function to create a date string in YYYY-MM-DD format
 */
export const created_ateString = (daysOffset = 0): string => {
    const date = created_ate(daysOffset);
    return date.toISOString().split("T")[0];
};

