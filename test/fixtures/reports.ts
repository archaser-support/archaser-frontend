import type { Table } from "@/utils/reportFieldUtils";

/**
 * Minimal tables metadata for report unit tests.
 * One field per type where needed; translationKey/translationNamespace for label tests.
 */
export const minimalTables: Table[] = [
    {
        name: "Customer",
        label: "Customer",
        fields: [
            { name: "id", type: "string", label: "ID" },
            { name: "name", type: "string", label: "Name" },
            {
                name: "crn",
                type: "string",
                label: "CRN",
                translationKey: "crn",
                translationNamespace: "customers",
            },
            { name: "status", type: "enum", label: "Status", options: ["active", "inactive"], translationKey: "status", translationNamespace: "common" },
            { name: "amount", type: "number", label: "Amount", translationKey: "amount", translationNamespace: "reports" },
            { name: "total_due", type: "decimal", label: "Total Due" },
            { name: "count_orders", type: "integer", label: "Count" },
            { name: "created_at", type: "date", label: "Created" },
            { name: "modified_at", type: "datetime", label: "Modified" },
            { name: "is_active", type: "boolean", label: "Active" },
            { name: "owner_id", type: "user", label: "Owner" },
            { name: "Company.foo", type: "string", label: "Company Foo" },
            { name: "Country.name", type: "string", label: "Country" },
            { name: "State.name", type: "string", label: "State" },
            {
                name: "BusinessUnit.name",
                type: "string",
                label: "Business Unit",
                translationKey: "business_unit",
                translationNamespace: "customers",
            },
            {
                name: "InsurancePolicy.policy_number",
                type: "string",
                label: "Insurance Policy",
            },
        ],
    },
    {
        name: "Company",
        label: "Company",
        fields: [
            { name: "id", type: "string", label: "ID" },
            { name: "name", type: "string", label: "Name" },
            { name: "company_number", type: "string", label: "Number" },
            { name: "created_at", type: "date", label: "Created" },
            { name: "modified_at", type: "datetime", label: "Modified" },
        ],
    },
    {
        name: "Invoice",
        label: "Invoice",
        fields: [
            { name: "id", type: "string", label: "ID" },
            { name: "customer_id", type: "string", label: "Customer" },
            { name: "amount", type: "number", label: "Amount" },
            { name: "status", type: "enum", label: "Status", options: ["open", "paid"] },
            {
                name: "customer_currency",
                type: "string",
                label: "Customer currency",
            },
        ],
    },
    {
        name: "Dispute",
        label: "Dispute",
        fields: [
            { name: "id", type: "string", label: "ID" },
            {
                name: "dispute_reason",
                type: "string",
                label: "Dispute reason",
            },
        ],
    },
];

/**
 * Sample filters for execute/request tests (e.g. "in" operator with value array).
 */
export const sampleFiltersIn = [
    {
        table: "Customer",
        field: "status",
        operator: "in" as const,
        value: ["active", "pending"],
    },
];

export const sampleFiltersEquals = [
    {
        table: "Invoice",
        field: "customer_id",
        operator: "equals" as const,
        value: 123,
    },
];

/**
 * Minimal viewConfig / context objects for useViewExecution and ViewBasedDataGrid tests.
 */
export const viewConfigContexts = {
    customers: "customers",
    customer_unpaid_invoices: "customer_unpaid_invoices",
    dashboard_invoices: "dashboard_invoices",
    dashboard_customers: "dashboard_customers",
    dashboard_payments: "dashboard_payments",
    dashboard_activities: "dashboard_activities",
    dashboard_disputes: "dashboard_disputes",
    dashboard_promises: "dashboard_promises",
} as const;
