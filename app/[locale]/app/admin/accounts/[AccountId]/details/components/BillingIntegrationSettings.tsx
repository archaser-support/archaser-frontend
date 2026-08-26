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
    List,
    ListItem,
    ListItemText,
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
    fetchBillingConnectorSyncRuns,
    cancelBillingConnectorSync,
    resetBillingConnectorBackfill,
    refreshBillingConnectorEntitySets,
    runBillingConnectorBackfill,
    runBillingConnectorIncrementalSync,
    runBillingConnectorPreviewSync,
    saveBillingConnectorConfig,
    testBillingConnectorConnection,
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
import { normalizeConnectorEnabledEntities } from "@/shared/constants/importEntityFields";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";
import {
    getPreviewBlockedReason,
    getResetBackfillDisabledReason,
    getRunIncrementalDisabledReason,
    getStartBackfillDisabledReason,
    isActiveConnectorSyncRun,
    toDateInputValue,
} from "@/shared/services/billingConnectorSyncActions";
import {
    getBillingExtensionPanel,
    listBillingExtensionPanelOptions,
} from "@/shared/billing-extensions/registry";
import {
    canStartFirstBackfill,
    entitiesMissingPreview,
    readBackfillProgressSession,
    resolveBackfillProgressRun,
    writeBackfillProgressSession,
    type BackfillProgressSession,
} from "@/shared/services/backfillImportProgress";
import BackfillImportProgress from "./BackfillImportProgress";

import {
    accountCardContentSx,
    accountCardSx,
    accountCardTitleSx,
    accountSectionIconSx,
} from "../accountCardStyles";
import AccountSectionCardHeader from "./AccountSectionCardHeader";

