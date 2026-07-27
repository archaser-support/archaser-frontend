import { Prisma } from "@prisma/client";

export type Contact = Prisma.ContactGetPayload<{
    include: {
        Company: true;
        Activity: true;
    };
}> & {
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

export type InvalidContact = Prisma.ContactGetPayload<{
    include: {
        Company: {
            select: {
                id: true;
                name: true;
                created_by: true;
                modified_by: true;
                Customer: true;
            };
        };
    };
    select: {
        id: true;
        first_name: true;
        last_name: true;
        email: true;
        mobile: true;
        phone: true;
        role: true;
        status: true;
        company_id: true;
        email_status: true;
        mobile_status: true;
        receives_standard_reminder: true;
        receives_escalated_reminder: true;
    };
}>;

export interface InvalidContactResponse {
    contacts: InvalidContact[];
    totalRecords: number;
}
