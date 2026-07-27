// Error Test Data
export const errorTestCases = [
    {
        name: "No contacts found",
        error: "No contacts found for customer 123",
        code: "NO_CONTACTS",
    },
    {
        name: "No contacts after filtering",
        error: "No contacts found for customer 123 after filtering",
        code: "NO_CONTACTS_AFTER_FILTER",
    },
    {
        name: "No activity template found",
        error: "No activity template found for customer 123",
        code: "NO_TEMPLATE",
    },
    {
        name: "Database connection failed",
        error: "Database connection failed",
        code: "DATABASE_ERROR",
    },
    {
        name: "Language resolution failed",
        error: "Language resolution failed",
        code: "LANGUAGE_ERROR",
    },
    {
        name: "Invalid country code",
        error: "Timezone not found for country code: INVALID",
        code: "INVALID_COUNTRY",
    },
    {
        name: "Invalid state code",
        error: "Timezone not found for state code: INVALID",
        code: "INVALID_STATE",
    },
    {
        name: "Scheduling calculation failed",
        error: "Failed to calculate schedule time",
        code: "SCHEDULING_ERROR",
    },
    {
        name: "Activity creation failed",
        error: "Failed to create activity",
        code: "ACTIVITY_CREATION_ERROR",
    },
    {
        name: "Template content generation failed",
        error: "Failed to generate template content",
        code: "TEMPLATE_ERROR",
    },
];

// Error Recovery Test Data
export const errorRecoveryTestData = [
    {
        scenario: "Database timeout",
        retryable: true,
        maxRetries: 3,
        backoffMs: 1000,
    },
    {
        scenario: "Invalid data format",
        retryable: false,
        maxRetries: 0,
        backoffMs: 0,
    },
    {
        scenario: "Network connectivity issue",
        retryable: true,
        maxRetries: 5,
        backoffMs: 2000,
    },
    {
        scenario: "Authentication failure",
        retryable: false,
        maxRetries: 0,
        backoffMs: 0,
    },
];

// Validation Error Test Data
export const validationErrorTestData = [
    {
        field: "customer_id",
        value: null,
        error: "Customer ID is required",
    },
    {
        field: "activity_type",
        value: "INVALID_TYPE",
        error: "Invalid activity type",
    },
    {
        field: "schedule_time",
        value: "invalid-date",
        error: "Invalid date format",
    },
    {
        field: "time_of_day",
        value: "25:00",
        error: "Invalid time format",
    },
    {
        field: "days_from_prev_step",
        value: -1,
        error: "Days from previous step must be positive",
    },
];
