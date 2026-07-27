/**
 * Credit dashboard detail-list filter contract.
 *
 * Maps `/credit-dashboard/report?type=…` params to locked report additionalFilters
 * and system report unique_names for ViewBased grids.
 */

import type { Filter } from "@/server/services/ReportExecutionService.types";

export const DASHBOARD_CREDIT_CUSTOMERS_CONTEXT = "dashboard_credit_customers";
export const DASHBOARD_CREDIT_INVOICES_CONTEXT = "dashboard_credit_invoices";

/** Marker expanded server-side into credit portfolio / policy customer scope. */
export const CREDIT_DASHBOARD_CUSTOMER_SCOPE_FILTER_FIELD =
    "__credit_dashboard_customer_scope";

/**
 * Marker expanded server-side into KPI membership (capacity, policy_risk, …).
 * Value encodes membership type (+ optional flags), e.g. `capacity`,
 * `no_policy_exposure`, `no_policy_exposure:0`.
 */
export const CREDIT_DASHBOARD_CUSTOMER_MEMBERSHIP_FILTER_FIELD =
    "__credit_dashboard_customer_membership";

/**
 * Marker expanded server-side into invoice KPI membership (terms / reporting / reported).
 * Value examples: `terms`, `terms:overdue`, `terms:reporting_breach`,
 * `terms:overdue:ctv_payment_term`, `reporting`, `reported`.
 */
export const CREDIT_DASHBOARD_INVOICE_MEMBERSHIP_FILTER_FIELD =
    "__credit_dashboard_invoice_membership";

export const CREDIT_DASHBOARD_CUSTOMER_REPORT_TYPES = [
    "overdue",
    "capacity",
    "policy_risk",
    "limit_warning",
    "zero_limit_warning",
    "top_up",
    "top_up_expiring",
    "no_policy_exposure",
] as const;

export const CREDIT_DASHBOARD_INVOICE_REPORT_TYPES = [
    "terms",
    "reporting",
    "reported",
] as const;

export const CREDIT_DASHBOARD_REPORT_TYPES = [
    ...CREDIT_DASHBOARD_CUSTOMER_REPORT_TYPES,
    ...CREDIT_DASHBOARD_INVOICE_REPORT_TYPES,
] as const;

export type CreditDashboardReportType =
    (typeof CREDIT_DASHBOARD_REPORT_TYPES)[number];

export type CreditDashboardReportGrain = "customers" | "invoices";

export const CREDIT_DASHBOARD_CUSTOMER_SYSTEM_REPORT_UNIQUE_NAMES = {
    overdue: "dashboard_credit_customers_overdue",
    capacity: "dashboard_credit_customers_capacity",
    policy_risk: "dashboard_credit_customers_policy_risk",
    limit_warning: "dashboard_credit_customers_limit_warning",
    zero_limit_warning: "dashboard_credit_customers_zero_limit_warning",
    top_up: "dashboard_credit_customers_top_up",
    top_up_expiring: "dashboard_credit_customers_top_up_expiring",
    no_policy_exposure: "dashboard_credit_customers_no_policy_exposure",
} as const;

export const CREDIT_DASHBOARD_INVOICE_SYSTEM_REPORT_UNIQUE_NAMES = {
    terms: "dashboard_credit_invoices_terms",
    reporting: "dashboard_credit_invoices_reporting",
    reported: "dashboard_credit_invoices_reported",
} as const;

export interface CreditDashboardReportFilterInput {
    type: string;
    policyId?: number | null;
    customerId?: number | null;
    includeNoPolicyExposure?: boolean;
    termsBreachReason?: string | null;
    termsOverdueOnly?: boolean;
    withinDays?: number | null;
    topUpReason?: string | null;
}

export interface CreditDashboardReportFilterResult {
    isCreditDashboard: boolean;
    grain: CreditDashboardReportGrain | null;
    context: string | null;
    systemReportUniqueName: string | null;
    additionalFilters: Filter[];
    /** When true, page should render ViewBased instead of legacy EndlessScroll. */
    useViewBased: boolean;
}

