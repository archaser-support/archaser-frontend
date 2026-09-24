"use client";

import { ShowChart as ShowChartIcon } from "@mui/icons-material";
import {
    Box,
    Card,
    CardContent,
    Typography,
    useTheme,
} from "@mui/material";
import { useSession } from "next-auth/react";
import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { CPH } from "@/app/[locale]/app/credit-portfolio-health/designTokens";
import { ExposureTrendLinesChart } from "@/app/[locale]/app/credit-portfolio-health/ExposureTrendLinesChart";
import type { CreditDashboardHistoryDelta, CreditDashboardHistoryPoint } from "@/types/creditInsurance";
import {
    formatDateForDisplay,
    getUserDateLocale,
    getUserTimezone,
} from "@/utils/datetimeOperations";
import { formatMoney } from "@/utils/stringFormatters";

import { CreditDashboardTitleInfoIcon } from "./creditDashboardTitleTooltip";
import {
    CREDIT_DASHBOARD_COMPACT_CARD_HEIGHT_PX,
    CREDIT_DASHBOARD_COMPACT_CHART_HEIGHT_PX,
    CREDIT_DASHBOARD_COMPACT_ICON_TILE_BOTTOM_PX,
} from "./creditDashboardCompactLayout";
import { METRIC_STAT_CARD_ICON_SIZE_PX } from "@/app/theme/metricStatCard";

const TREND_CHART_HEIGHT_FULL = 352;

export type CreditDashboardTrendChartProps = {
    series: CreditDashboardHistoryPoint[];
    delta: CreditDashboardHistoryDelta;
    /** Snapshot window requested for the chart (30 days). */
    historyDays: number;
    /** Account currency for axis / tooltip money formatting. */
    accountCurrency: string;
    /** Shorter chart for inline layout beside the health index */
    compact?: boolean;
};

function numberLocale(language: string): string {
    return language === "he" ? "he-IL" : "en-US";
}

function formatChartDate(
    snapshotDate: string,
    dateLocale: string,
    userTimezone: string
): string {
    const date = new Date(`${snapshotDate}T12:00:00.000Z`);
    return formatDateForDisplay(date, "date", dateLocale, userTimezone);
}

function fmtSigned(
    value: number | null,
    currency: string,
    language: string,
    naLabel: string
): string {
    if (value == null) {
        return naLabel;
    }
    const rounded = Math.round(value);
    const abs = formatMoney(Math.abs(rounded), currency, {
        style: "iso",
        locale: numberLocale(language),
        language: language.startsWith("he") ? "he" : language,
        wholeNumbers: true,
    });
    const signed = rounded > 0 ? `+${abs}` : rounded < 0 ? `-${abs}` : abs;
    // LRM keeps the sign to the left of digits in Hebrew (RTL) card headers.
    return language === "he" || language.startsWith("he")
        ? `\u200E${signed}`
        : signed;
}