const compactBillingCardContentSx = {
    p: 0,
    "&:last-child": { pb: 0 },
};

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
    const [mappingEntityTab, setMappingEntityTab] = useState<number | null>(
        null
    );
    const [entityWorkspaceTab, setEntityWorkspaceTab] = useState<
        "mapping" | "pullFilter" | "preview"
    >("mapping");
    const [backfillStartDate, setBackfillStartDate] = useState("");
    const [skipReportingBreachOnBackfill, setSkipReportingBreachOnBackfill] =
        useState(false);
    const [includeOlderOpenInvoices, setIncludeOlderOpenInvoices] =
        useState(true);
    const [extensionKey, setExtensionKey] = useState("");
    const [extensionConfig, setExtensionConfig] = useState<
        Record<string, unknown>
    >({});
    const [resetDialogOpen, setResetDialogOpen] = useState(false);
    const [progressSession, setProgressSession] =
        useState<BackfillProgressSession | null>(null);
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
        setMappingEntityTab(null);
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
            setBackfillStartDate(toDateInputValue(config.backfill_start_date));
            setIncludeOlderOpenInvoices(
                config.include_older_open_invoices ?? true
            );
            setSkipReportingBreachOnBackfill(
                Boolean(config.skip_reporting_breach_on_backfill)
            );
        }
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
                include_older_open_invoices: includeOlderOpenInvoices,
                skip_reporting_breach_on_backfill: skipReportingBreachOnBackfill,
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

    const handleEntitySetChange = useCallback(
        async (importType: ImportType, value: string | null) => {
            try {
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
            // Only Start / resume backfill clears the progress panel session.
            // Entity transitions within a run keep prior rows (sync_states).
            setProgressSession(null);
            writeBackfillProgressSession(accountId, null);
            void queryClient.invalidateQueries({
                queryKey: ["billing-connector-sync-runs", accountId],
            });
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
        },
        onError: (err: unknown) => {
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

    const syncInProgress = syncRuns.some(isActiveConnectorSyncRun);
    const progressResolution = resolveBackfillProgressRun({
        runs: syncRuns,
        session: progressSession,
    });
    const progressRun = progressResolution.run;
    const importBusy =
        syncInProgress ||
        backfillMutation.isPending ||
        incrementalMutation.isPending ||
        Boolean(progressRun && isActiveConnectorSyncRun(progressRun));

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
            !syncInProgress
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
    ]);

    const entitiesForMapping = useMemo(
        () =>
            ENTITY_OPTIONS.map((opt) => opt.value).filter((entity) =>
                enabledEntities.includes(entity)
            ),
        [enabledEntities]
    );
    const selectedMappingEntityTab =
        mappingEntityTab ??
        firstEnabledEntityTabIndex(
            config
                ? normalizeConnectorEnabledEntities(config.enabled_entities)
                : enabledEntities
        );

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

    const toggleEntity = (entity: ImportType) => {
        setEnabledEntities((prev) =>
            prev.includes(entity)
                ? prev.filter((e) => e !== entity)
                : [...prev, entity]
        );
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
        py: 0.25,
        minHeight: 36,
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
            minHeight: 36,
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
                        <Typography variant="subtitle1" sx={accountCardTitleSx}>
                            Connection
                        </Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={billingAccordionDetailsSx}>
                <CardContent sx={billingAccordionContentSx}>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <FormControl
                                fullWidth
                                sx={{ mb: 2 }}
                                disabled={!canManage}
                            >
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

                            <TextField
                                fullWidth
                                label="Base URL"
                                value={baseUrl}
                                onChange={(e) => setBaseUrl(e.target.value)}
                                disabled={!canManage || provider !== "PRIORITY"}
                                placeholder="https://host/odata/Priority/ini/company"
                            />
                        </Grid>

                        <Grid size={{ xs: 12, md: 6 }}>
                            <FormControl
                                fullWidth
                                sx={{ mb: 2 }}
                                disabled={!canManage}
                            >
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

                            {authType === "API_KEY" && (
                                <TextField
                                    fullWidth
                                    type="password"
                                    label="API token"
                                    value={apiKeyToken}
                                    onChange={(e) => setApiKeyToken(e.target.value)}
                                    disabled={!canManage}
                                    placeholder={
                                        config?.has_credentials
                                            ? "Leave blank to keep existing token"
                                            : "REST access token"
                                    }
                                />
                            )}

                            {authType === "BASIC" && (
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 2,
                                    }}
                                >
                                    <TextField
                                        fullWidth
                                        label="Username"
                                        value={basicUsername}
                                        onChange={(e) =>
                                            setBasicUsername(e.target.value)
                                        }
                                        disabled={!canManage}
                                    />
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
                                </Box>
                            )}

                            {authType === "OAUTH2_CLIENT_CREDENTIALS" && (
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 2,
                                    }}
                                >
                                    <TextField
                                        fullWidth
                                        label="Client ID"
                                        value={oauthClientId}
                                        onChange={(e) =>
                                            setOauthClientId(e.target.value)
                                        }
                                        disabled={!canManage}
                                    />
                                    <TextField
                                        fullWidth
                                        type="password"
                                        label="Client secret"
                                        value={oauthClientSecret}
                                        onChange={(e) =>
                                            setOauthClientSecret(e.target.value)
                                        }
                                        disabled={!canManage}
                                    />
                                    <TextField
                                        fullWidth
                                        label="Token endpoint"
                                        value={oauthTokenEndpoint}
                                        onChange={(e) =>
                                            setOauthTokenEndpoint(e.target.value)
                                        }
                                        disabled={!canManage}
                                    />
                                </Box>
                            )}
                        </Grid>

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

            {canManage && (
                <Card elevation={0} sx={accountCardSx}>
                    <CardContent sx={compactBillingCardContentSx}>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, md: 6 }}>
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
                                            label="Extension key"
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
                        </Grid>
                    </CardContent>
                </Card>
            )}

            {ExtensionPanel && extensionRegistration && (
                <Card elevation={0} sx={accountCardSx}>
                    <CardContent sx={compactBillingCardContentSx}>
                        <ExtensionPanel
                            accountId={accountId}
                            extensionKey={extensionRegistration.key}
                            extensionConfig={extensionConfig}
                            canManage={canManage}
                            onConfigChange={setExtensionConfig}
                        />
                    </CardContent>
                </Card>
            )}

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
                        <Typography variant="subtitle1" sx={accountCardTitleSx}>
                            Sync schedule and actions
                        </Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={billingAccordionDetailsSx}>
                <CardContent sx={billingAccordionContentSx}>
                    <Box
                        sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: 2,
                        }}
                    >
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
                                label="Sync enabled"
                                sx={{
                                    alignItems: "center",
                                    "& .MuiFormControlLabel-label": {
                                        fontSize: "0.875rem",
                                        fontWeight: 500,
                                        lineHeight: 1.4,
                                        ml: 1,
                                    },
                                }}
                            />
                            <FormControl
                                size="small"
                                disabled={!canManage}
                                sx={{ width: 200 }}
                            >
                                <InputLabel id="billing-schedule-preset-label">
                                    Sync schedule
                                </InputLabel>
                                <Select
                                    labelId="billing-schedule-preset-label"
                                    label="Sync schedule"
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
                        {schedulePreset === "custom" ? (
                                <TextField
                                    size="small"
                                    label="Cron expression (UTC)"
                                    value={syncCron}
                                    onChange={(e) => {
                                        setSyncCron(e.target.value);
                                        setSchedulePreset("custom");
                                    }}
                                    disabled={!canManage}
                                    sx={{ width: 180 }}
                                />
                        ) : null}
                    </Box>

                    {(schedulePreset === "daily" ||
                        schedulePreset === "weekly") && (
                        <TextField
                            fullWidth
                            size="small"
                            label="Time (UTC)"
                            type="time"
                            value={dailyTimeUtc}
                            onChange={(e) =>
                                setDailyTimeUtc(e.target.value || "03:00")
                            }
                            disabled={!canManage}
                            InputLabelProps={{ shrink: true }}
                            sx={{ mt: 2 }}
                        />
                    )}

                    {schedulePreset === "weekly" && (
                        <FormControl
                            fullWidth
                            size="small"
                            disabled={!canManage}
                            sx={{ mt: 2 }}
                        >
                            <InputLabel id="billing-weekly-day-label">
                                Day of week (UTC)
                            </InputLabel>
                            <Select
                                labelId="billing-weekly-day-label"
                                label="Day of week (UTC)"
                                value={weeklyDay}
                                onChange={(e) =>
                                    setWeeklyDay(Number(e.target.value))
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
                    )}

                    {config?.schedule_warning ? (
                        <Alert severity="warning" sx={{ mt: 2 }}>
                            {config.schedule_warning}
                        </Alert>
                    ) : null}

                    {config?.schedule_summary ? (
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 2 }}
                        >
                            Schedule: {config.schedule_summary}
                        </Typography>
                    ) : null}

                    {config?.next_scheduled_sync_at_utc ? (
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: config?.schedule_summary ? 0.5 : 2 }}
                        >
                            Next scheduled sync (UTC):{" "}
                            {new Date(
                                config.next_scheduled_sync_at_utc
                            ).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC")}
                        </Typography>
                    ) : syncEnabled ? (
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: config?.schedule_summary ? 0.5 : 2 }}
                        >
                            Next scheduled sync (UTC): —
                        </Typography>
                    ) : null}

                    {config?.has_credentials &&
                        allEnabledMappingsComplete && (
                            <>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ mt: 2, mb: 2 }}
                                >
                                    Mode: {config.sync_mode}. Start or resume
                                    initial backfill, or run an incremental
                                    catch-up when backfill is complete.
                                </Typography>

                                <TextField
                                    label="Backfill start date"
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
                                    helperText={
                                        config.backfill_options_locked
                                            ? "Locked after backfill started. Reset backfill to change the start date."
                                            : "Optional. Invoices and payments created on/after this account-local day. Leave blank for full history. Customers and contacts always pull full history."
                                    }
                                    sx={{ mb: 2, maxWidth: 280 }}
                                />

                                {Boolean(backfillStartDate.trim()) && (
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={
                                                    includeOlderOpenInvoices
                                                }
                                                onChange={(e) => {
                                                    const next =
                                                        e.target.checked;
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
                                        label="Include older open invoices"
                                        sx={{ mb: 1, display: "block" }}
                                    />
                                )}
                                {Boolean(backfillStartDate.trim()) && (
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        display="block"
                                        sx={{ mb: 2 }}
                                    >
                                        {config.backfill_options_locked
                                            ? "Locked after backfill started. Reset backfill to change this option."
                                            : "When on, also pull unpaid invoices created before the start date and payments linked to those invoices (any payment date). Default on."}
                                    </Typography>
                                )}

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
                                                void persistCutoverOptions({
                                                    skip_reporting_breach_on_backfill:
                                                        next,
                                                });
                                            }}
                                            disabled={
                                                !canManage ||
                                                Boolean(
                                                    config.backfill_options_locked
                                                )
                                            }
                                        />
                                    }
                                    label="Skip reporting breach during backfill"
                                    sx={{ mb: 0.5, display: "block" }}
                                />
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    display="block"
                                    sx={{ mb: 2 }}
                                >
                                    {config.backfill_options_locked
                                        ? "Locked after backfill started. Reset backfill to change this option."
                                        : "Only affects connector backfill import. Incremental sync and the overnight reporting-breach job still run as usual."}
                                </Typography>

                                {config.backfill_options_locked && (
                                    <Alert
                                        severity="warning"
                                        sx={{ mb: 2 }}
                                    >
                                        Cutover options are locked because
                                        backfill has started. Use Reset
                                        backfill to unlock the start date
                                        and switches before changing them.
                                    </Alert>
                                )}
                            </>
                        )}
                </CardContent>
                    </AccordionDetails>
                </Accordion>
            </Card>

            {config?.has_credentials && (
                <Card elevation={0} sx={accountCardSx}>
                    <AccountSectionCardHeader
                        icon={PsychologyIcon}
                        title="Field mapping"
                    />
                    <CardContent sx={accountCardContentSx}>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 2 }}
                        >
                            Map Priority fields to Archaser import columns.
                            Enable an entity on its tab to include it in sync.
                            Set a pull filter and Priority table per entity,
                            then use the account Save button to persist them.
                            Run preview and open the Preview sample records
                            tab for sample rows.
                        </Typography>

                        <Button
                            variant="contained"
                            startIcon={
                                previewMutation.isPending ? (
                                    <CircularProgress size={16} />
                                ) : (
                                    <SyncIcon />
                                )
                            }
                            onClick={() => previewMutation.mutate()}
                            disabled={
                                !canManage ||
                                previewMutation.isPending ||
                                !allEnabledMappingsComplete
                            }
                            sx={{ mb: 2 }}
                        >
                            {previewMutation.isPending
                                ? "Running preview…"
                                : "Run preview sync"}
                        </Button>

                        {!allEnabledMappingsComplete &&
                            entitiesForMapping.length > 0 && (
                            <Alert severity="info" sx={{ mb: 2 }}>
                                Complete field mapping for all enabled entities
                                before running preview sync.
                            </Alert>
                        )}

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
                                                disabled={!canManage}
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
                                                    label="Pull filter"
                                                    value="pullFilter"
                                                />
                                                <Tab
                                                    label="Preview sample records"
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
                </Card>
            )}

            {config?.has_credentials && progressRun && (
                <BackfillImportProgress
                    run={progressRun}
                    enabledEntities={normalizeConnectorEnabledEntities(
                        config.enabled_entities
                    )}
                    syncStates={config.sync_states}
                    onDismiss={() => {
                        const next = {
                            executionId: progressRun.id,
                            dismissed: true,
                        };
                        setProgressSession(next);
                        writeBackfillProgressSession(accountId, next);
                    }}
                    onStop={
                        canManage
                            ? () => cancelSyncMutation.mutate()
                            : undefined
                    }
                    stopPending={cancelSyncMutation.isPending}
                />
            )}

            {config?.has_credentials && allEnabledMappingsComplete && (
                <Card elevation={0} sx={accountCardSx}>
                    <CardContent sx={accountCardContentSx}>
                        {importBusy && (
                            <Alert severity="info" sx={{ mb: 2 }}>
                                Sync in progress — actions are disabled
                                until the current run finishes.
                            </Alert>
                        )}

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
                            }}
                        >
                            <Tooltip
                                title={startBackfillDisabledReason ?? ""}
                                arrow
                                enterDelay={300}
                                leaveDelay={100}
                                placement="bottom"
                                disableHoverListener={
                                    !startBackfillDisabledReason
                                }
                            >
                                <span>
                                    <Button
                                        variant="contained"
                                        startIcon={
                                            backfillMutation.isPending ? (
                                                <CircularProgress size={16} />
                                            ) : (
                                                <SyncIcon />
                                            )
                                        }
                                        onClick={() =>
                                            backfillMutation.mutate()
                                        }
                                        disabled={Boolean(
                                            startBackfillDisabledReason
                                        )}
                                    >
                                        {config.sync_mode === "BACKFILL"
                                            ? "Start / resume backfill"
                                            : "Backfill complete"}
                                    </Button>
                                </span>
                            </Tooltip>
                            <Tooltip
                                title={runIncrementalDisabledReason ?? ""}
                                arrow
                                enterDelay={300}
                                leaveDelay={100}
                                placement="bottom"
                                disableHoverListener={
                                    !runIncrementalDisabledReason
                                }
                            >
                                <span>
                                    <Button
                                        variant="outlined"
                                        startIcon={
                                            incrementalMutation.isPending ? (
                                                <CircularProgress size={16} />
                                            ) : (
                                                <SyncIcon />
                                            )
                                        }
                                        onClick={() =>
                                            incrementalMutation.mutate()
                                        }
                                        disabled={Boolean(
                                            runIncrementalDisabledReason
                                        )}
                                    >
                                        Run incremental sync now
                                    </Button>
                                </span>
                            </Tooltip>
                            {syncInProgress && !progressRun && (
                                <Button
                                    variant="outlined"
                                    color="warning"
                                    onClick={() =>
                                        cancelSyncMutation.mutate()
                                    }
                                    disabled={
                                        !canManage ||
                                        cancelSyncMutation.isPending
                                    }
                                >
                                    {cancelSyncMutation.isPending
                                        ? "Cancelling…"
                                        : "Cancel running sync"}
                                </Button>
                            )}
                            <Tooltip
                                title={resetBackfillDisabledReason ?? ""}
                                arrow
                                enterDelay={300}
                                leaveDelay={100}
                                placement="bottom"
                                disableHoverListener={
                                    !resetBackfillDisabledReason
                                }
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
                        </Box>
                    </CardContent>
                </Card>
            )}

            {config?.has_credentials && syncRuns.length > 0 && (
                <Card elevation={0} sx={accountCardSx}>
                    <AccountSectionCardHeader
                        icon={SyncIcon}
                        title="Sync history"
                    />
                    <CardContent sx={accountCardContentSx}>
                        <List dense>
                            {syncRuns.map((run) => (
                                <ListItem key={run.id}>
                                        <ListItemText
                                            primary={`${run.sync_mode} (${run.trigger}) — ${run.status}`}
                                            secondary={`${new Date(run.started_at).toLocaleString()}${
                                                run.duration_seconds
                                                    ? ` — ${run.duration_seconds}s`
                                                    : ""
                                            }${
                                                run.cutover_summary
                                                    ? ` — ${run.cutover_summary}`
                                                    : ""
                                            }${
                                                run.error_message
                                                    ? ` — ${run.error_message}`
                                                    : ""
                                            }`}
                                        />
                                </ListItem>
                            ))}
                        </List>
                    </CardContent>
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
