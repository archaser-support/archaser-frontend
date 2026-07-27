import {
    GridColDef,
    GridSortModel,
    GridRenderCellParams,
} from "@mui/x-data-grid";
import { ExportFormat } from "../../utility/exportToExcel";

/**
 * Comprehensive type definitions for EndlessScrollDataGrid and related components
 */

// ============================================================================
// Grid Configuration Types
// ============================================================================

/**
 * Column width configuration for a single column
 */
export interface ColumnWidthConfig {
    /** Effective width to use (resized > column.width > minWidth > 150) */
    width: number;
    /** Whether this column has been manually resized */
    hasBeenResized: boolean;
    /** Whether this is the last column */
    isLastColumn: boolean;
    /** Flex value to use (1 for flex, undefined for fixed width) */
    shouldUseFlex: number | undefined;
    /** Minimum width for this column */
    minWidth: number;
}

/**
 * Unified column state for resizing
 */
export interface ColumnState {
    /** Widths of columns that have been resized */
    widths: Record<string, number>;
    /** Whether a column is currently being resized */
    isResizing: boolean;
    /** Field name of the column being resized */
    resizeColumn: string | null;
    /** X position where resize started */
    resizeStartX: number;
    /** Initial width when resize started */
    initialWidth: number;
}

/**
 * Grid refs collection
 */
export interface GridRefs {
    /** Main container ref */
    container: React.RefObject<HTMLDivElement>;
    /** Header content ref */
    header: React.RefObject<HTMLDivElement>;
    /** Body content ref */
    body: React.RefObject<HTMLDivElement>;
    /** Highlighted row ref */
    highlightedRow: React.RefObject<HTMLDivElement | null>;
    /** Wrapper ref for viewport calculations */
    wrapper: React.RefObject<HTMLDivElement>;
}

/**
 * Sync state for column width synchronization
 */
export interface SyncState {
    /** Whether sync is currently in progress */
    inProgress: boolean;
    /** Last sync key to prevent duplicate syncs */
    lastSyncKey: string;
    /** Whether initial sync has been completed */
    initialSyncDone: boolean;
}

// ============================================================================
// Component Props Types
// ============================================================================

/**
 * Props for EndlessScrollDataGrid main component
 */
export interface EndlessScrollDataGridProps<T = any> {
    /** Column definitions */
    columns: GridColDef[];
    /** Data rows */
    rows: T[];
    /** Loading state */
    isLoading?: boolean;
    /** Whether columns are resizable */
    resizableColumns?: boolean;
    /** Sort model */
    sortModel?: GridSortModel;
    /** Sort change handler */
    onSort?: (field: string) => void;
    /** Row click handler */
    onRowClick?: (row: T) => void;
    /** Highlighted row ID */
    highlightedRowId?: string | number;
    /** Search term for highlighting */
    searchTerm?: string;
    /** Language for RTL/LTR support */
    language?: string;
    /** Container height configuration */
    height?: { xs: number; sm: number; md: number };
    /** Number of visible rows */
    visibleRows?: number;
    /** Whether to fill viewport */
    fillViewport?: boolean;
    /** Whether to hide toolbar */
    hideToolbar?: boolean;
    /** Custom cell renderer */
    onRenderCell?: (params: GridRenderCellParams) => React.ReactNode;
    /** Empty state message */
    noRowsMessage?: string;
    /** Empty state description */
    noRowsDescription?: string;
    /** Export configuration */
    exportConfig?: {
        filename?: string;
        format?: ExportFormat;
        systemReport?: SystemReport;
    };
    /** Query key for infinite scroll */
    queryKey?: any[];
    /** Query function for infinite scroll */
    queryFn?: (
        page: number
    ) => Promise<{ data: T[]; totalRecords: number; hasMore: boolean }>;
    /** Page size for infinite scroll */
    pageSize?: number;
    /** Stale time for queries */
    staleTime?: number;
    /** Garbage collection time for queries */
    gcTime?: number;
}

/**
 * Props for DataGridHeader component
 */
export interface DataGridHeaderProps {
    /** Enhanced columns with highlighting */
    columns: GridColDef[];
    /** Sort model */
    sortModel?: GridSortModel;
    /** Sort change handler */
    onSort?: (field: string) => void;
    /** Column widths */
    columnWidths: Record<string, number>;
    /** Whether columns are resizable */
    resizableColumns: boolean;
    /** Resize start handler */
    onResizeStart: (e: React.MouseEvent, columnField: string) => void;
    /** Auto resize handler */
    onAutoResize: (columnField: string) => void;
    /** Language for RTL/LTR */
    language: string;
    /** Header content ref */
    headerContentRef: React.RefObject<HTMLDivElement>;
    /** Resize handle click ref */
    resizeHandleClickRef: React.MutableRefObject<{
        field: string;
        timestamp: number;
    } | null>;
}

