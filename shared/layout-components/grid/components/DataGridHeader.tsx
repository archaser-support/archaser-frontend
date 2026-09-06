import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { Box, Tooltip } from "@mui/material";
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

            // Skip sorting when this click is the tail of a resize interaction
            // (drag end or double-click on the handle). The field is not compared
            // because a drag can end over a different column than it started on.
            if (resizeHandleClickRef.current) {
                const timeSinceResizeInteraction =
                    Date.now() - resizeHandleClickRef.current.timestamp;
                resizeHandleClickRef.current = null;
                if (timeSinceResizeInteraction < 500) {
                    return;
                }
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
                    const lockReason =
                        !isSortable && column.description
                            ? String(column.description)
                            : "";
                    const isHeaderLocked = Boolean(lockReason);
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
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                }}
                            >
                                {isHeaderLocked ? (
                                    <Tooltip
                                        title={lockReason}
                                        placement="bottom"
                                        arrow
                                        enterDelay={300}
                                        leaveDelay={100}
                                        PopperProps={{
                                            sx: {
                                                zIndex: 9999,
                                                "& .MuiTooltip-tooltip": {
                                                    direction:
                                                        language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                },
                                            },
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 0.5,
                                                minWidth: 0,
                                                flex: 1,
                                            }}
                                        >
                                            <TruncatedCell
                                                content={column.headerName}
                                                tooltipText=""
                                                language={language}
                                            />
                                            <LockOutlinedIcon
                                                sx={{
                                                    fontSize: 14,
                                                    color: "text.disabled",
                                                    flexShrink: 0,
                                                }}
                                                aria-label={lockReason}
                                            />
                                        </Box>
                                    </Tooltip>
                                ) : (
                                    <TruncatedCell
                                        content={column.headerName}
                                        tooltipText={column.headerName || ""}
                                        language={language}
                                    />
                                )}
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
