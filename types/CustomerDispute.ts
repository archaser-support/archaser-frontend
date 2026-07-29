import type {
    Company,
    Customer,
    CustomerCollectionPeriod,
    CustomerDispute as CustomerDisputeRow,
    DisputeInvoice,
    DisputeReason,
    Invoice,
    Person,
    User,
} from "@/types/db";

export type CustomerDispute = CustomerDisputeRow & {
    DisputeReason: DisputeReason | null;
    CustomerCollectionPeriod: CustomerCollectionPeriod | null;
    User_CustomerDispute_owner_idToUser: User | null;
    Customer: Customer & {
        Person: Person | null;
        Company: Company | null;
    };
    DisputeInvoice: Array<
        DisputeInvoice & {
            Invoice: Pick<
                Invoice,
                "invoice_number" | "amount" | "outstanding_debt" | "due_date"
            >;
        }
    >;
};

export interface OpenDisputeResponse {
    disputes: CustomerDispute[];
    hasUnresolvedDisputes: boolean;
}

export interface DisputeResponse {
    disputes: Array<CustomerDispute & { amount: number }>;
    totalRecords: number;
    stats: DisputeStats;
}

export interface DisputeStats {
    disputeAssignFrequencyList: Array<{
        name: string;
        dispute_count: number;
        user_image: string | null;
    }>;
    pieChartData: {
        series: number[]; // Array of numerical series
        labels: string[]; // Array of label strings
    };
    counts: {
        total_customers: number;
        total_invoices: number;
        total_outstanding_amount: number;
        currency: string;
    };
}
