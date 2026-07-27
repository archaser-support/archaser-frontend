"use client";
import { apiFetch } from "@/utils/apiFetch";

import { Refresh } from "@mui/icons-material";
import {
    Box,
    CircularProgress,
    FormControlLabel,
    Grid,
    IconButton,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
    DEFAULT_CHART_PALETTE,
    DEFAULT_PRIMARY,
    DEFAULT_SECONDARY,
    resolveAccountColorFields,
} from "@/app/theme";

import { AccountDisplayData } from "../types";

interface PortalSettingsProps {
    customer: AccountDisplayData;
    onFieldChange: (key: string, value: any) => void;
    decodeLogo: (
        logoData?: string | null
    ) => string;
    validationErrors?: Record<string, string>;
}

// Reserved subdomains that cannot be used
const RESERVED_SUBDOMAINS = [
    "www",
    "api",
    "admin",
    "app",
    "mail",
    "ftp",
    "smtp",
    "pop",
    "imap",
    "ns1",
    "ns2",
    "dns",
    "webmail",
    "cpanel",
    "whm",
    "blog",
    "shop",
    "store",
    "support",
    "help",
    "docs",
    "status",
    "cdn",
    "static",
    "assets",
    "images",
    "files",
    "download",
    "upload",
    "test",
    "dev",
    "staging",
    "beta",
    "alpha",
    "demo",
    "example",
    "localhost",
    "127",
    "192",
    "10",
    "172",
    "archaser",
    "ar",
    "ar-chaser",
    "archaser-com",
];

// Subdomain validation function
const validateSubdomain = (subdomain: string): string | null => {
    if (!subdomain) return null; // Allow empty subdomain

    // Check length
    if (subdomain.length < 3) {
        return "too_short";
    }

    if (subdomain.length > 63) {
        return "too_long";
    }

    // Check for invalid characters (only lowercase letters, numbers, and hyphens)
    if (!/^[a-z0-9-]+$/.test(subdomain)) {
        return "invalid_characters";
    }

    // Check for consecutive hyphens
    if (subdomain.includes("--")) {
        return "consecutive_hyphens";
    }

    // Check for leading or trailing hyphens
    if (subdomain.startsWith("-") || subdomain.endsWith("-")) {
        return "leading_trailing_hyphens";
    }

    // Check if it's only numbers
    if (/^\d+$/.test(subdomain)) {
        return "numbers_only";
    }

    // Check for reserved words
    if (RESERVED_SUBDOMAINS.includes(subdomain.toLowerCase())) {
        return "reserved_word";
    }

    return null; // Valid
};

const COLOR_SWATCH_SLOT_PROPS = {
    input: { className: "color-swatch-input" },
    htmlInput: { style: { padding: 0, cursor: "pointer" } },
};

/** Width must match theme colorSwatchWidthPx (56) */
const colorSwatchSx = {
    flexShrink: 0,
    width: 56,
    minWidth: 56,
};

const colorHexFieldSx = {
    width: 160,
    flexShrink: 0,
    "& .MuiInputLabel-root": {
        whiteSpace: "nowrap",
        overflow: "visible",
        textOverflow: "clip",
    },
};

/** Swatch + hex share the same input row (37px); align input bottoms */
const colorPairSx = {
    display: "flex",
    alignItems: "flex-end",
    gap: 1,
    mr: { xs: 2, sm: 3 },
    "& > *": {
        margin: 0,
    },
};

