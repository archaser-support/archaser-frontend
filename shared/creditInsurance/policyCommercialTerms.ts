export type PolicyKindForCommercialTerms = "Primary" | "TopUp";

export type InsurancePolicyProductType = "TailorMade" | "Commodity";

export const INSURANCE_POLICY_PRODUCT_TYPES: readonly InsurancePolicyProductType[] =
    ["TailorMade", "Commodity"] as const;

export const COMMERCIAL_TERM_FIELD_NAMES = [
    "insured_percentage",
    "non_qualifying_loss_threshold",
    "minimum_premium",
    "minimum_premium_period_years",
    "aggregate_excess",
    "sdl_excess",
    "ncb_zero_claims_bonus_percent",
    "ncb_claims_ratio_threshold_percent",
    "ncb_up_to_threshold_bonus_percent",
    "product_type",
] as const;

export type CommercialTermFieldName =
    (typeof COMMERCIAL_TERM_FIELD_NAMES)[number];

export type CommercialTermValidationErrorCode =
    | "invalid_number"
    | "invalid_integer"
    | "negative"
    | "percent_out_of_range"
    | "period_years_out_of_range"
    | "invalid_product_type";
export type CommercialTermsFormInputs = {
    insured_percentage: string;
    non_qualifying_loss_threshold: string;
    minimum_premium: string;
    minimum_premium_period_years: string;
    aggregate_excess: string;
    sdl_excess: string;
    ncb_zero_claims_bonus_percent: string;
    ncb_claims_ratio_threshold_percent: string;
    ncb_up_to_threshold_bonus_percent: string;
    product_type: "" | InsurancePolicyProductType;
};

export type CommercialTermsNormalizedValues = {
    insured_percentage: number | null;
    non_qualifying_loss_threshold: number | null;
    minimum_premium: number | null;
    minimum_premium_period_years: number | null;
    aggregate_excess: number | null;
    sdl_excess: number | null;
    ncb_zero_claims_bonus_percent: number | null;
    ncb_claims_ratio_threshold_percent: number | null;
    ncb_up_to_threshold_bonus_percent: number | null;
    product_type: InsurancePolicyProductType | null;
};

const PERCENT_MIN = 0;
const PERCENT_MAX = 100;

function isBlankValue(value: unknown): boolean {
    return value === null || value === undefined || String(value).trim() === "";
}

function emptyCommercialValues(): CommercialTermsNormalizedValues {
    return {
        insured_percentage: null,
        non_qualifying_loss_threshold: null,
        minimum_premium: null,
        minimum_premium_period_years: null,
        aggregate_excess: null,
        sdl_excess: null,
        ncb_zero_claims_bonus_percent: null,
        ncb_claims_ratio_threshold_percent: null,
        ncb_up_to_threshold_bonus_percent: null,
        product_type: null,
    };
}

export function emptyCommercialTermsFormInputs(): CommercialTermsFormInputs {
    return {
        insured_percentage: "",
        non_qualifying_loss_threshold: "",
        minimum_premium: "",
        minimum_premium_period_years: "",
        aggregate_excess: "",
        sdl_excess: "",
        ncb_zero_claims_bonus_percent: "",
        ncb_claims_ratio_threshold_percent: "",
        ncb_up_to_threshold_bonus_percent: "",
        product_type: "",
    };
}

function parseOptionalNonNegativeMoney(
    raw: string
): { value: number | null; error?: CommercialTermValidationErrorCode } {
    const trimmed = raw.trim();
    if (!trimmed) {
        return { value: null };
    }
    const parsed = Number(trimmed.replace(",", "."));
    if (!Number.isFinite(parsed)) {
        return { value: null, error: "invalid_number" };
    }
    if (parsed < 0) {
        return { value: null, error: "negative" };
    }
    return { value: parsed };
}

function parseOptionalPercent(
    raw: string
): { value: number | null; error?: CommercialTermValidationErrorCode } {
    const trimmed = raw.trim();
    if (!trimmed) {
        return { value: null };
    }
    const parsed = Number(trimmed.replace(",", "."));
    if (!Number.isFinite(parsed)) {
        return { value: null, error: "invalid_number" };
    }
    if (parsed < PERCENT_MIN || parsed > PERCENT_MAX) {
        return { value: null, error: "percent_out_of_range" };
    }
    return { value: parsed };
}

function parseOptionalPeriodYears(
    raw: string
): { value: number | null; error?: CommercialTermValidationErrorCode } {
    const trimmed = raw.trim();
    if (!trimmed) {
        return { value: null };
    }
    const parsed = Number(trimmed.replace(",", "."));
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        return { value: null, error: "invalid_integer" };
    }
    if (parsed < 1) {
        return { value: null, error: "period_years_out_of_range" };
    }
    return { value: parsed };
}

