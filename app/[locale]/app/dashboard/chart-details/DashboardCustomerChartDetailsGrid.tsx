"use client";
import { apiFetch } from "@/utils/apiFetch";

import { Box } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo } from "react";

import { ViewBasedDataGrid } from "@/shared/components/ViewBasedDataGrid/ViewBasedDataGrid";
import {
    buildDashboardCustomerChartFilters,
    DASHBOARD_CUSTOMERS_CONTEXT,
} from "@/shared/dashboard/dashboardCustomerChartFilters";

interface DashboardCustomerChartDetailsGridProps {
    chartType: string;
    period?: string | null;
    viewMode?: string | null;
    businessUnitId?: number | null;
    searchValue: string;
    onSearchChange: (value: string) => void;
}

/**
 * Report-backed customer list for financial dashboard chart-details drills.
 */
export const DashboardCustomerChartDetailsGrid: React.FC<
    DashboardCustomerChartDetailsGridProps
> = ({
    chartType,
    period,
    viewMode,
    businessUnitId = null,
    searchValue,
    onSearchChange,
}) => {
    const filterContract = useMemo(
        () =>
            buildDashboardCustomerChartFilters({
                type: chartType,
                period,
                viewMode,
            }),
        [chartType, period, viewMode]
    );

    const { data: systemReportId } = useQuery({
        queryKey: [
            "dashboard-customers-system-report",
            filterContract.systemReportUniqueName,
        ],
        queryFn: async () => {
            if (!filterContract.systemReportUniqueName) {
                return null;
            }
            const response = await apiFetch(`/api/reports?context=${DASHBOARD_CUSTOMERS_CONTEXT}`
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
                context={DASHBOARD_CUSTOMERS_CONTEXT}
                searchValue={searchValue}
                onSearchChange={onSearchChange}
                defaultViewId={systemReportId}
                additionalFilters={filterContract.additionalFilters}
                businessUnitId={businessUnitId}
                fillViewport={true}
                exportDisabled={false}
            />
        </Box>
    );
};
