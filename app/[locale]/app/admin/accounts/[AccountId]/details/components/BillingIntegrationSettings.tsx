"use client";

import {
    ExpandMore as ExpandMoreIcon,
    InfoOutlined as InfoOutlinedIcon,
    Lock as LockIcon,
    MoreHoriz as MoreHorizIcon,
    Sync as SyncIcon,
} from "@mui/icons-material";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Autocomplete,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Divider,
    FormControl,
    Grid,
    InputAdornment,
    InputLabel,
    Menu,
    MenuItem,
    Select,
    Switch,
    Tab,
    Tabs,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import type { ConnectorAuthType, ImportType } from "@/types/db";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import moment from "moment";
import { useSession } from "next-auth/react";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useTranslation } from "react-i18next";

import { normalizeConnectorEnabledEntities } from "@/shared/constants/importEntityFields";
import ConnectorEntityPullFilterEditor, {
    type ConnectorEntityPullFilterEditorHandle,
} from "@/shared/layout-components/import/ConnectorEntityPullFilterEditor";
import ConnectorFieldMapper, {
    type ConnectorFieldMapperHandle,
} from "@/shared/layout-components/import/ConnectorFieldMapper";
import ConnectorPreviewSyncResults from "@/shared/layout-components/import/ConnectorPreviewSyncResults";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import {
    canStartFirstBackfill,
    findRunningBackfillRun,
    isBackfillSyncRun,
    readBackfillProgressSession,
    resolveBackfillProgressRun,
    writeBackfillProgressSession,
    type BackfillProgressSession,
} from "@/shared/services/backfillImportProgress";
import {
    fetchBillingConnectorConfig,
    fetchBillingConnectorMapping,
    fetchBillingConnectorSyncRuns,
    cancelBillingConnectorSync,
    resetBillingConnectorBackfill,
    runBillingConnectorBackfill,
    runBillingConnectorIncrementalSync,
    runBillingConnectorPreviewSync,
    saveBillingConnectorConfig,
    testBillingConnectorConnection,
    refreshBillingConnectorEntitySetCatalog,
    type PreviewSyncResponse,
    type PullFiltersMap,
    type SyncRunSummary,
} from "@/shared/services/billingConnectorService";
import { getDatePickerFormat } from "@/utils/datetimeOperations";

import AsOfBackfillCard from "./AsOfBackfillCard";
import BackfillImportProgress from "./BackfillImportProgress";

const ENTITY_OPTIONS: { value: ImportType; label: string }[] = [
    { value: "Customer", label: "Customers" },
    { value: "Contact", label: "Contacts" },
    { value: "Invoice", label: "Invoices" },
    { value: "Payment", label: "Payments" },
];

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

