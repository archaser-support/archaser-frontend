"use client";
import { apiFetch } from "@/utils/apiFetch";

import { Box, CircularProgress, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { GridColDef, GridRenderCellParams, GridSortModel } from "@mui/x-data-grid";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import { createCheckboxColumn } from "./CheckboxColumn";

import { useViewDataTransformation } from "@/shared/hooks/useViewDataTransformation";
import { useViewExecution } from "@/shared/hooks/useViewExecution";
import { useViewMetadata } from "@/shared/hooks/useViewMetadata";
import EndlessScrollDataGrid from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import {
    CurrencyColumnsConfig,
    ExportFormat,
} from "@/shared/utility/exportToExcel";
import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";
import { generateViewColumns } from "@/shared/utils/viewColumnGenerator";
import { getViewConfig, ViewContextConfig } from "@/shared/utils/viewConfigs";
import {
    appendDashboardChartDetailsReturnParams,
    isDashboardChartDetailsReportContext,
} from "@/shared/dashboard/dashboardInvoiceBuilderReturn";
import {
    appendOperationDashboardDetailsReturnParams,
    isOperationDashboardDetailsReportContext,
} from "@/shared/dashboard/dashboardOperationBuilderReturn";
import AppUrls from "@/utils/appUrls";

export interface ViewBasedDataGridProps {
    /** Context name (e.g., "customers", "disputes", "invoices") */
    context: string;
    /** Search value */
    searchValue: string;
    /** Search change handler */
    onSearchChange: (value: string) => void;
    /** Custom buttons component */
    customButtons?: React.ReactNode;
    /** Bulk action button component */
    bulkActionButton?: React.ReactNode;
    /** Row click handler */
    onRowClick?: (row: any) => void;
    /** Export handler */
    onExport?: (
        selectedColumns: string[],
        fileName: string,
        format: ExportFormat
    ) => Promise<any[]>;
    /** Export disabled */
    exportDisabled?: boolean;
    /** Optional default view ID */
    defaultViewId?: number | null;
    /** View change handler */
    onViewChange?: (viewId: number | null) => void;
    /** Custom cell renderers per field */
    customCellRenderers?: Record<string, (params: any) => React.ReactNode>;
    /** Override context config */
    contextConfigOverride?: Partial<ViewContextConfig>;
    /** Callback when selected rows change */
    onSelectedRowsChange?: (selectedRows: number[]) => void;
    /** Controlled selected rows (if provided, selection is controlled by parent) */
    selectedRows?: number[];
    /** Callback when rows data changes */
    onRowsChange?: (rows: any[]) => void;
    /** Delete view handler */
    onDeleteView?: (viewId: number) => void | Promise<void>;
    /** Share view handler */
    onShareView?: (viewId: number) => void;
    /** Enable multi-select with mouse and SHIFT key */
    enableMultiSelect?: boolean;
    /** Allow users to add/edit views (default: true) */
    allowAddEditViews?: boolean;
    /** Additional filters to apply (e.g., customer_id) */
    additionalFilters?: Array<{
        table: string;
        field: string;
        operator: string;
        value: any;
    }>;
    /**
     * Dashboard business-unit filter (URL picker). Forwarded to report execute
     * for dashboard_invoices parity with chart-details.
     */
    businessUnitId?: number | null;
    /**
     * Operation-dashboard agent filter. Forwarded to report execute for
     * dashboard_activities identity scoping.
     */
    selectedUserId?: string | null;
    /**
     * Show report selector in toolbar (default: true). Credit dashboard locks
     * the seeded system report to the URL type and passes false.
     */
    reportSelector?: boolean;
    /** Optional function to render actions column */
    actionsColumn?: (params: GridRenderCellParams) => React.ReactNode;
    /** Optional config for actions column */
    actionsColumnConfig?: {
        headerName?: string;
        width?: number;
        flex?: number;
        minWidth?: number;
    };
    /** Whether to fill viewport height (default: true) */
    fillViewport?: boolean;
    /** Bust fillViewport height cache when layout above the grid changes */
    viewportRecalcDependency?: unknown;
    /** Number of visible rows when fillViewport is false (default: undefined) */
    visibleRows?: number;
    /** Increment to force grid refetch (e.g. after contact modal close) */
    refreshTrigger?: number;
    /** When true, invoice report rows include CI violation booleans (customer unpaid invoices + CI account). */
    includeInvoiceCreditInsuranceViolationFields?: boolean;
    /** Extra columns inserted after view columns (e.g. CI violations summary). */
    additionalDataColumns?: GridColDef[];
    /** Credit-only accounts: blank category column and hide automation-stuck icon. */
    hideCollectionCategoryDisplay?: boolean;
}

/**
 * Generic view-based data grid component that works with any context
 * Encapsulates all view selection, execution, transformation, and column generation logic
 */
export const ViewBasedDataGrid: React.FC<ViewBasedDataGridProps> = ({
    context,
    searchValue,
    onSearchChange,
    customButtons,
    bulkActionButton,
    onRowClick,
    onExport,
    exportDisabled = false,
    defaultViewId,
    onViewChange,
    customCellRenderers,
    contextConfigOverride,
    onSelectedRowsChange,
    onRowsChange,
    onDeleteView,
    onShareView,
    enableMultiSelect = false,
    selectedRows: externalSelectedRows,
    additionalFilters,
    businessUnitId = null,
    selectedUserId = null,
    reportSelector = true,
    actionsColumn,
    actionsColumnConfig,
    allowAddEditViews = true,
    fillViewport = true,
    viewportRecalcDependency,
    visibleRows,
    refreshTrigger,
    includeInvoiceCreditInsuranceViolationFields = false,
    additionalDataColumns,
    hideCollectionCategoryDisplay = false,
}) => {
    const { t, i18n } = useTranslation([context, "common", "reports"]);
    const router = useRouter();
    const pathname = usePathname();
    const theme = useTheme();
    const params = useParams();
    const searchParams = useSearchParams();
    const locale = (params?.locale as string) || "en";
    const { data: session } = useSession();
    const queryClient = useQueryClient();
    const { success, error: showError } = useToast();

    // Get context configuration
    const baseConfig = getViewConfig(context);
    if (!baseConfig) {
        throw new Error(`No configuration found for context: ${context}`);
    }
    const config = { ...baseConfig, ...contextConfigOverride };

    // Search state
    const [debouncedSearch] = useDebounce(searchValue, 500);
    const [sortModel, setSortModel] = useState<GridSortModel>([
        config.defaultSort,
    ]);
    const hasUserChangedSort = useRef(false);
    const [internalSelectedRows, setInternalSelectedRows] = useState<number[]>([]);
    const [deleteReportDialog, setDeleteReportDialog] = useState<{
        isOpen: boolean;
        reportId: number | null;
        reportName: string;
        isDeleting: boolean;
    }>({
        isOpen: false,
        reportId: null,
        reportName: "",
        isDeleting: false,
    });

    // Use controlled or internal state for selection
    const selectedRows = externalSelectedRows !== undefined
        ? externalSelectedRows
        : internalSelectedRows;

    // Use ref to store latest selectedRows to avoid stale closures in handleSelectionChange
    const selectedRowsRef = useRef(selectedRows);
    useEffect(() => {
        selectedRowsRef.current = selectedRows;
    }, [selectedRows]);

    // Track previous search to prevent unnecessary resets
    const prevDebouncedSearchRef = useRef(debouncedSearch);

    // Extract sort field and direction
    const sortField = sortModel[0]?.field;
    const sortDirection = sortModel[0]?.sort ?? undefined;

    // Fetch metadata
    const { tablesMetadata } = useViewMetadata();

    // Get reportId from URL params (set after saving a report)
    const reportIdToSelect = useMemo(() => {
        const reportIdFromUrl = searchParams?.get("reportId");
        if (!reportIdFromUrl) return null;
        const parsed = parseInt(reportIdFromUrl, 10);
        return isNaN(parsed) ? null : parsed;
    }, [searchParams]);

    // Determine effective defaultViewId: prioritize URL reportId over prop defaultViewId
    const effectiveDefaultViewId = useMemo(() => {
        return reportIdToSelect ?? defaultViewId;
    }, [reportIdToSelect, defaultViewId]);

    const clearReportSelectionParamsFromUrl = useCallback(() => {
        const params = new URLSearchParams(searchParams?.toString() || "");
        const hadReportParams =
            params.has("reportId") || params.has("viewId");

        if (!hadReportParams) {
            return;
        }

        params.delete("reportId");
        params.delete("viewId");

        const basePath = pathname || "/";
        const nextUrl = params.toString()
            ? `${basePath}?${params.toString()}`
            : basePath;
        router.replace(nextUrl);
    }, [searchParams, pathname, router]);

    useEffect(() => {
        if (!reportIdToSelect || !session?.user?.account_id) return;
        queryClient.invalidateQueries({
            queryKey: ["reports-list", session.user.account_id, context],
        });
    }, [reportIdToSelect, session?.user?.account_id, context, queryClient]);

    // View execution
    const {
        selectedViewId,
        setSelectedViewId,
        setSelectedViewIdInternal,
        viewConfig,
        rows: rawRows,
        totalRecords,
        isLoading,
        hasNoAvailableViews,
        hasMore,
        error,
        loadMore,
        reset,
        incrementQueryKeyVersion,
    } = useViewExecution({
        context,
        debouncedSearch,
        sortField,
        sortDirection,
        defaultViewId: effectiveDefaultViewId,
        additionalFilters,
        businessUnitId,
        selectedUserId,
        refreshTrigger,
        includeInvoiceCreditInsuranceViolationFields,
    });

    // Apply report_config.sorting when the selected report changes (ReportViewer pattern).
    const reportSortModel = useMemo<GridSortModel>(() => {
        const sorting = viewConfig?.sorting;
        if (Array.isArray(sorting) && sorting.length > 0 && sorting[0]?.field) {
            const direction = String(
                sorting[0].direction || "ASC"
            ).toLowerCase();
            return [
                {
                    field: sorting[0].field,
                    sort: direction === "desc" ? "desc" : "asc",
                },
            ];
        }
        return [config.defaultSort];
    }, [viewConfig?.sorting, config.defaultSort]);

    useEffect(() => {
        hasUserChangedSort.current = false;
    }, [selectedViewId]);

    useEffect(() => {
        if (hasUserChangedSort.current) {
            return;
        }
        if (viewConfig == null && selectedViewId != null) {
            return;
        }
        setSortModel(reportSortModel);
    }, [selectedViewId, reportSortModel, viewConfig]);

    const handleSortModelChange = useCallback((model: GridSortModel) => {
        hasUserChangedSort.current = true;
        setSortModel(model);
    }, []);

    useEffect(() => {
        if (!reportIdToSelect || selectedViewId === reportIdToSelect) {
            return;
        }

        let cancelled = false;
        const validateUrlReport = async () => {
            try {
                const response = await apiFetch(`/api/reports/${reportIdToSelect}`);
                if (!response.ok) {
                    if (cancelled) return;
                    clearReportSelectionParamsFromUrl();
                    setSelectedViewIdInternal?.(null, "url-report-missing");
                    await queryClient.invalidateQueries({
                        queryKey: ["default-view", context, session?.user?.account_id, session?.user?.id],
                    });
                    return;
                }

                if (!cancelled) {
                    setSelectedViewIdInternal?.(reportIdToSelect, "url-parameter");
                }
            } catch {
                if (!cancelled) {
                    clearReportSelectionParamsFromUrl();
                    setSelectedViewIdInternal?.(null, "url-report-missing");
                }
            }
        };

        validateUrlReport();
        return () => {
            cancelled = true;
        };
    }, [
        reportIdToSelect,
        selectedViewId,
        setSelectedViewIdInternal,
        clearReportSelectionParamsFromUrl,
        queryClient,
        context,
        session?.user?.account_id,
        session?.user?.id,
    ]);

    // Data transformation
    const { rows: transformedRows } = useViewDataTransformation({
        config,
        rawData: rawRows,
        sortModel,
    });

    // Use transformed rows directly - selection state is managed via props
    const rows = transformedRows;

    // Notify parent of rows change
    // Only notify when we have a valid view selected to avoid race conditions
    // where rows are available but columns haven't been generated yet
    useEffect(() => {
        if (selectedViewId !== null) {
            onRowsChange?.(rows);
        }
    }, [rows, onRowsChange, selectedViewId]);

    // Sync internal selectedViewId with parent component
    // This ensures parent is notified when default view is auto-selected
    const prevSelectedViewIdRef = useRef<number | null>(selectedViewId);
    useEffect(() => {
        if (selectedViewId !== prevSelectedViewIdRef.current) {
            prevSelectedViewIdRef.current = selectedViewId;
            onViewChange?.(selectedViewId);
        }
    }, [selectedViewId, onViewChange]);

    // Sync selectedRows with parent component
    // Use useEffect to avoid calling setState during render
    useEffect(() => {
        onSelectedRowsChange?.(selectedRows);
    }, [selectedRows, onSelectedRowsChange]);

    // Handle view change
    const handleViewChange = useCallback(
        (viewId: number | string | null) => {
            const numericId =
                typeof viewId === "number"
                    ? viewId
                    : viewId
                        ? parseInt(viewId as string, 10)
                        : null;

            setSelectedViewId(numericId);
            incrementQueryKeyVersion();
            reset();
            onViewChange?.(numericId);
        },
        [setSelectedViewId, incrementQueryKeyVersion, reset, onViewChange]
    );

    // Refresh current view with current filters (re-fetch from page 1)
    const handleRefresh = useCallback(() => {
        reset();
    }, [reset]);

    // Reset when search changes
    useEffect(() => {
        const searchChanged =
            prevDebouncedSearchRef.current !== debouncedSearch;

        if (searchChanged) {
            prevDebouncedSearchRef.current = debouncedSearch;
            incrementQueryKeyVersion();
            reset();
        }
    }, [debouncedSearch, incrementQueryKeyVersion, reset]);

    // Fetch user permissions for report actions
    const { data: userPermissionsData } = useQuery<{ permissions: string[] }>({
        queryKey: [
            "user-permissions",
            session?.user?.id,
            session?.user?.role,
            session?.user?.account_id,
        ],
        queryFn: async () => {
            const response = await apiFetch("/api/permissions/me");
            return response.json();
        },
        enabled: !!session?.user,
        staleTime: 2 * 60 * 1000,
    });

    const userPermissions = userPermissionsData?.permissions || [];
    const hasCreateReportPermission = userPermissions.includes("create_report");
    const hasEditReportPermission = userPermissions.includes("edit_report");
    const hasDeleteReportPermission = userPermissions.includes("delete_report");
    const hasCloneReportPermission = userPermissions.includes("create_report");
    const hasShareReportPermission = userPermissions.includes("share_report");

    // Handle delete view
    const handleDeleteView = useCallback(
        async (viewId: number) => {
            try {
                const response = await apiFetch(`/api/reports/${viewId}`);
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(
                        errorData?.error ||
                            t("reports.messages.error_fetching_data", {
                                defaultValue: "Error fetching report data",
                            })
                    );
                }

                const data = await response.json();
                if (data.report?.is_system) {
                    showError(
                        t("reports.messages.cannot_delete_system_report", {
                            defaultValue: "System views cannot be deleted",
                        })
                    );
                    return;
                }

                setDeleteReportDialog({
                    isOpen: true,
                    reportId: viewId,
                    reportName: data.report?.name || "",
                    isDeleting: false,
                });
            } catch (error) {
                showError(
                    error instanceof Error
                        ? error.message
                        : t("reports.messages.delete_report_error", {
                            defaultValue: "Failed to delete view",
                        })
                );
            }
        },
        [onDeleteView, t, showError]
    );

    const handleConfirmDeleteReport = useCallback(async () => {
        if (!deleteReportDialog.reportId || deleteReportDialog.isDeleting) {
            return;
        }

        setDeleteReportDialog((prev) => ({ ...prev, isDeleting: true }));
        try {
            const response = await apiFetch(`/api/reports/${deleteReportDialog.reportId}`,
                { method: "DELETE" }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData?.error ||
                        t("reports.messages.delete_report_error", {
                            defaultValue: "Failed to delete view",
                        })
                );
            }

            if (selectedViewId === deleteReportDialog.reportId) {
                // Clear selection without letting a stale defaultViewId prop re-apply
                // the deleted report; context default will auto-select.
                setSelectedViewIdInternal?.(
                    null,
                    `delete-report:${deleteReportDialog.reportId}`
                );
            }
            clearReportSelectionParamsFromUrl();

            await queryClient.invalidateQueries({
                queryKey: ["reports-list", session?.user?.account_id, context],
            });
            await queryClient.invalidateQueries({
                queryKey: ["default-view", context, session?.user?.account_id, session?.user?.id],
            });
            await queryClient.invalidateQueries({
                queryKey: ["view-execution"],
            });
            await queryClient.invalidateQueries({
                queryKey: ["view", deleteReportDialog.reportId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["reports-list-for-validation", context, session?.user?.account_id],
            });
            await queryClient.invalidateQueries({
                queryKey: ["user-default-report", session?.user?.id, context],
            });

            setDeleteReportDialog({
                isOpen: false,
                reportId: null,
                reportName: "",
                isDeleting: false,
            });

            success(
                t("reports.messages.delete_report_success", {
                    defaultValue: "View deleted successfully",
                })
            );
        } catch (error) {
            setDeleteReportDialog((prev) => ({ ...prev, isDeleting: false }));
            showError(
                error instanceof Error
                    ? error.message
                    : t("reports.messages.delete_report_error", {
                        defaultValue: "Failed to delete view",
                    })
            );
        }
    }, [
        deleteReportDialog.reportId,
        deleteReportDialog.isDeleting,
        selectedViewId,
        setSelectedViewIdInternal,
        clearReportSelectionParamsFromUrl,
        queryClient,
        session?.user?.account_id,
        session?.user?.id,
        context,
        success,
        showError,
        t,
    ]);

    const handleCloseDeleteReportDialog = useCallback(() => {
        if (deleteReportDialog.isDeleting) return;
        setDeleteReportDialog({
            isOpen: false,
            reportId: null,
            reportName: "",
            isDeleting: false,
        });
    }, [deleteReportDialog.isDeleting]);

    // Handle clone view
    const handleCloneView = useCallback(
        (viewId: number) => {
            const queryParams = new URLSearchParams({
                id: viewId.toString(),
                context,
                table: config.tableName,
                clone: "true",
            });
            if (
                isDashboardChartDetailsReportContext(context) &&
                searchParams
            ) {
                appendDashboardChartDetailsReturnParams(
                    queryParams,
                    searchParams
                );
            }
            if (
                isOperationDashboardDetailsReportContext(context) &&
                searchParams
            ) {
                appendOperationDashboardDetailsReturnParams(
                    queryParams,
                    searchParams
                );
            }
            router.push(
                `/${locale}${AppUrls.REPORT_BUILDER}?${queryParams.toString()}`
            );
        },
        [router, locale, context, config.tableName, searchParams]
    );

    // Check if selected report is user's default
    const { data: userDefaultReport } = useQuery({
        queryKey: ["user-default-report", session?.user?.id, context],
        queryFn: async () => {
            if (!session?.user?.id) return null;
            const response = await apiFetch(`/api/reports/user-default?context=${context}`
            );
            if (!response.ok) return null;
            const data = await response.json();
            return data.report;
        },
        enabled: !!session?.user?.id && !!context,
        staleTime: 0, // Always consider stale to ensure fresh data on mount
        refetchOnMount: true, // Always refetch on mount to get latest default
    });

    const isUserDefault = useMemo(() => {
        if (!selectedViewId || !userDefaultReport) return false;
        return userDefaultReport.id === selectedViewId;
    }, [selectedViewId, userDefaultReport]);

    // Handle set as default
    const handleSetAsDefault = useCallback(
        async (reportId: number) => {
            try {
                const response = await apiFetch(`/api/reports/user-default?context=${context}`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ reportId }),
                    }
                );

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(
                        errorData.error ||
                        errorData.details ||
                        "Failed to set report as default"
                    );
                }

                // Invalidate queries to refresh the UI
                await queryClient.invalidateQueries({
                    queryKey: [
                        "user-default-report",
                        session?.user?.id,
                        context,
                    ],
                });
                // Also invalidate with predicate to catch any variations (e.g., reportContext vs context)
                await queryClient.invalidateQueries({
                    predicate: (query) => {
                        const key = query.queryKey;
                        return (
                            Array.isArray(key) &&
                            key[0] === "user-default-report" &&
                            key[1] === session?.user?.id
                        );
                    },
                });
                // Invalidate reports list to refresh default icons
                await queryClient.invalidateQueries({
                    queryKey: [
                        "reports-list",
                        session?.user?.account_id,
                        context,
                    ],
                });
                // Invalidate default view query - must match the exact query key structure
                await queryClient.invalidateQueries({
                    queryKey: [
                        "default-view",
                        context,
                        session?.user?.account_id,
                        session?.user?.id,
                    ],
                });
                // Also invalidate with partial match to catch any variations
                await queryClient.invalidateQueries({
                    predicate: (query) => {
                        const key = query.queryKey;
                        return (
                            Array.isArray(key) &&
                            key[0] === "default-view" &&
                            key[1] === context
                        );
                    },
                });
                // Reset selectedViewId to null so the new default will be auto-selected
                // Use internal setter to clear user selection when setting new default
                setSelectedViewIdInternal?.(null, 'set-as-default');

                success(
                    t("reports.messages.set_as_default_success", {
                        defaultValue: "Report set as default successfully",
                    })
                );
            } catch (error) {
                showError(
                    error instanceof Error
                        ? error.message
                        : t("reports.messages.set_as_default_error", {
                            defaultValue: "Failed to set report as default",
                        })
                );
            }
        },
        [
            context,
            queryClient,
            session?.user?.id,
            session?.user?.account_id,
            success,
            showError,
            t,
        ]
    );


    // Handle selection change (for checkbox-based selection)
    const handleSelectionChange = useCallback(
        (id: number, checked: boolean) => {
            // CRITICAL: Read latest selectedRows from ref to avoid stale closures
            const currentSelectedRows = selectedRowsRef.current;
            const isControlled = externalSelectedRows !== undefined;

            const updateSelection = (prev: number[]) => {
                // Check if already selected to avoid duplicates
                const isAlreadySelected = prev.includes(id);
                let newSelection: number[];

                if (checked) {
                    // Add to selection if not already selected
                    newSelection = isAlreadySelected ? prev : [...prev, id];
                } else {
                    // Remove from selection
                    newSelection = prev.filter((rowId) => rowId !== id);
                }

                // Notify parent component of selection change
                onSelectedRowsChange?.(newSelection);
                return newSelection;
            };

            if (isControlled) {
                // Controlled mode - use current selectedRows from ref (always up-to-date)
                const currentSelection = currentSelectedRows;
                updateSelection(currentSelection);
            } else {
                // Internal state mode - update internal state
                setInternalSelectedRows((prev) => updateSelection(prev));
            }
        },
        [onSelectedRowsChange, externalSelectedRows]
    );

    // Handle multi-select change (for mouse+SHIFT selection)
    const handleMultiSelectChange = useCallback(
        (selectedRowIds: (number | string)[]) => {
            const numericIds = selectedRowIds.map((id) => Number(id)).filter((id) => !isNaN(id));

            // In controlled mode, only notify parent. In internal mode, update internal state.
            if (externalSelectedRows !== undefined) {
                // Controlled mode - just notify parent
                onSelectedRowsChange?.(numericIds);
            } else {
                // Internal state mode - update internal state
                setInternalSelectedRows(numericIds);
                onSelectedRowsChange?.(numericIds);
            }
        },
        [onSelectedRowsChange, externalSelectedRows]
    );

    // Generate columns
    const columns: GridColDef[] = useMemo(() => {
        if (!selectedViewId || !viewConfig) {
            // When no view is selected, return only checkbox column
            return [
                createCheckboxColumn({
                    selectedRows,
                    onSelectionChange: handleSelectionChange,
                    theme,
                }),
            ];
        }

        // Generate view columns
        const viewColumns = generateViewColumns({
            viewConfig,
            rows,
            tablesMetadata,
            context,
            tableName: config.tableName,
            theme,
            router: router as any,
            i18n,
            t,
            linkHandlers: config.linkHandlers,
            customCellRenderers,
            hideCollectionCategoryDisplay,
        });

        // Add checkbox column at the beginning
        const checkboxColumn = createCheckboxColumn({
            selectedRows,
            onSelectionChange: handleSelectionChange,
            onRangeSelection: enableMultiSelect ? handleMultiSelectChange : undefined,
            rows: rows,
            enableMultiSelect: enableMultiSelect,
            theme,
        });

        // Optional injected columns (e.g. credit-insurance violations)
        const finalColumns = [
            checkboxColumn,
            ...viewColumns,
            ...(additionalDataColumns ?? []),
        ];

        if (actionsColumn) {
            const actionsCol: GridColDef = {
                field: "actions",
                headerName: actionsColumnConfig?.headerName || t("actions.actions", { ns: "common" }),
                flex: actionsColumnConfig?.flex ?? 0.6,
                minWidth: actionsColumnConfig?.minWidth ?? 100,
                width: actionsColumnConfig?.width,
                sortable: false,
                filterable: false,
                disableColumnMenu: true,
                resizable: false,
                renderCell: actionsColumn,
            };
            finalColumns.push(actionsCol);
        }

        return finalColumns;
    }, [
        selectedViewId,
        viewConfig,
        rows,
        tablesMetadata,
        context,
        config.tableName,
        config.linkHandlers,
        theme,
        router,
        i18n,
        t,
        selectedRows,
        customCellRenderers,
        handleSelectionChange,
        actionsColumn,
        actionsColumnConfig,
        additionalDataColumns,
        hideCollectionCategoryDisplay,
    ]);


    // Column visibility model
    const columnVisibilityModel = useMemo(() => {
        const baseModel: Record<string, boolean> = {
            // Only show checkbox if bulk action button is provided
            checkbox: !!bulkActionButton,
        };

        if (selectedViewId && viewConfig) {
            columns.forEach((col) => {
                if (col.field !== "checkbox") {
                    baseModel[col.field] = true;
                }
            });
        }

        return baseModel;
    }, [columns, selectedViewId, viewConfig, bulkActionButton]);

    // Export handler
    const handleExport = useCallback(
        async (
            selectedColumns: string[],
            fileName: string,
            format: ExportFormat
        ) => {
            if (!selectedViewId) {
                throw new Error("No view selected for export");
            }

            if (onExport) {
                return onExport(selectedColumns, fileName, format);
            }

            // Default export implementation - use same filters as grid (e.g. customer_id)
            const filters = additionalFilters ? [...additionalFilters] : undefined;
            const response = await apiFetch(`/api/reports/${selectedViewId}/execute`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        page: 1,
                        limit: 10000,
                        search: debouncedSearch,
                        sortField: sortField || "",
                        sortDirection: sortDirection || "asc",
                        filters,
                        locale: i18n.language === "he" ? "he-IL" : "en-US",
                        language:
                            session?.user?.language ??
                            (i18n.language === "he" ? "Hebrew" : "English"),
                        ...(businessUnitId != null
                            ? { businessUnitId }
                            : {}),
                        ...(selectedUserId
                            ? { selectedUserId }
                            : {}),
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const rawData = data.data || [];

            // Transform view data for export
            return rawData.map((row: any) => {
                const transformedRow: any = { ...row };

                // Apply formatted values to main keys for export
                Object.keys(row).forEach((key) => {
                    if (key.startsWith("___formatted_")) {
                        const mainKey = key.replace("___formatted_", "");
                        // Only override if the value exists
                        if (row[key] !== undefined && row[key] !== null) {
                            transformedRow[mainKey] = row[key];
                        }
                    }
                });

                // Ensure required fields exist
                if (!transformedRow.id) {
                    transformedRow.id =
                        row.id ||
                        row[`${config.entityIdField}`] ||
                        row[`${config.tableName}.id`];
                }
                if (!transformedRow.name) {
                    transformedRow.name =
                        row.name ||
                        row[`${config.entityNameField}`] ||
                        row[`${config.tableName}.name`] ||
                        `Entity ${transformedRow.id}`;
                }

                return transformedRow;
            });
        },
        [
            selectedViewId,
            debouncedSearch,
            sortField,
            sortDirection,
            config,
            onExport,
            additionalFilters,
            businessUnitId,
            selectedUserId,
            i18n.language,
        ]
    );

    // Track if the grid has finished its initial load for the current view
    // This prevents showing old rows with new columns (which leads to empty columns)
    const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);
    const prevViewIdRef = useRef<number | null>(selectedViewId);

    useEffect(() => {
        // When view changes or search changes, reset the initial load state
        if (selectedViewId !== prevViewIdRef.current || debouncedSearch !== prevDebouncedSearchRef.current) {
            setIsInitialDataLoaded(false);
            prevViewIdRef.current = selectedViewId;
        }

        // Once loading is finished and we have rows and a valid view config, mark as loaded
        if (!isLoading && rows.length >= 0 && viewConfig && selectedViewId !== null) {
            // Small delay to ensure React has finished its render cycle for the data
            const timer = setTimeout(() => setIsInitialDataLoaded(true), 50);
            return () => clearTimeout(timer);
        }
    }, [isLoading, rows.length, viewConfig, selectedViewId, debouncedSearch]);

    // Error state
    if (error) {
        return (
            <Box sx={{ p: 4, textAlign: "center" }}>
                <Typography color="error" gutterBottom>
                    {t("messages.error_fetching_data", { ns: "common" })}
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>{error.message}</Typography>
                <button onClick={reset}>
                    {t("actions.retry", { ns: "common" })}
                </button>
            </Box>
        );
    }

    // Missing system/default report for this context (e.g. seed SQL not run).
    // Without this, !isInitialDataLoaded stays true forever and the spinner never ends.
    if (hasNoAvailableViews) {
        return (
            <Box sx={{ p: 4, textAlign: "center" }}>
                <Typography color="text.secondary">
                    {t("reports.messages.no_views_available", {
                        defaultValue: "No saved views are available for this list.",
                    })}
                </Typography>
            </Box>
        );
    }

    // Show loading placeholder if:
    // 1. We are explicitly loading and have no rows (standard case)
    // 2. We just changed the view/search and haven't finished the FIRST fetch yet (prevents empty columns flash)
    if ((isLoading && rows.length === 0) || !isInitialDataLoaded) {
        return (
            <Box
                sx={{
                    minHeight: 400,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "background.paper",
                    borderRadius: 1,
                }}
            >
                <CircularProgress />
            </Box>
        );
    }

    return (
        <>
            <EndlessScrollDataGrid
                key={`${debouncedSearch}-${selectedViewId}`}
                rows={rows}
                columns={columns}
                totalRecords={totalRecords}
                isLoading={isLoading}
                onLoadMore={loadMore}
                hasMore={hasMore}
                sortModel={sortModel}
                onSortModelChange={handleSortModelChange}
                customButtons={customButtons}
                bulkActionButton={bulkActionButton}
                searchValue={searchValue}
                onSearchChange={onSearchChange}
                searchPlaceholder={t("fields.search_placeholder", { ns: "common" })}
                searchDebounceMs={500}
                searchDisabled={false}
                searchDirection={i18n.language === "he" ? "rtl" : "ltr"}
                language={i18n.language}
                fillViewport={fillViewport}
                viewportRecalcDependency={viewportRecalcDependency}
                visibleRows={visibleRows}
                resizableColumns={true}
                columnVisibilityModel={columnVisibilityModel}
                noRowsMessage={t("messages.no_results", { ns: "common" })}
                noRowsDescription={t("messages.no_results_description", {
                    ns: "common",
                })}
                onExport={handleExport}
                exportDisabled={exportDisabled}
                exportContextInfo={{
                    pageName: context,
                    customPrefix: `${context}_export`,
                }}
                currencyColumns={config.currencyColumns as CurrencyColumnsConfig}
                reportSelector={reportSelector}
                selectedReportId={selectedViewId}
                onReportChange={handleViewChange}
                hasCreateReportPermission={allowAddEditViews && hasCreateReportPermission}
                onCreateReport={() => {
                    // Get customerId and tab from URL params if available (for customer-specific contexts)
                    const customerId = params?.customerId as string | undefined;
                    const tab = searchParams?.get("tab") || searchParams?.get("activeTab");

                    const queryParams = new URLSearchParams({
                        context,
                        table: config.tableName,
                    });
                    if (customerId) {
                        queryParams.set("customerId", customerId);
                    }
                    if (tab) {
                        queryParams.set("tab", tab);
                    }
                    if (
                        isDashboardChartDetailsReportContext(context) &&
                        searchParams
                    ) {
                        appendDashboardChartDetailsReturnParams(
                            queryParams,
                            searchParams
                        );
                    }
                    if (
                        isOperationDashboardDetailsReportContext(context) &&
                        searchParams
                    ) {
                        appendOperationDashboardDetailsReturnParams(
                            queryParams,
                            searchParams
                        );
                    }
                    router.push(
                        `/${locale}${AppUrls.REPORT_BUILDER}?${queryParams.toString()}`
                    );
                }}
                hasEditReportPermission={allowAddEditViews && hasEditReportPermission}
                onEditReport={(viewId) => {
                    // Get customerId and tab from URL params if available (for customer-specific contexts)
                    const customerId = params?.customerId as string | undefined;
                    const tab = searchParams?.get("tab") || searchParams?.get("activeTab");

                    const queryParams = new URLSearchParams({
                        id: viewId.toString(),
                        context,
                        table: config.tableName,
                    });
                    if (customerId) {
                        queryParams.set("customerId", customerId);
                    }
                    if (tab) {
                        queryParams.set("tab", tab);
                    }
                    if (
                        isDashboardChartDetailsReportContext(context) &&
                        searchParams
                    ) {
                        appendDashboardChartDetailsReturnParams(
                            queryParams,
                            searchParams
                        );
                    }
                    if (
                        isOperationDashboardDetailsReportContext(context) &&
                        searchParams
                    ) {
                        appendOperationDashboardDetailsReturnParams(
                            queryParams,
                            searchParams
                        );
                    }
                    router.push(
                        `/${locale}${AppUrls.REPORT_BUILDER}?${queryParams.toString()}`
                    );
                }}
                hasDeleteReportPermission={hasDeleteReportPermission}
                onDeleteReport={handleDeleteView}
                hasCloneReportPermission={allowAddEditViews && hasCloneReportPermission}
                onCloneReport={handleCloneView}
                reportContext={context}
                hasShareReportPermission={hasShareReportPermission}
                onShareReport={onShareView}
                onSetAsDefault={handleSetAsDefault}
                isUserDefault={isUserDefault}
                onRefresh={handleRefresh}
                onRowClick={onRowClick}
                enableMultiSelect={enableMultiSelect}
                selectedRowIds={enableMultiSelect ? selectedRows : undefined}
                onSelectionChange={enableMultiSelect ? handleMultiSelectChange : undefined}
            />
            <DeleteDialog
                isOpen={deleteReportDialog.isOpen}
                onClose={handleCloseDeleteReportDialog}
                onConfirm={handleConfirmDeleteReport}
                title={t("reports.actions.delete_report", {
                    defaultValue: "Delete Report",
                })}
                description={deleteReportDialog.reportName
                    ? `${t("reports.messages.delete_report_confirmation", {
                        defaultValue:
                            "Are you sure you want to delete this view?",
                    })} "${deleteReportDialog.reportName}"?`
                    : t("reports.messages.delete_report_confirmation", {
                        defaultValue: "Are you sure you want to delete this view?",
                    })}
                confirmLabel={t("actions.delete", { ns: "common" })}
                cancelLabel={t("actions.cancel", { ns: "common" })}
                isLoading={deleteReportDialog.isDeleting}
                type="delete"
                locale={locale}
            />
        </>
    );
};

export default ViewBasedDataGrid;
