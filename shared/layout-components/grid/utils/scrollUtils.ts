import { GRID_CONSTANTS } from "../constants";

/**
 * Calculate if load more should be triggered based on scroll position
 */
export const calculateLoadMoreTrigger = (
    loadedRowsHeight: number,
    scrollTop: number,
    containerHeight: number,
    threshold: number = GRID_CONSTANTS.LOAD_MORE_THRESHOLD
): boolean => {
    const distanceFromBottom = loadedRowsHeight - scrollTop - containerHeight;
    return distanceFromBottom < threshold;
};
