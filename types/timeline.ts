import { ActivityContact } from "@prisma/client";

export type LineDetails = {
    id: string;
    title?: string;
    subject?: string;
    description: string;
    time: Date;
    badgeType: string;
    badgeText: string;
    isPortal?: boolean;
    isAutomated?: boolean;
    systemGenerated?: boolean;
    attachments?: any[];
    ActivityContacts?: Array<
        ActivityContact & {
            Contact?: {
                first_name: string;
                last_name: string | null;
                email: string | null;
                mobile: string | null;
                status: string;
            };
        }
    >;
};

// Type for Timeline Data
export type TimelineData = {
    id?: string;
    details: LineDetails[];
    activity_type: string;
    schedule_time?: Date;
    actual_delivery_time?: Date;
    title?: string;
    created_at?: string;
    type?: string;
    contact?: {
        name?: string;
        phone?: string;
    };
    isPortal?: boolean;
    isAutomated?: boolean;
    systemGenerated?: boolean;
    attachments?: any[];
    ActivityContacts: Array<
        ActivityContact & {
            Contact?: {
                first_name: string;
                last_name: string | null;
                email: string | null;
                mobile: string | null;
                status: string;
            };
        }
    >;
};

export interface TimelineResponse {
    timeline: TimelineData[];
    totalRecords: number;
    nextCursor: string | null;
}
