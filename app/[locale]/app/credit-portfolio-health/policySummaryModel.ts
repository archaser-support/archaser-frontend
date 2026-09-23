export type PolicySummaryDetail = {
    id: number;
    policy_number?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    status?: string | null;
    currency?: string | null;
    insurer_name?: string | null;
    policy_kind?: string | null;
    max_total_cover?: string | number | null;
    max_total_dcl_sdl_cover?: string | number | null;
    max_dcl?: string | number | null;
    max_payment_term?: number | null;
    max_allowed_mep?: number | null;
    reporting_days?: number | null;
    cost_calculation_method?: "ActualSales" | "Limit" | string | null;
    cost_percent?: string | number | null;
    registration_fee_percent?: string | number | null;
    annual_credit_assessment_fee?: string | number | null;
    insured_percentage?: string | number | null;
    non_qualifying_loss_threshold?: string | number | null;
    minimum_premium?: string | number | null;
    minimum_premium_period_years?: number | null;
    aggregate_excess?: string | number | null;
    sdl_excess?: string | number | null;
    product_type?: "TailorMade" | "Commodity" | string | null;
    InsurancePolicyCountry?: unknown[] | null;
    NamedPolicy?: unknown[] | null;
};

export function toFiniteNumber(
    value: string | number | null | undefined
): number | null {
    if (value == null || value === "") {
        return null;
    }
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function policyDateYmd(value: string | null | undefined): string | null {
    if (!value) {
        return null;
    }
    const ymd = value.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

export function formatPolicyDate(
    value: string | null | undefined,
    language: string
): string | null {
    const ymd = policyDateYmd(value);
    if (!ymd) {
        return null;
    }
    const [year, month, day] = ymd.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const locale = language.startsWith("he") ? "he-IL" : "en-GB";
    return date.toLocaleDateString(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

export function countryRowCount(detail: PolicySummaryDetail): number {
    return Array.isArray(detail.InsurancePolicyCountry)
        ? detail.InsurancePolicyCountry.length
        : 0;
}

export function namedRowCount(detail: PolicySummaryDetail): number {
    return Array.isArray(detail.NamedPolicy) ? detail.NamedPolicy.length : 0;
}

export function dclSdlCoverAmount(detail: PolicySummaryDetail): number | null {
    return (
        toFiniteNumber(detail.max_total_dcl_sdl_cover) ??
        toFiniteNumber(detail.max_dcl)
    );
}

/** Primary policies always get the commercial summary card (TopUp never). */
export function showPolicySummaryCommercialTerms(
    detail: PolicySummaryDetail
): boolean {
    return detail.policy_kind !== "TopUp";
}

/** Whether any of the summary commercial fields have a stored value. */
export function hasPolicySummaryCommercialTerms(
    detail: PolicySummaryDetail
): boolean {
    if (!showPolicySummaryCommercialTerms(detail)) {
        return false;
    }
    return (
        toFiniteNumber(detail.insured_percentage) != null ||
        toFiniteNumber(detail.non_qualifying_loss_threshold) != null ||
        toFiniteNumber(detail.minimum_premium) != null ||
        detail.minimum_premium_period_years != null ||
        toFiniteNumber(detail.aggregate_excess) != null ||
        toFiniteNumber(detail.sdl_excess) != null ||
        Boolean(detail.product_type?.trim())
    );
}
