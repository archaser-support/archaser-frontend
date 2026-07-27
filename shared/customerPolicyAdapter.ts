/**
 * Frontend adapter: merge active CustomerPolicy fields onto API customer payloads for forms/display.
 */

export type CustomerPolicyHistoryRow = {
    id: number;
    is_active: boolean;
    insurance_policy_id: number | null;
    customer_number_policy?: string | null;
    approved_limit?: unknown;
    approved_limit_currency?: string | null;
    approved_limit_expiration_date?: string | Date | null;
    zero_limit_date?: string | Date | null;
    limit_type?: string | null;
    max_payment_term?: number | null;
    max_allowed_mep?: number | null;
    reporting_days?: number | null;
    mep_cutoff_day_of_month?: number | null;
    mep_substitute_day_of_month?: number | null;
    reporting_cutoff_day_of_month?: number | null;
    reporting_substitute_day_of_month?: number | null;
    payment_term_cutoff_day_of_month?: number | null;
    payment_term_substitute_day_of_month?: number | null;
    excluded_from_policy?: boolean;
    policy_exclusion_reason?: string | null;
    credit_score?: unknown;
    credit_score_input_date?: string | Date | null;
    active_customer_since?: string | Date | null;
    outdated_dcl?: boolean;
    capacity_gap_amount?: number | null;
    capacity_gap_amount_date?: string | Date | null;
    uninsured_amount?: number | null;
    capacity_gap_amount1?: number | null;
    capacity_gap_currency1?: string | null;
    capacity_gap_amount2?: number | null;
    capacity_gap_currency2?: string | null;
    uninsured_amount1?: number | null;
    uninsured_currency1?: string | null;
    uninsured_amount2?: number | null;
    uninsured_currency2?: string | null;
    modified_at?: string | Date | null;
    modified_by?: string | null;
    User_CustomerPolicy_modified_byToUser?: {
        id?: string;
        name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
        email?: string | null;
    } | null;
    policy_open_ar?: number | null;
    terms_breach_outstanding?: number | null;
    reporting_breach_invoice_count?: number | null;
    overdue_block_invoice_count?: number | null;
    InsurancePolicy?: {
        id: number;
        policy_number: string;
        status?: string;
        start_date?: string | Date | null;
        end_date?: string | Date | null;
    } | null;
};

export type CustomerWithPolicyFields = Record<string, unknown> & {
    policy_id?: number | null;
    activeCustomerPolicy?: CustomerPolicyHistoryRow | null;
    customerPolicies?: CustomerPolicyHistoryRow[];
};

/**
 * Resolve the "active" policy row from a customer payload.
 *
 * Mirrors the server-side intent (active CustomerPolicy is the source of truth)
 * and falls back to the first active row inside history when
 * `activeCustomerPolicy` isn't populated on the payload.
 */
export function getActiveCustomerPolicyFromCustomer(
    customer: CustomerWithPolicyFields | null | undefined
): CustomerPolicyHistoryRow | null {
    if (!customer) {
        return null;
    }
    return (
        customer.activeCustomerPolicy ??
        customer.customerPolicies?.find((p) => p.is_active) ??
        null
    );
}

/** True only when the input represents numeric value 0 (string/number allowed). */
export function isZeroApprovedLimit(value: unknown): boolean {
    if (value == null || value === "") {
        return false;
    }
    const n = Number(String(value).trim());
    return Number.isFinite(n) && n === 0;
}

function activeCustomerPolicyFromNestedRow(
    row: unknown
): CustomerPolicyHistoryRow | null {
    if (!row || typeof row !== "object") {
        return null;
    }
    const customerPolicy = (row as { CustomerPolicy?: unknown }).CustomerPolicy;
    if (Array.isArray(customerPolicy)) {
        const active =
            customerPolicy.find(
                (p) =>
                    p &&
                    typeof p === "object" &&
                    (p as { is_active?: boolean }).is_active === true
            ) ?? customerPolicy[0];
        return active && typeof active === "object"
            ? (active as CustomerPolicyHistoryRow)
            : null;
    }
    if (customerPolicy && typeof customerPolicy === "object") {
        return customerPolicy as CustomerPolicyHistoryRow;
    }
    return null;
}

