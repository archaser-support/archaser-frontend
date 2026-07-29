"use client";

import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Collapse,
    Divider,
    FormControl,
    FormControlLabel,
    FormGroup,
    Grid,
    InputLabel,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    MenuItem,
    Select,
    Switch,
    Tab,
    Tabs,
    TextField,
    Typography,
} from "@mui/material";
import {
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
    Preview as PreviewIcon,
    Psychology as PsychologyIcon,
    Settings as SettingsIcon,
    Sync as SyncIcon,
} from "@mui/icons-material";
import type { ConnectorAuthType, ImportType } from "@/types/db";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
    fetchBillingConnectorConfig,
    fetchBillingConnectorSyncRuns,
    runBillingConnectorBackfill,
    runBillingConnectorIncrementalSync,
    runBillingConnectorPreviewSync,
    saveBillingConnectorConfig,
    testBillingConnectorConnection,
    type PreviewSyncResponse,
    type SyncRunSummary,
} from "@/shared/services/billingConnectorService";
import ConnectorFieldMapper from "@/shared/layout-components/import/ConnectorFieldMapper";
import { normalizeConnectorEnabledEntities } from "@/shared/constants/importEntityFields";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";

import {
    accountCardContentSx,
    accountCardSx,
} from "../accountCardStyles";
import AccountSectionCardHeader from "./AccountSectionCardHeader";

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
    const [advancedExpanded, setAdvancedExpanded] = useState(false);
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
    const [mappingEntityTab, setMappingEntityTab] = useState(0);

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
        setAdvancedExpanded(preset === "custom");
        setEnabledEntities(
            normalizeConnectorEnabledEntities(config.enabled_entities)
        );
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

    const saveMutation = useMutation({
        mutationFn: async () => {
            const credentials = buildCredentials();
            const payload: Parameters<typeof saveBillingConnectorConfig>[1] = {
                provider,
                base_url: baseUrl.trim() || null,
                auth_type: authType,
                sync_enabled: syncEnabled,
                enabled_entities: enabledEntities,
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
            return saveBillingConnectorConfig(accountId, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["billing-connector", accountId],
            });
            success("Billing connector settings saved");
            setApiKeyToken("");
            setBasicPassword("");
            setOauthClientSecret("");
        },
        onError: (err: unknown) => {
            const message =
                axiosErrorMessage(err) ?? "Failed to save billing connector";
            showError(message);
        },
    });

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
            if (result.go_no_go.passed) {
                success("Preview sync passed go/no-go checks");
            } else {
                showError(
                    "Preview sync completed with validation issues â€” review results below"
                );
            }
        },
        onError: (err: unknown) => {
            const message =
                axiosErrorMessage(err) ?? "Preview sync failed";
            showError(message);
        },
    });

    const backfillMutation = useMutation({
        mutationFn: () => runBillingConnectorBackfill(accountId),
        onSuccess: () => {
            success("Backfill sync started");
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

    const { data: syncRuns = [] } = useQuery({
        queryKey: ["billing-connector-sync-runs", accountId],
        queryFn: () => fetchBillingConnectorSyncRuns(accountId),
        enabled: accountId > 0 && Boolean(config?.has_credentials),
        refetchInterval: (query) => {
            const runs = query.state.data as SyncRunSummary[] | undefined;
            const hasRunning = runs?.some((run) => run.status === "RUNNING");
            return hasRunning ? 15000 : false;
        },
    });

    const syncInProgress = syncRuns.some((run) => run.status === "RUNNING");

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

    useEffect(() => {
        setMappingEntityTab((prev) =>
            prev >= entitiesForMapping.length ? 0 : prev
        );
    }, [entitiesForMapping.length]);

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

    if (isLoading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

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
                <AccountSectionCardHeader icon={SyncIcon} title="Connection" />
                <CardContent sx={accountCardContentSx}>
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
                                <Button
                                    variant="contained"
                                    onClick={() => saveMutation.mutate()}
                                    disabled={
                                        !canManage || saveMutation.isPending
                                    }
                                >
                                    {saveMutation.isPending ? "Savingâ€¦" : "Save"}
                                </Button>
                            </Box>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            <Card elevation={0} sx={accountCardSx}>
                <AccountSectionCardHeader
                    icon={SettingsIcon}
                    title="Sync schedule"
                />
                <CardContent sx={accountCardContentSx}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={syncEnabled}
                                onChange={(e) => setSyncEnabled(e.target.checked)}
                                disabled={!canManage}
                            />
                        }
                        label="Sync enabled"
                        sx={{ mb: 2, display: "block" }}
                    />

                    <FormControl
                        fullWidth
                        sx={{ mb: 2 }}
                        disabled={!canManage}
                    >
                        <InputLabel id="billing-schedule-preset-label">
                            Sync schedule
                        </InputLabel>
                        <Select
                            labelId="billing-schedule-preset-label"
                            label="Sync schedule"
                            value={schedulePreset}
                            onChange={(e) => {
                                const value = e.target.value as SchedulePresetValue;
                                setSchedulePreset(value);
                                if (value === "custom") {
                                    setAdvancedExpanded(true);
                                }
                            }}
                        >
                            {SCHEDULE_PRESET_OPTIONS.map((opt) => (
                                <MenuItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {(schedulePreset === "daily" || schedulePreset === "weekly") && (
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
                            sx={{ mb: 2 }}
                        />
                    )}

                    {schedulePreset === "weekly" && (
                        <FormControl
                            fullWidth
                            sx={{ mb: 2 }}
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
                                    <MenuItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    <Button
                        variant="text"
                        onClick={() => setAdvancedExpanded((prev) => !prev)}
                        disabled={!canManage}
                        sx={{ mb: 1, px: 0 }}
                    >
                        {advancedExpanded ? "Hide Advanced" : "Advanced"}
                    </Button>

                    <Collapse in={advancedExpanded}>
                        <TextField
                            fullWidth
                            label="Cron expression (UTC)"
                            value={syncCron}
                            onChange={(e) => {
                                setSyncCron(e.target.value);
                                setSchedulePreset("custom");
                            }}
                            disabled={!canManage}
                            helperText="Minimum interval: 30 minutes. Used when preset is Custom."
                            sx={{ mb: 2 }}
                        />
                    </Collapse>

                    {config?.schedule_warning ? (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            {config.schedule_warning}
                        </Alert>
                    ) : null}

                    {config?.schedule_summary ? (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Schedule: {config.schedule_summary}
                        </Typography>
                    ) : null}

                    {config?.next_scheduled_sync_at_utc ? (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Next scheduled sync (UTC):{" "}
                            {new Date(
                                config.next_scheduled_sync_at_utc
                            ).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC")}
                        </Typography>
                    ) : syncEnabled ? (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Next scheduled sync (UTC): â€”
                        </Typography>
                    ) : null}

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Enabled entities
                    </Typography>
                    <FormGroup row sx={{ flexWrap: "wrap", gap: { xs: 0, sm: 2 } }}>
                        {ENTITY_OPTIONS.map((opt) => (
                            <FormControlLabel
                                key={opt.value}
                                control={
                                    <Switch
                                        checked={enabledEntities.includes(
                                            opt.value
                                        )}
                                        onChange={() => toggleEntity(opt.value)}
                                        disabled={!canManage}
                                    />
                                }
                                label={opt.label}
                            />
                        ))}
                    </FormGroup>
                </CardContent>
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
                            customer_number and erp_contact_id are required for
                            Customer and Contact respectively. Discover fields
                            after saving credentials, then save each entity
                            mapping.
                        </Typography>

                        <Box>
                            {entitiesForMapping.length === 0 ? (
                                <Alert severity="info">
                                    No entities are enabled. Turn on Customers,
                                    Contacts, Invoices, or Payments under Sync
                                    schedule above, then save.
                                </Alert>
                            ) : (
                                <>
                                    <Tabs
                                        value={mappingEntityTab}
                                        onChange={(_, value) =>
                                            setMappingEntityTab(value)
                                        }
                                        variant="scrollable"
                                        scrollButtons="auto"
                                    >
                                        {entitiesForMapping.map((entity) => {
                                            const label =
                                                ENTITY_OPTIONS.find(
                                                    (opt) =>
                                                        opt.value === entity
                                                )?.label ?? entity;
                                            const isComplete =
                                                mappingComplete[entity] === true;
                                            return (
                                                <Tab
                                                    key={entity}
                                                    label={
                                                        <Box
                                                            sx={{
                                                                display: "flex",
                                                                alignItems:
                                                                    "center",
                                                                gap: 1,
                                                            }}
                                                        >
                                                            {label}
                                                            <Chip
                                                                size="small"
                                                                label={
                                                                    isComplete
                                                                        ? "Complete"
                                                                        : "Incomplete"
                                                                }
                                                                color={
                                                                    isComplete
                                                                        ? "success"
                                                                        : "warning"
                                                                }
                                                                variant="outlined"
                                                            />
                                                        </Box>
                                                    }
                                                />
                                            );
                                        })}
                                    </Tabs>

                                    {entitiesForMapping.map((entity, index) => (
                                        <Box
                                            key={entity}
                                            role="tabpanel"
                                            hidden={mappingEntityTab !== index}
                                            sx={{ pt: 2 }}
                                        >
                                            <ConnectorFieldMapper
                                                accountId={accountId}
                                                importType={entity}
                                                canManage={canManage}
                                                hideEntityHeader
                                                onCompletenessChange={
                                                    handleMappingCompleteness
                                                }
                                            />
                                        </Box>
                                    ))}
                                </>
                            )}
                        </Box>
                    </CardContent>
                </Card>
            )}

            {config?.has_credentials && (
                <Card elevation={0} sx={accountCardSx}>
                    <AccountSectionCardHeader
                        icon={PreviewIcon}
                        title="Preview sync"
                    />
                    <CardContent sx={accountCardContentSx}>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 2 }}
                        >
                            Pulls sample rows from Priority, applies mappings and
                            transforms, validates required fields â€” no database
                            writes and no watermark changes. Run go/no-go checks
                            before starting backfill.
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
                                ? "Running previewâ€¦"
                                : "Run preview sync"}
                        </Button>

                        {!allEnabledMappingsComplete && (
                            <Alert severity="info" sx={{ mb: 2 }}>
                                Complete field mapping for all enabled entities
                                before running preview sync.
                            </Alert>
                        )}

                        {previewResult && (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <Alert
                                    severity={
                                        previewResult.go_no_go.passed
                                            ? "success"
                                            : "warning"
                                    }
                                >
                                    Go/no-go:{" "}
                                    {previewResult.go_no_go.passed
                                        ? "passed"
                                        : "needs attention"}{" "}
                                    ({previewResult.go_no_go.required_field_errors}{" "}
                                    required-field error(s))
                                </Alert>

                                <List dense>
                                    {previewResult.go_no_go.checks.map((check) => (
                                        <ListItem key={check.id}>
                                            <ListItemIcon sx={{ minWidth: 36 }}>
                                                {check.passed ? (
                                                    <CheckCircleIcon
                                                        color="success"
                                                        fontSize="small"
                                                    />
                                                ) : (
                                                    <CancelIcon
                                                        color="error"
                                                        fontSize="small"
                                                    />
                                                )}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={check.label}
                                                secondary={check.detail}
                                            />
                                        </ListItem>
                                    ))}
                                </List>

                                {previewResult.entities.map((entity) => (
                                    <Box key={entity.import_type}>
                                        <Typography
                                            variant="subtitle2"
                                            sx={{ mb: 1 }}
                                        >
                                            {entity.import_type} â€” {entity.pulled}{" "}
                                            row(s) pulled,{" "}
                                            {entity.sample_rows.length} sample(s)
                                        </Typography>
                                        {entity.validation_errors.length > 0 && (
                                            <Alert severity="error" sx={{ mb: 1 }}>
                                                {entity.validation_errors.join("; ")}
                                            </Alert>
                                        )}
                                        {entity.sample_rows.map((row, index) => (
                                            <Typography
                                                key={`${entity.import_type}-${index}`}
                                                variant="caption"
                                                component="pre"
                                                sx={{
                                                    display: "block",
                                                    mb: 1,
                                                    whiteSpace: "pre-wrap",
                                                    fontFamily: "monospace",
                                                }}
                                            >
                                                {JSON.stringify(row, null, 2)}
                                            </Typography>
                                        ))}
                                    </Box>
                                ))}
                            </Box>
                        )}
                    </CardContent>
                </Card>
            )}

            {config?.has_credentials && allEnabledMappingsComplete && (
                <Card elevation={0} sx={accountCardSx}>
                    <AccountSectionCardHeader
                        icon={SyncIcon}
                        title="Sync actions"
                    />
                    <CardContent sx={accountCardContentSx}>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 2 }}
                        >
                            Mode: {config.sync_mode}. Start or resume initial
                            backfill, or run an incremental catch-up when
                            backfill is complete.
                        </Typography>

                        {syncInProgress && (
                            <Alert severity="info" sx={{ mb: 2 }}>
                                Sync in progress â€” actions are disabled until the
                                current run finishes.
                            </Alert>
                        )}

                        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
                            <Button
                                variant="contained"
                                startIcon={
                                    backfillMutation.isPending ? (
                                        <CircularProgress size={16} />
                                    ) : (
                                        <SyncIcon />
                                    )
                                }
                                onClick={() => backfillMutation.mutate()}
                                disabled={
                                    !canManage ||
                                    syncInProgress ||
                                    backfillMutation.isPending ||
                                    config.sync_mode === "INCREMENTAL"
                                }
                            >
                                {config.sync_mode === "BACKFILL"
                                    ? "Start / resume backfill"
                                    : "Backfill complete"}
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={
                                    incrementalMutation.isPending ? (
                                        <CircularProgress size={16} />
                                    ) : (
                                        <SyncIcon />
                                    )
                                }
                                onClick={() => incrementalMutation.mutate()}
                                disabled={
                                    !canManage ||
                                    syncInProgress ||
                                    incrementalMutation.isPending ||
                                    config.sync_mode !== "INCREMENTAL"
                                }
                            >
                                Run incremental sync now
                            </Button>
                        </Box>

                        {config.sync_states && config.sync_states.length > 0 && (
                            <List dense>
                                {config.sync_states.map((state) => (
                                    <ListItem key={state.entity_type}>
                                        <ListItemText
                                            primary={state.entity_type}
                                            secondary={`Pulled: ${state.backfill_records_pulled}${
                                                state.backfill_completed
                                                    ? " â€” backfill complete"
                                                    : state.backfill_cursor_present
                                                      ? " â€” in progress"
                                                      : " â€” not started"
                                            }${
                                                state.last_successful_run_at
                                                    ? ` â€” last success ${new Date(state.last_successful_run_at).toLocaleString()}`
                                                    : ""
                                            }`}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        )}
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
                                        primary={`${run.sync_mode} (${run.trigger}) â€” ${run.status}`}
                                        secondary={`${new Date(run.started_at).toLocaleString()}${
                                            run.duration_seconds
                                                ? ` â€” ${run.duration_seconds}s`
                                                : ""
                                        }${
                                            run.error_message
                                                ? ` â€” ${run.error_message}`
                                                : ""
                                        }`}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    </CardContent>
                </Card>
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
