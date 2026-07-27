"use client";

import {
    Language as LanguageIcon,
    Public as CountryIcon,
    LocationOn as StateIcon,
    CurrencyExchange as CurrencyIcon,
    Settings as SettingsIcon,
    Business as BusinessIcon,
} from "@mui/icons-material";
import { Box, Paper, Typography, Chip } from "@mui/material";
import React from "react";

import { AccountDisplayData } from "../types";

interface StatsCardsProps {
    customer: AccountDisplayData;
    selectedCountry?: { id: number; name: string } | null;
    selectedState?: { id: number; name: string } | null;
}

const StatsCards: React.FC<StatsCardsProps> = ({
    customer,
    selectedCountry,
    selectedState,
}) => {
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* Key Account Information */}
            <Paper
                elevation={0}
                sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 2,
                }}
            >
                <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                >
                    Account Information
                </Typography>

                <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}
                >
                    {/* Locale - Wider */}
                    <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                    >
                        <LanguageIcon
                            sx={{ fontSize: 18, color: "primary.main" }}
                        />
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ minWidth: "80px" }}
                        >
                            Locale:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {customer.locale || "N/A"}
                        </Typography>
                    </Box>

                    {/* Country - Wider */}
                    <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                    >
                        <CountryIcon
                            sx={{ fontSize: 18, color: "primary.main" }}
                        />
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ minWidth: "80px" }}
                        >
                            Country:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {selectedCountry?.name || "N/A"}
                        </Typography>
                    </Box>

                    {/* State - Wider */}
                    <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                    >
                        <StateIcon
                            sx={{ fontSize: 18, color: "primary.main" }}
                        />
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ minWidth: "80px" }}
                        >
                            State:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {selectedState?.name || "N/A"}
                        </Typography>
                    </Box>

                    {/* Currency */}
                    <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                    >
                        <CurrencyIcon
                            sx={{ fontSize: 18, color: "primary.main" }}
                        />
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ minWidth: "80px" }}
                        >
                            Currency:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {customer.currency || "N/A"}
                        </Typography>
                    </Box>

                    {/* Balance Evaluation Method */}
                    <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                    >
                        <SettingsIcon
                            sx={{ fontSize: 18, color: "primary.main" }}
                        />
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ minWidth: "80px" }}
                        >
                            Balance Method:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {customer.balance_evaluation_method || "N/A"}
                        </Typography>
                    </Box>

                    {/* Company Number */}
                    <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                    >
                        <BusinessIcon
                            sx={{ fontSize: 18, color: "primary.main" }}
                        />
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ minWidth: "80px" }}
                        >
                            Company #:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {customer.company_number || "N/A"}
                        </Typography>
                    </Box>
                </Box>
            </Paper>

            {/* Status and Key Metrics */}
            <Paper
                elevation={0}
                sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 2,
                }}
            >
                <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                >
                    Status & Metrics
                </Typography>

                <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}
                >
                    {/* Account Status */}
                    <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                    >
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ minWidth: "80px" }}
                        >
                            Status:
                        </Typography>
                        <Chip
                            label={customer.status || "Active"}
                            size="small"
                            data-status={
                                (customer.status?.toLowerCase() || "active") ===
                                "active"
                                    ? "active"
                                    : "inactive"
                            }
                        />
                    </Box>

                    {/* Promise to Pay */}
                    <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                    >
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ minWidth: "80px" }}
                        >
                            Promise to Pay:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {customer.promise_to_pay || 0}
                        </Typography>
                    </Box>

                    {/* Max Promise to Pay */}
                    <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                    >
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ minWidth: "80px" }}
                        >
                            Max Promise:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {customer.max_promise_to_pay_allowed_per_cycle ||
                                "N/A"}
                        </Typography>
                    </Box>

                    {/* Start Days After Due */}
                    <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                    >
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ minWidth: "80px" }}
                        >
                            Start Days:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {customer.default_first_activity_delay_days ||
                                "N/A"}
                        </Typography>
                    </Box>
                </Box>
            </Paper>
        </Box>
    );
};

export default StatsCards;
