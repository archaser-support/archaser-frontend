import { Box, CircularProgress } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { GridColDef, GridSortModel } from "@mui/x-data-grid";
import React, {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { ExportFormat } from "../../utility/exportToExcel";

import { createCheckboxColumn } from "@/shared/components/ViewBasedDataGrid/CheckboxColumn";

import EndlessScrollToolbar from "./EndlessScrollToolbar";
import ExportDialog from "./ExportDialog";
import DataGridHeader from "./components/DataGridHeader";
import DataGridRow from "./components/DataGridRow";
import EmptyState from "./components/EmptyState";
import { GRID_CONSTANTS } from "./constants";
import { useColumnResizing } from "./hooks/useColumnResizing";
import { useColumnWidthSync } from "./hooks/useColumnWidthSync";
import { useExport } from "./hooks/useExport";
import { useGridRefs } from "./hooks/useGridRefs";
import { useRowNumberColumn } from "./hooks/useRowNumberColumn";
import { useViewportHeight } from "./hooks/useViewportHeight";
import { useVirtualScroll } from "./hooks/useVirtualScroll";
import { getVisibleColumnsWithRowNumber } from "./utils/columnUtils";
import {
    calculateDynamicHeight,
    getResponsiveHeights,
    ITEM_HEIGHT,
} from "./utils/heightUtils";
import { enhanceColumnsWithHighlighting } from "./utils/highlightUtils";
import { calculateLoadMoreTrigger } from "./utils/scrollUtils";
import {
    measureOverflowScrollbarWidth,
    nextScrollbarPaddingPx,
    shouldNotifyGridBecameVisible,
} from "./utils/scrollbarWidth";

// Re-export utilities and hooks for backward compatibility
export { useVirtualInfiniteScroll } from "./hooks/useVirtualInfiniteScroll";
export { enhanceColumnsWithHighlighting } from "./utils/highlightUtils";
export { createApiQueryFn, createQueryFn } from "./utils/queryHelpers";
export {
    BREAKPOINTS, getInitialWindowWidth,
    useWindowWidth
} from "./utils/windowUtils";

interface EndlessScrollDataGridProps {
    rows: any[];
    columns: GridColDef[];
    totalRecords: number;
    isLoading: boolean;
    onLoadMore: () => void;
    hasMore: boolean;
    sortModel?: GridSortModel;
    onSortModelChange?: (_model: GridSortModel) => void;
    customButtons?: React.ReactNode;
    bulkActionButton?: React.ReactNode;
    searchValue?: string;
    onSearchChange?: (_value: string) => void;
    searchPlaceholder?: string;
    searchDebounceMs?: number;
    searchDisabled?: boolean;
    searchDirection?: "ltr" | "rtl";
    onSearchFocus?: () => void;
    onSearchBlur?: () => void;
    columnVisibilityModel?: Record<string, boolean>;
    onRowClick?: (_row: any) => void;
    // Multi-select props
    enableMultiSelect?: boolean; // Enable multi-select with mouse and SHIFT
    selectedRowIds?: (number | string)[]; // Controlled selection
    onSelectionChange?: (_selectedRowIds: (number | string)[]) => void; // Selection change handler
    noRowsMessage?: string;
    noRowsDescription?: string;
    language?: string; // Add language prop for RTL/LTR support
    height?: { xs: number; sm: number; md: number }; // Add height prop for custom heights
    visibleRows?: number; // Number of visible rows (header + rows). If provided, calculates height automatically
    fillViewport?: boolean; // If true, calculates height to fill available viewport space (aligns to bottom of page)
    /** When using fillViewport, grid height is at least this many pixels (after viewport calculation). */
    fillViewportMinHeightPx?: number;
    resizableColumns?: boolean; // Add prop to enable column resizing
    // Export props
    onExport?: (
        _selectedColumns: string[],
        _fileName: string,
        _format: ExportFormat
    ) => Promise<any[]>; // Function to fetch all data for export
    exportDisabled?: boolean;
    exportContextInfo?: {
        pageName?: string;
        customerName?: string;
        customerNumber?: string;
        customPrefix?: string;
    };
    currencyColumns?: Record<
        string,
        { amountField: string; currencyField: string }
    >;
    highlightedRowId?: number | string | null; // ID of row to highlight
    hideToolbar?: boolean; // Hide the toolbar
    /** When this value changes, viewport height is recalculated (e.g. when content above grid loads) */
    viewportRecalcDependency?: unknown;
    // Report selector props
    reportSelector?: boolean;
    selectedReportId?: number | string | null;
    onReportChange?: (reportId: number | string | null) => void;
    hasCreateReportPermission?: boolean;
    onCreateReport?: () => void;
    hasEditReportPermission?: boolean;
    onEditReport?: (reportId: number) => void;
    hasDeleteReportPermission?: boolean;
    onDeleteReport?: (reportId: number) => void;
    hasCloneReportPermission?: boolean;
    onCloneReport?: (reportId: number) => void;
    reportContext?: string;
    // Share report props
    hasShareReportPermission?: boolean;
    onShareReport?: (reportId: number) => void;
    // User default report props
    onSetAsDefault?: (reportId: number) => void;
    isUserDefault?: boolean;
    // Refresh current view (with current filters)
    onRefresh?: () => void;
}

const EndlessScrollDataGrid: React.FC<EndlessScrollDataGridProps> = ({
    rows,
    columns,
    totalRecords,
    isLoading,
    onLoadMore,
    hasMore,
    sortModel,
    onSortModelChange,
    customButtons,
    bulkActionButton,
    searchValue,
    onSearchChange,
    searchPlaceholder,
    searchDisabled,
    searchDirection,
    onSearchFocus,
    onSearchBlur,
    columnVisibilityModel = {},
    onRowClick,
    enableMultiSelect = false,
    selectedRowIds: externalSelectedRowIds,
    onSelectionChange,
    noRowsMessage,
    noRowsDescription,
    language = "en",
    height,
    visibleRows,
    fillViewport = false,
    fillViewportMinHeightPx,
    viewportRecalcDependency,
    resizableColumns = false,
    // Export props
    onExport,
    exportDisabled = false,
    exportContextInfo,
    currencyColumns,
    highlightedRowId,
    hideToolbar = false,
    // Report selector props
    reportSelector = false,
    selectedReportId,
    onReportChange,
    hasCreateReportPermission = false,
    onCreateReport,
    hasEditReportPermission = false,
    onEditReport,
    hasDeleteReportPermission = false,
    onDeleteReport,
    hasCloneReportPermission = false,
    onCloneReport,
    reportContext,
    hasShareReportPermission = false,
    onShareReport,
    onSetAsDefault,
    isUserDefault = false,
    onRefresh,
}) => {
    const theme = useTheme();

    // Multi-select state
    const [internalSelectedRowIds, setInternalSelectedRowIds] = useState<
        (number | string)[]
    >([]);

    // Use controlled or internal state for selection
    const selectedRowIds = enableMultiSelect
        ? externalSelectedRowIds !== undefined
            ? externalSelectedRowIds
            : internalSelectedRowIds
        : [];

    const setSelectedRowIds = useCallback(
        (ids: (number | string)[]) => {
            if (!enableMultiSelect) {
                return;
            }

            if (externalSelectedRowIds !== undefined) {
                onSelectionChange?.(ids);
            } else {
                setInternalSelectedRowIds(ids);
            }
        },
        [enableMultiSelect, externalSelectedRowIds, onSelectionChange]
    );

    // Use consolidated refs hook (Phase 3: State Consolidation)
    const gridRefs = useGridRefs();
    const containerRef = gridRefs.container;
    const headerContentRef = gridRefs.header;
    const bodyContentRef = gridRefs.body;
    const highlightedRowRef = gridRefs.highlightedRow;
    const wrapperRef = gridRefs.wrapper;

    const lastLoadMoreCallRef = useRef<number>(0);

    // Use viewport height hook
    const viewportHeight = useViewportHeight({
        fillViewport,
        hideToolbar,
        isLoading,
        wrapperRef,
        viewportRecalcDependency,
    });

    const viewportHeightForGrid = useMemo(() => {
        if (viewportHeight === null) {
            return null;
        }
        if (
            fillViewport &&
            fillViewportMinHeightPx != null &&
            fillViewportMinHeightPx > 0
        ) {
            return Math.max(fillViewportMinHeightPx, viewportHeight);
        }
        return viewportHeight;
    }, [viewportHeight, fillViewport, fillViewportMinHeightPx]);

    // Row number column definition
    const rowNumberColumn = useRowNumberColumn();

    const checkboxColumn = useMemo(() => {
        if (!enableMultiSelect) return null;

        const numericSelected = selectedRowIds
            .map((id) => (typeof id === "string" ? parseInt(id, 10) : id))
            .filter(
                (id): id is number =>
                    typeof id === "number" && !Number.isNaN(id)
            );

        return createCheckboxColumn({
            selectedRows: numericSelected,
            onSelectionChange: (id, checked) => {
                const normalizedId = Number(id);
                const current = selectedRowIds
                    .map((x) => (typeof x === "string" ? parseInt(x, 10) : x))
                    .filter(
                        (x): x is number =>
                            typeof x === "number" && !Number.isNaN(x)
                    );

                if (checked) {
                    setSelectedRowIds(Array.from(new Set([...current, normalizedId])));
                } else {
                    setSelectedRowIds(current.filter((x) => x !== normalizedId));
                }
            },
            rows,
            enableMultiSelect: false,
            theme,
        });
    }, [enableMultiSelect, rows, selectedRowIds, setSelectedRowIds, theme]);

    // Filter visible columns and adjust checkbox column width
    const visibleColumns = useMemo(
        () => {
            const cols = getVisibleColumnsWithRowNumber(
                columns,
                columnVisibilityModel,
                rowNumberColumn
            );

            // Avoid double checkbox columns: some parents (e.g. ViewBasedDataGrid) already inject a "checkbox" column.
            const hasCheckboxAlready = cols.some((c) => c.field === "checkbox");

            if (enableMultiSelect && checkboxColumn && !hasCheckboxAlready) {
                return [checkboxColumn, ...cols];
            }

            return cols;
        },
        [
            columns,
            columnVisibilityModel,
            rowNumberColumn,
            enableMultiSelect,
            checkboxColumn,
        ]
    );

    // Export hook
    const {
        isExportDialogOpen,
        isExporting,
        handleExportClick,
        handleExport,
        handleExportDialogClose,
    } = useExport({
        columns,
        sortModel,
        currencyColumns,
        onExport,
        exportDisabled,
        totalRecords,
    });

    // Enhance visible columns with search highlighting
    const enhancedColumns = useMemo(() => {
        return enhanceColumnsWithHighlighting(
            visibleColumns,
            searchValue || "",
            language
        );
    }, [visibleColumns, searchValue, language]);

    // Create a ref to store the sync function (will be set by useColumnWidthSync)
    const syncColumnWidthsRefForResizing = useRef<
        ((forceClearCache?: boolean, forceSync?: boolean) => void) | undefined
    >();

    // Use column resizing hook (must be after enhancedColumns is defined)
    // Note: columnWidths will be undefined initially, but that's okay
    const {
        columnWidths,
        isResizing,
        resizeHandleClickRef,
        handleResizeStart,
        handleAutoResize,
    } = useColumnResizing({
        resizableColumns,
        columns,
        rows,
        enhancedColumns,
        language,
        onSyncAfterResize: () => {
            // Call sync function via ref after resize ends
            syncColumnWidthsRefForResizing.current?.();
        },
        onSyncDuringResize: () => {
            // Call sync function via ref during resize for real-time updates
            syncColumnWidthsRefForResizing.current?.();
        },
    });

    // Calculate container height using utility function
    // Use a ref to store the previous stable row count to prevent height changes during loading
    const previousRowCountRef = useRef<number>(rows.length);
    const previousHeightRef = useRef<number | null>(null);
    const hasHadDataRef = useRef<boolean>(rows.length > 0);

    // Update previous row count and track if we've had data
    useEffect(() => {
        if (!isLoading && rows.length > 0) {
            previousRowCountRef.current = rows.length;
            hasHadDataRef.current = true;
        }
    }, [rows.length, isLoading]);

    // Track whether initial fetch has completed (so we don't show "no rows" before fetch finishes)
    const hasCompletedInitialFetchRef = useRef(false);
    const prevLoadingRef = useRef(isLoading);
    useEffect(() => {
        if (prevLoadingRef.current && !isLoading) {
            hasCompletedInitialFetchRef.current = true;
        }
        // If we're not loading, treat initial fetch as complete (e.g. grid mounted after parent
        // already finished loading, such as when opening a tab that contains the grid)
        if (!isLoading) {
            hasCompletedInitialFetchRef.current = true;
        }
        prevLoadingRef.current = isLoading;
    }, [isLoading]);

    // Calculate height with stable row count during loading transitions
    const containerHeight = useMemo(() => {
        // If rows are empty but we had data before, maintain previous height during transitions
        // This prevents height jumps when switching views or when data is being refetched
        // We maintain height if:
        // 1. Rows are currently empty (length === 0)
        // 2. We have a stored previous height
        // 3. We've had data before (hasHadDataRef) OR we're loading
        const shouldMaintainHeight =
            rows.length === 0 &&
            previousHeightRef.current !== null &&
            (hasHadDataRef.current || isLoading);

        if (shouldMaintainHeight) {
            return previousHeightRef.current;
        }

        // If loading and rows are temporarily empty, use previous row count to maintain height
        const rowsForHeight =
            isLoading && rows.length === 0 && previousRowCountRef.current > 0
                ? Array(previousRowCountRef.current).fill(null)
                : rows;

        const calculatedHeight = calculateDynamicHeight({
            rows: rowsForHeight,
            height,
            visibleRows,
            fillViewport,
            viewportHeight: viewportHeightForGrid,
        });

        // If fillViewport is enabled, prioritize viewportHeight
        // This ensures consistent height even during view transitions
        if (fillViewport) {
            if (viewportHeightForGrid !== null) {
                // Always use viewportHeight when fillViewport is enabled and it's available
                if (rows.length > 0) {
                    previousHeightRef.current = viewportHeightForGrid;
                }
                return viewportHeightForGrid;
            } else if (previousHeightRef.current !== null && hasHadDataRef.current) {
                // If viewportHeight is temporarily null but we have a previous height,
                // maintain it to prevent shrinking during transitions
                return previousHeightRef.current;
            }
        }

        // If we have a previous height and the new calculated height is significantly larger
        // (more than 50px difference), maintain the previous height to prevent height increases
        // This handles cases where different views might calculate different heights
        const heightDifference = previousHeightRef.current !== null
            ? calculatedHeight - previousHeightRef.current
            : 0;
        const shouldPreventHeightIncrease =
            previousHeightRef.current !== null &&
            rows.length > 0 &&
            heightDifference > 50 &&
            !isLoading &&
            previousRowCountRef.current > 0;

        if (shouldPreventHeightIncrease) {
            // Don't update previousHeightRef, keep using the previous one to prevent increase
            return previousHeightRef.current;
        }

        // Store the calculated height for future reference
        // Always update when we have data to ensure we have a valid previous height
        if (rows.length > 0) {
            previousHeightRef.current = calculatedHeight;
        }

        return calculatedHeight;
    }, [
        rows.length,
        height,
        visibleRows,
        fillViewport,
        viewportHeightForGrid,
        isLoading,
    ]);

    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [scrollbarWidth, setScrollbarWidth] = useState(0);
    /** Incremented when grid becomes visible (IntersectionObserver); used to re-run scrollbar + column sync */
    const [visibilitySyncTrigger, setVisibilitySyncTrigger] = useState(0);

    // Refs for values that don't need to trigger re-renders (must be after state declarations)
    const hasMoreRef = useRef(hasMore);
    const isLoadingRef = useRef(isLoading);
    const isLoadingMoreRef = useRef(isLoadingMore);
    const totalRecordsRef = useRef(totalRecords);
    const onLoadMoreRef = useRef(onLoadMore);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Update refs when values change (consolidated)
    useEffect(() => {
        hasMoreRef.current = hasMore;
        isLoadingRef.current = isLoading;
        isLoadingMoreRef.current = isLoadingMore;
        totalRecordsRef.current = totalRecords;
        onLoadMoreRef.current = onLoadMore;
    }, [hasMore, isLoading, isLoadingMore, totalRecords, onLoadMore]);

    // Use virtual scroll hook (must be before useColumnWidthSync to provide virtualMetrics)
    const { setScrollState, virtualMetrics } = useVirtualScroll({
        rows,
        containerHeight: containerHeight ?? 0,
        itemHeight: ITEM_HEIGHT,
        overscan: GRID_CONSTANTS.OVERSCAN,
        totalRecords,
    });

    // Use column width sync hook (must be after useColumnResizing to get columnWidths and isResizing)
    const { syncColumnWidths, setScrolling } =
        useColumnWidthSync({
            enhancedColumns,
            columnWidths,
            isResizing,
            rows,
            headerRef: headerContentRef,
            bodyRef: bodyContentRef,
            isLoading,
            visibleRange: {
                startIndex: virtualMetrics.startIndex,
                endIndex: virtualMetrics.endIndex,
            },
        });

    // Update the ref so useColumnResizing can call sync
    useEffect(() => {
        syncColumnWidthsRefForResizing.current = syncColumnWidths;
    }, [syncColumnWidths]);

    // Sync column widths when column visibility changes or window resizes
    useEffect(() => {
        // Use requestAnimationFrame to ensure DOM has updated after visibility change
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                // Force sync, clear cache, and forceSync to ensure recalculation
                syncColumnWidths(true, true);
            });
        });
    }, [columnVisibilityModel, syncColumnWidths]);

    // Sync column widths when sort model changes (sorting can affect column rendering)
    // Use useLayoutEffect for immediate sync before paint
    useLayoutEffect(() => {
        if (sortModel && sortModel.length > 0) {
            // Use multiple requestAnimationFrame calls to ensure DOM has fully updated after sort
            // Also add a small delay to ensure data has been loaded and rendered
            const syncTimeout = setTimeout(() => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            // Force sync to ensure columns align after sort
                            syncColumnWidths(true, true);
                        });
                    });
                });
            }, 100); // Small delay to ensure data is loaded

            return () => clearTimeout(syncTimeout);
        }
    }, [sortModel, syncColumnWidths]);

    // Sync column widths when rows data changes significantly (e.g., after loading all rows or sorting)
    // This ensures column widths are correct after pagination completes or data structure changes
    // Use useLayoutEffect for immediate sync before paint
    const prevRowCountRef = useRef(rows.length);
    const prevRowKeysRef = useRef<string>("");
    const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useLayoutEffect(() => {
        // Clear any pending sync timeout
        if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current);
            syncTimeoutRef.current = null;
        }

        const rowCountChanged = rows.length !== prevRowCountRef.current;
        // Check if data structure changed (e.g., different fields present) by comparing keys of first row
        const currentRowKeys =
            rows.length > 0
                ? JSON.stringify(Object.keys(rows[0] || {}).sort())
                : "";
        const dataStructureChanged =
            currentRowKeys !== prevRowKeysRef.current && currentRowKeys !== "";


        if ((rowCountChanged || dataStructureChanged) && rows.length > 0) {
            // Use multiple requestAnimationFrame calls to ensure DOM has fully updated
            // Also add a small delay to ensure virtual rows are rendered
            const syncFn = () => {
                // Check if rows are actually in the DOM before syncing
                if (bodyContentRef.current && headerContentRef.current) {
                    const bodyRows =
                        bodyContentRef.current.querySelectorAll('[role="row"]');
                    if (bodyRows.length > 0 || rows.length === 0) {
                        // Force sync to ensure columns align after data changes
                        syncColumnWidths(true, true);
                    } else {
                        // Rows not in DOM yet, try again after a short delay
                        syncTimeoutRef.current = setTimeout(() => {
                            syncColumnWidths(true, true);
                        }, 100);
                    }
                } else {
                    // Refs not ready, try again
                    syncTimeoutRef.current = setTimeout(() => {
                        syncColumnWidths(true, true);
                    }, 100);
                }
            };

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        syncFn();
                    });
                });
            });
        }
        prevRowCountRef.current = rows.length;
        prevRowKeysRef.current = currentRowKeys;

        // Cleanup timeout on unmount
        return () => {
            if (syncTimeoutRef.current) {
                clearTimeout(syncTimeoutRef.current);
                syncTimeoutRef.current = null;
            }
        };
    }, [rows.length, rows, syncColumnWidths, bodyContentRef, headerContentRef]);

    // Sync on window resize to handle browser window resizing
    useEffect(() => {
        let resizeTimeout: NodeJS.Timeout;
        const debouncedResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                syncColumnWidths(true, true);
            }, GRID_CONSTANTS.SCROLL_DEBOUNCE_DELAY);
        };

        window.addEventListener("resize", debouncedResize);
        return () => {
            window.removeEventListener("resize", debouncedResize);
            clearTimeout(resizeTimeout);
        };
    }, [syncColumnWidths]);

    // When grid becomes visible (e.g. tab switch from display:none), re-run scrollbar calc and column sync.
    // Do not depend on syncColumnWidths: re-creating the observer while visible would fire
    // isIntersecting again and loop setState (max update depth).
    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        let wasIntersecting = false;
        const observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                const isIntersecting = Boolean(entry?.isIntersecting);
                if (
                    shouldNotifyGridBecameVisible(
                        wasIntersecting,
                        isIntersecting
                    )
                ) {
                    setVisibilitySyncTrigger((prev) => prev + 1);
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            syncColumnWidthsRefForResizing.current?.(true, true);
                        });
                    });
                }
                wasIntersecting = isIntersecting;
            },
            { threshold: 0, rootMargin: "0px" }
        );
        observer.observe(wrapper);
        return () => observer.disconnect();
    }, [isLoading]);

    // Cleanup scroll timeout on unmount
    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, []);

    // Handle scroll events
    const handleScroll = useCallback(
        (e: React.UIEvent<HTMLDivElement>) => {
            // Prevent scroll propagation to parent elements
            e.stopPropagation();

            // Use containerRef to ensure we read from the actual scroll container
            // (e.target can differ with event delegation or nested scrollable elements)
            const scrollContainer = containerRef.current;
            const scrollTop = scrollContainer ? scrollContainer.scrollTop : (e.target as HTMLDivElement).scrollTop;

            // Mark as scrolling to prevent sync during fast scroll
            setScrolling(true);

            // Clear existing timeout
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }

            // Set scrolling to false after scroll stops (debounced)
            scrollTimeoutRef.current = setTimeout(() => {
                setScrolling(false);
            }, GRID_CONSTANTS.SCROLL_DEBOUNCE_DELAY);

            // Update scroll state - use totalRecords for scrollbar, not rows.length
            setScrollState((prev) => ({
                ...prev,
                scrollTop,
                totalItems: totalRecordsRef.current, // Use ref to avoid dependency
            }));

            // Update visible range tracking (no sync during scroll - widths calculated only on initial load)
            // Note: Visible range sync is handled by useColumnWidthSync hook

            // Calculate distance from bottom based on LOADED rows, not total records
            // This ensures we trigger loading when we're near the end of loaded content
            const loadedRowsHeight = rows.length * ITEM_HEIGHT;
            const shouldLoadMore = containerHeight !== null && calculateLoadMoreTrigger(
                loadedRowsHeight,
                scrollTop,
                containerHeight,
                GRID_CONSTANTS.LOAD_MORE_THRESHOLD
            );

            // Use refs to check conditions without dependencies
            if (
                shouldLoadMore &&
                hasMoreRef.current &&
                !isLoadingRef.current &&
                !isLoadingMoreRef.current
            ) {
                const now = Date.now();
                const timeSinceLastCall = now - lastLoadMoreCallRef.current;

                if (timeSinceLastCall > GRID_CONSTANTS.LOAD_MORE_DEBOUNCE) {
                    lastLoadMoreCallRef.current = now;
                    setIsLoadingMore(true);
                    onLoadMoreRef.current();
                }
            }
        },
        [
            containerHeight,
            setScrollState,
            rows.length,
            setScrolling,
        ]
    );

    // Reset loading state when rows change
    useEffect(() => {
        if (isLoadingMore) {
            const timer = setTimeout(() => {
                setIsLoadingMore(false);
            }, GRID_CONSTANTS.LOADING_MORE_TIMEOUT);
            return () => clearTimeout(timer);
        }
    }, [rows.length, isLoadingMore]);

    // Calculate scrollbar width to adjust header alignment
    useEffect(() => {
        if (!containerRef.current) return;

        const calculateScrollbarWidth = () => {
            const container = containerRef.current;
            if (!container) return;

            const measured = measureOverflowScrollbarWidth(container);
            setScrollbarWidth((prev) => nextScrollbarPaddingPx(prev, measured));
        };

        // Calculate initially
        calculateScrollbarWidth();

        // Recalculate on resize or content change
        const resizeObserver = new ResizeObserver(() => {
            calculateScrollbarWidth();
        });
        resizeObserver.observe(containerRef.current);

        // Also listen to scroll events in case content changes
        const handleScroll = () => {
            calculateScrollbarWidth();
        };
        containerRef.current.addEventListener("scroll", handleScroll, {
            passive: true,
        });

        return () => {
            resizeObserver.disconnect();
            if (containerRef.current) {
                containerRef.current.removeEventListener(
                    "scroll",
                    handleScroll
                );
            }
        };
    }, [rows.length, containerHeight, visibilitySyncTrigger]);

    // Scroll to highlighted row when it's loaded
    useEffect(() => {
        if (
            highlightedRowId !== null &&
            highlightedRowId !== undefined &&
            rows.length > 0 &&
            containerRef.current
        ) {
            const rowIndex = rows.findIndex(
                (row) => String(row.id) === String(highlightedRowId)
            );
            if (rowIndex >= 0 && containerHeight !== null) {
                const targetScrollTop = rowIndex * ITEM_HEIGHT;
                // Scroll to the row, centering it in the viewport if possible
                const scrollPosition = Math.max(
                    0,
                    targetScrollTop - containerHeight / 2 + ITEM_HEIGHT / 2
                );
                containerRef.current.scrollTop = scrollPosition;
                setScrollState((prev) => ({
                    ...prev,
                    scrollTop: scrollPosition,
                }));
            }
        }
    }, [highlightedRowId, rows, containerHeight]);

    // Handle sort click
    const handleSortClick = useCallback(
        (field: string) => {
            if (!onSortModelChange) return;

            const getBaseFieldName = (sortField: string): string => {
                const parts = sortField.split(".");
                return parts.length > 1 ? parts[parts.length - 1] : sortField;
            };
            const baseFieldName = getBaseFieldName(field);

            const currentSort = sortModel?.find(
                (s) =>
                    s.field === field ||
                    getBaseFieldName(s.field) === baseFieldName
            );

            // Cycle between asc and desc (no neutral state)
            if (!currentSort || currentSort.sort === "desc") {
                onSortModelChange([{ field, sort: "asc" }]);
            } else {
                onSortModelChange([{ field, sort: "desc" }]);
            }
        },
        [sortModel, onSortModelChange]
    );

    // Toolbar: render EndlessScrollToolbar directly (stable component type) to avoid
    // remounting when parent re-renders with new callback refs (was: useCallback wrapper).
    const toolbarProps = {
        customButtons,
        bulkActionButton,
        searchValue,
        onSearchChange,
        searchPlaceholder,
        searchDisabled,
        searchDirection,
        onSearchFocus,
        onSearchBlur,
        totalRecords,
        columns,
        onExportClick: handleExportClick,
        exportDisabled: exportDisabled || isExporting,
        reportSelector,
        selectedReportId,
        onReportChange,
        hasCreateReportPermission,
        onCreateReport,
        hasEditReportPermission,
        onEditReport,
        hasDeleteReportPermission,
        onDeleteReport,
        hasCloneReportPermission,
        onCloneReport,
        reportContext,
        hasShareReportPermission,
        onShareReport,
        onSetAsDefault,
        isUserDefault,
        onRefresh,
    };

    // Render header
    const renderHeader = () => {
        return (
            <DataGridHeader
                columns={enhancedColumns}
                sortModel={sortModel}
                onSort={handleSortClick}
                columnWidths={columnWidths}
                resizableColumns={resizableColumns}
                onResizeStart={handleResizeStart}
                onAutoResize={handleAutoResize}
                language={language}
                headerContentRef={headerContentRef}
                resizeHandleClickRef={resizeHandleClickRef}
            />
        );
    };

    // Render virtual items
    const renderVirtualItems = () => {
        const { visibleItems, offsetY, startIndex, totalHeight } =
            virtualMetrics;

        return (
            <Box sx={{ height: `${totalHeight}px`, position: "relative" }}>
                <Box
                    sx={{
                        position: "absolute",
                        top: `${offsetY}px`,
                        left: 0,
                        right: 0,
                    }}
                >
                    {visibleItems.map((row, index) => {
                        const actualIndex = startIndex + index;
                        const isHighlighted =
                            highlightedRowId !== null &&
                            highlightedRowId !== undefined &&
                            String(row.id) === String(highlightedRowId);
                        const isSelected = enableMultiSelect
                            ? selectedRowIds.some((id) =>
                                String(id) === String(row.id)
                            )
                            : false;

                        return (
                            <DataGridRow
                                key={row.id || `row-${actualIndex}`}
                                row={row}
                                index={index}
                                actualIndex={actualIndex}
                                columns={enhancedColumns}
                                columnWidths={columnWidths}
                                isHighlighted={isHighlighted}
                                isSelected={isSelected}
                                language={language}
                                onRowClick={onRowClick ? (row) => {
                                    // Only call original onRowClick if provided (for backward compatibility)
                                    // Row selection is handled only via checkbox column when enableMultiSelect is true
                                    onRowClick(row);
                                } : undefined}
                                highlightedRowRef={highlightedRowRef}
                            />
                        );
                    })}
                </Box>
            </Box>
        );
    };

    // Calculate responsive heights using utility function
    const responsiveHeights = useMemo(
        () =>
            getResponsiveHeights({
                rows,
                height,
                visibleRows,
                fillViewport,
                viewportHeight: viewportHeightForGrid,
            }),
        [rows.length, height, visibleRows, fillViewport, viewportHeightForGrid]
    );

    const showInitialLoading =
        rows.length === 0 &&
        (isLoading || !hasCompletedInitialFetchRef.current);

    // Loading state: show spinner when loading or when we haven't completed initial fetch yet
    // (avoids flashing "no customers found" before the first fetch completes)
    if (showInitialLoading) {
        return (
            <Box
                ref={wrapperRef}
                sx={{
                    width: "100%",
                }}
            >
                {/* Toolbar */}
                {!hideToolbar && (
                    <Box
                        sx={{
                            bgcolor: "background.paper",
                            borderRadius: theme.shape.borderRadius,
                            mb: 2,
                        }}
                    >
                        <EndlessScrollToolbar {...toolbarProps} />
                    </Box>
                )}

                <Box
                    sx={{
                        width: "100%",
                        height: responsiveHeights,
                        borderRadius: theme.shape.borderRadius,
                        overflow: "hidden",
                        position: "relative",
                        isolation: "isolate",
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            height: "100%",
                        }}
                    >
                        <CircularProgress color="primary" size={40} thickness={4} />
                    </Box>
                </Box>
            </Box>
        );
    }

    return (
        <Box
            ref={wrapperRef}
            sx={{
                width: "100%",
                ...(fillViewport
                    ? {
                          flex: 1,
                          minHeight: 0,
                          display: "flex",
                          flexDirection: "column",
                      }
                    : {}),
            }}
        >
            {/* Toolbar */}
            {!hideToolbar && <EndlessScrollToolbar {...toolbarProps} />}

            <Box
                sx={{
                    width: "100%",
                    height: `${containerHeight}px`,
                    borderRadius: theme.shape.borderRadius,
                    border: `1px solid ${theme.palette.divider}`,
                    overflow: "hidden",
                    position: "relative",
                    // Remove isolation: isolate as it can clip borders when combined with overflow: hidden
                    // isolation: "isolate",
                    boxSizing: "border-box",
                    padding: 0,
                    margin: 0,
                    // Links in grid cells: primary color + underline (exclude MUI anchor buttons)
                    "& a:not(.MuiButtonBase-root), & .MuiLink-root:not(.MuiButtonBase-root)": {
                        color: `${theme.palette.primary.main} !important`,
                        textDecoration: "underline",
                        textUnderlineOffset: "0.125em",
                        "&:hover": {
                            color: `${theme.palette.primary.dark} !important`,
                            textDecoration: "underline",
                        },
                    },
                }}
            >
                {/* Header wrapper */}
                <Box
                    sx={{
                        overflow: "hidden",
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        width: "100%", // Ensure header wrapper takes full width
                        maxWidth: "100%", // Constrain to parent width
                        boxSizing: "border-box",
                        padding: 0,
                        margin: 0,
                        // Account for scrollbar width to align with body content
                        // In RTL (Hebrew), scrollbar is on the left, so use paddingLeft
                        // In LTR, scrollbar is on the right, so use paddingRight
                        ...(language === "he"
                            ? {
                                paddingLeft:
                                    scrollbarWidth > 0
                                        ? `${scrollbarWidth}px`
                                        : 0,
                                paddingRight: 0,
                            }
                            : {
                                paddingRight:
                                    scrollbarWidth > 0
                                        ? `${scrollbarWidth}px`
                                        : 0,
                                paddingLeft: 0,
                            }),
                    }}
                >
                    {renderHeader()}
                </Box>

                <Box
                    ref={containerRef}
                    onScroll={handleScroll}
                    sx={{
                        height: containerHeight !== null ? `${containerHeight - ITEM_HEIGHT}px` : "auto", // Subtract header height
                        overflowY: "auto",
                        overflowX: "hidden",
                        pointerEvents: "auto",
                        overscrollBehavior: "contain",
                        overscrollBehaviorY: "contain",
                        overscrollBehaviorX: "none",
                        touchAction: "pan-y",
                        position: "relative",
                        // Remove isolation: isolate and contain as they can clip borders
                        // isolation: "isolate",
                        // contain: "layout style paint", // This can clip borders
                        boxSizing: "border-box",
                        // Remove padding/margin that might clip borders - borders should be fully visible
                        paddingTop: 0,
                        paddingLeft: 0,
                        paddingRight: 0,
                        paddingBottom: 0,
                        marginTop: 0,
                        marginLeft: 0,
                        marginRight: 0,
                        marginBottom: 0,
                        // Only vertical scrollbar for body
                        scrollbarWidth: "thin !important" as any,
                        scrollbarColor: `${alpha(theme.palette.primary.main, 0.6)} ${alpha(theme.palette.primary.main, 0.1)} !important`,
                        msOverflowStyle: "auto !important" as any,
                        "&::-webkit-scrollbar": {
                            width: "12px !important",
                            display: "block !important",
                            WebkitAppearance: "none",
                            appearance: "none",
                        },
                        "&::-webkit-scrollbar-track": {
                            background: `${alpha(theme.palette.primary.main, 0.1)} !important`,
                            borderRadius: "6px",
                        },
                        "&::-webkit-scrollbar-thumb": {
                            backgroundColor: `${alpha(theme.palette.primary.main, 0.6)} !important`,
                            borderRadius: "6px",
                            "&:hover": {
                                backgroundColor: `${theme.palette.primary.main} !important`,
                            },
                        },
                    }}
                >
                    {/* Inner wrapper to ensure header and rows have same width - matching EndlessScrollDataGrid */}
                    <Box
                        ref={bodyContentRef}
                        sx={{
                            display: "block",
                            width: "100%", // Match header width for alignment
                            minWidth: "100%", // Ensure minimum matches header
                            boxSizing: "border-box",
                            padding: 0,
                            margin: 0,
                        }}
                    >
                        {rows.length === 0 &&
                            !isLoading &&
                            hasCompletedInitialFetchRef.current ? (
                            <EmptyState
                                noRowsMessage={noRowsMessage}
                                noRowsDescription={noRowsDescription}
                                language={language}
                                height={responsiveHeights}
                            />
                        ) : (
                            renderVirtualItems()
                        )}
                    </Box>

                    {/* Loading more indicator */}
                    {isLoadingMore && (
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                py: { xs: 1, sm: 2 },
                                borderTop: `1px solid ${theme.palette.divider}`,
                                backgroundColor: theme.palette.action.hover,
                            }}
                        >
                            <CircularProgress color="primary" size={24} />
                        </Box>
                    )}
                </Box>
            </Box>

            {/* Export Dialog */}
            <ExportDialog
                isOpen={isExportDialogOpen}
                onClose={handleExportDialogClose}
                onExport={handleExport}
                columns={columns}
                columnVisibilityModel={columnVisibilityModel}
                isLoading={isExporting}
                contextInfo={exportContextInfo}
            />
        </Box>
    );
};

export default EndlessScrollDataGrid;
