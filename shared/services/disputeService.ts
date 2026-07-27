import { apiFetch } from "@/utils/apiFetch";
import { QueryFunction } from "@tanstack/react-query";

import { DisputeResponse } from "@/types/CustomerDispute";

export const fetchDisputes: QueryFunction<DisputeResponse> = async ({
    queryKey,
}) => {
    const [, params] = queryKey as [string, any];
    const searchParams = new URLSearchParams();

    if (params.search) searchParams.append("search", params.search);
    if (params.assignee) searchParams.append("assignee", params.assignee);
    if (params.reason) searchParams.append("reason", params.reason);
    if (params.page) searchParams.append("page", params.page.toString());
    if (params.limit) searchParams.append("limit", params.limit.toString());
    if (params.sortField) searchParams.append("sortField", params.sortField);
    if (params.sortDirection)
        searchParams.append("sortDirection", params.sortDirection);

    const response = await apiFetch(`/api/operations/disputes?${searchParams.toString()}`
    );
    if (!response.ok) throw new Error("Failed to fetch disputes");
    return response.json();
};

export const fetchDisputeStats: QueryFunction<any> = async () => {
    const response = await apiFetch(`/api/operations/disputes/stats`);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error("Failed to fetch dispute stats");
    }

    const data = await response.json();
    // Debug logging removed for production
    return data;
};
