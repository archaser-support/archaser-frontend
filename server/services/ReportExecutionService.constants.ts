/**
 * Constants for ReportExecutionService
 */

export const OPERATORS = {
    EQUALS: ["=", "equals"],
    NOT_EQUALS: ["!=", "not_equals"],
    GREATER_THAN: [">", "greater_than"],
    GREATER_THAN_OR_EQUAL: [">=", "greater_than_or_equal"],
    LESS_THAN: ["<", "less_than"],
    LESS_THAN_OR_EQUAL: ["<=", "less_than_or_equal"],
    CONTAINS: ["contains"],
    IN: ["in"],
    BETWEEN: ["between"],
} as const;

export const AGGREGATIONS = {
    SUM: "SUM",
    AVG: "AVG",
    COUNT: "COUNT",
    MIN: "MIN",
    MAX: "MAX",
} as const;

export const IN_MEMORY_SORT_THRESHOLD = 1000;

export const TABLES_WITH_ACCOUNT_ID = [
    "Invoice",
    "Payment",
    "Activity",
] as const;
export const TABLES_WITH_ACCOUNT_ID_SET = new Set(TABLES_WITH_ACCOUNT_ID);

export const DATE_INDICATORS = [
    "_date",
    "_at",
    "date_of_birth",
    "due_date",
    "payment_date",
    "schedule_time",
] as const;

export const CUSTOMER_COMPANY_FIELDS = ["name", "company_number"] as const;

export const DATE_FIELDS_BY_TABLE: Record<string, readonly string[]> = {
    Customer: [
        "created_at",
        "modified_at",
        "generic_date1",
        "generic_date2",
        "policy_cost_snapshot_date",
    ],
    Invoice: ["due_date", "created_at", "modified_at", "generic_date1", "generic_date2"],
    Payment: ["payment_date", "created_at", "generic_date1", "generic_date2"],
    InvoicePayment: [
        "payment_date",
        "created_at",
        "modified_at",
    ],
    Contact: ["created_at", "date_of_birth", "generic_date1", "generic_date2"],
    Activity: [
        "schedule_time",
        "created_at",
        "actual_delivery_time",
        "last_sent_time",
        "call_time",
    ],
    Person: ["date_of_birth", "created_at", "modified_at"],
    Company: ["created_at", "modified_at"],
    Dispute: ["created_at", "modified_at", "closed_at"],
    CustomerCollectionPeriod: [
        "created_at",
        "modified_at",
        "period_start_date",
        "period_end_date",
        "promise_to_pay_date",
        "last_dispute_date",
        "next_category_date",
        "follow_up_time",
        "next_activity_date",
        "last_call",
    ],
} as const;

/** Fields that use @db.Date (store date only, no time). Use equals with YYYY-MM-DD to avoid timezone mismatch. */
export const DATE_ONLY_FIELDS_BY_TABLE: Record<string, readonly string[]> = {
    Customer: ["generic_date1", "generic_date2", "policy_cost_snapshot_date"],
    Invoice: ["due_date", "generic_date1", "generic_date2", "invoice_date", "first_activity_date", "last_payment_date"],
    Payment: ["payment_date", "generic_date1", "generic_date2"],
    InvoicePayment: ["payment_date"],
    Contact: ["date_of_birth", "generic_date1", "generic_date2"],
    Person: ["date_of_birth"],
    CustomerCollectionPeriod: [
        "period_start_date",
        "period_end_date",
        "promise_to_pay_date",
        "last_dispute_date",
        "next_category_date",
        "next_activity_date",
    ],
} as const;

export const RELATION_MAP: Record<string, Record<string, string>> = {
    Customer: {
        Invoice: "Invoice",
        Contact: "Contact",
        Person: "Person",
        Company: "Company",
        Activity: "Activity",
        State: "State",
        Country: "Country",
        BusinessUnit: "BusinessUnit",
        CustomerDispute: "CustomerDispute",
        SequenceContainer: "SequenceContainer",
        CustomerCollectionPeriod: "CustomerCollectionPeriod",
    },
    Invoice: {
        Customer: "Customer",
        InsurancePolicy: "InsurancePolicy",
    },
    Contact: {
        Customer: "Customer",
    },
    Activity: {
        Customer: "Customer",
    },
    Dispute: {
        Customer: "Customer",
        DisputeReason: "DisputeReason",
    },
    CustomerBanks: {
        AccountBankAccounts: "AccountBankAccounts",
    },
    InvoicePayment: {
        Customer: "Customer",
        Invoice: "Invoice",
    },
    CustomerCollectionPeriod: {
        Customer: "Customer",
        Activity: "Activity",
    },
} as const;

export const ONE_TO_MANY_MAP: Record<string, readonly string[]> = {
    Customer: ["Invoice", "Contact", "Activity", "CustomerCollectionPeriod"],
    CustomerCollectionPeriod: ["Activity"],
} as const;

export const MODEL_NAME_MAP: Record<string, string> = {
    Customer: "customer",
    Invoice: "invoice",
    Payment: "payment",
    InvoicePayment: "invoicePayment",
    Contact: "contact",
    Activity: "activity",
    Dispute: "customerDispute",
    CustomerCollectionPeriod: "customerCollectionPeriod",
} as const;

/**
 * Report metadata table → Prisma model name used in User_* relation identifiers.
 * Dispute reports use table "Dispute" but relations are on CustomerDispute.
 */
export const USER_RELATION_MODEL_MAP: Record<string, string> = {
    Dispute: "CustomerDispute",
};

/** Prisma User relation for created_by / modified_by on a report table. */
export function getUserRelationNameForReportTable(
    tableName: string,
    fieldName: "created_by" | "modified_by"
): string {
    const prismaModel = USER_RELATION_MODEL_MAP[tableName] || tableName;
    return `User_${prismaModel}_${fieldName}ToUser`;
}
