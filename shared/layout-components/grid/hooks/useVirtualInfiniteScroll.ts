import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    UseVirtualInfiniteScrollOptions,
    UseVirtualInfiniteScrollReturn,
} from "../types";
import { GRID_CONSTANTS } from "../constants";

/**
 * Virtual Infinite Scroll Hook
 * Manages pagination and data loading for infinite scroll grids
 */
export function useVirtualInfiniteScroll<T>({
    queryKey,
    queryFn,
    pageSize = GRID_CONSTANTS.DEFAULT_PAGE_SIZE,
    staleTime = 1000,
    gcTime = 5000,
}: UseVirtualInfiniteScrollOptions<T>): UseVirtualInfiniteScrollReturn<T> {
    const queryClient = useQueryClient();

    // State
    const [allData, setAllData] = useState<T[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [aggregationTotals, setAggregationTotals] = useState<
        Record<string, number> | undefined
    >(undefined);
    const [formulaWarnings, setFormulaWarnings] = useState<
        | Array<{ formulaId: string; label: string; invalidCount: number }>
        | undefined
    >(undefined);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Refs
    const lastQueryKeyRef = useRef<string>(""); // Tracks query key for data processing
    const queryKeyForResetRef = useRef<string>(""); // Tracks query key for reset detection

    // Create query key with pagination - use stable string comparison
    const queryKeyString = useMemo(() => JSON.stringify(queryKey), [queryKey]);
    const paginatedQueryKey = useMemo(
        () => [...queryKey, { page: currentPage, pageSize }],
        [queryKey, currentPage, pageSize]
    );

    const getStableRowKey = useCallback((item: any, index: number): string => {
        if (item == null || typeof item !== "object") {
            return `primitive:${String(item)}:${index}`;
        }
        if (item.id !== undefined && item.id !== null && item.id !== "") {
            return `id:${String(item.id)}`;
        }
        if (
            item.__rowKey !== undefined &&
            item.__rowKey !== null &&
            item.__rowKey !== ""
        ) {
            return `rowKey:${String(item.__rowKey)}`;
        }
        if (
            item.___rowKey !== undefined &&
            item.___rowKey !== null &&
            item.___rowKey !== ""
        ) {
            return `formattedRowKey:${String(item.___rowKey)}`;
        }
        return `fallback:${JSON.stringify(item)}:${index}`;
    }, []);

    // Detect query key changes and reset page if needed (before data update)
    useEffect(() => {
        const isNewQuery = queryKeyString !== queryKeyForResetRef.current;

        // Only process if query key actually changed
        if (isNewQuery) {
            const isInitialMount = queryKeyForResetRef.current === "";

            // Check if React Query has cached data for the first page of this query
            // If it does and we're recovering from HMR (initial mount), don't clear state
            const firstPageKey = [...queryKey, { page: 1, pageSize }];
            const cachedData = queryClient.getQueryData(firstPageKey);

            // Only reset if:
            // 1. It's a true new query (previous key was not empty) OR
            // 2. It's initial mount but no cached data exists
            const shouldReset = !isInitialMount || !cachedData;

            if (shouldReset) {
                // Query key changed (sort/search/filter) - reset to page 1
                if (currentPage !== 1) {
                    setCurrentPage(1);
                }

                // Only clear data if there's no cached data (true new query or initial mount without cache)
                // If cached data exists on initial mount (HMR recovery), the data update effect will restore it
                if (!cachedData) {
                    setAllData([]);
                    setTotalRecords(0);
                    setAggregationTotals(undefined);
                    setFormulaWarnings(undefined);
                    setHasMore(true);
                }
            }

            queryKeyForResetRef.current = queryKeyString;
            // IMPORTANT: Also reset lastQueryKeyRef to match, so data update effect recognizes it as new
            lastQueryKeyRef.current = ""; // Reset to empty so next data update will be treated as new query
        }
    }, [queryKeyString, queryKey, pageSize, queryClient, currentPage]); // Use stable string comparison instead of object reference

    // Query for current page
    const { data, isLoading, error } = useQuery({
        queryKey: paginatedQueryKey,
        queryFn: () => queryFn(currentPage),
        staleTime,
        gcTime,
        refetchOnWindowFocus: false,
        refetchOnMount: true, // Refetch on mount to ensure fresh data, but React Query will deduplicate concurrent requests
        refetchOnReconnect: false,
    });

    // Handle data updates
    useEffect(() => {
        if (!data) {
            return;
        }

        const paginatedQueryKeyString = JSON.stringify(
            paginatedQueryKey.slice(0, -1)
        ); // Remove page from query key for comparison
        const isNewQuery = paginatedQueryKeyString !== lastQueryKeyRef.current;
        const isExpectedQuery = paginatedQueryKeyString === queryKeyString; // Check if this data matches the current query

        // Only process data if it matches the current query key
        // This prevents processing stale data from old queries
        if (!isExpectedQuery) {
            // This data is from an old query, ignore it
            setIsLoadingMore(false);
            return;
        }

        if (isNewQuery) {
            // New query detected - update data
            // This should be page 1 data (we reset to page 1 when query changes)
            setAllData(data.data);
            setTotalRecords(data.totalRecords);
            if (data.aggregationTotals) {
                setAggregationTotals(data.aggregationTotals);
            } else {
                setAggregationTotals(undefined);
            }
            if (data.formulaWarnings) {
                setFormulaWarnings(data.formulaWarnings);
            } else {
                setFormulaWarnings(undefined);
            }
            setHasMore(data.hasMore);
            lastQueryKeyRef.current = paginatedQueryKeyString;
        } else if (currentPage > 1) {
            // Append data for pagination
            setAllData((prev) => {
                const existingRowKeys = new Set(
                    prev.map((item: any, index: number) =>
                        getStableRowKey(item, index)
                    )
                );
                const newItems = data.data.filter(
                    (item: any, index: number) =>
                        !existingRowKeys.has(
                            getStableRowKey(item, prev.length + index)
                        )
                );
                return [...prev, ...newItems];
            });
            setHasMore(data.hasMore);
        } else if (currentPage === 1) {
            // Always update page 1 data when query key matches (handles data refreshes after invalidation)
            // Check if data actually changed by comparing IDs and key fields
            const dataChanged =
                allData.length !== data.data.length ||
                JSON.stringify(
                    allData.map((item: any) => ({
                        id: item.id,
                        freeze: item.freeze,
                        status: item.status,
                    }))
                ) !==
                    JSON.stringify(
                        data.data.map((item: any) => ({
                            id: item.id,
                            freeze: item.freeze,
                            status: item.status,
                        }))
                    );

            if (allData.length === 0 || dataChanged) {
                setAllData(data.data);
                setTotalRecords(data.totalRecords);
                if (data.aggregationTotals) {
                    setAggregationTotals(data.aggregationTotals);
                } else {
                    setAggregationTotals(undefined);
                }
                if (data.formulaWarnings) {
                    setFormulaWarnings(data.formulaWarnings);
                } else {
                    setFormulaWarnings(undefined);
                }
                setHasMore(data.hasMore);
                lastQueryKeyRef.current = paginatedQueryKeyString;
            }
        }

        setIsLoadingMore(false);
    }, [
        data,
        currentPage,
        paginatedQueryKey,
        queryKeyString,
        allData.length,
        getStableRowKey,
    ]);

    // Load more function
    const loadMore = useCallback(() => {
        if (isLoadingMore || !hasMore || isLoading) {
            return;
        }

        setIsLoadingMore(true);
        setCurrentPage((prev) => prev + 1);
    }, [hasMore, isLoading, isLoadingMore]);

    // Reset function
    const reset = useCallback(() => {
        // Always clear data and reset state when reset is called
        setAllData([]);
        setCurrentPage(1);
        setTotalRecords(0);
        setAggregationTotals(undefined);
        setFormulaWarnings(undefined);
        setHasMore(true);
        setIsLoadingMore(false);
        lastQueryKeyRef.current = "";

        // Invalidate and refetch queries to ensure fresh data
        queryClient.invalidateQueries({
            queryKey: queryKey,
        });

        // Force refetch the first page
        queryClient.refetchQueries({
            queryKey: [...queryKey, { page: 1, pageSize }],
        });
    }, [queryClient, queryKey, pageSize]);

    return {
        data: allData,
        totalRecords,
        aggregationTotals,
        formulaWarnings,
        isLoading,
        isLoadingMore,
        hasMore,
        error,
        loadMore,
        reset,
    };
}
