"use client";
import { apiFetch } from "@/utils/apiFetch";

import { Box } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo } from "react";

import { ViewBasedDataGrid } from "@/shared/components/ViewBasedDataGrid/ViewBasedDataGrid";
import {
    buildDashboardDisputeChartFilters,
    DASHBOARD_DISPUTES_CONTEXT,
} from "@/shared/dashboard/dashboardDisputeChartFilters";

interface OperationDashboardDisputeDetailsGridProps {
    drillType: string;
    startDate?: string | null;
    endDate?: string | null;
    businessUnitId?: number | null;
    selectedUserId?: string | null;
    searchValue: string;
    onSearchChange: (value: string) => void;
}

/**
 * Report-backed Dispute list for operation-dashboard dispute KPI drills.
 */
export const OperationDashboardDisputeDetailsGrid: React.FC<
    OperationDashboardDisputeDetailsGridProps
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
            buildDashboardDisputeChartFilters({
                type: drillType,
                startDate,
                endDate,
            }),
        [drillType, startDate, endDate]
    );

    const { data: systemReportId } = useQuery({
        queryKey: [
            "dashboard-disputes-system-report",
            filterContract.systemReportUniqueName,
        ],
        queryFn: async () => {
            if (!filterContract.systemReportUniqueName) {
                return null;
            }
            const response = await apiFetch(`/api/reports?context=${DASHBOARD_DISPUTES_CONTEXT}`
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
                context={DASHBOARD_DISPUTES_CONTEXT}
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
