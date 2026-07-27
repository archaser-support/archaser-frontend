import React from "react";
import { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { HighlightText } from "../components/HighlightText";

/**
 * Helper function to recursively enhance React elements with highlighting
 */
const enhanceElementWithHighlighting = (
    element: React.ReactElement,
    searchTerm: string,
    language: string = "en"
): React.ReactElement => {
    if (!React.isValidElement(element)) {
        return element;
    }

    const props = element.props as any;
    const children = props.children;

    // If children is a string, highlight it
    if (typeof children === "string") {
        return React.cloneElement(element as React.ReactElement<any>, {
            children: (
                <HighlightText
                    text={children}
                    searchTerm={searchTerm}
                    language={language}
                />
            ),
        });
    }

    // If children is an array, recursively enhance each child
    if (Array.isArray(children)) {
        const enhancedChildren = children.map((child, index) => {
            if (typeof child === "string") {
                return (
                    <HighlightText
                        key={index}
                        text={child}
                        searchTerm={searchTerm}
                        language={language}
                    />
                );
            }
            if (React.isValidElement(child)) {
                const enhanced = enhanceElementWithHighlighting(
                    child,
                    searchTerm,
                    language
                );
                // Remapping children requires stable keys (cloneElement drops them).
                return React.cloneElement(enhanced, {
                    key: child.key ?? `highlight-child-${index}`,
                });
            }
            return child;
        });

        return React.cloneElement(element as React.ReactElement<any>, {
            children: enhancedChildren,
        });
    }

    // If children is a single React element, recursively enhance it
    if (React.isValidElement(children)) {
        return React.cloneElement(element as React.ReactElement<any>, {
            children: enhanceElementWithHighlighting(
                children,
                searchTerm,
                language
            ),
        });
    }

    return element;
};

/**
 * Utility function to enhance columns with search highlighting
 */
export const enhanceColumnsWithHighlighting = (
    columns: GridColDef[],
    searchTerm: string,
    language: string = "en"
): GridColDef[] => {
    if (!searchTerm) return columns;

    return columns.map((column) => {
        // Skip highlighting only for actions column
        if (column.field === "actions") {
            return column;
        }

        const originalRenderCell = column.renderCell;

        return {
            ...column,
            renderCell: (params: GridRenderCellParams) => {
                // If there's a custom renderCell, try to enhance it with highlighting
                if (originalRenderCell) {
                    const originalResult = originalRenderCell(params);

                    // If the result is a React element, try to find and highlight text content
                    if (React.isValidElement(originalResult)) {
                        return enhanceElementWithHighlighting(
                            originalResult,
                            searchTerm,
                            language
                        );
                    }

                    return originalResult;
                }

                // Default highlighting for simple text values
                return (
                    <HighlightText
                        text={String(params.value || "")}
                        searchTerm={searchTerm}
                        language={language}
                    />
                );
            },
        };
    });
};
