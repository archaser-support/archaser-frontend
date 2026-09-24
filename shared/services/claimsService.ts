import api from "@/app/api";
import axios from "axios";

export type ClaimEligibilityFailureReason =
    | "open_not_above_nql"
    | "not_overdue"
    | "reporting_breach_required"
    | "claim_already_exists";

export type ClaimEligibilityResponse =
    | {
          eligible: true;
          insurance_policy_id: number;
          default_recognized_loss: number;
          claim_id: null;
      }
    | {
          eligible: false;
          reasons: ClaimEligibilityFailureReason[];
          insurance_policy_id: number;
          default_recognized_loss: number;
          claim_id: number | null;
      };

export const CLAIM_STATUSES = [
    "Draft",
    "Submitted",
    "Under_Inquiry",
    "Approved",
    "Paid",
    "Rejected",
    "Canceled",
] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

const CLAIM_STATUS_ALIASES: Record<string, ClaimStatus> = {
    "Under Inquiry": "Under_Inquiry",
    Under_Inquiry: "Under_Inquiry",
};

export function normalizeClaimStatus(value: unknown): ClaimStatus | null {
    if (typeof value !== "string") {
        return null;
    }
    const aliased = CLAIM_STATUS_ALIASES[value] ?? value;
    return (CLAIM_STATUSES as readonly string[]).includes(aliased)
        ? (aliased as ClaimStatus)
        : null;
}

/** Statuses that require submission date (+ insurer claim reference). */
export const CLAIM_STATUSES_REQUIRING_SUBMISSION = [
    "Submitted",
    "Under_Inquiry",
    "Approved",
    "Paid",
    "Rejected",
] as const;

export function requiresSubmissionFields(status: string): boolean {
    const normalized = normalizeClaimStatus(status) ?? status;
    return (CLAIM_STATUSES_REQUIRING_SUBMISSION as readonly string[]).includes(
        normalized
    );
}

export function requiresLossDate(status: string): boolean {
    return (normalizeClaimStatus(status) ?? status) === "Rejected";
}

export type ClaimInvoiceSummary = {
    id: number;
    invoice_number: string | null;
    invoice_date: string | Date | null;
    outstanding_debt: number | string | null;
    status: string;
    reporting_breach: boolean;
    customer_id: number | null;
};

export type ClaimCustomerSummary = {
    id: number;
    customer_number: string | null;
    Company?: { name: string | null } | null;
    Person?: {
        first_name: string | null;
        last_name: string | null;
    } | null;
};

export function claimCustomerDisplayName(
    customer: ClaimCustomerSummary | null | undefined
): string {
    if (!customer) {
        return "";
    }
    if (customer.Company?.name) {
        return customer.Company.name;
    }
    const first = customer.Person?.first_name?.trim() || "";
    const last = customer.Person?.last_name?.trim() || "";
    return `${first} ${last}`.trim();
}

export type ClaimPolicySummary = {
    id: number;
    policy_number: string | null;
    policy_kind: string;
    start_date: string | Date;
    end_date: string | Date | null;
    insured_percentage: number | string | null;
    non_qualifying_loss_threshold: number | string | null;
    aggregate_excess: number | string | null;
    sdl_excess: number | string | null;
};

export type ClaimRecord = {
    id: number;
    account_id: number;
    insurance_policy_id: number;
    invoice_id: number | null;
    customer_id: number | null;
    status: ClaimStatus | string;
    recognized_loss: number | string;
    loss_date: string | Date | null;
    policy_year: number;
    submission_date: string | Date | null;
    insurer_submission_reference: string | null;
    applied_sdl_excess: number | string | null;
    applied_aggregate_excess: number | string | null;
    excess_applied: boolean;
    notes: string | null;
    created_at?: string | Date;
    modified_at?: string | Date;
    Invoice?: ClaimInvoiceSummary | null;
    Customer?: ClaimCustomerSummary | null;
    InsurancePolicy?: ClaimPolicySummary | null;
};

export type IssueClaimResult = {
    id: number;
    status: string;
    recognized_loss: number | string;
    invoice_id: number | null;
};

/**
 * Open claim from an invoice: create Draft when eligible, otherwise return
 * existing claim id when one already exists for the invoice.
 */
export async function openClaimFromInvoice(invoiceId: number): Promise<{
    claimId: number;
    created: boolean;
}> {
    try {
        const created = await issueClaimFromInvoice(invoiceId);
        return { claimId: created.id, created: true };
    } catch (e: unknown) {
        if (axios.isAxiosError(e)) {
            const data = e.response?.data as
                | {
                      code?: string;
                      reasons?: ClaimEligibilityFailureReason[];
                      claim_id?: number | null;
                  }
                | undefined;
            const claimId =
                data?.claim_id != null && Number.isFinite(Number(data.claim_id))
                    ? Number(data.claim_id)
                    : null;
            const alreadyExists =
                data?.code === "claim_already_exists" ||
                data?.reasons?.includes("claim_already_exists");
            if (alreadyExists && claimId != null) {
                return { claimId, created: false };
            }
        }
        throw e;
    }
}

