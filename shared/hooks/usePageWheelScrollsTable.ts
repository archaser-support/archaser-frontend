import { useEffect, useRef, type RefObject } from "react";

type ContainerRef = RefObject<HTMLElement | null>;

/** Elements that scroll on their own; wheel events over them are left alone. */
const SELF_SCROLLING_POPUP_SELECTOR =
    '[role="dialog"], [role="listbox"], [role="menu"]';

const findScrollableChild = (ref: ContainerRef): HTMLElement | null => {
    if (!ref.current) return null;

    const allDivs = ref.current.querySelectorAll<HTMLElement>("div");
    for (const div of Array.from(allDivs)) {
        const style = window.getComputedStyle(div);
        if (
            (style.overflowY === "auto" || style.overflowY === "scroll") &&
            div.scrollHeight > div.clientHeight
        ) {
            return div;
        }
    }
    return null;
};

const isInViewport = (el: HTMLElement): boolean => {
    const rect = el.getBoundingClientRect();
    return (
        rect.top < window.innerHeight &&
        rect.bottom > 0 &&
        rect.width > 0 &&
        rect.height > 0
    );
};

/**
 * Routes page-wide vertical mouse-wheel scrolling into the table's scroll
 * container, so the user can scroll the grid from anywhere on the page.
 * With several refs, the first visible scrollable table wins.
 */
export function usePageWheelScrollsTable(
    containerRefs: ContainerRef | ContainerRef[]
): void {
    const containerRefsRef = useRef(containerRefs);
    useEffect(() => {
        containerRefsRef.current = containerRefs;
    });

    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            const current = containerRefsRef.current;
            const refs = Array.isArray(current) ? current : [current];

            const eventTarget = e.target instanceof Element ? e.target : null;
            if (eventTarget?.closest(SELF_SCROLLING_POPUP_SELECTOR)) {
                return;
            }

            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                return;
            }

            let container: HTMLElement | null = null;
            for (const ref of refs) {
                const candidate = findScrollableChild(ref);
                if (candidate && isInViewport(candidate)) {
                    container = candidate;
                    break;
                }
            }
            if (!container) return;

            const { scrollTop, scrollHeight, clientHeight } = container;
            const canScrollUp = scrollTop > 0;
            const canScrollDown = scrollTop < scrollHeight - clientHeight;

            if ((e.deltaY > 0 && canScrollDown) || (e.deltaY < 0 && canScrollUp)) {
                e.preventDefault();
                e.stopPropagation();
                container.scrollTop += e.deltaY;
            }
        };

        window.addEventListener("wheel", handleWheel, { passive: false });
        return () => window.removeEventListener("wheel", handleWheel);
    }, []);
}