function filter(
    table: string,
    field: string,
    operator: string,
    value: unknown
): Filter {
    return { table, field, operator, value };
}

export function isCreditDashboardReportType(
    type: string
): type is CreditDashboardReportType {
    return (CREDIT_DASHBOARD_REPORT_TYPES as readonly string[]).includes(type);
}

export function isCreditDashboardCustomerReportType(
    type: string
): type is (typeof CREDIT_DASHBOARD_CUSTOMER_REPORT_TYPES)[number] {
    return (CREDIT_DASHBOARD_CUSTOMER_REPORT_TYPES as readonly string[]).includes(
        type
    );
}

export function isCreditDashboardInvoiceReportType(
    type: string
): type is (typeof CREDIT_DASHBOARD_INVOICE_REPORT_TYPES)[number] {
    return (CREDIT_DASHBOARD_INVOICE_REPORT_TYPES as readonly string[]).includes(
        type
    );
}

export function getCreditDashboardReportGrain(
    type: string
): CreditDashboardReportGrain | null {
    if (isCreditDashboardCustomerReportType(type)) {
        return "customers";
    }
    if (isCreditDashboardInvoiceReportType(type)) {
        return "invoices";
    }
    return null;
}

export function getCreditDashboardReportContext(
    type: string
): string | null {
    const grain = getCreditDashboardReportGrain(type);
    if (grain === "customers") {
        return DASHBOARD_CREDIT_CUSTOMERS_CONTEXT;
    }
    if (grain === "invoices") {
        return DASHBOARD_CREDIT_INVOICES_CONTEXT;
    }
    return null;
}

export function getCreditDashboardSystemReportUniqueName(
    type: string
): string | null {
    if (isCreditDashboardCustomerReportType(type)) {
        return CREDIT_DASHBOARD_CUSTOMER_SYSTEM_REPORT_UNIQUE_NAMES[type];
    }
    if (isCreditDashboardInvoiceReportType(type)) {
        return CREDIT_DASHBOARD_INVOICE_SYSTEM_REPORT_UNIQUE_NAMES[type];
    }
    return null;
}

/** Encode policy scope for the customer-scope marker (null = all policies). */
export function encodeCreditDashboardCustomerScopeValue(
    policyId?: number | null
): string {
    return policyId != null ? String(policyId) : "all";
}

export function parseCreditDashboardCustomerScopeValue(
    value: unknown
): number | undefined {
    if (value == null || value === "" || value === "all") {
        return undefined;
    }
    const n =
        typeof value === "number" ? value : Number.parseInt(String(value), 10);
    return Number.isFinite(n) ? n : undefined;
}

function customerScopeMarker(policyId?: number | null): Filter {
    return filter(
        "Customer",
        CREDIT_DASHBOARD_CUSTOMER_SCOPE_FILTER_FIELD,
        "equals",
        encodeCreditDashboardCustomerScopeValue(policyId)
    );
}

function customerMembershipMarker(value: string): Filter {
    return filter(
        "Customer",
        CREDIT_DASHBOARD_CUSTOMER_MEMBERSHIP_FILTER_FIELD,
        "equals",
        value
    );
}

function optionalCustomerIdFilter(
    customerId?: number | null
): Filter[] {
    if (customerId == null) {
        return [];
    }
    return [filter("Customer", "id", "equals", customerId)];
}

function overdueFilters(input: CreditDashboardReportFilterInput): Filter[] {
    return [
        customerScopeMarker(input.policyId),
        filter("Customer", "overdue_block", "equals", true),
        ...optionalCustomerIdFilter(input.customerId),
    ];
}

