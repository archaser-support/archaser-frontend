import { Prisma } from "@prisma/client";

export type ActivitySequence = Prisma.ActivitiesSequenceGetPayload<{
    include: {
        ActivitiesTemplate: true;
        Activity: true;
        Account: true;
    };
}> & {
    lockedFields?: string[]; // Add lockedFields for frontend form handling
    deleted?: boolean; // Add deleted flag for frontend filtering
    send_to_standard_contacts?: boolean; // Add contact preferences
    send_to_escalated_contacts?: boolean; // Add contact preferences
};

export interface ActivitySequenceResponse {
    activitySequences: ActivitySequence[];
    totalRecords: number;
}

// Frontend-specific interface for form handling
export interface ActivitySequenceForm {
    id: number;
    category: string;
    step: number | null;
    activity_type: string;
    days_from_prev_step: number | null;
    step_type?: "due" | "overdue" | null;
    days_before_due?: number | null;
    active: boolean;
    account_id: string;
    activity_template_id: string;
    time_of_day: string;
    sequence_container_id?: number | null;
    lockedFields?: string[];
    ActivitiesTemplate?: {
        id: number;
        name: string;
    };
    deleted?: boolean;
    send_to_standard_contacts?: boolean;
    send_to_escalated_contacts?: boolean;
}
