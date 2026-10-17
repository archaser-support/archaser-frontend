import type { Theme } from "@mui/material/styles";
import { alpha, darken, lighten } from "@mui/material/styles";

/**
 * Categorical colors for entity breakdown charts (bar + donut).
 * Built from the account accent set (chart + primary + secondary) so the
 * dashboard stays on-brand while neighboring slices stay easy to tell apart.
 */
export function getEntityChartColors(theme: Theme): string[] {
    const chart = theme.palette.chartPalette;
    const primary = theme.palette.primary;
    const secondary = theme.palette.secondary;

    return [
        chart.dark,
        primary.main,
        secondary.main,
        chart.main,
        darken(secondary.main, 0.15),
        lighten(primary.main, 0.2),
        chart.light,
        alpha(chart.main, 0.75),
        alpha(primary.main, 0.7),
        alpha(secondary.main, 0.7),
        lighten(chart.main, 0.35),
        darken(primary.main, 0.2),
    ];
}