export type ClaimsListParams = {
    page?: number;
    limit?: number;
    status?: string;
    customer_id?: number;
    open_only?: boolean;
    /** Only claims on Due/Overdue invoices (banner + unpaid claims report). */
    unpaid_invoice_only?: boolean;
    insurance_policy_id?: number;
    policy_year?: number;
};

export type ClaimsListResponse = {
    claims: ClaimRecord[];
    totalRecords: number;
    page: number;
    limit: number;
};

export type CreateClaimPayload = {
    invoice_id?: number | null;
    /** Required on create (also derived from invoice when Issue Claim). */
    customer_id: number;
    insurance_policy_id?: number | null;
    status?: ClaimStatus | string;
    recognized_loss?: number | string;
    loss_date?: string | null;
    submission_date?: string | null;
    insurer_submission_reference?: string | null;
    notes?: string | null;
    require_eligibility?: boolean;
};

export type UpdateClaimPayload = {
    status?: ClaimStatus | string;
    recognized_loss?: number | string;
    loss_date?: string | null;
    submission_date?: string | null;
    insurer_submission_reference?: string | null;
    notes?: string | null;
};

export async function checkClaimEligibility(
    invoiceId: number
): Promise<ClaimEligibilityResponse> {
    const response = await api.get(
        `/entities/claims/eligibility/${invoiceId}`
    );
    return response.data as ClaimEligibilityResponse;
}

/**
 * Issue Claim from an invoice: server enforces hard eligibility when
 * require_eligibility is true (default).
 */
export async function issueClaimFromInvoice(
    invoiceId: number
): Promise<IssueClaimResult> {
    const response = await api.post("/entities/claims", {
        invoice_id: invoiceId,
        require_eligibility: true,
    });
    return response.data as IssueClaimResult;
}

export async function listClaims(
    params: ClaimsListParams = {}
): Promise<ClaimsListResponse> {
    const response = await api.get("/entities/claims", { params });
    return response.data as ClaimsListResponse;
}

export async function getClaim(id: number): Promise<ClaimRecord> {
    const response = await api.get(`/entities/claims/${id}`);
    return response.data as ClaimRecord;
}

export async function createClaim(
    payload: CreateClaimPayload
): Promise<ClaimRecord> {
    const response = await api.post("/entities/claims", payload);
    return response.data as ClaimRecord;
}

export async function updateClaim(
    id: number,
    payload: UpdateClaimPayload
): Promise<ClaimRecord> {
    const response = await api.put(`/entities/claims/${id}`, payload);
    return response.data as ClaimRecord;
}

export type RemainingExcessYear = {
    insurance_policy_id: number;
    policy_year: number;
    policy_year_start: string | Date;
    policy_year_end: string | Date;
    aggregate_excess: number | null;
    sdl_excess: number | null;
    applied_sdl_excess: number;
    applied_aggregate_excess: number;
    remaining_sdl_excess: number | null;
    remaining_aggregate_excess: number | null;
    claims?: ClaimRecord[];
};

export type PolicyExcessSummaryResponse = {
    insurance_policy_id: number;
    as_of: string | Date;
    aggregate_excess: number | null;
    sdl_excess: number | null;
    years: RemainingExcessYear[];
};

export type PolicyExcessSummaryParams = {
    insurance_policy_id: number;
    /** When set, current anniversary year + prior (n − 1). Omit for all years. */
    recent_years?: number;
    include_claims?: boolean;
    as_of?: string;
};

/**
 * Remaining Aggregate/SDL excess per Primary anniversary year (API-derived).
 * Reuses backend remaining-excess math — do not recompute in the UI.
 */
export async function getPolicyExcessSummary(
    params: PolicyExcessSummaryParams
): Promise<PolicyExcessSummaryResponse> {
    const response = await api.get("/entities/claims/policy-excess-summary", {
        params: {
            insurance_policy_id: params.insurance_policy_id,
            ...(params.recent_years != null
                ? { recent_years: params.recent_years }
                : {}),
            include_claims:
                params.include_claims === false ? "false" : "true",
            ...(params.as_of ? { as_of: params.as_of } : {}),
        },
    });
    return response.data as PolicyExcessSummaryResponse;
}

export async function getRemainingExcess(args: {
    insurance_policy_id: number;
    policy_year: number;
}): Promise<RemainingExcessYear> {
    const response = await api.get("/entities/claims/remaining-excess", {
        params: {
            insurance_policy_id: args.insurance_policy_id,
            policy_year: args.policy_year,
        },
    });
    return response.data as RemainingExcessYear;
}

export function isClaimStatus(value: unknown): value is ClaimStatus {
    return (
        typeof value === "string" &&
        (CLAIM_STATUSES as readonly string[]).includes(value)
    );
}

/** Statuses where recognized loss may still be overridden in the UI. */
export function canOverrideRecognizedLoss(status: string): boolean {
    return (
        status === "Draft" ||
        status === "Submitted" ||
        status === "Under_Inquiry"
    );
}
