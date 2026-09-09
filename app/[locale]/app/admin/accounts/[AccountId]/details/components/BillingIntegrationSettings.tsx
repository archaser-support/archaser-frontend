"use client";

import {
    Alert,
    Box,
    Checkbox,
    CircularProgress,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Radio,
    RadioGroup,
    Select,
    Typography,
} from "@mui/material";
import type { ConnectorAuthType, ImportType } from "@/types/db";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, forwardRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
    fetchBillingConnectorConfig,
    fetchBillingConnectorImportCacheCheck,
    fetchBillingConnectorSyncHistory,
    fetchBillingConnectorSyncRuns,
    cancelBillingConnectorSync,
    lookupBillingConnectorCustomerById,
    resetBillingConnectorBackfill,
    refreshBillingConnectorEntitySets,
    runBillingConnectorBackfill,
    runBillingConnectorIncrementalSync,
    runBillingConnectorPreviewSync,
    saveBillingConnectorConfig,
    testBillingConnectorConnection,
    type BillingConnectorConfig,
    type ImportCacheDaySummary,
    type ImportCacheEntityType,
    type ImportCacheRun,
    type PreviewSyncResponse,
    type PullFiltersMap,
    type SyncRunSummary,
    type UpsertBillingConnectorPayload,
} from "@/shared/services/billingConnectorService";
import type { ConnectorFieldMapperHandle } from "@/shared/layout-components/import/ConnectorFieldMapper";
import type { ConnectorEntityPullFilterEditorHandle } from "@/shared/layout-components/import/ConnectorEntityPullFilterEditor";
import { normalizeConnectorEnabledEntities } from "@/shared/constants/importEntityFields";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";
import {
    buildClearBeforeImportConfirmCopy,
    type ClearBeforeImportConfirmCopy,
    type ClearBeforeImportPrefs,
    readClearBeforeImportPrefs,
    resolveClearBeforeImportPayload,
    shouldConfirmStartBackfillClear,
    writeClearBeforeImportPrefs,
} from "@/shared/services/billingConnectorClearBeforeImport";
import {
    getPreviewSyncDisabledReason,
    getResetBackfillDisabledReason,
    getRunIncrementalDisabledReason,
    getStartBackfillDisabledReason,
    getStopImportDisabledReason,
    getBackfillActionPurpose,
    hasPendingDeferredArPostIngest,
    isActiveConnectorSyncRun,
    resolveBackfillActionStage,
    toDateInputValue,
} from "@/shared/services/billingConnectorSyncActions";
import {
    getBillingExtensionPanel,
    listBillingExtensionPanelOptions,
} from "@/shared/billing-extensions/registry";
import {
    buildPlannedBackfillStepKeys,
    canStartFirstBackfill,
    createClearedBackfillProgressSession,
    createOptimisticBackfillRun,
    createSeedingBackfillProgressSession,
    entitiesMissingPreview,
    isPlaceholderBackfillProgressRun,
    mergeSyncRunsPreservingOptimisticRunning,
    previewPassesFromSyncResult,
    readBackfillProgressSession,
    resolveBackfillProgressSession,
    writeBackfillProgressSession,
    zeroBackfillProgressSyncStates,
    type BackfillProgressSession,
} from "@/shared/services/backfillImportProgress";
import {
    BILLING_CONNECTOR_BUSY_POLL_MS,
    billingConnectorQueryKey,
    billingConnectorSyncHistoryQueryKey,
    billingConnectorSyncRunsQueryKey,
    invalidateBillingConnectorQueries,
} from "@/shared/services/billingConnectorQueries";
import BillingConnectionSection from "./BillingConnectionSection";
import BillingScheduleSection from "./BillingScheduleSection";
import BillingEntityWorkspace from "./BillingEntityWorkspace";
import BillingProgressHost from "./BillingProgressHost";
import BillingSyncHistorySection from "./BillingSyncHistorySection";
import {
    DEFAULT_PAID_TOLERANCE,
    ENTITY_OPTIONS,
    NONE_EXTENSION_OPTION,
    firstEnabledEntityTabIndex,
    formatPaidTolerance,
    isClearBeforeImportEntity,
    parsePaidToleranceInput,
    type ExtensionKeyOption,
    type SchedulePresetValue,
} from "./billingIntegrationConstants";

export type BillingIntegrationSettingsHandle = {
    save: () => Promise<void>;
};

interface BillingIntegrationSettingsProps {
    accountId: number;
    canManage: boolean;
}

function renderClearBeforeImportConfirmDescription(
    copy: ClearBeforeImportConfirmCopy
): ReactNode {
    if (!copy.customerScope || !copy.customerScopePrefix) {
        return copy.description;
    }

    const prefixIndex = copy.description.indexOf(copy.customerScopePrefix);
    if (prefixIndex < 0) {
        return copy.description;
    }

    const before = copy.description.slice(
        0,
        prefixIndex + copy.customerScopePrefix.length
    );
    const after = copy.description.slice(
        prefixIndex + copy.customerScopePrefix.length
    );
    const { id, name } = copy.customerScope;

    return (
        <>
            {before}{" "}
            <Box component="span" sx={{ fontWeight: 700 }}>
                {name}
            </Box>
            {" (id "}
            <Box component="span" sx={{ fontWeight: 700 }}>
                {id}
            </Box>
            {")"}
            {after}
        </>
    );
}

const BillingIntegrationSettings = forwardRef<
    BillingIntegrationSettingsHandle,
    BillingIntegrationSettingsProps
