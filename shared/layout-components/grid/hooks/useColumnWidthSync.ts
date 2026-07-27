import { GridColDef } from "@mui/x-data-grid";
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
} from "react";
import { UseColumnWidthSyncOptions, UseColumnWidthSyncReturn } from "../types";
import {
    calculateColumnWidth,
    hasColumnBeenResized,
} from "../utils/columnUtils";
import { debounce } from "../utils/debounce";
import { ITEM_HEIGHT } from "../utils/heightUtils";

// Constants
const SYNC_CONSTANTS = {
    PIXEL_DIFF_THRESHOLD: 2,
    ALIGNMENT_THRESHOLD: 1,
    SCROLL_SYNC_DELAY: 150,
    NEW_ROW_SYNC_DELAY: 50,
    DEBOUNCE_DELAY: 16,
    MAX_RECURSION_DEPTH: 10,
    HEIGHT_TOLERANCE: 1,
} as const;

// Types
interface CellStyleConfig {
    element: HTMLElement;
    targetWidth: number;
    currentWidth: number;
    isActionsColumn: boolean;
    shouldAllowFlex: boolean;
    forceSync: boolean;
    useImportant?: boolean;
}

interface WidthsMapResult {
    widthsMap: Map<number, number>;
    needsSync: boolean;
}

// Helper Functions
const applyFixedWidthStyles = (
    element: HTMLElement,
    width: number,
    useImportant: boolean = true
) => {
    // CRITICAL: Never apply styles to row elements - only apply to cells
    // Row elements have data-row-index attribute and should maintain width: 100%
    if (element.hasAttribute('data-row-index') || element.hasAttribute('data-row-id')) {
        // This is a row element, not a cell - skip styling
        return;
    }

    const priority = useImportant ? "important" : "";

    // Remove any conflicting styles first
    if (useImportant) {
        // Clear any existing width/flex styles that might conflict
        element.style.removeProperty("width");
        element.style.removeProperty("max-width");
        element.style.removeProperty("min-width");
        element.style.removeProperty("flex");
        element.style.removeProperty("flex-shrink");
        element.style.removeProperty("flex-grow");
        element.style.removeProperty("flex-basis");
    }

    element.style.setProperty("width", `${width}px`, priority);
    element.style.setProperty("max-width", `${width}px`, priority);
    element.style.setProperty("min-width", `${width}px`, priority);
    element.style.setProperty("flex", "0 0 auto", priority);
    element.style.setProperty("flex-shrink", "0", priority);
    element.style.setProperty("flex-grow", "0", priority);
    element.style.setProperty("flex-basis", "auto", priority);
};

const applyFlexStyles = (
    element: HTMLElement,
    minWidth: number,
    useImportant: boolean = true
) => {
    // CRITICAL: Never apply styles to row elements - only apply to cells
    // Row elements have data-row-index attribute and should maintain width: 100%
    if (element.hasAttribute('data-row-index') || element.hasAttribute('data-row-id')) {
        // This is a row element, not a cell - skip styling
        return;
    }

    const priority = useImportant ? "important" : "";

    // Remove any conflicting styles first
    if (useImportant) {
        // Clear any existing width/flex styles that might conflict
        element.style.removeProperty("width");
        element.style.removeProperty("max-width");
        element.style.removeProperty("min-width");
        element.style.removeProperty("flex");
        element.style.removeProperty("flex-shrink");
        element.style.removeProperty("flex-grow");
        element.style.removeProperty("flex-basis");
    }

    // For flex columns, we want equal distribution
    // Use flex-basis: 0 to ensure equal starting point, then grow equally
    // Remove width entirely - let flexbox calculate it
    element.style.removeProperty("width");
    element.style.setProperty("width", "0", priority); // Set to 0 with !important to override MUI
    element.style.setProperty("max-width", "none", priority);
    // For flex columns, set min-width to 0 to allow full flex distribution
    // The column will still respect content width due to flex-shrink: 1
    element.style.setProperty("min-width", "0", priority); // Allow flex to shrink below content width
    element.style.setProperty("flex", "1 1 0%", priority);
    element.style.setProperty("flex-shrink", "1", priority);
    element.style.setProperty("flex-grow", "1", priority);
    element.style.setProperty("flex-basis", "0%", priority);
    // Ensure content doesn't force column to expand beyond flex distribution
    // This prevents columns with wide content from taking more than their fair share
    element.style.setProperty("overflow", "hidden", priority);
    element.style.setProperty("text-overflow", "ellipsis", priority);
};

const applyCellStyles = (config: CellStyleConfig) => {
    const {
        element,
        targetWidth,
        currentWidth,
        isActionsColumn,
        shouldAllowFlex,
        forceSync,
        useImportant = true,
    } = config;

    // CRITICAL: Never apply styles to row elements - only apply to cells
    // Row elements have data-row-index attribute and should maintain width: 100%
    if (element.hasAttribute('data-row-index') || element.hasAttribute('data-row-id')) {
        // This is a row element, not a cell - skip styling
        return;
    }

    const diff = Math.abs(currentWidth - targetWidth);
    const shouldApply = forceSync || diff > SYNC_CONSTANTS.PIXEL_DIFF_THRESHOLD;

    // Always apply styles when forceSync is true, or when there's a significant difference
    // This ensures Material-UI sx styles don't override our inline styles
    // For flex columns, always apply styles to override Material-UI generated classes
    if (shouldApply || forceSync || shouldAllowFlex) {
        if (isActionsColumn) {
            applyFixedWidthStyles(element, targetWidth, useImportant);
        } else if (shouldAllowFlex) {
            applyFlexStyles(element, targetWidth, useImportant);
        } else {
            applyFixedWidthStyles(element, targetWidth, useImportant);
        }
    } else {
        // Ensure correct flex settings even if diff is small
        const computedStyle = window.getComputedStyle(element);
        const computedWidth = parseFloat(computedStyle.width);
        const currentFlex = element.style.flex;
        const computedFlex = computedStyle.flex;

        if (isActionsColumn) {
            if (
                element.style.width !== `${targetWidth}px` ||
                element.style.flex !== "0 0 auto" ||
                element.style.flexGrow !== "0" ||
                computedWidth !== targetWidth
            ) {
                applyFixedWidthStyles(element, targetWidth, true); // Use important to override MUI styles
            }
        } else if (shouldAllowFlex) {
            // For flex columns, always ensure flex styles are correct
            const expectedFlex = "1 1 0%";
            const minWidthMatches =
                parseFloat(computedStyle.minWidth) === targetWidth;

            // Apply if flex doesn't match, or if min-width doesn't match, or if width is way off
            if (
                computedFlex !== expectedFlex ||
                currentFlex !== expectedFlex ||
                !minWidthMatches ||
                computedWidth > targetWidth * 2
            ) {
                applyFlexStyles(element, targetWidth, true); // Use important to override MUI styles
            }
        } else {
            // For fixed width columns, ensure fixed width is set
            // Apply if width doesn't match, or flex is wrong, or computed width is way off
            if (
                computedWidth > targetWidth * 2 || // Width is more than 2x target (likely full width)
                element.style.width !== `${targetWidth}px` ||
                element.style.flex !== "0 0 auto" ||
                element.style.flexGrow !== "0" ||
                Math.abs(computedWidth - targetWidth) > 1
            ) {
                applyFixedWidthStyles(element, targetWidth, true); // Use important to override MUI styles
            }
        }
    }
};

