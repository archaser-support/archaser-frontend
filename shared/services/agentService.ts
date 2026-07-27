import { QueryFunction } from "@tanstack/react-query";

import api from "@/app/api";
import { DisputeAgentResponse } from "@/types/CustomerWithAgentDispute";

export const fetchAgents: QueryFunction<DisputeAgentResponse> = async ({
    queryKey,
}) => {
    const [
        ,
        {
            page,
            limit,
            search,
            outcome,
            country,
            businessUnitId,
            sortField,
            sortDirection,
        },
    ] = queryKey as [
        string,
        {
            page: number;
            limit: number;
            search: string;
            outcome: string;
            country: string;
            businessUnitId?: string;
            sortField?: string;
            sortDirection?: string;
        },
    ];
    try {
        const response = await api.get("/system/agents", {
            params: {
                page,
                limit,
                search,
                outcome,
                country,
                businessUnitId,
                sortField: sortField || "last_call",
                sortDirection: sortDirection || "desc",
            },
        });
        return response.data;
    } catch (error) {
        throw new Error("Failed to fetch data");
    }
};

export const fetchAgentsWithFollowUpCall: QueryFunction<
    DisputeAgentResponse
> = async ({ queryKey }) => {
    const [, { page, limit, search, country, businessUnitId, sortField, sortDirection, followUpDateRange }] = queryKey as [
        string,
        {
            page: number;
            limit: number;
            search: string;
            country?: string;
            businessUnitId?: string;
            sortField?: string;
            sortDirection?: string;
            followUpDateRange?: "today" | "this_week" | "next_week" | "this_month" | "all";
        },
    ];
    try {
        const response = await api.get("/system/agents/follow-up", {
            params: {
                page,
                limit,
                search,
                sortField: sortField || "last_call",
                sortDirection: sortDirection || "desc",
                businessUnitId,
                ...(country && { country }),
                ...(followUpDateRange && { followUpDateRange }),
            },
        });
        return response.data;
    } catch (error) {
        throw new Error("Failed to fetch data");
    }
};

export const fetchDisputeWithAgentsStats: QueryFunction<
    DisputeAgentResponse
> = async ({ queryKey }) => {
    const [, params] = queryKey as [string, any];
    try {
        const response = await api.get("/system/agents/stats", {
            params: {
                search: params.search || "",
                outcome: params.outcome || "",
                businessUnitId: params.businessUnitId || "",
                ...(params.country && { country: params.country }),
            },
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching agents stats:", error);
        throw new Error("Failed to fetch data");
    }
};
