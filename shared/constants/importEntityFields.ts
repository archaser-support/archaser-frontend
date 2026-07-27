import type { ImportType } from "@prisma/client";

import type { PriorityEntityImportType } from "@/server/integrations/priority/fixtures/samplePayloads";

export type ConnectorFieldTransform =
    | "date"
    | "boolean"
    | "trim"
    | "currency_code";

export interface MappingRule {
    archaserField: string;
    erpField: string;
    transform?: ConnectorFieldTransform;
}

export interface ImportEntityFieldCatalog {
    fields: readonly string[];
    requiredFields: readonly string[];
    highlightedFields: readonly string[];
    exampleValues: Record<string, string | number | boolean | null>;
}

const CUSTOMER_CATALOG: ImportEntityFieldCatalog = {
    fields: [
        "name",
        "customer_number",
        "crn",
        "country_iso2",
        "state_iso2",
        "city",
        "address_line1",
        "address_line2",
        "postal_code",
        "owner_email",
        "business_unit",
        "parent_customer_number",
    ],
    requiredFields: ["customer_number"],
    highlightedFields: ["customer_number"],
    exampleValues: {
        name: "Acme Trading Ltd",
        customer_number: "T000001",
        crn: "514123456",
        country_iso2: "US",
        state_iso2: "CA",
        city: "San Francisco",
        address_line1: "100 Market St",
        address_line2: null,
        postal_code: "94105",
        owner_email: "billing@acme.example",
        business_unit: "BU-001",
        parent_customer_number: null,
    },
};

const CONTACT_CATALOG: ImportEntityFieldCatalog = {
    fields: [
        "erp_contact_id",
        "first_name",
        "last_name",
        "customer_number",
        "email",
        "phone",
        "mobile",
        "role",
        "company_wide_address",
        "receives_standard_reminder",
        "receives_escalated_reminder",
    ],
    requiredFields: ["erp_contact_id", "customer_number"],
    highlightedFields: ["erp_contact_id", "customer_number"],
    exampleValues: {
        erp_contact_id: "10001",
        first_name: "Jane",
        last_name: "Smith",
        customer_number: "T000001",
        email: "jane.smith@acme.example",
        phone: "+1-415-555-0101",
        mobile: "+1-415-555-0199",
        role: "AP Manager",
        company_wide_address: false,
        receives_standard_reminder: true,
        receives_escalated_reminder: true,
    },
};

const INVOICE_CATALOG: ImportEntityFieldCatalog = {
    fields: [
        "customer_number",
        "invoice_date",
        "due_date",
        "base_amount",
        "invoice_amount",
        "customer_total_paid",
        "currency",
        "invoice_number",
        "credit_for_invoice_number",
    ],
    requiredFields: [
        "customer_number",
        "invoice_date",
        "invoice_number",
        "base_amount",
        "invoice_amount",
    ],
    highlightedFields: ["customer_number", "invoice_number", "invoice_date"],
    exampleValues: {
        customer_number: "T000001",
        invoice_date: "2025-05-01",
        due_date: "2025-06-01",
        base_amount: 1500,
        invoice_amount: 1500,
        customer_total_paid: 0,
        currency: "USD",
        invoice_number: "INV-2025-0001",
        credit_for_invoice_number: null,
    },
};

const PAYMENT_CATALOG: ImportEntityFieldCatalog = {
    fields: [
        "customer_number",
        "invoice_number",
        "payment_date",
        "amount",
        "payment_method",
        "reference",
        "customer_currency",
        "customer_amount",
    ],
    requiredFields: [
        "customer_number",
        "invoice_number",
        "reference",
        "customer_amount",
        "customer_currency",
        "payment_date",
    ],
    highlightedFields: ["reference", "customer_number", "invoice_number"],
    exampleValues: {
        customer_number: "T000001",
        invoice_number: "INV-2025-0001",
        payment_date: "2025-05-25",
        amount: 1250,
        payment_method: "Wire transfer",
        reference: "PAY-2025-0001",
        customer_currency: "USD",
        customer_amount: 1250,
    },
};

export const IMPORT_ENTITY_FIELD_CATALOGS: Record<
    PriorityEntityImportType,
    ImportEntityFieldCatalog