// Removed findExpandableColumnIndex - no longer needed since all columns have flex: 1

const createRowFinder = (headerCellCount: number) => {
    const findFirstRow = (
        element: Element | null,
        depth = 0
    ): HTMLElement | null => {
        if (!element || depth > SYNC_CONSTANTS.MAX_RECURSION_DEPTH) {
            return null;
        }

        if (element instanceof HTMLElement) {
            const style = window.getComputedStyle(element);
            const children = Array.from(element.children);

            const isFlexRow = style.display === "flex";
            const heightMatch =
                Math.abs(parseFloat(style.height) - ITEM_HEIGHT) <
                SYNC_CONSTANTS.HEIGHT_TOLERANCE;
            const correctCellCount = children.length === headerCellCount;

            if (
                isFlexRow &&
                heightMatch &&
                correctCellCount &&
                children.length > 0
            ) {
                return element;
            }
        }

        for (const child of Array.from(element?.children || [])) {
            const found = findFirstRow(child, depth + 1);
            if (found) return found;
        }

        return null;
    };

    const findAllRows = (element: Element): HTMLElement[] => {
        const rows: HTMLElement[] = [];
        const children = Array.from(element.children);

        if (children.length === headerCellCount && children.length > 0) {
            rows.push(element as HTMLElement);
        }

        for (const child of children) {
            rows.push(...findAllRows(child));
        }

        return rows;
    };

    return { findFirstRow, findAllRows };
};

const setupContainers = (
    header: HTMLElement | null,
    body: HTMLElement | null
) => {
    if (header) {
        header.style.setProperty("width", "100%", "important");
        header.style.setProperty("max-width", "100%", "important");
        // Ensure no padding/margin that could affect alignment
        header.style.setProperty("padding-left", "0", "important");
        header.style.setProperty("padding-right", "0", "important");
        header.style.setProperty("margin-left", "0", "important");
        header.style.setProperty("margin-right", "0", "important");
        header.style.setProperty("box-sizing", "border-box", "important");

        // Check if header's parent (header wrapper) has padding-right for scrollbar
        // This can cause misalignment if the body container doesn't account for it
        const headerParent = header.parentElement;
        if (headerParent) {
            const parentStyle = window.getComputedStyle(headerParent);
            const parentPaddingRight =
                parseFloat(parentStyle.paddingRight) || 0;
            const parentPaddingLeft = parseFloat(parentStyle.paddingLeft) || 0;

            // If parent has padding-right (for scrollbar), we need to account for it
            // by ensuring the header container itself doesn't have offset
            if (parentPaddingRight > 0 || parentPaddingLeft > 0) {
                // The header wrapper's padding is intentional (for scrollbar alignment)
                // But we need to ensure the header container aligns with body container
                // by checking if body's parent has matching padding
            }
        }
    }
    if (body) {
        body.style.setProperty("width", "100%", "important");
        body.style.setProperty("max-width", "100%", "important");
        // Ensure no padding/margin that could affect alignment
        body.style.setProperty("padding-left", "0", "important");
        body.style.setProperty("padding-right", "0", "important");
        body.style.setProperty("margin-left", "0", "important");
        body.style.setProperty("margin-right", "0", "important");
        body.style.setProperty("box-sizing", "border-box", "important");
    }
};

