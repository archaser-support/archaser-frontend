/**
 * Color-blind-safe chart palette (Okabe–Ito, blue + orange) for the
 * portfolio-health dashboard. Use hex values in Recharts / SVG props and
 * `chartCssVars` for HTML (cards, KPI numbers, HTML legends).
 * Keep the `--chart-*` variables in `cph-utilities.css` in sync.
 */
export const chartColors = {
    primary: "#0072B2", // health line, compliant; "Policy limit", "Of customers"
    secondary: "#E69F00", // at-risk; "Top-up", "Of usage"
    primaryText: "#005A8C", // blue used as text
    secondaryText: "#B45309", // orange used as text (WCAG AA on white)
    danger: "#D55E00", // threshold line, below-threshold markers/zone
    reference: "#4B5563", // period average line
    primaryTint: "#DCEBF5",
    secondaryTint: "#FCEFD6",
    marker: "#111111", // total AR line, active dots
    markerRing: "#FFFFFF",
    muted: "#9CA3AF", // carried-forward days
    segmentGap: "#FFFFFF",
    grid: "#E5E7EB",
    axisText: "#4B5563",
    valueLabel: "#1F2937",
    series: [
        "#0072B2",
        "#E69F00",
        "#56B4E9",
        "#009E73",
        "#D55E00",
        "#CC79A7",
        "#000000",
    ],
} as const;

export const CHART_HATCH_SECONDARY = false;

export const chartCssVars = {
    primary: "var(--chart-primary)",
    secondary: "var(--chart-secondary)",
    primaryText: "var(--chart-primary-text)",
    secondaryText: "var(--chart-secondary-text)",
    primaryTint: "var(--chart-primary-tint)",
    secondaryTint: "var(--chart-secondary-tint)",
} as const;
