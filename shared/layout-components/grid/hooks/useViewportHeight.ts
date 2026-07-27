import { useState, useEffect, useRef } from "react";
import { UseViewportHeightOptions } from "../types";

/**
 * Bottom Y coordinate for fillViewport: prefer the app shell `<main>` inner bottom
 * (padding excluded) so grids align with the scrollable content area. Falls back to
 * `window.innerHeight` when not inside `main` (e.g. tests, embedded views).
 */
function getFillViewportBottomBound(wrapperEl: HTMLElement): number {
    const mainEl = wrapperEl.closest("main");
    if (mainEl instanceof HTMLElement) {
        const rect = mainEl.getBoundingClientRect();
        const padBottom = parseFloat(
            window.getComputedStyle(mainEl).paddingBottom || "0"
        );
        return rect.bottom - (Number.isFinite(padBottom) ? padBottom : 0);
    }
    return window.innerHeight;
}

/** Toolbar block height inside the grid wrapper (element + margin-bottom). */
function getToolbarBlockHeight(
    wrapperEl: HTMLElement,
    hideToolbar: boolean
): number {
    if (hideToolbar) {
        return 0;
    }
    const toolbarEl = wrapperEl.querySelector(".endless-scroll-toolbar");
    if (!(toolbarEl instanceof HTMLElement)) {
        return 0;
    }
    const rect = toolbarEl.getBoundingClientRect();
    const marginBottom = parseFloat(
        window.getComputedStyle(toolbarEl).marginBottom || "0"
    );
    return rect.height + (Number.isFinite(marginBottom) ? marginBottom : 0);
}

export const useViewportHeight = ({
    fillViewport,
    hideToolbar,
    isLoading,
    wrapperRef,
    viewportRecalcDependency,
}: UseViewportHeightOptions): number | null => {
    const [viewportHeight, setViewportHeight] = useState<number | null>(null);
    const prevIsLoadingRef = useRef(isLoading);

    // Calculate viewport height for fillViewport
    useEffect(() => {
        if (!fillViewport) {
            setViewportHeight(null);
            return;
        }

        const calculateViewportHeight = () => {
            if (typeof window === "undefined" || !wrapperRef.current) {
                return;
            }

            const bottomBound = getFillViewportBottomBound(
                wrapperRef.current
            );

            // Get the wrapper element's position from top
            const wrapperRect = wrapperRef.current.getBoundingClientRect();
            const toolbarBlockHeight = getToolbarBlockHeight(
                wrapperRef.current,
                hideToolbar
            );
            // Grid bordered box starts below the toolbar
            const gridTop = wrapperRect.top + toolbarBlockHeight;

            const availableHeight = bottomBound - gridTop;

            // Ensure minimum height
            const minHeight = 200;
            const calculatedHeight = Math.max(minHeight, availableHeight);

            setViewportHeight(calculatedHeight);
        };

        // Use requestAnimationFrame to ensure calculation happens after layout is complete
        // This ensures all components above (PageHeader, Stats, etc.) have rendered
        const rafId = requestAnimationFrame(() => {
            // Add a delay to ensure layout is fully stable
            setTimeout(calculateViewportHeight, 100);
        });

        // Also calculate immediately and after a short delay to catch different render stages
        calculateViewportHeight();
        const delayedCalc = setTimeout(calculateViewportHeight, 200);

        // Delayed recalc so grid aligns to bottom after layout settles (e.g. PageHeader
        // animation, client nav). ResizeObserver only sees size changes, not position.
        const delayedRecalcA = setTimeout(calculateViewportHeight, 450);
        const delayedRecalcB = setTimeout(calculateViewportHeight, 900);
        const delayedRecalcC = setTimeout(calculateViewportHeight, 1200);
        const delayedRecalcD = setTimeout(calculateViewportHeight, 1800);

        // Use ResizeObserver to watch for layout changes
        let resizeObserver: ResizeObserver | null = null;
        if (wrapperRef.current && typeof ResizeObserver !== "undefined") {
            resizeObserver = new ResizeObserver(() => {
                // Debounce resize observer calls
                requestAnimationFrame(() => {
                    calculateViewportHeight();
                });
            });
            resizeObserver.observe(wrapperRef.current);
            // Siblings above (PageHeader, etc.) can change this element's Y without changing
            // its width/height — RO on the wrapper never fires. Observe layout shifts in main.
            const mainEl = wrapperRef.current.closest("main");
            if (mainEl instanceof HTMLElement && mainEl !== wrapperRef.current) {
                resizeObserver.observe(mainEl);
            }
        }

        const onWindowResize = () => calculateViewportHeight();
        const onWindowScroll = () => calculateViewportHeight();

        window.addEventListener("resize", onWindowResize);
        window.addEventListener("scroll", onWindowScroll, true);

        const mainScrollEl =
            wrapperRef.current?.closest("main") ?? null;
        const onMainScroll = () => calculateViewportHeight();
        if (mainScrollEl instanceof HTMLElement) {
            mainScrollEl.addEventListener("scroll", onMainScroll, {
                passive: true,
            });
        }

        return () => {
            cancelAnimationFrame(rafId);
            clearTimeout(delayedCalc);
            clearTimeout(delayedRecalcA);
            clearTimeout(delayedRecalcB);
            clearTimeout(delayedRecalcC);
            clearTimeout(delayedRecalcD);
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
            window.removeEventListener("resize", onWindowResize);
            window.removeEventListener("scroll", onWindowScroll, true);
            if (mainScrollEl instanceof HTMLElement) {
                mainScrollEl.removeEventListener("scroll", onMainScroll);
            }
        };
    }, [fillViewport, hideToolbar, wrapperRef, viewportRecalcDependency]);

    // Recalculate viewport height when loading completes (layout might have changed)
    // This handles cases where content above (like stats) loads after the initial render
    useEffect(() => {
        const wasLoading = prevIsLoadingRef.current;
        prevIsLoadingRef.current = isLoading;

        if (!fillViewport || !wrapperRef.current) {
            return;
        }

        // Recalculate when loading transitions from true to false
        // This ensures layout is recalculated after data and content above have loaded
        if (wasLoading && !isLoading) {
            const calculateHeight = () => {
                if (!wrapperRef.current) return;

                const bottomBound = getFillViewportBottomBound(
                    wrapperRef.current
                );
                const wrapperRect = wrapperRef.current.getBoundingClientRect();
                const toolbarBlockHeight = getToolbarBlockHeight(
                    wrapperRef.current,
                    hideToolbar
                );
                const gridTop = wrapperRect.top + toolbarBlockHeight;
                const availableHeight = bottomBound - gridTop;
                const minHeight = 200;
                const calculatedHeight = Math.max(minHeight, availableHeight);

                setViewportHeight(calculatedHeight);
            };

            // Use requestAnimationFrame to ensure calculation happens after paint
            let timeoutId: ReturnType<typeof setTimeout> | null = null;
            const rafId = requestAnimationFrame(() => {
                // Add a small delay to ensure all content above has rendered
                timeoutId = setTimeout(calculateHeight, 100);
            });

            return () => {
                cancelAnimationFrame(rafId);
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
            };
        }
    }, [isLoading, fillViewport, hideToolbar, wrapperRef]);

    return viewportHeight;
};
