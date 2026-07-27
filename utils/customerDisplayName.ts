type CustomerNameSource = {
    Person?: { first_name: string | null; last_name: string | null } | null;
    Company?: { name: string | null } | null;
};

/** Display name for a customer (person full name or company name). */
export function getCustomerDisplayName(
    customer: CustomerNameSource | null | undefined
): string {
    if (!customer) {
        return "";
    }
    if (customer.Person) {
        return `${customer.Person.first_name ?? ""} ${customer.Person.last_name ?? ""}`.trim();
    }
    return customer.Company?.name?.trim() ?? "";
}