function customerMembershipFilters(
    input: CreditDashboardReportFilterInput,
    membershipValue: string
): Filter[] {
    return [
        customerScopeMarker(input.policyId),
        customerMembershipMarker(membershipValue),
        ...optionalCustomerIdFilter(input.customerId),
    ];
}

export function encodeNoPolicyExposureMembershipValue(
    includeNoPolicyExposure?: boolean
): string {
    return includeNoPolicyExposure === false
        ? "no_policy_exposure:0"
        : "no_policy_exposure";
}

export function parseCreditDashboardCustomerMembershipValue(
    value: unknown
): {
    type:
        | "capacity"
        | "policy_risk"
        | "limit_warning"
        | "zero_limit_warning"
        | "no_policy_exposure"
        | "top_up"
        | "top_up_expiring"
        | null;
    includeNoPolicyExposure: boolean;
    withinDays: number | null;
} {
    const raw = value == null ? "" : String(value);
    if (
        raw === "capacity" ||
        raw === "policy_risk" ||
        raw === "limit_warning" ||
        raw === "zero_limit_warning" ||
        raw === "top_up"
    ) {
        return {
            type: raw,
            includeNoPolicyExposure: true,
            withinDays: null,
        };
    }
    if (raw === "no_policy_exposure") {
        return {
            type: "no_policy_exposure",
            includeNoPolicyExposure: true,
            withinDays: null,
        };
    }
    if (raw === "no_policy_exposure:0") {
        return {
            type: "no_policy_exposure",
            includeNoPolicyExposure: false,
            withinDays: null,
        };
    }
    if (raw === "top_up_expiring") {
        return {
            type: "top_up_expiring",
            includeNoPolicyExposure: true,
            withinDays: 30,
        };
    }
    if (raw.startsWith("top_up_expiring:")) {
        const days = Number.parseInt(raw.slice("top_up_expiring:".length), 10);
        return {
            type: "top_up_expiring",
            includeNoPolicyExposure: true,
            withinDays: Number.isFinite(days) ? Math.max(1, days) : 30,
        };
    }
    return {
        type: null,
        includeNoPolicyExposure: true,
        withinDays: null,
    };
}

export function encodeTopUpExpiringMembershipValue(
    withinDays?: number | null
): string {
    const days =
        withinDays != null && Number.isFinite(withinDays)
            ? Math.max(1, Math.trunc(withinDays))
            : 30;
    return `top_up_expiring:${days}`;
}

export function encodeCreditDashboardInvoiceMembershipValue(input: {
    type: "terms" | "reporting" | "reported";
    termsBreachReason?: string | null;
    termsOverdueOnly?: boolean;
}): string {
    if (input.type === "reporting" || input.type === "reported") {
        return input.type;
    }
    const parts = ["terms"];
    if (input.termsOverdueOnly) {
        parts.push("overdue");
    }
    if (input.termsBreachReason) {
        parts.push(input.termsBreachReason);
    }
    return parts.join(":");
}

export function parseCreditDashboardInvoiceMembershipValue(
    value: unknown
): {
    type: "terms" | "reporting" | "reported" | null;
    termsBreachReason: string | null;
    termsOverdueOnly: boolean;
} {
    const raw = value == null ? "" : String(value);
    if (raw === "reporting" || raw === "reported") {
        return {
            type: raw,
            termsBreachReason: null,
            termsOverdueOnly: false,
        };
    }
    if (raw === "terms") {
        return {
            type: "terms",
            termsBreachReason: null,
            termsOverdueOnly: false,
        };
    }
    if (raw.startsWith("terms:")) {
        const rest = raw.slice("terms:".length);
        const segments = rest.split(":").filter(Boolean);
        let termsOverdueOnly = false;
        let termsBreachReason: string | null = null;
        for (const seg of segments) {
            if (seg === "overdue") {
                termsOverdueOnly = true;
            } else {
                termsBreachReason = seg;
            }
        }
        return { type: "terms", termsBreachReason, termsOverdueOnly };
    }
    return {
        type: null,
        termsBreachReason: null,
        termsOverdueOnly: false,
    };
}

