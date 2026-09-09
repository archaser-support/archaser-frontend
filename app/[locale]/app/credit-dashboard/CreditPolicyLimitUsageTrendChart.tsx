"use client";

import { ShowChart as ShowChartIcon } from "@mui/icons-material";
import { Box, Card, CardContent, Typography, useTheme } from "@mui/material";
import { alpha, lighten } from "@mui/material/styles";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { CustomerPolicyUsageTrendResponse } from "@/types/creditInsurance";
import {
    formatDateForDisplay,
    getUserDateLocale,
} from "@/utils/datetimeOperations";

import { CreditDashboardTitleInfoIcon } from "./creditDashboardTitleTooltip";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
    ssr: false,
});

function parseSnapshotDate(snapshotDate: string): Date {
    return new Date(`${snapshotDate}T12:00:00.000Z`);
}

function formatSnapshotDate(snapshotDate: string, dateLocale: string): string {
    return formatDateForDisplay(
        parseSnapshotDate(snapshotDate),
        "date",
        dateLocale,
        "UTC"
    );
}

export type CreditPolicyLimitUsageTrendChartProps = {
    data: CustomerPolicyUsageTrendResponse | undefined;
    isLoading?: boolean;
};

export function CreditPolicyLimitUsageTrendChart({
    data,
    isLoading,
}: CreditPolicyLimitUsageTrendChartProps) {
    const theme = useTheme();
    const c = theme.creditDashboardChartCard;
    const { data: session } = useSession();
    const { t, i18n } = useTranslation(["dashboard", "common"]);
    const isRtl = i18n.language === "he";
    const numLocale = i18n.language === "he" ? "he-IL" : "en-US";
    const nsDashboard = { ns: "dashboard" as const };
    const isLight = theme.palette.mode === "light";

    const dateLocale = useMemo(() => {
        const fallback = i18n.language?.startsWith("he") ? "he-IL" : "en-US";
        return getUserDateLocale(session, fallback);
    }, [session, i18n.language]);

    const snapshotLabel = useMemo(() => {
        if (!data?.snapshotDate) {
            return null;
        }
        return formatSnapshotDate(data.snapshotDate, dateLocale);
    }, [data?.snapshotDate, dateLocale]);

    const topCustomers = data?.topCustomers ?? [];
    const showTopUpStack = data?.hasTopUpPolicies === true;

    const amountFormatter = useMemo(
        () =>
            new Intl.NumberFormat(numLocale, {
                maximumFractionDigits: 0,
            }),
        [numLocale]
    );
    const pillCompactFormatter = useMemo(
        () =>
            new Intl.NumberFormat("en-US", {
                notation: "compact",
                maximumFractionDigits: 1,
            }),
        []
    );
    const pillPercentFormatter = useMemo(
        () =>
            new Intl.NumberFormat("en-US", {
                maximumFractionDigits: 1,
                minimumFractionDigits: 0,
            }),
        []
    );
    const percentFormatter = useMemo(
        () =>
            new Intl.NumberFormat(numLocale, {
                maximumFractionDigits: 1,
                minimumFractionDigits: 0,
            }),
        [numLocale]
    );

    const policyBarColor = theme.palette.chartPalette.main;
    const topUpBarColor = isLight
        ? lighten(theme.palette.secondary.main, 0.12)
        : alpha(theme.palette.secondary.main, 0.85);
    const overBarColor = theme.palette.error.main;

    const usageStatusColors = useMemo(
        () => ({
            ok: {
                fill: policyBarColor,
                border: theme.palette.chartPalette.dark,
            },
            warning: {
                fill: theme.palette.warning.main,
                border: theme.palette.warning.dark,
            },
            danger: {
                fill: theme.palette.error.main,
                border: theme.palette.error.dark,
            },
            neutral: {
                fill: theme.palette.action.disabled,
                border: theme.palette.text.disabled,
            },
        }),
        [policyBarColor, theme]
    );

    const chartData = useMemo(
        () =>
            topCustomers.map((row) => {
                const primaryPct = showTopUpStack
                    ? row.effectiveUsagePct
                    : row.policyUsagePct ?? row.usagePct;
                const usagePct = Math.max(0, primaryPct ?? 0);
                let status: "ok" | "warning" | "danger" | "neutral";
                if (primaryPct == null) {
                    status = "neutral";
                } else if (usagePct > 100) {
                    status = "danger";
                } else if (usagePct >= 81) {
                    status = "warning";
                } else {
                    status = "ok";
                }
                const palette = usageStatusColors[status];
                const rawPolicyPct = showTopUpStack
                    ? Math.max(0, row.barPolicyPct)
                    : Math.max(0, row.policyUsagePct ?? row.usagePct ?? 0);
                const rawTopUpPct = showTopUpStack
                    ? Math.max(0, row.barTopUpPct)
                    : 0;
                const rawOverPct = showTopUpStack
                    ? Math.max(0, row.barOverPct)
                    : 0;
                const rawTotalPct = rawPolicyPct + rawTopUpPct + rawOverPct;
                // Fixed 100-wide track: scale/capped fill so every row shares the same bar width.
                const scale =
                    rawTotalPct > 100 && rawTotalPct > 0
                        ? 100 / rawTotalPct
                        : 1;
                const barPolicyPct = rawPolicyPct * scale;
                const barTopUpPct = rawTopUpPct * scale;
                const barOverPct = rawOverPct * scale;
                const barFillPct = Math.min(100, rawTotalPct);
                const barTrackPct = Math.max(0, 100 - barFillPct);

                return {
                    customer: row.customerName,
                    amount: Math.max(0, row.usageAmount ?? 0),
                    limit: row.approvedLimit,
                    topUpTotal: row.topUpTotal,
                    effectiveLimit: row.effectiveApprovedLimit,
                    policyUsagePct: row.policyUsagePct,
                    topUpUsagePct: row.topUpUsagePct,
                    effectiveUsagePct: row.effectiveUsagePct,
                    usagePct,
                    barPolicyPct,
                    barTopUpPct,
                    barOverPct,
                    barFillPct,
                    barTrackPct,
                    barTotalPct: rawTotalPct,
                    policyNumber: row.policyNumber,
                    status,
                    color: palette.fill,
                    trackColor: alpha(palette.fill, isLight ? 0.22 : 0.28),
                    borderColor: palette.border,
                };
            }),
        [topCustomers, showTopUpStack, usageStatusColors, isLight]
    );

    const xAxisMax = 100;
    const xAxisTickStep = 20;

    const currentArLabel = t(
        "credit_insurance_dashboard.top_customers_current_ar_series",
        nsDashboard
    );
    const approvedLimitLabel = t(
        "credit_insurance_dashboard.top_customers_limit_amount_series",
        nsDashboard
    );
    const topUpTotalLabel = t(
        "credit_insurance_dashboard.top_up_cover_amount",
        nsDashboard
    );
    const effectiveLimitLabel = t(
        "credit_insurance_dashboard.effective_limit",
        nsDashboard
    );
    const policyUsageLabel = t(
        "credit_insurance_dashboard.top_customers_policy_usage_pct_series",
        {
            ...nsDashboard,
            defaultValue: "Policy usage",
        }
    );
    const topUpUsageLabel = t(
        "credit_insurance_dashboard.top_customers_top_up_usage_pct_series",
        {
            ...nsDashboard,
            defaultValue: "Top-up usage",
        }
    );
    const effectiveUsageLabel = t(
        "credit_insurance_dashboard.top_customers_effective_usage_pct_series",
        {
            ...nsDashboard,
            defaultValue: "Effective usage",
        }
    );
    const usagePctLabel = t(
        "credit_insurance_dashboard.top_customers_usage_pct_series",
        nsDashboard
    );
    const policySeriesLabel = t(
        "credit_insurance_dashboard.top_customers_bar_policy_series",
        {
            ...nsDashboard,
            defaultValue: "Policy limit",
        }
    );
    const topUpSeriesLabel = t(
        "credit_insurance_dashboard.top_customers_bar_top_up_series",
        {
            ...nsDashboard,
            defaultValue: "Top-up",
        }
    );
    const overSeriesLabel = t(
        "credit_insurance_dashboard.top_customers_bar_over_series",
        {
            ...nsDashboard,
            defaultValue: "Over effective limit",
        }
    );
    const trackSeriesLabel = "__track__";

    const barChartOptions = useMemo(
        () => ({
            chart: {
                type: "bar" as const,
                height: "auto",
                stacked: true,
                toolbar: { show: false },
                ...(isRtl && { animations: { enabled: false } }),
                background: "transparent",
            },
            plotOptions: {
                bar: {
                    horizontal: true,
                    barHeight: "68%",
                    borderRadius: 0,
                },
            },
            dataLabels: {
                enabled: false,
            },
            annotations: {
                points: chartData.map((item) => {
                    const limitText =
                        item.limit != null && item.limit > 0
                            ? pillCompactFormatter.format(item.limit)
                            : null;
                    const topUpText =
                        showTopUpStack &&
                        item.topUpTotal != null &&
                        item.topUpTotal > 0
                            ? pillCompactFormatter.format(item.topUpTotal)
                            : null;
                    const pctText =
                        item.usagePct != null
                            ? `${pillPercentFormatter.format(item.usagePct)}%`
                            : null;
                    const pillText =
                        limitText && topUpText && pctText
                            ? `${limitText} + ${topUpText} / ${pctText}`
                            : limitText && pctText
                              ? `${limitText} / ${pctText}`
                              : pctText
                                ? pctText
                                : limitText ?? "";
                    return {
                        x: xAxisMax,
                        y: item.customer as unknown as number,
                        marker: {
                            size: 0,
                            strokeWidth: 0,
                            fillColor: "transparent",
                        },
                        label: {
                            text: pillText,
                            borderWidth: 0,
                            textAnchor: "start" as const,
                            offsetX: 8,
                            offsetY: 9,
                            style: {
                                background: "transparent",
                                color: "#000000",
                                fontSize: "11px",
                                fontWeight: 400,
                                padding: {
                                    left: 0,
                                    right: 0,
                                    top: 0,
                                    bottom: 0,
                                },
                            },
                        },
                    };
                }),
            },
            xaxis: {
                categories: chartData.map((item) => item.customer),
                max: xAxisMax,
                min: 0,
                tickAmount: Math.round(xAxisMax / xAxisTickStep),
                labels: {
                    formatter: function (val: string) {
                        const n = Number(val);
                        if (!Number.isFinite(n)) return "";
                        return `${percentFormatter.format(n)}%`;
                    },
                    style: {
                        colors: theme.palette.text.secondary,
                        fontSize: "12px",
                    },
                },
            },
            yaxis: {
                labels: {
                    align: "left" as const,
                    formatter: function (val: number | string) {
                        const strVal = String(val ?? "");
                        if (strVal && strVal.length > 20) {
                            return strVal.substring(0, 20) + "...";
                        }
                        return strVal || "";
                    },
                    style: {
                        colors: theme.palette.text.secondary,
                        fontSize: "11px",
                    },
                    maxWidth: 180,
                },
            },
            grid: {
                borderColor: theme.palette.divider,
                strokeDashArray: 3,
                padding: {
                    left: 4,
                    right: 100,
                },
            },
            legend: {
                show: showTopUpStack,
                position: "bottom" as const,
                horizontalAlign: "center" as const,
                customLegendItems: showTopUpStack
                    ? [policySeriesLabel, topUpSeriesLabel, overSeriesLabel]
                    : undefined,
            },
            colors: showTopUpStack
                ? [
                      policyBarColor,
                      topUpBarColor,
                      overBarColor,
                      alpha(policyBarColor, isLight ? 0.18 : 0.24),
                  ]
                : chartData.map((item) => item.color),
            tooltip: {
                custom: function ({
                    dataPointIndex,
                }: {
                    series: number[][];
                    seriesIndex: number;
                    dataPointIndex: number;
                }) {
                    const item = chartData[dataPointIndex];
                    if (!item) return "";
                    const textAlign = isRtl ? "right" : "left";
                    const direction = isRtl ? "rtl" : "ltr";
                    const rowGap = isRtl ? "8px" : "16px";
                    const labelColor = "#2F3B52";
                    const mutedColor = theme.palette.text.secondary;
                    const row = (label: string, value: string, valueColor = labelColor) =>
                        isRtl
                            ? `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: ${rowGap}; width: 100%;">` +
                              `<div style="font-weight: 400; color: ${labelColor}; text-align: right; direction: rtl; flex: 1;">${label}</div>` +
                              `<div style="color: ${valueColor}; font-weight: 400; text-align: left; direction: ltr; flex-shrink: 0;">${value}</div>` +
                              `</div>`
                            : `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: ${rowGap};">` +
                              `<div style="font-weight: 400; color: ${labelColor}; text-align: left; direction: ltr; flex: 1;">${label}</div>` +
                              `<div style="color: ${valueColor}; font-weight: 400; text-align: right; direction: ltr;">${value}</div>` +
                              `</div>`;

                    const limitText =
                        item.limit != null && item.limit > 0
                            ? amountFormatter.format(item.limit)
                            : "-";
                    const topUpText =
                        item.topUpTotal != null && item.topUpTotal > 0
                            ? amountFormatter.format(item.topUpTotal)
                            : "-";
                    const effectiveText =
                        item.effectiveLimit != null && item.effectiveLimit > 0
                            ? amountFormatter.format(item.effectiveLimit)
                            : "-";

                    let tooltipContent =
                        `<div class="custom-tooltip" style="background: ${theme.palette.background.paper}; border: 1px solid ${theme.palette.divider}; border-radius: 4px; padding: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); font-size: 12px; font-family: inherit; text-align: ${textAlign}; direction: ${direction};">` +
                        `<div style="font-weight: 700; color: ${theme.palette.text.primary}; margin-bottom: 6px; border-bottom: 1px solid ${theme.palette.divider}; padding-bottom: 4px; text-align: ${textAlign}; direction: ${direction};">${item.customer}</div>`;

                    tooltipContent += row(
                        currentArLabel,
                        amountFormatter.format(item.amount)
                    );
                    tooltipContent += row(approvedLimitLabel, limitText);
                    if (showTopUpStack) {
                        tooltipContent += row(topUpTotalLabel, topUpText);
                        tooltipContent += row(effectiveLimitLabel, effectiveText);
                    }
                    if (item.policyUsagePct != null) {
                        tooltipContent += row(
                            policyUsageLabel,
                            `${percentFormatter.format(item.policyUsagePct)}%`,
                            mutedColor
                        );
                    }
                    if (showTopUpStack && item.topUpUsagePct != null) {
                        tooltipContent += row(
                            topUpUsageLabel,
                            `${percentFormatter.format(item.topUpUsagePct)}%`,
                            mutedColor
                        );
                    }
                    if (showTopUpStack && item.effectiveUsagePct != null) {
                        tooltipContent += row(
                            effectiveUsageLabel,
                            `${percentFormatter.format(item.effectiveUsagePct)}%`,
                            mutedColor
                        );
                    } else if (!showTopUpStack) {
                        tooltipContent += row(
                            usagePctLabel,
                            item.usagePct != null
                                ? `${percentFormatter.format(item.usagePct)}%`
                                : "-",
                            mutedColor
                        );
                    }
                    if (item.policyNumber) {
                        tooltipContent += `<div style="font-weight: 400; color: ${mutedColor}; font-size: 11px; margin-top: 4px; text-align: ${textAlign}; direction: ${direction};">${item.policyNumber}</div>`;
                    }
                    tooltipContent += "</div>";
                    return tooltipContent;
                },
            },
        }),
        [
            chartData,
            theme,
            isRtl,
            showTopUpStack,
            amountFormatter,
            percentFormatter,
            pillCompactFormatter,
            pillPercentFormatter,
            currentArLabel,
            approvedLimitLabel,
            topUpTotalLabel,
            effectiveLimitLabel,
            policyUsageLabel,
            topUpUsageLabel,
            effectiveUsageLabel,
            usagePctLabel,
            policyBarColor,
            topUpBarColor,
            overBarColor,
            xAxisMax,
            xAxisTickStep,
            isLight,
            policySeriesLabel,
            topUpSeriesLabel,
            overSeriesLabel,
        ]
    );

    const barChartSeries = useMemo(() => {
        if (showTopUpStack) {
            return [
                {
                    name: policySeriesLabel,
                    data: chartData.map((item) => item.barPolicyPct),
                },
                {
                    name: topUpSeriesLabel,
                    data: chartData.map((item) => item.barTopUpPct),
                },
                {
                    name: overSeriesLabel,
                    data: chartData.map((item) => item.barOverPct),
                },
                {
                    name: trackSeriesLabel,
                    data: chartData.map((item) => item.barTrackPct),
                },
            ];
        }
        return [
            {
                name: usagePctLabel,
                data: chartData.map((item) => ({
                    x: item.customer,
                    y: item.barFillPct,
                    fillColor: item.color,
                })),
            },
            {
                name: trackSeriesLabel,
                data: chartData.map((item) => ({
                    x: item.customer,
                    y: item.barTrackPct,
                    fillColor: item.trackColor,
                })),
            },
        ];
    }, [
        chartData,
        showTopUpStack,
        policySeriesLabel,
        topUpSeriesLabel,
        overSeriesLabel,
        trackSeriesLabel,
        usagePctLabel,
    ]);

    const chartKey = useMemo(() => {
        if (chartData.length === 0) return "empty";
        const hash = chartData
            .map(
                (item) =>
                    `${item.customer}-${item.amount}-${item.barTotalPct}-${item.barTopUpPct}`
            )
            .join("|");
        return `${showTopUpStack}-${chartData.length}-${hash.substring(0, 50)}`;
    }, [chartData, showTopUpStack]);

    useEffect(() => {
        const addTooltipsToLabels = () => {
            const allYAxisTexts = document.querySelectorAll(
                ".apexcharts-yaxis-texts-g text"
            );
            allYAxisTexts.forEach((label, index) => {
                const fullName = chartData[index]?.customer || label.textContent || "";
                label.setAttribute("title", fullName);
            });
        };
        const timer = setTimeout(addTooltipsToLabels, 100);
        const timer2 = setTimeout(addTooltipsToLabels, 500);
        return () => {
            clearTimeout(timer);
            clearTimeout(timer2);
        };
    }, [chartKey, chartData]);

    const empty = !isLoading && topCustomers.length === 0;

    return (
        <Card
            sx={{
                ...c.card(theme, { hoverable: false }),
                height: "100%",
                minHeight: 320,
                overflow: "visible",
            }}
        >
            <CardContent
                sx={{
                    ...c.cardContent(theme, { withChartBody: true }),
                    pb: 1,
                    direction: isRtl ? "rtl" : "ltr",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <Box
                    className="card-icon"
                    aria-hidden
                    sx={c.headerIconLeading(theme, isRtl, "limitWarnings")}
                >
                    <ShowChartIcon />
                </Box>
                <Box sx={c.headerColumn(theme, isRtl)}>
                    <Box sx={{ ...c.headerTitleRow(theme, isRtl), mb: theme.spacing(1) }}>
                        <Typography
                            variant="body2"
                            component="span"
                            sx={{
                                ...c.headerTitleInRow(theme, isRtl),
                                ml: 0,
                                mr: 0,
                                mb: 0,
                                minWidth: 0,
                            }}
                        >
                            {t(
                                "credit_insurance_dashboard.top_customers_usage_vs_limit_title",
                                nsDashboard
                            )}
                            <CreditDashboardTitleInfoIcon
                                isRtl={isRtl}
                                title={t(
                                    "tooltips.credit_insurance_top_customers_usage_chart",
                                    nsDashboard
                                )}
                                ariaLabel={t(
                                    "credit_insurance_dashboard.chart_title_help_aria",
                                    { ns: "dashboard" }
                                )}
                            />
                        </Typography>
                    </Box>
                    {snapshotLabel ? (
                        <Typography sx={c.headerCaption(theme, isRtl)}>
                            {t(
                                "credit_insurance_dashboard.top_customers_usage_vs_limit_subtitle",
                                {
                                    ...nsDashboard,
                                    date: snapshotLabel,
                                }
                            )}
                        </Typography>
                    ) : null}
                </Box>

                <Box
                    sx={{
                        flex: 1,
                        minHeight: 200,
                        mt: 1,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "visible",
                    }}
                >
                    {isLoading ? (
                        <Typography color="text.secondary" variant="body2">
                            {t("messages.loading", { ns: "common" })}
                        </Typography>
                    ) : empty ? (
                        <Typography color="text.secondary" variant="body2">
                            {t(
                                "credit_insurance_dashboard.top_customers_usage_vs_limit_empty",
                                nsDashboard
                            )}
                        </Typography>
                    ) : (
                        <Box
                            sx={{
                                flex: 1,
                                minHeight: 200,
                                direction: "ltr",
                            }}
                        >
                            <ReactApexChart
                                key={`bar-${chartKey}`}
                                options={barChartOptions}
                                series={barChartSeries}
                                type="bar"
                                height={showTopUpStack ? 290 : 260}
                            />
                        </Box>
                    )}
                </Box>
            </CardContent>
        </Card>
    );
}
