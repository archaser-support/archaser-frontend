"use client";
import { apiFetch } from "@/utils/apiFetch";

import { Box } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo } from "react";

import { ViewBasedDataGrid } from "@/shared/components/ViewBasedDataGrid/ViewBasedDataGrid";
import {
    buildDashboardActivityChartFilters,
    DASHBOARD_ACTIVITIES_CONTEXT,
} from "@/shared/dashboard/dashboardActivityChartFilters";

interface OperationDashboardActivityDetailsGridProps {
    drillType: string;
    startDate?: string | null;
    endDate?: string | null;
    businessUnitId?: number | null;
    selectedUserId?: string | null;
    searchValue: string;
    onSearchChange: (value: string) => void;
}

/**
 * Report-backed Activity list for operation-dashboard activity KPI drills.
 * Create/edit opens the builder and returns to the same details drill URL.
 */
export const OperationDashboardActivityDetailsGrid: React.FC<
    OperationDashboardActivityDetailsGridProps
> = ({
    drillType,
    startDate,
    endDate,
    businessUnitId = null,
    selectedUserId = null,
    searchValue,
    onSearchChange,
}) => {
    const filterContract = useMemo(
        () =>
            buildDashboardActivityChartFilters({
                type: drillType,
                startDate,
                endDate,
            }),
        [drillType, startDate, endDate]
    );

    const { data: systemReportId } = useQuery({
        queryKey: [
            "dashboard-activities-system-report",
            filterContract.systemReportUniqueName,
        ],
        queryFn: async () => {
            if (!filterContract.systemReportUniqueName) {
                return null;
            }
            const response = await apiFetch(`/api/reports?context=${DASHBOARD_ACTIVITIES_CONTEXT}`
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
                context={DASHBOARD_ACTIVITIES_CONTEXT}
                searchValue={searchValue}
                onSearchChange={onSearchChange}
                defaultViewId={systemReportId}
                additionalFilters={filterContract.additionalFilters}
                businessUnitId={businessUnitId}
                selectedUserId={selectedUserId}
                fillViewport={true}
                exportDisabled={false}
            />
        </Box>
    );
};
