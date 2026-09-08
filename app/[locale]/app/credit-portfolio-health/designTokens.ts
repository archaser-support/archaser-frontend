/** Light-theme design tokens for the portfolio-health Tailwind island. */
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

    /** Primary / neutral metric — health rings, main chart lines, "of customers" bars. */
    teal: "#0F766E",
    tealDim: "#0D5F59",
    tealTint: "#CCFBF1",
    tealText: "#134E4A",

    /** Caution / warning — threshold lines, mid-range / "of usage" bars. */
    violet: "#7C3AED",
    violetDim: "#6D28D9",
    violetTint: "#EDE9FE",
    violetText: "#5B21B6",

    /** Critical / negative — violations, uncovered exposure, over-100% bars. */
    critical: "#DC2626",
    criticalTint: "#FDECEC",
    criticalText: "#991B1B",

    /** Positive / good status — fully covered, approved footprint. */
    good: "#16A34A",
    goodDim: "#15803D",
    goodTint: "#DCFCE7",
    goodText: "#14532D",

    /** Neutral secondary chart line — Total AR, Issuer avg. */
    seriesSlate: "#475569",

    /** Alternate comparison series — e.g. SDL avg utilization. */
    seriesBlue: "#2563EB",
} as const;

export type IslandAccent = "teal" | "violet" | "critical" | "good" | "slate";

export function accentColor(accent: IslandAccent): string {
    switch (accent) {
        case "teal":
            return CPH.teal;
        case "violet":
            return CPH.violet;
        case "critical":
            return CPH.critical;
        case "good":
            return CPH.good;
        case "slate":
        default:
            return CPH.slate;
    }
}