function CreditDashboardTrendChartInner({
    series,
    delta,
    historyDays,
    accountCurrency,
    compact = false,
}: CreditDashboardTrendChartProps) {
    const theme = useTheme();
    const { data: session } = useSession();
    const { i18n, t } = useTranslation(["dashboard"]);
    const language = i18n.language;
    const isLight = theme.palette.mode === "light";
    const isHebrew = language === "he";
    const nsDashboard = { ns: "dashboard" as const };
    const naLabel = t("credit_insurance_dashboard.trend_value_na", nsDashboard);
    const dateLocale = useMemo(() => {
        const fallback = language?.startsWith("he") ? "he-IL" : "en-US";
        return getUserDateLocale(session, fallback);
    }, [language, session]);
    const userTimezone = useMemo(() => getUserTimezone(session), [session]);

    const c = theme.creditDashboardChartCard;
    const labelColor = isLight ? "#7C8DA1" : theme.palette.text.secondary;
    const chartHeight = compact
        ? CREDIT_DASHBOARD_COMPACT_CHART_HEIGHT_PX
        : TREND_CHART_HEIGHT_FULL;
    const plotHeight = chartHeight;

    const chartData = useMemo(
        () =>
            series.map((point) => ({
                label: formatChartDate(
                    point.snapshotDate,
                    dateLocale,
                    userTimezone
                ),
                total: point.totalReceivables,
                covered: point.compliantExposure,
                uncovered: point.atRiskExposure,
            })),
        [series, dateLocale, userTimezone]
    );

    const seriesLabels = useMemo(
        () => ({
            total: t(
                "credit_insurance_dashboard.trend_series_total_receivables",
                nsDashboard
            ),
            covered: t(
                "credit_insurance_dashboard.trend_series_compliant_exposure",
                nsDashboard
            ),
            uncovered: t(
                "credit_insurance_dashboard.trend_series_at_risk_exposure",
                nsDashboard
            ),
        }),
        [t]
    );

    const ledgerColorByDeltaId: Record<
        "totalReceivables" | "compliantExposure" | "atRiskExposure",
        string
    > = {
        totalReceivables: CPH.seriesSlate,
        compliantExposure: CPH.good,
        atRiskExposure: CPH.critical,
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

        return t("credit_insurance_dashboard.trend_title_daily_full_with_period", {
            ...nsDashboard,
            days,
            defaultValue: "Daily trend (last {{days}} days)",
        });
    }, [compact, historyDays, nsDashboard, t]);

    const trendSubtitle = t(
        "credit_insurance_dashboard.trend_subtitle_day_over_day",
        nsDashboard
    );

    const trendHelpTitle = t("tooltips.credit_insurance_daily_trend_calculation", {
        ...nsDashboard,
        days: String(historyDays),
        defaultValue:
            "End-of-day snapshots for the last {{days}} days: total receivables, compliant exposure, at-risk exposure, and health index. Deltas compare the latest day to the previous snapshot.",
    });

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
                                  gridTemplateColumns: "minmax(0, 1fr) auto",
                                  alignItems: "center",
                                  columnGap: 0.75,
                                  rowGap: 0.5,
                                  position: "relative",
                                  zIndex: 2,
                                  boxSizing: "border-box",
                                  minHeight: CREDIT_DASHBOARD_COMPACT_ICON_TILE_BOTTOM_PX,
                                  paddingInlineEnd: `calc(${METRIC_STAT_CARD_ICON_SIZE_PX}px + ${theme.spacing(1.75)} + ${theme.spacing(0.5)})`,
                                  direction: isHebrew ? "rtl" : "ltr",
                              }
                            : {
                                  ...c.headerColumn(theme, isHebrew),
                                  display: "grid",
                                  gridTemplateColumns: {
                                      xs: "minmax(0, 1fr)",
                                      sm: "auto minmax(0, 1fr)",
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
                            gridColumn: compact ? 2 : { xs: 1, sm: 2 },
                            gridRow: compact ? 1 : { xs: 3, sm: "1 / 3" },
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
                                    {fmtSigned(
                                        item.value,
                                        accountCurrency,
                                        language,
                                        naLabel
                                    )}
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
                                gridRow: { xs: 2, sm: 2 },
                                mb: 0,
                                minWidth: 0,
                                alignSelf: "start",
                            }}
                        >
                            {trendSubtitle}
                        </Typography>
                    ) : null}
                </Box>
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
                        <ExposureTrendLinesChart
                            data={chartData}
                            height={plotHeight}
                            currency={accountCurrency}
                            language={language}
                            seriesLabels={seriesLabels}
                            showLegend={!compact}
                            minTickGap={28}
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
        prev.historyDays === next.historyDays &&
        prev.accountCurrency === next.accountCurrency &&
        prev.compact === next.compact &&
        prev.series === next.series &&
        prev.delta === next.delta
);
