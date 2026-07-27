// Enums
export enum ActivityType {
    SMS = "SMS",
    Email = "Email",
    Call = "Call",
    WhatsApp = "WhatsApp",
    Internal = "Internal",
    Resolved = "Resolved",
    Dispute = "Dispute",
    PromiseToPay = "Promise_to_pay",
    Agent = "Agent",
}

// Union type for activity sequences (more flexible than enum)
export type ActivityTypeUnion =
    | "SMS"
    | "Email"
    | "Call"
    | "WhatsApp"
    | "Internal"
    | "Resolved"
    | "Dispute"
    | "Promise_to_pay"
    | "Agent";

export enum Category {
    Automated = "Automated",
    PromiseToPay = "Promise to pay",
    Dispute = "Dispute",
    Agent = "Agent",
    Legal = "Legal",
}

// Union type for activity sequences (more flexible than enum)
export type CategoryType =
    | "Automated"
    | "Promise_to_pay"
    | "Dispute"
    | "Agent"
    | "Legal";

// Constants for activity sequences
export const ACTIVITY_TYPE_OPTIONS = [
    { value: "SMS", label: "sms" },
    { value: "Email", label: "email" },
    { value: "WhatsApp", label: "whatsapp" },
    { value: "Call", label: "call" },
    { value: "Internal", label: "internal" },
];

export const CATEGORY_OPTIONS = [
    { value: "Automated", label: "automated" },
    { value: "Promise_to_pay", label: "promise_to_pay" },
    { value: "Dispute", label: "dispute" },
    { value: "Agent", label: "agent" },
    { value: "Legal", label: "legal" },
];

export enum ClientType {
    Company = "Company",
    Person = "Person",
}

export enum CustomerClientType {
    Company = "Company",
    Person = "Person",
    All = "All",
}

export enum InvoiceStatusState {
    Open = "Open",
    Close = "Close",
}

export enum Language {
    English = "English",
    Hebrew = "Hebrew",
    German = "German",
    Spanish = "Spanish",
    French = "French",
    Italian = "Italian",
    Portuguese = "Portuguese",
}

export enum LogLevel {
    DEBUG = "DEBUG",
    INFO = "INFO",
    WARNING = "WARNING",
    ERROR = "ERROR",
    CRITICAL = "CRITICAL",
}

export enum NotificationType {
    Primary = "Primary",
    Secondary = "Secondary",
}

export enum RecordStatus {
    Active = "Active",
    Inactive = "Inactive",
}

export enum DisputeStatus {
    New = "New",
    UnderReview = "Under Review",
    AwaitingUpdate = "Awaiting Update",
    Resolved = "Resolved",
    Cancelled = "Cancelled",
}

export enum DisputeResolution {
    Denied = "Denied",
    Cancelled = "Cancelled",
    AcceptedSettledPartly = "Accepted - Settled partly",
    AcceptedSettledInFull = "Accepted - Settled in full",
    Accepted = "Accepted",
    AdminFixedBalanceUnchanged = "Admin Fixed – Balance Unchanged",
}

export enum Priority {
    Low = "Low",
    Normal = "Normal",
    High = "High",
}

export enum ActivityStatus {
    SCHEDULED = "SCHEDULED",
    SENT = "SENT",
    DELIVERED = "DELIVERED",
    FAILED = "FAILED",
    CANCELLED = "CANCELLED",
    PAUSED = "PAUSED",
    BOUNCED = "BOUNCED",
    DISPUTE = "DISPUTE",
    COMPLETED = "COMPLETED",
}

// Legacy ID mapping for backward compatibility
export const ACTIVITY_STATUS_LEGACY_IDS = {
    SMS_SCHEDULED: 9,
    SMS_SENT: 10,
    SMS_DELIVERED: 10,
    SMS_FAILED: 11,
    SMS_CANCELLED: 13,
    SMS_PAUSED: 28,
    EMAIL_SCHEDULED: 15,
    EMAIL_SENT: 16,
    EMAIL_DELIVERED: 17,
    EMAIL_FAILED: 18,
    EMAIL_BOUNCED: 18,
    EMAIL_CANCELLED: 21,
    EMAIL_PAUSED: 27,
    WHATSAPP_SCHEDULED: 22,
    WHATSAPP_CANCELLED: 29,
    WHATSAPP_PAUSED: 29,
    CALL_CANCELLED: 7,
    INTERNAL_DISPUTE: 16,
    INTERNAL_COMPLETED: 1,
} as const;

// Status mapping utility
export const ACTIVITY_STATUS_MAPPING = {
    [ActivityStatus.SCHEDULED]: {
        SMS: ACTIVITY_STATUS_LEGACY_IDS.SMS_SCHEDULED,
        Email: ACTIVITY_STATUS_LEGACY_IDS.EMAIL_SCHEDULED,
        WhatsApp: ACTIVITY_STATUS_LEGACY_IDS.WHATSAPP_SCHEDULED,
    },
    [ActivityStatus.SENT]: {
        SMS: ACTIVITY_STATUS_LEGACY_IDS.SMS_SENT,
        Email: ACTIVITY_STATUS_LEGACY_IDS.EMAIL_SENT,
    },
    [ActivityStatus.DELIVERED]: {
        SMS: ACTIVITY_STATUS_LEGACY_IDS.SMS_DELIVERED,
        Email: ACTIVITY_STATUS_LEGACY_IDS.EMAIL_DELIVERED,
    },
    [ActivityStatus.FAILED]: {
        SMS: ACTIVITY_STATUS_LEGACY_IDS.SMS_FAILED,
        Email: ACTIVITY_STATUS_LEGACY_IDS.EMAIL_FAILED,
    },
    [ActivityStatus.CANCELLED]: {
        SMS: ACTIVITY_STATUS_LEGACY_IDS.SMS_CANCELLED,
        Email: ACTIVITY_STATUS_LEGACY_IDS.EMAIL_CANCELLED,
        WhatsApp: ACTIVITY_STATUS_LEGACY_IDS.WHATSAPP_CANCELLED,
        Call: ACTIVITY_STATUS_LEGACY_IDS.CALL_CANCELLED,
    },
    [ActivityStatus.PAUSED]: {
        SMS: ACTIVITY_STATUS_LEGACY_IDS.SMS_PAUSED,
        Email: ACTIVITY_STATUS_LEGACY_IDS.EMAIL_PAUSED,
        WhatsApp: ACTIVITY_STATUS_LEGACY_IDS.WHATSAPP_PAUSED,
    },
    [ActivityStatus.BOUNCED]: {
        Email: ACTIVITY_STATUS_LEGACY_IDS.EMAIL_BOUNCED,
    },
    [ActivityStatus.DISPUTE]: {
        Internal: ACTIVITY_STATUS_LEGACY_IDS.INTERNAL_DISPUTE,
        Dispute: ACTIVITY_STATUS_LEGACY_IDS.INTERNAL_DISPUTE,
    },
    [ActivityStatus.COMPLETED]: {
        Internal: ACTIVITY_STATUS_LEGACY_IDS.INTERNAL_COMPLETED,
        Dispute: ACTIVITY_STATUS_LEGACY_IDS.INTERNAL_COMPLETED,
    },
} as const;