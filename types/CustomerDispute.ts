import { Prisma } from "@prisma/client";

export type CustomerDispute = Prisma.CustomerDisputeGetPayload<{
    include: {
        DisputeReason: true;
        CustomerCollectionPeriod: true;
        User_CustomerDispute_owner_idToUser: true;
        Customer: {
            include: {
                Person: true;
                Company: true;
            };
        };
        DisputeInvoice: {
            include: {
                Invoice: {
                    select: {
                        invoice_number: true;
                        amount: true;
                        outstanding_debt: true;
                        due_date: true;
                    };
                };
            };
        };
    };
}>;

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
