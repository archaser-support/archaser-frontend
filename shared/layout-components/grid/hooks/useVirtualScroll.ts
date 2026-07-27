import { useState, useEffect, useMemo } from "react";
import {
    UseVirtualScrollOptions,
    UseVirtualScrollReturn,
    VirtualScrollState,
    VirtualScrollMetrics,
} from "../types";

const DEFAULT_OVERSCAN = 5;

export const useVirtualScroll = ({
    rows,
    containerHeight,
    itemHeight,
    overscan = DEFAULT_OVERSCAN,
    totalRecords, // Add this
}: UseVirtualScrollOptions): UseVirtualScrollReturn => {
    // Use totalRecords for scrollbar height, but rows.length for rendering
    const totalItemsForScrollbar = totalRecords ?? rows.length;
    const totalItemsForRendering = rows.length;

    // State
    const [scrollState, setScrollState] = useState<VirtualScrollState>({
        scrollTop: 0,
        containerHeight: containerHeight,
        itemHeight: itemHeight,
        totalItems: totalItemsForScrollbar, // Use totalRecords for scrollbar
    });

    // Update container height when it changes
    useEffect(() => {
        setScrollState((prev) => ({
            ...prev,
            containerHeight: containerHeight,
            totalItems: totalItemsForScrollbar, // Use totalRecords for scrollbar
        }));
    }, [containerHeight, totalItemsForScrollbar]);

    // Update totalItems when totalRecords changes (not rows.length)
    useEffect(() => {
        setScrollState((prev) => ({
            ...prev,
            totalItems: totalItemsForScrollbar,
        }));
    }, [totalItemsForScrollbar]);

    // Calculate virtual scroll metrics
    const virtualMetrics = useMemo(() => {
        const { scrollTop, containerHeight, itemHeight, totalItems } =
            scrollState;

        // Use rows.length for calculating visible range (what to render)
        const startIndex = Math.max(
            0,
            Math.floor(scrollTop / itemHeight) - overscan
        );
        const endIndex = Math.min(
            totalItemsForRendering - 1, // Use rows.length for rendering
            Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
        );

        const visibleItems = rows.slice(startIndex, endIndex + 1);
        const offsetY = startIndex * itemHeight;

        // Use totalItems (totalRecords) for scrollbar height calculation
        const totalHeight = totalItems * itemHeight;

        return {
            startIndex,
            endIndex,
            visibleItems,
            offsetY,
            totalHeight, // This uses totalRecords, so scrollbar stays consistent
            visibleCount: endIndex - startIndex + 1,
        };
    }, [
        scrollState,
        rows,
        overscan,
        totalItemsForRendering,
        totalItemsForScrollbar,
    ]);

    return {
        scrollState,
        setScrollState,
        virtualMetrics,
    };
};
