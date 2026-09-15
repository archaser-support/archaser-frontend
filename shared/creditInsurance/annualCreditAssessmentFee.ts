export type PolicyKindForAnnualCreditAssessmentFee = "Primary" | "TopUp";

export type AnnualCreditAssessmentFeeValidationErrorCode =
    | "invalid_number"
    | "negative";

function isBlankValue(value: unknown): boolean {
    return value === null || value === undefined || String(value).trim() === "";
}

/**
 * Server-side normalization for the master-policy Annual Credit Assessment Fee
 * (account-currency money amount).
 *
 * - TopUp policies always normalize the fee to null (policy-type boundary).
 * - Primary policies accept null/blank (no fee configured) and finite
 *   non-negative amounts.
 * - Anything else throws, keeping client and server validation in parity.
 */
export function parseAnnualCreditAssessmentFee(
    value: unknown,
    policyKind: PolicyKindForAnnualCreditAssessmentFee
): number | null {
    if (policyKind === "TopUp") {
        return null;
    }
    if (isBlankValue(value)) {
        return null;
    }
    const parsed = Number(String(value).trim().replace(",", "."));
    if (!Number.isFinite(parsed)) {
        throw new Error("annual_credit_assessment_fee must be a valid number");
    }
    if (parsed < 0) {
        throw new Error(
            "annual_credit_assessment_fee must be greater than or equal to 0"
        );
    }
    return parsed;
}

/**
 * Client-side counterpart to {@link parseAnnualCreditAssessmentFee}. Returns
 * the normalized value plus an error code (never throws) so forms can surface
 * a localized message while enforcing the same non-negative and TopUp rules.
 */
export function validateAnnualCreditAssessmentFeeFormField(
    raw: string,
    policyKind: PolicyKindForAnnualCreditAssessmentFee
): {
    value: number | null;
    error?: AnnualCreditAssessmentFeeValidationErrorCode;
} {
    if (policyKind === "TopUp") {
        return { value: null };
    }
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
