// Mock date for consistent testing
export const MOCK_DATE = new Date("2024-01-15T10:00:00.000Z"); // Monday, 10 AM UTC

// Scheduled Date Test Data
export const mockScheduledDate = {
    scheduledTime: new Date("2024-01-16T17:00:00.000Z"), // 9 AM PST = 5 PM UTC
    calculation: "Step 1: Resolved timezone to America/Los_Angeles\nStep 2: Set target time to 09:00\nStep 3: Added 1 day(s)\nStep 4: Final conversion to UTC format",
};

// Business Hours Test Data
export const mockBusinessHours = {
    start: "09:00",
    end: "18:00",
    timezone: "America/New_York",
    daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
};

// Contact Availability Test Data
export const mockContactAvailability = {
    businessHours: mockBusinessHours,
    preferredChannels: ["email", "sms"],
    urgencyLevels: {
        urgent: true,
        emergency: true,
    },
    holidays: [
        {
            dates: ["2024-01-01"],
            description: "New Year's Day",
        },
    ],
    vacation: {
        startDate: "2024-07-10",
        endDate: "2024-07-20",
        description: "Summer Vacation",
    },
};

// Scheduling Options Test Data
export const mockSchedulingOptions = {
    contactId: 1,
    urgency: "normal" as const,
    channel: "email" as const,
    businessHoursOnly: true,
};

// Timezone Test Data
export const timezoneTestCases = [
    {
        name: "US California (PST)",
        countryCode: "US",
        stateCode: "CA",
        expectedOffset: -8,
    },
    {
        name: "US New York (EST)",
        countryCode: "US",
        stateCode: "NY",
        expectedOffset: -5,
    },
    {
        name: "US Texas (CST)",
        countryCode: "US",
        stateCode: "TX",
        expectedOffset: -6,
    },
    {
        name: "United Kingdom (GMT)",
        countryCode: "GB",
        stateCode: null,
        expectedOffset: 0,
    },
    {
        name: "Germany (CET)",
        countryCode: "DE",
        stateCode: null,
        expectedOffset: 1,
    },
    {
        name: "Australia NSW (AEST)",
        countryCode: "AU",
        stateCode: "NSW",
        expectedOffset: 10,
    },
];

// Date Formatting Test Data
export const dateFormattingTestCases = [
    {
        input: "2025-08-28T00:00:00.000Z",
        locale: "en-US",
        expected: "08/28/2025",
    },
    {
        input: "2025-08-28T00:00:00.000Z",
        locale: "he-IL",
        expected: "28.08.2025",
    },
    {
        input: "2025-12-25T00:00:00.000Z",
        locale: "en-US",
        expected: "12/25/2025",
    },
    {
        input: "2025-12-25T00:00:00.000Z",
        locale: "he-IL",
        expected: "25.12.2025",
    },
];

// Business Hours Edge Cases
export const businessHoursEdgeCases = [
    {
        name: "Holiday overlap with business hours",
        businessHours: { start: "09:00", end: "18:00", timezone: "America/New_York" },
        holiday: { date: "2024-01-01", description: "New Year's Day" },
        expectedBehavior: "Skip holiday, schedule next business day",
    },
    {
        name: "Vacation period scheduling",
        businessHours: { start: "09:00", end: "18:00", timezone: "America/New_York" },
        vacation: { startDate: "2024-07-10", endDate: "2024-07-20" },
        expectedBehavior: "Skip vacation period, schedule after return",
    },
    {
        name: "Emergency scheduling outside business hours",
        businessHours: { start: "09:00", end: "18:00", timezone: "America/New_York" },
        emergency: true,
        expectedBehavior: "Allow scheduling outside business hours",
    },
    {
        name: "Multi-timezone contact availability",
        businessHours: { start: "09:00", end: "18:00", timezone: "America/New_York" },
        contactTimezone: "America/Los_Angeles",
        expectedBehavior: "Schedule based on contact's timezone",
    },
];

// Test Configuration
export const testConfig = {
    mockDate: MOCK_DATE,
    timezone: "UTC",
    locale: "en-US",
    defaultTimeOfDay: "09:00",
    defaultDaysToAdd: 1,
    defaultCountryCode: "US",
    defaultStateCode: "CA",
};
