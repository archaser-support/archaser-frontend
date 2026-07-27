import { QueryFunction } from "@tanstack/react-query";

import api from "@/app/api";
import { OperationDashboardResponse } from "@/types/OperationDashboard";

export const fetchOperationDashboardData: QueryFunction<
    OperationDashboardResponse,
    [
        string,
        {
            startDate?: string;
            endDate?: string;
            selectedUserId?: string | null;
            businessUnitId?: number | null;
        },
    ]
> = async ({ queryKey }) => {
    const [, { startDate, endDate, selectedUserId, businessUnitId }] =
        queryKey;

    try {
        const params: Record<string, string> = {};
        if (startDate) {
            params.startDate = startDate;
        }
        if (endDate) {
            params.endDate = endDate;
        }
        if (selectedUserId !== undefined && selectedUserId !== null) {
            params.selectedUserId = selectedUserId;
        }
        if (businessUnitId != null) {
            params.businessUnitId = String(businessUnitId);
        }

        if (typeof window !== "undefined") {
            const urlParams = new URLSearchParams(window.location.search);
            const bypassCache = urlParams.get("bypassCache");
            if (bypassCache === "true" || bypassCache === "1") {
                params.bypassCache = "true";
            }
        }

        const response = await api.get("/system/operation-dashboard", {
            params,
        });
        return response.data;
    } catch (error: any) {
        if (error?.response?.status === 403) {
            throw new Error("business_unit_access_denied");
        }
        console.error("Error fetching operation dashboard data:", error);
        throw new Error(
            error?.response?.data?.error ||
                error?.message ||
                "Failed to fetch operation dashboard data"
        );
    }
};
