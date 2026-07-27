/**
 * Virtual Field Registry
 *
 * Defines computed/virtual fields that don't exist directly in the database
 * but are derived from relations or computed values.
 */

import { SpecialFieldHandler } from "./ReportExecutionService.helpers";
import { getActiveCustomerPolicyRow } from "@/server/utils/reportCustomerPolicyFields";

/** Calendar-day age past due_date (0 when not yet overdue). Matches chart-details. */
export function calculateDaysOverdue(
    dueDate: Date | string | null | undefined,
    now = new Date()
): number | null {
    if (dueDate == null) return null;
    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) return null;
    return Math.max(
        0,
        Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
    );
}

/** Calendar days until due_date (can be negative if overdue). Matches chart-details. */
export function calculateDaysUntilDue(
    dueDate: Date | string | null | undefined,
    now = new Date()
): number | null {
    if (dueDate == null) return null;
    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) return null;
    return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** Non-negative calendar days remaining until date (0 when past). */
export function calculateDaysLeft(
    endDate: Date | string | null | undefined,
    now = new Date()
): number | null {
    if (endDate == null) return null;
    const end = new Date(endDate);
    if (Number.isNaN(end.getTime())) return null;
    return Math.max(
        0,
        Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );
}

export function extractTermsBreachReasonCodes(row: {
    reporting_breach?: boolean | null;
    ctv_payment_term?: boolean | null;
    ctv_customer_overdue_mep?: boolean | null;
    ctv_outdated_dcl?: boolean | null;
    ctv_invoice_after_policy_end?: boolean | null;
}): string {
    const codes: string[] = [];
    if (row.reporting_breach) {
        codes.push("reporting_breach");
    }
    if (row.ctv_payment_term) {
        codes.push("ctv_payment_term");
    }
    if (row.ctv_customer_overdue_mep) {
        codes.push("ctv_customer_overdue_mep");
    }
    if (row.ctv_outdated_dcl) {
        codes.push("ctv_outdated_dcl");
    }
    if (row.ctv_invoice_after_policy_end) {
        codes.push("ctv_invoice_after_policy_end");
    }
    return codes.join(" · ");
}

/** Maps DB-style terms breach codes to customers.credit_insurance_violations.causes keys. */
export const TERMS_BREACH_CODE_TO_I18N_CAUSE: Record<string, string> = {
    reporting_breach: "reporting_breach",
    ctv_payment_term: "payment_term",
    ctv_customer_overdue_mep: "customer_overdue_mep",
    ctv_outdated_dcl: "outdated_dcl",
    ctv_invoice_after_policy_end: "invoice_after_policy_end",
};

/** Display labels aligned with locales EN/HE customers.json credit_insurance_violations.causes. */
const TERMS_BREACH_CAUSE_LABELS: Record<"en" | "he", Record<string, string>> = {
    en: {
        reporting_breach: "Reporting breach",
        payment_term: "Payment term violation",
        customer_overdue_mep: "Customer overdue (MEP) at creation",
        excluded_from_policy: "Customer excluded from policy at creation",
        outdated_dcl: "Outdated DCL at creation",
        invoice_after_policy_end: "Invoice dated after policy end",
    },
    he: {
        reporting_breach: "חריגת דיווח",
        payment_term: "הפרת תנאי תשלום",
        customer_overdue_mep: "לקוח בפיגור MEP בעת יצירה",
        excluded_from_policy: "לקוח מוחרג מהפוליסה בעת יצירה",
        outdated_dcl: "DCL לא עדכני בעת יצירה",
        invoice_after_policy_end: "חשבונית לאחר סיום הפוליסה",
    },
};

/**
 * Resolves account/UI language ("English", "Hebrew", "he", etc.) to report label language.
 */
export function resolveAccountDisplayLanguage(
    language?: string | null
): "en" | "he" {
    const normalized = language?.toLowerCase()?.trim() ?? "";
    if (
        normalized === "he" ||
        normalized === "hebrew" ||
        normalized === "עברית"
    ) {
        return "he";
    }
    return "en";
}

/**
 * Formats a joined terms-breach code string (from {@link extractTermsBreachReasonCodes})
 * into localized labels for report grid display.
 * Uses account language when provided; otherwise falls back to locale.
 */
