"use client";
import { apiFetch } from "@/utils/apiFetch";

import {
    Alert,
    Box,
    FormControl,
    FormControlLabel,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    Switch,
    Typography,
} from "@mui/material";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { AccountDisplayData } from "../types";

interface IntelligentChannelSelectionProps {
    customer: AccountDisplayData;
    onFieldChange: (key: string, value: any) => void;
    validationErrors?: Record<string, string>;
    smsProvidersUpdated?: number; // Add a trigger to re-check SMS providers
    isNewAccount?: boolean;
}

const IntelligentChannelSelection: React.FC<
    IntelligentChannelSelectionProps
> = ({
    customer,
    onFieldChange,
    validationErrors: _validationErrors = {},
    smsProvidersUpdated,
    isNewAccount = false,
}) => {
    const { t, i18n } = useTranslation(["accounts", "common"]);
    const [hasSmsProviders, setHasSmsProviders] = useState<boolean>(false);
    const [loadingSmsProviders, setLoadingSmsProviders] =
        useState<boolean>(true);
    const hasDisabledSmsFallbackRef = useRef<boolean>(false);
    const hasDisabledIntelligentChannelRef = useRef<boolean>(false);

    // Set default values for new accounts
    useEffect(() => {
        if (isNewAccount) {
            onFieldChange("unlisted_country_sms_policy", "block");
            onFieldChange("sms_fallback_enabled", false);
            onFieldChange("intelligent_channel_selection_enabled", false);
        }
    }, [isNewAccount, onFieldChange]);

    // Determine if fields should be editable
    const fieldsEditable = !isNewAccount && hasSmsProviders;

    // Check if customer has SMS provider configurations
    useEffect(() => {
        const checkSmsProviders = async () => {
            if (!customer.id) {
                setLoadingSmsProviders(false);
                return;
            }

            try {
                setLoadingSmsProviders(true);
                const response = await apiFetch(`/api/accounts/${customer.id}/sms-preferences`
                );
                if (response.ok) {
                    const providers = await response.json();
                    const hasProviders = providers && providers.length > 0;
                    setHasSmsProviders(hasProviders);
                } else {
                    setHasSmsProviders(false);
                }
            } catch (_error) {
                setHasSmsProviders(false);
            } finally {
                setLoadingSmsProviders(false);
            }
        };

        checkSmsProviders();
    }, [customer.id, smsProvidersUpdated]); // Add smsProvidersUpdated as dependency

    // Separate effect to handle automatic disabling of SMS fallback and intelligent channel selection
    useEffect(() => {
        // Reset refs when customer data changes (e.g., when switching between edit/view modes)
        if (
            customer.sms_fallback_enabled === true ||
            customer.intelligent_channel_selection_enabled === true
        ) {
            hasDisabledSmsFallbackRef.current = false;
            hasDisabledIntelligentChannelRef.current = false;
        }

        // Auto-disable SMS fallback if no providers
        if (
            !hasSmsProviders &&
            customer.sms_fallback_enabled &&
            !hasDisabledSmsFallbackRef.current
        ) {
            hasDisabledSmsFallbackRef.current = true;
            onFieldChange("sms_fallback_enabled", false);
        }

        // Auto-disable intelligent channel selection if no providers
        if (
            !hasSmsProviders &&
            customer.intelligent_channel_selection_enabled &&
            !hasDisabledIntelligentChannelRef.current
        ) {
            hasDisabledIntelligentChannelRef.current = true;
            onFieldChange("intelligent_channel_selection_enabled", false);
        }
    }, [
        hasSmsProviders,
        customer.sms_fallback_enabled,
        customer.intelligent_channel_selection_enabled,
        onFieldChange,
    ]);

    const handleSmsFallbackChange = (checked: boolean) => {
        if (checked && !hasSmsProviders) {
            // Don't allow enabling SMS fallback if no providers are configured
            return;
        }
        onFieldChange("sms_fallback_enabled", checked);
    };

    const handleIntelligentChannelChange = (checked: boolean) => {
        if (checked && !hasSmsProviders) {
            // Don't allow enabling intelligent channel selection if no providers are configured
            return;
        }
        onFieldChange("intelligent_channel_selection_enabled", checked);
    };

    return (
        <Grid container spacing={3}>
            {/* SMS Provider Validation Message */}
            {!loadingSmsProviders && !hasSmsProviders && (
                <Grid size={{ xs: 12 }}>
                    <Alert
                        severity="warning"
                        sx={(theme) => ({
                            mb: 2,
                            borderRadius: `${theme.appButton.borderRadius}px`,
                            background:
                                "linear-gradient(to right, #fff3e0, #ffe0b2)",
                            border: "1px solid",
                            borderColor: "warning.main",
                            boxShadow: "none",
                            alignItems: "center",
                            "& .MuiAlert-icon": {
                                alignItems: "center",
                                color: "warning.main",
                            },
                            "& .MuiAlert-message": {
                                fontSize: "0.875rem",
                                fontWeight: 500,
                                lineHeight: 1.5,
                                color: "text.primary",
                            },
                        })}
                    >
                        {t("messages.sms_fallback_no_providers_warning", {
                            ns: "accounts",
                        })}
                    </Alert>
                </Grid>
            )}

            <Grid size={{ xs: 12, md: 4 }}>
                <Typography
                    variant="body2"
                    sx={{
                        fontWeight: 500,
                        mb: 1,
                        color: "text.primary",
                    }}
                >
                    {t("sections.intelligent_channel_selection", {
                        ns: "accounts",
                    })}
                </Typography>
                <FormControlLabel
                    control={
                        <Switch
                            checked={
                                customer.intelligent_channel_selection_enabled ||
                                false
                            }
                            onChange={(e) =>
                                handleIntelligentChannelChange(e.target.checked)
                            }
                            disabled={loadingSmsProviders || !fieldsEditable}
                            color="primary"
                            {...(i18n.language === "he" && {
                                "data-rtl": true,
                            })}
                        />
                    }
                    label={
                        <Typography
                            variant="body2"
                            sx={{ color: "text.secondary" }}
                        >
                            {customer.intelligent_channel_selection_enabled
                                ? t("fields.enabled", { ns: "common" })
                                : t("fields.disabled", { ns: "common" })}
                        </Typography>
                    }
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
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
                <Typography
                    variant="body2"
                    sx={{
                        fontWeight: 500,
                        mb: 1,
                        color: "text.primary",
                    }}
                >
                    SMS Fallback
                </Typography>
                <FormControlLabel
                    control={
                        <Switch
                            checked={customer.sms_fallback_enabled !== false}
                            onChange={(e) =>
                                handleSmsFallbackChange(e.target.checked)
                            }
                            disabled={loadingSmsProviders || !fieldsEditable}
                            color="primary"
                            {...(i18n.language === "he" && {
                                "data-rtl": true,
                            })}
                        />
                    }
                    label={
                        <Typography
                            variant="body2"
                            sx={{ color: "text.secondary" }}
                        >
                            {customer.sms_fallback_enabled !== false
                                ? t("fields.enabled", { ns: "common" })
                                : t("fields.disabled", { ns: "common" })}
                        </Typography>
                    }
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
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
                <FormControl
                    fullWidth
                    size="small"
                    variant="outlined"
                    sx={{
                        padding: 0,
                        margin: 0,
                        "& .MuiInputLabel-root": {
                            whiteSpace: "nowrap",
                            overflow: "visible",
                            textOverflow: "clip",
                        },
                        "& .MuiOutlinedInput-root": {
                            display: "flex !important",
                            alignItems: "center !important",
                        },
                        "& .MuiOutlinedInput-input": {
                            paddingTop: "6px !important",
                            paddingBottom: "6px !important",
                        },
                    }}
                >
                    <InputLabel>
                        {t("fields.unlisted_country_sms_policy", {
                            ns: "accounts",
                        })}
                    </InputLabel>
                    <Select
                        value={customer.unlisted_country_sms_policy || "block"}
                        onChange={(e) =>
                            onFieldChange(
                                "unlisted_country_sms_policy",
                                e.target.value
                            )
                        }
                        label={t("fields.unlisted_country_sms_policy", {
                            ns: "accounts",
                        })}
                        variant="outlined"
                        disabled={!fieldsEditable}
                    >
                        <MenuItem value="block">
                            {t(
                                "values.unlisted_country_sms_policy_options_block",
                                { ns: "accounts" }
                            )}
                        </MenuItem>
                        <MenuItem value="allow">
                            {t(
                                "values.unlisted_country_sms_policy_options_allow",
                                { ns: "accounts" }
                            )}
                        </MenuItem>
                        <MenuItem value="warn">
                            {t(
                                "values.unlisted_country_sms_policy_options_warn",
                                { ns: "accounts" }
                            )}
                        </MenuItem>
                    </Select>
                </FormControl>
            </Grid>
        </Grid>
    );
};

export default IntelligentChannelSelection;