/**
 * Props for DataGridRow component
 */
export interface DataGridRowProps {
    /** Row data */
    row: any;
    /** Row index */
    index: number;
    /** Actual index in full dataset */
    actualIndex: number;
    /** Column definitions */
    columns: GridColDef[];
    /** Column widths */
    columnWidths: Record<string, number>;
    /** Whether row is highlighted */
    isHighlighted: boolean;
    /** Whether row is selected (for multi-select) */
    isSelected?: boolean;
    /** Language for RTL/LTR */
    language: string;
    /** Row click handler - receives row and event for multi-select support */
    onRowClick?: (row: any, e?: React.MouseEvent<HTMLDivElement>) => void;
    /** Highlighted row ref */
    highlightedRowRef: React.RefObject<HTMLDivElement | null>;
    /** Custom cell renderer */
    onRenderCell?: (params: GridRenderCellParams) => React.ReactNode;
}

/**
 * Props for DataGridCell component
 */
export interface DataGridCellProps {
    /** Column definition */
    column: GridColDef;
    /** Cell value */
    value: any;
    /** Row data */
    row: any;
    /** Width configuration */
    widthConfig: ColumnWidthConfig;
    /** Whether this is the last column */
    isLastColumn: boolean;
    /** Column index */
    colIndex: number;
    /** Language for RTL/LTR */
    language: string;
    /** Custom cell renderer */
    onRenderCell?: (params: GridRenderCellParams) => React.ReactNode;
}

/**
 * Props for TruncatedCell component
 */
export interface TruncatedCellProps {
    /** Cell content */
    content: React.ReactNode;
    /** Tooltip text to show when truncated */
    tooltipText: string;
}

/**
 * Props for EmptyState component
 */
export interface EmptyStateProps {
    /** Empty state message */
    noRowsMessage?: string;
    /** Empty state description */
    noRowsDescription?: string;
    /** Language for RTL/LTR */
    language: string;
    /** Height configuration */
    height: { xs: string; sm: string; md: string };
}

/**
 * Props for ResizeHandle component
 */
export interface ResizeHandleProps {
    /** Column field name */
    columnField: string;
    /** Resize start handler */
    onResizeStart: (e: React.MouseEvent) => void;
    /** Auto resize handler */
    onAutoResize: () => void;
    /** Language for RTL/LTR */
    language: string;
    /** Resize handle click ref */
    resizeHandleClickRef: React.MutableRefObject<{
        field: string;
        timestamp: number;
    } | null>;
}

/**
 * Props for HighlightText component
 */
export interface HighlightTextProps {
    /** Text to highlight */
    text: string;
    /** Search term to highlight */
    searchTerm: string;
    /** Custom highlight style */
    highlightStyle?: React.CSSProperties;
    /** Language for RTL/LTR */
    language?: string;
}

// ============================================================================
// Hook Types
// ============================================================================

/**
 * Options for useColumnResizing hook
 */
export interface UseColumnResizingOptions {
    /** Whether columns are resizable */
    resizableColumns: boolean;
    /** Column definitions */
    columns: GridColDef[];
    /** Data rows */
    rows: any[];
    /** Enhanced columns with highlighting */
    enhancedColumns: GridColDef[];
    /** Language for RTL/LTR */
    language: string;
    /** Sync callback after resize */
    onSyncAfterResize?: () => void;
    /** Sync callback during resize (for real-time updates) */
    onSyncDuringResize?: () => void;
}

/**
 * Return type for useColumnResizing hook
 */
export interface UseColumnResizingReturn {
    /** Column widths */
    columnWidths: Record<string, number>;
    /** Whether currently resizing */
    isResizing: boolean;
    /** Resize handle click ref */
    resizeHandleClickRef: React.MutableRefObject<{
        field: string;
        timestamp: number;
    } | null>;
    /** Resize start handler */
    handleResizeStart: (e: React.MouseEvent, columnField: string) => void;
    /** Auto resize handler */
    handleAutoResize: (columnField: string) => void;
    /** Set column widths */
    setColumnWidths: React.Dispatch<
        React.SetStateAction<Record<string, number>>
    >;
}

/**
 * Options for useColumnWidthSync hook
 */
export interface UseColumnWidthSyncOptions {
    /** Enhanced columns */
    enhancedColumns: GridColDef[];
    /** Column widths */
    columnWidths: Record<string, number>;
    /** Whether currently resizing */
    isResizing: boolean;
    /** Data rows */
    rows: any[];
    /** Header ref */
    headerRef: React.RefObject<HTMLDivElement>;
    /** Body ref */
    bodyRef: React.RefObject<HTMLDivElement>;
    /** Loading state */
    isLoading?: boolean;
    /** Visible range for virtual scrolling - syncs when this changes */
    visibleRange?: { startIndex: number; endIndex: number };
}