export function formatTermsBreachReasonForDisplay(
    codesJoined: string | null | undefined,
    locale?: string,
    accountLanguage?: string | null
): string {
    if (codesJoined == null || String(codesJoined).trim() === "") {
        return "";
    }
    const language =
        accountLanguage != null && String(accountLanguage).trim() !== ""
            ? resolveAccountDisplayLanguage(accountLanguage)
            : ((locale?.split("-")[0] === "he" ? "he" : "en") as "en" | "he");
    const labels = TERMS_BREACH_CAUSE_LABELS[language];
    return String(codesJoined)
        .split(" · ")
        .map((code) => {
            const trimmed = code.trim();
            if (!trimmed) {
                return "";
            }
            const causeKey =
                TERMS_BREACH_CODE_TO_I18N_CAUSE[trimmed] ?? trimmed;
            return labels[causeKey] ?? trimmed;
        })
        .filter(Boolean)
        .join(" · ");
}

export function extractCallDirectionFromTitleParams(
    titleParams: unknown
): string | null {
    if (!titleParams || typeof titleParams !== "object") return null;
    const callType = String(
        (titleParams as { callType?: unknown }).callType ?? ""
    ).toLowerCase();
    if (callType === "incoming" || callType === "outgoing") {
        return callType;
    }
    return null;
}

export interface VirtualFieldConfig {
    /** The table this virtual field belongs to (e.g., "Customer") */
    table: string;
    /** The field name (e.g., "category", "parent_customer_name") */
    field: string;
    /** The relation name this field comes from (e.g., "CustomerCollectionPeriod", "ParentCustomer") */
    relationName: string;
    /** The actual field in the relation (for one-to-many relations) */
    relationField?: string;
    /** Type of relation */
    relationType: "one-to-many" | "many-to-one" | "computed";
    /** Function to extract the value from a row */
    extractor: (row: any) => any;
    /** Whether sorting requires in-memory processing */
    requiresInMemorySort: boolean;
}

/**
 * Registry of all virtual/computed fields
 */
