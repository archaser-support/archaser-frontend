"use client";

import {
    Dashboard as DashboardIcon,
    Settings as SettingsIcon,
    VerifiedUser as VerifiedIcon,
    People as UsersIcon,
    Report as DisputesIcon,
} from "@mui/icons-material";
import {
    Card,
    CardContent,
    Typography,
    Button,
    Stack,
    Box,
    Chip,
} from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

import { AccountDisplayData } from "../types";

interface AccountSidebarProps {
    customer: AccountDisplayData;
}

const AccountSidebar: React.FC<AccountSidebarProps> = ({ customer }) => {
    const { t } = useTranslation(["accounts", "common"]);

    return (
        <Stack spacing={3}>
            {/* Quick Stats */}
            <Card>
                <CardContent>
                    <Typography
                        variant="h6"
                        gutterBottom
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                    >
                        <DashboardIcon color="primary" />
                        {t("sections.quick_stats", { ns: "accounts" })}
                    </Typography>
                    <Stack spacing={2}>
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <Typography variant="body2" color="text.secondary">
                                {t("fields.promise_to_pay", { ns: "accounts" })}
                            </Typography>
                            <Typography variant="h6" fontWeight="bold">
                                {customer.promise_to_pay || 0}
                            </Typography>
                        </Box>
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <Typography variant="body2" color="text.secondary">
                                {t("fields.currency", { ns: "accounts" })}
                            </Typography>
                            <Typography variant="h6" fontWeight="bold">
                                {customer.currency || "N/A"}
                            </Typography>
                        </Box>
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <Typography variant="body2" color="text.secondary">
                                {t("fields.locale", { ns: "accounts" })}
                            </Typography>
                            <Typography variant="h6" fontWeight="bold">
                                {customer.locale || "N/A"}
                            </Typography>
                        </Box>
                    </Stack>
                </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
                <CardContent>
                    <Typography
                        variant="h6"
                        gutterBottom
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                    >
                        <SettingsIcon color="primary" />
                        {t("sections.quick_actions", { ns: "accounts" })}
                    </Typography>
                    <Stack spacing={2}>
                        <Button
                            variant="outlined"
                            fullWidth
                            startIcon={<UsersIcon />}
                            sx={{ justifyContent: "flex-start", py: 1.5 }}
                        >
                            {t("actions.view_users", { ns: "accounts" })}
                        </Button>
                        <Button
                            variant="outlined"
                            fullWidth
                            startIcon={<DisputesIcon />}
                            sx={{ justifyContent: "flex-start", py: 1.5 }}
                        >
                            {t("actions.view_disputes", { ns: "accounts" })}
                        </Button>
                        <Button
                            variant="outlined"
                            fullWidth
                            startIcon={<DashboardIcon />}
                            sx={{ justifyContent: "flex-start", py: 1.5 }}
                        >
                            {t("actions.view_analytics", { ns: "accounts" })}
                        </Button>
                    </Stack>
                </CardContent>
            </Card>

            {/* Account Status */}
            <Card>
                <CardContent>
                    <Typography
                        variant="h6"
                        gutterBottom
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                    >
                        <VerifiedIcon color="primary" />
                        {t("sections.account_status", { ns: "accounts" })}
                    </Typography>
                    <Stack spacing={2}>
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <Typography variant="body2" color="text.secondary">
                                {t("fields.status", { ns: "common" })}
                            </Typography>
                            <Chip
                                label={customer.status || "Active"}
                                size="small"
                                data-status={(customer.status?.toLowerCase() || "active") === "active" ? "active" : "inactive"}
                            />
                        </Box>
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <Typography variant="body2" color="text.secondary">
                                {t("fields.balance_evaluation_method", { ns: "accounts" })}
                            </Typography>
                            <Typography variant="body2" fontWeight="medium">
                                {customer.balance_evaluation_method ||
                                    "Invoice-Based"}
                            </Typography>
                        </Box>
                    </Stack>
                </CardContent>
            </Card>
        </Stack>
    );
};

export default AccountSidebar;
