import { Account } from "@/types/Account";

// Type for form data (only the fields that can be edited)
export interface AccountFormData {
    id?: number;
    name?: string | null;
    company_number?: string | null;
    currency?: string | null;
    locale?: string | null;
    balance_evaluation_method?: string | null;
    promise_to_pay?: number | null;
    status?: string | null;
    max_promise_to_pay_allowed_per_cycle?: number | null;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    postal_code?: string | null;
    country_id?: number | null;
    state_id?: number | null;
    category_after_automated?: string | null;
    category_for_new_collection?: string | null;
    default_language?: string | null;
    use_customer_language?: boolean | null;
    wait_days_after_automated?: number | null;
    email_from_name?: string | null;
    email_from?: string | null;
    sms_from_name?: string | null;
    beneficiary_name?: string | null;
    bank_name?: string | null;
    branch_name?: string | null;
    branch_number?: string | null;
    account_number?: string | null;
    swift?: string | null;
    iban?: string | null;
    bank_comments?: string | null;
    sub_domain?: string | null;
    allow_partial_payment?: boolean | null;
    default_first_activity_delay_days?: number | null;
    logo?: string | null;
    logoFile?: File | null;
    primary_color?: string | null;
    secondary_color?: string | null;
    chart_palette_color?: string | null;
    logoPreview?: string | null;
    intelligent_channel_selection_enabled?: boolean | null;
    sms_fallback_enabled?: boolean | null;
    unlisted_country_sms_policy?: string | null;
    portal_verification_enabled?: boolean | null;
    sso_enabled?: boolean | null;
    sso_providers?: string | null;
    has_collection?: boolean | null;
    has_credit_insurance?: boolean | null;
    enable_customer_checkpoints?: boolean | null;
    credit_limit_warning_threshold_pct?: number | null;
    credit_score_validity_warning_days?: number | null;
    reporting_date_warning_days?: number | null;
    customer_limit_expiration_warning_days?: number | null;
    deleted_at?: string | Date | null;
    deleted_by?: string | null;
}

// Type for components that need account data
export type AccountDisplayData = Account | AccountFormData;

export interface CountryType {
    id: number;
    name: string;
    emoji: string | null;
    iso2: string | null;
    iso3: string | null;
    numeric_code: string | null;
    phonecode: string | null;
    capital: string | null;
    currency: string | null;
    currency_name: string | null;
    currency_symbol: string | null;
    tld: string | null;
    native: string | null;
    region: string | null;
    subregion: string | null;
    timezones: string | null;
    translations: string | null;
    latitude: string | null;
    longitude: string | null;
    emojiU: string | null;
    wikiDataId: string | null;
}

export interface StateType {
    id: number;
    name: string;
    country_id: number;
}