const alignContainers = (
    header: HTMLElement | null,
    body: HTMLElement | null
) => {
    if (!header || !body) return;

    // Get the first cells to check alignment
    const headerCells = Array.from(header.children) as HTMLElement[];
    if (headerCells.length === 0) return;

    // Find first body row by looking for flex containers with cells
    const bodyChildren = Array.from(body.children) as HTMLElement[];
    const firstBodyRow = bodyChildren.find((child) => {
        const cells = Array.from(child.children) as HTMLElement[];
        return cells.length === headerCells.length;
    });

    if (!firstBodyRow) return;

    const firstBodyCells = Array.from(firstBodyRow.children) as HTMLElement[];
    if (firstBodyCells.length === 0) return;

    const firstHeaderCell = headerCells[0];
    const firstBodyCell = firstBodyCells[0];

    const headerRect = firstHeaderCell.getBoundingClientRect();
    const bodyRect = firstBodyCell.getBoundingClientRect();
    const leftDiff = bodyRect.left - headerRect.left;

    // Fix alignment if there's a significant horizontal offset
    if (Math.abs(leftDiff) > 1) {
        // Get the header container's left position relative to its parent
        const headerContainerRect = header.getBoundingClientRect();
        const bodyContainerRect = body.getBoundingClientRect();

        // Calculate the offset needed to align the body with the header
        const containerLeftDiff =
            bodyContainerRect.left - headerContainerRect.left;

        // If containers are misaligned, try to fix by adjusting body's parent container
        // First, check if body has a scrollable parent that might have padding
        let scrollableParent = body.parentElement;
        while (scrollableParent && scrollableParent !== document.body) {
            const parentStyle = window.getComputedStyle(scrollableParent);
            const hasScrollbar =
                scrollableParent.scrollHeight > scrollableParent.clientHeight;

            // If we find a scrollable container, check if it has padding that's causing misalignment
            if (
                hasScrollbar ||
                parentStyle.overflowY === "auto" ||
                parentStyle.overflowY === "scroll"
            ) {
                const parentRect = scrollableParent.getBoundingClientRect();
                const parentPaddingLeft =
                    parseFloat(parentStyle.paddingLeft) || 0;

                // If the scrollable parent has padding, that might be causing the issue
                // But we can't modify it here as it's controlled by the component
                // Instead, we'll ensure the body container itself is aligned
                break;
            }

            scrollableParent = scrollableParent.parentElement;
        }

        // Ensure body container matches header container's left position
        // We can't directly set left position on body (it's in flow), but we can ensure
        // both containers have the same box-sizing and no margin/padding
    }
};

const calculateColumnWidthsMap = (
    headerCells: HTMLElement[],
    bodyCells: HTMLElement[],
    enhancedColumns: GridColDef[],
    columnWidths: Record<string, number>
): WidthsMapResult => {
    const widthsMap = new Map<number, number>();
    let needsSync = false;

    headerCells.forEach((headerCell, index) => {
        if (bodyCells[index] && enhancedColumns[index]) {
            const column = enhancedColumns[index];
            const storedWidth = calculateColumnWidth(column, columnWidths);
            const columnHasFlex = column.flex !== undefined && column.flex > 0;
            const hasBeenResized = hasColumnBeenResized(column, columnWidths);

            // Check if this is the first data column (after row number and possibly checkbox)
            const isFirstDataColumn =
                column.field !== "__rowNumber" &&
                column.field !== "checkbox" &&
                column.field !== "actions" &&
                (index > 0 && enhancedColumns[index - 1]?.field === "__rowNumber" ||
                    index > 1 &&
                    enhancedColumns[index - 2]?.field === "checkbox" &&
                    enhancedColumns[index - 1]?.field === "__rowNumber");

            // First data column should be treated as fixed width (not flex)
            const effectiveColumnHasFlex = columnHasFlex && !isFirstDataColumn;

            // Apply prioritized width for first data column (same logic as getColumnWidthConfig)
            // BUT respect explicit width from report config (if column.width is set, use it)
            const firstDataColumnMinWidth = 250;
            const hasExplicitWidth = column.width !== undefined && column.width !== null;
            const effectiveStoredWidth = isFirstDataColumn && !hasBeenResized && !hasExplicitWidth
                ? Math.max(storedWidth, firstDataColumnMinWidth)
                : storedWidth;


            const headerRect = headerCell.getBoundingClientRect();
            const bodyRect = bodyCells[index].getBoundingClientRect();
            const currentHeaderWidth = headerRect.width;
            const currentBodyWidth = bodyRect.width;

            // For flex columns, check if flex styles match instead of width
            // For fixed columns, check width alignment
            const headerFlex = window.getComputedStyle(headerCell).flex;
            const bodyFlex = window.getComputedStyle(bodyCells[index]).flex;
            const headerFlexGrow = window.getComputedStyle(headerCell).flexGrow;
            const bodyFlexGrow = window.getComputedStyle(
                bodyCells[index]
            ).flexGrow;

            const headerDiff = Math.abs(currentHeaderWidth - effectiveStoredWidth);
            const bodyDiff = Math.abs(currentBodyWidth - effectiveStoredWidth);
            const alignmentDiff = Math.abs(
                currentHeaderWidth - currentBodyWidth
            );

            // Check border position alignment (left edge of cells)
            const headerLeft = headerRect.left;
            const bodyLeft = bodyRect.left;
            const borderPositionDiff = Math.abs(headerLeft - bodyLeft);

            // For flex columns: check if flex styles match, not width
            // For fixed columns: check width alignment
            const flexStylesMismatch =
                effectiveColumnHasFlex &&
                !hasBeenResized &&
                (headerFlex !== bodyFlex ||
                    headerFlexGrow !== bodyFlexGrow ||
                    headerCell.style.flex !== bodyCells[index].style.flex);

            // Log only columns with significant misalignment issues
            const hasMisalignment =
                alignmentDiff > SYNC_CONSTANTS.ALIGNMENT_THRESHOLD;

            // For flex columns, allow larger threshold (5px) since they can have rounding differences
            // For fixed columns, use smaller threshold (1px)
            const threshold =
                effectiveColumnHasFlex && !hasBeenResized
                    ? 5
                    : SYNC_CONSTANTS.ALIGNMENT_THRESHOLD;
            const significantMisalignment = alignmentDiff > threshold;

            // For flex columns: sync if flex styles don't match (allow 5px width difference for rounding)
            // For fixed columns: sync if widths don't match (use 1px threshold)
            // Also sync if border positions don't align (indicates container misalignment)
            if (effectiveColumnHasFlex && !hasBeenResized) {
                if (
                    flexStylesMismatch ||
                    alignmentDiff > 5 ||
                    borderPositionDiff > 1
                ) {
                    needsSync = true;
                }
            } else {
                if (
                    headerDiff > SYNC_CONSTANTS.ALIGNMENT_THRESHOLD ||
                    bodyDiff > SYNC_CONSTANTS.ALIGNMENT_THRESHOLD ||
                    alignmentDiff > SYNC_CONSTANTS.ALIGNMENT_THRESHOLD ||
                    borderPositionDiff > 1
                ) {
                    needsSync = true;
                }
            }

            // For flex columns, use the actual header width as the target to ensure alignment
            // For fixed columns, use the effective stored width (prioritized for first data column)
            // First data column should use effectiveStoredWidth (250px if not resized)
            const targetWidth =
                effectiveColumnHasFlex && !hasBeenResized
                    ? currentHeaderWidth // Use header's actual width for flex columns
                    : effectiveStoredWidth; // Use effective stored width for fixed columns (250px for first data column)

            widthsMap.set(index, targetWidth);
        }
    });

    return { widthsMap, needsSync };
};

