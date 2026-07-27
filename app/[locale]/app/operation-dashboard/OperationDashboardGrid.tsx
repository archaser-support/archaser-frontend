"use client";
import { Box, CircularProgress, Typography, Alert } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import { Info as InfoIcon } from "@mui/icons-material";

import { OperationDashboardResponse } from "@/types/OperationDashboard";
import { resolveCustomerFirstCurrency } from "@/utils/stringFormatters";

import AggregateStatsCards from "./(cards)/AggregateStatsCards";
import AgentStatsTable from "./(cards)/AgentStatsTable";
import ActivityTypeChart from "./(cards)/ActivityTypeChart";
import DisputeTrendChart from "./(cards)/DisputeTrendChart";

interface OperationDashboardGridProps {
    data?: OperationDashboardResponse;
    pageLoaded?: boolean;
    startDate?: Date;
    endDate?: Date;
    selectedUserId?: string | null;
}

const OperationDashboardGrid = ({
    data,
    pageLoaded = false,
    startDate,
    endDate,
    selectedUserId,
}: OperationDashboardGridProps) => {
    const { t } = useTranslation(["common", "dashboard"]);
    const currency = resolveCustomerFirstCurrency({
        fallbackCurrency: data?.currency,
    });

    // If data is not available yet, show loading state
    if (!data) {
        return (
            <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                minHeight="400px"
            >
                <CircularProgress />
            </Box>
        );
    }

    return (
        <>
            {/* KPI Cards Row */}
            <Box
                sx={{
                    mb: 3,
                }}
            >
                <AggregateStatsCards
                    data={data}
                    currency={currency}
                    startDate={startDate}
                    endDate={endDate}
                    selectedUserId={selectedUserId}
                />
            </Box>

            {/* Charts Row */}
            {pageLoaded && (
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: {
                            xs: "1fr",
                            md: "repeat(2, 1fr)",
                        },
                        gap: 2,
                        mb: 3,
                    }}
                >
                    <Box sx={{ minHeight: "400px" }}>
                        <ActivityTypeChart data={data} />
                    </Box>
                    <Box sx={{ minHeight: "400px" }}>
                        <DisputeTrendChart data={data} />
                    </Box>
                </Box>
            )}

            {/* Agent Stats Table */}
            <Box sx={{ mt: 2 }}>
                <AgentStatsTable data={data} currency={currency} />
            </Box>
        </>
    );
};

export default OperationDashboardGrid;
