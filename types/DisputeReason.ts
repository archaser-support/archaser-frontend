import type {
    Account,
    CustomerDispute,
    DisputeReason as DisputeReasonRow,
    DisputeReasonLanguage as DisputeReasonLanguageRow,
} from "@/types/db";

export type DisputeReason = DisputeReasonRow & {
    Account: Account;
    CustomerDispute: CustomerDispute[];
    DisputeReasonLanguage: DisputeReasonLanguageRow[];
};

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
