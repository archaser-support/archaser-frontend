import { apiFetch } from "@/utils/apiFetch";
import { getUserDateLocale } from "@/utils/datetimeOperations";
import { useVirtualInfiniteScroll } from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import { hasNoAvailableViewsForContext } from "@/shared/components/ViewBasedDataGrid/hasNoAvailableViewsForContext";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export interface UseViewExecutionOptions {
    /** Context name (e.g., "customers", "disputes") */
    context: string;
    /** Search query (debounced) */
    debouncedSearch: string;
    /** Sort field */
    sortField?: string;
    /** Sort direction */
    sortDirection?: "asc" | "desc";
    /** Optional default view ID */
    defaultViewId?: number | null;
    /** Additional filters to apply (e.g., customer_id) */
    additionalFilters?: Array<{
        table: string;
        field: string;
        operator: string;
        value: any;
    }>;
    /**
     * Dashboard business-unit filter (URL picker). Passed to report execute for
     * contexts that support URL BU (e.g. dashboard_invoices).
     */
    businessUnitId?: number | null;
    /**
     * Operation-dashboard agent filter. Passed to report execute for
     * dashboard_activities identity scoping.
     */
    selectedUserId?: string | null;
    /** Optional refresh trigger: increment to force a new fetch (e.g. after modal close) */
    refreshTrigger?: number;
    /** When true, report execute merges Invoice CI violation booleans (for customer unpaid invoices grid). */
    includeInvoiceCreditInsuranceViolationFields?: boolean;
}

export interface UseViewExecutionReturn {
    /** Selected view ID */
    selectedViewId: number | null;
    /** Set selected view ID */
    setSelectedViewId: (viewId: number | null) => void;
    /** Internal setter for programmatic changes (URL, default view, etc.) - doesn't mark as user-initiated */
    setSelectedViewIdInternal?: (viewId: number | null, source: string) => void;
    /** View configuration data */
    viewConfig: any;
    /** View data from API */
    viewData: any;
    /** Transformed rows */
    rows: any[];
    /** Total records count */
    totalRecords: number;
    /** Loading state */
    isLoading: boolean;
    /**
     * True once default-view + reports-list queries have settled and there is
     * still no selectable view (empty context / missing system seed).
     * Callers should show an empty/error state instead of an infinite spinner.
     */
    hasNoAvailableViews: boolean;
    /** Whether more data is available */
    hasMore: boolean;
    /** Error state */
    error: Error | null;
    /** Load more function */
    loadMore: () => void;
    /** Reset function */
    reset: () => void;
    /** Query key version for cache invalidation */
    queryKeyVersion: number;
    /** Increment query key version */
    incrementQueryKeyVersion: () => void;
}

const PAGE_SIZE = 20;

/**
 * Generic hook for view execution that works with any context
 * Handles view selection, default view fetching, and data loading
 */
