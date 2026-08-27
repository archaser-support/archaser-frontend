import api from "@/app/api";
import type { ConnectorAuthType, BillingProvider, ImportType } from "@/types/db";

import type { MappingRule } from "@/shared/constants/importEntityFields";

export type PullFilterOperator =
    | "eq"
    | "ne"
    | "startswith"
    | "contains"
    | "gt"
    | "lt";

export const PULL_FILTER_OPERATORS: PullFilterOperator[] = [
    "eq",
    "ne",
    "startswith",
    "contains",
    "gt",
    "lt",
];

export interface PullFilterRule {
    field: string;
    operator: PullFilterOperator;
    value: string;
}

export interface AdvancedEntityPullFilter {
    mode: "advanced";
    odata: string;
}

export interface RulesEntityPullFilter {
    mode: "rules";
    rules: PullFilterRule[];
}

export type EntityPullFilterConfig =
    | AdvancedEntityPullFilter
    | RulesEntityPullFilter;

export type EntityPullFilterMode = EntityPullFilterConfig["mode"];

export type PullFiltersMap = Partial<
    Record<ImportType, EntityPullFilterConfig | null>
>;

export interface BillingConnectorConfig {
    id: number;
    account_id: number;
    provider: BillingProvider;
    status: string;
    base_url: string | null;
    auth_type: ConnectorAuthType;
    has_credentials: boolean;
    sync_enabled: boolean;
    sync_cron_expression: string;
    sync_mode: string;
    enabled_entities: ImportType[];
    sync_overlap_minutes: number;
    consecutive_auth_failures: number;
    /** YYYY-MM-DD, or null for full-history backfill. */
    backfill_start_date?: string | null;
    /**
     * When start date is set: also pull unpaid pre-date invoices + related payments.
     * Default true.
     */
    include_older_open_invoices?: boolean;
    /**
     * When true, backfill invoice writes do not set reporting_breach.
     * Default false. Incremental sync and overnight job ignore this.
     */
    skip_reporting_breach_on_backfill?: boolean;
    /** Locked after backfill starts until reset. */
    backfill_options_locked?: boolean;
    /** Optional account-extension key; null/empty = standard path. */
    extension_key?: string | null;
    /** Plugin-owned settings for the attached extension. */
    extension_config?: Record<string, unknown> | null;
    /** Per-entity Priority $filter (rules or advanced OData). */
    pull_filters?: PullFiltersMap;
    /** Per-entity Priority EntitySet name overrides. */
    entity_sets?: Partial<Record<ImportType, string>>;
    /** Cached EntitySet names from $metadata. */
    entity_set_catalog?: string[];
    entity_set_catalog_fetched_at?: string | null;
    /** Contract default table names. */
    default_entity_sets?: Partial<Record<ImportType, string>>;
    /** Per-entity preview go/no-go pass flags. */
    preview_passes?: Partial<
        Record<ImportType, { passed: boolean; completed_at: string }>
    >;
    last_connection_test_at: string | null;
    last_connection_error: string | null;
    created_at: string;
    modified_at: string;
    schedule_summary?: string;
    schedule_preset?:
        | "every_4h"
        | "every_6h"
        | "every_12h"
        | "daily"
        | "weekly"
        | "custom"
        | null;
    daily_time_utc?: string;
    weekly_day?: number;
    next_scheduled_sync_at_utc?: string | null;
    schedule_warning?: string | null;
    sync_states?: ConnectorSyncStatePublic[];
}

export interface ConnectorSyncStatePublic {
    entity_type: ImportType;
    backfill_completed: boolean;
    backfill_completed_at: string | null;
    backfill_cursor_present: boolean;
    backfill_records_pulled: number;
    backfill_total_records: number | null;
    last_max_updated_at: string | null;
    last_successful_run_at: string | null;
    last_attempt_at: string | null;
    last_error: string | null;
}

