"use client";

import React, { useState } from "react";
import {
    Box,
    Typography,
    Switch,
    FormControlLabel,
    Checkbox,
    FormGroup,
    Card,
    CardContent,
    Divider,
    Alert,
    Chip,
    alpha,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
    Key as KeyIcon,
    Google as GoogleIcon,
    Window as MicrosoftIcon, // Using Window icon for Microsoft
} from "@mui/icons-material";

interface SSOSettingsProps {
    accountId: number;
    ssoEnabled: boolean;
    ssoProviders: string[];
    onSave: (ssoEnabled: boolean, ssoProviders: string[]) => Promise<void>;
}

const SSO_PROVIDERS = [
    {
        id: "microsoft",
        label: "Microsoft (Azure AD)",
        Icon: MicrosoftIcon
    },
    {
        id: "google",
        label: "Google",
        Icon: GoogleIcon
    },
];

export default function SSOSettings({
    accountId,
    ssoEnabled: initialSsoEnabled,
    ssoProviders: initialSsoProviders,
    onSave,
}: SSOSettingsProps) {
    const theme = useTheme();
    const [ssoEnabled, setSsoEnabled] = useState(initialSsoEnabled);
    const [selectedProviders, setSelectedProviders] = useState<string[]>(
        initialSsoProviders || []
    );
    const [saving, setSaving] = useState(false);

    // Sync state with props when they change (e.g. after data fetch)
    React.useEffect(() => {
        setSsoEnabled(initialSsoEnabled);
    }, [initialSsoEnabled]);

    React.useEffect(() => {
        setSelectedProviders(initialSsoProviders || []);
    }, [initialSsoProviders]);

    const handleSsoEnabledChange = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const newValue = event.target.checked;
        setSsoEnabled(newValue);

        // Auto-save whenever SSO is toggled (both enabling and disabling)
        setSaving(true);
        try {
            await onSave(newValue, selectedProviders);
        } finally {
            setSaving(false);
        }
    };

    const handleProviderChange = async (providerId: string) => {
        const newProviders = selectedProviders.includes(providerId)
            ? selectedProviders.filter((p) => p !== providerId)
            : [...selectedProviders, providerId];

        setSelectedProviders(newProviders);

        // Auto-save when SSO is enabled
        if (ssoEnabled) {
            setSaving(true);
            try {
                await onSave(ssoEnabled, newProviders);
            } finally {
                setSaving(false);
            }
        }
    };

    return (
        <Card
            elevation={0}
            sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: { xs: 1, sm: 2 },
            }}
        >
            <Box
                sx={{
                    p: { xs: 1.5, sm: 2 },
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    bgcolor: "background.paper",
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                }}
            >
                <KeyIcon
                    sx={{
                        color: "primary.main",
                        fontSize: { xs: 18, sm: 20 },
                    }}
                />
                <Typography
                    variant="subtitle1"
                    sx={{
                        fontWeight: 500,
                        fontSize: { xs: "0.875rem", sm: "1rem" },
                    }}
                >
                    SSO Configuration
                </Typography>
            </Box>

            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                {/* SSO Enable/Disable */}
                <FormControlLabel
                    control={
                        <Switch
                            checked={ssoEnabled}
                            onChange={handleSsoEnabledChange}
                            disabled={saving}
                            color="primary"
                        />
                    }
                    label={
                        <Box>
                            <Typography variant="body1" fontWeight={500}>
                                Enable SSO for this account
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Allow users to sign in using Single Sign-On
                            </Typography>
                        </Box>
                    }
                    sx={{ mb: 3, display: 'flex', alignItems: 'flex-start', ml: 0 }}
                />

                <Divider sx={{ mb: 3 }} />

                {/* Provider Selection */}
                {ssoEnabled && (
                    <Box>
                        <Typography
                            variant="subtitle2"
                            color="text.secondary"
                            sx={{ mb: 2, fontWeight: 600 }}
                        >
                            Enabled Providers
                        </Typography>

                        <FormGroup sx={{ gap: 2 }}>
                            {SSO_PROVIDERS.map((provider) => {
                                const isEnabled = selectedProviders.includes(
                                    provider.id
                                );
                                const isConfigured =
                                    (provider.id === "microsoft" &&
                                        process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID) ||
                                    (provider.id === "google" &&
                                        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

                                const IconComponent = provider.Icon;

                                return (
                                    <Box key={provider.id}>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={isEnabled}
                                                    onChange={() =>
                                                        handleProviderChange(
                                                            provider.id
                                                        )
                                                    }
                                                    disabled={!isConfigured || saving}
                                                />
                                            }
                                            label={
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 1.5,
                                                    }}
                                                >
                                                    <IconComponent color={isEnabled ? "primary" : "action"} />
                                                    <Typography variant="body1">
                                                        {provider.label}
                                                    </Typography>
                                                    {!isConfigured && (
                                                        <Chip
                                                            label="Not Configured"
                                                            size="small"
                                                            sx={{
                                                                height: 20,
                                                                fontSize: '0.7rem',
                                                                backgroundColor: alpha(theme.palette.chartPalette.main, 0.4),
                                                                color: "white",
                                                                fontWeight: 500,
                                                                boxShadow: `0 0 10px ${alpha(theme.palette.chartPalette.main, 0.2)}`,
                                                                border: 'none',
                                                                "&:hover": {
                                                                    backgroundColor: alpha(theme.palette.chartPalette.main, 0.4),
                                                                },
                                                            }}
                                                        />
                                                    )}
                                                    {isEnabled && (
                                                        <Chip
                                                            label="Active"
                                                            size="small"
                                                            sx={{
                                                                height: 20,
                                                                fontSize: '0.7rem',
                                                                backgroundColor: theme.palette.chartPalette.main,
                                                                color: "white",
                                                                fontWeight: 500,
                                                                boxShadow: `0 0 10px ${alpha(theme.palette.chartPalette.main, 0.5)}`,
                                                                "&:hover": {
                                                                    backgroundColor: theme.palette.chartPalette.main,
                                                                },
                                                            }}
                                                        />
                                                    )}
                                                </Box>
                                            }
                                        />
                                        {provider.id === "microsoft" &&
                                            !isConfigured && (
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    sx={{ ml: 4, display: "block", mt: 0.5 }}
                                                >
                                                    MICROSOFT_CLIENT_ID missing in env variables
                                                </Typography>
                                            )}
                                        {provider.id === "google" &&
                                            !isConfigured && (
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    sx={{ ml: 4, display: "block", mt: 0.5 }}
                                                >
                                                    GOOGLE_CLIENT_ID missing in env variables
                                                </Typography>
                                            )}
                                    </Box>
                                );
                            })}
                        </FormGroup>

                        {selectedProviders.length === 0 && (
                            <Alert severity="warning" sx={{ mt: 2 }}>
                                No providers selected. Users won't be able to use
                                SSO until at least one provider is enabled.
                            </Alert>
                        )}
                    </Box>
                )}

                {/* Information Alert */}
                <Alert severity="info" sx={{ mt: 3 }} icon={<KeyIcon fontSize="inherit" />}>
                    <Typography variant="body2">
                        <strong>Important:</strong> Users must be pre-provisioned
                        in Archaser before they can sign in via SSO. Automatic user
                        creation is not supported for security reasons.
                    </Typography>
                </Alert>

                {/* Debug Info (only in development) */}
                {process.env.NODE_ENV === "development" && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            Debug Info:
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                            <Typography variant="caption">
                                SSO Enabled: {ssoEnabled ? "Yes" : "No"}
                            </Typography>
                            <Typography variant="caption">
                                Providers: {selectedProviders.join(", ") || "None"}
                            </Typography>
                        </Box>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}
