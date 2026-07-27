import { Contact } from "@/types/contact";
import { CustomerRow } from "./MassSendEmailModal.types";

export const isValidContact = (contact: Contact): boolean => {
    return !!(
        contact.email &&
        contact.email.trim() !== "" &&
        contact.email_status === "Valid" &&
        contact.status === "Active"
    );
};

export const filterValidContacts = (contacts: Contact[]): Contact[] => {
    return contacts.filter(isValidContact);
};

export const getCustomerName = (customer: CustomerRow): string => {
    if (customer.name && customer.name !== "name") {
        return customer.name;
    }

    if (customer.raw) {
        const firstName =
            customer.raw.Person?.first_name ||
            customer.raw.person?.first_name ||
            "";
        const lastName =
            customer.raw.Person?.last_name ||
            customer.raw.person?.last_name ||
            "";
        const companyName =
            customer.raw.Company?.name || customer.raw.company?.name || "";
        const result =
            customer.type === "Person"
                ? `${firstName} ${lastName}`.trim() || `Customer ${customer.id}`
                : companyName || `Customer ${customer.id}`;
        return result;
    }
    return `Customer ${customer.id}`;
};

export const getActiveRows = (rows: CustomerRow[]): CustomerRow[] => {
    return rows.filter((row) => {
        const collectionStatus =
            row.collection_status || row.raw?.collection_status;
        return collectionStatus !== "Inactive";
    });
};
