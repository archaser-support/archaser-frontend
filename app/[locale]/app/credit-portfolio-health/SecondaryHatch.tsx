"use client";

import { useId } from "react";

import { CHART_HATCH_SECONDARY, chartColors } from "./chartColors";

/**
 * Per-chart hatch pattern for the secondary series. Pattern ids must be unique
 * per chart instance, and `useId()` output contains characters that break `url(#…)`.
 */
export function useSecondaryHatch() {
    const patternId = `hatch-secondary-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
    const secondaryFill = CHART_HATCH_SECONDARY
        ? `url(#${patternId})`
        : chartColors.secondary;
    return { patternId, secondaryFill };
}

export function SecondaryHatchDefs({ patternId }: { patternId: string }) {
    if (!CHART_HATCH_SECONDARY) {
        return null;
    }
    return (
        <defs>
            <pattern
                id={patternId}
                width="8"
                height="8"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
            >
                <rect width="8" height="8" fill={chartColors.secondary} />
                <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="8"
                    stroke="rgba(255,255,255,0.45)"
                    strokeWidth="3"
                />
            </pattern>
        </defs>
    );
}

/** HTML legend swatch that follows the secondary series fill (solid or hatched). */
export function SecondarySwatch({
    secondaryFill,
    size = 10,
}: {
    secondaryFill: string;
    size?: number;
}) {
    return (
        <svg width={size} height={size} aria-hidden style={{ flexShrink: 0 }}>
            <rect width={size} height={size} rx={2} fill={secondaryFill} />
        </svg>
    );
}
