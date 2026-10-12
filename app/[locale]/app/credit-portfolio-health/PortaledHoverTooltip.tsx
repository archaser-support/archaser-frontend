"use client";

import type { ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";

type PortaledHoverTooltipProps = {
    active?: boolean;
    coordinate?: { x: number; y: number };
    /** Prefer `chartElRef` so positioning always reads the live node. */
    chartEl?: HTMLElement | null;
    chartElRef?: RefObject<HTMLElement | null>;
    estimatedWidth?: number;
    estimatedHeight?: number;
    children: ReactNode;
};

/** Origin for Recharts coordinates — the wrapper, not a scroll parent. */
function chartOriginRect(el: HTMLElement | null): DOMRect | null {
    if (el == null) {
        return null;
    }
    const wrapper = el.classList.contains("recharts-wrapper")
        ? el
        : el.querySelector<HTMLElement>(".recharts-wrapper");
    return (wrapper ?? el).getBoundingClientRect();
}

/** Viewport-fixed hover box so Recharts tooltips escape IslandCard overflow:hidden. */
export function PortaledHoverTooltip({
    active,
    coordinate,
    chartEl,
    chartElRef,
    estimatedWidth = 280,
    estimatedHeight = 160,
    children,
}: PortaledHoverTooltipProps) {
    if (!active) {
        return null;
    }

    const el = chartElRef?.current ?? chartEl ?? null;
    const chartRect = chartOriginRect(el);
    const offset = 12;
    const cx = coordinate?.x ?? 0;
    const cy = coordinate?.y ?? 0;
    let left = (chartRect?.left ?? 0) + cx + offset;
    let top = (chartRect?.top ?? 0) + cy + offset;
    const viewW =
        typeof window === "undefined"
            ? left + estimatedWidth
            : window.innerWidth;
    const viewH =
        typeof window === "undefined"
            ? top + estimatedHeight
            : window.innerHeight;

    // Flip beside/above the cursor when the preferred corner would overflow.
    if (left + estimatedWidth + 8 > viewW) {
        left = (chartRect?.left ?? 0) + cx - estimatedWidth - offset;
    }
    if (top + estimatedHeight + 8 > viewH) {
        top = (chartRect?.top ?? 0) + cy - estimatedHeight - offset;
    }
    left = Math.min(Math.max(8, left), viewW - estimatedWidth - 8);
    top = Math.min(Math.max(8, top), viewH - estimatedHeight - 8);

    const node = (
        <div
            style={{
                position: "fixed",
                left,
                top,
                zIndex: 1300,
                pointerEvents: "none",
            }}
        >
            {children}
        </div>
    );

    if (typeof document === "undefined") {
        return node;
    }
    return createPortal(node, document.body);
}
