import { useQuery } from "@tanstack/react-query";
import api from "@/app/api";

/**
 * Hook to fetch report metadata (table and field information)
 * This is shared across all view-based components and cached at the app level
 */
export function useViewMetadata() {
    const {
        data: metadata,
        isLoading,
        error,
    } = useQuery({
        queryKey: ["report-metadata"],
        queryFn: async () => {
            try {
                const response = await api.get("/api/reports/metadata");
                return response.data;
            } catch (error: any) {
                // Provide more specific error information
                const errorMessage = error.response?.data?.error
                    || error.message
                    || "Failed to fetch report metadata";
                const errorDetails = {
                    message: errorMessage,
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    url: error.config?.url,
                };
                console.error("[useViewMetadata] Error fetching metadata:", errorDetails);
                throw new Error(errorMessage);
            }
        },
        staleTime: 10 * 60 * 1000, // Cache for 10 minutes
        refetchOnWindowFocus: false,
    });

    return {
        tablesMetadata: metadata?.tables || [],
        isLoading,
        error,
    };
}
