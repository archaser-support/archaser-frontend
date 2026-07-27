import { Prisma, dispute_resolution, dispute_status } from "@prisma/client";

export type Customer = Prisma.CustomerGetPayload<{
    select: {
        id: true;
        account_id: true;
        created_at: true;
        modified_at: true;
        customer_number: true;
        crn: true;
        phone: true;
        email: true;
        address_line1: true;
        address_line2: true;
        city: true;
        postal_code: true;
        country_id: true;
        state_id: true;
        owner_id: true;
        collection_status: true;
        language: true;
        first_activity_delay_days: true;
        category_for_new_collection: true;
        total_invoices_overdue: true;
        number_of_overdue_invoices: true;
        type: true;
        company_id: true;
        person_id: true;
        total_due_amount: true;
        no_of_due_invoices: true;
        customer_due_amount1: true;
        customer_due_currency1: true;
        customer_due_amount2: true;
        customer_due_currency2: true;
        total_overdue_amount: true;
        customer_overdue_amount1: true;
        customer_overdue_currency1: true;
        customer_overdue_amount2: true;
        customer_overdue_currency2: true;
        sequence_container_id: true;
        parent_customer_id: true;
        business_unit_id: true;
        generic_text1: true;
        generic_text2: true;
        generic_number1: true;
        generic_number2: true;
        generic_date1: true;
        generic_date2: true;
        oldest_invoice_overdue_date: true;
        overdue_block: true;
        zero_limit_alert_exist: true;
    };
    include: {
        Person: true;
        Company: true;
        Account: true;
        ChildCustomers: {
            select: {
                id: true;
            };
        };
        SequenceContainer: {
            select: {
                id: true;
                name: true;
                category: true;
                is_default: true;
                active: true;
            };
        };
        CustomerCollectionPeriod: {
            where: {
                period_end_date: null;
            };
            include: Record<string, never>;
            select: {
                id: true;
                created_at: true;
                modified_at: true;
                customer_id: true;
                period_start_date: true;
                period_end_date: true;
                last_automated_step: true;
                previous_category: true;
                current_category: true;
                priority: true;
                total_outstanding_amount: true;
                no_of_overdue_invoices: true;
                currency: true;
                customer_due_amount1: true;
                customer_due_currency1: true;
                customer_due_amount2: true;
                customer_due_currency2: true;
                customer_outstanding_amount1: true;
                customer_currency1: true;
                customer_outstanding_amount2: true;
                customer_currency2: true;
                promise_to_pay_date: true;
                promise_to_pay_count: true; // Add this missing field
                last_call_result: true;
                follow_up_time: true;
            };
        };
        Country: true;
        State: true;
        Invoice: true;
        Activity: true;
        Owner: {
            select: {
                id: true;
                first_name: true;
                last_name: true;
                email: true;
            };
        };
    };
}> & {
    customer_number: string | null;
    /** From GET /customers/:id — computed aggregates */
    total_ar?: number | null;
    /** Legacy: AR minus approved limit (floored at 0). Prefer {@link capacity_gap_amount} in UI. */
    uninsured_amount?: number | null;
    /**
     * Open AR above approved limit (alias from active CustomerPolicy, capped at total_ar on GET).
     * Stored uncapped on CustomerPolicy.capacity_gap_amount.
     */
    capacity_gap_amount?: number | null;
    /** Sum of line outstanding on Due/Overdue invoices with any terms-breach flag. */
    terms_breach_outstanding?: number | null;
    /**
     * min(total_ar, capacity_gap_amount + terms_breach_outstanding) — exposure
     * attributed to over-limit plus breach invoices, capped at total AR.
     */
    risk_exposure?: number | null;
    /** True if any Overdue invoice has reporting_breach */
    reporting_breach?: boolean;
    /** Overdue invoices with reporting_breach (customer dashboard). */
    reporting_breach_invoice_count?: number | null;
    /** Due/Overdue invoices flagged ctv_customer_overdue_mep (customer dashboard). */
    overdue_block_invoice_count?: number | null;
    /** ISO code for the parenthetical amount on the credit-insurance Total AR card (e.g. GBP). */
    credit_insurance_secondary_currency?: string | null;
    /** Same as {@link total_ar} converted to {@link credit_insurance_secondary_currency} when rates exist. */
    total_ar_secondary?: number | null;
    capacity_gap_secondary?: number | null;
    terms_breach_outstanding_secondary?: number | null;
    zero_limit_alert_exist?: boolean;
    zero_limit_date?: Date | string | null;
};

