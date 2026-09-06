import { useTheme } from "@mui/material/styles";
import { useCallback, useEffect, useRef, useState } from "react";
import { UseColumnResizingOptions, UseColumnResizingReturn } from "../types";
import { calculateColumnWidth } from "../utils/columnUtils";

export const useColumnResizing = ({
    resizableColumns,
    columns,
    rows,
    enhancedColumns,
    language,
    onSyncAfterResize,
    onSyncDuringResize,
}: UseColumnResizingOptions): UseColumnResizingReturn => {
    const theme = useTheme();

    // Column resizing state - only track widths for columns that have been explicitly resized
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(
        {}
    );
    const [isResizing, setIsResizing] = useState(false);
    const [resizeStartX, setResizeStartX] = useState(0);
    const [resizeColumn, setResizeColumn] = useState<string | null>(null);

    // Track clicks on resize handle to prevent sort on double-click
    const resizeHandleClickRef = useRef<{
        field: string;
        timestamp: number;
    } | null>(null);

    // Refs for resize handlers to avoid stale closures
    const resizeStateRef = useRef<{
        isResizing: boolean;
        resizeColumn: string | null;
        resizeStartX: number;
        initialWidth: number;
        columnWidths: Record<string, number>;
    }>({
        isResizing: false,
        resizeColumn: null,
        resizeStartX: 0,
        initialWidth: 0,
        columnWidths: {},
    });

    // Refs for handler functions to ensure stable references
    const handleResizeMoveRef = useRef<(_e: MouseEvent) => void>();
    const handleResizeEndRef = useRef<() => void>();

    // Keep resize state refs in sync
    useEffect(() => {
        resizeStateRef.current.isResizing = isResizing;
        resizeStateRef.current.resizeColumn = resizeColumn;
        resizeStateRef.current.resizeStartX = resizeStartX;
        resizeStateRef.current.columnWidths = columnWidths;
    }, [isResizing, resizeColumn, resizeStartX, columnWidths]);

    // Helper function to measure text width
    const measureTextWidth = useCallback(
        (text: string, fontSize: string, fontFamily: string): number => {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            if (!context) return 0;

            context.font = `${fontSize} ${fontFamily}`;
            return context.measureText(String(text || "")).width;
        },
        []
    );

    // Column resize handlers - using refs to avoid stale closures
    const handleResizeMove = useCallback(
        (e: MouseEvent) => {
            const state = resizeStateRef.current;
            if (!state.isResizing || !state.resizeColumn) {
                return;
            }

            // Calculate delta from the original start position
            let deltaX = e.clientX - state.resizeStartX;

            // In RTL (Hebrew), invert the delta because columns are displayed in reverse order
            // Dragging left (negative delta) should increase width, dragging right (positive delta) should decrease width
            if (language === "he") {
                deltaX = -deltaX;
            }

            // Use the stored initial width when resizing started
            const initialWidth = state.initialWidth;

            // Calculate new width based on original width + total delta
            const newWidth = Math.max(50, initialWidth + deltaX); // Minimum width of 50px

            // Update column widths
            setColumnWidths((prev) => {
                const updated = {
                    ...prev,
                    [state.resizeColumn!]: newWidth,
                };
                resizeStateRef.current.columnWidths = updated;

                // Sync body rows during resize move for real-time updates
                requestAnimationFrame(() => {
                    onSyncDuringResize?.();
                });

                return updated;
            });
        },
        [onSyncDuringResize, language]
    );

    const handleResizeEnd = useCallback(() => {
        // The browser dispatches `click` on the nearest common ancestor of mousedown
        // and mouseup, which is the header cell rather than the handle. Record the
        // drag so the header can ignore that click instead of sorting.
        resizeHandleClickRef.current = {
            field: resizeStateRef.current.resizeColumn ?? "",
            timestamp: Date.now(),
        };

        setIsResizing(false);
        setResizeColumn(null);
        resizeStateRef.current.isResizing = false;
        resizeStateRef.current.resizeColumn = null;

        // Remove global event listeners using the stored refs
        const moveHandler = handleResizeMoveRef.current;
        const endHandler = handleResizeEndRef.current;

        if (moveHandler) {
            document.removeEventListener("mousemove", moveHandler);
        }
        if (endHandler) {
            document.removeEventListener("mouseup", endHandler);
        }

        // Clear refs
        handleResizeMoveRef.current = undefined;
        handleResizeEndRef.current = undefined;

        // Trigger sync after resize ends to ensure alignment
        requestAnimationFrame(() => {
            onSyncAfterResize?.();
        });
    }, [onSyncAfterResize]);

    const handleResizeStart = useCallback(
        (e: React.MouseEvent, columnField: string) => {
            if (!resizableColumns) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            const startX = e.clientX;
            // Get initial width: use resized width if exists, otherwise use column's width/minWidth
            const column = columns.find((c) => c.field === columnField);
            const initialWidth = column
                ? calculateColumnWidth(column, columnWidths)
                : 150;

            setIsResizing(true);
            setResizeStartX(startX);
            setResizeColumn(columnField);

            resizeStateRef.current.isResizing = true;
            resizeStateRef.current.resizeColumn = columnField;
            resizeStateRef.current.resizeStartX = startX;
            resizeStateRef.current.initialWidth = initialWidth;

            // Store handlers in refs for cleanup
            handleResizeMoveRef.current = handleResizeMove;
            handleResizeEndRef.current = handleResizeEnd;

            // Add global event listeners
            document.addEventListener("mousemove", handleResizeMove);
            document.addEventListener("mouseup", handleResizeEnd);
        },
        [
            resizableColumns,
            columnWidths,
            columns,
            handleResizeMove,
            handleResizeEnd,
        ]
    );

    // Auto-resize column to fit longest content
    const handleAutoResize = useCallback(
        (columnField: string) => {
            if (!resizableColumns) return;

            const column = columns.find((c) => c.field === columnField);
            if (!column) return;

            // Get font styles from theme
            const fontSizeValue = theme.typography.body2.fontSize;
            const fontSize =
                typeof fontSizeValue === "number"
                    ? `${fontSizeValue}px`
                    : fontSizeValue || "0.875rem";
            const fontFamily =
                (Array.isArray(theme.typography.fontFamily)
                    ? theme.typography.fontFamily[0]
                    : theme.typography.fontFamily) ||
                "Roboto, Arial, sans-serif";

            let maxWidth = 0;

            // Measure header text (header uses slightly larger font)
            const headerFontSize =
                typeof theme.typography.h6.fontSize === "number"
                    ? `${theme.typography.h6.fontSize}px`
                    : theme.typography.h6.fontSize || "1.25rem";
            const headerText = column.headerName || "";
            const headerWidth = measureTextWidth(
                headerText,
                headerFontSize,
                fontFamily
            );
            maxWidth = Math.max(maxWidth, headerWidth);

            // Measure all row values
            rows.forEach((row) => {
                let cellText = "";

                // Get the raw value from the row
                const rawValue = row[columnField];

                if (rawValue !== null && rawValue !== undefined) {
                    // Convert to string for measurement
                    if (typeof rawValue === "object" && rawValue !== null) {
                        // For objects, try to get a meaningful string representation
                        if (
                            "toString" in rawValue &&
                            typeof rawValue.toString === "function"
                        ) {
                            cellText = rawValue.toString();
                        } else {
                            cellText = JSON.stringify(rawValue).substring(
                                0,
                                100
                            ); // Limit length
                        }
                    } else {
                        cellText = String(rawValue);
                    }
                }

                const cellWidth = measureTextWidth(
                    cellText,
                    fontSize,
                    fontFamily
                );
                maxWidth = Math.max(maxWidth, cellWidth);
            });

            // Find the column index in enhancedColumns (needed for padding calculation)
            const currentColumnIndex = enhancedColumns.findIndex(
                (c) => c.field === columnField
            );

            // Add padding based on responsive header padding (md breakpoint: 6px top/bottom, 8px left/right)
            // Header: 8px left + 8px right = 16px
            // Gap between header text and sort icon: ~8px
            // Sort icon width: ~20px (only if sortable)
            // Resize handle: ~8px (only if not last column)
            const headerPadding = 8 + 8; // left + right
            const gap = 8;
            const sortIconWidth = column.sortable !== false ? 20 : 0;
            const resizeHandleWidth =
                resizableColumns &&
                    currentColumnIndex < enhancedColumns.length - 1
                    ? 8
                    : 0;
            const padding =
                headerPadding + gap + sortIconWidth + resizeHandleWidth;

            const calculatedWidth = Math.max(
                maxWidth + padding,
                column.minWidth || 150
            );

            // Get current width (resized width or column width/minWidth)
            const currentWidth = calculateColumnWidth(column, columnWidths);

            // Set the column width
            setColumnWidths((prev) => {
                // When shrinking, use Math.floor to ensure it actually shrinks
                // When expanding, use Math.ceil to ensure it's big enough
                const willShrink = calculatedWidth < currentWidth;
                const newWidth = willShrink
                    ? Math.floor(calculatedWidth)
                    : Math.ceil(calculatedWidth);

                const updated = {
                    ...prev,
                    [columnField]: newWidth,
                };

                // If column needs to shrink, distribute extra width to adjacent column
                if (willShrink && currentColumnIndex >= 0) {
                    // Use the actual difference between current width and new (rounded) width
                    const widthDifference = currentWidth - newWidth;

                    // Determine adjacent column: right for LTR (English), left for RTL (Hebrew)
                    const adjacentIndex =
                        language === "he"
                            ? currentColumnIndex - 1 // Left column for Hebrew
                            : currentColumnIndex + 1; // Right column for English

                    // Only adjust if adjacent column exists and is not out of bounds
                    if (
                        adjacentIndex >= 0 &&
                        adjacentIndex < enhancedColumns.length
                    ) {
                        const adjacentColumn = enhancedColumns[adjacentIndex];
                        const adjacentField = adjacentColumn.field;

                        // Only adjust if adjacent column hasn't been manually resized
                        if (!prev[adjacentField]) {
                            const adjacentCurrentWidth = calculateColumnWidth(
                                adjacentColumn,
                                prev
                            );

                            updated[adjacentField] =
                                adjacentCurrentWidth + widthDifference;
                        }
                    }
                }

                return updated;
            });

            // Trigger sync after auto-resize
            requestAnimationFrame(() => {
                onSyncAfterResize?.();
            });
        },
        [
            resizableColumns,
            columns,
            rows,
            enhancedColumns,
            language,
            columnWidths,
            measureTextWidth,
            theme,
            onSyncAfterResize,
        ]
    );

    return {
        columnWidths,
        isResizing,
        resizeHandleClickRef,
        handleResizeStart,
        handleAutoResize,
        setColumnWidths,
    };
};
