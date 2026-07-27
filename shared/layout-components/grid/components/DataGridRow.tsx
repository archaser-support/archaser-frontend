import { Box } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { GridColDef } from "@mui/x-data-grid";
import React, { useLayoutEffect, useRef } from "react";
import { DataGridRowProps } from "../types";
import { getColumnWidthConfig } from "../utils/columnUtils";
import { ITEM_HEIGHT } from "../utils/heightUtils";
import DataGridCell from "./DataGridCell";

/** Params shape used by our column generators (e.g. viewColumnGenerator), not MUI's 4-arg valueGetter. */
export type DataGridValueGetterParams = {
    row: Record<string, unknown>;
    value: unknown;
    field: string;
};

/** Resolve cell display value; honors column.valueGetter (e.g. report aggregated keys). */
export function resolveDataGridCellValue(
    row: Record<string, unknown>,
    column: GridColDef,
    actualIndex: number
): unknown {
    if (column.field === "__rowNumber") {
        return actualIndex + 1;
    }

    const baseValue = row[column.field];
    const valueGetter = column.valueGetter as
        | ((params: DataGridValueGetterParams) => unknown)
        | undefined;
    if (valueGetter) {
        return valueGetter({
            row,
            value: baseValue,
            field: column.field,
        });
    }

    return baseValue;
}