function invoiceMembershipFilters(
    input: CreditDashboardReportFilterInput,
    membershipValue: string
): Filter[] {
    const filters: Filter[] = [
        filter(
            "Invoice",
            CREDIT_DASHBOARD_INVOICE_MEMBERSHIP_FILTER_FIELD,
            "equals",
            membershipValue
        ),
    ];
    if (input.policyId != null) {
        filters.push(
            filter("Invoice", "policy_id", "equals", input.policyId)
        );
    }
    if (input.customerId != null) {
        filters.push(
            filter("Invoice", "customer_id", "equals", input.customerId)
        );
    }
    return filters;
}

/**
 * Build locked additionalFilters for credit dashboard report types.
 * ViewBased-ready: overdue + customer KPIs + invoice types (slices 1–3).
 * Top-up types are ViewBased-ready (slice 4).
 */
export function buildCreditDashboardReportFilters(
    input: CreditDashboardReportFilterInput
): CreditDashboardReportFilterResult {
    if (!isCreditDashboardReportType(input.type)) {
        return {
            isCreditDashboard: false,
            grain: null,
            context: null,
            systemReportUniqueName: null,
            additionalFilters: [],
            useViewBased: false,
        };
    }

    const grain = getCreditDashboardReportGrain(input.type)!;
    const context = getCreditDashboardReportContext(input.type)!;
    const systemReportUniqueName =
        getCreditDashboardSystemReportUniqueName(input.type)!;

    if (input.type === "overdue") {
        return {
            isCreditDashboard: true,
            grain,
            context,
            systemReportUniqueName,
            additionalFilters: overdueFilters(input),
            useViewBased: true,
        };
    }

    if (
        input.type === "capacity" ||
        input.type === "policy_risk" ||
        input.type === "limit_warning" ||
        input.type === "zero_limit_warning"
    ) {
        return {
            isCreditDashboard: true,
            grain,
            context,
            systemReportUniqueName,
            additionalFilters: customerMembershipFilters(
                input,
                input.type
            ),
            useViewBased: true,
        };
    }

    if (input.type === "no_policy_exposure") {
        return {
            isCreditDashboard: true,
            grain,
            context,
            systemReportUniqueName,
            additionalFilters: customerMembershipFilters(
                input,
                encodeNoPolicyExposureMembershipValue(
                    input.includeNoPolicyExposure
                )
            ),
            useViewBased: true,
        };
    }

    if (input.type === "top_up") {
        return {
            isCreditDashboard: true,
            grain,
            context,
            systemReportUniqueName,
            additionalFilters: customerMembershipFilters(input, "top_up"),
            useViewBased: true,
        };
    }

    if (input.type === "top_up_expiring") {
        return {
            isCreditDashboard: true,
            grain,
            context,
            systemReportUniqueName,
            additionalFilters: customerMembershipFilters(
                input,
                encodeTopUpExpiringMembershipValue(input.withinDays)
            ),
            useViewBased: true,
        };
    }

    if (
        input.type === "terms" ||
        input.type === "reporting" ||
        input.type === "reported"
    ) {
        return {
            isCreditDashboard: true,
            grain,
            context,
            systemReportUniqueName,
            additionalFilters: invoiceMembershipFilters(
                input,
                encodeCreditDashboardInvoiceMembershipValue({
                    type: input.type,
                    termsBreachReason: input.termsBreachReason,
                    termsOverdueOnly: input.termsOverdueOnly,
                })
            ),
            useViewBased: true,
        };
    }

    return {
        isCreditDashboard: true,
        grain,
        context,
        systemReportUniqueName,
        additionalFilters: [],
        useViewBased: false,
    };
}

export function shouldUseCreditDashboardViewBased(
    input: CreditDashboardReportFilterInput
): boolean {
    return buildCreditDashboardReportFilters(input).useViewBased;
}
