"use client";

import {
    Autocomplete,
    Box,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    FormControlLabel,
    Stack,
    Switch,
    TextField,
    Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/app/api";
import { isAxiosError } from "axios";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import { useToast } from "@/shared/layout-components/toast/ToastProvider";

type NotificationRuleSet = {
    id: number;
    account_id: number;
    product: string;
    trigger_type: string;
    enabled: boolean;
    rules: Array<{
        id: number;
        advance_day_offsets: number[];
        role_defaults: string[];
        user_overrides: Array<{ id: number; user_id: string }>;
    }>;
};

type AccountUser = {
    id: string;
    name: string;
    email: string;
};

const ACTION_WINDOW_TRIGGER = "action_window";

const TRIGGER_LABEL_KEYS: Record<string, string> = {
    overdue_block: "overdue_block",
    capacity_gap: "capacity_gap",
    entry_terms_breach: "terms_breach",
    action_window: "reporting_countdown",
    limit_warnings: "limit_warnings",
};

const TRIGGER_SUBTITLE_KEYS: Record<string, string> = {
    overdue_block: "overdue_block_subtitle",
    capacity_gap: "capacity_gap_customers_over_limit",
    entry_terms_breach: "terms_breach_invoices",
    action_window: "reporting_countdown_subtitle",
    limit_warnings: "limit_warnings_subtitle",
};

function parseOffsetInput(value: string): number | null {
    const parsed = Number.parseInt(value.trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 365) {
        return null;
    }
    return parsed;
}

function normalizeOffsets(values: string[]): number[] {
    const parsed = values
        .map(parseOffsetInput)
        .filter((value): value is number => value !== null);
    return Array.from(new Set(parsed)).sort((a, b) => b - a);
}

export function NotificationRuleSetsSettings({
    accountId,
    canEdit,
}: {
    accountId: number;
    canEdit: boolean;
}) {
    const { t, i18n } = useTranslation([
        "settings",
        "dashboard",
        "security_roles",
        "common",
    ]);
    const { success, error: showError } = useToast();
    const queryClient = useQueryClient();
    const [savingSetId, setSavingSetId] = useState<number | null>(null);

    const queryKey = useMemo(
        () => ["notification-rule-sets", accountId],
        [accountId]
    );

    const { data, isLoading, isError } = useQuery<{ sets: NotificationRuleSet[] }>(
        {
            queryKey,
            queryFn: async () => {
                const response = await api.get(
                    `/api/entities/accounts/${accountId}/notification-rule-sets`,
                    { params: { product: "credit_insurance" } }
                );
                return response.data;
            },
            enabled: accountId > 0,
        }
    );

    const { data: usersData, isLoading: isLoadingUsers } = useQuery<{
        users: AccountUser[];
    }>({
        queryKey: ["notification-rule-set-users", accountId],
        queryFn: async () => {
            const response = await api.get("/api/entities/users", {
                params: {
                    account_id: accountId,
                    page: 1,
                    limit: 1000,
                },
            });
            return response.data;
        },
        enabled: accountId > 0,
    });

    const usersById = useMemo(() => {
        const map = new Map<string, AccountUser>();
        for (const user of usersData?.users || []) {
            map.set(user.id, user);
        }
        return map;
    }, [usersData?.users]);

    const updateMutation = useMutation({
        mutationFn: async (input: {
            setId: number;
            enabled?: boolean;
            advance_day_offsets?: number[];
            user_override_user_ids?: string[];
        }) => {
            const response = await api.put(
                `/api/entities/accounts/${accountId}/notification-rule-sets/${input.setId}`,
                {
                    enabled: input.enabled,
                    advance_day_offsets: input.advance_day_offsets,
                    user_override_user_ids: input.user_override_user_ids,
                }
            );
            return response.data as { sets: NotificationRuleSet[] };
        },
        onSuccess: (result) => {
            queryClient.setQueryData(queryKey, result);
            success(
                t(
                    "credit_insurance.notification_sets_save_success",
                    "Notification set saved"
                )
            );
        },
        onError: (error: unknown) => {
            const message =
                isAxiosError(error) && error.response?.data?.error
                    ? String(error.response.data.error)
                    : t(
                          "credit_insurance.notification_sets_save_failed",
                          "Could not save notification set"
                      );
            showError(message);
        },
        onSettled: () => {
            setSavingSetId(null);
        },
    });

    const saveSet = useCallback(
        (input: {
            setId: number;
            enabled?: boolean;
            advance_day_offsets?: number[];
            user_override_user_ids?: string[];
        }) => {
            if (!canEdit) {
                return;
            }
            setSavingSetId(input.setId);
            updateMutation.mutate(input);
        },
        [canEdit, updateMutation]
    );

    const getTriggerLabel = useCallback(
        (triggerType: string) => {
            const key = TRIGGER_LABEL_KEYS[triggerType];
            if (!key) {
                return triggerType;
            }
            return t(key, { ns: "dashboard", defaultValue: triggerType });
        },
        [t]
    );

    const getTriggerSubtitle = useCallback(
        (triggerType: string) => {
            const key = TRIGGER_SUBTITLE_KEYS[triggerType];
            if (!key) {
                return null;
            }
            if (triggerType === "capacity_gap") {
                return t(key, {
                    ns: "dashboard",
                    count: 0,
                    defaultValue: "",
                });
            }
            if (triggerType === "entry_terms_breach") {
                return t(key, {
                    ns: "dashboard",
                    count: 0,
                    defaultValue: "",
                });
            }
            if (triggerType === "action_window") {
                return t(key, {
                    ns: "dashboard",
                    days: 14,
                    defaultValue: "",
                });
            }
            if (triggerType === "limit_warnings") {
                return t(key, {
                    ns: "dashboard",
                    threshold_pct: 80,
                    score_warn_days: 30,
                    defaultValue: "",
                });
            }
            return t(key, { ns: "dashboard", defaultValue: "" });
        },
        [t]
    );

    const getRoleLabel = useCallback(
        (role: string) =>
            t(`roles.${role}`, {
                ns: "security_roles",
                defaultValue: role.replace(/_/g, " "),
            }),
        [t]
    );

    if (isLoading) {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    py: 6,
                }}
            >
                <CircularProgress />
            </Box>
        );
    }

    if (isError) {
        return (
            <Typography color="error" sx={{ py: 2 }}>
                {t(
                    "credit_insurance.notification_sets_load_failed",
                    "Could not load notification sets"
                )}
            </Typography>
        );
    }

    const sets = data?.sets || [];

    return (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t(
                    "credit_insurance.notification_sets_description",
                    "Configure internal email and in-app alerts for Exposure Guard dashboard cards."
                )}
            </Typography>

            <Stack spacing={2} sx={{ pb: 2 }}>
                {sets.map((set) => {
                    const rule = set.rules[0];
                    const overrideUserIds =
                        rule?.user_overrides.map((item) => item.user_id) || [];
                    const selectedOverrideUsers = overrideUserIds
                        .map((userId) => usersById.get(userId))
                        .filter((user): user is AccountUser => user != null);
                    const isSaving = savingSetId === set.id;

                    return (
                        <NotificationRuleSetCard
                            key={set.id}
                            set={set}
                            rule={rule}
                            canEdit={canEdit}
                            isSaving={isSaving}
                            isLoadingUsers={isLoadingUsers}
                            users={usersData?.users || []}
                            selectedOverrideUsers={selectedOverrideUsers}
                            title={getTriggerLabel(set.trigger_type)}
                            subtitle={getTriggerSubtitle(set.trigger_type)}
                            getRoleLabel={getRoleLabel}
                            onEnabledChange={(enabled) =>
                                saveSet({ setId: set.id, enabled })
                            }
                            onOverridesChange={(userIds) =>
                                saveSet({
                                    setId: set.id,
                                    user_override_user_ids: userIds,
                                })
                            }
                            onOffsetsChange={(offsets) =>
                                saveSet({
                                    setId: set.id,
                                    advance_day_offsets: offsets,
                                })
                            }
                            offsetLabels={{
                                label: t(
                                    "credit_insurance.notification_sets_advance_offsets",
                                    "Advance warning days"
                                ),
                                placeholder: t(
                                    "credit_insurance.notification_sets_advance_offsets_placeholder",
                                    "e.g. 14, 7, 3"
                                ),
                            }}
                            fieldLabels={{
                                enabled: t(
                                    "credit_insurance.notification_sets_enabled",
                                    "Enabled"
                                ),
                                roleDefaults: t(
                                    "credit_insurance.notification_sets_role_defaults",
                                    "Default roles"
                                ),
                                userOverrides: t(
                                    "credit_insurance.notification_sets_user_overrides",
                                    "Additional recipients"
                                ),
                                userOverridesPlaceholder: t(
                                    "credit_insurance.notification_sets_user_overrides_placeholder",
                                    "Select users"
                                ),
                            }}
                            isRtl={i18n.language === "he"}
                        />
                    );
                })}
            </Stack>
        </Box>
    );
}