export interface SyncRunSummary {
    id: string;
    trigger: string;
    sync_mode: string;
    status: string;
    started_at: string;
    completed_at: string | null;
    duration_seconds: number | null;
    entity_stats: Record<
        string,
        {
            pulled: number;
            success: number;
            failed: number;
            skipped: number;
            sample_errors?: string[];
            /** Present for `_maturity` while linking / after it finishes. */
            status?: "running" | "done" | "failed";
        }
    >;
    error_message: string | null;
    error_type: string | null;
    /** Present on backfill runs — start date / older-open / skip-breach. */
    cutover_options?: {
        backfill_start_date: string | null;
        include_older_open_invoices: boolean;
        skip_reporting_breach_on_backfill: boolean;
    } | null;
    cutover_summary?: string | null;
}

export interface UpsertBillingConnectorPayload {
    provider?: BillingProvider;
    base_url?: string | null;
    auth_type?: ConnectorAuthType;
    credentials?: Record<string, unknown> | null;
    sync_enabled?: boolean;
    sync_cron_expression?: string;
    schedule_preset?:
        | "every_4h"
        | "every_6h"
        | "every_12h"
        | "daily"
        | "weekly"
        | "custom";
    daily_time_utc?: string;
    weekly_day?: number;
    enabled_entities?: ImportType[];
    /** YYYY-MM-DD, null/"" to clear. */
    backfill_start_date?: string | null;
    include_older_open_invoices?: boolean;
    skip_reporting_breach_on_backfill?: boolean;
    /** Null/"" clears the extension attachment. */
    extension_key?: string | null;
    extension_config?: Record<string, unknown> | null;
    pull_filters?: PullFiltersMap;
    entity_sets?: Partial<Record<ImportType, string | null>>;
}

const basePath = (accountId: number) =>
    `/api/entities/accounts/${accountId}/billing-connector`;

export async function fetchBillingConnectorConfig(
    accountId: number
): Promise<BillingConnectorConfig | null> {
    const response = await api.get<{ config: BillingConnectorConfig | null }>(
        basePath(accountId)
    );
    return response.data.config;
}

export async function saveBillingConnectorConfig(
    accountId: number,
    payload: UpsertBillingConnectorPayload
): Promise<BillingConnectorConfig> {
    const response = await api.put<{ config: BillingConnectorConfig }>(
        basePath(accountId),
        payload
    );
    return response.data.config;
}

export async function testBillingConnectorConnection(
    accountId: number,
    payload?: {
        base_url?: string;
        auth_type?: ConnectorAuthType;
        credentials?: Record<string, unknown>;
    }
): Promise<{ success: boolean; error?: string; tested_at?: string }> {
    const response = await api.post(
        `${basePath(accountId)}/test`,
        payload ?? {}
    );
    return response.data;
}

export interface ConnectorFieldMappingResponse {
    import_type: ImportType;
    mapping: MappingRule[];
    is_complete: boolean;
    modified_at: string | null;
    modified_by: string | null;
    pull_date_field?: string | null;
    discovered_headers?: string[];
}

export interface DiscoverFieldsResponse {
    import_type: ImportType;
    raw_headers: string[];
    example_values: Record<string, unknown>;
    sample_count: number;
    discovered_at?: string | null;
    archaser_fields: string[];
    required_fields: string[];
    highlighted_fields: string[];
}

export interface PreviewSyncEntityResult {
    import_type: ImportType;
    pulled: number;
    match_count_capped?: boolean;
    sample_rows: Record<string, unknown>[];
    validation_errors: string[];
    sorted_preview: boolean;
    pull_phases?: string[];
    effective_filter?: string | null;
}

export interface PreviewSyncResponse {
    mode: "preview";
    started_at: string;
    completed_at: string;
    cutover?: {
        backfill_start_date: string | null;
        include_older_open_invoices: boolean;
        skip_reporting_breach_on_backfill: boolean;
    };
    cutover_summary?: string | null;
    entities: PreviewSyncEntityResult[];
    go_no_go: {
        required_field_errors: number;
        passed: boolean;
        checks: Array<{
            id: string;
            label: string;
            passed: boolean;
            detail: string;
        }>;
    };
}