const createColumnsKey = (
    enhancedColumns: GridColDef[],
    columnWidths: Record<string, number>
): string => {
    return JSON.stringify({
        fields: enhancedColumns.map((c) => c.field),
        widths: enhancedColumns.map((c) =>
            calculateColumnWidth(c, columnWidths)
        ),
    });
};

const applyStylesToCells = (
    cells: HTMLElement[],
    widthsMap: Map<number, number>,
    enhancedColumns: GridColDef[],
    columnWidths: Record<string, number>,
    forceSync: boolean,
    isHeader: boolean = false,
    headerPaddingLeft: number = 0,
    firstHeaderStyle: CSSStyleDeclaration | null = null
) => {
    cells.forEach((cell, index) => {
        const targetWidth = widthsMap.get(index);
        if (!targetWidth || !enhancedColumns[index]) return;

        const column = enhancedColumns[index];
        const isLastColumn = index === enhancedColumns.length - 1;
        const isActionsColumn = column.field === "actions";
        const isRowNumberColumn = column.field === "__rowNumber";
        const isCheckboxColumn = column.field === "checkbox";

        // Check if this is the first data column (after row number and possibly checkbox)
        const isFirstDataColumn =
            !isRowNumberColumn &&
            !isCheckboxColumn &&
            !isActionsColumn &&
            (index > 0 && enhancedColumns[index - 1]?.field === "__rowNumber" ||
                index > 1 &&
                enhancedColumns[index - 2]?.field === "checkbox" &&
                enhancedColumns[index - 1]?.field === "__rowNumber");

        const hasBeenResized = hasColumnBeenResized(column, columnWidths);

        // Check if column definition has flex property (respect column's flex setting)
        const columnHasFlex = column.flex !== undefined && column.flex > 0;
        // Allow flex if: column has flex in definition (all columns from viewColumnGenerator have flex: 1)
        // BUT NOT for row number column (it should always be fixed width)
        // BUT NOT for first data column (prioritize it with fixed width)
        // BUT NOT for manually resized columns (user preference)
        const shouldAllowFlex =
            !isActionsColumn &&
            !isRowNumberColumn &&
            !isFirstDataColumn && // Don't allow flex for first data column (prioritize it)
            !hasBeenResized &&
            columnHasFlex; // All columns have flex: 1, so this will be true for all data columns


        const currentWidth = cell.getBoundingClientRect().width;

        // For row number column, ALWAYS use fixed width styles (never flex)
        // This is critical - row number must be fixed width to prevent misalignment
        const effectiveIsActionsColumn = isActionsColumn || isRowNumberColumn;
        const effectiveShouldAllowFlex = isRowNumberColumn
            ? false
            : shouldAllowFlex;

        // For flex columns, apply styles both synchronously and in requestAnimationFrame
        // This ensures they override Material-UI classes that might be applied later
        if (effectiveShouldAllowFlex) {
            // Apply synchronously first
            applyCellStyles({
                element: cell,
                targetWidth,
                currentWidth,
                isActionsColumn: effectiveIsActionsColumn,
                shouldAllowFlex: effectiveShouldAllowFlex,
                forceSync: true, // Always force sync for flex columns to override MUI classes
            });
            // Then apply again in requestAnimationFrame to catch any late Material-UI style applications
            requestAnimationFrame(() => {
                applyCellStyles({
                    element: cell,
                    targetWidth,
                    currentWidth: cell.getBoundingClientRect().width,
                    isActionsColumn: effectiveIsActionsColumn,
                    shouldAllowFlex: effectiveShouldAllowFlex,
                    forceSync: true, // Always force sync for flex columns to override MUI classes
                });
            });
        } else {
            applyCellStyles({
                element: cell,
                targetWidth,
                currentWidth,
                isActionsColumn: effectiveIsActionsColumn,
                shouldAllowFlex: effectiveShouldAllowFlex,
                forceSync: forceSync || isRowNumberColumn, // Always force sync for row number
            });
        }


        // Ensure cells align by removing ALL padding/margin/border from first cell
        // The first cell must start exactly at the row's left edge (no offset)
        if (index === 0) {
            // First cell (row number): CRITICAL - ZERO padding/margin/border for perfect alignment
            // Don't modify border-top or border-bottom - let the row's borders show through
            cell.style.setProperty("padding-left", "0", "important");
            cell.style.setProperty("padding-right", "0", "important");
            cell.style.setProperty("border-left", "none", "important");
            cell.style.setProperty("border-right", "none", "important");
            // Don't set border-top or border-bottom - preserve row's borders
            cell.style.setProperty("margin-left", "0", "important");
            cell.style.setProperty("margin-right", "0", "important");
        }
        // Don't modify borders on other cells - they need their divider borders
    });
};