const PortalSettings: React.FC<PortalSettingsProps> = ({
    customer,
    onFieldChange,
    decodeLogo: _decodeLogo,
    validationErrors = {},
}) => {
    const { t, i18n } = useTranslation(["accounts", "common"]);
    const accountColors = resolveAccountColorFields(customer);
    const [subdomainError, setSubdomainError] = useState<string | null>(null);
    const [isUpdatingSubdomain, setIsUpdatingSubdomain] = useState(false);
    const [subdomainUpdateMessage, setSubdomainUpdateMessage] = useState<
        string | null
    >(null);

    // Validate subdomain on change
    const handleSubdomainChange = (value: string) => {
        const error = validateSubdomain(value);
        setSubdomainError(error);
        onFieldChange("sub_domain", value);
    };

    // Handle subdomain update
    const handleUpdateSubdomain = async () => {
        if (!customer.sub_domain || !customer.id) {
            setSubdomainUpdateMessage(
                t("messages.no_subdomain_to_update", { ns: "accounts" })
            );
            return;
        }

        setIsUpdatingSubdomain(true);
        setSubdomainUpdateMessage(null);

        try {
            // Use the regular customer update endpoint
            const response = await apiFetch(`/api/entities/accounts/${customer.id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        sub_domain: customer.sub_domain,
                    }),
                }
            );

            const data = await response.json();

            if (response.ok) {
                setSubdomainUpdateMessage(
                    t("messages.subdomain_update_success", { ns: "accounts" })
                );
            } else {
                setSubdomainUpdateMessage(
                    data.error || t("messages.subdomain_update_error", { ns: "accounts" })
                );
            }
        } catch (_error) {
            setSubdomainUpdateMessage(
                t("messages.subdomain_update_error", { ns: "accounts" })
            );
        } finally {
            setIsUpdatingSubdomain(false);
        }
    };

    // Validate on component mount and when customer changes
    useEffect(() => {
        if (customer.sub_domain) {
            const error = validateSubdomain(customer.sub_domain);
            setSubdomainError(error);
        }
    }, [customer.sub_domain]);

    return (
        <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 2 }}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <Box
                        sx={{
                            display: "flex",
                            gap: 1,
                            alignItems: "center",
                            "& > *": {
                                margin: 0,
                            },
                        }}
                    >
                        <Box sx={{ position: "relative", flex: 1 }}>
                            <TextField
                                fullWidth
                                label={t("fields.sub_domain", { ns: "accounts" })}
                                value={customer.sub_domain || ""}
                                onChange={(e) =>
                                    handleSubdomainChange(e.target.value)
                                }
                                size="small"
                                placeholder="your-domain"
                                required
                                sx={{
                                    padding: 0,
                                    margin: 0,
                                    "& .MuiFormControl-root": {
                                        padding: 0,
                                        margin: 0,
                                    },
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
                                helperText={
                                    validationErrors.sub_domain ||
                                        subdomainError
                                        ? validationErrors.sub_domain ||
                                        t(
                                            `validation.subdomain_${subdomainError}`,
                                            { ns: "accounts" }
                                        )
                                        : ""
                                }
                                error={
                                    !!(
                                        validationErrors.sub_domain ||
                                        subdomainError
                                    )
                                }
                            />
                        </Box>
                        {customer.sub_domain && (
                            <Tooltip
                                title={t(
                                    "tooltips.account_portal_update_subdomain_tooltip",
                                    { ns: "accounts" }
                                )}
                                arrow
                                enterDelay={300}
                                leaveDelay={100}
                                placement="bottom"
                                PopperProps={{
                                    sx: {
                                        "& .MuiTooltip-tooltip": {
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                        },
                                        "& .MuiTooltip-arrow": {
                                            ...(i18n.language === "he" && {
                                                transform: "scaleX(-1)",
                                            }),
                                        },
                                    },
                                }}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        flexShrink: 0,
                                        minHeight: 32,
                                    }}
                                >
                                    <IconButton
                                        onClick={handleUpdateSubdomain}
                                        disabled={
                                            isUpdatingSubdomain ||
                                            !!subdomainError
                                        }
                                        color="primary"
                                        size="small"
                                        sx={{
                                            p: 0.5,
                                            "&:hover": {
                                                backgroundColor: "primary.50",
                                            },
                                        }}
                                    >
                                        {isUpdatingSubdomain ? (
                                            <CircularProgress color="primary" size={20} />
                                        ) : (
                                            <Refresh />
                                        )}
                                    </IconButton>
                                </Box>
                            </Tooltip>
                        )}
                    </Box>
                    {subdomainUpdateMessage && (
                        <Typography
                            variant="caption"
                            color={
                                subdomainUpdateMessage.includes("success")
                                    ? "success.main"
                                    : "error.main"
                            }
                            sx={{ ml: 1 }}
                        >
                            {subdomainUpdateMessage}
                        </Typography>
                    )}
                
                </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
                                    <Box sx={{ flex: 1 }}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={
                                        customer.allow_partial_payment || false
                                    }
                                    onChange={(e) =>
                                        onFieldChange(
                                            "allow_partial_payment",
                                            e.target.checked
                                        )
                                    }
                                    {...(i18n.language === "he" && { "data-rtl": true })}
                                />
                            }
                            label={
                                <Typography
                                    variant="body2"
                                    sx={{ color: "text.primary" }}
                                >
                                    {customer.allow_partial_payment
                                        ? t("fields.allow_partial_payment", { ns: "accounts" })
                                        : t("fields.not_allow_partial_payment", { ns: "accounts" })}
                                </Typography>
                            }
                            sx={{
                                alignItems: "center",
                                "& .MuiFormControlLabel-label": {
                                    fontSize: "0.875rem",
                                    fontWeight: 500,
                                    lineHeight: 1.4,
                                    ml: 1
                                }
                            }}
                        />
                    </Box>
                
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
                                    <Box sx={{ flex: 1 }}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={
                                        customer.portal_verification_enabled !== false // Default to true if undefined/null
                                    }
                                    onChange={(e) =>
                                        onFieldChange(
                                            "portal_verification_enabled",
                                            e.target.checked
                                        )
                                    }
                                    {...(i18n.language === "he" && { "data-rtl": true })}
                                />
                            }
                            label={
                                <Typography
                                    variant="body2"
                                    sx={{ color: "text.primary" }}
                                >
                                    {customer.portal_verification_enabled !== false
                                        ? t("fields.portal_verification_enabled", { ns: "accounts" })
                                        : t("fields.portal_verification_disabled", { ns: "accounts" })}
                                </Typography>
                            }
                            sx={{
                                alignItems: "center",
                                "& .MuiFormControlLabel-label": {
                                    fontSize: "0.875rem",
                                    fontWeight: 500,
                                    lineHeight: 1.4,
                                    ml: 1
                                }
                            }}
                        />
                    </Box>
                
            </Grid>
            <Grid size={{ xs: 12 }}>
                <Box
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "flex-start",
                        rowGap: 2,
                    }}
                >
                    <Box sx={colorPairSx}>
                        <TextField
                            type="color"
                            value={accountColors.primary_color}
                            onChange={(e) =>
                                onFieldChange("primary_color", e.target.value)
                            }
                            size="small"
                            sx={colorSwatchSx}
                            slotProps={COLOR_SWATCH_SLOT_PROPS}
                        />
                        <TextField
                            label={t("fields.primary_color_hex", {
                                ns: "accounts",
                                defaultValue: "Hex",
                            })}
                            size="small"
                            value={accountColors.primary_color}
                            onChange={(e) =>
                                onFieldChange(
                                    "primary_color",
                                    e.target.value.trim() || DEFAULT_PRIMARY
                                )
                            }
                            sx={colorHexFieldSx}
                            InputLabelProps={{ shrink: true }}
                            inputProps={{ maxLength: 7 }}
                            helperText={validationErrors.primary_color}
                            error={!!validationErrors.primary_color}
                        />
                    </Box>
                    <Box sx={colorPairSx}>
                        <TextField
                            type="color"
                            value={accountColors.secondary_color}
                            onChange={(e) =>
                                onFieldChange("secondary_color", e.target.value)
                            }
                            size="small"
                            sx={colorSwatchSx}
                            slotProps={COLOR_SWATCH_SLOT_PROPS}
                        />
                        <TextField
                            label={t("fields.secondary_color_hex", {
                                ns: "accounts",
                                defaultValue: "Hex",
                            })}
                            size="small"
                            value={accountColors.secondary_color}
                            onChange={(e) =>
                                onFieldChange(
                                    "secondary_color",
                                    e.target.value.trim() || DEFAULT_SECONDARY
                                )
                            }
                            sx={colorHexFieldSx}
                            InputLabelProps={{ shrink: true }}
                            inputProps={{ maxLength: 7 }}
                            helperText={validationErrors.secondary_color}
                            error={!!validationErrors.secondary_color}
                        />
                    </Box>
                    <Box sx={{ ...colorPairSx, mr: 0 }}>
                        <TextField
                            type="color"
                            value={accountColors.chart_palette_color}
                            onChange={(e) =>
                                onFieldChange(
                                    "chart_palette_color",
                                    e.target.value
                                )
                            }
                            size="small"
                            sx={colorSwatchSx}
                            slotProps={COLOR_SWATCH_SLOT_PROPS}
                        />
                        <TextField
                            label={t("fields.chart_palette_color_hex", {
                                ns: "accounts",
                                defaultValue: "Chart Palette Hex",
                            })}
                            size="small"
                            value={accountColors.chart_palette_color}
                            onChange={(e) =>
                                onFieldChange(
                                    "chart_palette_color",
                                    e.target.value.trim() ||
                                        DEFAULT_CHART_PALETTE
                                )
                            }
                            sx={colorHexFieldSx}
                            InputLabelProps={{ shrink: true }}
                            inputProps={{ maxLength: 7 }}
                            helperText={validationErrors.chart_palette_color}
                            error={!!validationErrors.chart_palette_color}
                        />
                    </Box>
                </Box>
            </Grid>
        </Grid>
    );
};

export default PortalSettings;