/** Resolve insurance policy number from a report/view row (flat keys or nested CustomerPolicy). */
export function resolvePolicyNumberFromReportRow(row: unknown): string | null {
    if (!row || typeof row !== "object") {
        return null;
    }
    const r = row as Record<string, unknown>;
    const flatCandidates = [
        r["Invoice.InsurancePolicy.policy_number"],
        r["Invoice.policy_id"],
        r["Customer.InsurancePolicy.policy_number"],
        r["Customer.policy_id"],
        r["InsurancePolicy.policy_number"],
        r.policy_id,
    ];
    for (const candidate of flatCandidates) {
        if (candidate != null && String(candidate).trim() !== "") {
            return String(candidate);
        }
    }
    const raw = r.raw as Record<string, unknown> | undefined;
    if (raw) {
        for (const candidate of [
            raw["Invoice.InsurancePolicy.policy_number"],
            raw["Invoice.policy_id"],
            raw["Customer.InsurancePolicy.policy_number"],
            raw["Customer.policy_id"],
            raw["InsurancePolicy.policy_number"],
            raw.policy_id,
        ]) {
            if (candidate != null && String(candidate).trim() !== "") {
                return String(candidate);
            }
        }
    }
    const invoice = (r.Invoice ?? raw?.Invoice ?? r) as
        | Record<string, unknown>
        | undefined;
    const invoicePolicy = (
        invoice as { InsurancePolicy?: { policy_number?: string } } | undefined
    )?.InsurancePolicy?.policy_number;
    if (invoicePolicy != null && String(invoicePolicy).trim() !== "") {
        return String(invoicePolicy);
    }

    const customer = (r.Customer ?? raw?.Customer) as
        | Record<string, unknown>
        | undefined;
    const active = activeCustomerPolicyFromNestedRow(customer ?? null);
    const fromPolicy = active?.InsurancePolicy?.policy_number;
    if (fromPolicy != null && String(fromPolicy).trim() !== "") {
        return String(fromPolicy);
    }
    const legacyPolicy = (customer as { InsurancePolicy?: { policy_number?: string } } | undefined)
        ?.InsurancePolicy?.policy_number;
    if (legacyPolicy != null && String(legacyPolicy).trim() !== "") {
        return String(legacyPolicy);
    }
    return null;
}

/** True when the customer has a resolvable linked insurance policy id. */
export function customerHasLinkedInsurancePolicy(
    customer: CustomerWithPolicyFields | null | undefined
): boolean {
    if (!customer) {
        return false;
    }
    return getEffectivePolicyId(customer) != null;
}

/** Effective policy id for display/editing (active row or legacy). */
export function getEffectivePolicyId(customer: CustomerWithPolicyFields): number | null {
    const active = customer.activeCustomerPolicy;
    if (active) {
        return active.insurance_policy_id ?? null;
    }
    const policies = customer.customerPolicies;
    if (policies?.length) {
        const row = policies.find((p) => p.is_active) ?? policies[0];
        return row.insurance_policy_id ?? null;
    }
    const pid = customer.policy_id;
    return pid == null ? null : Number(pid);
}

/** Merge effective policy fields onto customer for form display (non-destructive). */
export function applyEffectivePolicyFieldsToCustomer<T extends CustomerWithPolicyFields>(
    customer: T
): T {
    const active =
        customer.activeCustomerPolicy ??
        customer.customerPolicies?.find((p) => p.is_active);
    if (!active) {
        return customer;
    }
    return {
        ...customer,
        policy_id: active.insurance_policy_id ?? null,
        customer_number_policy: active.customer_number_policy ?? null,
        approved_limit: active.approved_limit ?? null,
        approved_limit_currency: active.approved_limit_currency ?? null,
        approved_limit_expiration_date:
            active.approved_limit_expiration_date ?? null,
        zero_limit_date: active.zero_limit_date ?? null,
        limit_type: active.limit_type ?? null,
        max_payment_term: active.max_payment_term ?? null,
        max_allowed_mep: active.max_allowed_mep ?? null,
        reporting_days: active.reporting_days ?? null,
        mep_cutoff_day_of_month: active.mep_cutoff_day_of_month ?? null,
        mep_substitute_day_of_month: active.mep_substitute_day_of_month ?? null,
        reporting_cutoff_day_of_month: active.reporting_cutoff_day_of_month ?? null,
        reporting_substitute_day_of_month:
            active.reporting_substitute_day_of_month ?? null,
        payment_term_cutoff_day_of_month:
            active.payment_term_cutoff_day_of_month ?? null,
        payment_term_substitute_day_of_month:
            active.payment_term_substitute_day_of_month ?? null,
        excluded_from_policy: active.excluded_from_policy ?? false,
        policy_exclusion_reason: active.policy_exclusion_reason ?? null,
        credit_score: active.credit_score ?? null,
        credit_score_input_date: active.credit_score_input_date ?? null,
        active_customer_since: active.active_customer_since ?? null,
        outdated_dcl: active.outdated_dcl ?? false,
    };
}

