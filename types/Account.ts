import type {
    Account as AccountRow,
    ActivitiesSequence,
    ActivitiesTemplate,
    Activity,
    Customer,
    DisputeReason,
    Invoice,
    Log,
    User,
} from "@/types/db";

export type Account = AccountRow & {
    ActivitiesSequence: ActivitiesSequence[];
    ActivitiesTemplate: ActivitiesTemplate[];
    Activity: Activity[];
    Customer: Customer[];
    DisputeReason: DisputeReason[];
    Invoice: Invoice[];
    Log: Log[];
    User: User[];
} & {
    portal_verification_enabled?: boolean | null;
    has_collection?: boolean | null;
    has_credit_insurance?: boolean | null;
    has_file_import?: boolean | null;
    enable_customer_checkpoints?: boolean | null;
};

export interface AccountResponse {
    accounts: Account[];
    totalRecords: number;
}