export function useViewExecution(
    options: UseViewExecutionOptions
): UseViewExecutionReturn {
    const {
        context,
        debouncedSearch,
        sortField,
        sortDirection,
        defaultViewId,
        additionalFilters,
        businessUnitId = null,
        selectedUserId = null,
        refreshTrigger = 0,
        includeInvoiceCreditInsuranceViolationFields = false,
    } = options;
    const { data: session } = useSession();
    const { i18n } = useTranslation();

    const [selectedViewId, setSelectedViewId] = useState<number | null>(
        defaultViewId || null
    );
    const [queryKeyVersion, setQueryKeyVersion] = useState(0);

    // Track if user has explicitly selected a view (to prevent default view from overriding)
    const userSelectedViewIdRef = useRef<number | null>(null);
    // After deleting the selected report, list pages may briefly keep passing the
    // deleted id as defaultViewId. Skip re-applying that stale prop so we can
    // fall back to the context default.
    const skippedPropDefaultViewIdRef = useRef<number | null>(null);

    // Internal setter wrapper
    const setSelectedViewIdWithLogging = useCallback((newId: number | null) => {
        setSelectedViewId(newId);
    }, []);

    // Fetch default view - always fetch to get the latest default, but only use it if no view is selected
    const queryKey = [
        "default-view",
        context,
        session?.user?.account_id,
        session?.user?.id,
    ];

    const { data: defaultViewData, isFetched: isDefaultViewFetched } = useQuery({
        queryKey,
        queryFn: async () => {
            const response = await apiFetch(`/api/reports?default=true&context=${context}`
            );
            if (!response.ok) {
                return null;
            }
            const data = await response.json();
            const defaultView = data.reports?.[0] || null;
            return defaultView;
        },
        enabled: !!session?.user && !!context,
        staleTime: 0, // Always consider stale to ensure fresh data on mount/reload
        refetchOnMount: true, // Always refetch on mount to get latest default
        refetchOnWindowFocus: false, // Don't refetch on window focus to avoid unnecessary requests
    });

    // Track previous default view to detect changes
    const prevDefaultViewIdRef = useRef<number | null>(null);

    // Fetch accessible reports to validate default view
    // Enable this query earlier to avoid race conditions with default view loading
    const { data: accessibleReportsData, isFetched: isReportsListFetched } =
        useQuery<{
            reports: Array<{ id: number }>;
        }>({
            queryKey: [
                "reports-list-for-validation",
                context,
                session?.user?.account_id,
            ],
            queryFn: async () => {
                const params = new URLSearchParams();
                if (context) {
                    params.append("context", context);
                }
                const url = `/api/reports${params.toString() ? `?${params.toString()}` : ""}`;
                const response = await fetch(url);
                if (!response.ok) return { reports: [] };
                return response.json();
            },
            enabled: !!session?.user && !!context,
            staleTime: 30 * 1000,
        });

    const accessibleReportIds = useMemo(() => {
        return new Set(accessibleReportsData?.reports?.map((r: any) => r.id) || []);
    }, [accessibleReportsData]);

    // Internal setter for programmatic changes (URL, default view, etc.) - doesn't mark as user-initiated
    // Defined here so it can be used in the default view effect below
    const setSelectedViewIdInternal = useCallback((newId: number | null, source: string) => {
        // Clearing selection should also clear "user-locked" selection
        // so default view auto-selection can run again.
        if (newId === null) {
            userSelectedViewIdRef.current = null;
            if (source.startsWith("delete-report:")) {
                const deletedId = Number(source.slice("delete-report:".length));
                if (!Number.isNaN(deletedId)) {
                    skippedPropDefaultViewIdRef.current = deletedId;
                }
            }
        }

        // Don't override user selection unless it's the same as what they selected
        if (userSelectedViewIdRef.current !== null &&
            userSelectedViewIdRef.current !== newId &&
            source !== 'user' &&
            newId !== null) {
            return; // Don't override user's explicit selection
        }

        setSelectedViewIdWithLogging(newId);
    }, [setSelectedViewIdWithLogging]);

    // Auto-select default view when it loads (only if no view is currently selected)
    // Also update if default changed and current selection was the old default
    // IMPORTANT: System defaults from getDefaultView should always be accessible,
    // but we still validate against accessible reports list for safety
    useEffect(() => {
        if (defaultViewData) {
            const newDefaultId = defaultViewData.id;
            const oldDefaultId = prevDefaultViewIdRef.current;

            // Locked report (e.g. credit dashboard detail pages) — never auto-select context default.
            // Exception: after deleting the selected report, defaultViewId may still be the
            // deleted id until the parent re-renders — allow fallback to context default.
            if (
                defaultViewId != null &&
                skippedPropDefaultViewIdRef.current !== defaultViewId
            ) {
                prevDefaultViewIdRef.current = newDefaultId;
                return;
            }

            // System defaults returned by getDefaultView are always for the current account
            // and should be accessible. If accessible reports haven't loaded yet, trust the default.
            // Otherwise, validate it's in the accessible list (unless it's a system default)
            const isDefaultViewAccessible =
                accessibleReportIds.size === 0 || // Not loaded yet, trust default
                accessibleReportIds.has(newDefaultId) || // In accessible list
                (defaultViewData as any)?.is_system === true; // System default should always be accessible

            // Only auto-select if default view is accessible
            if (!isDefaultViewAccessible) {
                prevDefaultViewIdRef.current = null;
                return;
            }

            // CRITICAL: Don't override user's explicit selection unless they selected the old default
            // If user has explicitly selected a view that's different from the default, respect it
            if (userSelectedViewIdRef.current !== null &&
                userSelectedViewIdRef.current !== newDefaultId &&
                selectedViewId === userSelectedViewIdRef.current) {
                prevDefaultViewIdRef.current = newDefaultId;
                return; // Don't change selection
            }

            // If no view is selected, auto-select the default
            if (!selectedViewId) {
                setSelectedViewIdInternal(newDefaultId, 'default-view-auto-select');
                prevDefaultViewIdRef.current = newDefaultId;
            }
            // If default changed and current selection was the old default, update to new default
            else if (
                oldDefaultId !== null &&
                selectedViewId === oldDefaultId &&
                newDefaultId !== oldDefaultId
            ) {
                setSelectedViewIdInternal(newDefaultId, 'default-view-update');
                prevDefaultViewIdRef.current = newDefaultId;
            }
            // If user hasn't explicitly selected a view (page reload scenario) and default changed, update to new default
            // This handles the case where page reloads with old default in state but user hasn't made an explicit selection
            else if (
                userSelectedViewIdRef.current === null &&
                selectedViewId !== newDefaultId &&
                oldDefaultId !== null &&
                oldDefaultId !== newDefaultId
            ) {
                setSelectedViewIdInternal(newDefaultId, 'default-view-update-on-reload');
                prevDefaultViewIdRef.current = newDefaultId;
            }
            // Update ref if default view data exists (but don't change selection if user selected something else)
            else if (oldDefaultId !== newDefaultId) {
                prevDefaultViewIdRef.current = newDefaultId;
            }
        } else {
            prevDefaultViewIdRef.current = null;
        }
    }, [defaultViewData, selectedViewId, context, accessibleReportIds, setSelectedViewIdInternal, defaultViewId]);

    // Apply defaultViewId prop (e.g. credit dashboard locks report by unique_name).
    // Must win over context default view and update when the prop resolves async.
    useEffect(() => {
        if (defaultViewId == null) {
            skippedPropDefaultViewIdRef.current = null;
            return;
        }
        // Do not re-apply a report id we just deleted (parent prop can lag one render).
        if (skippedPropDefaultViewIdRef.current === defaultViewId) {
            return;
        }
        skippedPropDefaultViewIdRef.current = null;
        if (
            userSelectedViewIdRef.current != null &&
            userSelectedViewIdRef.current !== defaultViewId
        ) {
            return;
        }
        if (selectedViewId !== defaultViewId) {
            setSelectedViewIdInternal(defaultViewId, "prop-defaultViewId");
        }
    }, [defaultViewId, selectedViewId, setSelectedViewIdInternal]);

    // Fetch view config when a view is selected
    const { data: viewData } = useQuery({
        queryKey: ["view", selectedViewId],
        queryFn: async () => {
            if (!selectedViewId) return null;
            const response = await apiFetch(`/api/reports/${selectedViewId}`);
            if (!response.ok) return null;
            const data = await response.json();
            return data.report;
        },
        enabled: !!selectedViewId,
        // System report seeds update report_config in place; always refetch on mount
        // so column sets stay aligned with execute (same report id, new fields).
        staleTime: 0,
        refetchOnMount: "always",
    });

    const viewConfig = viewData?.report_config as any;

    // Create query key (note: this is a different queryKey for view execution, not the default view query)
    // Include additionalFilters so cache is per-filter (e.g. per customer_id) and we don't show stale data from another context
    const viewExecutionQueryKey = useMemo(
        () => [
            selectedViewId ? "view-execution" : `${context}-virtual`,
            {
                query: debouncedSearch,
                sortField,
                sortDirection,
                version: queryKeyVersion,
                viewId: selectedViewId,
                context,
                refreshTrigger,
                additionalFilters: additionalFilters
                    ? JSON.stringify(additionalFilters)
                    : undefined,
                businessUnitId: businessUnitId ?? undefined,
                selectedUserId: selectedUserId ?? undefined,
                locale: i18n.language,
                includeInvoiceCreditInsuranceViolationFields,
            },
        ],
        [
            debouncedSearch,
            sortField,
            sortDirection,
            queryKeyVersion,
            selectedViewId,
            context,
            refreshTrigger,
            additionalFilters,
            businessUnitId,
            selectedUserId,
            i18n.language,
            includeInvoiceCreditInsuranceViolationFields,
        ]
    );

    // Create view execution query function
    const createViewQueryFn = useCallback(
        (viewId: number) => {
            return async (page: number = 1) => {
                // Combine additional filters with any existing filters
                const filters: any[] = additionalFilters ? [...additionalFilters] : [];

                const requestBody = {
                    page,
                    limit: PAGE_SIZE,
                    search: debouncedSearch,
                    sortField: sortField || "",
                    sortDirection: sortDirection || "asc",
                    filters: filters.length > 0 ? filters : undefined,
                    locale: getUserDateLocale(session),
                    language: session?.user?.language,
                    timezone: session?.user?.timezone,
                    ...(businessUnitId != null
                        ? { businessUnitId }
                        : {}),
                    ...(selectedUserId
                        ? { selectedUserId }
                        : {}),
                    ...(includeInvoiceCreditInsuranceViolationFields
                        ? {
                              includeInvoiceCreditInsuranceViolationFields: true,
                          }
                        : {}),
                };

                const response = await apiFetch(`/api/reports/${viewId}/execute`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(requestBody),
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(
                        errorData.error ||
                        `HTTP error! status: ${response.status}`
                    );
                }

                const data = await response.json();
                const returnedData = data.data || [];
                const total = data.totalRecords || 0;

                return {
                    data: returnedData,
                    totalRecords: total,
                    hasMore:
                        returnedData.length > 0 && page * PAGE_SIZE < total,
                };
            };
        },
        [
            debouncedSearch,
            sortField,
            sortDirection,
            additionalFilters,
            businessUnitId,
            selectedUserId,
            i18n.language,
            includeInvoiceCreditInsuranceViolationFields,
            session,
        ]
    );

    // Query function - always use view query function when view is selected
    const queryFn = useMemo(() => {
        if (selectedViewId) {
            return createViewQueryFn(selectedViewId);
        }
        // If no view selected yet, return empty query function
        return async () => ({
            data: [],
            totalRecords: 0,
            hasMore: false,
        });
    }, [selectedViewId, createViewQueryFn]);

    // Use virtual infinite scroll hook
    const {
        data: rawData,
        totalRecords,
        isLoading,
        hasMore,
        error,
        loadMore,
        reset,
    } = useVirtualInfiniteScroll({
        queryKey: viewExecutionQueryKey,
        queryFn,
    });

    const incrementQueryKeyVersion = useCallback(() => {
        setQueryKeyVersion((prev) => prev + 1);
    }, []);

    // Expose a method to set view ID and mark it as user-initiated
    const setSelectedViewIdUserInitiated = useCallback((newId: number | null) => {
        userSelectedViewIdRef.current = newId;
        setSelectedViewIdWithLogging(newId);
    }, [setSelectedViewIdWithLogging]);

    const hasNoAvailableViews = useMemo(() => {
        if (!session?.user || !context) {
            return false;
        }
        return hasNoAvailableViewsForContext({
            isDefaultViewFetched,
            isReportsListFetched,
            selectedViewId,
            defaultViewId,
            defaultViewData,
            accessibleReportsCount: accessibleReportsData?.reports?.length ?? 0,
        });
    }, [
        session?.user,
        context,
        isDefaultViewFetched,
        isReportsListFetched,
        selectedViewId,
        defaultViewId,
        defaultViewData,
        accessibleReportsData?.reports?.length,
    ]);

    return {
        selectedViewId,
        setSelectedViewId: setSelectedViewIdUserInitiated, // External calls (from handleViewChange) use user-initiated version
        setSelectedViewIdInternal, // Internal setter for programmatic changes
        viewConfig,
        viewData,
        rows: rawData || [],
        totalRecords,
        isLoading,
        hasNoAvailableViews,
        hasMore,
        error,
        loadMore,
        reset,
        queryKeyVersion,
        incrementQueryKeyVersion,
    };
}
