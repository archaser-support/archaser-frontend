import { Prisma } from "@prisma/client";

export type DisputeReason = Prisma.DisputeReasonGetPayload<{
    include: {
        Account: true;
        CustomerDispute: true;
        DisputeReasonLanguage: true;
    };
}>;

export interface DisputeReasonLanguage {
    language: string;
    name: string;
    master_template?: boolean;
}

export interface DisputeReasonWithLanguages {
    id: number;
    name: string; // Keep for backward compatibility
    status: "Active" | "Inactive";
    account_id: number;
    editable: boolean;
    master_template: boolean;
    languageTemplates?: DisputeReasonLanguage[];
}

export interface DisputeReasonResponse {
    disputeReasons: DisputeReason[];
    totalRecords: number;
}
