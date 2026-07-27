import type { Theme } from "@mui/material/styles";
import type { SystemStyleObject } from "@mui/system";

import type {
    CreditDashboardChartCardThemeStyles,
    MetricStatCardIconAccent,
    MetricStatCardThemeStyles,
} from "./types";

/** Shared card corner radius (dashboard, control center, credit metrics). */
export function getMetricStatCardBorderRadius(theme: Theme) {
    return theme.spacing(3);
}

const METRIC_STAT_CARD_ICON_BG: Record<
    MetricStatCardIconAccent,
    { light: string; dark: string }
> = {
    default: { light: "#64748B", dark: "#94A3B8" },
    receivables: { light: "#334155", dark: "#475569" },
    compliant: { light: "#047857", dark: "#10B981" },
    atRisk: { light: "#C2410C", dark: "#FB923C" },
    overdue: { light: "#B91C1C", dark: "#F87171" },
    capacity: { light: "#6D28D9", dark: "#A78BFA" },
    terms: { light: "#A16207", dark: "#FBBF24" },
    noPolicy: { light: "#52525B", dark: "#A1A1AA" },
    reporting: { light: "#0369A1", dark: "#38BDF8" },
    limitWarnings: { light: "#B45309", dark: "#FBBF24" },
    healthIndex: { light: "#0F766E", dark: "#2DD4BF" },
    zeroLimit: { light: "#DC2626", dark: "#EF4444" },
};

function buildCreditDashboardChartCardStyles(
    m: MetricStatCardThemeStyles
): CreditDashboardChartCardThemeStyles {
    return {
        card: (theme, opts) => m.card(theme, opts),
        cardContent: (theme, opts) => ({
            ...m.cardContent(theme),
            ...(opts?.withChartBody
                ? { height: "100%", minHeight: 0 }
                : {}),
        }),
        headerIconLeading: (theme, isRtl, accent) => m.iconBox(theme, isRtl, accent),
        headerTitle: (theme, isRtl) => ({
            ...m.labelTooltipTrigger(theme, isRtl),
            fontSize: "1.125rem",
            fontWeight: 600,
            ml: 0,
            mr: 0,
            display: "block",
            width: "100%",
            textAlign: metricCardTextAlign(isRtl),
        }),
        headerCaption: (theme, isRtl) => ({
            ...m.secondary(theme, isRtl),
            mt: 0,
            mb: 1,
            mx: 0,
            display: "block",
            width: "100%",
            textAlign: metricCardTextAlign(isRtl),
        }),
        headerTitleRow: (theme, isRtl) => metricCardHorizontalRow(theme, isRtl),
        headerTitleInRow: (theme, isRtl) => ({
            ...m.labelTooltipTrigger(theme, isRtl),
            fontSize: "1.125rem",
            fontWeight: 600,
            ml: 0,
            mr: 0,
            display: "inline",
            width: "auto",
            textAlign: metricCardTextAlign(isRtl),
        }),
        headerColumn: (theme, isRtl) => ({
            ...metricIconTextGutter(theme, isRtl),
            direction: isRtl ? "rtl" : "ltr",
            flex: "0 1 auto",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            alignItems: "stretch",
            width: "100%",
            minWidth: 0,
            // Clear the absolutely positioned icon tile (top 14px + 48px height)
            minHeight: `calc(48px + ${theme.spacing(1.75)})`,
            mb: theme.spacing(1),
        }),
    };
}

function metricCardTextAlign(isRtl: boolean): "left" | "right" {
    return isRtl ? "right" : "left";
}

function metricCardHorizontalRow(
    theme: Theme,
    isRtl: boolean
): SystemStyleObject<Theme> {
    return {
        display: "flex",
        flexDirection: isRtl ? "row-reverse" : "row",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: theme.spacing(0.5),
        minWidth: 0,
        // Stable DOM order (title, then icon); row-reverse places the icon left of the title in RTL.
        direction: "ltr",
        ...(isRtl
            ? {
                  width: "auto",
                  maxWidth: "100%",
                  marginInlineStart: "auto",
              }
            : {
                  width: "100%",
                  maxWidth: "100%",
              }),
    };
}

/** Horizontal inset for text beside the 48px absolutely positioned icon tile. */
function metricIconTextGutter(theme: Theme, isRtl: boolean): SystemStyleObject<Theme> {
    const reserve = `calc(48px + ${theme.spacing(1.75)} + ${theme.spacing(0.5)})`;
    return {
        boxSizing: "border-box",
        ...(isRtl
            ? { paddingInlineEnd: reserve, paddingInlineStart: 0 }
            : { paddingInlineEnd: reserve, paddingInlineStart: 0 }),
    };
}

