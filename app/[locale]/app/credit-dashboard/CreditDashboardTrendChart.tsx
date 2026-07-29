"use client";

import { ShowChart as ShowChartIcon } from "@mui/icons-material";
import {
    Box,
    Card,
    CardContent,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
    useTheme,
} from "@mui/material";
import { useSession } from "next-auth/react";
import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { CreditDashboardHistoryDelta, CreditDashboardHistoryInterval, CreditDashboardHistoryPoint } from "@/types/creditInsurance";
import {
    getUserDateLocale,
    getUserTimezone,
} from "@/utils/datetimeOperations";

import { CreditDashboardTitleInfoIcon } from "./creditDashboardTitleTooltip";
import {
    CREDIT_DASHBOARD_COMPACT_CARD_HEIGHT_PX,
    CREDIT_DASHBOARD_COMPACT_CHART_HEIGHT_PX,
    CREDIT_DASHBOARD_COMPACT_ICON_TILE_BOTTOM_PX,
} from "./creditDashboardCompactLayout";
import { TrendLineChartSvg } from "./TrendLineChartSvg";

const TREND_CHART_HEIGHT_FULL = 352;

export type CreditDashboardTrendChartProps = {
    series: CreditDashboardHistoryPoint[];
    delta: CreditDashboardHistoryDelta;
    interval: CreditDashboardHistoryInterval;
    onIntervalChange: (interval: CreditDashboardHistoryInterval) => void;
    /** Snapshot window requested for the chart (30 days for daily and weekly). */
    historyDays: number;
    /** Shorter chart for inline layout beside the health index */
    compact?: boolean;
};

function numberLocale(language: string): string {
    return language === "he" ? "he-IL" : "en-US";
}

function utcDayGap(later: string, earlier: string): number {
    const a = new Date(`${earlier}T12:00:00.000Z`).getTime();
    const b = new Date(`${later}T12:00:00.000Z`).getTime();
    return (b - a) / 86_400_000;
}

/** Drop weekly points spaced < 6 days apart (partial / overlapping weeks). */
function sanitizeWeeklyDisplaySeries(
    series: CreditDashboardHistoryPoint[]
): CreditDashboardHistoryPoint[] {
    if (series.length <= 1) {
        return series;
    }
    const sorted = [...series].sort((a, b) =>
        a.snapshotDate.localeCompare(b.snapshotDate)
    );
    const pruned: CreditDashboardHistoryPoint[] = [sorted[0]!];
    for (let i = 1; i < sorted.length; i++) {
        const cur = sorted[i]!;
        const prev = pruned[pruned.length - 1]!;
        if (utcDayGap(cur.snapshotDate, prev.snapshotDate) >= 6) {
            pruned.push(cur);
        }
    }
    return pruned;
}

function fmtSigned(
    value: number | null,
    language: string,
    naLabel: string
): string {
    if (value == null) {
        return naLabel;
    }
    const sign = value > 0 ? "+" : "";
    return `${sign}${Math.round(value).toLocaleString(numberLocale(language))}`;
}