export const VIRTUAL_FIELD_REGISTRY: VirtualFieldConfig[] = [
    {
        table: "Customer",
        field: "category",
        relationName: "CustomerCollectionPeriod",
        relationField: "current_category",
        relationType: "one-to-many",
        extractor: (row: any) => {
            if (
                row.CustomerCollectionPeriod &&
                Array.isArray(row.CustomerCollectionPeriod) &&
                row.CustomerCollectionPeriod.length > 0
            ) {
                return row.CustomerCollectionPeriod[0].current_category || null;
            }
            return null;
        },
        requiresInMemorySort: true,
    },
    {
        table: "Customer",
        field: "parent_customer_name",
        relationName: "ParentCustomer",
        relationType: "computed",
        extractor: (row: any) =>
            SpecialFieldHandler.extractParentCustomerName(row),
        requiresInMemorySort: true,
    },
    {
        table: "Customer",
        field: "name",
        relationName: "Company",
        relationType: "many-to-one",
        extractor: (row: any) =>
            SpecialFieldHandler.extractCustomerName(row, "name"),
        // Name is derived from Company or Person; Prisma cannot order by both.
        requiresInMemorySort: true,
    },
    {
        table: "Customer",
        field: "company_number",
        relationName: "Company",
        relationType: "many-to-one",
        extractor: (row: any) =>
            SpecialFieldHandler.extractCustomerName(row, "company_number"),
        requiresInMemorySort: false, // Can use Prisma orderBy directly
    },
    // Dispute table: dispute_number is an alias for id
    {
        table: "Dispute",
        field: "dispute_number",
        relationName: "", // No relation, it's just the id field
        relationType: "computed",
        extractor: (row: any) => row.id,
        requiresInMemorySort: false,
    },
    // Dispute table: Customer.name virtual field - needs special nested sorting
    // When sorting by Customer.name from Dispute, we need orderBy: { Customer: { Company: { name: "asc" } } }
    {
        table: "Dispute",
        field: "Customer.name",
        relationName: "Customer",
        relationField: "Company.name", // Special nested relation
        relationType: "many-to-one",
        extractor: (row: any) => row.Customer?.Company?.name || null,
        requiresInMemorySort: true, // Use in-memory sort due to nested relation complexity
    },
    // Dispute table: dispute_reason from DisputeReason relation
    {
        table: "Dispute",
        field: "dispute_reason",
        relationName: "DisputeReason",
        relationField: "name", // Sort by DisputeReason.name
        relationType: "many-to-one",
        extractor: (row: any) => row.DisputeReason?.name || null,
        requiresInMemorySort: false, // Can sort by relation
    },
    // Dispute table: assigned_to from User relation
    {
        table: "Dispute",
        field: "assigned_to",
        relationName: "User_CustomerDispute_owner_idToUser",
        relationField: "name", // Sort by User.name
        relationType: "many-to-one",
        extractor: (row: any) =>
            row.User_CustomerDispute_owner_idToUser?.name || null,
        requiresInMemorySort: false, // Can sort by relation
    },
    // Dispute table: amount_in_dispute is computed from DisputeInvoice
    {
        table: "Dispute",
        field: "amount_in_dispute",
        relationName: "DisputeInvoice",
        relationType: "computed",
        extractor: (row: any) => {
            if (row.DisputeInvoice && Array.isArray(row.DisputeInvoice)) {
                return row.DisputeInvoice.reduce((sum: number, di: any) => {
                    const debt = di.Invoice?.outstanding_debt || 0;
                    return sum + (typeof debt === "number" ? debt : 0);
                }, 0);
            }
            return 0;
        },
        requiresInMemorySort: true, // Computed field, requires in-memory sort
    },
    // Dispute table: days_past_due is computed from oldest invoice due date
    {
        table: "Dispute",
        field: "days_past_due",
        relationName: "DisputeInvoice",
        relationType: "computed",
        extractor: (row: any) => {
            if (row.DisputeInvoice && Array.isArray(row.DisputeInvoice)) {
                const invoiceDueDates = row.DisputeInvoice.map(
                    (di: any) => di.Invoice?.due_date
                )
                    .filter((date: any) => date !== null && date !== undefined)
                    .map((date: any) => new Date(date));

                if (invoiceDueDates.length > 0) {
                    const oldestDueDate = new Date(
                        Math.min(
                            ...invoiceDueDates.map((d: Date) => d.getTime())
                        )
                    );
                    const today = new Date();
                    const diffTime = today.getTime() - oldestDueDate.getTime();
                    const diffDays = Math.ceil(
                        diffTime / (1000 * 60 * 60 * 24)
                    );
                    return diffDays > 0 ? diffDays : 0;
                }
            }
            return null;
        },
        requiresInMemorySort: true, // Computed field, requires in-memory sort
    },
    // Dispute table: Customer.customer_number - for sorting disputes by customer code
    {
        table: "Dispute",
        field: "Customer.customer_number",
        relationName: "Customer",
        relationField: "customer_number",
        relationType: "many-to-one",
        extractor: (row: any) => row.Customer?.customer_number || null,
        requiresInMemorySort: false, // Can use nested Prisma orderBy
    },
    // Dispute table: Customer.category - for sorting disputes by customer category
    {
        table: "Dispute",
        field: "Customer.category",
        relationName: "Customer",
        relationField: "category",
        relationType: "computed",
        extractor: (row: any) => {
            const collPeriod = row.Customer?.CustomerCollectionPeriod;
            if (
                collPeriod &&
                Array.isArray(collPeriod) &&
                collPeriod.length > 0
            ) {
                return collPeriod[0].current_category || null;
            }
            return null;
        },
        requiresInMemorySort: true, // Category is a computed field from CustomerCollectionPeriod
    },

    // ============================================================
    // Invoice table - virtual fields for Customer relation sorting
    // ============================================================
    {
        table: "Invoice",
        field: "Customer.name",
        relationName: "Customer",
        relationField: "Company.name",
        relationType: "many-to-one",
        extractor: (row: any) => row.Customer?.Company?.name || null,
        requiresInMemorySort: true, // Nested relation requires in-memory sort
    },
    {
        table: "Invoice",
        field: "Customer.customer_number",
        relationName: "Customer",
        relationField: "customer_number",
        relationType: "many-to-one",
        extractor: (row: any) => row.Customer?.customer_number || null,
        requiresInMemorySort: false, // Can use nested Prisma orderBy
    },
    {
        table: "Invoice",
        field: "Customer.category",
        relationName: "Customer",
        relationField: "category",
        relationType: "computed",
        extractor: (row: any) => {
            const collPeriod = row.Customer?.CustomerCollectionPeriod;
            if (
                collPeriod &&
                Array.isArray(collPeriod) &&
                collPeriod.length > 0
            ) {
                return collPeriod[0].current_category || null;
            }
            return null;
        },
        requiresInMemorySort: true, // Category is a computed field
    },
    {
        table: "Invoice",
        field: "days_overdue",
        relationName: "",
        relationType: "computed",
        extractor: (row: any) => calculateDaysOverdue(row.due_date),
        requiresInMemorySort: true,
    },
    {
        table: "Invoice",
        field: "days_until_due",
        relationName: "",
        relationType: "computed",
        extractor: (row: any) => calculateDaysUntilDue(row.due_date),
        requiresInMemorySort: true,
    },
    {
        table: "Invoice",
        field: "days_left_for_reporting",
        relationName: "",
        relationType: "computed",
        extractor: (row: any) =>
            calculateDaysLeft(row.target_reporting_date),
        requiresInMemorySort: true,
    },
    {
        table: "Invoice",
        field: "terms_breach_reason",
        relationName: "",
        relationType: "computed",
        extractor: (row: any) => extractTermsBreachReasonCodes(row),
        requiresInMemorySort: true,
    },
    {
        table: "Customer",
        field: "days_overdue",
        relationName: "",
        relationType: "computed",
        extractor: (row: any) =>
            calculateDaysOverdue(row.oldest_invoice_overdue_date),
        requiresInMemorySort: true,
    },
    {
        table: "Customer",
        field: "limit_expires_in_days",
        relationName: "CustomerPolicy",
        relationType: "computed",
        extractor: (row: any) => {
            const policy = getActiveCustomerPolicyRow(row);
            return calculateDaysLeft(
                (policy?.approved_limit_expiration_date as
                    | Date
                    | string
                    | null
                    | undefined) ?? null
            );
        },
        requiresInMemorySort: true,
    },
    {
        table: "Activity",
        field: "call_time",
        relationName: "",
        relationType: "computed",
        extractor: (row: any) =>
            row.actual_delivery_time || row.created_at || null,
        requiresInMemorySort: true,
    },
    {
        table: "Activity",
        field: "call_direction",
        relationName: "",
        relationType: "computed",
        extractor: (row: any) =>
            extractCallDirectionFromTitleParams(row.title_params),
        requiresInMemorySort: true,
    },

    // ============================================================
    // Contact table - virtual fields for Customer relation sorting
    // ============================================================
    {
        table: "Contact",
        field: "Customer.name",
        relationName: "Customer",
        relationField: "Company.name",
        relationType: "many-to-one",
        extractor: (row: any) => row.Customer?.Company?.name || null,
        requiresInMemorySort: true, // Nested relation requires in-memory sort
    },
    {
        table: "Contact",
        field: "Customer.customer_number",
        relationName: "Customer",
        relationField: "customer_number",
        relationType: "many-to-one",
        extractor: (row: any) => row.Customer?.customer_number || null,
        requiresInMemorySort: false, // Can use nested Prisma orderBy
    },
    {
        table: "Contact",
        field: "Customer.category",
        relationName: "Customer",
        relationField: "category",
        relationType: "computed",
        extractor: (row: any) => {
            const collPeriod = row.Customer?.CustomerCollectionPeriod;
            if (
                collPeriod &&
                Array.isArray(collPeriod) &&
                collPeriod.length > 0
            ) {
                return collPeriod[0].current_category || null;
            }
            return null;
        },
        requiresInMemorySort: true, // Category is a computed field
    },

    // ============================================================
    // Activity table - virtual fields for Customer relation sorting
    // ============================================================
    {
        table: "Activity",
        field: "Customer.name",
        relationName: "Customer",
        relationField: "Company.name",
        relationType: "many-to-one",
        extractor: (row: any) => row.Customer?.Company?.name || null,
        requiresInMemorySort: true, // Nested relation requires in-memory sort
    },
    {
        table: "Activity",
        field: "Customer.customer_number",
        relationName: "Customer",
        relationField: "customer_number",
        relationType: "many-to-one",
        extractor: (row: any) => row.Customer?.customer_number || null,
        requiresInMemorySort: false, // Can use nested Prisma orderBy
    },
    {
        table: "Activity",
        field: "Customer.category",
        relationName: "Customer",
        relationField: "category",
        relationType: "computed",
        extractor: (row: any) => {
            const collPeriod = row.Customer?.CustomerCollectionPeriod;
            if (
                collPeriod &&
                Array.isArray(collPeriod) &&
                collPeriod.length > 0
            ) {
                return collPeriod[0].current_category || null;
            }
            return null;
        },
        requiresInMemorySort: true, // Category is a computed field
    },

    // ============================================================
    // Payment table - virtual fields for Customer relation sorting
    // (Payment is typically joined to Invoice, which has Customer)
    // ============================================================
    {
        table: "Payment",
        field: "Customer.name",
        relationName: "Customer",
        relationField: "Company.name",
        relationType: "many-to-one",
        extractor: (row: any) =>
            row.Customer?.Company?.name ||
            row.Invoice?.Customer?.Company?.name ||
            null,
        requiresInMemorySort: true, // Nested relation requires in-memory sort
    },
    {
        table: "Payment",
        field: "Customer.customer_number",
        relationName: "Customer",
        relationField: "customer_number",
        relationType: "many-to-one",
        extractor: (row: any) =>
            row.Customer?.customer_number ||
            row.Invoice?.Customer?.customer_number ||
            null,
        requiresInMemorySort: true, // May need to traverse through Invoice
    },
    // ============================================================
    // InvoicePayment - Customer / Invoice relation fields
    // ============================================================
    {
        table: "InvoicePayment",
        field: "Customer.name",
        relationName: "Customer",
        relationField: "Company.name",
        relationType: "many-to-one",
        extractor: (row: any) =>
            row.Customer?.Company?.name ||
            (row.Customer?.Person
                ? `${row.Customer.Person.first_name || ""} ${row.Customer.Person.last_name || ""}`.trim()
                : null) ||
            null,
        requiresInMemorySort: true,
    },
    {
        table: "InvoicePayment",
        field: "Invoice.status",
        relationName: "Invoice",
        relationField: "status",
        relationType: "many-to-one",
        extractor: (row: any) => row.Invoice?.status || null,
        requiresInMemorySort: false,
    },
    // ============================================================
    // CustomerCollectionPeriod - Customer relation fields
    // ============================================================
    {
        table: "CustomerCollectionPeriod",
        field: "Customer.name",
        relationName: "Customer",
        relationField: "Company.name",
        relationType: "many-to-one",
        extractor: (row: any) =>
            row.Customer?.Company?.name ||
            (row.Customer?.Person
                ? `${row.Customer.Person.first_name || ""} ${row.Customer.Person.last_name || ""}`.trim()
                : null) ||
            null,
        requiresInMemorySort: true,
    },
    {
        table: "CustomerCollectionPeriod",
        field: "Customer.customer_number",
        relationName: "Customer",
        relationField: "customer_number",
        relationType: "many-to-one",
        extractor: (row: any) => row.Customer?.customer_number || null,
        requiresInMemorySort: false,
    },
    // Invoice table: status is virtual, from InvoiceStatus.name
    // (Obsolete: status is now a direct field in Invoice table)
];

/**
 * Get virtual field configuration for a given table and field
 */
export function getVirtualFieldConfig(
    table: string,
    field: string
): VirtualFieldConfig | undefined {
    return VIRTUAL_FIELD_REGISTRY.find(
        (config) => config.table === table && config.field === field
    );
}

/**
 * Check if a field is a virtual/computed field
 */
export function isVirtualField(table: string, field: string): boolean {
    return getVirtualFieldConfig(table, field) !== undefined;
}

/**
 * Get all virtual fields for a given table
 */
export function getVirtualFieldsForTable(table: string): VirtualFieldConfig[] {
    return VIRTUAL_FIELD_REGISTRY.filter((config) => config.table === table);
}
