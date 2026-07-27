/** Minimal report_config shape for static analysis (avoids circular imports with ReportService). */
type ReportConfigLike = {
    tables?: string[];
    fields?: Array<{ table?: string; field?: string }>;
    filters?: Array<{ table?: string; field?: string }>;
    sorting?: Array<{ field?: string }>;
    grouping?: string[];
    formulas?: Array<{ expression?: string; currencySource?: string }>;
    chart?: { xAxis?: string; yAxis?: string };
};

/** Invoice columns used for credit-insurance reporting / violations (report builder + saved views). */
export const CREDIT_INSURANCE_INVOICE_REPORT_FIELD_NAMES = new Set([
    "policy_id",
    "InsurancePolicy.policy_number",
    "target_reporting_date",
    "actual_reporting_date",
    "target_mep_date",
    "reported_status",
    "reporting_comment",
    "reporting_captured_at",
    "reporting_breach",
    "ctv_payment_term",
    "ctv_customer_overdue_mep",
    "ctv_customer_excluded_from_policy",
    "ctv_outdated_dcl",
    "ctv_invoice_after_policy_end",
    "in_capacity_gap",
    "capacity_gap_amount",
    "capacity_gap_amount_limit",
    "capacity_gap_amount_date",
    "oldest_overdue_invoice_date",
    "days_left_for_reporting",
    "terms_breach_reason",
]);

/**
 * Customer columns tied to the credit-insurance product.
 * {@link ReportQueryBuilder} and {@link ReportExecutionService} load these from
 * active {@link CustomerPolicy} while preserving legacy report field names.
 */
export const CREDIT_INSURANCE_CUSTOMER_REPORT_FIELD_NAMES = new Set([
    "policy_id",
    "InsurancePolicy.policy_number",
    "customer_number_policy",
    "approved_limit",
    "approved_limit_expiration_date",
    "limit_type",
    "max_payment_term",
    "max_allowed_mep",
    "reporting_days",
    "oldest_invoice_overdue_date",
    "overdue_block",
    "policy_exclusion_reason",
    "credit_score",
    "credit_score_input_date",
    "capacity_gap_amount",
    "zero_limit_date",
    "limit_expires_in_days",
    "top_up_total",
    "effective_approved_limit",
    "open_receivable_amount",
    "open_invoice_count",
    "terms_breach_outstanding",
    "policy_risk_allocated",
    "limit_warning_summary",
    "top_up_type",
    "top_up_value",
    "top_up_resolved_amount",
    "top_up_end_date",
    "top_up_days_left",
    "policy_daily_cost_change",
    "policy_cost_currency",
    "top_up_daily_cost_change",
    "top_up_cost_currency",
    "total_daily_cost_change",
    "cost_calculation_method",
    "cost_percent",
    "registration_fee_percent",
    "policy_cost_snapshot_date",
]);

function isCreditInsuranceTableField(table: string, field: string): boolean {
    if (table === "Invoice") {
        return CREDIT_INSURANCE_INVOICE_REPORT_FIELD_NAMES.has(field);
    }
    if (table === "Customer") {
        return CREDIT_INSURANCE_CUSTOMER_REPORT_FIELD_NAMES.has(field);
    }
    return false;
}

function parseSortOrGroupField(
    raw: string | undefined,
    primaryTable: string | undefined
): { table: string; field: string } | null {
    if (!raw || typeof raw !== "string") {
        return null;
    }
    if (raw.startsWith("Invoice.")) {
        return { table: "Invoice", field: raw.slice("Invoice.".length) };
    }
    if (raw.startsWith("Customer.")) {
        return { table: "Customer", field: raw.slice("Customer.".length) };
    }
    if (primaryTable) {
        return { table: primaryTable, field: raw };
    }
    return null;
}

/**
 * True when the saved report definition references credit-insurance-only columns
 * (fields, filters, sorting, grouping, or chart axes).
 */
export function reportConfigReferencesCreditInsuranceFields(
    config: unknown
): boolean {
    if (!config || typeof config !== "object") {
        return false;
    }
    const c = config as ReportConfigLike;
    const primaryTable = c.tables?.[0];

    if (Array.isArray(c.fields)) {
        for (const f of c.fields) {
            if (
                f?.table &&
                f?.field &&
                isCreditInsuranceTableField(f.table, f.field)
            ) {
                return true;
            }
        }
    }

    if (Array.isArray(c.filters)) {
        for (const f of c.filters) {
            if (
                f?.table &&
                f?.field &&
                isCreditInsuranceTableField(f.table, f.field)
            ) {
                return true;
            }
        }
    }

    if (Array.isArray(c.sorting)) {
        for (const s of c.sorting) {
            const parsed = parseSortOrGroupField(s?.field, primaryTable);
            if (
                parsed &&
                isCreditInsuranceTableField(parsed.table, parsed.field)
            ) {
                return true;
            }
        }
    }

    if (Array.isArray(c.grouping)) {
        for (const g of c.grouping) {
            if (typeof g !== "string") {
                continue;
            }
            const parsed = parseSortOrGroupField(g, primaryTable);
            if (
                parsed &&
                isCreditInsuranceTableField(parsed.table, parsed.field)
            ) {
                return true;
            }
        }
    }

    const chart = c.chart as
        | { xAxis?: string; yAxis?: string }
        | undefined;
    if (chart) {
        for (const axis of [chart.xAxis, chart.yAxis]) {
            const parsed = parseSortOrGroupField(axis, primaryTable);
            if (
                parsed &&
                isCreditInsuranceTableField(parsed.table, parsed.field)
            ) {
                return true;
            }
        }
    }

    if (Array.isArray(c.formulas)) {
        for (const formula of c.formulas) {
            const expression = formula?.expression || "";
            const refs = expression.match(/\[([^\]]+)\]/g) || [];
            for (const token of refs) {
                const parsed = parseSortOrGroupField(
                    token.slice(1, -1),
                    primaryTable
                );
                if (
                    parsed &&
                    isCreditInsuranceTableField(parsed.table, parsed.field)
                ) {
                    return true;
                }
            }

            if (formula?.currencySource) {
                const parsed = parseSortOrGroupField(
                    formula.currencySource,
                    primaryTable
                );
                if (
                    parsed &&
                    isCreditInsuranceTableField(parsed.table, parsed.field)
                ) {
                    return true;
                }
            }
        }
    }

    return false;
}