function buildMetricStatCardStyles(): MetricStatCardThemeStyles {
    const labelMuted = (theme: Theme) =>
        theme.palette.mode === "light" ? "#7C8DA1" : theme.palette.text.secondary;
    const metricLabelSlate = (theme: Theme) =>
        theme.palette.mode === "light" ? "#475569" : "#94a3b8";
    const valueEmphasis = (theme: Theme) =>
        theme.palette.mode === "light" ? "#000000" : theme.palette.text.primary;
    const borderMuted = (theme: Theme) =>
        theme.palette.mode === "light" ? "#DCE3EB" : theme.palette.divider;

    const metricLabelBase = (theme: Theme, isRtl: boolean): SystemStyleObject<Theme> => ({
        fontSize: "1rem",
        fontWeight: 500,
        lineHeight: 1.25,
        color: metricLabelSlate(theme),
        mt: 0,
        mx: 0,
        mb: theme.spacing(1),
        display: "block",
        width: "100%",
        maxWidth: "100%",
        wordWrap: "break-word",
        overflowWrap: "break-word",
        hyphens: "auto",
        direction: isRtl ? "rtl" : "ltr",
        textAlign: metricCardTextAlign(isRtl),
    });

    return {
        card: (theme, opts = {}) => {
            const clickable = opts.clickable ?? false;
            const hoverable = opts.hoverable ?? false;
            return {
                height: "100%",
                display: "flex",
                flexDirection: "column",
                background: "#FFFFFF",
                backgroundColor: "#FFFFFF",
                border: "1px solid",
                borderColor: borderMuted(theme),
                borderRadius: getMetricStatCardBorderRadius(theme),
                boxShadow: "none",
                transition: "all 0.3s ease",
                cursor: clickable ? "pointer" : "default",
                ...(clickable || hoverable
                    ? {
                          "&:hover": {
                              transform: "translateY(-4px)",
                              boxShadow: "none",
                              background: "#FFFFFF",
                              backgroundColor: "#FFFFFF",
                              "& .card-icon": {
                                  transform: "scale(1.15) rotate(5deg)",
                              },
                          },
                      }
                    : {}),
            };
        },
        cardContent: (theme) => {
            const inset = theme.spacing(1.5);
            return {
                flex: 1,
                width: "100%",
                boxSizing: "border-box",
                p: inset,
                minHeight: "76px",
                display: "flex",
                flexDirection: "column",
                position: "relative",
                "&:last-child": {
                    paddingBottom: inset,
                },
            };
        },
        iconBox: (theme, isRtl, accent = "default") => {
            const key = accent in METRIC_STAT_CARD_ICON_BG ? accent : "default";
            const bg =
                theme.palette.mode === "light"
                    ? METRIC_STAT_CARD_ICON_BG[key].light
                    : METRIC_STAT_CARD_ICON_BG[key].dark;
            return {
                width: 48,
                height: 48,
                background: bg,
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "none",
                position: "absolute",
                top: 14,
                left: isRtl ? 14 : "auto",
                right: isRtl ? "auto" : 14,
                transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                "& .MuiSvgIcon-root": {
                    color: "#FFFFFF",
                    fontSize: "2rem",
                },
            };
        },
        bodyColumn: (theme, isRtl) => ({
            ...metricIconTextGutter(theme, isRtl),
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "stretch",
            minHeight: 0,
            minWidth: 0,
            width: "100%",
            direction: isRtl ? "rtl" : "ltr",
        }),
        label: metricLabelBase,
        labelRow: (theme, isRtl) => metricCardHorizontalRow(theme, isRtl),
        labelTooltipTrigger: (theme, isRtl) => ({
            ...metricLabelBase(theme, isRtl),
            display: "block",
            width: "100%",
            maxWidth: "100%",
            verticalAlign: "middle",
        }),
        valuesStack: () => ({
            flex: "0 1 auto",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            minHeight: 0,
            minWidth: 0,
            width: "100%",
        }),
        value: (theme, isRtl) => ({
            fontWeight: 700,
            fontSize: "clamp(1rem, 1.4vw + 0.65rem, 1.75rem)",
            color: valueEmphasis(theme),
            lineHeight: 1.15,
            fontFamily: "inherit",
            display: "block",
            width: "100%",
            textAlign: metricCardTextAlign(isRtl),
            maxWidth: "100%",
            whiteSpace: "nowrap",
            overflowWrap: "normal",
            wordBreak: "normal",
        }),
        valueSlot: (theme, isRtl) => ({
            color: valueEmphasis(theme),
            lineHeight: 1,
            display: "block",
            width: "100%",
            textAlign: metricCardTextAlign(isRtl),
            whiteSpace: "nowrap",
            maxWidth: "100%",
        }),
        secondary: (theme, isRtl) => ({
            color: labelMuted(theme),
            mt: 0.5,
            display: "block",
            width: "100%",
            textAlign: metricCardTextAlign(isRtl),
        }),
        footnote: (theme, isRtl) => ({
            color: labelMuted(theme),
            fontSize: "0.6875rem",
            mt: 0.5,
            lineHeight: 1.35,
            display: "block",
            width: "100%",
            textAlign: metricCardTextAlign(isRtl),
        }),
    };
}

export function buildMetricStatCardThemeExtensions() {
    const metricStatCard = buildMetricStatCardStyles();
    return {
        metricStatCard,
        creditDashboardChartCard: buildCreditDashboardChartCardStyles(metricStatCard),
    };
}
