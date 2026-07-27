import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { GridRenderCellParams } from "@mui/x-data-grid";
import React from "react";
import { DataGridCellProps } from "../types";
import TruncatedCell from "./TruncatedCell";

// Helper function to check if an element is interactive
const isElementInteractive = (el: HTMLElement): boolean => {
    const tagName = el.tagName;
    if (tagName === 'A' || tagName === 'BUTTON' || tagName === 'INPUT') {
        return true;
    }

    const role = el.getAttribute('role');
    if (role === 'button' || role === 'link') {
        return true;
    }

    if (el.hasAttribute('data-interactive')) {
        return true;
    }

    if (el.onclick !== null || el.getAttribute('onclick') !== null) {
        return true;
    }

    if (
        el.classList.contains('MuiButton-root') ||
        el.classList.contains('MuiIconButton-root') ||
        el.classList.contains('MuiLink-root') ||
        el.closest('.MuiButton-root, .MuiIconButton-root, .MuiLink-root') !== null
    ) {
        return true;
    }

    const style = window.getComputedStyle(el);
    if (style.cursor === 'pointer' && el.onclick !== null) {
        return true;
    }

    const interactiveParent = el.closest(
        'a, button, [role="button"], [role="link"], [data-interactive="true"], .MuiButton-root, .MuiIconButton-root, .MuiLink-root, .MuiCheckbox-root'
    );
    return interactiveParent !== null;
};