export interface CustomerResponse {
    customers: Customer[];
    totalRecords: number;
}

export type CustomerWithActiveDispute = Prisma.CustomerGetPayload<{
    include: {
        Account: true;
        Person: true;
        Company: true;
        Country: true;
        State: true;
        CustomerCollectionPeriod: {
            where: {
                period_end_date: null;
            };
            include: Record<string, never>;
        };
    };
}>;

export type DisputeDetails = {
    id: number;
    created_at: Date;
    modified_at: Date;
    customer_id: number;
    dispute_reason_id: number | null;
    dispute_status: dispute_status | null;
    owner_id: string | null;
    dispute_resolution: dispute_resolution | null;
    customer_comment: string | null;
    customer_collection_period_id: number | null;
    resolution_comment: string | null;
    contact_first_name: string | null;
    contact_last_name: string | null;
    contact_email: string | null;
    contact_mobile: string | null;
    DisputeReason: {
        name: string | null;
    } | null;
    DisputeInvoice: {
        Invoice: {
            invoice_number: string | null;
            amount: number | null;
        };
    }[];
};

// Type for the active dispute that we extract from CustomerWithActiveDispute
// Removed: export type ActiveDispute = NonNullable<
//     CustomerWithActiveDispute["CustomerCollectionPeriod"][number]["CustomerDispute_CustomerCollectionPeriod_active_dispute_idToCustomerDispute"]
// > &
//     DisputeDetails;

/** Active/history policy rows returned from customer detail API during migration. */
export type CustomerPolicyHistoryItem = {
    id: number;
    is_active: boolean;
    insurance_policy_id: number | null;
    customer_number_policy?: string | null;
    approved_limit?: unknown;
    approved_limit_currency?: string | null;
    approved_limit_expiration_date?: Date | string | null;
    zero_limit_date?: Date | string | null;
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
    credit_score_input_date?: Date | string | null;
    active_customer_since?: Date | string | null;
    outdated_dcl?: boolean;
    capacity_gap_amount?: number | null;
    capacity_gap_amount_date?: Date | string | null;
    uninsured_amount?: number | null;
    capacity_gap_amount1?: number | null;
    capacity_gap_currency1?: string | null;
    capacity_gap_amount2?: number | null;
    capacity_gap_currency2?: string | null;
    uninsured_amount1?: number | null;
    uninsured_currency1?: string | null;
    uninsured_amount2?: number | null;
    uninsured_currency2?: string | null;
    /** Open Due/Overdue AR on invoices tagged with this policy (customer GET). */
    policy_open_ar?: number | null;
    /** Terms-breach outstanding on invoices with this policy_id (customer GET). */
    terms_breach_outstanding?: number | null;
    reporting_breach_invoice_count?: number | null;
    overdue_block_invoice_count?: number | null;
    InsurancePolicy?: {
        id: number;
        policy_number: string;
        status?: string;
        start_date?: Date | string | null;
        end_date?: Date | string | null;
    } | null;
};

export type CustomerWithPolicyHistory = Customer & {
    customerPolicies?: CustomerPolicyHistoryItem[];
    activeCustomerPolicy?: CustomerPolicyHistoryItem | null;
};

export interface CustomerStats {
    counts: {
        total_customers: number;
        active_customers: number;
        inactive_customers: number;
        total_due_amount: number;
        total_overdue_amount: number;
        open_invoice_count: number;
        average_outstanding_per_customer: number;
        currency: string;
    };
    category_distribution: Array<{
        category: string;
        count: number;
    }>;
}
