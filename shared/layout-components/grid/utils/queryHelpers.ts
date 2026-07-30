import { apiFetch } from "@/utils/apiFetch";

import { GRID_CONSTANTS } from "../constants";

/**
 * Helper function to create queryFn with correct limit (for fetch-based APIs)
 */
export const createQueryFn = (
    endpoint: string,
    params: Record<string, string> = {},
    dataKey: string = "data"
) => {
    return async (page: number = 1) => {
        // Filter out empty parameters to avoid sending empty strings to API
        const filteredParams = Object.fromEntries(
            Object.entries(params).filter(
                ([, value]) =>
                    value !== "" && value !== null && value !== undefined
            )
        );

        // Build URLSearchParams step by step for Safari compatibility
        // Safari doesn't handle object spreading in URLSearchParams constructor well
        const queryParams = new URLSearchParams();
        queryParams.set("page", page.toString());
        queryParams.set("limit", GRID_CONSTANTS.DEFAULT_PAGE_SIZE.toString());

        // Add filtered params one by one
        Object.entries(filteredParams).forEach(([key, value]) => {
            if (value !== "" && value !== null && value !== undefined) {
                queryParams.set(key, value);
            }
        });

        const fullUrl = `${endpoint}?${queryParams.toString()}`;

        const response = await apiFetch(fullUrl, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        return {
            data: data[dataKey] || [],
            totalRecords: data.totalRecords || 0,
            hasMore:
                (data[dataKey]?.length || 0) > 0 &&
                page <
                    Math.ceil(
                        (data.totalRecords || 0) /
                            GRID_CONSTANTS.DEFAULT_PAGE_SIZE
                    ),
        };
    };
};

/**
 * Helper function for API-based calls (using api.get)
 */
export const createApiQueryFn = (
    apiCall: (_params: any) => Promise<any>,
    params: Record<string, any> = {},
    dataKey: string = "data",
    totalKey: string = "totalRecords"
) => {
    return async (page: number = 1) => {
        // Filter out empty parameters to avoid sending empty strings to API
        const filteredParams = Object.fromEntries(
            Object.entries(params).filter(
                ([, value]) =>
                    value !== "" && value !== null && value !== undefined
            )
        );

        const queryParams = {
            page,
            limit: GRID_CONSTANTS.DEFAULT_PAGE_SIZE,
            ...filteredParams,
        };

        const response = await apiCall(queryParams);
        const data = response.data || response;

        return {
            data: data[dataKey] || [],
            totalRecords: data[totalKey] || 0,
            hasMore:
                (data[dataKey]?.length || 0) > 0 &&
                page <
                    Math.ceil(
                        (data[totalKey] || 0) / GRID_CONSTANTS.DEFAULT_PAGE_SIZE
                    ),
        };
    };
};
