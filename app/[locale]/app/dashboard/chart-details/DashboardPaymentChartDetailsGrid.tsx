"use client";
import { apiFetch } from "@/utils/apiFetch";

import { Box } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo } from "react";

import { ViewBasedDataGrid } from "@/shared/components/ViewBasedDataGrid/ViewBasedDataGrid";
import {
    buildDashboardPaymentChartFilters,
    DASHBOARD_PAYMENTS_CONTEXT,
} from "@/shared/dashboard/dashboardPaymentChartFilters";

interface DashboardPaymentChartDetailsGridProps {
    chartType: string;
    period?: string | null;
    searchValue: string;
    onSearchChange: (value: string) => void;
}

/**
 * Report-backed InvoicePayment list for collected-mtd chart-details.
 * Does not pass businessUnitId (card parity: no owner/BU).
 */
export const DashboardPaymentChartDetailsGrid: React.FC<
    DashboardPaymentChartDetailsGridProps
> = ({ chartType, period, searchValue, onSearchChange }) => {
    const filterContract = useMemo(
        () =>
            buildDashboardPaymentChartFilters({
                type: chartType,
                period,
            }),
        [chartType, period]
    );

    const { data: systemReportId } = useQuery({
        queryKey: [
            "dashboard-payments-system-report",
            filterContract.systemReportUniqueName,
        ],
        queryFn: async () => {
            if (!filterContract.systemReportUniqueName) {
                return null;
            }
            const response = await apiFetch(`/api/reports?context=${DASHBOARD_PAYMENTS_CONTEXT}`
            );
            if (!response.ok) {
                return null;
            }
            const data = await response.json();
            const reports = (data.reports || []) as Array<{
                id: number;
                unique_name?: string;
            }>;
            const match = reports.find(
                (r) =>
                    r.unique_name === filterContract.systemReportUniqueName
            );
            return match?.id ?? null;
        },
        enabled: !!filterContract.systemReportUniqueName,
        staleTime: 5 * 60 * 1000,
    });

    return (
        <Box
            sx={{
                position: "relative",
                isolation: "isolate",
            }}
        >
            <ViewBasedDataGrid
                context={DASHBOARD_PAYMENTS_CONTEXT}
                searchValue={searchValue}
                onSearchChange={onSearchChange}
                defaultViewId={systemReportId}
                additionalFilters={filterContract.additionalFilters}
                fillViewport={true}
                exportDisabled={false}
            />
        </Box>
    );
};