function NotificationRuleSetCard({
    set,
    rule,
    canEdit,
    isSaving,
    isLoadingUsers,
    users,
    selectedOverrideUsers,
    title,
    subtitle,
    getRoleLabel,
    onEnabledChange,
    onOverridesChange,
    onOffsetsChange,
    offsetLabels,
    fieldLabels,
    isRtl,
}: {
    set: NotificationRuleSet;
    rule: NotificationRuleSet["rules"][0] | undefined;
    canEdit: boolean;
    isSaving: boolean;
    isLoadingUsers: boolean;
    users: AccountUser[];
    selectedOverrideUsers: AccountUser[];
    title: string;
    subtitle: string | null;
    getRoleLabel: (role: string) => string;
    onEnabledChange: (enabled: boolean) => void;
    onOverridesChange: (userIds: string[]) => void;
    onOffsetsChange: (offsets: number[]) => void;
    offsetLabels: { label: string; placeholder: string };
    fieldLabels: {
        enabled: string;
        roleDefaults: string;
        userOverrides: string;
        userOverridesPlaceholder: string;
    };
    isRtl: boolean;
}) {
    const initialOffsets = (rule?.advance_day_offsets || []).map(String);
    const [offsetDraft, setOffsetDraft] = useState<string[]>(initialOffsets);
    const [debouncedOffsetDraft] = useDebounce(offsetDraft, 600);
    const offsetsHydratedRef = React.useRef(false);

    React.useEffect(() => {
        setOffsetDraft((rule?.advance_day_offsets || []).map(String));
        offsetsHydratedRef.current = false;
    }, [rule?.advance_day_offsets]);

    React.useEffect(() => {
        if (!canEdit || set.trigger_type !== ACTION_WINDOW_TRIGGER) {
            return;
        }
        if (!offsetsHydratedRef.current) {
            offsetsHydratedRef.current = true;
            return;
        }
        const normalized = normalizeOffsets(debouncedOffsetDraft);
        const current = rule?.advance_day_offsets || [];
        const changed =
            normalized.length !== current.length ||
            normalized.some((value, index) => value !== current[index]);
        if (changed) {
            onOffsetsChange(normalized);
        }
    }, [
        canEdit,
        debouncedOffsetDraft,
        onOffsetsChange,
        rule?.advance_day_offsets,
        set.trigger_type,
    ]);

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack spacing={2}>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: 2,
                        }}
                    >
                        <Box>
                            <Typography variant="subtitle1" fontWeight={600}>
                                {title}
                            </Typography>
                            {subtitle ? (
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ mt: 0.5 }}
                                >
                                    {subtitle}
                                </Typography>
                            ) : null}
                        </Box>
                        {isSaving ? <CircularProgress size={20} /> : null}
                    </Box>

                    <FormControlLabel
                        control={
                            <Switch
                                checked={set.enabled}
                                onChange={(event) =>
                                    onEnabledChange(event.target.checked)
                                }
                                disabled={!canEdit || isSaving}
                            />
                        }
                        label={fieldLabels.enabled}
                    />

                    <Box>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block", mb: 0.75 }}
                        >
                            {fieldLabels.roleDefaults}
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            {(rule?.role_defaults || []).map((role) => (
                                <Chip
                                    key={role}
                                    size="small"
                                    label={getRoleLabel(role)}
                                />
                            ))}
                        </Stack>
                    </Box>

                    <Autocomplete
                        multiple
                        options={users}
                        value={selectedOverrideUsers}
                        loading={isLoadingUsers}
                        disabled={!canEdit || isSaving}
                        getOptionLabel={(option) =>
                            option.name?.trim()
                                ? `${option.name} (${option.email})`
                                : option.email
                        }
                        isOptionEqualToValue={(option, value) =>
                            option.id === value.id
                        }
                        onChange={(_event, nextValue) => {
                            onOverridesChange(nextValue.map((user) => user.id));
                        }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label={fieldLabels.userOverrides}
                                placeholder={fieldLabels.userOverridesPlaceholder}
                            />
                        )}
                        slotProps={{
                            popper: {
                                placement: isRtl ? "top-end" : "bottom-start",
                            },
                        }}
                    />

                    {set.trigger_type === ACTION_WINDOW_TRIGGER ? (
                        <Autocomplete
                            multiple
                            freeSolo
                            options={[]}
                            value={offsetDraft}
                            disabled={!canEdit || isSaving}
                            onChange={(_event, nextValue) => {
                                setOffsetDraft(
                                    nextValue.map((value) => String(value))
                                );
                            }}
                            renderTags={(value, getTagProps) =>
                                value.map((option, index) => {
                                    const { key, ...tagProps } = getTagProps({
                                        index,
                                    });
                                    const parsed = parseOffsetInput(option);
                                    return (
                                        <Chip
                                            key={key}
                                            label={option}
                                            color={
                                                parsed == null ? "error" : "default"
                                            }
                                            {...tagProps}
                                        />
                                    );
                                })
                            }
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label={offsetLabels.label}
                                    placeholder={offsetLabels.placeholder}
                                    helperText={
                                        canEdit
                                            ? offsetLabels.placeholder
                                            : undefined
                                    }
                                />
                            )}
                        />
                    ) : null}
                </Stack>
            </CardContent>
        </Card>
    );
}
