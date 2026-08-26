export type OverflowBoxMetrics = {
    scrollHeight: number;
    clientHeight: number;
    offsetWidth: number;
    clientWidth: number;
};

/**
 * Vertical overflow gutter in CSS pixels. 0 when the body does not scroll.
 */
export function measureOverflowScrollbarWidth(
    container: OverflowBoxMetrics
): number {
    if (container.scrollHeight <= container.clientHeight) {
        return 0;
    }
    return Math.max(0, container.offsetWidth - container.clientWidth);
}

/**
 * Skip setState when the measured gutter is unchanged so ResizeObserver
 * cannot loop through header padding ↔ body width.
 */
export function nextScrollbarPaddingPx(
    previous: number,
    measured: number
): number {
    return previous === measured ? previous : measured;
}

/**
 * IntersectionObserver fires again if the observer is re-attached while the
 * grid is on screen. Only treat hidden → visible as a layout-sync event.
 */
export function shouldNotifyGridBecameVisible(
    wasIntersecting: boolean,
    isIntersecting: boolean
): boolean {
    return isIntersecting && !wasIntersecting;
}