function coerceOptionalId(value: unknown): number | null | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (value === null || value === "") {
        return null;
    }
    if (typeof value === "object" && value !== null && "id" in value) {
        const n = Number((value as { id: unknown }).id);
        return Number.isNaN(n) ? null : n;
    }
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
}

function coerceOptionalString(value: unknown): string | null | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    return String(value);
}

/** PUT /api/entities/customers/:id — scalar fields only (no nested relations). */
export function buildCustomerPutPayload(
    edited: Record<string, unknown>,
    options?: { confirmPolicySwitch?: boolean }
): Record<string, unknown> {
    const payload: Record<string, unknown> = {
        customer_number: edited.customer_number,
        crn: edited.crn,
        phone: edited.phone,
        email: edited.email,
        address_line1: edited.address_line1,
        address_line2: edited.address_line2,
        city: edited.city,
        postal_code: edited.postal_code,
        country_id: coerceOptionalId(edited.country_id),
        state_id: coerceOptionalId(edited.state_id),
        owner_id: coerceOptionalString(edited.owner_id),
        collection_status: edited.collection_status,
        language: edited.language,
        first_activity_delay_days: edited.first_activity_delay_days,
        customer_name: edited.customer_name,
        customer_type: edited.customer_type,
        category_for_new_collection: edited.category_for_new_collection,
        sequence_container_id: coerceOptionalId(edited.sequence_container_id),
        business_unit_id: coerceOptionalId(edited.business_unit_id),
        parent_customer_id: coerceOptionalId(edited.parent_customer_id),
        generic_text1: edited.generic_text1,
        generic_text2: edited.generic_text2,
        generic_number1: edited.generic_number1,
        generic_number2: edited.generic_number2,
        generic_date1: edited.generic_date1,
        generic_date2: edited.generic_date2,
        policy_id: coerceOptionalId(edited.policy_id),
        customer_number_policy: edited.customer_number_policy,
        approved_limit: edited.approved_limit,
        approved_limit_expiration_date: edited.approved_limit_expiration_date,
        zero_limit_date: edited.zero_limit_date,
        limit_type: edited.limit_type,
        max_payment_term: edited.max_payment_term,
        max_allowed_mep: edited.max_allowed_mep,
        reporting_days: edited.reporting_days,
        mep_cutoff_day_of_month: edited.mep_cutoff_day_of_month,
        mep_substitute_day_of_month: edited.mep_substitute_day_of_month,
        reporting_cutoff_day_of_month: edited.reporting_cutoff_day_of_month,
        reporting_substitute_day_of_month: edited.reporting_substitute_day_of_month,
        payment_term_cutoff_day_of_month: edited.payment_term_cutoff_day_of_month,
        payment_term_substitute_day_of_month:
            edited.payment_term_substitute_day_of_month,
        policy_exclusion_reason: edited.policy_exclusion_reason,
        credit_score: edited.credit_score,
        credit_score_input_date: edited.credit_score_input_date,
        active_customer_since: edited.active_customer_since,
        outdated_dcl: edited.outdated_dcl,
    };

    if (options?.confirmPolicySwitch) {
        payload.confirm_policy_switch = true;
    }

    return payload;
}

/** Strip legacy policy fields from save payload when saving non-policy sections. */
export function stripLegacyPolicyFieldsFromPayload(
    payload: Record<string, unknown>
): Record<string, unknown> {
    const {
        policy_id: _p,
        customer_number_policy: _cnp,
        approved_limit: _al,
        approved_limit_currency: _alc,
        approved_limit_expiration_date: _ale,
        zero_limit_date: _zld,
        limit_type: _lt,
        max_payment_term: _mpt,
        max_allowed_mep: _mam,
        reporting_days: _rd,
        mep_cutoff_day_of_month: _mcd,
        mep_substitute_day_of_month: _msd,
        reporting_cutoff_day_of_month: _rcd,
        reporting_substitute_day_of_month: _rsd,
        payment_term_cutoff_day_of_month: _ptcd,
        payment_term_substitute_day_of_month: _ptsd,
        policy_exclusion_reason: _per,
        credit_score: _cs,
        credit_score_input_date: _csid,
        active_customer_since: _acs,
        outdated_dcl: _od,
        ...rest
    } = payload;
    return rest;
}
