import { CurrencyColumnsConfig } from "@/shared/utility/exportToExcel";
import AppUrls from "@/utils/appUrls";

/** Report builder Location value for reports shown on the main Reports menu (/app/reports). */
export const MAIN_REPORTS_MENU_CONTEXT = "reports";

/**
 * Link handler function type
 * @param id - Entity ID
 * @param tab - Optional tab parameter
 * @returns URL string
 */
export type LinkHandler = (id: number, tab?: string) => string;

/**
 * Context-specific configuration for view-based data grids
 */
export interface ViewContextConfig {
    /** Database table name (e.g., "Customer", "Dispute", "Invoice") */
    tableName: string;
    /** Field name for entity ID */
    entityIdField: string;
    /** Field name for entity name/display */
    entityNameField: string;
    /** Default sort configuration */
    defaultSort: { field: string; sort: "asc" | "desc" };
    /** Link handlers for different entity types */
    linkHandlers?: Record<string, LinkHandler>;
    /** Currency column configurations for export */
    currencyColumns?: CurrencyColumnsConfig;
    /** Client-side sortable fields (fields that can't be sorted on server) */
    clientSortFields?: readonly string[];
    /** Custom field mappings for data transformation */
    fieldMappings?: Record<string, string | readonly string[]>;
}

/**
 * View configurations for different contexts
 * Add new contexts here as needed
 */