export async function fetchBillingConnectorMapping(
    accountId: number,
    importType: ImportType
): Promise<ConnectorFieldMappingResponse | null> {
    const response = await api.get<{
        mapping: ConnectorFieldMappingResponse | null;
    }>(`${basePath(accountId)}/mappings/${importType}`);
    return response.data.mapping;
}

export async function saveBillingConnectorMapping(
    accountId: number,
    importType: ImportType,
    mapping: MappingRule[],
    options?: { pullDateField?: string | null }
): Promise<ConnectorFieldMappingResponse> {
    const response = await api.put<{ mapping: ConnectorFieldMappingResponse }>(
        `${basePath(accountId)}/mappings/${importType}`,
        {
            mapping,
            ...(options && "pullDateField" in options
                ? { pull_date_field: options.pullDateField ?? null }
                : {}),
        }
    );
    return response.data.mapping;
}

export async function fetchBillingConnectorDiscoveredFields(
    accountId: number,
    importType: ImportType
): Promise<DiscoverFieldsResponse> {
    const response = await api.get<DiscoverFieldsResponse>(
        `${basePath(accountId)}/discover-fields/${importType}`
    );
    return response.data;
}

export async function discoverBillingConnectorFields(
    accountId: number,
    importType: ImportType
): Promise<DiscoverFieldsResponse> {
    const response = await api.post<DiscoverFieldsResponse>(
        `${basePath(accountId)}/discover-fields/${importType}`
    );
    return response.data;
}

export async function runBillingConnectorPreviewSync(
    accountId: number,
    importType?: ImportType
): Promise<PreviewSyncResponse> {
    const response = await api.post<{ result: PreviewSyncResponse }>(
        `${basePath(accountId)}/sync`,
        importType ? { importType } : {},
        { params: { mode: "preview", ...(importType ? { importType } : {}) } }
    );
    return response.data.result;
}

export async function runBillingConnectorBackfill(accountId: number) {
    const response = await api.post(`${basePath(accountId)}/sync`, {}, {
        params: { mode: "backfill" },
    });
    return response.data.result;
}

export async function runBillingConnectorIncrementalSync(accountId: number) {
    const response = await api.post(`${basePath(accountId)}/sync`, {}, {
        params: { mode: "incremental" },
    });
    return response.data.result;
}

export async function fetchBillingConnectorSyncRuns(
    accountId: number,
    limit = 25
): Promise<SyncRunSummary[]> {
    const response = await api.get<{ runs: SyncRunSummary[] }>(
        `${basePath(accountId)}/sync-runs`,
        { params: { limit } }
    );
    return response.data.runs;
}

/** Durable Mongo sync history (last 90 days). Live progress stays on `/sync-runs`. */
export async function fetchBillingConnectorSyncHistory(
    accountId: number
): Promise<SyncRunSummary[]> {
    const response = await api.get<{ runs: SyncRunSummary[] }>(
        `${basePath(accountId)}/sync-history`
    );
    return response.data.runs;
}

export async function resetBillingConnectorEntityBackfill(
    accountId: number,
    entityType: ImportType
): Promise<void> {
    await api.post(`${basePath(accountId)}/backfill/reset`, {
        entity_type: entityType,
    });
}

export async function resetBillingConnectorBackfill(
    accountId: number
): Promise<void> {
    await api.post(`${basePath(accountId)}/backfill/reset`, {
        reset_all: true,
    });
}

export async function cancelBillingConnectorSync(accountId: number): Promise<{
    cancelled: boolean;
    execution_id: string | null;
}> {
    const response = await api.post<{
        result: { cancelled: boolean; execution_id: string | null };
    }>(`${basePath(accountId)}/sync/cancel`);
    return response.data.result;
}

export async function refreshBillingConnectorEntitySets(accountId: number): Promise<{
    entity_set_catalog: string[];
    entity_set_catalog_fetched_at: string;
}> {
    const response = await api.post<{
        entity_set_catalog: string[];
        entity_set_catalog_fetched_at: string;
    }>(`${basePath(accountId)}/entity-sets`);
    return response.data;
}
