"use client";

import { Alert, Box, CircularProgress, Typography } from "@mui/material";
import type { ConnectorAuthType, ImportType } from "@/types/db";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, forwardRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
    fetchBillingConnectorConfig,
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
    canStartFirstBackfill,
    createPendingBackfillRun,
    createResetBackfillProgressRun,
    entitiesMissingPreview,
    findRunningBackfillRun,
    isPlaceholderBackfillProgressRun,
    previewPassesFromSyncResult,
    readBackfillProgressSession,
    resolveBackfillProgressRun,
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
    /** Clears progress counters immediately on Start, before the new run polls in. */
    const [pendingBackfillReset, setPendingBackfillReset] = useState(false);
    /** Clears progress bars/counters after Run Preview until the next real import. */
    const [progressUiReset, setProgressUiReset] = useState(false);
    /** Start requested clear-before-import — keep Deleting… visible before purge stats arrive. */
    const [expectDeletingStep, setExpectDeletingStep] = useState(false);
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

    useLayoutEffect(() => {
        skipClearBeforeImportPersistRef.current = true;
        setClearBeforeImportPrefs(readClearBeforeImportPrefs(accountId));
        setClearBeforeImportCustomerError(null);
        setClearBeforeStartDialogOpen(false);
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
            // Clear previous import progress immediately when Preview starts.
            setProgressUiReset(true);
            setPendingBackfillReset(false);
            setExpectDeletingStep(false);
            setProgressSession(null);
            writeBackfillProgressSession(accountId, null);
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
                showError(
                    "Preview sync completed with validation issues — open the Preview sample records tab"
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
        },
        { expectPurge: boolean }
    >({
        mutationFn: (options) =>
            runBillingConnectorBackfill(accountId, options),
        onMutate: (options) => {
            // Reset counters immediately — do not wait for the new RUNNING run.
            const expectPurge =
                (options?.clear_before_import?.length ?? 0) > 0;
            setExpectDeletingStep(expectPurge);
            setPendingBackfillReset(true);
            setProgressUiReset(false);
            setProgressSession(null);
            writeBackfillProgressSession(accountId, null);
            setMappingExpanded(false);
            return { expectPurge };
        },
        onSuccess: (result, _variables, context) => {
            success(
                result?.status === "RUNNING"
                    ? "Backfill started"
                    : "Backfill sync completed"
            );
            // Bind progress immediately — don't wait for sync-runs poll (avoids a
            // gap where pendingBackfillReset clears before the RUNNING run lands).
            const executionId =
                typeof result?.execution_id === "string"
                    ? result.execution_id
                    : null;
            if (executionId) {
                if (result?.status === "RUNNING") {
                    const seeded = createPendingBackfillRun({
                        expectPurge: context?.expectPurge === true,
                    });
                    seeded.id = executionId;
                    if (result.sync_mode) {
                        seeded.sync_mode = result.sync_mode;
                    }
                    if (result.trigger) {
                        seeded.trigger = result.trigger;
                    }
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
                const session = {
                    executionId,
                    dismissed: false,
                };
                setProgressSession(session);
                writeBackfillProgressSession(accountId, session);
                setPendingBackfillReset(false);
            }
            void invalidateBillingConnectorQueries(queryClient, accountId, {
                history: true,
            });
        },
        onError: (err: unknown) => {
            setPendingBackfillReset(false);
            setExpectDeletingStep(false);
            showError(axiosErrorMessage(err) ?? "Backfill sync failed");
        },
    });

    const incrementalMutation = useMutation({
        mutationFn: () => runBillingConnectorIncrementalSync(accountId),
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
        onSuccess: (result) => {
            success(
                result.cancelled
                    ? "Sync cancel requested"
                    : "No running sync to cancel"
            );
            if (result.cancelled) {
                setPendingBackfillReset(false);
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

    const { data: syncRuns = [] } = useQuery({
        queryKey: billingConnectorSyncRunsQueryKey(accountId),
        queryFn: () => fetchBillingConnectorSyncRuns(accountId),
        enabled: accountId > 0 && Boolean(config?.has_credentials),
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

    const progressResolution = resolveBackfillProgressRun({
        runs: syncRuns,
        session: progressSession,
    });
    const progressRun = progressResolution.run;
    const displayProgressRun = useMemo(() => {
        if (pendingBackfillReset) {
            return (
                findRunningBackfillRun(syncRuns) ??
                createPendingBackfillRun({ expectPurge: expectDeletingStep })
            );
        }
        if (progressUiReset) {
            return createResetBackfillProgressRun();
        }
        return progressRun;
    }, [
        pendingBackfillReset,
        progressUiReset,
        expectDeletingStep,
        syncRuns,
        progressRun,
    ]);
    const displayProgressRunActive = Boolean(
        displayProgressRun &&
            isActiveConnectorSyncRun(displayProgressRun) &&
            !isPlaceholderBackfillProgressRun(displayProgressRun)
    );
    const displaySyncStates =
        pendingBackfillReset || progressUiReset
            ? zeroBackfillProgressSyncStates(config?.sync_states)
            : config?.sync_states;
    const deferredArPostIngestPending = hasPendingDeferredArPostIngest(
        config?.pending_ar_post_ingest_customers
    );
    const importBusy =
        syncInProgress ||
        backfillMutation.isPending ||
        incrementalMutation.isPending ||
        Boolean(progressRun && isActiveConnectorSyncRun(progressRun)) ||
        pendingBackfillReset;
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
        if (!progressUiReset) {
            return;
        }
        if (pendingBackfillReset) {
            setProgressUiReset(false);
            return;
        }
        // A real backfill started — drop the preview reset placeholder.
        const running = findRunningBackfillRun(syncRuns);
        if (running && !isPlaceholderBackfillProgressRun(running)) {
            setProgressUiReset(false);
        }
    }, [progressUiReset, pendingBackfillReset, syncRuns]);

    useEffect(() => {
        if (!pendingBackfillReset) {
            return;
        }
        // Keep the zeroed chips/counters until Start finishes and a real run exists.
        if (backfillMutation.isPending) {
            return;
        }
        const running = findRunningBackfillRun(syncRuns);
        if (running && running.id !== "pending-backfill") {
            setPendingBackfillReset(false);
        }
        // Do not clear on !syncInProgress alone — sync-runs can still be stale
        // right after Start accepts, which used to drop the poller and hide bars
        // until a full page refresh.
    }, [pendingBackfillReset, syncRuns, backfillMutation.isPending]);

    useEffect(() => {
        if (!expectDeletingStep) {
            return;
        }
        if (
            !pendingBackfillReset &&
            !backfillMutation.isPending &&
            !findRunningBackfillRun(syncRuns)
        ) {
            setExpectDeletingStep(false);
        }
    }, [
        expectDeletingStep,
        pendingBackfillReset,
        backfillMutation.isPending,
        syncRuns,
    ]);

    useEffect(() => {
        const next = progressResolution.session;
        if (
            next?.executionId === progressSession?.executionId &&
            next?.dismissed === progressSession?.dismissed
        ) {
            return;
        }
        setProgressSession(next);
        writeBackfillProgressSession(accountId, next);
    }, [accountId, progressResolution.session, progressSession]);

    // Single busy poller — replaces stacked refetchInterval + invalidate loops.
    useEffect(() => {
        const shouldPoll =
            backfillMutation.isPending ||
            pendingBackfillReset ||
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
        pendingBackfillReset,
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
    const selectedMappingEntityTab =
        mappingEntityTab ?? firstEnabledEntityTabIndex(enabledEntities);

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
            (syncInProgress && !progressRun && !pendingBackfillReset));

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
                    if (
                        shouldConfirmStartBackfillClear({
                            clearBeforeImport,
                            customerId,
                        })
                    ) {
                        setClearBeforeStartDialogOpen(true);
                        return;
                    }
                    backfillMutation.mutate({});
                })();
                break;
            }
            case "resume_backfill":
                // Resume never sends clear_before_import or customer_id.
                backfillMutation.mutate({});
                break;
            case "incremental":
                incrementalMutation.mutate();
                break;
            case "stop":
                cancelSyncMutation.mutate();
                break;
            default:
                break;
        }
    };

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
                (allEnabledMappingsComplete || Boolean(displayProgressRun)) && (
                    <BillingProgressHost
                        canManage={canManage}
                        isHebrew={isHebrew}
                        displayProgressRun={displayProgressRun}
                        enabledEntities={enabledEntities}
                        displaySyncStates={displaySyncStates}
                        expectDeletingStep={expectDeletingStep}
                        pendingArPostIngestCustomers={
                            progressUiReset || pendingBackfillReset
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
                onClose={() => setClearBeforeStartDialogOpen(false)}
                onConfirm={() => {
                    const clearBeforeImport = resolveClearBeforeImportPayload({
                        session: clearBeforeImportSession,
                        enabledEntities,
                    });
                    const customerId = clearBeforeImportCustomerId;
                    setClearBeforeStartDialogOpen(false);
                    backfillMutation.mutate({
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