export const VIEW_CONFIGS: Record<string, ViewContextConfig> = {
    customers: {
        tableName: "Customer",
        entityIdField: "id",
        entityNameField: "name",
        defaultSort: { field: "Customer.name", sort: "asc" },
        linkHandlers: {
            customer: (id: number, tab?: string) => {
                const tabParam = tab ? `?tab=${tab}` : "";
                return `${AppUrls.Customer_DETAILS(id)}${tabParam}`;
            },
        },
        clientSortFields: [
            "no_of_overdue_invoices",
            "total_outstanding_amount",
            "current_category",
            "collection_status",
        ],
        fieldMappings: {
            id: ["id", "customer_id", "Customer.id", "Customer?.id"],
            name: [
                "name",
                "Customer.name",
                "Company.name",
                "Customer?.name",
                "Company?.name",
            ],
            collection_status: [
                "collection_status",
                "Customer.collection_status",
            ],
            type: ["type", "Customer.type"],
            customer_number: ["customer_number", "Customer.customer_number"],
            crn: ["crn", "Customer.crn"],
            category: ["category", "Customer.category", "current_category"],
        },
    },
    disputes: {
        tableName: "Dispute",
        entityIdField: "id",
        entityNameField: "customer_name",
        defaultSort: { field: "Customer.name", sort: "asc" },
        linkHandlers: {
            customer: (id: number, tab?: string) => {
                const tabParam = tab ? `?${tab}` : "";
                return `${AppUrls.Customer_DETAILS(id)}${tabParam}`;
            },
            dispute: (id: number, tab?: string) => {
                // For dispute type, id is the customerId and tab contains the query params
                // Format: "outstanding-activities-tab&openDispute=X"
                // Need to prepend "activeTab=" to make it a valid query string
                const tabParam = tab ? `?activeTab=${tab}` : "";
                return `${AppUrls.Customer_DETAILS(id)}${tabParam}`;
            },
        },
    },
    invoices: {
        tableName: "Invoice",
        entityIdField: "id",
        entityNameField: "invoice_number",
        defaultSort: { field: "invoice_date", sort: "desc" },
        linkHandlers: {
            customer: (id: number) => AppUrls.Customer_DETAILS(id),
            invoice: (id: number) => `${AppUrls.CUSTOMERS}/invoices/${id}`,
        },
    },
    customer_unpaid_invoices: {
        tableName: "Invoice",
        entityIdField: "id",
        entityNameField: "invoice_number",
        defaultSort: { field: "invoice_date", sort: "asc" },
        linkHandlers: {
            customer: (id: number) => AppUrls.Customer_DETAILS(id),
            invoice: (id: number) => `${AppUrls.CUSTOMERS}/invoices/${id}`,
        },
        currencyColumns: {
            customer_amount: {
                amountField: "customer_amount_value",
                currencyField: "customer_amount_currency",
            },
            customer_net_amount: {
                amountField: "customer_net_amount_value",
                currencyField: "customer_net_amount_currency",
            },
            customer_total_paid: {
                amountField: "customer_total_paid_value",
                currencyField: "customer_total_paid_currency",
            },
            customer_outstanding_debt: {
                amountField: "customer_outstanding_debt_value",
                currencyField: "customer_outstanding_debt_currency",
            },
        },
    },
    /** Financial dashboard chart-details invoice drills (not on main Reports menu). */
    dashboard_invoices: {
        tableName: "Invoice",
        entityIdField: "id",
        entityNameField: "invoice_number",
        defaultSort: { field: "invoice_number", sort: "asc" },
        linkHandlers: {
            customer: (id: number) => AppUrls.Customer_DETAILS(id),
            invoice: (id: number) => `${AppUrls.CUSTOMERS}/invoices/${id}`,
        },
        currencyColumns: {
            customer_amount: {
                amountField: "customer_amount_value",
                currencyField: "customer_amount_currency",
            },
            customer_net_amount: {
                amountField: "customer_net_amount_value",
                currencyField: "customer_net_amount_currency",
            },
            customer_total_paid: {
                amountField: "customer_total_paid_value",
                currencyField: "customer_total_paid_currency",
            },
            customer_outstanding_debt: {
                amountField: "customer_outstanding_debt_value",
                currencyField: "customer_outstanding_debt_currency",
            },
        },
    },
    /** Financial dashboard chart-details customer drills (not on main Reports menu). */
    dashboard_customers: {
        tableName: "Customer",
        entityIdField: "id",
        entityNameField: "name",
        defaultSort: { field: "name", sort: "asc" },
        linkHandlers: {
            customer: (id: number, tab?: string) => {
                const tabParam = tab ? `?tab=${tab}` : "";
                return `${AppUrls.Customer_DETAILS(id)}${tabParam}`;
            },
        },
        clientSortFields: [
            "no_of_overdue_invoices",
            "total_outstanding_amount",
            "current_category",
            "collection_status",
        ],
        fieldMappings: {
            id: ["id", "customer_id", "Customer.id", "Customer?.id"],
            name: [
                "name",
                "Customer.name",
                "Company.name",
                "Customer?.name",
                "Company?.name",
            ],
            collection_status: [
                "collection_status",
                "Customer.collection_status",
            ],
            type: ["type", "Customer.type"],
            customer_number: ["customer_number", "Customer.customer_number"],
            crn: ["crn", "Customer.crn"],
            category: ["category", "Customer.category", "current_category"],
        },
    },
    /** Credit dashboard customer detail lists (not on main Reports menu). */
    dashboard_credit_customers: {
        tableName: "Customer",
        entityIdField: "id",
        entityNameField: "name",
        defaultSort: { field: "name", sort: "asc" },
        linkHandlers: {
            customer: (id: number, tab?: string) => {
                const tabParam = tab ? `?tab=${tab}` : "";
                return `${AppUrls.Customer_DETAILS(id)}${tabParam}`;
            },
        },
        fieldMappings: {
            id: ["id", "customer_id", "Customer.id", "Customer?.id"],
            name: [
                "name",
                "Customer.name",
                "Company.name",
                "Customer?.name",
                "Company?.name",
            ],
            customer_number: ["customer_number", "Customer.customer_number"],
            overdue_block: ["overdue_block", "Customer.overdue_block"],
            days_overdue: ["days_overdue", "Customer.days_overdue"],
            total_due_amount: [
                "total_due_amount",
                "Customer.total_due_amount",
            ],
            number_of_overdue_invoices: [
                "number_of_overdue_invoices",
                "Customer.number_of_overdue_invoices",
            ],
        },
    },
    /** Credit dashboard invoice detail lists (not on main Reports menu). */
    dashboard_credit_invoices: {
        tableName: "Invoice",
        entityIdField: "id",
        entityNameField: "invoice_number",
        defaultSort: { field: "invoice_number", sort: "asc" },
        linkHandlers: {
            customer: (id: number) => AppUrls.Customer_DETAILS(id),
            invoice: (id: number) => `${AppUrls.CUSTOMERS}/invoices/${id}`,
        },
        currencyColumns: {
            customer_outstanding_debt: {
                amountField: "customer_outstanding_debt_value",
                currencyField: "customer_outstanding_debt_currency",
            },
            outstanding_debt: {
                amountField: "outstanding_debt_value",
                currencyField: "outstanding_debt_currency",
            },
        },
        fieldMappings: {
            id: ["id", "Invoice.id"],
            invoice_number: ["invoice_number", "Invoice.invoice_number"],
            customer_id: ["customer_id", "Customer.id"],
        },
    },
    /** Financial dashboard chart-details payment drills (not on main Reports menu). */
    dashboard_payments: {
        tableName: "InvoicePayment",
        entityIdField: "id",
        entityNameField: "invoice_number",
        defaultSort: { field: "payment_date", sort: "asc" },
        linkHandlers: {
            customer: (id: number) => AppUrls.Customer_DETAILS(id),
            invoice: (id: number) => `${AppUrls.CUSTOMERS}/invoices/${id}`,
        },
        currencyColumns: {
            amount: {
                amountField: "amount_value",
                currencyField: "amount_currency",
            },
            customer_amount: {
                amountField: "customer_amount_value",
                currencyField: "customer_amount_currency",
            },
        },
        fieldMappings: {
            id: ["id"],
            invoice_number: ["invoice_number", "Invoice.invoice_number"],
            customer_id: ["customer_id", "Customer.id"],
        },
    },
    /** Operation dashboard activity drills (not on main Reports menu). */
    dashboard_activities: {
        tableName: "Activity",
        entityIdField: "id",
        entityNameField: "title",
        defaultSort: { field: "Customer.name", sort: "asc" },
        linkHandlers: {
            customer: (id: number) => AppUrls.Customer_DETAILS(id),
        },
        fieldMappings: {
            id: ["id"],
            customer_id: ["customer_id", "Customer.id"],
            type: ["type", "Activity.type"],
            status: ["status", "Activity.status"],
            title: ["title", "Activity.title"],
            created_at: ["created_at", "Activity.created_at"],
        },
    },
    /** Operation dashboard dispute drills (not on main Reports menu). */
    dashboard_disputes: {
        tableName: "Dispute",
        entityIdField: "id",
        entityNameField: "dispute_number",
        defaultSort: { field: "Customer.name", sort: "asc" },
        linkHandlers: {
            customer: (id: number) => AppUrls.Customer_DETAILS(id),
            dispute: (id: number, tab?: string) => {
                const tabParam = tab ? `?activeTab=${tab}` : "";
                return `${AppUrls.Customer_DETAILS(id)}${tabParam}`;
            },
        },
        fieldMappings: {
            id: ["id"],
            customer_id: ["customer_id", "Customer.id"],
            dispute_status: ["dispute_status", "Dispute.dispute_status"],
            created_at: ["created_at", "Dispute.created_at"],
            closed_at: ["closed_at", "Dispute.closed_at"],
        },
    },
    /** Operation dashboard promises-to-pay drills (not on main Reports menu). */
    dashboard_promises: {
        tableName: "CustomerCollectionPeriod",
        entityIdField: "id",
        entityNameField: "promise_to_pay_date",
        defaultSort: { field: "Customer.name", sort: "asc" },
        linkHandlers: {
            customer: (id: number) => AppUrls.Customer_DETAILS(id),
        },
        currencyColumns: {
            promise_to_pay_amount: {
                amountField: "promise_to_pay_amount",
                currencyField: "currency",
            },
        },
        fieldMappings: {
            id: ["id"],
            customer_id: ["customer_id", "Customer.id"],
            promise_to_pay_date: [
                "promise_to_pay_date",
                "CustomerCollectionPeriod.promise_to_pay_date",
            ],
            promise_to_pay_amount: [
                "promise_to_pay_amount",
                "CustomerCollectionPeriod.promise_to_pay_amount",
            ],
            currency: ["currency", "CustomerCollectionPeriod.currency"],
        },
    },
    customer_contacts: {
        tableName: "Contact",
        entityIdField: "id",
        entityNameField: "full_name",
        defaultSort: { field: "full_name", sort: "asc" },
    },
    customer_banks: {
        tableName: "CustomerBanks",
        entityIdField: "id",
        entityNameField: "bank_name",
        defaultSort: { field: "bank_name", sort: "asc" },
    },
    // Add more contexts as needed
    // agents: { ... },
    // legal: { ... },
} as const;

/**
 * Get configuration for a specific context
 * @param context - Context name (e.g., "customers", "disputes")
 * @returns ViewContextConfig or undefined if not found
 */
export function getViewConfig(context: string): ViewContextConfig | undefined {
    return VIEW_CONFIGS[context];
}

/**
 * Type guard to check if a context is valid
 */
export function isValidContext(
    context: string
): context is keyof typeof VIEW_CONFIGS {
    return context in VIEW_CONFIGS;
}
