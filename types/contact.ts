import type {
    Activity,
    Company,
    Contact as ContactRow,
    Customer,
} from "@/types/db";

export type Contact = ContactRow & {
    Company: Company;
    Activity: Activity[];
} & {
    Country?: {
        id: number;
        name: string;
        iso2: string | null;
        emoji: string | null;
    } | null;
    State?: {
        id: number;
        name: string;
        country_id: number;
        country_code: string;
    } | null;
};

export interface ContactResponse {
    contacts: Contact[];
    totalRecords: number;
}

export type InvalidContact = ContactRow & {
    Company: Pick<Company, "id" | "name" | "created_by" | "modified_by"> & {
        Customer: Customer[];
    };
};

export interface InvalidContactResponse {
    contacts: InvalidContact[];
    totalRecords: number;
}
