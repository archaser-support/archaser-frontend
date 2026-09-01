"use client";

import {
    Alert,
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    FormControl,
    FormControlLabel,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    Switch,
    Tab,
    Tabs,
    TextField,
    Tooltip,
    Typography,
    Autocomplete,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
    Info as InfoIcon,
    ExpandMore as ExpandMoreIcon,
    Psychology as PsychologyIcon,
    Settings as SettingsIcon,
    Sync as SyncIcon,
} from "@mui/icons-material";
import type { ConnectorAuthType, ImportType } from "@/types/db";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import { useTranslation } from "react-i18next";

import {
    fetchBillingConnectorConfig,
    fetchBillingConnectorSyncHistory,
    fetchBillingConnectorSyncRuns,
    cancelBillingConnectorSync,
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
import ConnectorFieldMapper, {
    type ConnectorFieldMapperHandle,
} from "@/shared/layout-components/import/ConnectorFieldMapper";
import ConnectorEntityPullFilterEditor, {
    type ConnectorEntityPullFilterEditorHandle,
} from "@/shared/layout-components/import/ConnectorEntityPullFilterEditor";
import ConnectorPreviewSyncResults from "@/shared/layout-components/import/ConnectorPreviewSyncResults";
import ConnectorSyncHistoryGrid from "@/shared/layout-components/import/ConnectorSyncHistoryGrid";
import { normalizeConnectorEnabledEntities } from "@/shared/constants/importEntityFields";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";
import {
    getPreviewBlockedReason,
    getPreviewSyncDisabledReason,
    getResetBackfillDisabledReason,
    getResetBackfillPurpose,
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
    entitiesMissingPreview,
    findRunningBackfillRun,
    readBackfillProgressSession,
    resolveBackfillProgressRun,
    writeBackfillProgressSession,
    zeroBackfillProgressSyncStates,
    type BackfillProgressSession,
} from "@/shared/services/backfillImportProgress";
import BackfillImportProgress from "./BackfillImportProgress";

import {
    accountCardSx,
    accountCardTitleSx,
    accountSectionIconSx,
} from "../accountCardStyles";

const ENTITY_OPTIONS: { value: ImportType; label: string }[] = [
    { value: "Customer", label: "Customers" },
    { value: "Contact", label: "Contacts" },
    { value: "Invoice", label: "Invoices" },
    { value: "Payment", label: "Payments" },
];

function firstEnabledEntityTabIndex(enabledEntities: ImportType[]): number {
    const index = ENTITY_OPTIONS.findIndex((opt) =>
        enabledEntities.includes(opt.value)
    );
    return index >= 0 ? index : 0;
}

const AUTH_TYPE_OPTIONS: { value: ConnectorAuthType; label: string }[] = [
    { value: "API_KEY", label: "API key (PAT)" },
    { value: "BASIC", label: "Basic (username / password)" },
    { value: "OAUTH2_CLIENT_CREDENTIALS", label: "OAuth2 client credentials" },
];

type SchedulePresetValue =
    | "every_4h"
    | "every_6h"
    | "every_12h"
    | "daily"
    | "weekly"
    | "custom";

const SCHEDULE_PRESET_OPTIONS: { value: SchedulePresetValue; label: string }[] = [
    { value: "every_4h", label: "Every 4 hours UTC" },
    { value: "every_6h", label: "Every 6 hours UTC" },
    { value: "every_12h", label: "Every 12 hours UTC" },
    { value: "daily", label: "Daily at a time (UTC)" },
    { value: "weekly", label: "Weekly on a day and time (UTC)" },
    { value: "custom", label: "Custom (Advanced)" },
];

const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
    { value: 0, label: "Sunday" },
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
];

const DEFAULT_PAID_TOLERANCE = 0.2;
const PAID_TOLERANCE_MIN = 0;
const PAID_TOLERANCE_MAX = 10;

function formatPaidTolerance(value: number | undefined | null): string {
    const n = Number(value);
    return (Number.isFinite(n) ? n : DEFAULT_PAID_TOLERANCE).toFixed(2);
}

function parsePaidToleranceInput(raw: string): number | null {
    const trimmed = raw.trim();
    if (!trimmed) {
        return null;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
        return null;
    }
    const rounded = Math.round(n * 100) / 100;
    if (rounded < PAID_TOLERANCE_MIN || rounded > PAID_TOLERANCE_MAX) {
        return null;
    }
    return rounded;
}

const NONE_EXTENSION_OPTION = {
    key: "",
    label: "None (standard account)",
} as const;

type ExtensionKeyOption = { key: string; label: string };

interface BillingIntegrationSettingsProps {
    accountId: number;
    canManage: boolean;
}

