import { chartCssVars } from "./chartColors";

/**
 * Light-theme design tokens for the portfolio-health Tailwind island.
 * Primary / secondary chart colors live in `chartColors.ts`.
 */
export const CPH = {
    bg: "#F7F8FA",
    card: "#FFFFFF",
    surfaceMuted: "#F1F4F8",
    border: "#E4E8F0",
    shadow: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)",
    ink: "#101828",
    /** UI secondary text (labels, axis ticks). */
    slate: "#64748B",
    muted: "#94A3B8",

    /** Critical / negative — violations, at-risk exposure, over-100% bars. */
    critical: "#DC2626",
    criticalTint: "#FDECEC",
    /** Chart area fill under critical series (darker than criticalTint). */
    criticalArea: "#FCA5A5",
    criticalText: "#991B1B",

    /** Positive / good status — fully compliant, approved footprint. */
    good: "#16A34A",
    goodDim: "#15803D",
    goodTint: "#DCFCE7",
    goodText: "#14532D",

    /** Neutral secondary chart line — Total AR, Named customers. */
    seriesSlate: "#475569",

    /** Alternate comparison series — e.g. SDL avg utilization. */
    seriesBlue: "#2563EB",

    /** Okabe–Ito chart series — color-blind-safe (orange, sky, reddish purple). */
    seriesOrange: "#E69F00",
    seriesSky: "#56B4E9",
    seriesRose: "#CC79A7",
} as const;

export type IslandAccent =
    | "primary"
    | "secondary"
    | "critical"
    | "good"
    | "slate";

export function accentColor(accent: IslandAccent): string {
    switch (accent) {
        case "primary":
            return chartCssVars.primary;
        case "secondary":
            return chartCssVars.secondary;
        case "critical":
            return CPH.critical;
        case "good":
            return CPH.good;
        case "slate":
        default:
            return CPH.slate;
    }
}
