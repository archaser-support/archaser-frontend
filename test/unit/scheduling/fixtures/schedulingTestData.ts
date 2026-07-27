import { Activity } from "@prisma/client";

import { ActivityStatus } from "@/types/enums";

// Mock date for consistent testing
export const MOCK_DATE = new Date("2024-01-15T10:00:00.000Z"); // Monday, 10 AM UTC

// Collection Period Test Data
export const mockCollectionPeriod = {
    id: 1,
    customer_id: 123,
    last_automated_step: 1,
    period_start_date: new Date("2024-01-15T00:00:00.000Z"),
    current_category: "Automated",
    is_last_automated_step_delivered: false,
    next_category: null,
    previous_category: "New",
    next_category_date: null,
    create_next_activity: false,
    period_end_date: null,
    created_at: new Date("2024-01-15T00:00:00.000Z"),
    modified_at: new Date("2024-01-15T00:00:00.000Z"),
    Customer: {
        account_id: 456,
        type: "Company" as const,
        email: null,
        customer_uuid: "test-customer-uuid",
        language: "English",
        Person: null,
        Company: {
            name: "Test Company",
            Contact: [
                {
                    id: 1,
                    email: "contact1@test.com",
                    mobile: "+1234567890",
                    status: "Active",
                    first_name: "John",
                    company_wide_address: true,
                    receives_standard_reminder: true,
                    receives_escalated_reminder: false,
                },
                {
                    id: 2,
                    email: "contact2@test.com",
                    mobile: "+1234567891",
                    status: "Active",
                    first_name: "Jane",
                    company_wide_address: false,
                    receives_standard_reminder: false,
                    receives_escalated_reminder: true,
                },
            ],
        },
        Country: {
            id: 1,
            iso2: "US",
        },
        State: {
            iso2: "CA",
        },
        Customer: {
            id: 456,
            name: "Test Customer",
            logo: "test-logo.png",
            sub_domain: "test",
            Country: {
                iso2: "US",
            },
            State: {
                iso2: "CA",
            },
        },
    },
};

// Person Collection Period Test Data
export const mockPersonCollectionPeriod = {
    ...mockCollectionPeriod,
    Customer: {
        ...mockCollectionPeriod.Customer,
        type: "Person" as const,
        email: "person@test.com",
        Person: {
            mobile: "+1234567890",
            first_name: "John",
        },
        Company: null,
    },
};

// Activity Sequence Test Data
export const mockActivitySequence = {
    id: 1,
    step: 2,
    activity_type: "Email" as Activity["type"],
    time_of_day: "09:00",
    last_category_step: false,
    send_to_standard_contacts: true,
    send_to_escalated_contacts: false,
    days_from_prev_step: 1,
    ActivitiesTemplate: {
        id: 1,
        email_subject: "Payment Reminder - {{account_name}}",
        email_content: "Dear {{customer_name}}, please pay your outstanding balance.",
        sms_content: "Payment reminder from {{account_name}}",
        whatsapp_content: "Hi {{customer_name}}, please pay your balance.",
        ActivityTemplateLanguages: [
            {
                language: "English",
                email_subject: "Payment Reminder - {{account_name}}",
                email_content: "Dear {{customer_name}}, please pay your outstanding balance.",
                sms_content: "Payment reminder from {{account_name}}",
                whatsapp_content: "Hi {{customer_name}}, please pay your balance.",
            },
            {
                language: "Hebrew",
                email_subject: "תזכורת לתשלום - {{account_name}}",
                email_content: "שלום {{customer_name}}, אנא שלם את החוב שלך.",
                sms_content: "תזכורת לתשלום מ{{account_name}}",
                whatsapp_content: "שלום {{customer_name}}, אנא שלם את החוב שלך.",
            },
        ],
    },
};

// SMS Activity Sequence Test Data
export const mockSMSActivitySequence = {
    ...mockActivitySequence,
    activity_type: "SMS" as Activity["type"],
};

// Last Step Activity Sequence Test Data
export const mockLastStepActivitySequence = {
    ...mockActivitySequence,
    last_category_step: true,
};

// Scheduled Date Test Data
export const mockScheduledDate = {
    scheduledTime: new Date("2024-01-16T17:00:00.000Z"), // 9 AM PST = 5 PM UTC
    calculation: "Step 1: Resolved timezone to America/Los_Angeles\nStep 2: Set target time to 09:00\nStep 3: Added 1 day(s)\nStep 4: Final conversion to UTC format",
};

// Created Activity Test Data
export const mockCreatedActivity = {
    id: 1,
    customer_id: 123,
    collection_period_id: 1,
    type: "Email",
    title: "Automated Step 2 scheduled for 2 contacts at Jan 16, 9:00 AM",
    content: "Dear Test Company, please pay your outstanding balance.",
    schedule_time: new Date("2024-01-16T17:00:00.000Z"),
    activity_status_id: 15, // Keep for backward compatibility
    status: ActivityStatus.SCHEDULED,
    account_id: 456,
    is_last_step: false,
    activity_sequence_id: 1,
    activity_template: 1,
    schedule_calculation: "Step 1: Resolved timezone to America/Los_Angeles\nStep 2: Set target time to 09:00\nStep 3: Added 1 day(s)\nStep 4: Final conversion to UTC format",
    system_generated: true,
    created_at: new Date(),
    modified_at: new Date(),
};

// Delivered Activity Test Data
export const mockDeliveredActivity = {
    ...mockCreatedActivity,
    activity_status_id: 17, // Delivered - keep for backward compatibility
    status: ActivityStatus.DELIVERED,
    actual_delivery_time: new Date("2024-01-16T17:00:00.000Z"),
    is_last_step: true,
};

// Activity Contact Test Data
export const mockActivityContact = {
    activity_id: 1,
    contact_id: 1,
    status: "Scheduled" as const,
    created_at: new Date(),
    modified_at: new Date(),
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

// Error Test Data
export const errorTestCases = [
    {
        name: "No contacts found",
        error: "No contacts found for customer 123",
    },
    {
        name: "No contacts after filtering",
        error: "No contacts found for customer 123 after filtering",
    },
    {
        name: "No activity template found",
        error: "No activity template found for customer 123",
    },
    {
        name: "Database connection failed",
        error: "Database connection failed",
    },
    {
        name: "Language resolution failed",
        error: "Language resolution failed",
    },
    {
        name: "Invalid country code",
        error: "Timezone not found for country code: INVALID",
    },
];

// Performance Test Data
export const performanceTestData = {
    largeDatasetSize: 1000,
    maxExecutionTime: 5000, // 5 seconds
    concurrentExecutions: 3,
};

// Integration Test Data
export const integrationTestData = {
    mockJobId: 1,
    mockLastJobExecution: new Date("2024-01-15T00:00:00.000Z"),
    mockCustomerId: 123,
    mockAccountId: 456,
    mockContactId: 1,
};

// Mock Functions
export const mockFunctions = {
    logCallback: (message: string, level: 'INFO' | 'ERROR' | 'WARNING' | 'DEBUG', parameters?: any, results?: any) => {
        // Debug log removed - use test assertions instead
    },
    translate: (key: string) => key,
    mockPrismaResponse: (data: any) => ({ count: Array.isArray(data) ? data.length : 1 }),
};

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
