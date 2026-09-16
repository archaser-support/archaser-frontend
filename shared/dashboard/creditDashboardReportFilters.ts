/**
 * Credit dashboard detail-list filter contract.
 *
 * Maps `/credit-dashboard/report?type=…` params to locked report additionalFilters
 * and system report unique_names for ViewBased grids.
 */

import type { Filter } from "@/types/reports";

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
    "utilization_bin",
    "ar_extreme_moves",
    "utilization_overshoot",
    "limit_capped",
    "negative_daily_cost",
    "exposure_reconciliation",
    "policy_concentration",
    "limit_breach_forecast",
    "breach_dilution",
    "breach_episodes",
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
    utilization_bin: "dashboard_credit_customers_utilization_bin",
    ar_extreme_moves: "dashboard_credit_customers_ar_extreme_moves",
    utilization_overshoot: "dashboard_credit_customers_utilization_overshoot",
    limit_capped: "dashboard_credit_customers_limit_capped",
    negative_daily_cost: "dashboard_credit_customers_negative_daily_cost",
    exposure_reconciliation:
        "dashboard_credit_customers_exposure_reconciliation",
    policy_concentration: "dashboard_credit_customers_policy_concentration",
    limit_breach_forecast: "dashboard_credit_customers_limit_breach_forecast",
    breach_dilution: "dashboard_credit_customers_breach_dilution",
    breach_episodes: "dashboard_credit_customers_breach_episodes",
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
    /** utilization_bin key, e.g. 100_110 */
    utilizationBin?: string | null;
    /**
     * YYYY-MM-DD range for utilization_bin / ar_extreme_moves /
     * utilization_overshoot / limit_capped / negative_daily_cost / exposure_reconciliation
     * (period average).
     * Legacy callers may still pass only asOfDate (treated as from=to).
     */
    fromDate?: string | null;
    toDate?: string | null;
    /** @deprecated Prefer fromDate/toDate. Single-day snapshot for utilization_bin. */
    asOfDate?: string | null;
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

export function encodeUtilizationBinMembershipValue(options: {
    bin: string;
    fromDate: string;
    toDate: string;
    /** @deprecated Prefer fromDate/toDate. */
    asOfDate?: string;
    includeNoPolicyExposure?: boolean;
}): string {
    const fromDate = options.fromDate || options.asOfDate || "";
    const toDate = options.toDate || options.asOfDate || fromDate;
    const base = `utilization_bin:${options.bin}:${fromDate}:${toDate}`;
    return options.includeNoPolicyExposure === false ? `${base}:0` : base;
}

export function encodeArExtremeMovesMembershipValue(options: {
    fromDate: string;
    toDate: string;
    includeNoPolicyExposure?: boolean;
}): string {
    const base = `ar_extreme_moves:${options.fromDate}:${options.toDate}`;
    return options.includeNoPolicyExposure === false ? `${base}:0` : base;
}

export function encodeUtilizationOvershootMembershipValue(options: {
    fromDate: string;
    toDate: string;
    includeNoPolicyExposure?: boolean;
}): string {
    const base = `utilization_overshoot:${options.fromDate}:${options.toDate}`;
    return options.includeNoPolicyExposure === false ? `${base}:0` : base;
}

export function encodeLimitCappedMembershipValue(options: {
    fromDate: string;
    toDate: string;
    includeNoPolicyExposure?: boolean;
}): string {
    const base = `limit_capped:${options.fromDate}:${options.toDate}`;
    return options.includeNoPolicyExposure === false ? `${base}:0` : base;
}

export function encodeNegativeDailyCostMembershipValue(options: {
    fromDate: string;
    toDate: string;
    includeNoPolicyExposure?: boolean;
}): string {
    const base = `negative_daily_cost:${options.fromDate}:${options.toDate}`;
    return options.includeNoPolicyExposure === false ? `${base}:0` : base;
}

