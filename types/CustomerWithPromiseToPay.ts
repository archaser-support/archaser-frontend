import { Prisma } from "@prisma/client";

export type PromiseToPayCustomer = Prisma.CustomerCollectionPeriodGetPayload<{
    include: {
        Customer: {
            select: {
                id: true;
                customer_number: true;
                customer_uuid: true;
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

export interface PromiseToPayResponse {
    promiseToPayList: PromiseToPayCustomer[];
    totalRecords: number;
    stats: PromiseToPayStats;
}

export interface PromiseToPayStats {
    counts: {
        total_customers: number;
        total_invoices: number;
        total_outstanding_amount: number;
        currency: string;
    };
}
