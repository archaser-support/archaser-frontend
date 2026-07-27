import { Box } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import React from "react";
import { DataGridHeaderProps } from "../types";
import {
    getColumnWidthConfig
} from "../utils/columnUtils";
import ResizeHandle from "./ResizeHandle";
import TruncatedCell from "./TruncatedCell";

const ITEM_HEIGHT = 48;

const DataGridHeader: React.FC<DataGridHeaderProps> = React.memo(
    ({
        columns,
        sortModel,
        onSort,
        columnWidths,
        resizableColumns,
        onResizeStart,
        onAutoResize,
        language,
        headerContentRef,
        resizeHandleClickRef,
    }) => {
        const theme = useTheme();

        const getSortDirection = (field: string): "asc" | "desc" | null => {
            if (!sortModel || sortModel.length === 0) {
                return null;
            }

            // Try exact match first (handles: "name" === "name", "Customer.name" === "Customer.name")
            const exactMatch = sortModel.find((s) => s.field === field);
            if (exactMatch) {
                return exactMatch.sort || null;
            }

            // Extract the base field name (last segment after dots)
            // This handles various formats:
            // - "Customer.name" -> "name"
            // - "Invoice.Customer.name" -> "name" (nested relations)
            // - "name" -> "name" (no prefix)
            const getBaseFieldName = (f: string): string => {
                const parts = f.split(".");
                return parts.length > 1 ? parts[parts.length - 1] : f;
            };

            const baseFieldName = getBaseFieldName(field);

            // Try matching by base field name
            // This handles cases where:
            // - sortModel has "name" and column has "Customer.name" -> matches
            // - sortModel has "Customer.name" and column has "name" -> matches
            // - sortModel has "Invoice.date" and column has "date" -> matches
            const baseMatch = sortModel.find((s) => getBaseFieldName(s.field) === baseFieldName);
            if (baseMatch) {
                return baseMatch.sort || null;
            }

            return null;
        };

        const handleSortClick = (field: string, e?: React.MouseEvent) => {
            // Prevent sort if clicking on resize handle
            if (
                e &&
                (e.target as HTMLElement).closest("[data-resize-handle]")
            ) {
                return;
            }

            // Check if this click is part of a double-click on resize handle
            if (
                resizeHandleClickRef.current &&
                resizeHandleClickRef.current.field === field
            ) {
                const timeSinceLastClick =
                    Date.now() - resizeHandleClickRef.current.timestamp;
                // If double-click happened recently (within 500ms), don't sort
                if (timeSinceLastClick < 500) {
                    resizeHandleClickRef.current = null;
                    return;
                }
                // Clear the tracker after checking
                resizeHandleClickRef.current = null;
            }

            if (onSort) {
                onSort(field);
            }
        };

        return (
            <Box
                ref={headerContentRef}
                sx={{
                    display: "flex",
                    bgcolor: "background.paper",
                    position: "sticky",
                    top: 0,
                    zIndex: 2,
                    height: `${ITEM_HEIGHT}px`,
                    minHeight: `${ITEM_HEIGHT}px`,
                    width: "100%", // Ensure container takes full width for flex to work properly
                    maxWidth: "100%", // Constrain to parent width so flex can work
                    boxSizing: "border-box",
                    overflow: "hidden", // Prevent overflow
                }}
            >
                {columns.map((column, index) => {
                    const sortDirection = getSortDirection(column.field);
                    const isSortable = column.sortable !== false;
                    const isLastColumn = index === columns.length - 1;

                    // Check if this is the first data column (after row number and possibly checkbox)
                    const isFirstDataColumn =
                        column.field !== "__rowNumber" &&
                        column.field !== "checkbox" &&
                        column.field !== "actions" &&
                        (index > 0 && columns[index - 1]?.field === "__rowNumber" ||
                            index > 1 &&
                            columns[index - 2]?.field === "checkbox" &&
                            columns[index - 1]?.field === "__rowNumber");

                    const widthConfig = getColumnWidthConfig(
                        column,
                        columnWidths,
                        isLastColumn,
                        isFirstDataColumn
                    );

                    return (
                        <Box
                            key={column.field}
                            onClick={(e) => {
                                if (isSortable) {
                                    handleSortClick(column.field, e);
                                }
                            }}
                            sx={{
                                padding: {
                                    xs: "2px 4px",
                                    sm: "4px 6px",
                                    md: "6px 8px",
                                },
                                fontSize: {
                                    xs: theme.typography.caption.fontSize,
                                    sm: theme.typography.body2.fontSize,
                                    md: theme.typography.body2.fontSize,
                                },
                                fontWeight: theme.typography.fontWeightMedium,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 1,
                                width:
                                    widthConfig.hasBeenResized || !isLastColumn
                                        ? `${widthConfig.width}px`
                                        : undefined,
                                minWidth: `${widthConfig.width}px`,
                                maxWidth:
                                    widthConfig.hasBeenResized || !isLastColumn
                                        ? `${widthConfig.width}px`
                                        : undefined,
                                flexShrink: 0,
                                ...(widthConfig.shouldUseFlex === undefined && {
                                    flexGrow: 0,
                                }),
                                ...(widthConfig.shouldUseFlex !== undefined && {
                                    flex: widthConfig.shouldUseFlex,
                                }),
                                borderLeft:
                                    language === "he"
                                        ? "none"
                                        : index > 0
                                            ? `1px solid ${theme.palette.divider}`
                                            : "none",
                                borderRight:
                                    language === "he"
                                        ? index === 0
                                            ? "none"
                                            : `1px solid ${theme.palette.divider}`
                                        : "none",
                                height: "100%",
                                cursor: isSortable ? "pointer" : "default",
                                userSelect: "none",
                                overflow: "visible",
                                boxSizing: "border-box",
                                position: "relative",
                                "&:hover": isSortable
                                    ? {
                                        backgroundColor: alpha(
                                            theme.palette.primary.main,
                                            0.08
                                        ),
                                    }
                                    : {},
                            }}
                        >
                            <Box
                                sx={{
                                    textAlign:
                                        column.field === "__rowNumber"
                                            ? "center"
                                            : "inherit",
                                    flex: 1,
                                    minWidth: 0,
                                }}
                            >
                                <TruncatedCell
                                    content={column.headerName}
                                    tooltipText={column.headerName || ""}
                                    language={language}
                                />
                            </Box>
                            {isSortable && sortDirection ? (
                                <Box
                                    key={`${column.field}-sort-indicator`}
                                    sx={{
                                        color: theme.palette.primary.main,
                                        fontSize:
                                            theme.typography.caption.fontSize,
                                        flexShrink: 0,
                                        lineHeight: 1,
                                    }}
                                >
                                    {sortDirection === "asc" ? "↑" : "↓"}
                                </Box>
                            ) : null}
                            {/* Resize handle */}
                            {resizableColumns && index < columns.length - 1 ? (
                                <ResizeHandle
                                    columnField={column.field}
                                    onResizeStart={(e) =>
                                        onResizeStart(e, column.field)
                                    }
                                    onAutoResize={() =>
                                        onAutoResize(column.field)
                                    }
                                    language={language}
                                    resizeHandleClickRef={resizeHandleClickRef}
                                />
                            ) : null}
                        </Box>
                    );
                })}
            </Box>
        );
    },
    (prevProps, nextProps) => {
        // Custom comparison function for memoization
        return (
            prevProps.columns === nextProps.columns &&
            JSON.stringify(prevProps.sortModel) ===
            JSON.stringify(nextProps.sortModel) &&
            JSON.stringify(prevProps.columnWidths) ===
            JSON.stringify(nextProps.columnWidths) &&
            prevProps.resizableColumns === nextProps.resizableColumns &&
            prevProps.language === nextProps.language &&
            prevProps.onSort === nextProps.onSort &&
            prevProps.onResizeStart === nextProps.onResizeStart &&
            prevProps.onAutoResize === nextProps.onAutoResize
        );
    }
);

DataGridHeader.displayName = "DataGridHeader";

export default DataGridHeader;