>(function BillingIntegrationSettings(
    { accountId, canManage },
    ref
) {
    const { success, error: showError } = useToast();
    const queryClient = useQueryClient();
    const { i18n } = useTranslation(["common"]);
    const isHebrew = i18n.language === "he";

    const { data: config, isLoading } = useQuery({
        queryKey: billingConnectorQueryKey(accountId),
        queryFn: () => fetchBillingConnectorConfig(accountId),
        enabled: accountId > 0,
    });

    const [provider, setProvider] = useState<"PRIORITY" | "SAP_BUSINESS_ONE">(
        "PRIORITY"
    );
    const [baseUrl, setBaseUrl] = useState("");
    const [authType, setAuthType] = useState<ConnectorAuthType>("API_KEY");
    const [apiKeyToken, setApiKeyToken] = useState("");
    const [basicUsername, setBasicUsername] = useState("");
    const [basicPassword, setBasicPassword] = useState("");
    const [oauthClientId, setOauthClientId] = useState("");
    const [oauthClientSecret, setOauthClientSecret] = useState("");
    const [oauthTokenEndpoint, setOauthTokenEndpoint] = useState("");
    const [syncEnabled, setSyncEnabled] = useState(false);
    const [schedulePreset, setSchedulePreset] =
        useState<SchedulePresetValue>("every_6h");
    const [dailyTimeUtc, setDailyTimeUtc] = useState("03:00");
    const [weeklyDay, setWeeklyDay] = useState(1);
    const [syncCron, setSyncCron] = useState("0 */6 * * *");
    const [connectionExpanded, setConnectionExpanded] = useState<
        boolean | null
    >(null);
    const [scheduleExpanded, setScheduleExpanded] = useState<boolean | null>(
        null
    );
    const [mappingExpanded, setMappingExpanded] = useState<boolean | null>(
        null
    );
    const [progressExpanded, setProgressExpanded] = useState<boolean | null>(
        null
    );
    const [historyExpanded, setHistoryExpanded] = useState(false);
    const [enabledEntities, setEnabledEntities] = useState<ImportType[]>([
        "Customer",
        "Contact",
        "Invoice",
        "Payment",
    ]);
    const [mappingComplete, setMappingComplete] = useState<
        Partial<Record<ImportType, boolean>>
    >({});
    const [previewResult, setPreviewResult] =
        useState<PreviewSyncResponse | null>(null);
    /** Blocks re-running preview until mapping or pull filters change again. */
    const [previewUpToDate, setPreviewUpToDate] = useState(false);
    const [mappingEntityTab, setMappingEntityTab] = useState<number | null>(
        null
    );
    const [entityWorkspaceTab, setEntityWorkspaceTab] = useState<
        "mapping" | "pullFilter" | "preview"
    >("mapping");
    const [backfillStartDate, setBackfillStartDate] = useState("");
    const [mepBreachStartDate, setMepBreachStartDate] = useState("");
    const [skipReportingBreachOnBackfill, setSkipReportingBreachOnBackfill] =
        useState(false);
    const [includeOlderOpenInvoices, setIncludeOlderOpenInvoices] =
        useState(true);
    const [invoicePaidTolerance, setInvoicePaidTolerance] = useState(
        formatPaidTolerance(DEFAULT_PAID_TOLERANCE)
    );
    const [invoicePaidToleranceError, setInvoicePaidToleranceError] = useState<
        string | null
    >(null);
    const [extensionKey, setExtensionKey] = useState("");
    const [extensionConfig, setExtensionConfig] = useState<
        Record<string, unknown>
    >({});
    const [resetDialogOpen, setResetDialogOpen] = useState(false);
    const [clearBeforeStartDialogOpen, setClearBeforeStartDialogOpen] =
        useState(false);
    const [cacheSuggestionDialogOpen, setCacheSuggestionDialogOpen] =
        useState(false);
    const [cacheSuggestionRuns, setCacheSuggestionRuns] = useState<
        ImportCacheRun[]
    >([]);
    const [cacheSuggestionDays, setCacheSuggestionDays] = useState<
        ImportCacheDaySummary[]
    >([]);
    const [cacheSuggestionSelectedExecutionId, setCacheSuggestionSelectedExecutionId] =
        useState<string | null>(null);
    const [cacheSuggestionSelection, setCacheSuggestionSelection] = useState<
        Partial<Record<ImportCacheEntityType, boolean>>
    >({});
    const [cacheSuggestionMode, setCacheSuggestionMode] = useState<
        "backfill" | "incremental" | null
    >(null);
    const [cacheSuggestionCacheDay, setCacheSuggestionCacheDay] = useState<
        string | null
    >(null);
    const [cacheSuggestionCustomerId, setCacheSuggestionCustomerId] = useState<
        number | null
    >(null);
    const [cacheSuggestionTimeZone, setCacheSuggestionTimeZone] = useState<
        string | null
    >(null);
    const [cacheSuggestionDayLoading, setCacheSuggestionDayLoading] =
        useState(false);
    const [cacheCheckPending, setCacheCheckPending] = useState(false);
    /** Carried from cache dialog into Start / clear-before confirm. */
    const pendingUseCachedImportRef = useRef<
        | {
              executionId: string;
              entities: ImportCacheEntityType[];
          }
        | undefined
    >(undefined);
    const [clearBeforeImportPrefs, setClearBeforeImportPrefs] =
        useState<ClearBeforeImportPrefs>(() =>
            readClearBeforeImportPrefs(accountId)
        );
    const clearBeforeImportSession = clearBeforeImportPrefs.entities;
    const clearBeforeImportCustomerId = clearBeforeImportPrefs.customerId;
    const clearBeforeImportCustomerLookup =
        clearBeforeImportPrefs.customerId != null
            ? {
                  id: clearBeforeImportPrefs.customerId,
                  name:
                      clearBeforeImportPrefs.customerName ||
                      `Customer ${clearBeforeImportPrefs.customerId}`,
              }
            : null;
    const skipClearBeforeImportPersistRef = useRef(true);
    const [
        clearBeforeImportCustomerError,
        setClearBeforeImportCustomerError,
    ] = useState<string | null>(null);
    const [clearBeforeCustomerValidating, setClearBeforeCustomerValidating] =
        useState(false);
    const [progressSession, setProgressSession] =
        useState<BackfillProgressSession | null>(() =>
            readBackfillProgressSession(accountId)
        );
    const cutoverDirtyRef = useRef(false);
    /** Prevents config reload from clearing preview stale after local mapping/filter edits. */
    const previewStaleRef = useRef(false);
    const mapperRefs = useRef<
        Partial<Record<ImportType, ConnectorFieldMapperHandle | null>>
    >({});
    const pullFilterRefs = useRef<
        Partial<Record<ImportType, ConnectorEntityPullFilterEditorHandle | null>>
    >({});
    const entityTabsRef = useRef<HTMLDivElement | null>(null);
    const entityTabFocusPendingRef = useRef(true);
    /** Keep last live progress run so a brief sync-runs gap does not clear the panel. */
    const lastLiveProgressRunRef = useRef<SyncRunSummary | null>(null);

    useLayoutEffect(() => {
        skipClearBeforeImportPersistRef.current = true;
        setClearBeforeImportPrefs(readClearBeforeImportPrefs(accountId));
        setClearBeforeImportCustomerError(null);
        setClearBeforeStartDialogOpen(false);
        setCacheSuggestionDialogOpen(false);
        setCacheSuggestionRuns([]);
        setCacheSuggestionDays([]);
        setCacheSuggestionSelectedExecutionId(null);
        setCacheSuggestionSelection({});
        setCacheSuggestionMode(null);
        setCacheSuggestionCacheDay(null);
        setCacheSuggestionCustomerId(null);
        setCacheSuggestionTimeZone(null);
        setCacheSuggestionDayLoading(false);
        setCacheCheckPending(false);
        pendingUseCachedImportRef.current = undefined;
    }, [accountId]);

    useEffect(() => {
        if (skipClearBeforeImportPersistRef.current) {
            skipClearBeforeImportPersistRef.current = false;
            return;
        }
        writeClearBeforeImportPrefs(accountId, clearBeforeImportPrefs);
    }, [accountId, clearBeforeImportPrefs]);

    useEffect(() => {
        setProgressSession(readBackfillProgressSession(accountId));
        lastLiveProgressRunRef.current = null;
        setConnectionExpanded(null);
        setScheduleExpanded(null);
        setMappingExpanded(null);
        setProgressExpanded(null);
        setHistoryExpanded(false);
        setMappingEntityTab(null);
        previewStaleRef.current = false;
        setPreviewUpToDate(false);
        entityTabFocusPendingRef.current = true;
    }, [accountId]);

    useEffect(() => {
        if (!config) {
            return;
        }
        setProvider(config.provider);
        setBaseUrl(config.base_url ?? "");
        setAuthType(config.auth_type);
        setSyncEnabled(config.sync_enabled);
        const preset = config.schedule_preset ?? "custom";
        setSchedulePreset(preset);
        setDailyTimeUtc(config.daily_time_utc ?? "03:00");
        setWeeklyDay(config.weekly_day ?? 1);
        setSyncCron(config.sync_cron_expression);
        setEnabledEntities(
            normalizeConnectorEnabledEntities(config.enabled_entities)
        );
        if (!cutoverDirtyRef.current) {
            const nextBackfillStartDate = toDateInputValue(
                config.backfill_start_date
            );
            setBackfillStartDate(nextBackfillStartDate);
            setMepBreachStartDate(
                toDateInputValue(config.mep_breach_start_date)
            );
            setIncludeOlderOpenInvoices(
                config.include_older_open_invoices ?? true
            );
            setSkipReportingBreachOnBackfill(
                Boolean(config.skip_reporting_breach_on_backfill)
            );
        }
        setInvoicePaidTolerance(
            formatPaidTolerance(config.invoice_paid_tolerance)
        );
        setInvoicePaidToleranceError(null);
        setExtensionKey(config.extension_key?.trim() ?? "");
        setExtensionConfig(
            config.extension_config &&
                typeof config.extension_config === "object" &&
                !Array.isArray(config.extension_config)
                ? { ...config.extension_config }
                : {}
        );
    }, [config?.id, config?.modified_at]);

    useEffect(() => {
        if (!config || previewStaleRef.current) {
            return;
        }
        setPreviewUpToDate(
            canStartFirstBackfill({
                enabledEntities: normalizeConnectorEnabledEntities(
                    config.enabled_entities
                ),
                previewPasses: config.preview_passes,
                backfillOptionsLocked: config.backfill_options_locked,
                syncMode: config.sync_mode,
            })
        );
    }, [
        config?.preview_passes,
        config?.backfill_options_locked,
        config?.sync_mode,
        config?.enabled_entities,
    ]);

    const buildCredentials = (): Record<string, unknown> | null => {
        if (authType === "API_KEY") {
            if (!apiKeyToken.trim()) {
                return null;
            }
            return { token: apiKeyToken.trim() };
        }
        if (authType === "BASIC") {
            if (!basicUsername.trim() || !basicPassword) {
                return null;
            }
            return {
                username: basicUsername.trim(),
                password: basicPassword,
            };
        }
        if (
            !oauthClientId.trim() ||
            !oauthClientSecret ||
            !oauthTokenEndpoint.trim()
        ) {
            return null;
        }
        return {
            client_id: oauthClientId.trim(),
            client_secret: oauthClientSecret,
            token_endpoint: oauthTokenEndpoint.trim(),
        };
    };

    const saveMutation = useMutation({
        mutationFn: async (extras?: { pull_filters?: PullFiltersMap }) => {
            const credentials = buildCredentials();
            const payload: UpsertBillingConnectorPayload = {
                provider,
                base_url: baseUrl.trim() || null,
                auth_type: authType,
                sync_enabled: syncEnabled,
                enabled_entities: enabledEntities,
                backfill_start_date: backfillStartDate.trim() || null,
                mep_breach_start_date: mepBreachStartDate.trim() || null,
                include_older_open_invoices: includeOlderOpenInvoices,
                skip_reporting_breach_on_backfill: skipReportingBreachOnBackfill,
                invoice_paid_tolerance:
                    parsePaidToleranceInput(invoicePaidTolerance) ??
                    DEFAULT_PAID_TOLERANCE,
                extension_key: extensionKey.trim() || null,
                extension_config: extensionKey.trim()
                    ? extensionConfig
                    : null,
            };

            if (schedulePreset === "custom") {
                payload.schedule_preset = "custom";
                payload.sync_cron_expression = syncCron.trim();
            } else {
                payload.schedule_preset = schedulePreset;
                if (schedulePreset === "daily" || schedulePreset === "weekly") {
                    payload.daily_time_utc = dailyTimeUtc;
                }
                if (schedulePreset === "weekly") {
                    payload.weekly_day = weeklyDay;
                }
            }
            if (credentials) {
                payload.credentials = credentials;
            }
            if (extras?.pull_filters) {
                payload.pull_filters = extras.pull_filters;
            }
            return saveBillingConnectorConfig(accountId, payload);
        },
        onSuccess: () => {
            cutoverDirtyRef.current = false;
            void invalidateBillingConnectorQueries(queryClient, accountId, {
                syncRuns: false,
            });
            setApiKeyToken("");
            setBasicPassword("");
            setOauthClientSecret("");
        },
    });

    const saveBillingSettingsRef = useRef<
        BillingIntegrationSettingsHandle["save"]
    >(async () => {});
    saveBillingSettingsRef.current = async () => {
        if (!canManage) {
            return;
        }
        const paidTolerance = parsePaidToleranceInput(invoicePaidTolerance);
        if (paidTolerance == null) {
            throw new Error(
                "Paid leftover tolerance must be a number from 0 to 10."
            );
        }
        const pullFiltersLocked = Boolean(config?.backfill_options_locked);
        const pull_filters: PullFiltersMap = {};
        let hasPullFilterEditors = false;
        if (!pullFiltersLocked) {
            for (const { value: entity } of ENTITY_OPTIONS) {
                const editor = pullFilterRefs.current[entity];
                if (!editor) {
                    continue;
                }
                if (!editor.canSaveDraft()) {
                    if (enabledEntities.includes(entity)) {
                        throw new Error(
                            `Cannot save ${entity} pull filter until Priority fields are discovered.`
                        );
                    }
                    continue;
                }
                hasPullFilterEditors = true;
                pull_filters[entity] = editor.getDraftConfig();
            }
        }
        await saveMutation.mutateAsync(
            hasPullFilterEditors ? { pull_filters } : undefined
        );
        await Promise.all(
            ENTITY_OPTIONS.map(({ value: entity }) => {
                const mapper = mapperRefs.current[entity];
                return mapper ? mapper.save() : Promise.resolve(true);
            })
        );
    };

    useImperativeHandle(
        ref,
        () => ({
            save: () => saveBillingSettingsRef.current(),
        }),
        []
    );

    const testMutation = useMutation({
        mutationFn: async () => {
            const credentials = buildCredentials();
            const payload: {
                base_url?: string;
                auth_type?: ConnectorAuthType;
                credentials?: Record<string, unknown>;
            } = {
                base_url: baseUrl.trim(),
                auth_type: authType,
            };
            if (credentials) {
                payload.credentials = credentials;
            }
            return testBillingConnectorConnection(accountId, payload);
        },
        onSuccess: (result) => {
            if (result.success) {
                success("Connection test succeeded");
                void invalidateBillingConnectorQueries(queryClient, accountId, {
                    syncRuns: false,
                });
            } else {
                showError(result.error ?? "Connection test failed");
            }
        },
        onError: (err: unknown) => {
            const message =
                axiosErrorMessage(err) ?? "Connection test failed";
            showError(message);
        },
    });

    const previewMutation = useMutation({
        mutationFn: (options?: { customer_id?: number | null }) =>
            runBillingConnectorPreviewSync(accountId, {
                customer_id: options?.customer_id,
            }),
        onMutate: () => {
            // D3 — Run preview clears the progress panel (empty / zeros).
            const cleared = createClearedBackfillProgressSession();
            setProgressSession(cleared);
            writeBackfillProgressSession(accountId, cleared);
            lastLiveProgressRunRef.current = null;
        },
        onSuccess: (result) => {
            setPreviewResult(result);
            previewStaleRef.current = false;
            setPreviewUpToDate(true);
            // Optimistically apply preview_passes so the primary action flips to
            // Start backfill immediately (invalidate alone leaves a stale gap).
            queryClient.setQueryData<BillingConnectorConfig | null>(
                billingConnectorQueryKey(accountId),
                (current) => {
                    if (!current) {
                        return current;
                    }
                    return {
                        ...current,
                        preview_passes: previewPassesFromSyncResult(
                            result,
                            current.preview_passes
                        ),
                    };
                }
            );
            void invalidateBillingConnectorQueries(queryClient, accountId, {
                syncRuns: true,
            });
            setEntityWorkspaceTab("preview");
            if (result.go_no_go.passed) {
                success("Preview sync passed go/no-go checks");
            } else {
                setMappingExpanded(true);
                const failingEntity =
                    result.entities.find(
                        (entity) => entity.validation_errors.length > 0
                    ) ??
                    result.entities.find(
                        (entity) =>
                            entity.import_type === "Invoice" &&
                            entity.sample_rows.length > 0 &&
                            !entity.sorted_preview
                    );
                if (failingEntity) {
                    const tabIndex = ENTITY_OPTIONS.findIndex(
                        (opt) => opt.value === failingEntity.import_type
                    );
                    if (tabIndex >= 0) {
                        setMappingEntityTab(tabIndex);
                    }
                }
                requestAnimationFrame(() => {
                    entityTabsRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                    });
                });
                showError(
                    "Preview sync completed with validation issues"
                );
            }
        },
        onError: (err: unknown) => {
            void invalidateBillingConnectorQueries(queryClient, accountId, {
                syncRuns: true,
            });
            const message =
                axiosErrorMessage(err) ?? "Preview sync failed";
            showError(message);
        },
    });

    const refreshEntitySetsMutation = useMutation({
        mutationFn: () => refreshBillingConnectorEntitySets(accountId),
        onSuccess: () => {
            success("Priority table catalog refreshed");
            void invalidateBillingConnectorQueries(queryClient, accountId, {
                syncRuns: false,
            });
        },
        onError: (err: unknown) => {
            showError(
                axiosErrorMessage(err) ?? "Failed to refresh Priority tables"
            );
        },
    });

    const handleEntityConfigDirtyChange = useCallback((dirty: boolean) => {
        if (dirty) {
            previewStaleRef.current = true;
            setPreviewUpToDate(false);
        }
    }, []);

    const handleEntitySetChange = useCallback(
        async (importType: ImportType, value: string | null) => {
            try {
                previewStaleRef.current = true;
                setPreviewUpToDate(false);
                await saveBillingConnectorConfig(accountId, {
                    entity_sets: { [importType]: value },
                });
                await invalidateBillingConnectorQueries(queryClient, accountId, {
                    syncRuns: false,
                });
                success(
                    value
                        ? `${importType} Priority table saved`
                        : `${importType} Priority table reset to default`
                );
            } catch (err: unknown) {
                showError(
                    axiosErrorMessage(err) ?? "Failed to save Priority table"
                );
            }
        },
        [accountId, queryClient, showError, success]
    );

    const persistPaidTolerance = useCallback(
        async (value: number) => {
            if (!canManage) {
                return;
            }
            try {
                const saved = await saveBillingConnectorConfig(accountId, {
                    invoice_paid_tolerance: value,
                });
                queryClient.setQueryData(
                    billingConnectorQueryKey(accountId),
                    saved
                );
            } catch (err: unknown) {
                showError(
                    axiosErrorMessage(err) ??
                        "Failed to save paid leftover tolerance"
                );
            }
        },
        [accountId, canManage, queryClient, showError]
    );

    const persistCutoverOptions = useCallback(
        async (patch: UpsertBillingConnectorPayload) => {
            if (!canManage || config?.backfill_options_locked) {
                return;
            }
            cutoverDirtyRef.current = true;
            try {
                const saved = await saveBillingConnectorConfig(
                    accountId,
                    patch
                );
                queryClient.setQueryData(
                    billingConnectorQueryKey(accountId),
                    saved
                );
                cutoverDirtyRef.current = false;
            } catch (err: unknown) {
                showError(
                    axiosErrorMessage(err) ?? "Failed to save cutover options"
                );
            }
        },
        [
            accountId,
            canManage,
            config?.backfill_options_locked,
            queryClient,
            showError,
        ]
    );

    const backfillMutation = useMutation<
        | {
              status?: string;
              execution_id?: string;
              sync_mode?: string;
              trigger?: string;
          }
        | undefined,
        unknown,
        {
            clear_before_import?: Array<
                "Customer" | "Contact" | "Invoice" | "Payment"
            >;
            customer_id?: number | null;
            use_cached_import?: ImportCacheEntityType[];
            use_cached_execution_id?: string;
        },
        { expectPurge: boolean; plannedSteps: string[] }
    >({
        mutationFn: (options) =>
            runBillingConnectorBackfill(accountId, options),
        onMutate: (options) => {
            // Start / Resume → seeding with planned steps (no fake SyncRunSummary).
            const expectPurge =
                (options?.clear_before_import?.length ?? 0) > 0;
            const plannedSteps = buildPlannedBackfillStepKeys(
                enabledEntities,
                expectPurge
            );
            const seeding = createSeedingBackfillProgressSession({
                expectPurge,
                plannedSteps,
            });
            setProgressSession(seeding);
            writeBackfillProgressSession(accountId, seeding);
            lastLiveProgressRunRef.current = null;
            setMappingExpanded(false);
            // Keep the progress accordion open so entity steps stay visible.
            setProgressExpanded(true);
            return { expectPurge, plannedSteps };
        },
        onSuccess: (result, _variables, context) => {
            success(
                result?.status === "RUNNING"
                    ? "Backfill started"
                    : "Backfill sync completed"
            );
            const executionId =
                typeof result?.execution_id === "string"
                    ? result.execution_id
                    : null;
            const expectPurge = context?.expectPurge === true;
            const plannedSteps = context?.plannedSteps;
            if (executionId) {
                if (result?.status === "RUNNING") {
                    const seeded = createOptimisticBackfillRun({
                        executionId,
                        sync_mode: result.sync_mode,
                        trigger: result.trigger,
                    });
                    queryClient.setQueryData<SyncRunSummary[]>(
                        billingConnectorSyncRunsQueryKey(accountId),
                        (runs) => {
                            const rest = (runs ?? []).filter(
                                (run) => run.id !== executionId
                            );
                            return [seeded, ...rest];
                        }
                    );
                }
                const session = createSeedingBackfillProgressSession({
                    expectPurge,
                    executionId,
                    plannedSteps,
                });
                setProgressSession(session);
                writeBackfillProgressSession(accountId, session);
            } else if (result?.status !== "RUNNING") {
                // Completed synchronously — leave seeding for resolver + sync-runs.
                const cleared = createClearedBackfillProgressSession();
                setProgressSession(cleared);
                writeBackfillProgressSession(accountId, cleared);
            }
            // Do not invalidate syncRuns here — preserve the seeded RUNNING row
            // until the busy poller fetches live progress.
            void invalidateBillingConnectorQueries(queryClient, accountId, {
                history: true,
                syncRuns: false,
            });
        },
        onError: (err: unknown) => {
            const cleared = createClearedBackfillProgressSession();
            setProgressSession(cleared);
            writeBackfillProgressSession(accountId, cleared);
            showError(axiosErrorMessage(err) ?? "Backfill sync failed");
        },
    });

    const incrementalMutation = useMutation({
        mutationFn: (options?: {
            use_cached_import?: ImportCacheEntityType[];
            use_cached_execution_id?: string;
        }) => runBillingConnectorIncrementalSync(accountId, options),
        onSuccess: (result: { status?: string } | undefined) => {
            success(
                result?.status === "RUNNING"
                    ? "Incremental sync started"
                    : "Incremental sync completed"
            );
            void invalidateBillingConnectorQueries(queryClient, accountId, {
                history: true,
            });
        },
        onError: (err: unknown) => {
            showError(axiosErrorMessage(err) ?? "Incremental sync failed");
        },
    });

    const resetBackfillMutation = useMutation({
        mutationFn: () => resetBillingConnectorBackfill(accountId),
        onMutate: () => {
            // D3 — Reset clears the progress panel (empty / zeros, drop bound id).
            const cleared = createClearedBackfillProgressSession();
            setProgressSession(cleared);
            writeBackfillProgressSession(accountId, cleared);
            lastLiveProgressRunRef.current = null;
        },
        onSuccess: () => {
            setResetDialogOpen(false);
            success("Backfill reset — start date is editable again");
            void invalidateBillingConnectorQueries(queryClient, accountId, {
                history: true,
            });
        },
        onError: (err: unknown) => {
            showError(axiosErrorMessage(err) ?? "Failed to reset backfill");
        },
    });

    const cancelSyncMutation = useMutation({
        mutationFn: () => cancelBillingConnectorSync(accountId),
        onMutate: () => {
            // Leave seeding / fake Running immediately (D19) — do not wait for
            // the cancel response while an optimistic RUNNING row is still cached.
            const cancelledAt = new Date().toISOString();
            queryClient.setQueryData<SyncRunSummary[]>(
                billingConnectorSyncRunsQueryKey(accountId),
                (runs) => {
                    if (!runs?.length) {
                        return runs;
                    }
                    return runs.map((run) =>
                        run.status === "RUNNING" &&
                        !isPlaceholderBackfillProgressRun(run)
                            ? {
                                  ...run,
                                  status: "TIMEOUT",
                                  error_type: "cancelled",
                                  completed_at: cancelledAt,
                                  error_message: "Sync stopped by operator",
                              }
                            : run
                    );
                }
            );
            // No real execution yet — drop to cleared. With an id, TIMEOUT above
            // lets the resolver settle to finished/cancelled.
            if (
                progressSession?.phase === "seeding" &&
                !progressSession.executionId
            ) {
                const cleared = createClearedBackfillProgressSession();
                setProgressSession(cleared);
                writeBackfillProgressSession(accountId, cleared);
            }
        },
        onSuccess: (result) => {
            success(
                result.cancelled
                    ? "Sync cancel requested"
                    : "No running sync to cancel"
            );
            if (result.cancelled) {
                const cancelledAt = new Date().toISOString();
                queryClient.setQueryData<SyncRunSummary[]>(
                    billingConnectorSyncRunsQueryKey(accountId),
                    (runs) => {
                        if (!runs?.length) {
                            return runs;
                        }
                        if (result.execution_id) {
                            return runs.map((run) =>
                                run.id === result.execution_id
                                    ? {
                                          ...run,
                                          status: "TIMEOUT",
                                          error_type: "cancelled",
                                          completed_at: cancelledAt,
                                          error_message:
                                              "Sync stopped by operator",
                                      }
                                    : run
                            );
                        }
                        return runs.map((run) =>
                            run.status === "RUNNING"
                                ? {
                                      ...run,
                                      status: "TIMEOUT",
                                      error_type: "cancelled",
                                      completed_at: cancelledAt,
                                      error_message:
                                          "Sync stopped by operator",
                                  }
                                : run
                        );
                    }
                );
            }
            void invalidateBillingConnectorQueries(queryClient, accountId, {
                history: true,
            });
        },
        onError: (err: unknown) => {
            showError(axiosErrorMessage(err) ?? "Failed to cancel sync");
        },
    });

    const { data: syncRuns = [], isFetched: syncRunsFetched } = useQuery({
        queryKey: billingConnectorSyncRunsQueryKey(accountId),
        queryFn: async () => {
            const previous = queryClient.getQueryData<SyncRunSummary[]>(
                billingConnectorSyncRunsQueryKey(accountId)
            );
            const fetched = await fetchBillingConnectorSyncRuns(accountId);
            return mergeSyncRunsPreservingOptimisticRunning(
                fetched,
                previous
            );
        },
        enabled: accountId > 0 && Boolean(config?.has_credentials),
        refetchInterval: (query) => {
            const runs = query.state.data ?? [];
            const busy =
                backfillMutation.isPending ||
                progressSession?.phase === "seeding" ||
                progressSession?.phase === "running" ||
                runs.some(isActiveConnectorSyncRun);
            return busy ? BILLING_CONNECTOR_BUSY_POLL_MS : false;
        },
    });

    const {
        data: syncHistory = [],
        isLoading: syncHistoryLoading,
        isFetching: syncHistoryFetching,
    } = useQuery({
        queryKey: billingConnectorSyncHistoryQueryKey(accountId),
        queryFn: () => fetchBillingConnectorSyncHistory(accountId),
        enabled: accountId > 0 && Boolean(config?.has_credentials),
    });

    const syncInProgress = syncRuns.some(isActiveConnectorSyncRun);
    const wasSyncInProgressRef = useRef(false);
    useEffect(() => {
        if (wasSyncInProgressRef.current && !syncInProgress) {
            void invalidateBillingConnectorQueries(queryClient, accountId, {
                config: false,
                syncRuns: false,
                history: true,
            });
        }
        wasSyncInProgressRef.current = syncInProgress;
    }, [accountId, queryClient, syncInProgress]);

    const progressResolution = resolveBackfillProgressSession({
        syncRuns,
        syncRunsFetched,
        sessionHint: progressSession,
        seedingActive: backfillMutation.isPending,
        seedingExpectPurge: progressSession?.expectPurge === true,
        seedingExecutionId:
            progressSession?.phase === "seeding"
                ? progressSession.executionId
                : null,
        seedingPlannedSteps: progressSession?.plannedSteps,
        pendingArPostIngestCustomers:
            config?.pending_ar_post_ingest_customers,
    });
    const progressSessionResolved = progressResolution.session;
    const progressRun = progressResolution.boundRun;
    if (
        progressRun &&
        !isPlaceholderBackfillProgressRun(progressRun) &&
        progressRun.id
    ) {
        lastLiveProgressRunRef.current = progressRun;
    }

    // Real sync-run only — seeding paints from session (no pending-backfill).
    const displayProgressRun = useMemo(() => {
        if (progressRun) {
            return progressRun;
        }
        if (progressSessionResolved.phase === "cleared") {
            return null;
        }
        if (progressSessionResolved.phase === "seeding") {
            return null;
        }
        // Brief mid-import gap: reuse in-memory live snapshot only when phase
        // is already running — never invent Running from idle storage.
        if (
            progressSessionResolved.phase === "running" &&
            progressSessionResolved.executionId
        ) {
            const last = lastLiveProgressRunRef.current;
            if (last?.id === progressSessionResolved.executionId) {
                return last;
            }
        }
        return null;
    }, [
        progressRun,
        progressSessionResolved.phase,
        progressSessionResolved.executionId,
    ]);
    const displayProgressRunActive = Boolean(
        displayProgressRun &&
            isActiveConnectorSyncRun(displayProgressRun) &&
            !isPlaceholderBackfillProgressRun(displayProgressRun)
    );
    const displaySyncStates = progressResolution.zeroCounts
        ? zeroBackfillProgressSyncStates(config?.sync_states)
        : config?.sync_states;
    // Planned Record deletion for seeding only — never after bind (D5).
    const showDeletingProgressStep =
        progressSessionResolved.phase === "seeding" &&
        (progressResolution.expectDeletingStep ||
            progressSessionResolved.expectPurge === true);
    const deferredArPostIngestPending = hasPendingDeferredArPostIngest(
        config?.pending_ar_post_ingest_customers
    );
    const importBusy =
        syncInProgress ||
        backfillMutation.isPending ||
        incrementalMutation.isPending ||
        progressSessionResolved.phase === "seeding" ||
        progressSessionResolved.phase === "running" ||
        Boolean(
            progressRun && isActiveConnectorSyncRun(progressRun)
        );
    const progressRunStopping =
        displayProgressRun?.status === "TIMEOUT" &&
        displayProgressRun.error_type === "cancelled" &&
        !displayProgressRun.completed_at;
    const showProgressStopButton =
        canManage &&
        Boolean(displayProgressRun) &&
        !isPlaceholderBackfillProgressRun(displayProgressRun) &&
        (displayProgressRun?.status === "RUNNING" || progressRunStopping);

    useEffect(() => {
        const next = progressSessionResolved;
        if (
            next?.phase === progressSession?.phase &&
            next?.executionId === progressSession?.executionId &&
            next?.expectPurge === progressSession?.expectPurge &&
            next?.dismissed === progressSession?.dismissed &&
            JSON.stringify(next?.plannedSteps) ===
                JSON.stringify(progressSession?.plannedSteps)
        ) {
            return;
        }
        setProgressSession(next);
        writeBackfillProgressSession(accountId, next);
    }, [accountId, progressSessionResolved, progressSession]);

    // Single busy poller — replaces stacked refetchInterval + invalidate loops.
    useEffect(() => {
        const shouldPoll =
            backfillMutation.isPending ||
            progressSessionResolved.phase === "seeding" ||
            progressSessionResolved.phase === "running" ||
            progressSessionResolved.phase === "deferred_drain" ||
            incrementalMutation.isPending ||
            previewMutation.isPending ||
            syncInProgress ||
            displayProgressRunActive ||
            deferredArPostIngestPending;
        if (!shouldPoll) {
            return;
        }
        const poll = () => {
            void invalidateBillingConnectorQueries(queryClient, accountId);
        };
        poll();
        const timer = window.setInterval(
            poll,
            BILLING_CONNECTOR_BUSY_POLL_MS
        );
        return () => window.clearInterval(timer);
    }, [
        accountId,
        queryClient,
        backfillMutation.isPending,
        progressSessionResolved.phase,
        incrementalMutation.isPending,
        previewMutation.isPending,
        syncInProgress,
        displayProgressRunActive,
        deferredArPostIngestPending,
    ]);

    const entitiesForMapping = useMemo(
        () =>
            ENTITY_OPTIONS.map((opt) => opt.value).filter((entity) =>
                enabledEntities.includes(entity)
            ),
        [enabledEntities]
    );
    const selectedMappingEntityTab = Math.min(
        mappingEntityTab ?? firstEnabledEntityTabIndex(enabledEntities),
        Math.max(0, ENTITY_OPTIONS.length - 1)
    );

    const previewGateParams = {
        enabledEntities: entitiesForMapping,
        previewPasses: config?.preview_passes,
        backfillOptionsLocked: config?.backfill_options_locked,
        syncMode: config?.sync_mode,
    };
    const missingPreviewEntities = entitiesMissingPreview(previewGateParams);
    const previewBlocked = !canStartFirstBackfill(previewGateParams);
    const startBackfillDisabledReason = config
        ? getStartBackfillDisabledReason({
              canManage,
              syncInProgress: importBusy,
              backfillPending: backfillMutation.isPending,
              syncMode: config.sync_mode,
              previewBlocked,
              previewBlockedEntities: missingPreviewEntities,
              pendingArPostIngestCustomers:
                  config.pending_ar_post_ingest_customers,
          })
        : "Billing connector is still loading.";
    const resetBackfillDisabledReason = getResetBackfillDisabledReason({
        canManage,
        resetPending: resetBackfillMutation.isPending,
        syncInProgress: importBusy,
    });
    const runIncrementalDisabledReason = config
        ? getRunIncrementalDisabledReason({
              canManage,
              syncInProgress: importBusy,
              incrementalPending: incrementalMutation.isPending,
              syncMode: config.sync_mode,
          })
        : "Billing connector is still loading.";

    const showStopImport =
        canManage &&
        (showProgressStopButton ||
            (syncInProgress &&
                !progressRun &&
                progressSessionResolved.phase !== "seeding"));

    const previewRequired = previewBlocked || !previewUpToDate;

    const actionStage = config
        ? resolveBackfillActionStage({
              syncMode: config.sync_mode,
              previewBlocked: previewRequired,
              backfillOptionsLocked: Boolean(config.backfill_options_locked),
              syncStates: config.sync_states,
              enabledEntities,
              importBusy,
              showStopImport,
          })
        : null;

    const previewSyncDisabledReason = getPreviewSyncDisabledReason({
        canManage,
        previewPending: previewMutation.isPending,
        importBusy,
        previewUpToDate,
    });

    const stopImportDisabledReason = getStopImportDisabledReason({
        canManage,
        stopPending: cancelSyncMutation.isPending,
        stopInProgress: progressRunStopping,
    });

    const primaryDisabledReason = (() => {
        if (!actionStage) {
            return "Billing connector is still loading.";
        }
        switch (actionStage.primaryAction) {
            case "preview":
                return previewSyncDisabledReason;
            case "start_backfill":
            case "resume_backfill":
                return startBackfillDisabledReason;
            case "incremental":
                return runIncrementalDisabledReason;
            case "stop":
                return stopImportDisabledReason;
            default:
                return null;
        }
    })();

    const showPrimaryAction =
        actionStage &&
        (actionStage.stage !== "import_running" || actionStage.showStop);

    const takePendingUseCachedImport = useCallback(():
        | {
              executionId: string;
              entities: ImportCacheEntityType[];
          }
        | undefined => {
        const selected = pendingUseCachedImportRef.current;
        pendingUseCachedImportRef.current = undefined;
        return selected &&
            selected.executionId &&
            selected.entities.length > 0
            ? selected
            : undefined;
    }, []);

    const proceedBackfillStart = useCallback(
        (options?: {
            clear_before_import?: Array<
                "Customer" | "Contact" | "Invoice" | "Payment"
            >;
            customer_id?: number | null;
            use_cached_import?: ImportCacheEntityType[];
            use_cached_execution_id?: string;
        }) => {
            const pending =
                options && "use_cached_import" in options
                    ? options.use_cached_import &&
                      options.use_cached_import.length > 0 &&
                      options.use_cached_execution_id
                        ? {
                              executionId: options.use_cached_execution_id,
                              entities: options.use_cached_import,
                          }
                        : undefined
                    : takePendingUseCachedImport();
            if (options && "use_cached_import" in options) {
                pendingUseCachedImportRef.current = undefined;
            }
            backfillMutation.mutate({
                ...(options?.clear_before_import &&
                options.clear_before_import.length > 0
                    ? { clear_before_import: options.clear_before_import }
                    : {}),
                ...(typeof options?.customer_id === "number" &&
                options.customer_id > 0
                    ? { customer_id: options.customer_id }
                    : {}),
                ...(pending
                    ? {
                          use_cached_import: pending.entities,
                          use_cached_execution_id: pending.executionId,
                      }
                    : {}),
            });
        },
        [backfillMutation, takePendingUseCachedImport]
    );

    const proceedIncrementalStart = useCallback(
        (options?: {
            use_cached_import?: ImportCacheEntityType[];
            use_cached_execution_id?: string;
        }) => {
            const pending =
                options && "use_cached_import" in options
                    ? options.use_cached_import &&
                      options.use_cached_import.length > 0 &&
                      options.use_cached_execution_id
                        ? {
                              executionId: options.use_cached_execution_id,
                              entities: options.use_cached_import,
                          }
                        : undefined
                    : takePendingUseCachedImport();
            if (options && "use_cached_import" in options) {
                pendingUseCachedImportRef.current = undefined;
            }
            incrementalMutation.mutate(
                pending
                    ? {
                          use_cached_import: pending.entities,
                          use_cached_execution_id: pending.executionId,
                      }
                    : undefined
            );
        },
        [incrementalMutation, takePendingUseCachedImport]
    );

    const applyCacheRunSelection = useCallback(
        (run: ImportCacheRun | undefined) => {
            if (!run) {
                setCacheSuggestionSelectedExecutionId(null);
                setCacheSuggestionSelection({});
                return;
            }
            setCacheSuggestionSelectedExecutionId(run.execution_id);
            const selection: Partial<
                Record<ImportCacheEntityType, boolean>
            > = {};
            for (const entity of run.entities) {
                if (
                    entity.available &&
                    enabledEntities.includes(entity.import_type)
                ) {
                    selection[entity.import_type] = false;
                }
            }
            setCacheSuggestionSelection(selection);
        },
        [enabledEntities]
    );

    const offerCacheOrStart = useCallback(
        async (args: {
            mode: "backfill" | "incremental";
            customerId?: number | null;
            onNoCache: () => void;
        }) => {
            setCacheCheckPending(true);
            try {
                const check = await fetchBillingConnectorImportCacheCheck(
                    accountId,
                    {
                        mode: args.mode,
                        customer_id: args.customerId,
                    }
                );
                const days = check.days ?? [];
                const runsWithEntities = (check.runs ?? []).filter((run) =>
                    run.entities.some(
                        (entity) =>
                            entity.available &&
                            enabledEntities.includes(entity.import_type)
                    )
                );
                if (days.length === 0 || runsWithEntities.length === 0) {
                    pendingUseCachedImportRef.current = undefined;
                    args.onNoCache();
                    return;
                }
                setCacheSuggestionDays(days);
                setCacheSuggestionRuns(runsWithEntities);
                setCacheSuggestionCacheDay(
                    check.cache_day ?? days[0]?.cache_day ?? null
                );
                setCacheSuggestionCustomerId(
                    typeof args.customerId === "number" ? args.customerId : null
                );
                setCacheSuggestionTimeZone(check.time_zone);
                setCacheSuggestionMode(args.mode);
                applyCacheRunSelection(runsWithEntities[0]);
                setCacheSuggestionDialogOpen(true);
            } catch {
                // Cache suggestion is optional — backend may not expose
                // /sync/cache-check yet. Proceed with a normal ERP pull.
                pendingUseCachedImportRef.current = undefined;
                args.onNoCache();
            } finally {
                setCacheCheckPending(false);
            }
        },
        [accountId, enabledEntities, applyCacheRunSelection]
    );

    const handleCacheSuggestionDayChange = useCallback(
        async (nextDay: string) => {
            if (
                !cacheSuggestionMode ||
                !nextDay ||
                nextDay === cacheSuggestionCacheDay
            ) {
                return;
            }
            setCacheSuggestionDayLoading(true);
            setCacheSuggestionCacheDay(nextDay);
            setCacheSuggestionRuns([]);
            applyCacheRunSelection(undefined);
            try {
                const check = await fetchBillingConnectorImportCacheCheck(
                    accountId,
                    {
                        mode: cacheSuggestionMode,
                        customer_id: cacheSuggestionCustomerId,
                        cache_day: nextDay,
                    }
                );
                if (check.days?.length) {
                    setCacheSuggestionDays(check.days);
                }
                const runsWithEntities = (check.runs ?? []).filter((run) =>
                    run.entities.some(
                        (entity) =>
                            entity.available &&
                            enabledEntities.includes(entity.import_type)
                    )
                );
                setCacheSuggestionRuns(runsWithEntities);
                applyCacheRunSelection(runsWithEntities[0]);
            } catch {
                setCacheSuggestionRuns([]);
                applyCacheRunSelection(undefined);
            } finally {
                setCacheSuggestionDayLoading(false);
            }
        },
        [
            accountId,
            cacheSuggestionMode,
            cacheSuggestionCacheDay,
            cacheSuggestionCustomerId,
            enabledEntities,
            applyCacheRunSelection,
        ]
    );

    const handlePrimaryAction = () => {
        if (!actionStage) {
            return;
        }
        switch (actionStage.primaryAction) {
            case "preview":
                previewMutation.mutate({
                    customer_id: clearBeforeImportCustomerId,
                });
                break;
            case "start_backfill": {
                void (async () => {
                    const clearBeforeImport = resolveClearBeforeImportPayload({
                        session: clearBeforeImportSession,
                        enabledEntities,
                    });
                    const customerId = clearBeforeImportCustomerId;
                    setClearBeforeImportCustomerError(null);
                    if (customerId != null) {
                        if (
                            clearBeforeImportCustomerLookup?.id === customerId
                        ) {
                            // Already resolved from autocomplete selection.
                        } else {
                            setClearBeforeCustomerValidating(true);
                            try {
                                const customer =
                                    await lookupBillingConnectorCustomerById(
                                        accountId,
                                        customerId
                                    );
                                setClearBeforeImportPrefs((prev) => ({
                                    ...prev,
                                    customerId: customer.id,
                                    customerName: customer.name,
                                }));
                            } catch (err) {
                                setClearBeforeImportCustomerError(
                                    axiosErrorMessage(err) ??
                                        `Customer not found on this account: id ${customerId}`
                                );
                                return;
                            } finally {
                                setClearBeforeCustomerValidating(false);
                            }
                        }
                    }
                    const continueStart = () => {
                        if (
                            shouldConfirmStartBackfillClear({
                                clearBeforeImport,
                                customerId,
                            })
                        ) {
                            setClearBeforeStartDialogOpen(true);
                            return;
                        }
                        proceedBackfillStart();
                    };
                    await offerCacheOrStart({
                        mode: "backfill",
                        customerId,
                        onNoCache: continueStart,
                    });
                })();
                break;
            }
            case "resume_backfill":
                // Resume never sends clear_before_import, customer_id, or cache.
                backfillMutation.mutate({});
                break;
            case "incremental":
                void offerCacheOrStart({
                    mode: "incremental",
                    onNoCache: () => proceedIncrementalStart(),
                });
                break;
            case "stop":
                cancelSyncMutation.mutate();
                break;
            default:
                break;
        }
    };

    const handleCacheSuggestionConfirm = useCallback(() => {
        const selectedRun = cacheSuggestionRuns.find(
            (run) => run.execution_id === cacheSuggestionSelectedExecutionId
        );
        const selected = selectedRun
            ? selectedRun.entities
                  .filter(
                      (entity) =>
                          entity.available &&
                          cacheSuggestionSelection[entity.import_type]
                  )
                  .map((entity) => entity.import_type)
            : [];
        pendingUseCachedImportRef.current =
            selected.length > 0 && selectedRun
                ? {
                      executionId: selectedRun.execution_id,
                      entities: selected,
                  }
                : undefined;
        const mode = cacheSuggestionMode;
        setCacheSuggestionDialogOpen(false);
        setCacheSuggestionMode(null);
        if (mode === "incremental") {
            proceedIncrementalStart(
                selected.length > 0 && selectedRun
                    ? {
                          use_cached_import: selected,
                          use_cached_execution_id: selectedRun.execution_id,
                      }
                    : { use_cached_import: [] }
            );
            return;
        }
        if (mode !== "backfill") {
            return;
        }
        const clearBeforeImport = resolveClearBeforeImportPayload({
            session: clearBeforeImportSession,
            enabledEntities,
        });
        const customerId = clearBeforeImportCustomerId;
        if (
            shouldConfirmStartBackfillClear({
                clearBeforeImport,
                customerId,
            })
        ) {
            setClearBeforeStartDialogOpen(true);
            return;
        }
        proceedBackfillStart({
            ...(customerId != null ? { customer_id: customerId } : {}),
            ...(selected.length > 0 && selectedRun
                ? {
                      use_cached_import: selected,
                      use_cached_execution_id: selectedRun.execution_id,
                  }
                : { use_cached_import: [] }),
        });
    }, [
        cacheSuggestionRuns,
        cacheSuggestionSelectedExecutionId,
        cacheSuggestionSelection,
        cacheSuggestionMode,
        clearBeforeImportSession,
        clearBeforeImportCustomerId,
        enabledEntities,
        proceedBackfillStart,
        proceedIncrementalStart,
    ]);

    const handleCacheSuggestionCancel = useCallback(() => {
        // Skip cache → full ERP (H8). Same path as Continue with nothing checked.
        const mode = cacheSuggestionMode;
        setCacheSuggestionDialogOpen(false);
        setCacheSuggestionMode(null);
        setCacheSuggestionRuns([]);
        setCacheSuggestionDays([]);
        setCacheSuggestionSelectedExecutionId(null);
        setCacheSuggestionSelection({});
        setCacheSuggestionCacheDay(null);
        setCacheSuggestionCustomerId(null);
        setCacheSuggestionTimeZone(null);
        setCacheSuggestionDayLoading(false);
        pendingUseCachedImportRef.current = undefined;
        if (mode === "incremental") {
            proceedIncrementalStart({ use_cached_import: [] });
            return;
        }
        if (mode !== "backfill") {
            return;
        }
        const clearBeforeImport = resolveClearBeforeImportPayload({
            session: clearBeforeImportSession,
            enabledEntities,
        });
        const customerId = clearBeforeImportCustomerId;
        if (
            shouldConfirmStartBackfillClear({
                clearBeforeImport,
                customerId,
            })
        ) {
            setClearBeforeStartDialogOpen(true);
            return;
        }
        proceedBackfillStart({
            ...(customerId != null ? { customer_id: customerId } : {}),
            use_cached_import: [],
        });
    }, [
        cacheSuggestionMode,
        clearBeforeImportSession,
        clearBeforeImportCustomerId,
        enabledEntities,
        proceedBackfillStart,
        proceedIncrementalStart,
    ]);

    const selectedCacheRun = useMemo(
        () =>
            cacheSuggestionRuns.find(
                (run) =>
                    run.execution_id === cacheSuggestionSelectedExecutionId
            ) ?? null,
        [cacheSuggestionRuns, cacheSuggestionSelectedExecutionId]
    );

    const cacheSuggestionDescription = useMemo(() => {
        const formatRunTime = (iso: string) => {
            try {
                return new Date(iso).toLocaleString(undefined, {
                    timeZone: cacheSuggestionTimeZone ?? undefined,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                });
            } catch {
                return new Date(iso).toLocaleTimeString();
            }
        };
        const formatRunEntityCounts = (run: ImportCacheRun) =>
            run.entities
                .filter(
                    (entity) =>
                        entity.available &&
                        enabledEntities.includes(entity.import_type)
                )
                .map(
                    (entity) =>
                        `${entity.import_type} ${entity.row_count.toLocaleString()}`
                )
                .join(" · ");

        return (
            <Box display="flex" flexDirection="column" gap={1.5}>
                <Typography variant="body2">
                    Import backups within the 6-month retention window are
                    available. Pick a day, then a run, then select entities to
                    load from that run&apos;s cache. Leave all unchecked (or
                    cancel) to fetch everything from the ERP.
                </Typography>
                {cacheSuggestionDays.length > 0 ? (
                    <FormControl fullWidth size="small">
                        <InputLabel id="cache-suggestion-day-label">
                            Cache day
                        </InputLabel>
                        <Select
                            labelId="cache-suggestion-day-label"
                            label="Cache day"
                            value={cacheSuggestionCacheDay ?? ""}
                            disabled={cacheSuggestionDayLoading}
                            onChange={(e) => {
                                void handleCacheSuggestionDayChange(
                                    String(e.target.value)
                                );
                            }}
                        >
                            {cacheSuggestionDays.map((day) => (
                                <MenuItem
                                    key={day.cache_day}
                                    value={day.cache_day}
                                >
                                    {day.cache_day}
                                    {day.run_count > 0
                                        ? ` (${day.run_count} run${day.run_count === 1 ? "" : "s"})`
                                        : ""}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                ) : null}
                {cacheSuggestionDayLoading ? (
                    <Box display="flex" justifyContent="center" py={1}>
                        <CircularProgress size={24} />
                    </Box>
                ) : (
                    <RadioGroup
                        value={cacheSuggestionSelectedExecutionId ?? ""}
                        onChange={(e) => {
                            const run = cacheSuggestionRuns.find(
                                (item) => item.execution_id === e.target.value
                            );
                            applyCacheRunSelection(run);
                        }}
                    >
                        {cacheSuggestionRuns.map((run) => (
                            <FormControlLabel
                                key={run.execution_id}
                                value={run.execution_id}
                                control={<Radio />}
                                label={`${formatRunTime(run.created_at)} — ${formatRunEntityCounts(run) || "no entities"}`}
                            />
                        ))}
                    </RadioGroup>
                )}
                {!cacheSuggestionDayLoading &&
                cacheSuggestionRuns.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        No selectable runs on this day.
                    </Typography>
                ) : null}
                {selectedCacheRun ? (
                    <Box display="flex" flexDirection="column" gap={0.5}>
                        {selectedCacheRun.entities
                            .filter(
                                (entity) =>
                                    entity.available &&
                                    enabledEntities.includes(
                                        entity.import_type
                                    )
                            )
                            .map((entity) => (
                                <FormControlLabel
                                    key={entity.import_type}
                                    control={
                                        <Checkbox
                                            checked={Boolean(
                                                cacheSuggestionSelection[
                                                    entity.import_type
                                                ]
                                            )}
                                            onChange={(e) => {
                                                setCacheSuggestionSelection(
                                                    (prev) => ({
                                                        ...prev,
                                                        [entity.import_type]:
                                                            e.target.checked,
                                                    })
                                                );
                                            }}
                                        />
                                    }
                                    label={`${entity.import_type} (${entity.row_count.toLocaleString()} rows)`}
                                />
                            ))}
                    </Box>
                ) : null}
            </Box>
        );
    }, [
        cacheSuggestionRuns,
        cacheSuggestionDays,
        cacheSuggestionSelectedExecutionId,
        cacheSuggestionSelection,
        cacheSuggestionCacheDay,
        cacheSuggestionTimeZone,
        cacheSuggestionDayLoading,
        selectedCacheRun,
        enabledEntities,
        applyCacheRunSelection,
        handleCacheSuggestionDayChange,
    ]);

    const clearBeforeStartConfirmCopy = useMemo(() => {
        const clearBeforeImport = resolveClearBeforeImportPayload({
            session: clearBeforeImportSession,
            enabledEntities,
        });
        const customerId = clearBeforeImportCustomerId;
        return buildClearBeforeImportConfirmCopy({
            clearBeforeImport,
            scope: customerId != null ? "customer" : "account",
            customerId,
            customerName:
                customerId != null &&
                clearBeforeImportCustomerLookup?.id === customerId
                    ? clearBeforeImportCustomerLookup.name
                    : null,
        });
    }, [
        clearBeforeImportSession,
        clearBeforeImportCustomerId,
        clearBeforeImportCustomerLookup,
        enabledEntities,
    ]);

    const clearBeforeStartConfirmDescription = useMemo(
        () =>
            renderClearBeforeImportConfirmDescription(
                clearBeforeStartConfirmCopy
            ),
        [clearBeforeStartConfirmCopy]
    );

    const primaryPending =
        clearBeforeCustomerValidating ||
        cacheCheckPending ||
        (actionStage?.primaryAction === "preview" &&
            previewMutation.isPending) ||
        (actionStage?.primaryAction === "incremental" &&
            incrementalMutation.isPending) ||
        ((actionStage?.primaryAction === "start_backfill" ||
            actionStage?.primaryAction === "resume_backfill") &&
            backfillMutation.isPending) ||
        (actionStage?.primaryAction === "stop" &&
            (cancelSyncMutation.isPending || progressRunStopping));

    const primaryPurpose = actionStage
        ? getBackfillActionPurpose(actionStage.primaryAction)
        : "";

    const primaryTooltipTitle = actionStage ? (
        primaryDisabledReason ? (
            <Box>
                <Typography variant="body2">{primaryPurpose}</Typography>
                {actionStage.caption ? (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                        {actionStage.caption}
                    </Typography>
                ) : null}
                <Typography variant="body2" sx={{ mt: 1 }}>
                    {primaryDisabledReason}
                </Typography>
            </Box>
        ) : (
            <Box>
                <Typography variant="body2">{primaryPurpose}</Typography>
                {actionStage.caption ? (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                        {actionStage.caption}
                    </Typography>
                ) : null}
            </Box>
        )
    ) : (
        ""
    );

    const importBusyTooltipTitle = actionStage?.caption ? (
        <Box>
            <Typography variant="body2">{primaryPurpose}</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
                {actionStage.caption}
            </Typography>
        </Box>
    ) : (
        primaryPurpose
    );

    const primaryPendingLabel = (() => {
        if (!actionStage) {
            return "";
        }
        if (
            clearBeforeCustomerValidating &&
            actionStage.primaryAction === "start_backfill"
        ) {
            return "Validating customer…";
        }
        if (
            cacheCheckPending &&
            (actionStage.primaryAction === "start_backfill" ||
                actionStage.primaryAction === "incremental")
        ) {
            return "Checking import cache…";
        }
        switch (actionStage.primaryAction) {
            case "preview":
                return "Running preview…";
            case "start_backfill":
                return "Starting backfill…";
            case "resume_backfill":
                return "Resuming backfill…";
            case "incremental":
                return "Running sync…";
            case "stop":
                return "Stopping…";
            default:
                return actionStage.primaryLabel;
        }
    })();

    const primaryButtonLabel = primaryPending
        ? primaryPendingLabel
        : (actionStage?.primaryLabel ?? "");

    const extensionKeyOptions = useMemo<ExtensionKeyOption[]>(() => {
        const registered = listBillingExtensionPanelOptions().map((option) => ({
            key: option.key,
            label: `${option.label} (${option.key})`,
        }));
        if (
            extensionKey &&
            !registered.some((option) => option.key === extensionKey)
        ) {
            return [
                NONE_EXTENSION_OPTION,
                { key: extensionKey, label: extensionKey },
                ...registered,
            ];
        }
        return [NONE_EXTENSION_OPTION, ...registered];
    }, [extensionKey]);

    const selectedExtensionOption =
        extensionKeyOptions.find((option) => option.key === extensionKey) ??
        NONE_EXTENSION_OPTION;

    const extensionRegistration = useMemo(
        () => getBillingExtensionPanel(extensionKey),
        [extensionKey]
    );

    const circuitBreakerActive = useMemo(
        () =>
            config?.status === "Error" ||
            (config?.consecutive_auth_failures ?? 0) >= 3,
        [config]
    );

    const persistEnabledEntitiesMutation = useMutation({
        mutationFn: (entities: ImportType[]) =>
            saveBillingConnectorConfig(accountId, {
                enabled_entities: entities,
            }),
        onSuccess: (saved) => {
            // Update enabled_entities in cache without bumping modified_at so
            // the form sync effect does not reset unsaved connection fields.
            queryClient.setQueryData<BillingConnectorConfig | null>(
                billingConnectorQueryKey(accountId),
                (prev) => {
                    if (!prev) {
                        return saved;
                    }
                    return {
                        ...prev,
                        enabled_entities: saved.enabled_entities,
                        sync_states: saved.sync_states ?? prev.sync_states,
                    };
                }
            );
        },
    });

    const toggleEntity = useCallback(
        (entity: ImportType) => {
            if (!canManage || persistEnabledEntitiesMutation.isPending) {
                return;
            }
            const previous = enabledEntities;
            const next = previous.includes(entity)
                ? previous.filter((e) => e !== entity)
                : [...previous, entity];
            setEnabledEntities(next);
            persistEnabledEntitiesMutation.mutate(next, {
                onError: (err: unknown) => {
                    setEnabledEntities(previous);
                    showError(
                        axiosErrorMessage(err) ??
                            "Failed to update enabled entities"
                    );
                },
            });
        },
        [
            canManage,
            enabledEntities,
            persistEnabledEntitiesMutation,
            showError,
        ]
    );

    const allEnabledMappingsComplete = useMemo(
        () =>
            entitiesForMapping.length > 0 &&
            entitiesForMapping.every(
                (entity) => mappingComplete[entity] === true
            ),
        [entitiesForMapping, mappingComplete]
    );

    const handleMappingCompleteness = useCallback(
        (entity: ImportType, isComplete: boolean) => {
            setMappingComplete((prev) => ({ ...prev, [entity]: isComplete }));
        },
        []
    );

    const handleClearBeforeImportEntityChange = useCallback(
        (entity: ImportType, checked: boolean) => {
            if (!isClearBeforeImportEntity(entity)) {
                return;
            }
            setClearBeforeImportPrefs((prev) => ({
                ...prev,
                entities: {
                    ...prev.entities,
                    [entity]: checked,
                },
            }));
        },
        []
    );

    const handleRefreshEntitySetCatalog = useCallback(async () => {
        await refreshEntitySetsMutation.mutateAsync();
    }, [refreshEntitySetsMutation]);

    const handlePullFilterSaved = useCallback(
        (saved: BillingConnectorConfig) => {
            queryClient.setQueryData(
                billingConnectorQueryKey(accountId),
                saved
            );
        },
        [accountId, queryClient]
    );

    const handleOpenResetDialog = useCallback(() => {
        setResetDialogOpen(true);
    }, []);

    const handleClearBeforeImportCustomerChange = useCallback(
        (
            customerId: number | null,
            option: { id: number; name: string } | null
        ) => {
            setClearBeforeImportCustomerError(null);
            setClearBeforeImportPrefs((prev) => ({
                ...prev,
                customerId,
                customerName:
                    customerId != null && option
                        ? option.name
                        : null,
            }));
        },
        []
    );

    /**
     * Keep a stable config reference for mapping/pull-filter while only
     * sync_states / pending AR counters change during busy polls.
     */
    const entityWorkspaceConfig = useMemo(() => config, [
        config?.id,
        config?.modified_at,
        config?.entity_sets,
        config?.default_entity_sets,
        config?.entity_set_catalog,
        config?.entity_set_catalog_fetched_at,
        config?.backfill_options_locked,
        config?.pull_filters,
        config?.preview_passes,
        config?.has_credentials,
    ]);

    useEffect(() => {
        if (!entityTabFocusPendingRef.current || !config?.has_credentials) {
            return;
        }
        const selectedTab = entityTabsRef.current?.querySelector<HTMLElement>(
            '[role="tab"][aria-selected="true"]'
        );
        if (!selectedTab) {
            return;
        }
        entityTabFocusPendingRef.current = false;
        selectedTab.focus();
    }, [
        accountId,
        config?.has_credentials,
        isLoading,
        selectedMappingEntityTab,
    ]);

    if (isLoading && config === undefined) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    const ExtensionPanel = extensionRegistration?.Panel;
    const connectionAlreadySet = Boolean(config?.has_credentials);
    const isConnectionExpanded = connectionExpanded ?? !connectionAlreadySet;
    const isScheduleExpanded = scheduleExpanded ?? !connectionAlreadySet;
    const isMappingExpanded = mappingExpanded ?? false;
    const isProgressExpanded = progressExpanded ?? true;

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {circuitBreakerActive && (
                <Alert severity="error">
                    Connector is in error state
                    {config?.last_connection_error
                        ? `: ${config.last_connection_error}`
                        : ""}
                    . Fix credentials and run Test connection before re-enabling
                    sync.
                </Alert>
            )}

            <BillingConnectionSection
                canManage={canManage}
                expanded={isConnectionExpanded}
                onExpandedChange={setConnectionExpanded}
                connectionAlreadySet={connectionAlreadySet}
                provider={provider}
                onProviderChange={setProvider}
                baseUrl={baseUrl}
                onBaseUrlChange={setBaseUrl}
                authType={authType}
                onAuthTypeChange={setAuthType}
                apiKeyToken={apiKeyToken}
                onApiKeyTokenChange={setApiKeyToken}
                basicUsername={basicUsername}
                onBasicUsernameChange={setBasicUsername}
                basicPassword={basicPassword}
                onBasicPasswordChange={setBasicPassword}
                oauthClientId={oauthClientId}
                onOauthClientIdChange={setOauthClientId}
                oauthClientSecret={oauthClientSecret}
                onOauthClientSecretChange={setOauthClientSecret}
                oauthTokenEndpoint={oauthTokenEndpoint}
                onOauthTokenEndpointChange={setOauthTokenEndpoint}
                hasCredentials={Boolean(config?.has_credentials)}
                testPending={testMutation.isPending}
                onTestConnection={() => testMutation.mutate()}
            />

            <BillingScheduleSection
                canManage={canManage}
                isHebrew={isHebrew}
                expanded={isScheduleExpanded}
                onExpandedChange={setScheduleExpanded}
                syncEnabled={syncEnabled}
                onSyncEnabledChange={setSyncEnabled}
                scheduleSummary={config?.schedule_summary}
                extensionKey={extensionKey}
                onExtensionKeyChange={setExtensionKey}
                schedulePreset={schedulePreset}
                onSchedulePresetChange={setSchedulePreset}
                syncCron={syncCron}
                onSyncCronChange={setSyncCron}
                dailyTimeUtc={dailyTimeUtc}
                onDailyTimeUtcChange={setDailyTimeUtc}
                weeklyDay={weeklyDay}
                onWeeklyDayChange={setWeeklyDay}
                scheduleWarning={config?.schedule_warning}
                nextScheduledSyncAtUtc={config?.next_scheduled_sync_at_utc}
                invoicePaidTolerance={invoicePaidTolerance}
                onInvoicePaidToleranceChange={setInvoicePaidTolerance}
                invoicePaidToleranceError={invoicePaidToleranceError}
                onInvoicePaidToleranceErrorChange={setInvoicePaidToleranceError}
                persistPaidTolerance={persistPaidTolerance}
                hasCredentials={Boolean(config?.has_credentials)}
                allEnabledMappingsComplete={allEnabledMappingsComplete}
                backfillStartDate={backfillStartDate}
                onBackfillStartDateChange={setBackfillStartDate}
                mepBreachStartDate={mepBreachStartDate}
                onMepBreachStartDateChange={setMepBreachStartDate}
                includeOlderOpenInvoices={includeOlderOpenInvoices}
                onIncludeOlderOpenInvoicesChange={setIncludeOlderOpenInvoices}
                skipReportingBreachOnBackfill={skipReportingBreachOnBackfill}
                onSkipReportingBreachOnBackfillChange={
                    setSkipReportingBreachOnBackfill
                }
                backfillOptionsLocked={Boolean(config?.backfill_options_locked)}
                persistCutoverOptions={persistCutoverOptions}
                extensionKeyOptions={extensionKeyOptions}
                selectedExtensionOption={selectedExtensionOption}
                extensionConfig={extensionConfig}
                onExtensionConfigChange={setExtensionConfig}
                accountId={accountId}
                ExtensionPanel={ExtensionPanel}
                extensionRegistrationKey={extensionRegistration?.key}
            />

            {entityWorkspaceConfig?.has_credentials && (
                <BillingEntityWorkspace
                    canManage={canManage}
                    accountId={accountId}
                    expanded={isMappingExpanded}
                    onExpandedChange={setMappingExpanded}
                    entitiesForMapping={entitiesForMapping}
                    allEnabledMappingsComplete={allEnabledMappingsComplete}
                    enabledEntities={enabledEntities}
                    selectedMappingEntityTab={selectedMappingEntityTab}
                    onMappingEntityTabChange={setMappingEntityTab}
                    entityWorkspaceTab={entityWorkspaceTab}
                    onEntityWorkspaceTabChange={setEntityWorkspaceTab}
                    entityTabsRef={entityTabsRef}
                    onToggleEntity={toggleEntity}
                    persistEnabledEntitiesPending={
                        persistEnabledEntitiesMutation.isPending
                    }
                    clearBeforeImportSession={clearBeforeImportSession}
                    onClearBeforeImportEntityChange={
                        handleClearBeforeImportEntityChange
                    }
                    previewResult={previewResult}
                    config={entityWorkspaceConfig}
                    mapperRefs={mapperRefs}
                    pullFilterRefs={pullFilterRefs}
                    handleEntitySetChange={handleEntitySetChange}
                    onRefreshEntitySetCatalog={handleRefreshEntitySetCatalog}
                    isRefreshingEntitySetCatalog={
                        refreshEntitySetsMutation.isPending
                    }
                    handleMappingCompleteness={handleMappingCompleteness}
                    handleEntityConfigDirtyChange={handleEntityConfigDirtyChange}
                    onPullFilterSaved={handlePullFilterSaved}
                />
            )}

            {config?.has_credentials &&
                (allEnabledMappingsComplete ||
                    Boolean(displayProgressRun) ||
                    progressSessionResolved.phase === "seeding" ||
                    progressSessionResolved.phase === "deferred_drain") && (
                    <BillingProgressHost
                        canManage={canManage}
                        isHebrew={isHebrew}
                        displayProgressRun={displayProgressRun}
                        enabledEntities={enabledEntities}
                        displaySyncStates={displaySyncStates}
                        expectDeletingStep={showDeletingProgressStep}
                        sessionPhase={progressSessionResolved.phase}
                        pendingArPostIngestCustomers={
                            progressResolution.zeroCounts
                                ? 0
                                : config?.pending_ar_post_ingest_customers
                        }
                        expanded={isProgressExpanded}
                        onExpandedChange={setProgressExpanded}
                        allEnabledMappingsComplete={allEnabledMappingsComplete}
                        showPrimaryAction={Boolean(showPrimaryAction)}
                        actionStage={actionStage}
                        primaryTooltipTitle={primaryTooltipTitle}
                        primaryDisabledReason={primaryDisabledReason}
                        primaryPending={primaryPending}
                        primaryButtonLabel={primaryButtonLabel}
                        onPrimaryAction={handlePrimaryAction}
                        importBusy={importBusy}
                        importBusyTooltipTitle={importBusyTooltipTitle}
                        resetBackfillDisabledReason={resetBackfillDisabledReason}
                        resetBackfillPending={resetBackfillMutation.isPending}
                        onOpenResetDialog={handleOpenResetDialog}
                        accountId={accountId}
                        clearBeforeImportCustomerId={clearBeforeImportCustomerId}
                        onClearBeforeImportCustomerChange={
                            handleClearBeforeImportCustomerChange
                        }
                        clearBeforeImportCustomerError={
                            clearBeforeImportCustomerError
                        }
                    />
                )}

            {config?.has_credentials && (
                <BillingSyncHistorySection
                    expanded={historyExpanded}
                    onExpandedChange={setHistoryExpanded}
                    syncHistory={syncHistory}
                    syncHistoryLoading={syncHistoryLoading}
                    syncHistoryFetching={syncHistoryFetching}
                />
            )}

            <DeleteDialog
                isOpen={resetDialogOpen}
                onClose={() => setResetDialogOpen(false)}
                onConfirm={() => resetBackfillMutation.mutate()}
                title="Reset backfill"
                description="Reset backfill progress for all entities and unlock the start date? Imported data is not deleted."
                confirmLabel="Reset backfill"
                cancelLabel="Cancel"
                isLoading={resetBackfillMutation.isPending}
                type="warning"
                maxWidth="sm"
                locale={i18n.language}
            />
            <DeleteDialog
                isOpen={clearBeforeStartDialogOpen}
                onClose={() => {
                    setClearBeforeStartDialogOpen(false);
                    pendingUseCachedImportRef.current = undefined;
                }}
                onConfirm={() => {
                    const clearBeforeImport = resolveClearBeforeImportPayload({
                        session: clearBeforeImportSession,
                        enabledEntities,
                    });
                    const customerId = clearBeforeImportCustomerId;
                    setClearBeforeStartDialogOpen(false);
                    proceedBackfillStart({
                        clear_before_import: clearBeforeImport,
                        ...(customerId != null
                            ? { customer_id: customerId }
                            : {}),
                    });
                }}
                title={clearBeforeStartConfirmCopy.title}
                description={clearBeforeStartConfirmDescription}
                confirmLabel="Start backfill"
                cancelLabel="Cancel"
                isLoading={backfillMutation.isPending}
                type="warning"
                maxWidth="sm"
                locale={i18n.language}
            />
            <DeleteDialog
                isOpen={cacheSuggestionDialogOpen}
                onClose={handleCacheSuggestionCancel}
                onConfirm={handleCacheSuggestionConfirm}
                title="Use import backup?"
                description={cacheSuggestionDescription}
                confirmLabel="Continue"
                cancelLabel="Skip cache / fetch from ERP"
                isLoading={
                    backfillMutation.isPending || incrementalMutation.isPending
                }
                type="info"
                maxWidth="md"
                locale={i18n.language}
            />
        </Box>
    );
});

export default BillingIntegrationSettings;

function axiosErrorMessage(err: unknown): string | undefined {
    if (
        err &&
        typeof err === "object" &&
        "response" in err &&
        err.response &&
        typeof err.response === "object" &&
        "data" in err.response &&
        err.response.data &&
        typeof err.response.data === "object" &&
        "error" in err.response.data
    ) {
        const errorField = (err.response.data as { error?: unknown }).error;
        return typeof errorField === "string" ? errorField : undefined;
    }
    if (err instanceof Error) {
        return err.message;
    }
    return undefined;
}
