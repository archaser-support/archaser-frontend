import { Prisma } from "@prisma/client";

export type ActivityTemplate = Prisma.ActivitiesTemplateGetPayload<{
    include: {
        ActivitiesSequence: true;
        Activity: true;
        Account: true;
        ActivityTemplateLanguage: true;
    };
}> & {
    dispute_resolution?: string; // Add dispute_resolution field for frontend compatibility
    lockedFields?: string[]; // Add lockedFields for frontend form handling
};

export interface ActivityTemplateResponse {
    templates: ActivityTemplate[];
    totalRecords: number;
}

// Frontend-specific interface for form handling
// NOTE: sms_content, whatsapp_content, email_subject, email_content were removed from
// ActivitiesTemplate — content now lives exclusively in ActivityTemplateLanguage
export interface ActivityTemplateForm {
    id: number;
    name: string;
    category: string;
    language: string;
    active: boolean;
    lockedFields?: string[];
}
