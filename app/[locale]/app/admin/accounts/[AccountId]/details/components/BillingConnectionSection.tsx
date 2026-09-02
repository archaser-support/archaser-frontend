"use client";

import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
    ExpandMore as ExpandMoreIcon,
    Sync as SyncIcon,
} from "@mui/icons-material";
import type { ConnectorAuthType } from "@/types/db";
import { memo } from "react";

import { AUTH_TYPE_OPTIONS } from "./billingIntegrationConstants";
import { getBillingAccordionStyles } from "./billingAccordionStyles";
import {
    accountCardSx,
    accountCardTitleSx,
    accountSectionIconSx,
} from "../accountCardStyles";

export interface BillingConnectionSectionProps {
    canManage: boolean;
    expanded: boolean;
    onExpandedChange: (expanded: boolean) => void;
    connectionAlreadySet: boolean;
    provider: "PRIORITY" | "SAP_BUSINESS_ONE";
    onProviderChange: (value: "PRIORITY" | "SAP_BUSINESS_ONE") => void;
    baseUrl: string;
    onBaseUrlChange: (value: string) => void;
    authType: ConnectorAuthType;
    onAuthTypeChange: (value: ConnectorAuthType) => void;
    apiKeyToken: string;
    onApiKeyTokenChange: (value: string) => void;
    basicUsername: string;
    onBasicUsernameChange: (value: string) => void;
    basicPassword: string;
    onBasicPasswordChange: (value: string) => void;
    oauthClientId: string;
    onOauthClientIdChange: (value: string) => void;
    oauthClientSecret: string;
    onOauthClientSecretChange: (value: string) => void;
    oauthTokenEndpoint: string;
    onOauthTokenEndpointChange: (value: string) => void;
    hasCredentials: boolean;
    testPending: boolean;
    onTestConnection: () => void;
}

const BillingConnectionSection = memo(function BillingConnectionSection({
    canManage,
    expanded,
    onExpandedChange,
    connectionAlreadySet,
    provider,
    onProviderChange,
    baseUrl,
    onBaseUrlChange,
    authType,
    onAuthTypeChange,
    apiKeyToken,
    onApiKeyTokenChange,
    basicUsername,
    onBasicUsernameChange,
    basicPassword,
    onBasicPasswordChange,
    oauthClientId,
    onOauthClientIdChange,
    oauthClientSecret,
    onOauthClientSecretChange,
    oauthTokenEndpoint,
    onOauthTokenEndpointChange,
    hasCredentials,
    testPending,
    onTestConnection,
}: BillingConnectionSectionProps) {
    const theme = useTheme();
    const pillRadiusPx = `${theme.appButton.sizeMedium.borderRadius}px`;
    const {
        accordionSx: billingAccordionSx,
        summarySx: billingAccordionSummarySx,
        detailsSx: billingAccordionDetailsSx,
        contentSx: billingAccordionContentSx,
    } = getBillingAccordionStyles(pillRadiusPx);

    return (
        <Card elevation={0} sx={accountCardSx}>
            <Accordion
                disableGutters
                elevation={0}
                expanded={expanded}
                onChange={(_, next) => onExpandedChange(next)}
                sx={billingAccordionSx}
            >
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={billingAccordionSummarySx(expanded)}
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
                                            onProviderChange(
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
                                <TextField
                                    fullWidth
                                    label="Base URL"
                                    value={baseUrl}
                                    onChange={(e) =>
                                        onBaseUrlChange(e.target.value)
                                    }
                                    disabled={
                                        !canManage || provider !== "PRIORITY"
                                    }
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
                                            onAuthTypeChange(
                                                e.target
                                                    .value as ConnectorAuthType
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

                            {authType === "API_KEY" && (
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <TextField
                                        fullWidth
                                        type="password"
                                        label="API Token"
                                        value={apiKeyToken}
                                        onChange={(e) =>
                                            onApiKeyTokenChange(e.target.value)
                                        }
                                        disabled={!canManage}
                                        placeholder={
                                            hasCredentials
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
                                                onBasicUsernameChange(
                                                    e.target.value
                                                )
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
                                                onBasicPasswordChange(
                                                    e.target.value
                                                )
                                            }
                                            disabled={!canManage}
                                            placeholder={
                                                hasCredentials
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
                                                onOauthClientIdChange(
                                                    e.target.value
                                                )
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
                                                onOauthClientSecretChange(
                                                    e.target.value
                                                )
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
                                                onOauthTokenEndpointChange(
                                                    e.target.value
                                                )
                                            }
                                            disabled={!canManage}
                                        />
                                    </Grid>
                                </>
                            )}

                            <Grid size={{ xs: 12 }}>
                                {hasCredentials && (
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ mb: 2 }}
                                    >
                                        Credentials are stored encrypted. Values
                                        are never shown after save.
                                    </Typography>
                                )}

                                <Box
                                    sx={{
                                        display: "flex",
                                        gap: 1,
                                        flexWrap: "wrap",
                                    }}
                                >
                                    <Button
                                        variant="contained"
                                        className="save-button"
                                        startIcon={
                                            testPending ? (
                                                <CircularProgress size={16} />
                                            ) : (
                                                <SyncIcon />
                                            )
                                        }
                                        onClick={onTestConnection}
                                        disabled={!canManage || testPending}
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
    );
});

export default BillingConnectionSection;