export function encodeExposureReconciliationMembershipValue(options: {
    fromDate: string;
    toDate: string;
    includeNoPolicyExposure?: boolean;
}): string {
    const base = `exposure_reconciliation:${options.fromDate}:${options.toDate}`;
    return options.includeNoPolicyExposure === false ? `${base}:0` : base;
}

export function encodePolicyConcentrationMembershipValue(options: {
    fromDate: string;
    toDate: string;
    includeNoPolicyExposure?: boolean;
}): string {
    const base = `policy_concentration:${options.fromDate}:${options.toDate}`;
    return options.includeNoPolicyExposure === false ? `${base}:0` : base;
}

export function encodeLimitBreachForecastMembershipValue(options?: {
    includeNoPolicyExposure?: boolean;
}): string {
    return options?.includeNoPolicyExposure === false
        ? "limit_breach_forecast:0"
        : "limit_breach_forecast";
}

export function encodeBreachDilutionMembershipValue(options: {
    fromDate: string;
    toDate: string;
    includeNoPolicyExposure?: boolean;
}): string {
    const base = `breach_dilution:${options.fromDate}:${options.toDate}`;
    return options.includeNoPolicyExposure === false ? `${base}:0` : base;
}

export function encodeBreachEpisodesMembershipValue(options: {
    fromDate: string;
    toDate: string;
    includeNoPolicyExposure?: boolean;
}): string {
    const base = `breach_episodes:${options.fromDate}:${options.toDate}`;
    return options.includeNoPolicyExposure === false ? `${base}:0` : base;
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
        | "utilization_bin"
        | "ar_extreme_moves"
        | "utilization_overshoot"
        | "limit_capped"
        | "negative_daily_cost"
        | "exposure_reconciliation"
        | "policy_concentration"
        | "limit_breach_forecast"
        | "breach_dilution"
        | "breach_episodes"
        | null;
    includeNoPolicyExposure: boolean;
    withinDays: number | null;
    utilizationBin: string | null;
    fromDate: string | null;
    toDate: string | null;
    /** Same as toDate for utilization_bin (legacy field). */
    asOfDate: string | null;
} {
    const empty = {
        type: null as null,
        includeNoPolicyExposure: true,
        withinDays: null as number | null,
        utilizationBin: null as string | null,
        fromDate: null as string | null,
        toDate: null as string | null,
        asOfDate: null as string | null,
    };
    const raw = value == null ? "" : String(value);
    if (
        raw === "capacity" ||
        raw === "policy_risk" ||
        raw === "limit_warning" ||
        raw === "zero_limit_warning" ||
        raw === "top_up"
    ) {
        return { ...empty, type: raw };
    }
    if (raw === "no_policy_exposure") {
        return { ...empty, type: "no_policy_exposure" };
    }
    if (raw === "no_policy_exposure:0") {
        return {
            ...empty,
            type: "no_policy_exposure",
            includeNoPolicyExposure: false,
        };
    }
    if (raw === "top_up_expiring") {
        return { ...empty, type: "top_up_expiring", withinDays: 30 };
    }
    if (raw.startsWith("top_up_expiring:")) {
        const days = Number.parseInt(raw.slice("top_up_expiring:".length), 10);
        return {
            ...empty,
            type: "top_up_expiring",
            withinDays: Number.isFinite(days) ? Math.max(1, days) : 30,
        };
    }
    if (raw.startsWith("utilization_bin:")) {
        const parts = raw.split(":");
        const bin = parts[1] ?? "";
        const dateA = parts[2] ?? "";
        const dateB = parts[3] ?? "";
        const ymd = /^\d{4}-\d{2}-\d{2}$/;
        // New: utilization_bin:<bin>:<from>:<to>[:0]
        // Legacy: utilization_bin:<bin>:<asOf>[:0]
        if (ymd.test(dateA) && ymd.test(dateB)) {
            const excludeFlag = parts[4];
            return {
                type: "utilization_bin",
                includeNoPolicyExposure: excludeFlag !== "0",
                withinDays: null,
                utilizationBin: bin || null,
                fromDate: dateA,
                toDate: dateB,
                asOfDate: dateB,
            };
        }
        if (ymd.test(dateA) && (dateB === "" || dateB === "0")) {
            return {
                type: "utilization_bin",
                includeNoPolicyExposure: dateB !== "0",
                withinDays: null,
                utilizationBin: bin || null,
                fromDate: dateA,
                toDate: dateA,
                asOfDate: dateA,
            };
        }
        return { ...empty, type: "utilization_bin", utilizationBin: bin || null };
    }
    if (raw.startsWith("ar_extreme_moves:")) {
        const parts = raw.split(":");
        const dateA = parts[1] ?? "";
        const dateB = parts[2] ?? "";
        const ymd = /^\d{4}-\d{2}-\d{2}$/;
        if (ymd.test(dateA) && ymd.test(dateB)) {
            const excludeFlag = parts[3];
            return {
                type: "ar_extreme_moves",
                includeNoPolicyExposure: excludeFlag !== "0",
                withinDays: null,
                utilizationBin: null,
                fromDate: dateA,
                toDate: dateB,
                asOfDate: dateB,
            };
        }
        if (ymd.test(dateA)) {
            return {
                type: "ar_extreme_moves",
                includeNoPolicyExposure: dateB !== "0",
                withinDays: null,
                utilizationBin: null,
                fromDate: dateA,
                toDate: dateA,
                asOfDate: dateA,
            };
        }
        return { ...empty, type: "ar_extreme_moves" };
    }
    if (raw.startsWith("utilization_overshoot:")) {
        const parts = raw.split(":");
        const dateA = parts[1] ?? "";
        const dateB = parts[2] ?? "";
        const ymd = /^\d{4}-\d{2}-\d{2}$/;
        if (ymd.test(dateA) && ymd.test(dateB)) {
            const excludeFlag = parts[3];
            return {
                type: "utilization_overshoot",
                includeNoPolicyExposure: excludeFlag !== "0",
                withinDays: null,
                utilizationBin: null,
                fromDate: dateA,
                toDate: dateB,
                asOfDate: dateB,
            };
        }
        if (ymd.test(dateA)) {
            return {
                type: "utilization_overshoot",
                includeNoPolicyExposure: dateB !== "0",
                withinDays: null,
                utilizationBin: null,
                fromDate: dateA,
                toDate: dateA,
                asOfDate: dateA,
            };
        }
        return { ...empty, type: "utilization_overshoot" };
    }
    if (raw.startsWith("limit_capped:")) {
        const parts = raw.split(":");
        const dateA = parts[1] ?? "";
        const dateB = parts[2] ?? "";
        const ymd = /^\d{4}-\d{2}-\d{2}$/;
        if (ymd.test(dateA) && ymd.test(dateB)) {
            const excludeFlag = parts[3];
            return {
                type: "limit_capped",
                includeNoPolicyExposure: excludeFlag !== "0",
                withinDays: null,
                utilizationBin: null,
                fromDate: dateA,
                toDate: dateB,
                asOfDate: dateB,
            };
        }
        if (ymd.test(dateA)) {
            return {
                type: "limit_capped",
                includeNoPolicyExposure: dateB !== "0",
                withinDays: null,
                utilizationBin: null,
                fromDate: dateA,
                toDate: dateA,
                asOfDate: dateA,
            };
        }
        return { ...empty, type: "limit_capped" };
    }
    // negative_daily_cost:<from>:<to>[:0]
    if (raw.startsWith("negative_daily_cost:")) {
        const parts = raw.split(":");
        const dateA = parts[1] ?? "";
        const dateB = parts[2] ?? "";
        const flag = parts[3];
        const ymd = /^\d{4}-\d{2}-\d{2}$/;
        if (ymd.test(dateA) && ymd.test(dateB)) {
            return {
                type: "negative_daily_cost",
                includeNoPolicyExposure: flag !== "0",
                withinDays: null,
                utilizationBin: null,
                fromDate: dateA,
                toDate: dateB,
                asOfDate: dateB,
            };
        }
        if (ymd.test(dateA)) {
            return {
                type: "negative_daily_cost",
                includeNoPolicyExposure: dateB !== "0",
                withinDays: null,
                utilizationBin: null,
                fromDate: dateA,
                toDate: dateA,
                asOfDate: dateA,
            };
        }
        return { ...empty, type: "negative_daily_cost" };
    }
    // exposure_reconciliation:<from>:<to>[:0]
    if (raw.startsWith("exposure_reconciliation:")) {
        const parts = raw.split(":");
        const dateA = parts[1] ?? "";
        const dateB = parts[2] ?? "";
        const flag = parts[3];
        const ymd = /^\d{4}-\d{2}-\d{2}$/;
        if (ymd.test(dateA) && ymd.test(dateB)) {
            return {
                type: "exposure_reconciliation",
                includeNoPolicyExposure: flag !== "0",
                withinDays: null,
                utilizationBin: null,
                fromDate: dateA,
                toDate: dateB,
                asOfDate: dateB,
            };
        }
        if (ymd.test(dateA)) {
            return {
                type: "exposure_reconciliation",
                includeNoPolicyExposure: dateB !== "0",
                withinDays: null,
                utilizationBin: null,
                fromDate: dateA,
                toDate: dateA,
                asOfDate: dateA,
            };
        }
        return { ...empty, type: "exposure_reconciliation" };
    }
    // policy_concentration:<from>:<to>[:0]
    if (raw.startsWith("policy_concentration:")) {
        const parts = raw.split(":");
        const dateA = parts[1] ?? "";
        const dateB = parts[2] ?? "";
        const flag = parts[3];
        const ymd = /^\d{4}-\d{2}-\d{2}$/;
        if (ymd.test(dateA) && ymd.test(dateB)) {
            return {
                type: "policy_concentration",
                includeNoPolicyExposure: flag !== "0",
                withinDays: null,
                utilizationBin: null,
                fromDate: dateA,
                toDate: dateB,
                asOfDate: dateB,
            };
        }
        if (ymd.test(dateA)) {
            return {
                type: "policy_concentration",
                includeNoPolicyExposure: dateB !== "0",
                withinDays: null,
                utilizationBin: null,
                fromDate: dateA,
                toDate: dateA,
                asOfDate: dateA,
            };
        }
        return { ...empty, type: "policy_concentration" };
    }
    if (raw === "limit_breach_forecast" || raw.startsWith("limit_breach_forecast:")) {
        const parts = raw.split(":");
        return {
            type: "limit_breach_forecast",
            includeNoPolicyExposure: parts[1] !== "0",
            withinDays: null,
            utilizationBin: null,
            fromDate: null,
            toDate: null,
            asOfDate: null,
        };
    }
    if (raw.startsWith("breach_dilution:")) {
        const parts = raw.split(":");
        const dateA = parts[1] ?? "";
        const dateB = parts[2] ?? "";
        const ymd = /^\d{4}-\d{2}-\d{2}$/;
        if (ymd.test(dateA) && ymd.test(dateB)) {
            const excludeFlag = parts[3];
            return {
                type: "breach_dilution",
                includeNoPolicyExposure: excludeFlag !== "0",
                withinDays: null,
                utilizationBin: null,
                fromDate: dateA,
                toDate: dateB,
                asOfDate: dateB,
            };
        }
        if (ymd.test(dateA)) {
            return {
                type: "breach_dilution",
                includeNoPolicyExposure: dateB !== "0",
                withinDays: null,
                utilizationBin: null,
                fromDate: dateA,
                toDate: dateA,
                asOfDate: dateA,
            };
        }
        return { ...empty, type: "breach_dilution" };
    }
    if (raw.startsWith("breach_episodes:")) {
        const parts = raw.split(":");
        const dateA = parts[1] ?? "";
        const dateB = parts[2] ?? "";
        const ymd = /^\d{4}-\d{2}-\d{2}$/;
        if (ymd.test(dateA) && ymd.test(dateB)) {
            const excludeFlag = parts[3];
            return {
                type: "breach_episodes",
                includeNoPolicyExposure: excludeFlag !== "0",
                withinDays: null,
                utilizationBin: null,
                fromDate: dateA,
                toDate: dateB,
                asOfDate: dateB,
            };
        }
        if (ymd.test(dateA)) {
            return {
                type: "breach_episodes",
                includeNoPolicyExposure: dateB !== "0",
                withinDays: null,
                utilizationBin: null,
                fromDate: dateA,
                toDate: dateA,
                asOfDate: dateA,
            };
        }
        return { ...empty, type: "breach_episodes" };
    }
    return empty;
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

    if (input.type === "utilization_bin") {
        const bin = input.utilizationBin?.trim() ?? "";
        const fromDate =
            input.fromDate?.trim() || input.asOfDate?.trim() || "";
        const toDate =
            input.toDate?.trim() || input.asOfDate?.trim() || fromDate;
        if (
            !bin ||
            !/^\d{4}-\d{2}-\d{2}$/.test(fromDate) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(toDate)
        ) {
            return {
                isCreditDashboard: false,
                grain: null,
                context: null,
                systemReportUniqueName: null,
                additionalFilters: [],
                useViewBased: false,
            };
        }
        return {
            isCreditDashboard: true,
            grain,
            context,
            systemReportUniqueName,
            additionalFilters: customerMembershipFilters(
                input,
                encodeUtilizationBinMembershipValue({
                    bin,
                    fromDate,
                    toDate,
                    includeNoPolicyExposure: input.includeNoPolicyExposure,
                })
            ),
            useViewBased: true,
        };
    }

    if (input.type === "ar_extreme_moves") {
        const fromDate =
            input.fromDate?.trim() || input.asOfDate?.trim() || "";
        const toDate =
            input.toDate?.trim() || input.asOfDate?.trim() || fromDate;
        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(fromDate) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(toDate)
        ) {
            return {
                isCreditDashboard: false,
                grain: null,
                context: null,
                systemReportUniqueName: null,
                additionalFilters: [],
                useViewBased: false,
            };
        }
        return {
            isCreditDashboard: true,
            grain,
            context,
            systemReportUniqueName,
            additionalFilters: customerMembershipFilters(
                input,
                encodeArExtremeMovesMembershipValue({
                    fromDate,
                    toDate,
                    includeNoPolicyExposure: input.includeNoPolicyExposure,
                })
            ),
            useViewBased: true,
        };
    }

    if (input.type === "utilization_overshoot") {
        const fromDate =
            input.fromDate?.trim() || input.asOfDate?.trim() || "";
        const toDate =
            input.toDate?.trim() || input.asOfDate?.trim() || fromDate;
        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(fromDate) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(toDate)
        ) {
            return {
                isCreditDashboard: false,
                grain: null,
                context: null,
                systemReportUniqueName: null,
                additionalFilters: [],
                useViewBased: false,
            };
        }
        return {
            isCreditDashboard: true,
            grain,
            context,
            systemReportUniqueName,
            additionalFilters: customerMembershipFilters(
                input,
                encodeUtilizationOvershootMembershipValue({
                    fromDate,
                    toDate,
                    includeNoPolicyExposure: input.includeNoPolicyExposure,
                })
            ),
            useViewBased: true,
        };
    }

    if (input.type === "limit_capped") {
        const fromDate =
            input.fromDate?.trim() || input.asOfDate?.trim() || "";
        const toDate =
            input.toDate?.trim() || input.asOfDate?.trim() || fromDate;
        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(fromDate) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(toDate)
        ) {
            return {
                isCreditDashboard: false,
                grain: null,
                context: null,
                systemReportUniqueName: null,
                additionalFilters: [],
                useViewBased: false,
            };
        }
        return {
            isCreditDashboard: true,
            grain,
            context,
            systemReportUniqueName,
            additionalFilters: customerMembershipFilters(
                input,
                encodeLimitCappedMembershipValue({
                    fromDate,
                    toDate,
                    includeNoPolicyExposure: input.includeNoPolicyExposure,
                })
            ),
            useViewBased: true,
        };
    }

    if (input.type === "negative_daily_cost") {
        const fromDate =
            input.fromDate?.trim() || input.asOfDate?.trim() || "";
        const toDate =
            input.toDate?.trim() || input.asOfDate?.trim() || fromDate;
        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(fromDate) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(toDate)
        ) {
            return {
                isCreditDashboard: false,
                grain: null,
                context: null,
                systemReportUniqueName: null,
                additionalFilters: [],
                useViewBased: false,
            };
        }
        return {
            isCreditDashboard: true,
            grain,
            context,
            systemReportUniqueName,
            additionalFilters: customerMembershipFilters(
                input,
                encodeNegativeDailyCostMembershipValue({
                    fromDate,
                    toDate,
                    includeNoPolicyExposure: input.includeNoPolicyExposure,
                })
            ),
            useViewBased: true,
        };
    }

    if (input.type === "exposure_reconciliation") {
        const fromDate =
            input.fromDate?.trim() || input.asOfDate?.trim() || "";
        const toDate =
            input.toDate?.trim() || input.asOfDate?.trim() || fromDate;
        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(fromDate) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(toDate)
        ) {
            return {
                isCreditDashboard: false,
                grain: null,
                context: null,
                systemReportUniqueName: null,
                additionalFilters: [],
                useViewBased: false,
            };
        }
        return {
            isCreditDashboard: true,
            grain,
            context,
            systemReportUniqueName,
            additionalFilters: customerMembershipFilters(
                input,
                encodeExposureReconciliationMembershipValue({
                    fromDate,
                    toDate,
                    includeNoPolicyExposure: input.includeNoPolicyExposure,
                })
            ),
            useViewBased: true,
        };
    }

    if (input.type === "policy_concentration") {
        const fromDate =
            input.fromDate?.trim() || input.asOfDate?.trim() || "";
        const toDate =
            input.toDate?.trim() || input.asOfDate?.trim() || fromDate;
        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(fromDate) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(toDate)
        ) {
            return {
                isCreditDashboard: false,
                grain: null,
                context: null,
                systemReportUniqueName: null,
                additionalFilters: [],
                useViewBased: false,
            };
        }
        return {
            isCreditDashboard: true,
            grain,
            context,
            systemReportUniqueName,
            additionalFilters: customerMembershipFilters(
                input,
                encodePolicyConcentrationMembershipValue({
                    fromDate,
                    toDate,
                    includeNoPolicyExposure: input.includeNoPolicyExposure,
                })
            ),
            useViewBased: true,
        };
    }

    if (input.type === "limit_breach_forecast") {
        return {
            isCreditDashboard: true,
            grain,
            context,
            systemReportUniqueName,
            additionalFilters: customerMembershipFilters(
                input,
                encodeLimitBreachForecastMembershipValue({
                    includeNoPolicyExposure: input.includeNoPolicyExposure,
                })
            ),
            useViewBased: true,
        };
    }

    if (input.type === "breach_dilution" || input.type === "breach_episodes") {
        const fromDate =
            input.fromDate?.trim() || input.asOfDate?.trim() || "";
        const toDate =
            input.toDate?.trim() || input.asOfDate?.trim() || fromDate;
        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(fromDate) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(toDate)
        ) {
            return {
                isCreditDashboard: false,
                grain: null,
                context: null,
                systemReportUniqueName: null,
                additionalFilters: [],
                useViewBased: false,
            };
        }
        const membershipValue =
            input.type === "breach_dilution"
                ? encodeBreachDilutionMembershipValue({
                      fromDate,
                      toDate,
                      includeNoPolicyExposure: input.includeNoPolicyExposure,
                  })
                : encodeBreachEpisodesMembershipValue({
                      fromDate,
                      toDate,
                      includeNoPolicyExposure: input.includeNoPolicyExposure,
                  });
        return {
            isCreditDashboard: true,
            grain,
            context,
            systemReportUniqueName,
            additionalFilters: customerMembershipFilters(
                input,
                membershipValue
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
