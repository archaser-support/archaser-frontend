export interface BusinessHours {
    start: string; // HH:mm format
    end: string; // HH:mm format
    timezone: string;
    daysOfWeek: number[]; // 0-6, where 0 is Sunday
}

export interface ContactAvailability {
    businessHours: BusinessHours;
    preferredChannels: string[];
    responseHistory?: {
        channel: string;
        responseTime: number; // minutes
        successRate: number; // 0-1
        lastResponse?: Date;
    }[];
    urgencyLevels: {
        urgent: boolean; // Allow urgent messages outside business hours
        emergency: boolean; // Allow emergency messages anytime
    };
    holidays?: {
        dates: string[]; // YYYY-MM-DD format
        description: string;
    }[];
    vacation?: {
        startDate: string;
        endDate: string;
        description: string;
    };
}

export interface SchedulingOptions {
    contactId?: number;
    urgency: "normal" | "urgent" | "emergency";
    channel: "email" | "sms" | "phone" | "whatsapp";
    preferredTime?: string; // HH:mm format
    timezone?: string;
    countryCode?: string; // ISO country code for holiday checking
    skipWeekends?: boolean;
    businessHoursOnly?: boolean;
}

export interface SchedulingResult {
    scheduledTime: Date;
    isBusinessHours: boolean;
    warnings: string[];
    suggestedTimes: Date[];
    contactTimezone: string;
    localTime: string;
}

export interface HolidayCalendar {
    countryCode: string;
    holidays: {
        date: string; // YYYY-MM-DD format
        name: string;
        type: "national" | "religious" | "observance";
    }[];
}

export interface ResponsePattern {
    contactId: number;
    channel: string;
    averageResponseTime: number; // minutes
    successRate: number;
    optimalHours: {
        start: string;
        end: string;
    };
    lastUpdated: Date;
}