function parseOptionalProductType(
    raw: "" | InsurancePolicyProductType
): {
    value: InsurancePolicyProductType | null;
    error?: CommercialTermValidationErrorCode;
} {
    if (!raw) {
        return { value: null };
    }
    if (!INSURANCE_POLICY_PRODUCT_TYPES.includes(raw)) {
        return { value: null, error: "invalid_product_type" };
    }
    return { value: raw };
}

/**
 * Client-side counterpart to backend `applyInsurancePolicyCommercialTerms`.
 * TopUp always clears; Primary maps blank → null and keeps 0 where allowed.
 */
export function validateCommercialTermsFormFields(
    inputs: CommercialTermsFormInputs,
    policyKind: PolicyKindForCommercialTerms
): {
    values: CommercialTermsNormalizedValues;
    errors: Partial<Record<CommercialTermFieldName, CommercialTermValidationErrorCode>>;
} {
    if (policyKind === "TopUp") {
        return { values: emptyCommercialValues(), errors: {} };
    }

    const errors: Partial<
        Record<CommercialTermFieldName, CommercialTermValidationErrorCode>
    > = {};
    const values = emptyCommercialValues();

    const insured = parseOptionalPercent(inputs.insured_percentage);
    if (insured.error) errors.insured_percentage = insured.error;
    else values.insured_percentage = insured.value;

    const nql = parseOptionalNonNegativeMoney(
        inputs.non_qualifying_loss_threshold
    );
    if (nql.error) errors.non_qualifying_loss_threshold = nql.error;
    else values.non_qualifying_loss_threshold = nql.value;

    const minPremium = parseOptionalNonNegativeMoney(inputs.minimum_premium);
    if (minPremium.error) errors.minimum_premium = minPremium.error;
    else values.minimum_premium = minPremium.value;

    const period = parseOptionalPeriodYears(
        inputs.minimum_premium_period_years
    );
    if (period.error) errors.minimum_premium_period_years = period.error;
    else values.minimum_premium_period_years = period.value;

    const aggregate = parseOptionalNonNegativeMoney(inputs.aggregate_excess);
    if (aggregate.error) errors.aggregate_excess = aggregate.error;
    else values.aggregate_excess = aggregate.value;

    const sdl = parseOptionalNonNegativeMoney(inputs.sdl_excess);
    if (sdl.error) errors.sdl_excess = sdl.error;
    else values.sdl_excess = sdl.value;

    const ncbZero = parseOptionalPercent(inputs.ncb_zero_claims_bonus_percent);
    if (ncbZero.error) errors.ncb_zero_claims_bonus_percent = ncbZero.error;
    else values.ncb_zero_claims_bonus_percent = ncbZero.value;

    const ncbThreshold = parseOptionalPercent(
        inputs.ncb_claims_ratio_threshold_percent
    );
    if (ncbThreshold.error) {
        errors.ncb_claims_ratio_threshold_percent = ncbThreshold.error;
    } else {
        values.ncb_claims_ratio_threshold_percent = ncbThreshold.value;
    }

    const ncbUpTo = parseOptionalPercent(
        inputs.ncb_up_to_threshold_bonus_percent
    );
    if (ncbUpTo.error) errors.ncb_up_to_threshold_bonus_percent = ncbUpTo.error;
    else values.ncb_up_to_threshold_bonus_percent = ncbUpTo.value;

    const productType = parseOptionalProductType(inputs.product_type);
    if (productType.error) errors.product_type = productType.error;
    else values.product_type = productType.value;

    return { values, errors };
}

export function commercialTermValidationMessage(
    code: CommercialTermValidationErrorCode,
    tCi: (key: string, options?: Record<string, unknown>) => string
): string {
    switch (code) {
        case "invalid_integer":
            return tCi("credit_insurance.validation.invalid_integer");
        case "negative":
            return tCi("credit_insurance.validation.commercial_value_negative");
        case "percent_out_of_range":
            return tCi(
                "credit_insurance.validation.commercial_percent_out_of_range"
            );
        case "period_years_out_of_range":
            return tCi(
                "credit_insurance.validation.minimum_premium_period_years_invalid"
            );
        case "invalid_product_type":
            return tCi("credit_insurance.validation.invalid_product_type");
        case "invalid_number":
        default:
            return tCi("credit_insurance.validation.invalid_number");
    }
}
