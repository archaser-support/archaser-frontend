import { Prisma } from "@prisma/client";

export type CustomerAgent = Prisma.CustomerCollectionPeriodGetPayload<{
    include: {
        Customer: {
            select: {
                id: true;
                customer_number: true;
                Country: {
                    select: {
                        name: true;
                    };
                };
                Person: {
                    select: {
                        first_name: true;
                        last_name: true;
                    };
                };
                Activity: {
                    select: {
                        modified_at: true;
                        type: true;
                        ActivityStatus: {
                            select: {
                                name: true;
                            };
                        };
                    };
                };
                Company: {
                    select: {
                        name: true;
                    };
                };
                oldest_invoice_overdue_date: true;
            };
        };
    };
}>;

export interface DisputeAgentResponse {
    agents: CustomerAgent[];
    totalRecords: number;
    stats: DisputeWithAgentStats;
    currency: string;
}

export interface DisputeWithAgentStats {
    counts: {
        total_customers: number;
        total_invoices: number;
        total_outstanding_amount: number;
        currency: string;
    };
}
