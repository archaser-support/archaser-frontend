"use client";

import type { ReactNode } from "react";
import { usePlotArea } from "recharts";

import { CPH } from "./designTokens";

/**
 * Recharts CartesianGrid draws category lines through tick centers (bar
 * midlines). Draw dashed lines on equal-band boundaries via usePlotArea.
 */
export function BetweenBarDividers({ rowCount }: { rowCount: number }) {
    const plot = usePlotArea();
    if (
        plot == null ||
        rowCount < 2 ||
        !(plot.height > 0) ||
        !(plot.width > 0)
    ) {
        return null;
    }
    const x1 = plot.x;
    const x2 = plot.x + plot.width;
    const band = plot.height / rowCount;
    const lines: ReactNode[] = [];
    for (let i = 1; i < rowCount; i++) {
        const y = plot.y + band * i;
        lines.push(
            <line
                key={`divider-${i}`}
                x1={x1}
                x2={x2}
                y1={y}
                y2={y}
                stroke={CPH.border}
                strokeDasharray="3 6"
                strokeWidth={1}
                pointerEvents="none"
            />
        );
    }
    return <g className="recharts-between-bar-dividers">{lines}</g>;
}
