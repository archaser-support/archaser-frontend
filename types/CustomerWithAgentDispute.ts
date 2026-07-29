import type {
    Activity,
    BusinessUnit,
    Company,
    Country,
    Customer,
    CustomerCollectionPeriod,
    Person,
    State,
} from "@/types/db";

/** Latest activity summary returned alongside collection-period rows. */
export type CustomerActivitySummary = Pick<Activity, "modified_at" | "type"> & {
    ActivityStatus?: { name: string | null } | null;
};

export type CustomerAgent = CustomerCollectionPeriod & {
    Customer: Pick<Customer, "id" | "customer_number" | "oldest_invoice_overdue_date"> & {
        Country: Pick<Country, "id" | "name" | "iso2"> | null;
        State: Pick<State, "id" | "name" | "iso2"> | null;
        BusinessUnit: Pick<BusinessUnit, "id" | "name"> | null;
        Person: Pick<Person, "first_name" | "last_name"> | null;
        Activity: CustomerActivitySummary[];
        Company: Pick<Company, "name"> | null;
    };
};

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