/**
 * Return type for useColumnWidthSync hook
 */
export interface UseColumnWidthSyncReturn {
    /** Sync function - pass true to clear cache, second true to forceSync */
    syncColumnWidths: (forceClearCache?: boolean, forceSync?: boolean) => void;
    /** Sync function ref */
    syncColumnWidthsRef: React.MutableRefObject<(() => void) | undefined>;
    /** Set scrolling state - call with true when scrolling starts, false when it stops */
    setScrolling: (scrolling: boolean) => void;
}

/**
 * Options for useVirtualScroll hook
 */
export interface UseVirtualScrollOptions {
    /** Data rows */
    rows: any[];
    /** Container height */
    containerHeight: number;
    /** Item height */
    itemHeight: number;
    /** Overscan count */
    overscan?: number;
    /** Total number of records (for scrollbar calculation) */
    totalRecords?: number; // Add this
}

/**
 * Virtual scroll state
 */
export interface VirtualScrollState {
    /** Scroll position */
    scrollTop: number;
    /** Container height */
    containerHeight: number;
    /** Item height */
    itemHeight: number;
    /** Total items */
    totalItems: number;
}

/**
 * Virtual scroll metrics
 */
export interface VirtualScrollMetrics {
    /** Start index of visible items */
    startIndex: number;
    /** End index of visible items */
    endIndex: number;
    /** Visible items */
    visibleItems: any[];
    /** Y offset for positioning */
    offsetY: number;
    /** Total height of all items */
    totalHeight: number;
    /** Number of visible items */
    visibleCount: number;
}

/**
 * Return type for useVirtualScroll hook
 */
export interface UseVirtualScrollReturn {
    /** Scroll state */
    scrollState: VirtualScrollState;
    /** Set scroll state */
    setScrollState: React.Dispatch<React.SetStateAction<VirtualScrollState>>;
    /** Virtual metrics */
    virtualMetrics: VirtualScrollMetrics;
}

/**
 * Options for useViewportHeight hook
 */
export interface UseViewportHeightOptions {
    /** Whether to fill viewport */
    fillViewport: boolean;
    /** Whether to hide toolbar */
    hideToolbar: boolean;
    /** Loading state */
    isLoading: boolean;
    /** Wrapper ref */
    wrapperRef: React.RefObject<HTMLDivElement>;
    /** When this value changes, viewport height is recalculated (e.g. when content above grid loads) */
    viewportRecalcDependency?: unknown;
}

/**
 * Options for useVirtualInfiniteScroll hook
 */
export interface UseVirtualInfiniteScrollOptions<T> {
    /** Query key */
    queryKey: any[];
    /** Query function */
    queryFn: (
        page: number
    ) => Promise<{
        data: T[];
        totalRecords: number;
        hasMore: boolean;
        aggregationTotals?: Record<string, number>;
        formulaWarnings?: Array<{
            formulaId: string;
            label: string;
            invalidCount: number;
        }>;
    }>;
    /** Page size (deprecated) */
    pageSize?: number;
    /** Stale time */
    staleTime?: number;
    /** Garbage collection time */
    gcTime?: number;
}

/**
 * Return type for useVirtualInfiniteScroll hook
 */
export interface UseVirtualInfiniteScrollReturn<T> {
    /** All loaded data */
    data: T[];
    /** Total records */
    totalRecords: number;
    /** From first page of grouped report execute — full-dataset COUNT sums for headers */
    aggregationTotals?: Record<string, number>;
    /** Per-formula invalid row/group counts from report execution */
    formulaWarnings?: Array<{
        formulaId: string;
        label: string;
        invalidCount: number;
    }>;
    /** Whether currently loading */
    isLoading: boolean;
    /** Whether loading more */
    isLoadingMore: boolean;
    /** Whether more data is available */
    hasMore: boolean;
    /** Error if any */
    error: Error | null;
    /** Load more function */
    loadMore: () => void;
    /** Reset function */
    reset: () => void;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * System report configuration
 */
export interface SystemReport {
    name: string;
    description?: string;
}

/**
 * Height options for dynamic height calculation
 */
export interface HeightOptions {
    /** Data rows */
    rows: any[];
    /** Height configuration */
    height?: { xs: number; sm: number; md: number };
    /** Number of visible rows */
    visibleRows?: number;
    /** Whether to fill viewport */
    fillViewport: boolean;
    /** Viewport height */
    viewportHeight: number | null;
}

/**
 * Responsive height configuration
 */
export interface ResponsiveHeight {
    xs: string;
    sm: string;
    md: string;
}

/**
 * Visible range for virtual scrolling
 */
export interface VisibleRange {
    startIndex: number;
    endIndex: number;
}

/**
 * Resize handle click info
 */
export interface ResizeHandleClickInfo {
    field: string;
    timestamp: number;
}
