import { Activity } from "@prisma/client";

import { ActivityStatus } from "@/types/enums";

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

// WhatsApp Activity Sequence Test Data
export const mockWhatsAppActivitySequence = {
    ...mockActivitySequence,
    activity_type: "WhatsApp" as Activity["type"],
};

// Last Step Activity Sequence Test Data
export const mockLastStepActivitySequence = {
    ...mockActivitySequence,
    last_category_step: true,
};

// First Step Activity Sequence Test Data
export const mockFirstStepActivitySequence = {
    ...mockActivitySequence,
    step: 1,
    days_from_prev_step: null,
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

// Failed Activity Test Data
export const mockFailedActivity = {
    ...mockCreatedActivity,
    activity_status_id: 18, // Failed - keep for backward compatibility
    status: ActivityStatus.FAILED,
    error_message: "Email delivery failed",
};

// Activity Contact Test Data
export const mockActivityContact = {
    activity_id: 1,
    contact_id: 1,
    status: "Scheduled" as const,
    created_at: new Date(),
    modified_at: new Date(),
};

// Activity Status Test Data - Legacy IDs for backward compatibility
export const activityStatuses = {
    SCHEDULED: 15,
    DELIVERED: 17,
    FAILED: 18,
    CANCELLED: 19,
} as const;

// New enum-based status mapping for tests
export const activityStatusEnums = {
    SCHEDULED: ActivityStatus.SCHEDULED,
    DELIVERED: ActivityStatus.DELIVERED,
    FAILED: ActivityStatus.FAILED,
    CANCELLED: ActivityStatus.CANCELLED,
} as const;

// Activity Types
export const activityTypes = {
    EMAIL: "Email",
    SMS: "SMS",
    WHATSAPP: "WhatsApp",
    CALL: "Call",
} as const;

// Sequence Boundary Test Data
export const sequenceBoundaryTestData = [
    {
        step: 1,
        isFirstStep: true,
        isLastStep: false,
        daysFromPrevStep: null,
        description: "First step in sequence",
    },
    {
        step: 2,
        isFirstStep: false,
        isLastStep: false,
        daysFromPrevStep: 1,
        description: "Middle step in sequence",
    },
    {
        step: 5,
        isFirstStep: false,
        isLastStep: true,
        daysFromPrevStep: 2,
        description: "Last step in sequence",
    },
];