const DataGridRow: React.FC<DataGridRowProps> = React.memo(
    ({
        row,
        index,
        actualIndex,
        columns,
        columnWidths,
        isHighlighted,
        isSelected = false,
        language,
        onRowClick,
        highlightedRowRef,
    }) => {
        const theme = useTheme();
        const rowRef = useRef<HTMLDivElement | null>(null);

        // Calculate background color
        const calculatedBgColor = isSelected
            ? alpha(theme.palette.primary.main, 0.08)
            : isHighlighted
                ? alpha(theme.palette.primary.main, 0.08)
                : actualIndex % 2 === 0
                    ? theme.palette.background.paper
                    : theme.palette.action.hover;

        // Use standard Material-UI divider color for borders
        const borderColor = theme.palette.divider;

        // CRITICAL: Use useLayoutEffect to ensure row width is maintained after all styles are applied
        // This prevents other code (like useColumnWidthSync) from collapsing the row
        useLayoutEffect(() => {
            const el = rowRef.current;
            if (!el) return;

            // Function to ensure width is 100%
            const ensureWidth = () => {
                if (!el) return;

                // Set width to 100% with !important to override any conflicting styles
                el.style.setProperty("width", "100%", "important");
                el.style.setProperty("max-width", "100%", "important");
                el.style.setProperty("min-width", "0", "important");

                // Check if width was changed to a fixed pixel value and reset it
                const computedStyle = window.getComputedStyle(el);
                const computedWidth = computedStyle.width;

                // If width is set to a fixed pixel value (like 40px), reset it to 100%
                if (computedWidth && computedWidth !== "100%" && computedWidth !== "auto" && !computedWidth.includes("%")) {
                    el.style.setProperty("width", "100%", "important");
                }
            };

            // Set immediately
            ensureWidth();

            // Also set after short delays to catch any late style applications
            // useColumnWidthSync runs after render, so we need to reset after it runs
            const timeoutId1 = setTimeout(ensureWidth, 0);
            const timeoutId2 = setTimeout(ensureWidth, 50);
            const timeoutId3 = setTimeout(ensureWidth, 100);
            const timeoutId4 = setTimeout(ensureWidth, 200);

            // Use requestAnimationFrame to check a few times
            let checkCount = 0;
            const maxChecks = 10;
            let rafId: number;
            const checkAndReset = () => {
                if (!el || checkCount >= maxChecks) {
                    if (rafId) cancelAnimationFrame(rafId);
                    return;
                }

                checkCount++;
                const computedStyle = window.getComputedStyle(el);
                const computedWidth = computedStyle.width;

                // If width is set to a fixed pixel value (like 40px), reset it
                if (computedWidth && computedWidth !== "100%" && computedWidth !== "auto" && !computedWidth.includes("%")) {
                    ensureWidth();
                }

                // Check a few more times
                if (checkCount < maxChecks) {
                    rafId = requestAnimationFrame(checkAndReset);
                }
            };

            // Start checking after a short delay
            setTimeout(() => {
                rafId = requestAnimationFrame(checkAndReset);
            }, 150);

            return () => {
                clearTimeout(timeoutId1);
                clearTimeout(timeoutId2);
                clearTimeout(timeoutId3);
                clearTimeout(timeoutId4);
                if (rafId) cancelAnimationFrame(rafId);
            };
        }, [actualIndex]); // Re-run when row index changes (new row rendered)

        return (
            <Box
                key={row.id || `row-${actualIndex}`}
                data-row-index={actualIndex}
                data-row-id={row.id}
                ref={(el: HTMLDivElement | null) => {
                    // Store ref for useLayoutEffect
                    rowRef.current = el;

                    if (isHighlighted && highlightedRowRef) {
                        (
                            highlightedRowRef as React.MutableRefObject<HTMLDivElement | null>
                        ).current = el;
                    }

                    // CRITICAL: Ensure borders are always visible by setting them directly with !important
                    // CRITICAL: Ensure row width is 100% to prevent collapsing (fixes alignment issue)
                    if (el) {
                        // Set width to 100% with !important to override any conflicting styles
                        // This ensures the row expands to fill its parent container
                        el.style.setProperty("width", "100%", "important");
                        el.style.setProperty("max-width", "100%", "important");
                        el.style.setProperty("min-width", "0", "important");

                        // Set border-bottom with !important to override any CSS
                        el.style.setProperty(
                            "border-bottom",
                            `1px solid ${borderColor}`,
                            "important"
                        );
                        // Set border-top for first row with !important
                        if (actualIndex === 0) {
                            el.style.setProperty(
                                "border-top",
                                `1px solid ${borderColor}`,
                                "important"
                            );
                        } else {
                            el.style.setProperty(
                                "border-top",
                                "none",
                                "important"
                            );
                        }
                    }
                }}
                onClick={(e) => {
                    // Generic function to check if an element is interactive
                    const isElementInteractive = (el: HTMLElement): boolean => {
                        // Check tag name
                        const tagName = el.tagName;
                        if (tagName === 'A' || tagName === 'BUTTON' || tagName === 'INPUT') {
                            return true;
                        }
                        // Check role attribute
                        const role = el.getAttribute('role');
                        if (role === 'button' || role === 'link') {
                            return true;
                        }
                        // Check for data-interactive attribute
                        if (el.hasAttribute('data-interactive')) {
                            return true;
                        }
                        // Check for onClick handler
                        if (el.onclick !== null || el.getAttribute('onclick') !== null) {
                            return true;
                        }
                        // Check for Material-UI interactive components
                        if (
                            el.classList.contains('MuiButton-root') ||
                            el.classList.contains('MuiIconButton-root') ||
                            el.classList.contains('MuiLink-root') ||
                            el.closest('.MuiButton-root, .MuiIconButton-root, .MuiLink-root') !== null
                        ) {
                            return true;
                        }
                        // Check if element has cursor: pointer and is clickable
                        const style = window.getComputedStyle(el);
                        if (style.cursor === 'pointer' && el.onclick !== null) {
                            return true;
                        }
                        // Check if element is inside an interactive parent
                        const interactiveParent = el.closest(
                            'a, button, [role="button"], [role="link"], [data-interactive="true"], .MuiButton-root, .MuiIconButton-root, .MuiLink-root, .MuiCheckbox-root'
                        );
                        if (interactiveParent !== null) {
                            return true;
                        }

                        return false;
                    };

                    // Check all elements in the event path
                    const nativeEvent = e.nativeEvent as Event;
                    const path = nativeEvent.composedPath ? nativeEvent.composedPath() : [e.target];

                    // Check if any element in the path is interactive
                    let isInteractive = false;
                    for (const element of path) {
                        if (element instanceof HTMLElement) {
                            if (isElementInteractive(element)) {
                                isInteractive = true;
                                break;
                            }
                        }
                    }
                    // If clicking on an interactive element, don't prevent default or handle row click
                    // The cell's onClick handler will stop propagation for these elements
                    if (isInteractive) {
                        return;
                    }
                    // For non-interactive elements, handle row click
                    e.preventDefault();
                    e.stopPropagation();
                    onRowClick?.(row, e);
                }}
                sx={{
                    display: "flex",
                    height: `${ITEM_HEIGHT}px`,
                    minHeight: `${ITEM_HEIGHT}px`,
                    borderBottom: `1px solid ${borderColor}`,
                    borderTop:
                        actualIndex === 0 ? `1px solid ${borderColor}` : "none",
                    cursor: onRowClick || isSelected !== undefined ? "pointer" : "default",
                    width: "100%", // Ensure row takes full width for flex to work
                    maxWidth: "100%", // Constrain to parent width so flex can work
                    flexWrap: "nowrap",
                    boxSizing: "border-box",
                    backgroundColor: calculatedBgColor,
                    // Ensure borders are visible and not clipped
                    position: "relative",
                    zIndex: isSelected ? 2 : 1,
                    // Ensure row can receive clicks
                    pointerEvents: "auto",
                    "&:hover": {
                        backgroundColor: isSelected
                            ? alpha(theme.palette.primary.main, 0.12)
                            : isHighlighted
                                ? alpha(theme.palette.primary.main, 0.12)
                                : theme.palette.action.selected,
                    },
                    transition: "background-color 0.2s ease",
                }}
                style={
                    {
                        backgroundColor: calculatedBgColor, // Apply inline style to ensure it overrides Material-UI
                        borderBottom: `1px solid ${borderColor}`, // Ensure border is always visible
                        borderTop:
                            actualIndex === 0
                                ? `1px solid ${borderColor}`
                                : undefined, // First row needs top border
                    } as React.CSSProperties
                }
            >
                {columns.map((column, colIndex) => {
                    const cellValue = resolveDataGridCellValue(
                        row,
                        column,
                        actualIndex
                    );
                    const isLastColumn = colIndex === columns.length - 1;

                    // Check if this is the first data column (after row number and possibly checkbox)
                    const isFirstDataColumn =
                        column.field !== "__rowNumber" &&
                        column.field !== "checkbox" &&
                        column.field !== "actions" &&
                        (colIndex > 0 && columns[colIndex - 1]?.field === "__rowNumber" ||
                            colIndex > 1 &&
                            columns[colIndex - 2]?.field === "checkbox" &&
                            columns[colIndex - 1]?.field === "__rowNumber");

                    const widthConfig = getColumnWidthConfig(
                        column,
                        columnWidths,
                        isLastColumn,
                        isFirstDataColumn
                    );

                    return (
                        <DataGridCell
                            key={column.field}
                            column={column}
                            value={cellValue}
                            row={row}
                            widthConfig={widthConfig}
                            isLastColumn={isLastColumn}
                            colIndex={colIndex}
                            language={language}
                            onRenderCell={column.renderCell}
                        />
                    );
                })}
            </Box>
        );
    },
    (prevProps, nextProps) => {
        // Custom comparison function for memoization
        return (
            // Grouped report rows keep stable ids (group-*) while values change after execute
            prevProps.row === nextProps.row &&
            prevProps.row.id === nextProps.row.id &&
            prevProps.index === nextProps.index &&
            prevProps.actualIndex === nextProps.actualIndex &&
            prevProps.isHighlighted === nextProps.isHighlighted &&
            prevProps.isSelected === nextProps.isSelected &&
            prevProps.language === nextProps.language &&
            prevProps.columns === nextProps.columns &&
            JSON.stringify(prevProps.columnWidths) ===
            JSON.stringify(nextProps.columnWidths) &&
            prevProps.onRowClick === nextProps.onRowClick
        );
    }
);

DataGridRow.displayName = "DataGridRow";

export default DataGridRow;
