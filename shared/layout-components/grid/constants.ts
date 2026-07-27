/**
 * Constants for EndlessScrollDataGrid
 */

export const GRID_CONSTANTS = {
    OVERSCAN: 5, // Extra items to render outside viewport
    LOAD_MORE_THRESHOLD: 400, // pixels from bottom - increased to trigger earlier
    LOAD_MORE_DEBOUNCE: 100, // milliseconds - reduced for faster response
    DEFAULT_PAGE_SIZE: 20, // Default number of records per page
    SCROLL_DEBOUNCE_DELAY: 150, // milliseconds - delay before syncing after scroll stops
    LOADING_MORE_TIMEOUT: 300, // milliseconds - timeout for loading more indicator
} as const;

// Common breakpoint values
export const BREAKPOINTS = {
    MOBILE: 768,
    TABLET: 1024,
    DESKTOP: 1200,
} as const;
