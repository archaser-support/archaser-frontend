import { GridColDef } from "@mui/x-data-grid";

/**
 * Calculate the effective width of a column
 * Priority: resized width > column.width > minWidth > 150 (default)
 */
export const calculateColumnWidth = (
    column: GridColDef,
    columnWidths: Record<string, number>
): number => {
    // If column has been manually resized, use that width
    if (columnWidths[column.field] !== undefined) {
        return columnWidths[column.field];
    }

    // Otherwise, use column's width, minWidth, or default
    return column.width || column.minWidth || 150;
};

/**
 * Check if a column has been manually resized
 */
export const hasColumnBeenResized = (
    column: GridColDef,
    columnWidths: Record<string, number>
): boolean => {
    return columnWidths[column.field] !== undefined;
};

/**
 * Get column width configuration
 */
export const getColumnWidthConfig = (
    column: GridColDef,
    columnWidths: Record<string, number>,
    isLastColumn: boolean,
    isFirstDataColumn: boolean = false
) => {
    const width = calculateColumnWidth(column, columnWidths);
    const hasBeenResized = hasColumnBeenResized(column, columnWidths);

    // Check if column definition has flex property
    const columnHasFlex = column.flex !== undefined && column.flex > 0;

    // Prioritize first data column: give it larger minWidth and prevent flex
    // BUT respect explicit width from report config (if column.width is set, use it)
    const firstDataColumnMinWidth = 250; // Larger default for first column
    const hasExplicitWidth = column.width !== undefined && column.width !== null;
    
    // If column has explicit width from report config, respect it (don't override)
    // If no width is defined for the first column, set it to 250px
    const effectiveMinWidth = isFirstDataColumn && !hasBeenResized && !hasExplicitWidth
        ? firstDataColumnMinWidth
        : column.minWidth || 150;

    // For first data column, don't use flex (give it fixed width priority)
    // Use flex if: column has flex in definition (and not resized), OR it's the last column (and not resized)
    // BUT NOT for first data column (prioritize it with fixed width)
    // UNLESS column has explicit width from report config (respect user's width setting)
    const shouldUseFlex =
        !hasBeenResized &&
            !isFirstDataColumn && // Don't use flex for first data column
            (columnHasFlex || isLastColumn)
            ? column.flex || 1
            : undefined;

    // If no width is defined for the first column, set it to 250px
    // If column has explicit width from report config, use it (don't override with first column minimum)
    const finalWidth = isFirstDataColumn && !hasBeenResized && !hasExplicitWidth
        ? Math.max(width, firstDataColumnMinWidth)
        : width;

    return {
        width: finalWidth,
        hasBeenResized,
        isLastColumn,
        shouldUseFlex,
        minWidth: effectiveMinWidth,
    };
};

/**
 * Get visible columns with row number column inserted
 */
export const getVisibleColumnsWithRowNumber = (
    columns: GridColDef[],
    columnVisibilityModel: Record<string, boolean>,
    rowNumberColumn: GridColDef
): GridColDef[] => {
    const filtered = columns
        .filter((col) => columnVisibilityModel[col.field] !== false)
        .map((col) => {
            if (col.field === "checkbox") {
                return {
                    ...col,
                    width: 40,
                    minWidth: 40,
                    maxWidth: 40,
                };
            }
            return col;
        });

    const checkboxIndex = filtered.findIndex((col) => col.field === "checkbox");

    if (checkboxIndex >= 0) {
        const result = [...filtered];
        result.splice(checkboxIndex + 1, 0, rowNumberColumn);
        return result;
    }

    return [rowNumberColumn, ...filtered];
};