const DataGridCell: React.FC<DataGridCellProps> = React.memo(
    ({
        column,
        value,
        row,
        widthConfig,
        isLastColumn,
        colIndex,
        language,
        onRenderCell,
    }) => {
        const theme = useTheme();

        const cellContent = onRenderCell
            ? onRenderCell({
                row,
                value,
                field: column.field,
            } as GridRenderCellParams)
            : value;

        let tooltipText = value != null ? String(value) : "";

        if (onRenderCell) {
            const extractText = (
                element: React.ReactElement | React.ReactNode
            ): string => {
                if (
                    typeof element === "string" ||
                    typeof element === "number"
                ) {
                    return String(element);
                }
                if (React.isValidElement(element)) {
                    const props = element.props as any;
                    const children = props?.children;

                    // Handle null/undefined children
                    if (children == null) {
                        // Continue to check props
                    }

                    // Handle array of children (e.g., parentName and conditional parentNumber)
                    if (Array.isArray(children)) {
                        const extracted = children
                            .map(extractText)
                            .filter(Boolean)
                            .join("");
                        if (extracted) return extracted;
                    }

                    // Handle single child
                    if (
                        typeof children === "string" ||
                        typeof children === "number"
                    ) {
                        return String(children);
                    }

                    // Handle React fragments or nested elements
                    if (children) {
                        const extracted = extractText(children);
                        if (extracted) return extracted;
                    }

                    // Try to get text from props if available (for Typography and similar components)
                    if (props?.title || props?.label || props?.text) {
                        return String(props.title || props.label || props.text);
                    }
                }
                return "";
            };

            const extractedText = extractText(cellContent);
            // Use extracted text if it's not empty, otherwise fall back to value
            if (extractedText && extractedText.trim()) {
                tooltipText = extractedText.trim();
            } else {
                // If extraction failed, try multiple fallbacks
                if (value != null && String(value).trim()) {
                    tooltipText = String(value).trim();
                } else if (row[column.field] != null && String(row[column.field]).trim()) {
                    // Try getting value directly from row
                    tooltipText = String(row[column.field]).trim();
                } else if (row.raw?.[column.field] != null && String(row.raw[column.field]).trim()) {
                    // Try getting value from raw data
                    tooltipText = String(row.raw[column.field]).trim();
                }
            }
        }

        return (
            <Box
                key={column.field}
                data-column={column.field}
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
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                        column.field === "__rowNumber"
                            ? "center"
                            : "space-between",
                    // If column should use flex, don't set width in sx (let inline styles handle it)
                    // Otherwise use fixed width
                    width:
                        widthConfig.shouldUseFlex !== undefined
                            ? undefined // Don't set width in sx for flex columns - inline styles will handle it
                            : widthConfig.hasBeenResized || !isLastColumn
                                ? `${widthConfig.width}px`
                                : undefined,
                    // Only set minWidth for non-flex columns
                    // Flex columns will have minWidth: 0 to allow full flex distribution
                    minWidth:
                        widthConfig.shouldUseFlex !== undefined
                            ? "0" // Set to 0 for flex columns to allow full flex distribution
                            : `${widthConfig.width}px`,
                    maxWidth:
                        widthConfig.shouldUseFlex !== undefined
                            ? "none" // Remove max-width constraint for flex columns
                            : widthConfig.hasBeenResized || !isLastColumn
                                ? `${widthConfig.width}px`
                                : undefined,
                    ...(widthConfig.shouldUseFlex === undefined && {
                        flexShrink: 0,
                        flexGrow: 0,
                    }),
                    borderLeft:
                        language === "he"
                            ? "none"
                            : colIndex > 0
                                ? `1px solid ${theme.palette.divider}`
                                : "none",
                    borderRight:
                        language === "he"
                            ? colIndex === 0
                                ? "none"
                                : `1px solid ${theme.palette.divider}`
                            : "none",
                    height: "100%",
                    direction: language === "he" ? "rtl" : "ltr",
                    textAlign:
                        column.field === "__rowNumber"
                            ? "center"
                            : language === "he"
                                ? "right"
                                : "left",
                    overflow: "visible",
                    boxSizing: "border-box",
                    backgroundColor: "transparent",
                    "&::before, &::after": {
                        backgroundColor: "transparent",
                    },
                    pointerEvents: "auto",
                    cursor: "pointer",
                    position: "relative",
                    zIndex: 1,
                }}
                onClick={(e) => {
                    const nativeEvent = e.nativeEvent as Event;
                    const path = nativeEvent.composedPath ? nativeEvent.composedPath() : [e.target];

                    for (const element of path) {
                        if (element instanceof HTMLElement && isElementInteractive(element)) {
                            e.stopPropagation();
                            return;
                        }
                    }
                }}
                onMouseDown={(e) => {
                    const nativeEvent = e.nativeEvent as Event;
                    const path = nativeEvent.composedPath ? nativeEvent.composedPath() : [e.target];

                    for (const element of path) {
                        if (element instanceof HTMLElement && isElementInteractive(element)) {
                            e.stopPropagation();
                            return;
                        }
                    }
                }}
            >
                <Box
                    component="span"
                    sx={{
                        overflow: "visible",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        textAlign:
                            column.field === "__rowNumber"
                                ? "center"
                                : "inherit",
                        width: "100%",
                        display: "block",
                        position: "relative",
                        backgroundColor: "transparent !important",
                        pointerEvents: "auto",
                        "& a, & button, & input, & [role='button'], & [role='link'], & [data-interactive='true'], & .MuiButton-root, & .MuiIconButton-root, & .MuiLink-root, & .MuiCheckbox-root, & [onclick]": {
                            pointerEvents: "auto",
                        },
                    }}
                >
                    <TruncatedCell
                        content={cellContent}
                        tooltipText={tooltipText}
                        language={language}
                    />
                </Box>
            </Box>
        );
    },
    (prevProps, nextProps) => {
        // Custom comparison function for memoization
        return (
            prevProps.column.field === nextProps.column.field &&
            prevProps.value === nextProps.value &&
            prevProps.row.id === nextProps.row.id &&
            prevProps.widthConfig.width === nextProps.widthConfig.width &&
            prevProps.widthConfig.hasBeenResized ===
            nextProps.widthConfig.hasBeenResized &&
            prevProps.widthConfig.shouldUseFlex === nextProps.widthConfig.shouldUseFlex &&
            prevProps.isLastColumn === nextProps.isLastColumn &&
            prevProps.colIndex === nextProps.colIndex &&
            prevProps.language === nextProps.language &&
            prevProps.onRenderCell === nextProps.onRenderCell
        );
    }
);

DataGridCell.displayName = "DataGridCell";

export default DataGridCell;
