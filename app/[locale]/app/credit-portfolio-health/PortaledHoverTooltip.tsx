"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

type PortaledHoverTooltipProps = {
    active?: boolean;
    coordinate?: { x: number; y: number };
    chartEl?: HTMLElement | null;
    estimatedWidth?: number;
    estimatedHeight?: number;
    children: ReactNode;
};

/** Viewport-fixed hover box so Recharts tooltips escape IslandCard overflow:hidden. */
export function PortaledHoverTooltip({
    active,
    coordinate,
    chartEl,
    estimatedWidth = 280,
    estimatedHeight = 160,
    children,
}: PortaledHoverTooltipProps) {
    if (!active) {
        return null;
    }

    const chartRect = chartEl?.getBoundingClientRect();
    const rawLeft = (chartRect?.left ?? 0) + (coordinate?.x ?? 0) + 12;
    const rawTop = (chartRect?.top ?? 0) + (coordinate?.y ?? 0) + 12;
    const viewW =
        typeof window === "undefined"
            ? rawLeft + estimatedWidth
            : window.innerWidth;
    const viewH =
        typeof window === "undefined"
            ? rawTop + estimatedHeight
            : window.innerHeight;
    const left = Math.min(
        Math.max(8, rawLeft),
        viewW - estimatedWidth - 8
    );
    const top = Math.min(
        Math.max(8, rawTop),
        viewH - estimatedHeight - 8
    );

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