const SCHEDULE_PRESET_OPTIONS: { value: SchedulePresetValue; label: string }[] =
    [
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

type LifecycleStepId =
    | "connect"
    | "map"
    | "preview"
    | "backfill"
    | "incremental";

type SectionId =
    | "connection"
    | "entities"
    | "schedule"
    | "runs"
    | "advanced";

const LIFECYCLE_STEPS: {
    id: LifecycleStepId;
    label: string;
    section: SectionId;
}[] = [
    { id: "connect", label: "Connect", section: "connection" },
    { id: "map", label: "Map fields", section: "entities" },
    { id: "preview", label: "Preview", section: "entities" },
    { id: "backfill", label: "Backfill", section: "schedule" },
    { id: "incremental", label: "Incremental sync", section: "runs" },
];

type EntityInnerTab = "mapping" | "preview";

type PreviewSamplesByEntity = Partial<
    Record<
        ImportType,
        {
            entity: PreviewSyncResponse["entities"][number];
            go_no_go: PreviewSyncResponse["go_no_go"];
            cutover_summary: string | null | undefined;
        }
    >
>;

function buildEntityPreviewSessionEntry(
    entity: PreviewSyncResponse["entities"][number],
    checks: PreviewSyncResponse["go_no_go"]["checks"],
    cutoverSummary: string | null | undefined
): NonNullable<PreviewSamplesByEntity[ImportType]> {
    const entityPassed =
        entity.validation_errors.length === 0 &&
        entity.sample_rows.length > 0 &&
        (entity.import_type !== "Invoice" || entity.sorted_preview);

    return {
        entity,
        cutover_summary: cutoverSummary,
        go_no_go: {
            required_field_errors: entity.validation_errors.length,
            passed: entityPassed,
            checks: checks
                .filter(
                    (check) =>
                        check.id === "cutover_window" ||
                        check.id === "required_fields" ||
                        check.id === "sample_rows" ||
                        (entity.import_type === "Invoice" &&
                            check.id === "invoice_sort")
                )
                .map((check) => {
                    if (check.id === "required_fields") {
                        return {
                            ...check,
                            passed: entity.validation_errors.length === 0,
                            detail:
                                entity.validation_errors.length === 0
                                    ? "All required fields mapped and populated in preview samples."
                                    : `${entity.validation_errors.length} required-field validation error(s) found.`,
                        };
                    }
                    if (check.id === "sample_rows") {
                        return {
                            ...check,
                            passed: entity.sample_rows.length > 0,
                            detail: `${entity.import_type}: ${entity.sample_rows.length} sample row(s)${entity.match_count_capped ? "+" : ""}`,
                        };
                    }
                    if (check.id === "invoice_sort") {
                        return {
                            ...check,
                            passed: entity.sorted_preview,
                        };
                    }
                    return check;
                }),
        },
    };
}

type PrimaryActionKind =
    | "configure_connection"
    | "configure_entities"
    | "run_preview"
    | "start_backfill"
    | "run_incremental"
    | "sync_busy";

interface BillingIntegrationSettingsProps {
    accountId: number;
    canManage: boolean;
}

export default function BillingIntegrationSettings({
    accountId,
    canManage,
}: BillingIntegrationSettingsProps) {
    const { success, error: showError } = useToast();
    const queryClient = useQueryClient();
    const theme = useTheme();
    const { data: session } = useSession();
    const { i18n } = useTranslation();
    const isRTL = i18n.language === "he";
    const datePickerFormat = useMemo(
        () => getDatePickerFormat(session, "DD/MM/YYYY"),
        [session]
    );

    const [backfillProgressPolling, setBackfillProgressPolling] =
        useState(false);
    const [backfillProgressSession, setBackfillProgressSession] =
        useState<BackfillProgressSession | null>(null);

    const { data: config, isLoading } = useQuery({
        queryKey: ["billing-connector", accountId],
        queryFn: () => fetchBillingConnectorConfig(accountId),
        enabled: accountId > 0,
        refetchInterval: backfillProgressPolling ? 5000 : false,
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
    const [enabledEntities, setEnabledEntities] = useState<ImportType[]>([
        "Customer",
        "Contact",
        "Invoice",
        "Payment",
    ]);
    const [mappingComplete, setMappingComplete] = useState<
        Partial<Record<ImportType, boolean>>
    >({});
    const [previewSamplesByEntity, setPreviewSamplesByEntity] =
        useState<PreviewSamplesByEntity>({});
    const [mappingEntityTab, setMappingEntityTab] = useState(0);
    const [entityInnerTab, setEntityInnerTab] = useState<EntityInnerTab>(
        "mapping"
    );
    const [previewingEntity, setPreviewingEntity] = useState<ImportType | null>(
        null
    );
    const [backfillStartDate, setBackfillStartDate] = useState("");
    const [skipReportingBreachOnBackfill, setSkipReportingBreachOnBackfill] =
        useState(false);
    const [includeOlderOpenInvoices, setIncludeOlderOpenInvoices] =
        useState(true);
    const [overflowAnchor, setOverflowAnchor] = useState<null | HTMLElement>(
        null
    );
    const [isConfigureSaving, setIsConfigureSaving] = useState(false);
    const [entitySets, setEntitySets] = useState<
        Partial<Record<ImportType, string>>
    >({});
    const [entitySetCatalog, setEntitySetCatalog] = useState<string[]>([]);
    const [isRefreshingEntitySetCatalog, setIsRefreshingEntitySetCatalog] =
        useState(false);
    const [expandedSections, setExpandedSections] = useState<
        Partial<Record<SectionId, boolean>>
    >({});
    const [editorDirty, setEditorDirty] = useState<Record<string, boolean>>(
        {}
    );
    const [editorsRemountKey, setEditorsRemountKey] = useState(0);
    const didInitExpandRef = useRef(false);

    const mappingRefs = useRef<
        Partial<Record<ImportType, ConnectorFieldMapperHandle | null>>
    >({});
    const filterRefs = useRef<
        Partial<
            Record<ImportType, ConnectorEntityPullFilterEditorHandle | null>
        >
    >({});
    const sectionRefs = useRef<Partial<Record<SectionId, HTMLElement | null>>>(
        {}
    );

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
        setBackfillStartDate(config.backfill_start_date ?? "");
        setIncludeOlderOpenInvoices(
            config.include_older_open_invoices ?? true
        );
        setSkipReportingBreachOnBackfill(
            Boolean(config.skip_reporting_breach_on_backfill)
        );
        setEntitySets(config.entity_sets ?? {});
        setEntitySetCatalog(config.entity_set_catalog ?? []);
    }, [config]);

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

    const buildConfigPayload = (
        pullFilters?: PullFiltersMap
    ): Parameters<typeof saveBillingConnectorConfig>[1] => {
        const credentials = buildCredentials();
        const payload: Parameters<typeof saveBillingConnectorConfig>[1] = {
            provider,
            base_url: baseUrl.trim() || null,
            auth_type: authType,
            sync_enabled: syncEnabled,
            enabled_entities: enabledEntities,
            backfill_start_date: backfillStartDate.trim() || null,
            include_older_open_invoices: includeOlderOpenInvoices,
            skip_reporting_breach_on_backfill: skipReportingBreachOnBackfill,
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
        if (pullFilters) {
            payload.pull_filters = pullFilters;
        }
        payload.entity_sets = {
            Customer: entitySets.Customer ?? null,
            Contact: entitySets.Contact ?? null,
            Invoice: entitySets.Invoice ?? null,
            Payment: entitySets.Payment ?? null,
        };
        return payload;
    };

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
            showError(axiosErrorMessage(err) ?? "Connection test failed");
        },
    });

    const previewMutation = useMutation({
        mutationFn: (importType?: ImportType) =>
            runBillingConnectorPreviewSync(
                accountId,
                importType ? { importType } : undefined
            ),
        onSuccess: (result, importType) => {
            setPreviewSamplesByEntity((prev) => {
                const next = { ...prev };
                for (const entity of result.entities) {
                    next[entity.import_type] = buildEntityPreviewSessionEntry(
                        entity,
                        result.go_no_go.checks,
                        result.cutover_summary
                    );
                }
                return next;
            });
            void queryClient.invalidateQueries({
                queryKey: ["billing-connector", accountId],
            });
            if (result.go_no_go.passed) {
                success(
                    importType
                        ? `${importType} preview passed`
                        : "Preview sync passed go/no-go checks"
                );
            } else {
                showError(
                    importType
                        ? `${importType} preview completed with validation issues`
                        : "Preview sync completed with validation issues — review results in each entity’s Preview tab"
                );
            }
        },
        onError: (err: unknown) => {
            showError(axiosErrorMessage(err) ?? "Preview sync failed");
        },
        onSettled: () => {
            setPreviewingEntity(null);
        },
    });

    const backfillMutation = useMutation({
        mutationFn: () => runBillingConnectorBackfill(accountId),
        onSuccess: (result: { execution_id?: string } | undefined) => {
            success("Backfill sync started");
            const executionId = result?.execution_id;
            if (executionId) {
                const next: BackfillProgressSession = {
                    executionId: String(executionId),
                    dismissed: false,
                };
                setBackfillProgressSession(next);
                writeBackfillProgressSession(accountId, next);
            }
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
        onSuccess: () => {
            success("Incremental sync completed");
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
            success("Backfill reset — start date is editable again");
            setPreviewSamplesByEntity({});
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

    const { data: syncRuns = [] } = useQuery({
        queryKey: ["billing-connector-sync-runs", accountId],
        queryFn: () => fetchBillingConnectorSyncRuns(accountId),
        enabled: accountId > 0 && Boolean(config?.has_credentials),
        refetchInterval: (query) => {
            if (backfillProgressPolling) {
                return 5000;
            }
            const runs = query.state.data as SyncRunSummary[] | undefined;
            const hasRunning = runs?.some((run) => run.status === "RUNNING");
            return hasRunning ? 15000 : false;
        },
    });

    const syncInProgress = syncRuns.some((run) => run.status === "RUNNING");
    const nonBackfillSyncInProgress = syncRuns.some(
        (run) => run.status === "RUNNING" && !isBackfillSyncRun(run)
    );

    useEffect(() => {
        setBackfillProgressSession(readBackfillProgressSession(accountId));
    }, [accountId]);

    useEffect(() => {
        setBackfillProgressPolling(
            Boolean(findRunningBackfillRun(syncRuns)) ||
                backfillMutation.isPending
        );
    }, [syncRuns, backfillMutation.isPending]);

    useEffect(() => {
        const running = findRunningBackfillRun(syncRuns);
        if (!running) {
            return;
        }
        const next: BackfillProgressSession = {
            executionId: running.id,
            dismissed: false,
        };
        setBackfillProgressSession((prev) => {
            if (prev?.executionId === next.executionId && !prev.dismissed) {
                return prev;
            }
            writeBackfillProgressSession(accountId, next);
            return next;
        });
    }, [accountId, syncRuns]);

    const backfillProgressResolved = useMemo(
        () =>
            resolveBackfillProgressRun({
                runs: syncRuns,
                session: backfillProgressSession,
            }),
        [syncRuns, backfillProgressSession]
    );

    const showBackfillProgress = Boolean(backfillProgressResolved.run);

    const handleDismissBackfillProgress = useCallback(() => {
        const run = backfillProgressResolved.run;
        if (!run || run.status === "RUNNING") {
            return;
        }
        const next: BackfillProgressSession = {
            executionId: run.id,
            dismissed: true,
        };
        setBackfillProgressSession(next);
        writeBackfillProgressSession(accountId, next);
    }, [accountId, backfillProgressResolved.run]);

    const cancelSyncMutation = useMutation({
        mutationFn: () => cancelBillingConnectorSync(accountId),
        onSuccess: (result) => {
            if (result.cancelled) {
                success("Import stop requested — sync will halt shortly");
            } else {
                showError("No sync is currently running");
            }
            queryClient.invalidateQueries({
                queryKey: ["billing-connector", accountId],
            });
            queryClient.invalidateQueries({
                queryKey: ["billing-connector-sync-runs", accountId],
            });
        },
        onError: (err: unknown) => {
            showError(axiosErrorMessage(err) ?? "Failed to stop import");
        },
    });

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

    const entitiesForMapping = useMemo(
        () => normalizeConnectorEnabledEntities(enabledEntities),
        [enabledEntities]
    );

    // Load completeness so the primary CTA / stepper are correct.
    useEffect(() => {
        if (!config?.has_credentials || entitiesForMapping.length === 0) {
            return;
        }
        let cancelled = false;
        void (async () => {
            const entries = await Promise.all(
                entitiesForMapping.map(async (entity) => {
                    try {
                        const mapping = await fetchBillingConnectorMapping(
                            accountId,
                            entity
                        );
                        return [entity, Boolean(mapping?.is_complete)] as const;
                    } catch {
                        return [entity, false] as const;
                    }
                })
            );
            if (cancelled) {
                return;
            }
            setMappingComplete((prev) => {
                const next = { ...prev };
                for (const [entity, isComplete] of entries) {
                    next[entity] = isComplete;
                }
                return next;
            });
        })();
        return () => {
            cancelled = true;
        };
    }, [accountId, config?.has_credentials, entitiesForMapping]);

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

    const previewPassed = canStartFirstBackfill({
        enabledEntities: entitiesForMapping,
        previewPasses: config?.preview_passes,
        backfillOptionsLocked: config?.backfill_options_locked,
        syncMode: config?.sync_mode,
    });

    const entityHasUnsavedEdits = useCallback(
        (entity: ImportType) =>
            Boolean(
                editorDirty[`mapping:${entity}`] ||
                    editorDirty[`filter:${entity}`]
            ),
        [editorDirty]
    );

    const clearPreviewSample = useCallback((entity: ImportType) => {
        setPreviewSamplesByEntity((prev) => {
            if (!prev[entity]) {
                return prev;
            }
            const next = { ...prev };
            delete next[entity];
            return next;
        });
    }, []);

    const completeMappingCount = entitiesForMapping.filter(
        (entity) => mappingComplete[entity] === true
    ).length;

    const primaryAction = useMemo((): {
        kind: PrimaryActionKind;
        label: string;
    } => {
        if (syncInProgress) {
            return { kind: "sync_busy", label: "Sync in progress…" };
        }
        if (!config?.has_credentials || circuitBreakerActive) {
            return {
                kind: "configure_connection",
                label: circuitBreakerActive
                    ? "Fix connection"
                    : "Configure connection",
            };
        }
        if (!allEnabledMappingsComplete) {
            return {
                kind: "configure_entities",
                label:
                    entitiesForMapping.length === 0
                        ? "Enable entities"
                        : "Configure entities",
            };
        }
        if (config.sync_mode === "INCREMENTAL") {
            return {
                kind: "run_incremental",
                label: "Run incremental sync now",
            };
        }
        if (!previewPassed) {
            return { kind: "run_preview", label: "Run preview sync" };
        }
        return {
            kind: "start_backfill",
            label:
                config.sync_mode === "BACKFILL" ||
                config.backfill_options_locked
                    ? "Resume backfill"
                    : "Start backfill",
        };
    }, [
        syncInProgress,
        config?.has_credentials,
        config?.sync_mode,
        config?.backfill_options_locked,
        circuitBreakerActive,
        allEnabledMappingsComplete,
        entitiesForMapping.length,
        previewPassed,
    ]);

    const statusSummary = useMemo(() => {
        if (!config?.has_credentials) {
            return "Not connected — save credentials to continue";
        }
        if (circuitBreakerActive) {
            return config.last_connection_error
                ? `Connection error — ${config.last_connection_error}`
                : "Connection error — fix credentials and test connection";
        }
        if (entitiesForMapping.length === 0) {
            return "No entities enabled — turn on at least one entity";
        }
        if (!allEnabledMappingsComplete) {
            return `Map fields — ${completeMappingCount} of ${entitiesForMapping.length} entities ready`;
        }
        if (config.sync_mode === "INCREMENTAL") {
            return "Incremental sync ready — backfill complete";
        }
        if (!previewPassed) {
            return "Ready for preview — mappings complete";
        }

        const states = config.sync_states ?? [];
        const completed = states.filter((s) => s.backfill_completed).length;
        const remaining = Math.max(entitiesForMapping.length - completed, 0);
        if (config.backfill_options_locked || config.sync_mode === "BACKFILL") {
            if (completed > 0 && remaining > 0) {
                const doneLabel =
                    ENTITY_OPTIONS.find(
                        (opt) =>
                            opt.value ===
                            states.find((s) => s.backfill_completed)
                                ?.entity_type
                    )?.label ?? "Entities";
                return `Backfill in progress — ${doneLabel} complete, ${remaining} entit${remaining === 1 ? "y" : "ies"} remaining`;
            }
            if (syncInProgress) {
                return "Backfill in progress";
            }
            return completed === entitiesForMapping.length && completed > 0
                ? "Backfill nearly complete — finish remaining work"
                : "Backfill started — resume to continue";
        }
        return "Preview passed — ready to start backfill";
    }, [
        config,
        circuitBreakerActive,
        entitiesForMapping.length,
        allEnabledMappingsComplete,
        completeMappingCount,
        previewPassed,
        syncInProgress,
    ]);

    const statusSubtitle = useMemo(() => {
        const providerLabel = config?.provider
            ? `${config.provider === "PRIORITY" ? "Priority" : config.provider} connector`
            : "Billing connector";
        if (!config?.has_credentials || circuitBreakerActive) {
            return `${providerLabel} · connect and test before syncing.`;
        }
        if (!allEnabledMappingsComplete) {
            return `${providerLabel} · finish field mapping for enabled entities.`;
        }
        if (config.sync_mode === "INCREMENTAL") {
            return `${providerLabel} · incremental sync is active.`;
        }
        if (!previewPassed) {
            return `${providerLabel} · run preview before starting backfill.`;
        }
        if (config.sync_mode === "BACKFILL" || config.backfill_options_locked) {
            return `${providerLabel} · pulling historical records before incremental sync can start.`;
        }
        return `${providerLabel} · ready to pull historical records.`;
    }, [
        config,
        circuitBreakerActive,
        allEnabledMappingsComplete,
        previewPassed,
    ]);

    const cutoverDateLabel = useMemo(() => {
        const raw = backfillStartDate.trim();
        if (!raw) {
            return null;
        }
        const parsed = new Date(`${raw}T00:00:00`);
        if (Number.isNaN(parsed.getTime())) {
            return raw;
        }
        return parsed.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    }, [backfillStartDate]);

    const currentLifecycleStep = useMemo((): LifecycleStepId => {
        if (!config?.has_credentials || circuitBreakerActive) {
            return "connect";
        }
        if (!allEnabledMappingsComplete) {
            return "map";
        }
        if (config.sync_mode === "INCREMENTAL") {
            return "incremental";
        }
        if (!previewPassed) {
            return "preview";
        }
        return "backfill";
    }, [
        config?.has_credentials,
        config?.sync_mode,
        circuitBreakerActive,
        allEnabledMappingsComplete,
        previewPassed,
    ]);

    const currentStepIndex = LIFECYCLE_STEPS.findIndex(
        (step) => step.id === currentLifecycleStep
    );

    useEffect(() => {
        didInitExpandRef.current = false;
        setExpandedSections({});
        setEditorDirty({});
    }, [accountId]);

    useEffect(() => {
        if (!config || didInitExpandRef.current) {
            return;
        }
        didInitExpandRef.current = true;
        const section =
            LIFECYCLE_STEPS.find((step) => step.id === currentLifecycleStep)
                ?.section ?? "connection";
        setExpandedSections({ [section]: true });
    }, [config, currentLifecycleStep]);

    const goToSection = useCallback((section: SectionId) => {
        setExpandedSections((prev) => ({ ...prev, [section]: true }));
        window.requestAnimationFrame(() => {
            sectionRefs.current[section]?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        });
    }, []);

    const goToEntitiesPreview = useCallback(() => {
        const firstNeedsPreview = ENTITY_OPTIONS.findIndex((opt) => {
            const isOn = enabledEntities.includes(opt.value);
            if (!isOn) {
                return false;
            }
            return config?.preview_passes?.[opt.value]?.passed !== true;
        });
        const index = firstNeedsPreview >= 0 ? firstNeedsPreview : 0;
        setMappingEntityTab(index);
        const entity = ENTITY_OPTIONS[index]?.value;
        if (entity && mappingComplete[entity]) {
            setEntityInnerTab("preview");
        } else {
            setEntityInnerTab("mapping");
        }
        goToSection("entities");
    }, [config?.preview_passes, enabledEntities, goToSection, mappingComplete]);

    const navigateLifecycleStep = useCallback(
        (step: (typeof LIFECYCLE_STEPS)[number]) => {
            if (step.id === "preview") {
                goToEntitiesPreview();
                return;
            }
            goToSection(step.section);
        },
        [goToEntitiesPreview, goToSection]
    );

    const toggleSection = useCallback((section: SectionId) => {
        setExpandedSections((prev) => ({
            ...prev,
            [section]: !prev[section],
        }));
    }, []);

    const handleEditorDirtyChange = useCallback(
        (key: string, dirty: boolean) => {
            setEditorDirty((prev) => {
                if (prev[key] === dirty) {
                    return prev;
                }
                return { ...prev, [key]: dirty };
            });
        },
        []
    );

    const applyConfigToForm = useCallback(() => {
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
        setBackfillStartDate(config.backfill_start_date ?? "");
        setIncludeOlderOpenInvoices(
            config.include_older_open_invoices ?? true
        );
        setSkipReportingBreachOnBackfill(
            Boolean(config.skip_reporting_breach_on_backfill)
        );
        setEntitySets(config.entity_sets ?? {});
        setEntitySetCatalog(config.entity_set_catalog ?? []);
        setApiKeyToken("");
        setBasicUsername("");
        setBasicPassword("");
        setOauthClientId("");
        setOauthClientSecret("");
        setOauthTokenEndpoint("");
    }, [config]);

    const configFormDirty = useMemo(() => {
        if (!config) {
            return false;
        }
        if (provider !== config.provider) {
            return true;
        }
        if ((baseUrl.trim() || "") !== (config.base_url ?? "")) {
            return true;
        }
        if (authType !== config.auth_type) {
            return true;
        }
        if (syncEnabled !== config.sync_enabled) {
            return true;
        }
        const savedPreset = config.schedule_preset ?? "custom";
        if (schedulePreset !== savedPreset) {
            return true;
        }
        if (
            (schedulePreset === "daily" || schedulePreset === "weekly") &&
            dailyTimeUtc !== (config.daily_time_utc ?? "03:00")
        ) {
            return true;
        }
        if (
            schedulePreset === "weekly" &&
            weeklyDay !== (config.weekly_day ?? 1)
        ) {
            return true;
        }
        if (
            schedulePreset === "custom" &&
            syncCron.trim() !== config.sync_cron_expression
        ) {
            return true;
        }
        if (
            (backfillStartDate.trim() || "") !==
            (config.backfill_start_date ?? "")
        ) {
            return true;
        }
        if (
            includeOlderOpenInvoices !==
            (config.include_older_open_invoices ?? true)
        ) {
            return true;
        }
        if (
            skipReportingBreachOnBackfill !==
            Boolean(config.skip_reporting_breach_on_backfill)
        ) {
            return true;
        }
        const savedEntities = normalizeConnectorEnabledEntities(
            config.enabled_entities
        );
        if (
            JSON.stringify([...enabledEntities].sort()) !==
            JSON.stringify([...savedEntities].sort())
        ) {
            return true;
        }
        for (const opt of ENTITY_OPTIONS) {
            const local = entitySets[opt.value] ?? "";
            const saved = config.entity_sets?.[opt.value] ?? "";
            if (local !== saved) {
                return true;
            }
        }
        return false;
    }, [
        config,
        provider,
        baseUrl,
        authType,
        syncEnabled,
        schedulePreset,
        dailyTimeUtc,
        weeklyDay,
        syncCron,
        backfillStartDate,
        includeOlderOpenInvoices,
        skipReportingBreachOnBackfill,
        enabledEntities,
        entitySets,
    ]);

    const secretsDirty =
        Boolean(apiKeyToken.trim()) ||
        Boolean(basicUsername.trim()) ||
        Boolean(basicPassword) ||
        Boolean(oauthClientId.trim()) ||
        Boolean(oauthClientSecret) ||
        Boolean(oauthTokenEndpoint.trim());

    const editorsHaveDirty = Object.values(editorDirty).some(Boolean);
    const isDirty = configFormDirty || secretsDirty || editorsHaveDirty;

    const handlePrimaryAction = () => {
        switch (primaryAction.kind) {
            case "configure_connection":
                goToSection("connection");
                break;
            case "configure_entities":
                goToSection("entities");
                break;
            case "run_preview":
                if (editorsHaveDirty) {
                    goToEntitiesPreview();
                    showError("Save changes before running preview");
                    break;
                }
                goToEntitiesPreview();
                previewMutation.mutate(undefined);
                break;
            case "start_backfill":
                backfillMutation.mutate();
                break;
            case "run_incremental":
                incrementalMutation.mutate();
                break;
            default:
                break;
        }
    };

    const primaryBusy =
        previewMutation.isPending ||
        backfillMutation.isPending ||
        incrementalMutation.isPending;

    const handleConfigureSave = async () => {
        if (!canManage || isConfigureSaving) {
            return;
        }

        for (const entity of entitiesForMapping) {
            const filterHandle = filterRefs.current[entity];
            if (filterHandle && !filterHandle.canSaveDraft()) {
                showError(
                    `${entity}: discover Priority fields before saving rule-builder filters`
                );
                return;
            }
        }

        const pullFilters: PullFiltersMap = {};
        for (const entity of entitiesForMapping) {
            const filterHandle = filterRefs.current[entity];
            if (filterHandle) {
                pullFilters[entity] = filterHandle.getDraftConfig();
            }
        }

        setIsConfigureSaving(true);
        try {
            await saveBillingConnectorConfig(
                accountId,
                buildConfigPayload(
                    Object.keys(pullFilters).length > 0
                        ? pullFilters
                        : undefined
                )
            );

            for (const entity of entitiesForMapping) {
                const mapper = mappingRefs.current[entity];
                if (mapper) {
                    const ok = await mapper.save();
                    if (!ok) {
                        showError(
                            `Settings saved, but ${entity} mapping failed`
                        );
                        await queryClient.invalidateQueries({
                            queryKey: ["billing-connector", accountId],
                        });
                        setPreviewSamplesByEntity({});
                        return;
                    }
                }
            }

            setApiKeyToken("");
            setBasicPassword("");
            setOauthClientSecret("");
            setPreviewSamplesByEntity({});
            setEditorDirty({});
            await queryClient.invalidateQueries({
                queryKey: ["billing-connector", accountId],
            });
            success("Billing connector settings saved");
        } catch (err: unknown) {
            showError(
                axiosErrorMessage(err) ?? "Failed to save billing connector"
            );
        } finally {
            setIsConfigureSaving(false);
        }
    };

    const handleDiscardChanges = () => {
        applyConfigToForm();
        setEditorDirty({});
        setEditorsRemountKey((key) => key + 1);
    };

    const handleResetBackfill = () => {
        setOverflowAnchor(null);
        if (
            typeof window !== "undefined" &&
            !window.confirm(
                "Reset backfill progress for all entities and unlock the start date and pull filters? Imported data is not deleted. If you then tighten pull filters, the next Backfill may soft-exclude connector-imported rows that no longer match (no hard-delete)."
            )
        ) {
            return;
        }
        resetBackfillMutation.mutate();
    };

    if (isLoading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    const nextSyncLabel = config?.next_scheduled_sync_at_utc
        ? new Date(config.next_scheduled_sync_at_utc)
              .toISOString()
              .replace("T", " ")
              .replace(/\.\d{3}Z$/, " UTC")
        : null;

    const renderSectionSummary = (
        title: string,
        meta?: React.ReactNode
    ) => (
        <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{ px: 2.5 }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.25,
                    flexWrap: "wrap",
                    width: "100%",
                    pr: 1,
                }}
            >
                <Typography variant="subtitle2" fontWeight={600}>
                    {title.toUpperCase()}
                </Typography>
                {meta}
            </Box>
        </AccordionSummary>
    );

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                pb: isDirty ? 10 : 0,
            }}
        >
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

            <Box
                sx={{
                    position: "sticky",
                    top: 12,
                    zIndex: 5,
                    bgcolor: "background.paper",
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 2,
                    px: 2.5,
                    py: 2,
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        width: { xs: "100%", md: "85%" },
                        mx: "auto",
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            width: "100%",
                            direction: isRTL ? "rtl" : "ltr",
                            flexDirection: isRTL ? "row-reverse" : "row",
                        }}
                    >
                        {(isRTL
                            ? [...LIFECYCLE_STEPS].reverse()
                            : LIFECYCLE_STEPS
                        ).map((step, originalIndex) => {
                            const index = isRTL
                                ? LIFECYCLE_STEPS.length - 1 - originalIndex
                                : originalIndex;
                            const isActive = currentStepIndex === index;
                            const isCompleted = currentStepIndex > index;

                            return (
                                <React.Fragment key={step.id}>
                                    <Box
                                        sx={{
                                            position: "relative",
                                            width: 28,
                                            height: 28,
                                            borderRadius: "50%",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            bgcolor:
                                                isActive || isCompleted
                                                    ? theme.palette.primary
                                                          .main
                                                    : theme.palette.grey[300],
                                            color:
                                                isActive || isCompleted
                                                    ? "white"
                                                    : theme.palette.grey[600],
                                            fontWeight: 600,
                                            fontSize: "12px",
                                            transition: "all 0.3s ease",
                                            cursor: "pointer",
                                            flexShrink: 0,
                                            "&:hover": {
                                                transform: "scale(1.1)",
                                            },
                                        }}
                                        onClick={() =>
                                            navigateLifecycleStep(step)
                                        }
                                    >
                                        <Typography
                                            variant="body1"
                                            sx={{
                                                fontWeight: 600,
                                                fontSize: "12px",
                                            }}
                                        >
                                            {index + 1}
                                        </Typography>
                                    </Box>
                                    {originalIndex <
                                        LIFECYCLE_STEPS.length - 1 && (
                                        <Box
                                            sx={{
                                                flex: 1,
                                                height: 2,
                                                mx: 2,
                                                bgcolor: isCompleted
                                                    ? theme.palette.primary
                                                          .main
                                                    : theme.palette.grey[300],
                                                transition:
                                                    "background-color 0.3s ease",
                                            }}
                                        />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </Box>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "flex-start",
                            width: "100%",
                            mt: 1,
                            direction: isRTL ? "rtl" : "ltr",
                            flexDirection: isRTL ? "row-reverse" : "row",
                        }}
                    >
                        {(isRTL
                            ? [...LIFECYCLE_STEPS].reverse()
                            : LIFECYCLE_STEPS
                        ).map((step, originalIndex) => {
                            const index = isRTL
                                ? LIFECYCLE_STEPS.length - 1 - originalIndex
                                : originalIndex;
                            const isActive = currentStepIndex === index;
                            const isCompleted = currentStepIndex > index;

                            return (
                                <React.Fragment key={`${step.id}-label`}>
                                    <Box
                                        sx={{
                                            width: 28,
                                            display: "flex",
                                            justifyContent: "center",
                                            flexShrink: 0,
                                        }}
                                    >
                                        <Typography
                                            variant="body2"
                                            onClick={() =>
                                                navigateLifecycleStep(step)
                                            }
                                            sx={{
                                                fontSize: {
                                                    xs: "11px",
                                                    sm: "13px",
                                                    md: "14px",
                                                },
                                                fontWeight:
                                                    isActive || isCompleted
                                                        ? 600
                                                        : 400,
                                                color:
                                                    isActive || isCompleted
                                                        ? theme.palette.text
                                                              .primary
                                                        : theme.palette.text
                                                              .secondary,
                                                textAlign: "center",
                                                direction: isRTL
                                                    ? "rtl"
                                                    : "ltr",
                                                whiteSpace: "nowrap",
                                                cursor: "pointer",
                                            }}
                                        >
                                            {step.label}
                                        </Typography>
                                    </Box>
                                    {originalIndex <
                                        LIFECYCLE_STEPS.length - 1 && (
                                        <Box
                                            sx={{
                                                flex: 1,
                                                mx: 2,
                                            }}
                                        />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </Box>
                </Box>
            </Box>

            <Card
                elevation={0}
                sx={{
                    bgcolor: "background.paper",
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 2,
                    boxShadow: "none",
                }}
            >
                <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: 2,
                            flexWrap: "wrap",
                        }}
                    >
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography
                                sx={{
                                    fontSize: 16,
                                    fontWeight: 600,
                                    lineHeight: 1.35,
                                }}
                            >
                                {statusSummary}
                            </Typography>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mt: 0.5, fontSize: 13 }}
                            >
                                {statusSubtitle}
                            </Typography>
                        </Box>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                flexShrink: 0,
                            }}
                        >
                            <Button
                                variant="outlined"
                                aria-label="More sync actions"
                                onClick={(e) =>
                                    setOverflowAnchor(e.currentTarget)
                                }
                                disabled={!canManage}
                                sx={{
                                    minWidth: 40,
                                    px: 1,
                                    borderColor: "divider",
                                    color: "text.primary",
                                }}
                            >
                                <MoreHorizIcon fontSize="small" />
                            </Button>
                            <Menu
                                anchorEl={overflowAnchor}
                                open={Boolean(overflowAnchor)}
                                onClose={() => setOverflowAnchor(null)}
                            >
                                {primaryAction.kind !== "run_preview" && (
                                    <MenuItem
                                        disabled={
                                            !allEnabledMappingsComplete ||
                                            editorsHaveDirty ||
                                            previewMutation.isPending ||
                                            syncInProgress
                                        }
                                        onClick={() => {
                                            setOverflowAnchor(null);
                                            previewMutation.mutate(undefined);
                                        }}
                                    >
                                        Run preview sync
                                    </MenuItem>
                                )}
                                {primaryAction.kind !== "run_incremental" && (
                                    <MenuItem
                                        disabled={
                                            config?.sync_mode !==
                                                "INCREMENTAL" ||
                                            incrementalMutation.isPending ||
                                            syncInProgress
                                        }
                                        onClick={() => {
                                            setOverflowAnchor(null);
                                            incrementalMutation.mutate();
                                        }}
                                    >
                                        Run incremental sync now
                                    </MenuItem>
                                )}
                                {primaryAction.kind !== "start_backfill" && (
                                    <MenuItem
                                        disabled={
                                            !previewPassed ||
                                            !allEnabledMappingsComplete ||
                                            config?.sync_mode ===
                                                "INCREMENTAL" ||
                                            backfillMutation.isPending ||
                                            syncInProgress
                                        }
                                        onClick={() => {
                                            setOverflowAnchor(null);
                                            backfillMutation.mutate();
                                        }}
                                    >
                                        Start / resume backfill
                                    </MenuItem>
                                )}
                                <MenuItem
                                    disabled={
                                        resetBackfillMutation.isPending ||
                                        syncInProgress
                                    }
                                    onClick={handleResetBackfill}
                                >
                                    Reset backfill
                                </MenuItem>
                            </Menu>
                            <Button
                                variant="contained"
                                onClick={handlePrimaryAction}
                                disabled={
                                    !canManage ||
                                    primaryBusy ||
                                    primaryAction.kind === "sync_busy" ||
                                    (primaryAction.kind === "start_backfill" &&
                                        config?.sync_mode === "INCREMENTAL")
                                }
                                startIcon={
                                    primaryBusy ? (
                                        <CircularProgress size={16} color="inherit" />
                                    ) : undefined
                                }
                            >
                                {primaryAction.label}
                            </Button>
                        </Box>
                    </Box>

                    <Box
                        sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 1,
                            mt: 2,
                        }}
                    >
                        <Chip
                            size="small"
                            label={
                                config?.has_credentials && !circuitBreakerActive
                                    ? `● ${
                                          config.provider === "PRIORITY"
                                              ? "Priority"
                                              : config.provider
                                      } connected`
                                    : "● Not connected"
                            }
                            sx={{
                                fontWeight: 500,
                                border: "none",
                                bgcolor:
                                    config?.has_credentials &&
                                    !circuitBreakerActive
                                        ? alpha(theme.palette.success.main, 0.12)
                                        : alpha(theme.palette.grey[500], 0.12),
                                color:
                                    config?.has_credentials &&
                                    !circuitBreakerActive
                                        ? "success.dark"
                                        : "text.secondary",
                            }}
                        />
                        <Chip
                            size="small"
                            label={
                                syncEnabled
                                    ? config?.schedule_summary
                                        ? `Sync ${config.schedule_summary}${
                                              nextSyncLabel
                                                  ? ` — next ${nextSyncLabel}`
                                                  : ""
                                          }`
                                        : "Sync on"
                                    : "Sync off"
                            }
                            sx={{
                                fontWeight: 500,
                                border: "none",
                                bgcolor: syncEnabled
                                    ? alpha(theme.palette.info.main, 0.12)
                                    : alpha(theme.palette.grey[500], 0.12),
                                color: syncEnabled
                                    ? "info.dark"
                                    : "text.secondary",
                            }}
                        />
                        <Chip
                            size="small"
                            label={`Entities ready ${completeMappingCount} / ${ENTITY_OPTIONS.length}`}
                            sx={{
                                fontWeight: 500,
                                border: "none",
                                bgcolor: alpha(theme.palette.grey[500], 0.12),
                                color: "text.secondary",
                            }}
                        />
                        <Chip
                            size="small"
                            label={`Mode: ${config?.sync_mode ?? "—"}`}
                            sx={{
                                fontWeight: 500,
                                border: "none",
                                bgcolor:
                                    config?.sync_mode === "BACKFILL"
                                        ? alpha(theme.palette.warning.main, 0.14)
                                        : alpha(theme.palette.grey[500], 0.12),
                                color:
                                    config?.sync_mode === "BACKFILL"
                                        ? "warning.dark"
                                        : "text.secondary",
                            }}
                        />
                    </Box>

                    <Box
                        sx={{
                            mt: 1.5,
                            pt: 1.5,
                            borderTop: "1px dashed",
                            borderColor: "divider",
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            flexWrap: "wrap",
                        }}
                    >
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ fontSize: 12.5 }}
                        >
                            Cutover: from{" "}
                            <Box component="strong" sx={{ fontWeight: 600 }}>
                                {cutoverDateLabel ?? "full history"}
                            </Box>
                            {backfillStartDate.trim()
                                ? includeOlderOpenInvoices
                                    ? " · includes older open invoices"
                                    : " · older open invoices off"
                                : null}
                            {skipReportingBreachOnBackfill
                                ? " · skip reporting breach on"
                                : null}
                            {config?.backfill_options_locked ? " ·" : null}
                        </Typography>
                        {config?.backfill_options_locked ? (
                            <Chip
                                size="small"
                                icon={
                                    <LockIcon
                                        sx={{ fontSize: "14px !important" }}
                                    />
                                }
                                label="locked — reset backfill to change"
                                sx={{
                                    height: 24,
                                    fontSize: 11,
                                    bgcolor: alpha(theme.palette.grey[500], 0.1),
                                    color: "text.secondary",
                                    border: 1,
                                    borderColor: "divider",
                                    "& .MuiChip-icon": {
                                        color: "text.secondary",
                                    },
                                }}
                            />
                        ) : null}
                    </Box>
                </CardContent>
            </Card>

            {showBackfillProgress && backfillProgressResolved.run ? (
                <BackfillImportProgress
                    run={backfillProgressResolved.run}
                    enabledEntities={entitiesForMapping}
                    syncStates={config?.sync_states}
                    onDismiss={handleDismissBackfillProgress}
                    onStop={() => cancelSyncMutation.mutate()}
                    stopPending={cancelSyncMutation.isPending}
                />
            ) : null}

            {nonBackfillSyncInProgress && (
                <Alert severity="info">
                    A sync is currently running. Actions are disabled until it
                    finishes — this updates automatically.
                </Alert>
            )}

            <Accordion
                disableGutters
                elevation={0}
                expanded={Boolean(expandedSections.connection)}
                onChange={() => toggleSection("connection")}
                ref={(el: HTMLDivElement | null) => {
                    sectionRefs.current.connection = el;
                }}
                sx={{
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 2,
                    "&:before": { display: "none" },
                    overflow: "hidden",
                }}
            >
                {renderSectionSummary(
                    "Connection",
                    config?.has_credentials ? (
                        <Chip size="small" color="success" label="Connected" />
                    ) : (
                        <Chip size="small" color="warning" label="Setup needed" />
                    )
                )}
                <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 0 }}>
                    <Grid container spacing={2}>
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
                                    <MenuItem value="PRIORITY">
                                        Priority
                                    </MenuItem>
                                    <MenuItem
                                        value="SAP_BUSINESS_ONE"
                                        disabled
                                    >
                                        SAP Business One (coming soon)
                                    </MenuItem>
                                </Select>
                            </FormControl>
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

                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                                fullWidth
                                label="Base URL"
                                value={baseUrl}
                                onChange={(e) => setBaseUrl(e.target.value)}
                                disabled={
                                    !canManage || provider !== "PRIORITY"
                                }
                                placeholder="https://host/odata/Priority/ini/company"
                            />
                        </Grid>

                        {authType === "API_KEY" && (
                            <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                    fullWidth
                                    type="password"
                                    label="API token"
                                    value={apiKeyToken}
                                    onChange={(e) =>
                                        setApiKeyToken(e.target.value)
                                    }
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
                                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
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
                                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
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
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField
                                        fullWidth
                                        label="Token endpoint"
                                        value={oauthTokenEndpoint}
                                        onChange={(e) =>
                                            setOauthTokenEndpoint(
                                                e.target.value
                                            )
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
                                    never shown after save. Leave blank to keep
                                    the existing value.
                                </Typography>
                            )}

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
                                disabled={!canManage || testMutation.isPending}
                            >
                                Test connection
                            </Button>
                        </Grid>
                    </Grid>
                </AccordionDetails>
            </Accordion>

            <Accordion
                disableGutters
                elevation={0}
                expanded={Boolean(expandedSections.entities)}
                onChange={() => toggleSection("entities")}
                ref={(el: HTMLDivElement | null) => {
                    sectionRefs.current.entities = el;
                }}
                sx={{
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 2,
                    "&:before": { display: "none" },
                    overflow: "hidden",
                }}
            >
                {renderSectionSummary(
                    "Entities",
                    <Typography variant="caption" color="text.secondary">
                        {completeMappingCount} of{" "}
                        {entitiesForMapping.length || ENTITY_OPTIONS.length}{" "}
                        ready
                    </Typography>
                )}
                <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 0 }}>
                    {!config?.has_credentials ? (
                        <Alert severity="info">
                            Save connection credentials first, then configure
                            entity mappings and filters.
                        </Alert>
                    ) : (
                        <>
                            <Tabs
                                value={mappingEntityTab}
                                onChange={(_, value) => {
                                    setMappingEntityTab(value);
                                    setEntityInnerTab("mapping");
                                }}
                                variant="fullWidth"
                                sx={{
                                    borderBottom: 1,
                                    borderColor: "divider",
                                    mb: 2,
                                }}
                            >
                                {ENTITY_OPTIONS.map((opt) => {
                                    const isOn = enabledEntities.includes(
                                        opt.value
                                    );
                                    const isComplete =
                                        mappingComplete[opt.value] === true;
                                    const previewPass =
                                        config?.preview_passes?.[opt.value];
                                    let statusLabel = "Off";
                                    let statusColor:
                                        | "disabled"
                                        | "success"
                                        | "warning"
                                        | "error" = "disabled";
                                    if (isOn && !isComplete) {
                                        statusLabel = "On · Incomplete";
                                        statusColor = "warning";
                                    } else if (isOn && previewPass?.passed) {
                                        statusLabel =
                                            "On · Mapped · Previewed";
                                        statusColor = "success";
                                    } else if (
                                        isOn &&
                                        previewPass &&
                                        previewPass.passed === false
                                    ) {
                                        statusLabel =
                                            "On · Mapped · Preview failed";
                                        statusColor = "error";
                                    } else if (isOn) {
                                        statusLabel =
                                            "On · Mapped · Needs preview";
                                        statusColor = "warning";
                                    }
                                    return (
                                        <Tab
                                            key={opt.value}
                                            sx={{
                                                // Let the label fill the tab so the switch
                                                // can pin to the start while the name stays centered.
                                                "& > *": {
                                                    width: "100%",
                                                    maxWidth: "100%",
                                                },
                                            }}
                                            label={
                                                <Box
                                                    component="span"
                                                    sx={{
                                                        position: "relative",
                                                        display: "flex",
                                                        width: "100%",
                                                        alignItems: "center",
                                                        justifyContent:
                                                            "center",
                                                    }}
                                                >
                                                    <Switch
                                                        checked={isOn}
                                                        disabled={!canManage}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                        }}
                                                        onChange={() =>
                                                            toggleEntity(
                                                                opt.value
                                                            )
                                                        }
                                                        inputProps={{
                                                            "aria-label": `Enable ${opt.label}`,
                                                        }}
                                                        sx={{
                                                            position:
                                                                "absolute",
                                                            insetInlineStart: 0,
                                                        }}
                                                    />
                                                    <Typography
                                                        component="span"
                                                        variant="body1"
                                                    >
                                                        {opt.label}{" "}
                                                        <Tooltip
                                                            title={statusLabel}
                                                            arrow
                                                            enterDelay={300}
                                                            leaveDelay={100}
                                                            placement="bottom"
                                                            PopperProps={{
                                                                sx: {
                                                                    "& .MuiTooltip-tooltip":
                                                                        {
                                                                            direction:
                                                                                isRTL
                                                                                    ? "rtl"
                                                                                    : "ltr",
                                                                        },
                                                                },
                                                            }}
                                                        >
                                                            <Typography
                                                                component="span"
                                                                variant="h6"
                                                                aria-label={
                                                                    statusLabel
                                                                }
                                                                color={
                                                                    statusColor ===
                                                                    "disabled"
                                                                        ? "text.disabled"
                                                                        : statusColor ===
                                                                            "success"
                                                                          ? "success.main"
                                                                          : statusColor ===
                                                                              "error"
                                                                            ? "error.main"
                                                                            : "warning.main"
                                                                }
                                                            >
                                                                ●
                                                            </Typography>
                                                        </Tooltip>
                                                    </Typography>
                                                </Box>
                                            }
                                        />
                                    );
                                })}
                            </Tabs>

                            {ENTITY_OPTIONS.map((opt, index) => {
                                const entity = opt.value;
                                const isOn = enabledEntities.includes(entity);

                                return (
                                    <Box
                                        key={`${entity}-${editorsRemountKey}`}
                                        role="tabpanel"
                                        hidden={mappingEntityTab !== index}
                                        sx={{ pt: 0 }}
                                    >
                                        {isOn ? (
                                            <>
                                                <Tabs
                                                    value={
                                                        entityInnerTab ===
                                                        "preview"
                                                            ? 1
                                                            : 0
                                                    }
                                                    onChange={(_, value) =>
                                                        setEntityInnerTab(
                                                            value === 1
                                                                ? "preview"
                                                                : "mapping"
                                                        )
                                                    }
                                                    sx={{
                                                        borderBottom: 1,
                                                        borderColor: "divider",
                                                        mb: 2,
                                                    }}
                                                >
                                                    <Tab label="Mapping" />
                                                    <Tab
                                                        label="Preview"
                                                        disabled={
                                                            mappingComplete[
                                                                entity
                                                            ] !== true ||
                                                            entityHasUnsavedEdits(
                                                                entity
                                                            )
                                                        }
                                                    />
                                                </Tabs>

                                                {entityInnerTab ===
                                                "mapping" ? (
                                            <ConnectorFieldMapper
                                                ref={(handle) => {
                                                    mappingRefs.current[
                                                        entity
                                                    ] = handle;
                                                }}
                                                accountId={accountId}
                                                importType={entity}
                                                canManage={canManage}
                                                hideEntityHeader
                                                hideSaveButton
                                                entitySet={
                                                    entitySets[entity] ?? ""
                                                }
                                                defaultEntitySet={
                                                    config
                                                        ?.default_entity_sets?.[
                                                        entity
                                                    ] ?? ""
                                                }
                                                entitySetCatalog={
                                                    entitySetCatalog
                                                }
                                                onDirtyChange={(dirty) =>
                                                    handleEditorDirtyChange(
                                                        `mapping:${entity}`,
                                                        dirty
                                                    )
                                                }
                                                betweenHeaderAndGrid={
                                                    <ConnectorEntityPullFilterEditor
                                                        ref={(handle) => {
                                                            filterRefs.current[
                                                                entity
                                                            ] = handle;
                                                        }}
                                                        accountId={accountId}
                                                        importType={entity}
                                                        canManage={canManage}
                                                        locked={Boolean(
                                                            config?.backfill_options_locked
                                                        )}
                                                        config={config}
                                                        hideSaveButton
                                                        onDirtyChange={(
                                                            dirty
                                                        ) =>
                                                            handleEditorDirtyChange(
                                                                `filter:${entity}`,
                                                                dirty
                                                            )
                                                        }
                                                        onSaved={() => {
                                                            clearPreviewSample(
                                                                entity
                                                            );
                                                            void queryClient.invalidateQueries(
                                                                {
                                                                    queryKey: [
                                                                        "billing-connector",
                                                                        accountId,
                                                                    ],
                                                                }
                                                            );
                                                        }}
                                                    />
                                                }
                                                onEntitySetChange={(
                                                    importType,
                                                    value
                                                ) => {
                                                    setEntitySets((prev) => {
                                                        const next = {
                                                            ...prev,
                                                        };
                                                        if (!value) {
                                                            delete next[
                                                                importType
                                                            ];
                                                        } else {
                                                            next[importType] =
                                                                value;
                                                        }
                                                        return next;
                                                    });
                                                }}
                                                onRefreshEntitySetCatalog={async () => {
                                                    setIsRefreshingEntitySetCatalog(
                                                        true
                                                    );
                                                    try {
                                                        const refreshed =
                                                            await refreshBillingConnectorEntitySetCatalog(
                                                                accountId
                                                            );
                                                        setEntitySetCatalog(
                                                            refreshed.entity_set_catalog
                                                        );
                                                        void queryClient.invalidateQueries(
                                                            {
                                                                queryKey: [
                                                                    "billing-connector",
                                                                    accountId,
                                                                ],
                                                            }
                                                        );
                                                        success(
                                                            "Priority tables refreshed"
                                                        );
                                                    } catch (err) {
                                                        showError(
                                                            axiosErrorMessage(
                                                                err
                                                            ) ??
                                                                "Failed to refresh Priority tables"
                                                        );
                                                    } finally {
                                                        setIsRefreshingEntitySetCatalog(
                                                            false
                                                        );
                                                    }
                                                }}
                                                isRefreshingEntitySetCatalog={
                                                    isRefreshingEntitySetCatalog
                                                }
                                                onCompletenessChange={
                                                    handleMappingCompleteness
                                                }
                                            />
                                                ) : (
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            flexDirection:
                                                                "column",
                                                            gap: 2,
                                                        }}
                                                    >
                                                        <Box
                                                            sx={{
                                                                display: "flex",
                                                                alignItems:
                                                                    "center",
                                                                justifyContent:
                                                                    "space-between",
                                                                gap: 2,
                                                                flexWrap:
                                                                    "wrap",
                                                            }}
                                                        >
                                                            <Typography
                                                                variant="body2"
                                                                color="text.secondary"
                                                            >
                                                                {(() => {
                                                                    const pass =
                                                                        config
                                                                            ?.preview_passes?.[
                                                                            entity
                                                                        ];
                                                                    if (
                                                                        pass?.passed
                                                                    ) {
                                                                        const at =
                                                                            pass.completed_at
                                                                                ? ` at ${new Date(pass.completed_at).toLocaleString()}`
                                                                                : "";
                                                                        return `Last preview passed${at}`;
                                                                    }
                                                                    if (pass) {
                                                                        return "Last preview failed — fix mapping/filters and run again";
                                                                    }
                                                                    return "Run preview to sample Priority rows for this entity";
                                                                })()}
                                                            </Typography>
                                                            <Button
                                                                variant="outlined"
                                                                size="small"
                                                                disabled={
                                                                    !canManage ||
                                                                    mappingComplete[
                                                                        entity
                                                                    ] !==
                                                                        true ||
                                                                    entityHasUnsavedEdits(
                                                                        entity
                                                                    ) ||
                                                                    previewMutation.isPending ||
                                                                    syncInProgress
                                                                }
                                                                onClick={() => {
                                                                    setPreviewingEntity(
                                                                        entity
                                                                    );
                                                                    previewMutation.mutate(
                                                                        entity
                                                                    );
                                                                }}
                                                                startIcon={
                                                                    previewMutation.isPending &&
                                                                    previewingEntity ===
                                                                        entity ? (
                                                                        <CircularProgress
                                                                            size={
                                                                                14
                                                                            }
                                                                        />
                                                                    ) : (
                                                                        <SyncIcon />
                                                                    )
                                                                }
                                                            >
                                                                {entityHasUnsavedEdits(
                                                                    entity
                                                                )
                                                                    ? "Save changes first"
                                                                    : "Run preview"}
                                                            </Button>
                                                        </Box>
                                                        {(() => {
                                                            const sample =
                                                                previewSamplesByEntity[
                                                                    entity
                                                                ];
                                                            if (!sample) {
                                                                return (
                                                                    <Typography
                                                                        variant="body2"
                                                                        color="text.secondary"
                                                                    >
                                                                        {config
                                                                            ?.preview_passes?.[
                                                                            entity
                                                                        ]
                                                                            ? "Pass/fail is saved. Run preview again to reload sample rows."
                                                                            : "No sample rows yet for this entity."}
                                                                    </Typography>
                                                                );
                                                            }
                                                            return (
                                                                <ConnectorPreviewSyncResults
                                                                    entity={
                                                                        sample.entity
                                                                    }
                                                                    goNoGo={
                                                                        sample.go_no_go
                                                                    }
                                                                    cutoverSummary={
                                                                        sample.cutover_summary
                                                                    }
                                                                />
                                                            );
                                                        })()}
                                                    </Box>
                                                )}
                                            </>

                                        ) : (
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                            >
                                                Enable this entity to configure
                                                pull filters and field mapping.
                                            </Typography>
                                        )}
                                    </Box>
                                );
                            })}
                        </>
                    )}
                </AccordionDetails>
            </Accordion>

            <Accordion
                disableGutters
                elevation={0}
                expanded={Boolean(expandedSections.schedule)}
                onChange={() => toggleSection("schedule")}
                ref={(el: HTMLDivElement | null) => {
                    sectionRefs.current.schedule = el;
                }}
                sx={{
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 2,
                    "&:before": { display: "none" },
                    // Visible so outlined labels aren't clipped (FilterBuilder cards
                    // also keep overflow visible for labeled Autocompletes).
                    overflow: "visible",
                }}
            >
                {renderSectionSummary("Schedule & cutover")}
                <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 2 }}>
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 2,
                            mb: 2,
                            flexWrap: "wrap",
                            overflow: "visible",
                            "& > *": { margin: 0 },
                        }}
                    >
                        <Box
                            sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.5,
                            }}
                        >
                            <Switch
                                checked={syncEnabled}
                                onChange={(e) =>
                                    setSyncEnabled(e.target.checked)
                                }
                                disabled={!canManage}
                                inputProps={{
                                    "aria-label": "Sync enabled",
                                }}
                            />
                            <Typography component="span" variant="body1">
                                Sync enabled
                            </Typography>
                        </Box>

                        <Autocomplete
                            size="small"
                            options={SCHEDULE_PRESET_OPTIONS}
                            value={
                                SCHEDULE_PRESET_OPTIONS.find(
                                    (opt) => opt.value === schedulePreset
                                ) ?? SCHEDULE_PRESET_OPTIONS[0]
                            }
                            onChange={(_, newValue) => {
                                if (!newValue) return;
                                setSchedulePreset(newValue.value);
                            }}
                            getOptionLabel={(option) => option.label}
                            isOptionEqualToValue={(option, value) =>
                                option.value === value.value
                            }
                            disableClearable
                            disabled={!canManage}
                            sx={{ width: 240 }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Sync schedule"
                                    size="small"
                                    variant="outlined"
                                />
                            )}
                        />

                        {schedulePreset === "custom" && (
                            <TextField
                                size="small"
                                label="Cron expression (UTC)"
                                value={syncCron}
                                onChange={(e) => {
                                    setSyncCron(e.target.value);
                                    setSchedulePreset("custom");
                                }}
                                disabled={!canManage}
                                sx={{
                                    width: 240,
                                    padding: 0,
                                    margin: 0,
                                    "& .MuiFormControl-root": {
                                        padding: 0,
                                        margin: 0,
                                    },
                                }}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <Tooltip
                                                title="Minimum interval: 30 minutes."
                                                arrow
                                                enterDelay={300}
                                                leaveDelay={100}
                                                placement="bottom"
                                                PopperProps={{
                                                    sx: {
                                                        "& .MuiTooltip-tooltip":
                                                            {
                                                                direction:
                                                                    isRTL
                                                                        ? "rtl"
                                                                        : "ltr",
                                                            },
                                                    },
                                                }}
                                            >
                                                <InfoOutlinedIcon
                                                    fontSize="small"
                                                    color="action"
                                                    sx={{
                                                        cursor: "help",
                                                        fontSize: 16,
                                                    }}
                                                />
                                            </Tooltip>
                                        </InputAdornment>
                                    ),
                                }}
                            />
                        )}
                    </Box>

                    {(schedulePreset === "daily" ||
                        schedulePreset === "weekly") && (
                        <TextField
                            fullWidth
                            label="Time (UTC)"
                            type="time"
                            value={dailyTimeUtc}
                            onChange={(e) =>
                                setDailyTimeUtc(e.target.value || "03:00")
                            }
                            disabled={!canManage}
                            InputLabelProps={{ shrink: true }}
                            sx={{ mb: 2, maxWidth: 280 }}
                        />
                    )}

                    {schedulePreset === "weekly" && (
                        <FormControl
                            fullWidth
                            sx={{ mb: 2, maxWidth: 280 }}
                            disabled={!canManage}
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
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            {config.schedule_warning}
                        </Alert>
                    ) : null}

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Cutover
                    </Typography>

                    {config?.backfill_options_locked ? (
                        <Chip
                            size="small"
                            label="Locked — reset backfill on the hero card to edit"
                            variant="outlined"
                            sx={{ mb: 1.5 }}
                        />
                    ) : null}

                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 2,
                            flexWrap: "wrap",
                            mb: 2,
                            overflow: "visible",
                            "& > *": { margin: 0 },
                        }}
                    >
                        <Box
                            sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.5,
                            }}
                        >
                            <DatePicker
                                label="Backfill start date"
                                value={
                                    backfillStartDate
                                        ? moment(
                                              backfillStartDate,
                                              "YYYY-MM-DD",
                                              true
                                          )
                                        : null
                                }
                                onChange={(newValue) => {
                                    setBackfillStartDate(
                                        newValue && newValue.isValid()
                                            ? newValue.format("YYYY-MM-DD")
                                            : ""
                                    );
                                }}
                                format={datePickerFormat}
                                disabled={
                                    !canManage ||
                                    Boolean(config?.backfill_options_locked)
                                }
                                slotProps={{
                                    field: { clearable: true },
                                    textField: {
                                        size: "small",
                                        variant: "outlined",
                                        InputLabelProps: {
                                            shrink: true,
                                        },
                                        sx: {
                                            width: 280,
                                            padding: 0,
                                            margin: 0,
                                            "& .MuiFormControl-root": {
                                                padding: 0,
                                                margin: 0,
                                            },
                                        },
                                    },
                                }}
                            />
                            <Tooltip
                                title={
                                    config?.backfill_options_locked
                                        ? "Locked after backfill started. Reset backfill from the hero overflow menu to change."
                                        : "Optional. Invoices and payments created on/after this account-local day. Leave blank for full history. Customers and contacts always pull full history."
                                }
                                arrow
                                enterDelay={300}
                                leaveDelay={100}
                                placement="bottom"
                                PopperProps={{
                                    sx: {
                                        "& .MuiTooltip-tooltip": {
                                            direction: isRTL ? "rtl" : "ltr",
                                        },
                                    },
                                }}
                            >
                                <InfoOutlinedIcon
                                    fontSize="small"
                                    color="action"
                                    sx={{ cursor: "help", fontSize: 16 }}
                                />
                            </Tooltip>
                        </Box>

                        {Boolean(backfillStartDate.trim()) && (
                            <Box
                                sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                }}
                            >
                                <Switch
                                    checked={includeOlderOpenInvoices}
                                    onChange={(e) =>
                                        setIncludeOlderOpenInvoices(
                                            e.target.checked
                                        )
                                    }
                                    disabled={
                                        !canManage ||
                                        Boolean(
                                            config?.backfill_options_locked
                                        )
                                    }
                                    inputProps={{
                                        "aria-label":
                                            "Include older open invoices",
                                    }}
                                />
                                <Typography
                                    component="span"
                                    variant="body1"
                                    sx={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 0.5,
                                    }}
                                >
                                    Include older open invoices
                                    <Tooltip
                                        title={
                                            config?.backfill_options_locked
                                                ? "Locked after backfill started."
                                                : "When on, also pull unpaid invoices created before the start date and payments linked to those invoices."
                                        }
                                        arrow
                                        enterDelay={300}
                                        leaveDelay={100}
                                        placement="bottom"
                                        PopperProps={{
                                            sx: {
                                                "& .MuiTooltip-tooltip": {
                                                    direction: isRTL
                                                        ? "rtl"
                                                        : "ltr",
                                                },
                                            },
                                        }}
                                    >
                                        <InfoOutlinedIcon
                                            fontSize="small"
                                            color="action"
                                            sx={{
                                                cursor: "help",
                                                fontSize: 16,
                                            }}
                                        />
                                    </Tooltip>
                                </Typography>
                            </Box>
                        )}

                        <Box
                            sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.5,
                            }}
                        >
                            <Switch
                                checked={skipReportingBreachOnBackfill}
                                onChange={(e) =>
                                    setSkipReportingBreachOnBackfill(
                                        e.target.checked
                                    )
                                }
                                disabled={
                                    !canManage ||
                                    Boolean(config?.backfill_options_locked)
                                }
                                inputProps={{
                                    "aria-label":
                                        "Skip reporting breach during backfill",
                                }}
                            />
                            <Typography
                                component="span"
                                variant="body1"
                                sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                }}
                            >
                                Skip reporting breach during backfill
                                <Tooltip
                                    title={
                                        config?.backfill_options_locked
                                            ? "Locked after backfill started."
                                            : "Only affects connector backfill import. Incremental sync and the overnight reporting-breach job still run as usual."
                                    }
                                    arrow
                                    enterDelay={300}
                                    leaveDelay={100}
                                    placement="bottom"
                                    PopperProps={{
                                        sx: {
                                            "& .MuiTooltip-tooltip": {
                                                direction: isRTL
                                                    ? "rtl"
                                                    : "ltr",
                                            },
                                        },
                                    }}
                                >
                                    <InfoOutlinedIcon
                                        fontSize="small"
                                        color="action"
                                        sx={{
                                            cursor: "help",
                                            fontSize: 16,
                                        }}
                                    />
                                </Tooltip>
                            </Typography>
                        </Box>
                    </Box>

                    {config?.backfill_options_locked && (
                        <Alert severity="warning">
                            Cutover options are locked because backfill has
                            started. Use Reset backfill on the hero card to
                            unlock.
                        </Alert>
                    )}
                </AccordionDetails>
            </Accordion>

            <Accordion
                disableGutters
                elevation={0}
                expanded={Boolean(expandedSections.runs)}
                onChange={() => toggleSection("runs")}
                ref={(el: HTMLDivElement | null) => {
                    sectionRefs.current.runs = el;
                }}
                sx={{
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 2,
                    "&:before": { display: "none" },
                    overflow: "hidden",
                }}
            >
                {renderSectionSummary("Recent runs")}
                <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 0 }}>
                    {!config?.has_credentials ? (
                        <Typography variant="body2" color="text.secondary">
                            Connect the provider to see recent sync runs.
                        </Typography>
                    ) : syncRuns.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                            No sync runs yet.
                        </Typography>
                    ) : (
                        <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
                            {syncRuns.slice(0, 8).map((run) => {
                                const ok = run.status === "SUCCESS";
                                const failed =
                                    run.status === "FAILED" ||
                                    run.status === "TIMEOUT";
                                return (
                                    <Box
                                        component="li"
                                        key={run.id}
                                        sx={{
                                            display: "flex",
                                            gap: 1.5,
                                            py: 1.25,
                                            borderBottom: 1,
                                            borderColor: "divider",
                                            "&:last-child": {
                                                borderBottom: 0,
                                            },
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: "50%",
                                                mt: 0.75,
                                                flexShrink: 0,
                                                bgcolor: ok
                                                    ? "success.main"
                                                    : failed
                                                      ? "error.main"
                                                      : "info.main",
                                            }}
                                        />
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    justifyContent:
                                                        "space-between",
                                                    gap: 1,
                                                    flexWrap: "wrap",
                                                }}
                                            >
                                                <Typography
                                                    variant="body2"
                                                    fontWeight={600}
                                                >
                                                    {run.sync_mode} (
                                                    {run.trigger})
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                >
                                                    {new Date(
                                                        run.started_at
                                                    ).toLocaleString()}
                                                    {run.duration_seconds
                                                        ? ` · ${run.duration_seconds}s`
                                                        : ""}
                                                </Typography>
                                            </Box>
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                display="block"
                                            >
                                                {run.cutover_summary ||
                                                    run.error_message ||
                                                    "—"}
                                            </Typography>
                                        </Box>
                                        <Chip
                                            size="small"
                                            label={run.status}
                                            color={
                                                ok
                                                    ? "success"
                                                    : failed
                                                      ? "error"
                                                      : "default"
                                            }
                                            variant="outlined"
                                            sx={{ alignSelf: "flex-start" }}
                                        />
                                    </Box>
                                );
                            })}
                        </Box>
                    )}
                </AccordionDetails>
            </Accordion>

            <Accordion
                disableGutters
                elevation={0}
                expanded={Boolean(expandedSections.advanced)}
                onChange={() => toggleSection("advanced")}
                ref={(el: HTMLDivElement | null) => {
                    sectionRefs.current.advanced = el;
                }}
                sx={{
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 2,
                    "&:before": { display: "none" },
                    overflow: "hidden",
                }}
            >
                {renderSectionSummary(
                    "Advanced tools",
                    <Typography variant="caption" color="text.secondary">
                        Archaser admin only
                    </Typography>
                )}
                <AccordionDetails sx={{ px: 1, pb: 1, pt: 0 }}>
                    <AsOfBackfillCard accountId={accountId} />
                </AccordionDetails>
            </Accordion>

            {isDirty && (
                <Box
                    sx={{
                        position: "sticky",
                        bottom: 0,
                        zIndex: 20,
                        width: "100%",
                        maxWidth: "100%",
                        boxSizing: "border-box",
                        bgcolor: "background.paper",
                        borderTop: 1,
                        borderColor: "divider",
                        boxShadow: 3,
                        px: 3,
                        py: 1.5,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        flexWrap: "wrap",
                        gap: 1.5,
                    }}
                >
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ flex: 1, minWidth: 0 }}
                    >
                        You have unsaved changes to connection, schedule,
                        entities, or pull filters.
                    </Typography>
                    <Button
                        variant="outlined"
                        onClick={handleDiscardChanges}
                        disabled={!canManage || isConfigureSaving}
                    >
                        Discard
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => void handleConfigureSave()}
                        disabled={!canManage || isConfigureSaving}
                        startIcon={
                            isConfigureSaving ? (
                                <CircularProgress size={16} />
                            ) : undefined
                        }
                    >
                        {isConfigureSaving ? "Saving…" : "Save changes"}
                    </Button>
                </Box>
            )}
        </Box>
    );
}

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
