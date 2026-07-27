export const ITEM_HEIGHT = 48;
export const CONTAINER_HEIGHT = 408; // 7.5 records + header (48 * 8.5 = 408)

export const RESPONSIVE_CONTAINER_HEIGHT = {
    xs: 300,
    sm: 360,
    md: CONTAINER_HEIGHT,
};

interface HeightOptions {
    rows: any[];
    height?: { xs: number; sm: number; md: number };
    visibleRows?: number;
    fillViewport: boolean;
    viewportHeight: number | null;
}

/**
 * Calculate dynamic container height based on various options
 */
export const calculateDynamicHeight = ({
    rows,
    height,
    visibleRows,
    fillViewport,
    viewportHeight,
}: HeightOptions): number => {
    // Always prioritize empty state - use smaller height when no records
    // This ensures all tables automatically get smaller height when empty
    if (rows.length === 0) {
        // If fillViewport is enabled, use viewport height
        if (fillViewport && viewportHeight !== null) {
            return viewportHeight;
        }
        // If height prop is provided for empty state, use it; otherwise use default
        if (height) {
            return height.md; // Use the provided height for empty state
        }
        // If visibleRows is provided, calculate height based on it
        if (visibleRows) {
            return ITEM_HEIGHT + visibleRows * ITEM_HEIGHT; // Header + rows
        }
        return 200; // Default smaller height for empty state
    }

    // Priority 1: If fillViewport is enabled, use viewport height (takes highest precedence)
    if (fillViewport && viewportHeight !== null) {
        return viewportHeight;
    }

    // Priority 2: If height prop is provided and not empty, use it
    if (height) {
        return height.md;
    }

    // Priority 3: If visibleRows prop is provided, calculate height based on it
    if (visibleRows) {
        const headerHeight = ITEM_HEIGHT; // Header height
        const recordsHeight = visibleRows * ITEM_HEIGHT; // Height for visible rows
        return headerHeight + recordsHeight;
    }

    // Priority 4: If less than 10 records, calculate height based on number of records
    if (rows.length > 0 && rows.length < 10) {
        const headerHeight = ITEM_HEIGHT; // Header height
        const recordsHeight = rows.length * ITEM_HEIGHT; // Height for actual records
        const minHeight = 200; // Minimum height
        const maxHeight = CONTAINER_HEIGHT; // Maximum height (default)

        const calculatedHeight = headerHeight + recordsHeight;
        return Math.max(minHeight, Math.min(calculatedHeight, maxHeight));
    }

    // Priority 5: For 10 or more records, always use the fixed height to show 6 records
    return CONTAINER_HEIGHT;
};

/**
 * Calculate responsive heights for loading/empty states
 */
export const getResponsiveHeights = ({
    rows,
    height,
    visibleRows,
    fillViewport,
    viewportHeight,
}: HeightOptions): { xs: string; sm: string; md: string } => {
    // If fillViewport is enabled, use viewport height for all breakpoints
    if (fillViewport && viewportHeight !== null) {
        return {
            xs: `${viewportHeight}px`,
            sm: `${viewportHeight}px`,
            md: `${viewportHeight}px`,
        };
    }

    // Always prioritize empty state - use smaller height when no records
    // This ensures all tables automatically get smaller height when empty
    if (rows.length === 0) {
        // If height prop is provided for empty state, use it; otherwise use default
        if (height) {
            return {
                xs: `${height.xs}px`,
                sm: `${height.sm}px`,
                md: `${height.md}px`,
            };
        }
        // If visibleRows is provided, calculate height based on it
        if (visibleRows) {
            const calculatedHeight = ITEM_HEIGHT + visibleRows * ITEM_HEIGHT;
            return {
                xs: `${calculatedHeight}px`,
                sm: `${calculatedHeight}px`,
                md: `${calculatedHeight}px`,
            };
        }
        return { xs: `200px`, sm: `200px`, md: `200px` };
    }

    // Priority 1: If height prop is provided and not empty, use it (takes precedence)
    if (height) {
        return {
            xs: `${height.xs}px`,
            sm: `${height.sm}px`,
            md: `${height.md}px`,
        };
    }

    // Priority 2: If visibleRows prop is provided, calculate height based on it
    if (visibleRows) {
        const headerHeight = ITEM_HEIGHT;
        const recordsHeight = visibleRows * ITEM_HEIGHT;
        const calculatedHeight = headerHeight + recordsHeight;
        return {
            xs: `${calculatedHeight}px`,
            sm: `${calculatedHeight}px`,
            md: `${calculatedHeight}px`,
        };
    }

    // Priority 3: Dynamic height calculation for small datasets
    if (rows.length > 0 && rows.length < 10) {
        const headerHeight = ITEM_HEIGHT;
        const recordsHeight = rows.length * ITEM_HEIGHT;
        const minHeight = 200;
        const maxHeight = CONTAINER_HEIGHT;

        const calculatedHeight = Math.max(
            minHeight,
            Math.min(headerHeight + recordsHeight, maxHeight)
        );

        return {
            xs: `${Math.min(calculatedHeight, RESPONSIVE_CONTAINER_HEIGHT.xs)}px`,
            sm: `${Math.min(calculatedHeight, RESPONSIVE_CONTAINER_HEIGHT.sm)}px`,
            md: `${calculatedHeight}px`,
        };
    }

    // Priority 4: Default responsive heights
    return {
        xs: `${RESPONSIVE_CONTAINER_HEIGHT.xs}px`,
        sm: `${RESPONSIVE_CONTAINER_HEIGHT.sm}px`,
        md: `${RESPONSIVE_CONTAINER_HEIGHT.md}px`,
    };
};