function CreditDashboardTrendChartInner({
    series,
    delta,
    interval,
    onIntervalChange,
    historyDays,
    compact = false,
}: CreditDashboardTrendChartProps) {
    const theme = useTheme();
    const { data: session } = useSession();
    const { i18n, t } = useTranslation(["dashboard"]);
    const language = i18n.language;
    const isLight = theme.palette.mode === "light";
    const isHebrew = language === "he";
    const isWeekly = interval === "weekly";
    const nsDashboard = { ns: "dashboard" as const };
    const naLabel = t("credit_insurance_dashboard.trend_value_na", nsDashboard);
    const dateLocale = useMemo(() => {
        const fallback = language?.startsWith("he") ? "he-IL" : "en-US";
        return getUserDateLocale(session, fallback);
    }, [language, session]);
    const userTimezone = useMemo(() => getUserTimezone(session), [session]);

    const c = theme.creditDashboardChartCard;
    const labelColor = isLight ? "#7C8DA1" : theme.palette.text.secondary;
    const axisMutedColor = isLight ? "#7C8DA1" : theme.palette.text.secondary;
    const gridLineColor = isLight ? "#DCE3EB" : theme.palette.divider;
    const primaryMain = theme.palette.primary.main;
    const successMain = theme.palette.success.main;
    const warningMain = theme.palette.warning.main;
    const toggleCornerRadius =
        typeof theme.shape.borderRadius === "number"
            ? `${theme.shape.borderRadius}px`
            : theme.shape.borderRadius;
    const chartHeight = compact
        ? CREDIT_DASHBOARD_COMPACT_CHART_HEIGHT_PX
        : TREND_CHART_HEIGHT_FULL;
    const plotHeight = chartHeight;
    const chartSeries = useMemo(
        () =>
            isWeekly ? sanitizeWeeklyDisplaySeries(series) : series,
        [isWeekly, series]
    );
    const chartColors = [primaryMain, successMain, warningMain] as const;

    const ledgerColorByDeltaId: Record<
        "totalReceivables" | "compliantExposure" | "atRiskExposure",
        string
    > = {
        totalReceivables: primaryMain,
        compliantExposure: successMain,
        atRiskExposure: warningMain,
    };

    const trendTitle = useMemo(() => {
        const days = String(historyDays);
        if (compact) {
            return t("credit_insurance_dashboard.trend_title_compact_with_period", {
                ...nsDashboard,
                days,
                defaultValue: "Trend (last {{days}} days)",
            });
        }

        return isWeekly
            ? t("credit_insurance_dashboard.trend_title_weekly_full_with_period", {
                  ...nsDashboard,
                  days,
                  defaultValue: "Weekly trend (last {{days}} days)",
              })
            : t("credit_insurance_dashboard.trend_title_daily_full_with_period", {
                  ...nsDashboard,
                  days,
                  defaultValue: "Daily trend (last {{days}} days)",
              });
    }, [compact, historyDays, isWeekly, nsDashboard, t]);

    const trendSubtitle = isWeekly
        ? t("credit_insurance_dashboard.trend_subtitle_week_over_week", {
              ...nsDashboard,
              defaultValue: "Week-over-week movement of key exposures",
          })
        : t("credit_insurance_dashboard.trend_subtitle_day_over_day", nsDashboard);

    const trendHelpTitle = isWeekly
        ? t("tooltips.credit_insurance_weekly_trend_calculation", {
              ...nsDashboard,
              days: String(historyDays),
              defaultValue:
                  "Weekly points from daily snapshots over the last {{days}} days. Each point uses the last daily snapshot in the calendar week (UTC). Deltas compare the latest week to the previous week.",
          })
        : t("tooltips.credit_insurance_daily_trend_calculation", {
              ...nsDashboard,
              days: String(historyDays),
              defaultValue:
                  "End-of-day snapshots for the last {{days}} days: total receivables, compliant exposure, at-risk exposure, and health index. Deltas compare the latest day to the previous snapshot.",
          });

    const intervalToggle = (
        <ToggleButtonGroup
            value={interval}
            exclusive
            size="small"
            onChange={(_e, value: CreditDashboardHistoryInterval | null) => {
                if (value != null) {
                    onIntervalChange(value);
                }
            }}
            aria-label={t("credit_insurance_dashboard.trend_interval_aria", {
                ...nsDashboard,
                defaultValue: "Trend chart interval",
            })}
            sx={{
                flexShrink: 0,
                direction: isHebrew ? "rtl" : "ltr",
                "& .MuiToggleButton-root": {
                    px: 1,
                    py: 0.25,
                    minWidth: compact ? 48 : 52,
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    textTransform: "none",
                    borderColor: isLight ? "#DCE3EB" : theme.palette.divider,
                    color: labelColor,
                    "&.Mui-selected": {
                        backgroundColor: primaryMain,
                        color: theme.palette.primary.contrastText,
                        borderColor: primaryMain,
                        "&:hover": {
                            backgroundColor: theme.palette.primary.dark,
                        },
                    },
                },
                ...(isHebrew
                    ? {
                          "& .MuiToggleButtonGroup-firstButton": {
                              borderTopLeftRadius: 0,
                              borderBottomLeftRadius: 0,
                              borderTopRightRadius: toggleCornerRadius,
                              borderBottomRightRadius: toggleCornerRadius,
                          },
                          "& .MuiToggleButtonGroup-lastButton": {
                              borderTopRightRadius: 0,
                              borderBottomRightRadius: 0,
                              borderTopLeftRadius: toggleCornerRadius,
                              borderBottomLeftRadius: toggleCornerRadius,
                          },
                      }
                    : {}),
            }}
        >
            <ToggleButton value="daily">
                {t("credit_insurance_dashboard.trend_interval_daily", {
                    ...nsDashboard,
                    defaultValue: "Daily",
                })}
            </ToggleButton>
            <ToggleButton value="weekly">
                {t("credit_insurance_dashboard.trend_interval_weekly", {
                    ...nsDashboard,
                    defaultValue: "Weekly",
                })}
            </ToggleButton>
        </ToggleButtonGroup>
    );

    const legendItems = useMemo(
        () => [
            {
                color: primaryMain,
                label: t(
                    "credit_insurance_dashboard.trend_series_total_receivables",
                    nsDashboard
                ),
            },
            {
                color: successMain,
                label: t(
                    "credit_insurance_dashboard.trend_series_compliant_exposure",
                    nsDashboard
                ),
            },
            {
                color: warningMain,
                label: t(
                    "credit_insurance_dashboard.trend_series_at_risk_exposure",
                    nsDashboard
                ),
            },
        ],
        [primaryMain, successMain, t, warningMain]
    );

    const deltaStatItems = useMemo(
        () => [
            {
                id: "totalReceivables" as const,
                label: t(
                    "credit_insurance_dashboard.trend_delta_label_receivables",
                    nsDashboard
                ),
                value: delta.totalReceivables,
            },
            {
                id: "compliantExposure" as const,
                label: t(
                    "credit_insurance_dashboard.trend_delta_label_compliant",
                    nsDashboard
                ),
                value: delta.compliantExposure,
            },
            {
                id: "atRiskExposure" as const,
                label: t(
                    "credit_insurance_dashboard.trend_delta_label_at_risk",
                    nsDashboard
                ),
                value: delta.atRiskExposure,
            },
        ],
        [
            delta.atRiskExposure,
            delta.compliantExposure,
            delta.totalReceivables,
            t,
        ]
    );

    const deltaChipSx = compact
        ? {
              px: 0.65,
              py: 0.35,
              minWidth: 0,
              flexShrink: 1,
          }
        : {
              px: 1.25,
              py: 0.7,
              minWidth: 150,
          };

    return (
        <Card
            sx={{
                ...c.card(theme, { clickable: false, hoverable: true }),
                width: compact ? "100%" : undefined,
                minWidth: compact ? 0 : undefined,
                ...(compact
                    ? {
                          height: CREDIT_DASHBOARD_COMPACT_CARD_HEIGHT_PX,
                          minHeight: CREDIT_DASHBOARD_COMPACT_CARD_HEIGHT_PX,
                          maxHeight: CREDIT_DASHBOARD_COMPACT_CARD_HEIGHT_PX,
                          display: "flex",
                          flexDirection: "column",
                          overflow: "hidden",
                      }
                    : {}),
            }}
        >
            <CardContent
                sx={{
                    ...c.cardContent(theme),
                    p: compact ? 1.5 : 2,
                    width: compact ? "100%" : undefined,
                    minWidth: compact ? 0 : undefined,
                    direction: isHebrew ? "rtl" : "ltr",
                    ...(compact
                        ? {
                              flex: 1,
                              display: "flex",
                              flexDirection: "column",
                              minHeight: 0,
                              overflow: "hidden",
                          }
                        : {}),
                }}
            >
                <Box
                    className="card-icon"
                    aria-hidden
                    sx={{
                        ...c.headerIconLeading(theme, isHebrew, "receivables"),
                        ...(compact ? { zIndex: 0 } : {}),
                    }}
                >
                    <ShowChartIcon />
                </Box>
                <Box
                    sx={{
                        width: "100%",
                        minWidth: 0,
                        flexShrink: 0,
                        mb: compact ? 0.75 : 2,
                        ...(compact
                            ? {
                                  display: "grid",
                                  gridTemplateColumns: "auto minmax(0, 1fr) auto",
                                  alignItems: "center",
                                  columnGap: 0.75,
                                  rowGap: 0.5,
                                  position: "relative",
                                  zIndex: 2,
                                  boxSizing: "border-box",
                                  minHeight: CREDIT_DASHBOARD_COMPACT_ICON_TILE_BOTTOM_PX,
                                  paddingInlineEnd: `calc(48px + ${theme.spacing(1.75)} + ${theme.spacing(0.5)})`,
                                  direction: isHebrew ? "rtl" : "ltr",
                              }
                            : {
                                  ...c.headerColumn(theme, isHebrew),
                                  display: "grid",
                                  gridTemplateColumns: {
                                      xs: "minmax(0, 1fr)",
                                      sm: "auto minmax(0, 1fr) auto",
                                  },
                                  gridTemplateRows: "auto auto",
                                  columnGap: { xs: 1, sm: 2 },
                                  rowGap: theme.spacing(0.5),
                                  alignItems: { xs: "stretch", sm: "center" },
                              }),
                    }}
                >
                    <Box
                        sx={{
                            ...c.headerTitleRow(theme, isHebrew),
                            ...(compact
                                ? {
                                      gridColumn: 1,
                                      gridRow: 1,
                                      maxWidth: "100%",
                                  }
                                : {
                                      gridColumn: { xs: 1, sm: 1 },
                                      gridRow: { xs: 1, sm: 1 },
                                  }),
                        }}
                    >
                        <Typography
                            variant="body2"
                            component="span"
                            sx={{
                                ...c.headerTitleInRow(theme, isHebrew),
                                ml: 0,
                                mr: 0,
                                mb: 0,
                                minWidth: 0,
                            }}
                        >
                            {trendTitle}
                        </Typography>
                        <CreditDashboardTitleInfoIcon
                            isRtl={isHebrew}
                            title={trendHelpTitle}
                            ariaLabel={t(
                                "credit_insurance_dashboard.chart_title_help_aria",
                                nsDashboard
                            )}
                        />
                    </Box>
                    <Box
                        sx={{
                            flexShrink: 0,
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            width: "100%",
                            minWidth: 0,
                            justifySelf: "stretch",
                            alignSelf: "center",
                            gridColumn: compact ? 2 : { xs: 1, sm: 2 },
                            gridRow: compact ? 1 : { xs: 3, sm: "1 / 3" },
                        }}
                    >
                        {intervalToggle}
                    </Box>
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "row",
                            flexWrap: compact ? "nowrap" : "wrap",
                            alignItems: "center",
                            justifyContent: compact ? "flex-end" : { xs: "flex-start", sm: "flex-end" },
                            gap: compact ? 0.5 : 1,
                            minWidth: 0,
                            overflow: compact ? "hidden" : "visible",
                            direction: isHebrew ? "rtl" : "ltr",
                            justifySelf: compact ? "end" : { xs: "stretch", sm: "end" },
                            gridColumn: compact ? 3 : { xs: 1, sm: 3 },
                            gridRow: compact ? 1 : { xs: 4, sm: "1 / 3" },
                        }}
                    >
                        {deltaStatItems.map((item) => (
                            <Box
                                key={item.id}
                                sx={{
                                    ...deltaChipSx,
                                    borderRadius: compact ? "6px" : "8px",
                                    border: "1px solid",
                                    borderColor: isLight
                                        ? "#DCE3EB"
                                        : theme.palette.divider,
                                    background: "transparent",
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    sx={{
                                        display: "block",
                                        color: labelColor,
                                        textTransform: "uppercase",
                                        letterSpacing: compact ? "0.25px" : "0.35px",
                                        lineHeight: compact ? 1.1 : 1.2,
                                        fontSize: compact ? "0.58rem" : undefined,
                                    }}
                                >
                                    {item.label}
                                </Typography>
                                <Typography
                                    variant={compact ? "caption" : "body2"}
                                    sx={{
                                        display: "block",
                                        mt: compact ? 0.2 : 0.35,
                                        fontWeight: 700,
                                        color: ledgerColorByDeltaId[item.id],
                                        fontVariantNumeric: "tabular-nums",
                                        ...(compact
                                            ? {
                                                  fontSize: "0.75rem",
                                                  lineHeight: 1.15,
                                              }
                                            : {}),
                                    }}
                                >
                                    {fmtSigned(item.value, language, naLabel)}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                    {!compact ? (
                        <Typography
                            variant="caption"
                            sx={{
                                ...c.headerCaption(theme, isHebrew),
                                gridColumn: { xs: 1, sm: 1 },
                                gridRow: compact ? undefined : { xs: 3, sm: 2 },
                                mb: 0,
                                minWidth: 0,
                                alignSelf: "start",
                            }}
                        >
                            {trendSubtitle}
                        </Typography>
                    ) : null}
                </Box>
                {series.length > 0 && !compact ? (
                    <Box
                        sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: { xs: 1, sm: 1.5 },
                            mb: 0.75,
                            pl: `calc(${theme.spacing(8)} + ${theme.spacing(0.5)})`,
                        }}
                    >
                        {legendItems.map((item) => (
                            <Box
                                key={item.label}
                                sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    minWidth: 0,
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 18,
                                        height: 3,
                                        borderRadius: 1,
                                        bgcolor: item.color,
                                        flexShrink: 0,
                                    }}
                                />
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: labelColor,
                                        fontSize: compact ? "0.65rem" : "0.72rem",
                                        lineHeight: 1.2,
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {item.label}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                ) : null}
                {series.length > 0 ? (
                    <Box
                        className="credit-dashboard-trend-chart"
                        sx={{
                            width: "100%",
                            overflow: "hidden",
                            direction: "ltr",
                            ...(compact
                                ? {
                                      flex: 1,
                                      minHeight: chartHeight,
                                      maxHeight: chartHeight,
                                      display: "flex",
                                      flexDirection: "column",
                                  }
                                : {
                                      flexShrink: 0,
                                      height: chartHeight,
                                      minHeight: chartHeight,
                                      maxHeight: chartHeight,
                                  }),
                        }}
                    >
                        <TrendLineChartSvg
                            key={interval}
                            series={chartSeries}
                            colors={chartColors}
                            seriesLabels={[
                                legendItems[0].label,
                                legendItems[1].label,
                                legendItems[2].label,
                            ]}
                            axisColor={axisMutedColor}
                            gridColor={gridLineColor}
                            language={language}
                            dateLocale={dateLocale}
                            userTimezone={userTimezone}
                            isWeekly={isWeekly}
                            displayHeight={plotHeight}
                            xLabelRotationDeg={38}
                        />
                    </Box>
                ) : (
                    <Typography variant="body2" color="text.secondary">
                        {t(
                            "credit_insurance_dashboard.trend_empty_chart_hint",
                            nsDashboard
                        )}
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
}

export const CreditDashboardTrendChart = memo(
    CreditDashboardTrendChartInner,
    (prev, next) =>
        prev.interval === next.interval &&
        prev.historyDays === next.historyDays &&
        prev.compact === next.compact &&
        prev.series === next.series &&
        prev.delta === next.delta &&
        prev.onIntervalChange === next.onIntervalChange
);