export type BillingIntegrationSettingsHandle = {
    save: () => Promise<void>;
};

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
    const theme = useTheme();
    const pillRadiusPx = `${theme.appButton.sizeMedium.borderRadius}px`;

    const { data: config, isLoading } = useQuery({
        queryKey: ["billing-connector", accountId],
        queryFn: () => fetchBillingConnectorConfig(accountId),
        enabled: accountId > 0,
        refetchInterval: () => {
            const runs = queryClient.getQueryData<SyncRunSummary[]>([
                "billing-connector-sync-runs",
                accountId,
            ]);
            if (runs?.some(isActiveConnectorSyncRun)) {
                return 2500;
            }
            const cached = queryClient.getQueryData<{
                pending_ar_post_ingest_customers?: number;
            }>(["billing-connector", accountId]);
            if ((cached?.pending_ar_post_ingest_customers ?? 0) > 0) {
                return 2500;
            }
            return false;
        },
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
    const [progressSession, setProgressSession] =
        useState<BackfillProgressSession | null>(() =>
            readBackfillProgressSession(accountId)
        );
    /** Clears progress counters immediately on Start, before the new run polls in. */
    const [pendingBackfillReset, setPendingBackfillReset] = useState(false);
    const cutoverDirtyRef = useRef(false);
    const mapperRefs = useRef<
        Partial<Record<ImportType, ConnectorFieldMapperHandle | null>>
    >({});
    const pullFilterRefs = useRef<
        Partial<Record<ImportType, ConnectorEntityPullFilterEditorHandle | null>>
    >({});
    const entityTabsRef = useRef<HTMLDivElement | null>(null);
    const entityTabFocusPendingRef = useRef(true);

    useEffect(() => {
        setProgressSession(readBackfillProgressSession(accountId));
        setConnectionExpanded(null);
        setScheduleExpanded(null);
        setMappingExpanded(null);
        setProgressExpanded(null);
        setHistoryExpanded(false);
        setMappingEntityTab(null);
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
            queryClient.invalidateQueries({
                queryKey: ["billing-connector", accountId],
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
                queryClient.invalidateQueries({
                    queryKey: ["billing-connector", accountId],
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
        mutationFn: () => runBillingConnectorPreviewSync(accountId),
        onSuccess: (result) => {
            setPreviewResult(result);
            setPreviewUpToDate(true);
            queryClient.invalidateQueries({
                queryKey: ["billing-connector", accountId],
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
            const message =
                axiosErrorMessage(err) ?? "Preview sync failed";
            showError(message);
        },
    });

    const refreshEntitySetsMutation = useMutation({
        mutationFn: () => refreshBillingConnectorEntitySets(accountId),
        onSuccess: () => {
            success("Priority table catalog refreshed");
            queryClient.invalidateQueries({
                queryKey: ["billing-connector", accountId],
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
            setPreviewUpToDate(false);
        }
    }, []);

    const handleEntitySetChange = useCallback(
        async (importType: ImportType, value: string | null) => {
            try {
                setPreviewUpToDate(false);
                await saveBillingConnectorConfig(accountId, {
                    entity_sets: { [importType]: value },
                });
                await queryClient.invalidateQueries({
                    queryKey: ["billing-connector", accountId],
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
                    ["billing-connector", accountId],
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
                    ["billing-connector", accountId],
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

    const backfillMutation = useMutation({
        mutationFn: () => runBillingConnectorBackfill(accountId),
        onMutate: () => {
            // Reset counters immediately — do not wait for the new RUNNING run.
            setPendingBackfillReset(true);
            setProgressSession(null);
            writeBackfillProgressSession(accountId, null);
            setMappingExpanded(false);
        },
        onSuccess: (result: { status?: string } | undefined) => {
            success(
                result?.status === "RUNNING"
                    ? "Backfill started"
                    : "Backfill sync completed"
            );
            queryClient.invalidateQueries({
                queryKey: ["billing-connector", accountId],
            });
            queryClient.invalidateQueries({
                queryKey: ["billing-connector-sync-runs", accountId],
            });
            queryClient.invalidateQueries({
                queryKey: ["billing-connector-sync-history", accountId],
            });
        },
        onError: (err: unknown) => {
            setPendingBackfillReset(false);
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
            queryClient.invalidateQueries({
                queryKey: ["billing-connector", accountId],
            });
            queryClient.invalidateQueries({
                queryKey: ["billing-connector-sync-runs", accountId],
            });
            queryClient.invalidateQueries({
                queryKey: ["billing-connector-sync-history", accountId],
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
            queryClient.invalidateQueries({
                queryKey: ["billing-connector", accountId],
            });
            queryClient.invalidateQueries({
                queryKey: ["billing-connector-sync-runs", accountId],
            });
            queryClient.invalidateQueries({
                queryKey: ["billing-connector-sync-history", accountId],
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
            queryClient.invalidateQueries({
                queryKey: ["billing-connector-sync-runs", accountId],
            });
            queryClient.invalidateQueries({
                queryKey: ["billing-connector-sync-history", accountId],
            });
        },
        onError: (err: unknown) => {
            showError(axiosErrorMessage(err) ?? "Failed to cancel sync");
        },
    });

    const { data: syncRuns = [] } = useQuery({
        queryKey: ["billing-connector-sync-runs", accountId],
        queryFn: () => fetchBillingConnectorSyncRuns(accountId),
        enabled: accountId > 0 && Boolean(config?.has_credentials),
        refetchInterval: (query) => {
            const runs = query.state.data as SyncRunSummary[] | undefined;
            const hasRunning = runs?.some(isActiveConnectorSyncRun);
            if (hasRunning || backfillMutation.isPending) {
                return 2500;
            }
            return false;
        },
    });

    const {
        data: syncHistory = [],
        isLoading: syncHistoryLoading,
        isFetching: syncHistoryFetching,
    } = useQuery({
        queryKey: ["billing-connector-sync-history", accountId],
        queryFn: () => fetchBillingConnectorSyncHistory(accountId),
        enabled: accountId > 0 && Boolean(config?.has_credentials),
    });

    const syncInProgress = syncRuns.some(isActiveConnectorSyncRun);
    const wasSyncInProgressRef = useRef(false);
    useEffect(() => {
        if (wasSyncInProgressRef.current && !syncInProgress) {
            void queryClient.invalidateQueries({
                queryKey: ["billing-connector-sync-history", accountId],
            });
        }
        wasSyncInProgressRef.current = syncInProgress;
    }, [accountId, queryClient, syncInProgress]);

    const progressResolution = resolveBackfillProgressRun({
        runs: syncRuns,
        session: progressSession,
    });
    const progressRun = progressResolution.run;
    const displayProgressRun = useMemo(
        () =>
            pendingBackfillReset
                ? findRunningBackfillRun(syncRuns) ?? createPendingBackfillRun()
                : progressRun,
        [pendingBackfillReset, syncRuns, progressRun]
    );
    const displayProgressRunActive = Boolean(
        displayProgressRun && isActiveConnectorSyncRun(displayProgressRun)
    );
    const displaySyncStates = pendingBackfillReset
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
        displayProgressRun?.id !== "pending-backfill" &&
        (displayProgressRun?.status === "RUNNING" || progressRunStopping);

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
    }, [pendingBackfillReset, syncRuns, backfillMutation.isPending]);

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

    useEffect(() => {
        if (
            !backfillMutation.isPending &&
            !incrementalMutation.isPending &&
            !syncInProgress &&
            !displayProgressRunActive &&
            !deferredArPostIngestPending
        ) {
            return;
        }
        const poll = () => {
            void queryClient.invalidateQueries({
                queryKey: ["billing-connector", accountId],
            });
            void queryClient.invalidateQueries({
                queryKey: ["billing-connector-sync-runs", accountId],
            });
        };
        poll();
        const timer = window.setInterval(poll, 2500);
        return () => window.clearInterval(timer);
    }, [
        accountId,
        queryClient,
        backfillMutation.isPending,
        incrementalMutation.isPending,
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
    const previewBlockedReason = getPreviewBlockedReason(
        missingPreviewEntities
    );
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

    const actionStage = config
        ? resolveBackfillActionStage({
              syncMode: config.sync_mode,
              previewBlocked,
              backfillOptionsLocked: Boolean(config.backfill_options_locked),
              syncStates: config.sync_states,
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
                previewMutation.mutate();
                break;
            case "start_backfill":
            case "resume_backfill":
                backfillMutation.mutate();
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

    const primaryPending =
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
                ["billing-connector", accountId],
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

    const toggleEntity = (entity: ImportType) => {
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
    };

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
    const billingAccordionSx = {
        border: "1px solid",
        borderColor: "divider",
        borderRadius: pillRadiusPx,
        overflow: "hidden",
        bgcolor: "background.paper",
        "&:before": { display: "none" },
        "&:first-of-type, &:last-of-type, &:not(:first-of-type)": {
            borderRadius: pillRadiusPx,
        },
        "&.Mui-expanded": {
            margin: 0,
        },
    };
    const billingAccordionSummarySx = (expanded: boolean) => ({
        bgcolor: "background.paper",
        px: 2,
        py: 0.75,
        minHeight: 48,
        borderTopLeftRadius: pillRadiusPx,
        borderTopRightRadius: pillRadiusPx,
        borderBottomLeftRadius: expanded ? 0 : pillRadiusPx,
        borderBottomRightRadius: expanded ? 0 : pillRadiusPx,
        "& .MuiAccordionSummary-content": {
            my: 0,
            alignItems: "center",
            gap: 1,
            "&.Mui-expanded": { my: 0 },
        },
        "&.Mui-expanded": {
            minHeight: 48,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
        },
    });
    const billingAccordionDetailsSx = {
        p: 0,
        bgcolor: "background.paper",
        borderBottomLeftRadius: pillRadiusPx,
        borderBottomRightRadius: pillRadiusPx,
    };
    const billingAccordionContentSx = {
        px: 2,
        py: 1.5,
        "&:last-child": { pb: 1.5 },
    };

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

            <Card elevation={0} sx={accountCardSx}>
                <Accordion
                    disableGutters
                    elevation={0}
                    expanded={isConnectionExpanded}
                    onChange={(_, expanded) => setConnectionExpanded(expanded)}
                    sx={billingAccordionSx}
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={billingAccordionSummarySx(isConnectionExpanded)}
                    >
                        <SyncIcon sx={accountSectionIconSx} />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography
                                variant="subtitle1"
                                sx={accountCardTitleSx}
                            >
                                Connection
                            </Typography>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mt: 0.25 }}
                            >
                                {connectionAlreadySet
                                    ? `${provider === "PRIORITY" ? "Priority" : provider} · credentials saved`
                                    : "Configure provider, base URL, and authentication."}
                            </Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={billingAccordionDetailsSx}>
                <CardContent sx={billingAccordionContentSx}>
                    <Grid container spacing={2} alignItems="flex-start">
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <FormControl fullWidth disabled={!canManage}>
                                <InputLabel id="billing-provider-label">
                                    Provider
                                </InputLabel>
                                <Select
                                    labelId="billing-provider-label"
                                    label="Provider"
                                    value={provider}
                                    onChange={(e) =>
                                        setProvider(
                                            e.target.value as
                                                | "PRIORITY"
                                                | "SAP_BUSINESS_ONE"
                                        )
                                    }
                                >
                                    <MenuItem value="PRIORITY">Priority</MenuItem>
                                    <MenuItem value="SAP_BUSINESS_ONE" disabled>
                                        SAP Business One (coming soon)
                                    </MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <TextField
                                fullWidth
                                label="Base URL"
                                value={baseUrl}
                                onChange={(e) => setBaseUrl(e.target.value)}
                                disabled={!canManage || provider !== "PRIORITY"}
                                placeholder="https://host/odata/Priority/ini/company"
                            />
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <FormControl fullWidth disabled={!canManage}>
                                <InputLabel id="billing-auth-type-label">
                                    Authentication
                                </InputLabel>
                                <Select
                                    labelId="billing-auth-type-label"
                                    label="Authentication"
                                    value={authType}
                                    onChange={(e) =>
                                        setAuthType(
                                            e.target.value as ConnectorAuthType
                                        )
                                    }
                                >
                                    {AUTH_TYPE_OPTIONS.map((opt) => (
                                        <MenuItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        {authType === "API_KEY" && (
                            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                <TextField
                                    fullWidth
                                    type="password"
                                    label="API Token"
                                    value={apiKeyToken}
                                    onChange={(e) => setApiKeyToken(e.target.value)}
                                    disabled={!canManage}
                                    placeholder={
                                        config?.has_credentials
                                            ? "Leave blank to keep existing token"
                                            : "REST access token"
                                    }
                                />
                            </Grid>
                        )}

                        {authType === "BASIC" && (
                            <>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <TextField
                                        fullWidth
                                        label="Username"
                                        value={basicUsername}
                                        onChange={(e) =>
                                            setBasicUsername(e.target.value)
                                        }
                                        disabled={!canManage}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <TextField
                                        fullWidth
                                        type="password"
                                        label="Password"
                                        value={basicPassword}
                                        onChange={(e) =>
                                            setBasicPassword(e.target.value)
                                        }
                                        disabled={!canManage}
                                        placeholder={
                                            config?.has_credentials
                                                ? "Leave blank to keep existing password"
                                                : ""
                                        }
                                    />
                                </Grid>
                            </>
                        )}

                        {authType === "OAUTH2_CLIENT_CREDENTIALS" && (
                            <>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <TextField
                                        fullWidth
                                        label="Client ID"
                                        value={oauthClientId}
                                        onChange={(e) =>
                                            setOauthClientId(e.target.value)
                                        }
                                        disabled={!canManage}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <TextField
                                        fullWidth
                                        type="password"
                                        label="Client Secret"
                                        value={oauthClientSecret}
                                        onChange={(e) =>
                                            setOauthClientSecret(e.target.value)
                                        }
                                        disabled={!canManage}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <TextField
                                        fullWidth
                                        label="Token Endpoint"
                                        value={oauthTokenEndpoint}
                                        onChange={(e) =>
                                            setOauthTokenEndpoint(e.target.value)
                                        }
                                        disabled={!canManage}
                                    />
                                </Grid>
                            </>
                        )}

                        <Grid size={{ xs: 12 }}>
                            {config?.has_credentials && (
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ mb: 2 }}
                                >
                                    Credentials are stored encrypted. Values are
                                    never shown after save.
                                </Typography>
                            )}

                            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                                <Button
                                    variant="outlined"
                                    startIcon={
                                        testMutation.isPending ? (
                                            <CircularProgress size={16} />
                                        ) : (
                                            <SyncIcon />
                                        )
                                    }
                                    onClick={() => testMutation.mutate()}
                                    disabled={
                                        !canManage || testMutation.isPending
                                    }
                                >
                                    Test connection
                                </Button>
                            </Box>
                        </Grid>
                    </Grid>
                </CardContent>
                    </AccordionDetails>
                </Accordion>
            </Card>

            <Card elevation={0} sx={accountCardSx}>
                <Accordion
                    disableGutters
                    elevation={0}
                    expanded={isScheduleExpanded}
                    onChange={(_, expanded) => setScheduleExpanded(expanded)}
                    sx={billingAccordionSx}
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={billingAccordionSummarySx(isScheduleExpanded)}
                    >
                        <SettingsIcon sx={accountSectionIconSx} />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography
                                variant="subtitle1"
                                sx={accountCardTitleSx}
                            >
                                Sync Settings
                            </Typography>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mt: 0.25 }}
                            >
                                {syncEnabled
                                    ? config?.schedule_summary
                                        ? `Sync: Enabled · ${config.schedule_summary}`
                                        : "Sync: Enabled · choose how often sync runs."
                                    : "Sync: disabled"}
                                {extensionKey
                                    ? ` · Extension: ${extensionKey}`
                                    : ""}
                            </Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={billingAccordionDetailsSx}>
                <CardContent sx={billingAccordionContentSx}>
                    <Grid container spacing={2} alignItems="flex-start">
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={syncEnabled}
                                        onChange={(e) =>
                                            setSyncEnabled(e.target.checked)
                                        }
                                        disabled={!canManage}
                                        color="primary"
                                        {...(isHebrew && { "data-rtl": true })}
                                    />
                                }
                                label="Sync Enabled"
                                sx={{
                                    alignItems: "center",
                                    mt: 0.5,
                                    "& .MuiFormControlLabel-label": {
                                        fontSize: "0.875rem",
                                        fontWeight: 500,
                                        lineHeight: 1.4,
                                        ml: 1,
                                    },
                                }}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <FormControl
                                fullWidth
                                size="small"
                                disabled={!canManage}
                            >
                                <InputLabel id="billing-schedule-preset-label">
                                    Sync Schedule
                                </InputLabel>
                                <Select
                                    labelId="billing-schedule-preset-label"
                                    label="Sync Schedule"
                                    value={schedulePreset}
                                    onChange={(e) => {
                                        const value = e.target
                                            .value as SchedulePresetValue;
                                        setSchedulePreset(value);
                                    }}
                                >
                                    {SCHEDULE_PRESET_OPTIONS.map((opt) => (
                                        <MenuItem
                                            key={opt.value}
                                            value={opt.value}
                                        >
                                            {opt.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        {schedulePreset === "custom" ? (
                            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Cron Expression (UTC)"
                                    value={syncCron}
                                    onChange={(e) => {
                                        setSyncCron(e.target.value);
                                        setSchedulePreset("custom");
                                    }}
                                    disabled={!canManage}
                                />
                            </Grid>
                        ) : null}
                        {(schedulePreset === "daily" ||
                            schedulePreset === "weekly") && (
                            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Time (UTC)"
                                    type="time"
                                    value={dailyTimeUtc}
                                    onChange={(e) =>
                                        setDailyTimeUtc(
                                            e.target.value || "03:00"
                                        )
                                    }
                                    disabled={!canManage}
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Grid>
                        )}
                        {schedulePreset === "weekly" && (
                            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                <FormControl
                                    fullWidth
                                    size="small"
                                    disabled={!canManage}
                                >
                                    <InputLabel id="billing-weekly-day-label">
                                        Day of Week (UTC)
                                    </InputLabel>
                                    <Select
                                        labelId="billing-weekly-day-label"
                                        label="Day of Week (UTC)"
                                        value={weeklyDay}
                                        onChange={(e) =>
                                            setWeeklyDay(
                                                Number(e.target.value)
                                            )
                                        }
                                    >
                                        {WEEKDAY_OPTIONS.map((opt) => (
                                            <MenuItem
                                                key={opt.value}
                                                value={opt.value}
                                            >
                                                {opt.label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                        )}

                        {config?.schedule_warning ? (
                            <Grid size={{ xs: 12 }}>
                                <Alert severity="warning">
                                    {config.schedule_warning}
                                </Alert>
                            </Grid>
                        ) : null}

                        {(config?.next_scheduled_sync_at_utc ||
                            syncEnabled) && (
                            <Grid size={{ xs: 12 }}>
                                {config?.next_scheduled_sync_at_utc ? (
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        Next scheduled sync (UTC):{" "}
                                        {new Date(
                                            config.next_scheduled_sync_at_utc
                                        )
                                            .toISOString()
                                            .replace("T", " ")
                                            .replace(/\.\d{3}Z$/, " UTC")}
                                    </Typography>
                                ) : syncEnabled ? (
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        Next scheduled sync (UTC): —
                                    </Typography>
                                ) : null}
                            </Grid>
                        )}

                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <TextField
                                fullWidth
                                required
                                label="Paid leftover tolerance"
                                type="number"
                                size="small"
                                value={invoicePaidTolerance}
                                onChange={(e) => {
                                    setInvoicePaidTolerance(e.target.value);
                                    setInvoicePaidToleranceError(null);
                                }}
                                onBlur={() => {
                                    const parsed = parsePaidToleranceInput(
                                        invoicePaidTolerance
                                    );
                                    if (parsed == null) {
                                        setInvoicePaidToleranceError(
                                            "Enter a number from 0 to 10 (two decimals). 0 means leftover must be exactly 0."
                                        );
                                        return;
                                    }
                                    setInvoicePaidTolerance(
                                        formatPaidTolerance(parsed)
                                    );
                                    setInvoicePaidToleranceError(null);
                                    if (config) {
                                        void persistPaidTolerance(parsed);
                                    }
                                }}
                                disabled={!canManage}
                                error={Boolean(invoicePaidToleranceError)}
                                helperText={invoicePaidToleranceError ?? undefined}
                                inputProps={{
                                    min: PAID_TOLERANCE_MIN,
                                    max: PAID_TOLERANCE_MAX,
                                    step: 0.01,
                                }}
                                InputProps={{
                                    endAdornment: (
                                        <Tooltip
                                            title="Leftover in each invoice's customer currency. Paid when leftover is within +/- this amount. 0 means leftover must be exactly 0. Saving does not restamp invoices until the next connector sync or nightly leftover job."
                                            arrow
                                            enterDelay={300}
                                            leaveDelay={100}
                                            placement="bottom"
                                            PopperProps={{
                                                sx: {
                                                    "& .MuiTooltip-tooltip": {
                                                        direction: isHebrew
                                                            ? "rtl"
                                                            : "ltr",
                                                    },
                                                },
                                            }}
                                        >
                                            <InfoIcon
                                                fontSize="small"
                                                color="action"
                                                sx={{
                                                    cursor: "help",
                                                }}
                                            />
                                        </Tooltip>
                                    ),
                                }}
                            />
                        </Grid>

                        {config?.has_credentials &&
                            allEnabledMappingsComplete && (
                                <>
                                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                        <TextField
                                            fullWidth
                                            label="Backfill Start Date"
                                            type="date"
                                            size="small"
                                            value={backfillStartDate}
                                            onChange={(e) => {
                                                const next = e.target.value;
                                                setBackfillStartDate(next);
                                                void persistCutoverOptions({
                                                    backfill_start_date:
                                                        next.trim() || null,
                                                });
                                            }}
                                            disabled={
                                                !canManage ||
                                                Boolean(
                                                    config.backfill_options_locked
                                                )
                                            }
                                            InputLabelProps={{ shrink: true }}
                                            InputProps={{
                                                endAdornment: (
                                                    <Tooltip
                                                        title={
                                                            config.backfill_options_locked
                                                                ? "Locked after backfill started. Reset backfill to change the start date."
                                                                : "Optional. Invoices and payments created on/after this account-local day. Leave blank for full history. Customers and contacts always pull full history."
                                                        }
                                                        arrow
                                                        enterDelay={300}
                                                        leaveDelay={100}
                                                        placement="bottom"
                                                        PopperProps={{
                                                            sx: {
                                                                "& .MuiTooltip-tooltip":
                                                                    {
                                                                        direction:
                                                                            isHebrew
                                                                                ? "rtl"
                                                                                : "ltr",
                                                                    },
                                                            },
                                                        }}
                                                    >
                                                        <InfoIcon
                                                            fontSize="small"
                                                            color="action"
                                                            sx={{
                                                                cursor: "help",
                                                            }}
                                                        />
                                                    </Tooltip>
                                                ),
                                            }}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                        <TextField
                                            fullWidth
                                            label="MEP Breach Start Date"
                                            type="date"
                                            size="small"
                                            value={mepBreachStartDate}
                                            onChange={(e) => {
                                                const next = e.target.value;
                                                setMepBreachStartDate(next);
                                                void persistCutoverOptions({
                                                    mep_breach_start_date:
                                                        next.trim() || null,
                                                });
                                            }}
                                            disabled={
                                                !canManage ||
                                                Boolean(
                                                    config.backfill_options_locked
                                                )
                                            }
                                            InputLabelProps={{ shrink: true }}
                                            InputProps={{
                                                endAdornment: (
                                                    <Tooltip
                                                        title={
                                                            config.backfill_options_locked
                                                                ? "Locked after backfill started. Reset backfill to change the MEP breach start date."
                                                                : "Optional. Invoices issued before this day are excluded from MEP breach evaluation. Leave blank to evaluate all history. Commonly set to the backfill start date."
                                                        }
                                                        arrow
                                                        enterDelay={300}
                                                        leaveDelay={100}
                                                        placement="bottom"
                                                        PopperProps={{
                                                            sx: {
                                                                "& .MuiTooltip-tooltip":
                                                                    {
                                                                        direction:
                                                                            isHebrew
                                                                                ? "rtl"
                                                                                : "ltr",
                                                                    },
                                                            },
                                                        }}
                                                    >
                                                        <InfoIcon
                                                            fontSize="small"
                                                            color="action"
                                                            sx={{
                                                                cursor: "help",
                                                            }}
                                                        />
                                                    </Tooltip>
                                                ),
                                            }}
                                        />
                                    </Grid>
                                    {Boolean(backfillStartDate.trim()) && (
                                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                            <FormControlLabel
                                                control={
                                                    <Switch
                                                        checked={
                                                            includeOlderOpenInvoices
                                                        }
                                                        onChange={(e) => {
                                                            const next =
                                                                e.target
                                                                    .checked;
                                                            setIncludeOlderOpenInvoices(
                                                                next
                                                            );
                                                            void persistCutoverOptions(
                                                                {
                                                                    include_older_open_invoices:
                                                                        next,
                                                                }
                                                            );
                                                        }}
                                                        disabled={
                                                            !canManage ||
                                                            Boolean(
                                                                config.backfill_options_locked
                                                            )
                                                        }
                                                    />
                                                }
                                                label={
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            gap: 0.5,
                                                        }}
                                                    >
                                                        Include older open
                                                        invoices
                                                        <Tooltip
                                                            title={
                                                                config.backfill_options_locked
                                                                    ? "Locked after backfill started. Reset backfill to change this option."
                                                                    : "When on, also pull unpaid invoices created before the start date and payments linked to those invoices (any payment date). Default on."
                                                            }
                                                            arrow
                                                            enterDelay={300}
                                                            leaveDelay={100}
                                                            placement="bottom"
                                                            PopperProps={{
                                                                sx: {
                                                                    "& .MuiTooltip-tooltip":
                                                                        {
                                                                            direction:
                                                                                isHebrew
                                                                                    ? "rtl"
                                                                                    : "ltr",
                                                                        },
                                                                },
                                                            }}
                                                        >
                                                            <InfoIcon
                                                                fontSize="small"
                                                                color="action"
                                                                sx={{
                                                                    cursor: "help",
                                                                }}
                                                            />
                                                        </Tooltip>
                                                    </Box>
                                                }
                                                sx={{
                                                    alignItems: "center",
                                                    mt: 0.5,
                                                    "& .MuiFormControlLabel-label":
                                                        {
                                                            fontSize:
                                                                "0.875rem",
                                                            fontWeight: 500,
                                                            lineHeight: 1.4,
                                                            ml: 1,
                                                        },
                                                }}
                                            />
                                        </Grid>
                                    )}
                                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={
                                                        skipReportingBreachOnBackfill
                                                    }
                                                    onChange={(e) => {
                                                        const next =
                                                            e.target.checked;
                                                        setSkipReportingBreachOnBackfill(
                                                            next
                                                        );
                                                        void persistCutoverOptions(
                                                            {
                                                                skip_reporting_breach_on_backfill:
                                                                    next,
                                                            }
                                                        );
                                                    }}
                                                    disabled={
                                                        !canManage ||
                                                        Boolean(
                                                            config.backfill_options_locked
                                                        )
                                                    }
                                                />
                                            }
                                            label={
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 0.5,
                                                    }}
                                                >
                                                    Skip reporting breach during
                                                    backfill
                                                    <Tooltip
                                                        title={
                                                            config.backfill_options_locked
                                                                ? "Locked after backfill started. Reset backfill to change this option."
                                                                : "Only affects connector backfill import. Incremental sync and the overnight reporting-breach job still run as usual."
                                                        }
                                                        arrow
                                                        enterDelay={300}
                                                        leaveDelay={100}
                                                        placement="bottom"
                                                        PopperProps={{
                                                            sx: {
                                                                "& .MuiTooltip-tooltip":
                                                                    {
                                                                        direction:
                                                                            isHebrew
                                                                                ? "rtl"
                                                                                : "ltr",
                                                                    },
                                                            },
                                                        }}
                                                    >
                                                        <InfoIcon
                                                            fontSize="small"
                                                            color="action"
                                                            sx={{
                                                                cursor: "help",
                                                            }}
                                                        />
                                                    </Tooltip>
                                                </Box>
                                            }
                                            sx={{
                                                alignItems: "center",
                                                mt: 0.5,
                                                "& .MuiFormControlLabel-label":
                                                    {
                                                        fontSize: "0.875rem",
                                                        fontWeight: 500,
                                                        lineHeight: 1.4,
                                                        ml: 1,
                                                    },
                                            }}
                                        />
                                    </Grid>
                                    {config.backfill_options_locked && (
                                        <Grid size={{ xs: 12 }}>
                                            <Alert severity="warning">
                                                Cutover options are locked
                                                because backfill has started.
                                                Use Reset backfill to unlock the
                                                start date and switches before
                                                changing them.
                                            </Alert>
                                        </Grid>
                                    )}
                                </>
                            )}

                        {canManage && (
                            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                <Autocomplete
                                    id="billing-extension-key"
                                    options={extensionKeyOptions}
                                    value={selectedExtensionOption}
                                    disableClearable
                                    fullWidth
                                    size="small"
                                    getOptionLabel={(option) =>
                                        option.label
                                    }
                                    isOptionEqualToValue={(option, value) =>
                                        option.key === value.key
                                    }
                                    onChange={(_event, next) => {
                                        const nextKey = next?.key ?? "";
                                        setExtensionKey(nextKey);
                                        if (!nextKey) {
                                            setExtensionConfig({});
                                        }
                                    }}
                                    dir={isHebrew ? "rtl" : "ltr"}
                                    {...(isHebrew && {
                                        "data-hebrew": true,
                                        "data-rtl": true,
                                    })}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Extension Key"
                                            variant="outlined"
                                            size="small"
                                            fullWidth
                                            dir={isHebrew ? "rtl" : "ltr"}
                                            {...(isHebrew && {
                                                "data-hebrew": true,
                                            })}
                                            InputProps={{
                                                ...params.InputProps,
                                                endAdornment: (
                                                    <>
                                                        <Tooltip
                                                            title="Optional. Attach a registered extension for account-specific import logic. Use the account Save button to persist this field."
                                                            arrow
                                                            enterDelay={300}
                                                            leaveDelay={100}
                                                            placement="bottom"
                                                            PopperProps={{
                                                                sx: {
                                                                    "& .MuiTooltip-tooltip":
                                                                        {
                                                                            direction:
                                                                                isHebrew
                                                                                    ? "rtl"
                                                                                    : "ltr",
                                                                        },
                                                                },
                                                            }}
                                                        >
                                                            <InfoIcon
                                                                fontSize="small"
                                                                color="action"
                                                                sx={{
                                                                    cursor: "help",
                                                                }}
                                                            />
                                                        </Tooltip>
                                                        {
                                                            params.InputProps
                                                                .endAdornment
                                                        }
                                                    </>
                                                ),
                                            }}
                                        />
                                    )}
                                    renderOption={(props, option) => {
                                        const { key, ...otherProps } = props;
                                        return (
                                            <Box
                                                key={key}
                                                component="li"
                                                {...otherProps}
                                                sx={{
                                                    direction: isHebrew
                                                        ? "rtl"
                                                        : "ltr",
                                                    textAlign: isHebrew
                                                        ? "right"
                                                        : "left",
                                                }}
                                            >
                                                <Typography
                                                    sx={{
                                                        direction: isHebrew
                                                            ? "rtl"
                                                            : "ltr",
                                                        textAlign: isHebrew
                                                            ? "right"
                                                            : "left",
                                                        width: "100%",
                                                    }}
                                                >
                                                    {option.label}
                                                </Typography>
                                            </Box>
                                        );
                                    }}
                                />
                            </Grid>
                        )}

                        {Boolean(extensionKey.trim()) &&
                            ExtensionPanel &&
                            extensionRegistration && (
                            <Grid size={{ xs: 12 }}>
                                <ExtensionPanel
                                    accountId={accountId}
                                    extensionKey={extensionRegistration.key}
                                    extensionConfig={extensionConfig}
                                    canManage={canManage}
                                    onConfigChange={setExtensionConfig}
                                />
                            </Grid>
                        )}
                    </Grid>
                </CardContent>
                    </AccordionDetails>
                </Accordion>
            </Card>

            {config?.has_credentials && (
                <Card elevation={0} sx={accountCardSx}>
                    <Accordion
                        disableGutters
                        elevation={0}
                        expanded={isMappingExpanded}
                        onChange={(_, expanded) => setMappingExpanded(expanded)}
                        sx={billingAccordionSx}
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            sx={billingAccordionSummarySx(isMappingExpanded)}
                        >
                            <PsychologyIcon sx={accountSectionIconSx} />
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography
                                    variant="subtitle1"
                                    sx={accountCardTitleSx}
                                >
                                    Field mapping
                                </Typography>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ mt: 0.25 }}
                                >
                                    {entitiesForMapping.length === 0
                                        ? "Enable entities to map fields and pull filters."
                                        : allEnabledMappingsComplete
                                          ? `${entitiesForMapping.length} entit${entitiesForMapping.length === 1 ? "y" : "ies"} mapped · pull filters and preview available.`
                                          : `Map fields for ${entitiesForMapping.length} enabled entit${entitiesForMapping.length === 1 ? "y" : "ies"}.`}
                                </Typography>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={billingAccordionDetailsSx}>
                            <CardContent sx={billingAccordionContentSx}>
                        <Box>
                            {entitiesForMapping.length === 0 && (
                                <Alert severity="info" sx={{ mb: 2 }}>
                                    No entities are enabled. Turn on a switch
                                    under a tab to include that entity in sync.
                                </Alert>
                            )}
                            <Box ref={entityTabsRef}>
                            <Tabs
                                value={selectedMappingEntityTab}
                                onChange={(_, value) =>
                                    setMappingEntityTab(value)
                                }
                                variant="scrollable"
                                scrollButtons="auto"
                            >
                                {ENTITY_OPTIONS.map((opt) => {
                                    const entityEnabled =
                                        enabledEntities.includes(opt.value);
                                    return (
                                        <Tab
                                            key={opt.value}
                                            label={opt.label}
                                            sx={{
                                                color: entityEnabled
                                                    ? "primary.main"
                                                    : "text.disabled",
                                                "&.Mui-selected": {
                                                    color: entityEnabled
                                                        ? "primary.main"
                                                        : "text.disabled",
                                                },
                                            }}
                                        />
                                    );
                                })}
                            </Tabs>
                            </Box>

                            {ENTITY_OPTIONS.map((opt, index) => {
                                const entity = opt.value;
                                const entityEnabled =
                                    enabledEntities.includes(entity);
                                const previewEntity =
                                    previewResult?.entities.find(
                                        (row) =>
                                            row.import_type === entity
                                    );
                                return (
                                <Box
                                    key={entity}
                                    role="tabpanel"
                                    hidden={selectedMappingEntityTab !== index}
                                    sx={{ pt: 2 }}
                                >
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={entityEnabled}
                                                onChange={() =>
                                                    toggleEntity(entity)
                                                }
                                                disabled={
                                                    !canManage ||
                                                    persistEnabledEntitiesMutation.isPending
                                                }
                                            />
                                        }
                                        label={`Enable ${opt.label.toLowerCase()}`}
                                        sx={{
                                            mb: entityEnabled ? 2 : 0,
                                            display: "block",
                                        }}
                                    />
                                    {entityEnabled ? (
                                        <>
                                    <Tabs
                                        value={entityWorkspaceTab}
                                        onChange={(_, value) =>
                                            setEntityWorkspaceTab(value)
                                        }
                                        sx={{ mb: 2 }}
                                    >
                                                <Tab
                                                    label="Mapping"
                                                    value="mapping"
                                                />
                                                <Tab
                                                    label="Pull Filter"
                                                    value="pullFilter"
                                                />
                                                <Tab
                                                    label="Preview Sample Records"
                                                    value="preview"
                                                />
                                            </Tabs>
                                            <Box
                                                hidden={
                                                    entityWorkspaceTab !==
                                                    "mapping"
                                                }
                                            >
                                                <ConnectorFieldMapper
                                                    ref={(handle) => {
                                                        mapperRefs.current[
                                                            entity
                                                        ] = handle;
                                                    }}
                                                    accountId={accountId}
                                                    importType={entity}
                                                    canManage={canManage}
                                                    hideEntityHeader
                                                    hideSaveButton
                                                    entitySet={
                                                        config.entity_sets?.[
                                                            entity
                                                        ] ?? ""
                                                    }
                                                    defaultEntitySet={
                                                        config
                                                            .default_entity_sets?.[
                                                            entity
                                                        ] ?? ""
                                                    }
                                                    entitySetCatalog={
                                                        config.entity_set_catalog ??
                                                        []
                                                    }
                                                    onEntitySetChange={
                                                        handleEntitySetChange
                                                    }
                                                    onRefreshEntitySetCatalog={async () => {
                                                        await refreshEntitySetsMutation.mutateAsync();
                                                    }}
                                                    isRefreshingEntitySetCatalog={
                                                        refreshEntitySetsMutation.isPending
                                                    }
                                                    onCompletenessChange={
                                                        handleMappingCompleteness
                                                    }
                                                    onDirtyChange={
                                                        handleEntityConfigDirtyChange
                                                    }
                                                />
                                            </Box>
                                            <Box
                                                hidden={
                                                    entityWorkspaceTab !==
                                                    "pullFilter"
                                                }
                                            >
                                                <ConnectorEntityPullFilterEditor
                                                    ref={(handle) => {
                                                        pullFilterRefs.current[
                                                            entity
                                                        ] = handle;
                                                    }}
                                                    accountId={accountId}
                                                    importType={entity}
                                                    canManage={canManage}
                                                    locked={Boolean(
                                                        config.backfill_options_locked
                                                    )}
                                                    config={config}
                                                    hideSaveButton
                                                    onDirtyChange={
                                                        handleEntityConfigDirtyChange
                                                    }
                                                    onSaved={(saved) => {
                                                        queryClient.setQueryData(
                                                            [
                                                                "billing-connector",
                                                                accountId,
                                                            ],
                                                            saved
                                                        );
                                                    }}
                                                />
                                            </Box>
                                            <Box
                                                hidden={
                                                    entityWorkspaceTab !==
                                                    "preview"
                                                }
                                            >
                                                {previewEntity ? (
                                                    <ConnectorPreviewSyncResults
                                                        entity={previewEntity}
                                                    />
                                                ) : (
                                                    <Alert severity="info">
                                                        Run preview sync to
                                                        pull sample rows for{" "}
                                                        {entity}.
                                                    </Alert>
                                                )}
                                            </Box>
                                        </>
                                    ) : null}
                                        </Box>
                                        );
                                    })}
                        </Box>
                            </CardContent>
                        </AccordionDetails>
                    </Accordion>
                </Card>
            )}

            {config?.has_credentials &&
                (allEnabledMappingsComplete || Boolean(displayProgressRun)) && (
                <BackfillImportProgress
                    run={displayProgressRun}
                    enabledEntities={enabledEntities}
                    syncStates={displaySyncStates}
                    pendingArPostIngestCustomers={
                        config?.pending_ar_post_ingest_customers
                    }
                    expanded={isProgressExpanded}
                    onExpandedChange={setProgressExpanded}
                    actions={
                        allEnabledMappingsComplete ? (
                        <>
                            {previewBlocked && (
                                <Alert severity="info" sx={{ mb: 2 }}>
                                    {previewBlockedReason}
                                </Alert>
                            )}
                            <Box
                                sx={{
                                    display: "flex",
                                    gap: 2,
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                    width: "100%",
                                }}
                            >
                                {showPrimaryAction && actionStage ? (
                                    <Tooltip
                                        title={primaryTooltipTitle}
                                        arrow
                                        enterDelay={300}
                                        leaveDelay={100}
                                        placement="bottom"
                                    >
                                        <span>
                                            <Button
                                                variant="contained"
                                                color={
                                                    actionStage.primaryAction ===
                                                    "stop"
                                                        ? "error"
                                                        : "primary"
                                                }
                                                onClick={handlePrimaryAction}
                                                disabled={Boolean(
                                                    primaryDisabledReason ||
                                                        primaryPending
                                                )}
                                                startIcon={
                                                    primaryPending ? (
                                                        <CircularProgress
                                                            size={16}
                                                            color="inherit"
                                                        />
                                                    ) : undefined
                                                }
                                            >
                                                {primaryButtonLabel}
                                            </Button>
                                        </span>
                                    </Tooltip>
                                ) : importBusy ? (
                                    <Tooltip
                                        title={importBusyTooltipTitle}
                                        arrow
                                        enterDelay={300}
                                        leaveDelay={100}
                                        placement="bottom"
                                    >
                                        <span>
                                            <CircularProgress size={24} />
                                        </span>
                                    </Tooltip>
                                ) : null}
                                {actionStage?.showReset ? (
                                    <Tooltip
                                        title={
                                            resetBackfillDisabledReason ? (
                                                <Box>
                                                    <Typography variant="body2">
                                                        {getResetBackfillPurpose()}
                                                    </Typography>
                                                    <Typography
                                                        variant="body2"
                                                        sx={{ mt: 1 }}
                                                    >
                                                        {
                                                            resetBackfillDisabledReason
                                                        }
                                                    </Typography>
                                                </Box>
                                            ) : (
                                                getResetBackfillPurpose()
                                            )
                                        }
                                        arrow
                                        enterDelay={300}
                                        leaveDelay={100}
                                        placement="bottom"
                                    >
                                        <span>
                                            <Button
                                                variant="outlined"
                                                color="warning"
                                                onClick={() =>
                                                    setResetDialogOpen(true)
                                                }
                                                disabled={Boolean(
                                                    resetBackfillDisabledReason
                                                )}
                                            >
                                                {resetBackfillMutation.isPending
                                                    ? "Resetting…"
                                                    : "Reset backfill"}
                                            </Button>
                                        </span>
                                    </Tooltip>
                                ) : null}
                            </Box>
                        </>
                        ) : undefined
                    }
                />
            )}

            {config?.has_credentials && (
                <Card elevation={0} sx={accountCardSx}>
                    <Accordion
                        disableGutters
                        elevation={0}
                        expanded={historyExpanded}
                        onChange={(_, expanded) =>
                            setHistoryExpanded(expanded)
                        }
                        sx={billingAccordionSx}
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            sx={billingAccordionSummarySx(historyExpanded)}
                        >
                            <SyncIcon sx={accountSectionIconSx} />
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography
                                    variant="subtitle1"
                                    sx={accountCardTitleSx}
                                >
                                    Sync history
                                </Typography>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ mt: 0.25 }}
                                >
                                    {syncHistoryLoading &&
                                    syncHistory.length === 0
                                        ? "Loading recent runs…"
                                        : `${syncHistory.length} recent run${syncHistory.length === 1 ? "" : "s"}${
                                              syncHistory[0]?.status
                                                  ? ` · latest ${syncHistory[0].status}`
                                                  : ""
                                          }.`}
                                </Typography>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={billingAccordionDetailsSx}>
                            <CardContent sx={billingAccordionContentSx}>
                                <ConnectorSyncHistoryGrid
                                    runs={syncHistory}
                                    isLoading={
                                        syncHistoryLoading ||
                                        (syncHistoryFetching &&
                                            syncHistory.length === 0)
                                    }
                                />
                            </CardContent>
                        </AccordionDetails>
                    </Accordion>
                </Card>
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