> = {
    Customer: CUSTOMER_CATALOG,
    Contact: CONTACT_CATALOG,
    Invoice: INVOICE_CATALOG,
    Payment: PAYMENT_CATALOG,
};

export function getImportEntityFieldCatalog(
    importType: ImportType
): ImportEntityFieldCatalog | null {
    if (
        importType === "Customer" ||
        importType === "Contact" ||
        importType === "Invoice" ||
        importType === "Payment"
    ) {
        return IMPORT_ENTITY_FIELD_CATALOGS[importType];
    }
    return null;
}

export const CONNECTOR_FIELD_TRANSFORMS: readonly ConnectorFieldTransform[] = [
    "date",
    "boolean",
    "trim",
    "currency_code",
];

export const DEFAULT_CONNECTOR_ENABLED_ENTITIES: PriorityEntityImportType[] = [
    "Customer",
    "Contact",
    "Invoice",
    "Payment",
];

const DEFAULT_ERP_FIELDS: Record<
    PriorityEntityImportType,
    Partial<Record<string, { erpField: string; transform?: ConnectorFieldTransform }>>
> = {
    Customer: {
        customer_number: { erpField: "CUSTNAME", transform: "trim" },
        name: { erpField: "CDES", transform: "trim" },
        crn: { erpField: "WTAXNUM" },
        owner_email: { erpField: "EMAIL" },
        address_line1: { erpField: "ADDRESS" },
        postal_code: { erpField: "ZIP" },
    },
    Contact: {
        erp_contact_id: { erpField: "KLINE", transform: "trim" },
        customer_number: { erpField: "CUSTNAME", transform: "trim" },
        first_name: { erpField: "FIRSTNAME", transform: "trim" },
        last_name: { erpField: "LASTNAME", transform: "trim" },
        email: { erpField: "EMAIL", transform: "trim" },
        phone: { erpField: "PHONE" },
        mobile: { erpField: "CELLPHONE" },
        role: { erpField: "POSITIONDES" },
    },
    Invoice: {
        customer_number: { erpField: "CUSTNAME" },
        invoice_number: { erpField: "IVNUM" },
        invoice_date: { erpField: "IVDATE", transform: "date" },
        due_date: { erpField: "DUEDATE", transform: "date" },
        base_amount: { erpField: "TOTPRICE" },
        invoice_amount: { erpField: "TOTPRICE" },
        currency: { erpField: "CODE", transform: "currency_code" },
        credit_for_invoice_number: { erpField: "CREDITFOR" },
    },
    Payment: {
        reference: { erpField: "PAYNUM", transform: "trim" },
        customer_number: { erpField: "CUSTNAME" },
        invoice_number: { erpField: "IVNUM" },
        payment_date: { erpField: "PAYDATE", transform: "date" },
        amount: { erpField: "PAYMENT" },
        customer_amount: { erpField: "PAYMENT" },
        customer_currency: { erpField: "CODE", transform: "currency_code" },
        payment_method: { erpField: "PAYDES" },
    },
};

export function normalizeConnectorEnabledEntities(
    raw: unknown
): PriorityEntityImportType[] {
    if (!Array.isArray(raw) || raw.length === 0) {
        return [...DEFAULT_CONNECTOR_ENABLED_ENTITIES];
    }
    const allowed = new Set<string>(DEFAULT_CONNECTOR_ENABLED_ENTITIES);
    const filtered = raw.filter(
        (item): item is PriorityEntityImportType =>
            typeof item === "string" && allowed.has(item)
    );
    return filtered.length > 0
        ? filtered
        : [...DEFAULT_CONNECTOR_ENABLED_ENTITIES];
}

export function buildDefaultConnectorMappingRules(
    importType: ImportType
): MappingRule[] {
    if (
        importType !== "Customer" &&
        importType !== "Contact" &&
        importType !== "Invoice" &&
        importType !== "Payment"
    ) {
        return [];
    }

    const catalog = IMPORT_ENTITY_FIELD_CATALOGS[importType];
    const defaults = DEFAULT_ERP_FIELDS[importType];
    return catalog.fields.flatMap((archaserField) => {
        const mapping = defaults[archaserField];
        if (!mapping) {
            return [];
        }
        const rule: MappingRule = {
            archaserField,
            erpField: mapping.erpField,
        };
        if (mapping.transform) {
            rule.transform = mapping.transform;
        }
        return [rule];
    });
}
