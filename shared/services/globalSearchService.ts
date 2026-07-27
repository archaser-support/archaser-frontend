import { QueryFunction } from "@tanstack/react-query";

import api from "@/app/api";

export interface GlobalSearchResult {
    id: number;
    type: "customer" | "invoice" | "contact" | "dispute";
    name: string;
    subtitle?: string;
    customerId?: number;
    relevanceScore?: number;
    metadata?: {
        [key: string]: any;
    };
}

export interface GlobalSearchResponse {
    results: GlobalSearchResult[];
    totalCount?: number;
    countsByType?: {
        customer: number;
        invoice: number;
        contact: number;
        dispute: number;
    };
    hasMore?: boolean;
}

export const searchGlobal: QueryFunction<GlobalSearchResponse> = async ({
    queryKey,
    signal,
}) => {
    const [, { query }] = queryKey as [string, { query: string }];

    try {
        if (!query || query.trim().length < 2) {
            return { results: [] };
        }

        const response = await api.get("/search/global", {
            params: {
                q: query.trim(),
            },
            signal, // Support request cancellation
        });

        return response.data;
    } catch (error: any) {
        // Handle request cancellation
        if (error.name === "AbortError" || error.name === "CanceledError") {
            throw error; // Re-throw cancellation errors
        }

        // Handle authentication errors specifically
        if (error.response?.status === 401) {
            throw new Error("Authentication required. Please log in.");
        }

        // Handle network errors
        if (
            error.code === "ECONNABORTED" ||
            error.message?.includes("timeout")
        ) {
            throw new Error("Search request timed out. Please try again.");
        }

        // Return empty results on other errors rather than throwing
        // This allows the UI to gracefully handle errors
        return { results: [] };
    }
};
