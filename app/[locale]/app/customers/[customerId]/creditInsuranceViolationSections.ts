import {
    getInvoiceFieldFromGridRow,
    INVOICE_CREDIT_INSURANCE_VIOLATION_FIELDS,
    isTruthyFlag,
} from "@/shared/utils/invoiceGridRowFields";

/** Row key set by report execute when `includeInvoiceCreditInsuranceViolationFields` is on. */
export const INVOICE_VIOLATION_DETAILS_KEY =
    "__credit_insurance_violation_details";

/** Per-breach inputs from report execute; dates are `YYYY-MM-DD`, missing inputs are null. */
export type InvoiceViolationDetails = {
    invoice_date?: string | null;
    due_date?: string | null;
    target_reporting_date?: string | null;
    actual_reporting_date?: string | null;
    reporting_days_late?: number | null;
    credit_days?: number | null;
    max_payment_term?: number | null;
    mep_cause_invoice_number?: string | null;
    mep_cause_due_date?: string | null;
    /** Cause open amount in invoice (customer) currency on this invoice's issue date. */
    mep_cause_outstanding?: number | null;
    mep_days_past?: number | null;
    customer_currency?: string | null;
    policy_exclusion_reason?: string | null;
    credit_score_input_date?: string | null;
    score_validity_period_months?: number | null;
    policy_end_date?: string | null;
};

type ViolationCauseField =
    (typeof INVOICE_CREDIT_INSURANCE_VIOLATION_FIELDS)[number]["field"];

export type ViolationDetailRow = { label: string; value: string };

export type ViolationSection = {
    field: ViolationCauseField;
    title: string;
    rows: ViolationDetailRow[];
};

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

type DetailContext = {
    details: InvoiceViolationDetails;
    row: Record<string, unknown>;
    t: TranslateFn;
    formatDate: (ymd: string) => string;
    formatAmount: (value: number, currency: string) => string;
};

const DETAILS_PREFIX = "credit_insurance_violations.details";

function hasText(value: unknown): value is string {
    return typeof value === "string" && value.trim() !== "";
}

function hasNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function label(ctx: DetailContext, key: string): string {
    return ctx.t(`${DETAILS_PREFIX}.${key}`, { ns: "customers" });
}

function dateRow(
    ctx: DetailContext,
    key: string,
    ymd: string | null | undefined
): ViolationDetailRow | null {
    if (!hasText(ymd)) return null;
    const value = ctx.formatDate(ymd);
    return hasText(value) ? { label: label(ctx, key), value } : null;
}

function textRow(
    ctx: DetailContext,
    key: string,
    value: unknown
): ViolationDetailRow | null {
    if (hasNumber(value)) return { label: label(ctx, key), value: String(value) };
    if (hasText(value)) return { label: label(ctx, key), value: value.trim() };
    return null;
}

function creditDaysRow(ctx: DetailContext): ViolationDetailRow | null {
    const { credit_days: days, max_payment_term: max } = ctx.details;
    if (!hasNumber(days)) return null;
    const value = hasNumber(max)
        ? ctx.t(`${DETAILS_PREFIX}.credit_days_vs_max`, {
              ns: "customers",
              days,
              max,
          })
        : String(days);
    return { label: label(ctx, "credit_days"), value };
}

function amountRow(
    ctx: DetailContext,
    key: string,
    value: number | null | undefined
): ViolationDetailRow | null {
    if (!hasNumber(value)) return null;
    const currency =
        ctx.details.customer_currency ??
        getInvoiceFieldFromGridRow(ctx.row, "customer_currency");
    const formatted = ctx.formatAmount(
        value,
        hasText(currency) ? currency : ""
    );
    return hasText(formatted) ? { label: label(ctx, key), value: formatted } : null;
}

function mepCauseInvoiceNumber(ctx: DetailContext): unknown {
    return (
        ctx.details.mep_cause_invoice_number ??
        getInvoiceFieldFromGridRow(
            ctx.row,
            "ctv_customer_overdue_mep_cause_invoice_number"
        )
    );
}

/** Detail rows per breach; a cause with no usable inputs renders its title only. */
const CAUSE_DETAIL_ROWS: Record<
    ViolationCauseField,
    (ctx: DetailContext) => Array<ViolationDetailRow | null>
> = {
    reporting_breach: (ctx) => [
        dateRow(ctx, "target_reporting_date", ctx.details.target_reporting_date),
        textRow(ctx, "days_late", ctx.details.reporting_days_late),
    ],
    ctv_payment_term: (ctx) => [creditDaysRow(ctx)],
    ctv_customer_overdue_mep: (ctx) => [
        textRow(ctx, "caused_by", mepCauseInvoiceNumber(ctx)),
        dateRow(ctx, "due_date", ctx.details.mep_cause_due_date),
        amountRow(ctx, "outstanding_then", ctx.details.mep_cause_outstanding),
        textRow(ctx, "days_past_mep", ctx.details.mep_days_past),
    ],
    ctv_customer_excluded_from_policy: (ctx) => [
        textRow(ctx, "exclusion_reason", ctx.details.policy_exclusion_reason),
    ],
    ctv_outdated_dcl: (ctx) => [
        dateRow(
            ctx,
            "credit_score_input_date",
            ctx.details.credit_score_input_date
        ),
        textRow(
            ctx,
            "score_validity_period_months",
            ctx.details.score_validity_period_months
        ),
    ],
    ctv_invoice_after_policy_end: (ctx) => [
        dateRow(ctx, "invoice_date", ctx.details.invoice_date),
        dateRow(ctx, "policy_end_date", ctx.details.policy_end_date),
    ],
};

function readInvoiceViolationDetails(
    row: Record<string, unknown>
): InvoiceViolationDetails {
    const raw = getInvoiceFieldFromGridRow(row, INVOICE_VIOLATION_DETAILS_KEY);
    return raw && typeof raw === "object"
        ? (raw as InvoiceViolationDetails)
        : {};
}

export function buildCreditInsuranceViolationSections(
    row: Record<string, unknown>,
    t: TranslateFn,
    formatDate: (ymd: string) => string,
    formatAmount: (value: number, currency: string) => string
): ViolationSection[] {
    const ctx: DetailContext = {
        details: readInvoiceViolationDetails(row),
        row,
        t,
        formatDate,
        formatAmount,
    };
    const sections: ViolationSection[] = [];
    for (const { field, labelKey } of INVOICE_CREDIT_INSURANCE_VIOLATION_FIELDS) {
        if (!isTruthyFlag(getInvoiceFieldFromGridRow(row, field))) continue;
        sections.push({
            field,
            title: t(labelKey, { ns: "customers" }),
            rows: CAUSE_DETAIL_ROWS[field](ctx).filter(
                (r): r is ViolationDetailRow => r !== null
            ),
        });
    }
    return sections;
}
