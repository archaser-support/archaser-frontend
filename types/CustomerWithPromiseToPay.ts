import type {
    Company,
    Country,
    Customer,
    CustomerCollectionPeriod,
    Person,
} from "@/types/db";
import type { CustomerActivitySummary } from "@/types/CustomerWithAgentDispute";

export type PromiseToPayCustomer = CustomerCollectionPeriod & {
    Customer: Pick<
        Customer,
        "id" | "customer_number" | "customer_uuid" | "oldest_invoice_overdue_date"
    > & {
        Country: Pick<Country, "name"> | null;
        Person: Pick<Person, "first_name" | "last_name"> | null;
        Activity: CustomerActivitySummary[];
        Company: Pick<Company, "name"> | null;
    };
};

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