export const useColumnWidthSync = ({
    enhancedColumns,
    columnWidths,
    isResizing,
    rows,
    headerRef,
    bodyRef,
    isLoading = false,
    visibleRange,
}: UseColumnWidthSyncOptions): UseColumnWidthSyncReturn => {
    const syncInProgressRef = useRef(false);
    const lastSyncColumnsRef = useRef<string>("");
    const initialSyncDoneRef = useRef(false);
    const lastVisibleRangeRef = useRef<{
        startIndex: number;
        endIndex: number;
    } | null>(null);
    const syncColumnWidthsRef = useRef<(() => void) | undefined>();
    const lastRowCountRef = useRef<number>(0);
    const isScrollingRef = useRef(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Memoize columns key for performance
    const columnsKey = useMemo(
        () => createColumnsKey(enhancedColumns, columnWidths),
        [enhancedColumns, columnWidths]
    );

    // Internal sync function (actual implementation)
    const syncColumnWidthsInternal = useCallback(
        (forceSync = false, forceClearCache = false) => {
            // Skip sync during active scrolling (unless forced) to prevent performance issues
            if (!forceSync && isScrollingRef.current) {
                return;
            }

            // Skip if already synced for this column configuration
            if (
                !forceSync &&
                !isResizing &&
                lastSyncColumnsRef.current === columnsKey
            ) {
                return;
            }

            if (syncInProgressRef.current) {
                return; // Prevent concurrent syncs
            }

            if (!headerRef.current || !bodyRef.current) {
                return;
            }

            syncInProgressRef.current = true;

            // Batch all DOM operations in requestAnimationFrame to prevent jitter
            requestAnimationFrame(() => {
                try {
                    // Re-check refs inside the async callback - they may have become null
                    if (!headerRef.current || !bodyRef.current) {
                        syncInProgressRef.current = false;
                        return;
                    }

                    // Setup containers
                    setupContainers(headerRef.current, bodyRef.current);

                    // Check and log container alignment
                    const headerContainerRect =
                        headerRef.current.getBoundingClientRect();
                    const bodyContainerRect =
                        bodyRef.current.getBoundingClientRect();
                    const containerLeftDiff =
                        bodyContainerRect.left - headerContainerRect.left;

                    // CRITICAL FIX: If body is to the right of header, shift it left
                    // This handles cases where header wrapper has padding-right for scrollbar
                    if (Math.abs(containerLeftDiff) > 1) {
                        // Shift body container to match header position
                        bodyRef.current.style.setProperty(
                            "margin-left",
                            `-${containerLeftDiff}px`,
                            "important"
                        );
                        void bodyRef.current.offsetHeight; // Force reflow

                        // Check parent containers to find the source of misalignment
                        // Check parent containers to find the source of misalignment
                        let headerParent = headerRef.current.parentElement;
                        let bodyParent = bodyRef.current.parentElement;
                        let foundMismatch = false;

                        while (
                            headerParent &&
                            bodyParent &&
                            headerParent !== document.body &&
                            !foundMismatch
                        ) {
                            const headerParentStyle =
                                window.getComputedStyle(headerParent);
                            const bodyParentStyle =
                                window.getComputedStyle(bodyParent);

                            const headerParentPaddingLeft =
                                parseFloat(headerParentStyle.paddingLeft) || 0;
                            const bodyParentPaddingLeft =
                                parseFloat(bodyParentStyle.paddingLeft) || 0;
                            const headerParentPaddingRight =
                                parseFloat(headerParentStyle.paddingRight) || 0;
                            const bodyParentPaddingRight =
                                parseFloat(bodyParentStyle.paddingRight) || 0;
                            const headerParentBorderLeft =
                                parseFloat(headerParentStyle.borderLeftWidth) ||
                                0;
                            const bodyParentBorderLeft =
                                parseFloat(bodyParentStyle.borderLeftWidth) ||
                                0;
                            const headerParentMarginLeft =
                                parseFloat(headerParentStyle.marginLeft) || 0;
                            const bodyParentMarginLeft =
                                parseFloat(bodyParentStyle.marginLeft) || 0;

                            // Check if parent padding/margin/border differs
                            // CRITICAL: Header wrapper has paddingRight for scrollbar, but if scrollbar isn't visible,
                            // this causes misalignment. We need to detect and compensate for this.
                            if (
                                Math.abs(
                                    headerParentPaddingLeft -
                                    bodyParentPaddingLeft
                                ) > 0.5 ||
                                Math.abs(
                                    headerParentBorderLeft -
                                    bodyParentBorderLeft
                                ) > 0.5 ||
                                Math.abs(
                                    headerParentMarginLeft -
                                    bodyParentMarginLeft
                                ) > 0.5 ||
                                (headerParentPaddingRight > 0 &&
                                    bodyParentPaddingRight === 0)
                            ) {
                                // If header parent has padding-right (for scrollbar) but scrollbar isn't visible,
                                // we need to compensate by adjusting the header container
                                if (
                                    headerParentPaddingRight > 0 &&
                                    bodyParentPaddingRight === 0
                                ) {
                                    // Find the actual scrollable container (the one with overflowY: auto)
                                    // It might be bodyRef's parent or further up the tree
                                    let scrollableContainer: HTMLElement | null =
                                        bodyRef.current?.parentElement || null;
                                    while (
                                        scrollableContainer &&
                                        scrollableContainer !== document.body
                                    ) {
                                        const style =
                                            window.getComputedStyle(
                                                scrollableContainer
                                            );
                                        if (
                                            style.overflowY === "auto" ||
                                            style.overflowY === "scroll" ||
                                            scrollableContainer.scrollHeight >
                                            scrollableContainer.clientHeight
                                        ) {
                                            break; // Found the scrollable container
                                        }
                                        scrollableContainer =
                                            scrollableContainer.parentElement;
                                    }

                                    if (scrollableContainer) {
                                        const hasScrollbar =
                                            scrollableContainer.scrollHeight >
                                            scrollableContainer.clientHeight;

                                        if (
                                            !hasScrollbar &&
                                            headerParentPaddingRight > 0
                                        ) {
                                            // Scrollbar isn't visible but header has padding-right
                                            // This is the cause of misalignment - we need to compensate
                                            // by adjusting the header container's position
                                            // The header content is shifted left by padding-right, so body is further right
                                            // Try both approaches: shift body left OR shift header right
                                            // Approach 1: Shift body container left by the padding amount
                                            bodyRef.current.style.setProperty(
                                                "margin-left",
                                                `-${headerParentPaddingRight}px`,
                                                "important"
                                            );
                                            void bodyRef.current.offsetHeight; // Force reflow

                                            // Re-check alignment after fix
                                            const newBodyRect =
                                                bodyRef.current.getBoundingClientRect();
                                            const newLeftDiff =
                                                newBodyRect.left -
                                                headerContainerRect.left;
                                            if (Math.abs(newLeftDiff) >= 1) {
                                                // Approach 2: If that didn't work, try shifting header right
                                                bodyRef.current.style.setProperty(
                                                    "margin-left",
                                                    "0",
                                                    "important"
                                                );
                                                headerRef.current.style.setProperty(
                                                    "margin-left",
                                                    `${headerParentPaddingRight}px`,
                                                    "important"
                                                );
                                                headerRef.current.style.setProperty(
                                                    "margin-right",
                                                    "0",
                                                    "important"
                                                );
                                                void headerRef.current
                                                    .offsetHeight; // Force reflow
                                            }
                                        }
                                    }
                                }

                                foundMismatch = true;
                                break;
                            }

                            headerParent = headerParent.parentElement;
                            bodyParent = bodyParent.parentElement;
                        }
                    }

                    // Align containers horizontally to ensure borders line up
                    alignContainers(headerRef.current, bodyRef.current);

                    // Get all header cells
                    const headerCells = Array.from(
                        headerRef.current.children
                    ) as HTMLElement[];

                    if (headerCells.length === 0) {
                        syncInProgressRef.current = false;
                        return;
                    }

                    // Find first body row
                    const { findFirstRow, findAllRows } = createRowFinder(
                        headerCells.length
                    );
                    const firstBodyRow = findFirstRow(bodyRef.current);

                    // Handle missing rows
                    if (!firstBodyRow) {
                        if (rows.length > 0) {
                            // Rows should exist but aren't found in DOM yet - retry
                            syncInProgressRef.current = false;
                            requestAnimationFrame(() => {
                                requestAnimationFrame(() => {
                                    if (
                                        !syncInProgressRef.current &&
                                        headerRef.current &&
                                        bodyRef.current &&
                                        syncColumnWidthsRef.current
                                    ) {
                                        syncColumnWidthsRef.current();
                                    }
                                });
                            });
                            return;
                        }
                        // No rows to sync - mark as synced and exit
                        lastSyncColumnsRef.current = columnsKey;
                        syncInProgressRef.current = false;
                        return;
                    }

                    const bodyCells = Array.from(
                        firstBodyRow.children
                    ) as HTMLElement[];

                    // Calculate widths and check if sync needed
                    const { widthsMap, needsSync } = calculateColumnWidthsMap(
                        headerCells,
                        bodyCells,
                        enhancedColumns,
                        columnWidths
                    );

                    // Only apply if sync is actually needed
                    if (!needsSync && !forceSync) {
                        lastSyncColumnsRef.current = columnsKey;
                        syncInProgressRef.current = false;
                        return;
                    }

                    // Apply styles to header cells
                    applyStylesToCells(
                        headerCells,
                        widthsMap,
                        enhancedColumns,
                        columnWidths,
                        forceSync,
                        true, // isHeader
                        0, // headerPaddingLeft (not needed for header)
                        null // firstHeaderStyle (not needed for header)
                    );

                    // Force reflow after header styles
                    headerCells.forEach((cell) => {
                        void cell.offsetHeight;
                    });

                    // Get header's first cell (row number) padding to match in body cells
                    // CRITICAL: This must be exact to prevent cumulative misalignment
                    const firstHeaderCell = headerCells[0];
                    const firstHeaderStyle = firstHeaderCell
                        ? window.getComputedStyle(firstHeaderCell)
                        : null;
                    // Get padding-left AFTER styles are applied to header
                    const headerPaddingLeft = firstHeaderStyle
                        ? parseFloat(firstHeaderStyle.paddingLeft) || 0
                        : 0;

                    // Apply styles to all body rows
                    const allBodyRows = bodyRef.current
                        ? findAllRows(bodyRef.current)
                        : [];

                    allBodyRows.forEach((row, rowIndex) => {
                        const rowCells = Array.from(
                            row.children
                        ) as HTMLElement[];

                        applyStylesToCells(
                            rowCells,
                            widthsMap,
                            enhancedColumns,
                            columnWidths,
                            forceSync,
                            false, // isHeader
                            headerPaddingLeft, // Pass header padding to match
                            firstHeaderStyle // Pass header style for matching padding-right
                        );

                        // Force a reflow to ensure styles are applied before measuring
                        rowCells.forEach((cell) => {
                            void cell.offsetHeight;
                        });

                        // Verify and re-apply styles if they're not being respected
                        if (forceSync) {
                            rowCells.forEach((cell, idx) => {
                                const targetWidth = widthsMap.get(idx);
                                if (!targetWidth || !enhancedColumns[idx])
                                    return;

                                const column = enhancedColumns[idx];
                                const isActionsColumn =
                                    column.field === "actions";
                                const isRowNumberColumn =
                                    column.field === "__rowNumber";
                                const isCheckboxColumn = column.field === "checkbox";

                                // Check if this is the first data column
                                const isFirstDataColumn =
                                    !isRowNumberColumn &&
                                    !isCheckboxColumn &&
                                    !isActionsColumn &&
                                    (idx > 0 && enhancedColumns[idx - 1]?.field === "__rowNumber" ||
                                        idx > 1 &&
                                        enhancedColumns[idx - 2]?.field === "checkbox" &&
                                        enhancedColumns[idx - 1]?.field === "__rowNumber");

                                const hasBeenResized = hasColumnBeenResized(
                                    column,
                                    columnWidths
                                );
                                const columnHasFlex =
                                    column.flex !== undefined &&
                                    column.flex > 0;
                                const shouldAllowFlex =
                                    !isActionsColumn &&
                                    !isRowNumberColumn &&
                                    !isFirstDataColumn && // Don't allow flex for first data column
                                    !hasBeenResized &&
                                    columnHasFlex; // All columns have flex: 1, so this will be true for all data columns

                                const computedStyle =
                                    window.getComputedStyle(cell);
                                const computedWidth = parseFloat(
                                    computedStyle.width
                                );
                                const headerCell = headerCells[idx];
                                const headerWidth = headerCell
                                    ? headerCell.getBoundingClientRect().width
                                    : 0;

                                // For flex columns, check if width matches header (not target)
                                // For fixed columns, check if width matches target
                                const needsReapply = shouldAllowFlex
                                    ? Math.abs(computedWidth - headerWidth) > 5 // Allow 5px for flex rounding
                                    : computedWidth > targetWidth * 2 ||
                                    Math.abs(computedWidth - targetWidth) > 2;

                                if (needsReapply) {
                                    // Re-apply styles with !important to override Material-UI
                                    // First data column should also be treated as fixed width
                                    if (isActionsColumn || isRowNumberColumn || isFirstDataColumn) {
                                        applyFixedWidthStyles(
                                            cell,
                                            targetWidth,
                                            true
                                        );
                                    } else if (shouldAllowFlex) {
                                        // For flex columns, use header width as min-width
                                        const flexMinWidth =
                                            headerWidth > 0
                                                ? headerWidth
                                                : targetWidth;
                                        applyFlexStyles(
                                            cell,
                                            flexMinWidth,
                                            true
                                        );
                                    } else {
                                        applyFixedWidthStyles(
                                            cell,
                                            targetWidth,
                                            true
                                        );
                                    }
                                }
                            });
                        }
                    });

                    // Check alignment issues AFTER styles are applied
                    if (headerCells.length > 0 && bodyCells.length > 0) {
                        // Force another reflow to ensure all styles are computed
                        headerCells.forEach((cell) => void cell.offsetHeight);
                        bodyCells.forEach((cell) => void cell.offsetHeight);

                        const alignmentIssues: Array<{
                            index: number;
                            field: string;
                            leftDiff: number;
                            widthDiff: number;
                            headerWidth: number;
                            bodyWidth: number;
                            headerLeft: number;
                            bodyLeft: number;
                            headerInlineWidth: string;
                            bodyInlineWidth: string;
                            headerComputedFlex: string;
                            bodyComputedFlex: string;
                        }> = [];

                        headerCells.forEach((headerCell, index) => {
                            if (bodyCells[index]) {
                                const headerRect =
                                    headerCell.getBoundingClientRect();
                                const bodyRect =
                                    bodyCells[index].getBoundingClientRect();
                                const leftDiff = Math.abs(
                                    headerRect.left - bodyRect.left
                                );
                                const widthDiff = Math.abs(
                                    headerRect.width - bodyRect.width
                                );
                                const headerStyle =
                                    window.getComputedStyle(headerCell);
                                const bodyStyle = window.getComputedStyle(
                                    bodyCells[index]
                                );

                                if (leftDiff > 1 || widthDiff > 1) {
                                    alignmentIssues.push({
                                        index,
                                        field:
                                            enhancedColumns[index]?.field ||
                                            "unknown",
                                        leftDiff,
                                        widthDiff,
                                        headerWidth: headerRect.width,
                                        bodyWidth: bodyRect.width,
                                        headerLeft: headerRect.left,
                                        bodyLeft: bodyRect.left,
                                        headerInlineWidth:
                                            headerCell.style.width,
                                        bodyInlineWidth:
                                            bodyCells[index].style.width,
                                        headerComputedFlex: headerStyle.flex,
                                        bodyComputedFlex: bodyStyle.flex,
                                    });
                                }
                            }
                        });

                        if (alignmentIssues.length > 0) {
                            // Alignment issues detected but not logged (kept for potential future debugging)
                        }
                    }

                    // Mark as synced
                    lastSyncColumnsRef.current = columnsKey;
                } catch (e) {
                    // Error syncing column widths - silently fail
                } finally {
                    syncInProgressRef.current = false;
                }
            });
        },
        [
            columnsKey,
            headerRef,
            bodyRef,
            rows,
            enhancedColumns,
            columnWidths,
            isResizing,
        ]
    );

    // Create debounced sync function for performance optimization
    const debouncedSync = useMemo(
        () =>
            debounce(() => {
                syncColumnWidthsInternal();
            }, SYNC_CONSTANTS.DEBOUNCE_DELAY),
        [syncColumnWidthsInternal]
    );

    // Public sync function - uses debouncing for performance
    const syncColumnWidths = useCallback(
        (forceClearCache = false, forceSync = false) => {
            // Clear cache if requested
            if (forceClearCache) {
                lastSyncColumnsRef.current = "";
            }

            // For immediate sync (e.g., on resize or window resize), call internal directly with forceSync
            // For other cases, use debounced version
            if (isResizing || forceSync) {
                syncColumnWidthsInternal(true, forceClearCache);
            } else {
                debouncedSync();
            }
        },
        [isResizing, syncColumnWidthsInternal, debouncedSync]
    );

    // Update ref when syncColumnWidths changes
    useEffect(() => {
        syncColumnWidthsRef.current = syncColumnWidths;
    }, [syncColumnWidths]);

    // Sync header and body column widths to ensure perfect alignment
    // Use useLayoutEffect for immediate sync on initial render
    useLayoutEffect(() => {
        // Skip sync during active resizing to prevent interference
        if (isResizing) {
            return;
        }

        // Don't sync if there are no rows yet (unless columns changed)
        if (rows.length === 0 && lastSyncColumnsRef.current !== "") {
            return;
        }

        // Skip if already synced for this column configuration
        if (syncInProgressRef.current) {
            return;
        }

        if (lastSyncColumnsRef.current === columnsKey) {
            return;
        }

        // Check if DOM is ready
        if (!headerRef.current || !bodyRef.current) {
            // If DOM not ready, use requestAnimationFrame to wait for next paint
            requestAnimationFrame(() => {
                if (
                    !syncInProgressRef.current &&
                    headerRef.current &&
                    bodyRef.current
                ) {
                    // On first sync (when lastSyncColumnsRef is empty), force sync to ensure expandable column gets flex
                    const isFirstSync = lastSyncColumnsRef.current === "";
                    if (isFirstSync) {
                        syncColumnWidths(true, true); // Clear cache and force sync
                    } else {
                        syncColumnWidths();
                    }
                }
            });
            return;
        }

        // DOM is ready, sync immediately using requestAnimationFrame to ensure rows are rendered
        requestAnimationFrame(() => {
            if (!syncInProgressRef.current) {
                // On first sync (when lastSyncColumnsRef is empty), force sync to ensure expandable column gets flex
                const isFirstSync = lastSyncColumnsRef.current === "";
                if (isFirstSync) {
                    syncColumnWidths(true, true); // Clear cache and force sync
                } else {
                    syncColumnWidths();
                }
            }
        });
    }, [
        enhancedColumns,
        columnWidths,
        syncColumnWidths,
        isResizing,
        rows.length,
        columnsKey,
    ]);

    // Also sync when rows are first loaded (from empty to having data) - only once on initial load
    useEffect(() => {
        // Only run once on initial load when rows first appear
        if (
            rows.length > 0 &&
            !initialSyncDoneRef.current &&
            !isResizing &&
            !syncInProgressRef.current &&
            !isLoading
        ) {
            // Use multiple requestAnimationFrame calls to ensure virtual rows are rendered
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    // Check if rows are actually in the DOM now
                    if (headerRef.current && bodyRef.current) {
                        const testRow = Array.from(
                            bodyRef.current.querySelectorAll("*")
                        ).find((el) => {
                            if (el instanceof HTMLElement) {
                                const style = window.getComputedStyle(el);
                                return (
                                    style.display === "flex" &&
                                    Math.abs(
                                        parseFloat(style.height) - ITEM_HEIGHT
                                    ) < SYNC_CONSTANTS.HEIGHT_TOLERANCE
                                );
                            }
                            return false;
                        });

                        if (testRow || lastSyncColumnsRef.current === "") {
                            // Mark initial sync as done
                            initialSyncDoneRef.current = true;
                            // Update last row count for tracking new rows
                            lastRowCountRef.current = rows.length;
                            // Always force sync when rows first load
                            lastSyncColumnsRef.current = "";
                            syncColumnWidths(true, true); // Clear cache and force sync
                        }
                    }
                });
            });
        }
    }, [
        rows.length,
        enhancedColumns,
        columnWidths,
        syncColumnWidths,
        isResizing,
        isLoading,
        headerRef,
        bodyRef,
        columnsKey,
    ]);

    // Sync when new rows are loaded (rows.length increases)
    // This ensures newly loaded rows get the correct column widths immediately when rendered
    useLayoutEffect(() => {
        // Only sync if rows increased (new rows loaded) and not during initial load
        if (
            rows.length > lastRowCountRef.current &&
            initialSyncDoneRef.current &&
            !isResizing &&
            !syncInProgressRef.current &&
            !isLoading
        ) {
            // Sync immediately when new rows are detected
            if (headerRef.current && bodyRef.current) {
                // Sync immediately - don't wait for scroll to stop
                syncColumnWidths(false, true); // Don't clear cache, but force sync

                // Also sync again after a short delay to catch any rows that weren't in DOM yet
                setTimeout(() => {
                    if (
                        !syncInProgressRef.current &&
                        headerRef.current &&
                        bodyRef.current
                    ) {
                        syncColumnWidths(false, true); // Force sync again to catch late-rendered rows
                    }
                }, SYNC_CONSTANTS.NEW_ROW_SYNC_DELAY);
            }
        }
        // Update last row count
        lastRowCountRef.current = rows.length;
    }, [
        rows.length,
        isResizing,
        isLoading,
        syncColumnWidths,
        headerRef,
        bodyRef,
    ]);

    // Sync when visible range changes (new rows scroll into view)
    // Use useLayoutEffect to sync BEFORE paint, preventing visual flash
    useLayoutEffect(() => {
        if (!visibleRange) return;

        // Check if visible range actually changed (compare directly to avoid object creation)
        const lastRange = lastVisibleRangeRef.current;
        const rangeChanged =
            !lastRange ||
            lastRange.startIndex !== visibleRange.startIndex ||
            lastRange.endIndex !== visibleRange.endIndex;

        if (
            rangeChanged &&
            !isResizing &&
            !syncInProgressRef.current &&
            !isLoading &&
            initialSyncDoneRef.current &&
            headerRef.current &&
            bodyRef.current
        ) {
            // Sync before paint to prevent visual flash - force sync to ensure widths are applied
            syncColumnWidths(false, true);
        }

        // Update last visible range only if it changed
        if (rangeChanged) {
            lastVisibleRangeRef.current = {
                startIndex: visibleRange.startIndex,
                endIndex: visibleRange.endIndex,
            };
        }
    }, [
        visibleRange?.startIndex,
        visibleRange?.endIndex,
        isResizing,
        isLoading,
        syncColumnWidths,
        // headerRef and bodyRef are refs and don't need to be in dependencies
    ]);

    // Expose scroll tracking functions
    // These will be called from EndlessScrollDataGrid to track scroll state
    const setScrolling = useCallback(
        (scrolling: boolean) => {
            isScrollingRef.current = scrolling;

            // When scrolling stops, sync after a delay to ensure newly visible rows get correct widths
            if (!scrolling) {
                // Clear any existing timeout
                if (scrollTimeoutRef.current) {
                    clearTimeout(scrollTimeoutRef.current);
                }

                // Sync after scroll stops (debounced) to apply widths to newly visible rows
                scrollTimeoutRef.current = setTimeout(() => {
                    if (
                        !syncInProgressRef.current &&
                        headerRef.current &&
                        bodyRef.current
                    ) {
                        syncColumnWidths(false, false); // Sync only if widths need adjustment
                    }
                }, SYNC_CONSTANTS.SCROLL_SYNC_DELAY);
            }
        },
        [syncColumnWidths]
        // headerRef and bodyRef are refs and don't need to be in dependencies
    );

    return {
        syncColumnWidths,
        syncColumnWidthsRef,
        setScrolling,
    };
};
