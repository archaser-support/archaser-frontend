"use client";

import { BarChart as BarChartIcon } from "@mui/icons-material";
import { alpha, Box, Card, CardContent, Typography, useTheme } from "@mui/material";
import { lighten } from "@mui/material/styles";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { CreditDashboardTitleInfoIcon } from "./creditDashboardTitleTooltip";
import {
    buildPolicyUsageBaseStackedSeries,
    shouldShowTopUpPolicyUsageBar,
    type PolicyUsageChartCategory,
} from "./creditPolicyUsageChartViewModel";

import type { PolicyLimitUsageCategoryTotals } from "@/types/creditInsurance";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

/** Split long x-axis labels across two lines (balanced on word boundaries). */
function wrapLabelTwoLines(label: string): [string, string] | string {
    const words = label.trim().split(/\s+/).filter(Boolean);
    if (words.length <= 1) {
        return label;
    }
    let bestSplit = 1;
    let bestDiff = Number.POSITIVE_INFINITY;
    for (let i = 1; i < words.length; i++) {
        const line1 = words.slice(0, i).join(" ");
        const line2 = words.slice(i).join(" ");
        const diff = Math.abs(line1.length - line2.length);
        if (diff < bestDiff) {
            bestDiff = diff;
            bestSplit = i;
        }
    }
    return [
        words.slice(0, bestSplit).join(" "),
        words.slice(bestSplit).join(" "),
    ];
}

export function CreditPolicyUsageChart(props: {
    combined: PolicyLimitUsageCategoryTotals;
    named: PolicyLimitUsageCategoryTotals;
    dclSdl: PolicyLimitUsageCategoryTotals;
    topUpCoverTotal?: number;
    topUpCoverUsed?: number;
    topUpCoverRemaining?: number;
    topUpCoverOverEffective?: number;
}) {
    const { t, i18n } = useTranslation(["dashboard"]);
    const theme = useTheme();
    const c = theme.creditDashboardChartCard;
    const isRtl = i18n.language === "he";
    const isLight = theme.palette.mode === "light";
    const numLocale = i18n.language === "he" ? "he-IL" : "en-US";
    const nsDashboard = { ns: "dashboard" as const };
    const axisMutedColor = isLight ? "#7C8DA1" : theme.palette.text.secondary;
    const gridLineColor = isLight ? "#DCE3EB" : theme.palette.divider;
    const showTopUpBar = shouldShowTopUpPolicyUsageBar(props.topUpCoverTotal);
    const topUpUsedWithin = Math.max(0, props.topUpCoverUsed ?? 0);
    const topUpRemainingRaw = Math.max(0, props.topUpCoverRemaining ?? 0);
    const topUpCapacity = topUpUsedWithin + topUpRemainingRaw;
    const topUpMax = topUpCapacity > 0 ? topUpCapacity : Math.max(0, props.topUpCoverTotal ?? 0);
    const topUpRemaining = Math.max(0, topUpMax - topUpUsedWithin);
    const topUpOver = Math.max(0, props.topUpCoverOverEffective ?? 0);
    const usagePctTopUp =
        topUpCapacity > 0 ? (topUpUsedWithin / topUpCapacity) * 100 : 0;
    const baseCategories = useMemo<PolicyUsageChartCategory[]>(
        () => [
            {
                fullLabel: t(
                    "credit_insurance_dashboard.policy_usage_bar_total_limits",
                    nsDashboard
                ),
                shortLabel: t(
                    "credit_insurance_dashboard.policy_usage_bar_total_limits_short",
                    nsDashboard
                ),
                totals: props.combined,
                showTopUpCovered: true,
            },
            {
                fullLabel: t(
                    "credit_insurance_dashboard.policy_usage_bar_named_limits",
                    nsDashboard
                ),
                shortLabel: t(
                    "credit_insurance_dashboard.policy_usage_bar_named_limits_short",
                    nsDashboard
                ),
                totals: props.named,
                showTopUpCovered: false,
            },
            {
                fullLabel: t(
                    "credit_insurance_dashboard.policy_usage_bar_dcl_sdl_limits",
                    nsDashboard
                ),
                shortLabel: t(
                    "credit_insurance_dashboard.policy_usage_bar_dcl_sdl_limits_short",
                    nsDashboard
                ),
                totals: props.dclSdl,
                showTopUpCovered: false,
            },
        ],
        [props.combined, props.dclSdl, props.named, t]
    );
    const {
        usedWithin: baseUsedWithin,
        remaining: baseRemaining,
        topUpCovered: baseTopUpCovered,
        uncovered: baseUncovered,
        stackHeights: baseStackHeights,
        usagePct: usagePctBase,
        approvedLimits: baseApprovedLimits,
    } = useMemo(
        () => buildPolicyUsageBaseStackedSeries(baseCategories),
        [baseCategories]
    );
    const topUpCoveredFill = isLight
        ? lighten(theme.palette.warning.main, 0.25)
        : alpha(theme.palette.warning.main, 0.75);
    const usagePctFormatter = new Intl.NumberFormat(numLocale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });
    const usagePctLabel = t(
        "credit_insurance_dashboard.top_customers_usage_pct_series",
        nsDashboard
    );
    const approvedLimitLabel = t(
        "credit_insurance_dashboard.approved_limit",
        {
            ...nsDashboard,
            defaultValue: "Approved limit",
        }
    );
    const categoryFullLabels = useMemo(() => {
        const cols = baseCategories.map((category) => category.fullLabel);
        if (showTopUpBar) {
            cols.push(
                t("credit_insurance_dashboard.policy_usage_bar_top_up_cover", {
                    ...nsDashboard,
                    defaultValue: "Top-Up Cover",
                })
            );
        }
        return cols;
    }, [baseCategories, showTopUpBar, t]);

    const xAxisCategories = useMemo(() => {
        const labels = baseCategories.map((category) => category.shortLabel);
        if (showTopUpBar) {
            labels.push(
                t("credit_insurance_dashboard.policy_usage_bar_top_up_cover_short", {
                    ...nsDashboard,
                    defaultValue: isRtl ? "×”×©×œ×ž×”" : "Top-Up",
                })
            );
        }
        return labels;
    }, [baseCategories, isRtl, showTopUpBar, t]);

    const usagePctByIndex = showTopUpBar
        ? [...usagePctBase, usagePctTopUp]
        : usagePctBase;

    const approvedLimitsByIndex = useMemo(() => {
        const limits = [...baseApprovedLimits];
        if (showTopUpBar) {
            limits.push(topUpMax);
        }
        return limits;
    }, [baseApprovedLimits, showTopUpBar, topUpMax]);

    const chartMain = theme.palette.chartPalette.main;
    /** Stronger separation than `chartPalette.light` (only +15% lighten in theme). */
    const remainingFill = isLight
        ? lighten(chartMain, 0.58)
        : alpha(chartMain, 0.42);

    const usedSeriesValues = useMemo(
        () =>
            showTopUpBar
                ? [...baseUsedWithin, topUpUsedWithin]
                : baseUsedWithin,
        [baseUsedWithin, showTopUpBar, topUpUsedWithin]
    );

    const options = useMemo<ApexOptions>(
        () => ({
            chart: {
                type: "bar",
                stacked: true,
                toolbar: { show: false },
                zoom: { enabled: false },
                animations: { enabled: true },
                background: "transparent",
            },
            plotOptions: {
                bar: {
                    columnWidth: showTopUpBar ? "38%" : "48%",
                    borderRadius: 4,
                    dataLabels: {
                        position: "center",
                    },
                },
            },
            xaxis: {
                categories: xAxisCategories,
                labels: {
                    rotate: 0,
                    trim: false,
                    hideOverlappingLabels: false,
                    formatter: (value: string) => {
                        const idx = xAxisCategories.indexOf(value);
                        return idx >= 0 && idx < baseCategories.length
                            ? wrapLabelTwoLines(value)
                            : value;
                    },
                    style: {
                        colors: axisMutedColor,
                        fontSize: "11px",
                    },
                    maxHeight: 52,
                },
                axisBorder: { show: false },
                axisTicks: { show: false },
            },
            yaxis: {
                title: {
                    text: t(
                        "credit_insurance_dashboard.policy_usage_title",
                        nsDashboard
                    ),
                    style: {
                        color: axisMutedColor,
                        fontSize: "12px",
                        fontWeight: 500,
                    },
                },
                labels: {
                    formatter: (v: number) =>
                        Math.round(v).toLocaleString(numLocale),
                    style: {
                        colors: axisMutedColor,
                    },
                },
            },
            colors: [
                chartMain,
                remainingFill,
                topUpCoveredFill,
                theme.palette.error.main,
            ],
            legend: { position: "bottom", horizontalAlign: "center" },
            grid: {
                borderColor: gridLineColor,
                strokeDashArray: 5,
                padding: {
                    top: 12,
                    bottom: 12,
                },
            },
            dataLabels: {
                enabled: true,
                formatter: (val: number) => {
                    if (!Number.isFinite(val) || val === 0) {
                        return "";
                    }
                    return Math.round(val).toLocaleString(numLocale);
                },
                style: {
                    colors: ["#FFFFFF"],
                    fontWeight: 600,
                    fontSize: "11px",
                },
                background: {
                    enabled: true,
                    foreColor: "#2F3B52",
                    borderRadius: 4,
                    padding: 4,
                    opacity: 0.9,
                    borderWidth: 1,
                    borderColor: "#ffffff",
                },
            },
            tooltip: {
                shared: true,
                intersect: false,
                theme: "light",
                custom: ({ series, dataPointIndex, w }) => {
                    const textAlign = isRtl ? "right" : "left";
                    const direction = isRtl ? "rtl" : "ltr";
                    const labels = w.globals.seriesNames as string[];
                    const colors = w.globals.colors as string[];
                    const category = categoryFullLabels[dataPointIndex] ?? "";
                    const usagePctValue = usagePctByIndex[dataPointIndex] ?? 0;
                    const approvedLimitValue =
                        approvedLimitsByIndex[dataPointIndex] ?? 0;
                    const isTopUpColumn =
                        showTopUpBar && dataPointIndex === categoryFullLabels.length - 1;

                    let tooltipContent = `<div class="custom-tooltip" style="background: white; border: 1px solid #DCE3EB; border-radius: 4px; padding: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); font-size: 12px; font-family: inherit; text-align: ${textAlign}; direction: ${direction};">`;
                    tooltipContent += `<div style="font-weight: 700; color: #2F3B52; margin-bottom: 6px; border-bottom: 1px solid #DCE3EB; padding-bottom: 4px; text-align: ${textAlign}; direction: ${direction};">${category}</div>`;

                    if (approvedLimitValue > 0) {
                        tooltipContent +=
                            `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; gap: 16px;">` +
                            `<div style="font-weight: 600; color: #2F3B52; text-align: ${textAlign}; direction: ${direction}; flex: 1;">${approvedLimitLabel}</div>` +
                            `<div style="color: #2F3B52; font-weight: 700; text-align: ${isRtl ? "left" : "right"}; direction: ltr;">${Math.round(approvedLimitValue).toLocaleString(numLocale)}</div>` +
                            `</div>`;
                    } else if (isTopUpColumn && topUpCapacity > 0) {
                        const totalCoverLabel = t(
                            "credit_insurance_dashboard.top_up_cover_amount",
                            {
                                ...nsDashboard,
                                defaultValue: "Top-up cover",
                            }
                        );
                        tooltipContent +=
                            `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; gap: 16px;">` +
                            `<div style="font-weight: 600; color: #2F3B52; text-align: ${textAlign}; direction: ${direction}; flex: 1;">${totalCoverLabel}</div>` +
                            `<div style="color: #2F3B52; font-weight: 700; text-align: ${isRtl ? "left" : "right"}; direction: ltr;">${Math.round(topUpCapacity).toLocaleString(numLocale)}</div>` +
                            `</div>`;
                    }

                    series.forEach((seriesData: number[], index: number) => {
                        const value = seriesData[dataPointIndex];
                        if (value === undefined || value === null || value === 0) {
                            return;
                        }
                        if (isRtl) {
                            tooltipContent +=
                                `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 8px; width: 100%;">` +
                                `<div style="font-weight: 600; color: #2F3B52; text-align: right; direction: rtl; flex: 1;">${labels[index] ?? ""}</div>` +
                                `<div style="color: ${colors[index]}; font-weight: 500; text-align: left; direction: ltr; flex-shrink: 0;">${Math.round(value).toLocaleString(numLocale)}</div>` +
                                `</div>`;
                        } else {
                            tooltipContent +=
                                `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 16px;">` +
                                `<div style="font-weight: 600; color: #2F3B52; text-align: left; direction: ltr; flex: 1;">${labels[index] ?? ""}</div>` +
                                `<div style="color: ${colors[index]}; font-weight: 500; text-align: right; direction: ltr;">${Math.round(value).toLocaleString(numLocale)}</div>` +
                                `</div>`;
                        }
                    });

                    tooltipContent += `<div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #DCE3EB; font-weight: 700; color: #2F3B52; text-align: ${textAlign}; direction: ${direction};">${usagePctLabel}: ${usagePctFormatter.format(usagePctValue)}%</div>`;
                    tooltipContent += "</div>";
                    return tooltipContent;
                },
            },
            annotations: {
                points: xAxisCategories.map((cat, idx) => ({
                    x: cat,
                    y:
                        idx < baseStackHeights.length
                            ? baseStackHeights[idx]
                            : Math.max(
                                  topUpMax,
                                  topUpUsedWithin + topUpRemaining + topUpOver
                              ),
                    marker: { size: 0 },
                    label: {
                        borderColor: "transparent",
                        borderRadius: 4,
                        offsetY: -10,
                        style: {
                            background: "transparent",
                            color: axisMutedColor,
                            fontSize: "11px",
                            fontWeight: 700,
                        },
                        text: `${usagePctLabel}: ${usagePctFormatter.format(
                            usagePctByIndex[idx] ?? 0
                        )}%`,
                    },
                })),
            },
        }),
        [
            approvedLimitLabel,
            approvedLimitsByIndex,
            axisMutedColor,
            baseCategories.length,
            baseStackHeights,
            categoryFullLabels,
            chartMain,
            gridLineColor,
            isRtl,
            numLocale,
            remainingFill,
            showTopUpBar,
            t,
            topUpCapacity,
            topUpCoveredFill,
            topUpMax,
            topUpOver,
            topUpRemaining,
            topUpUsedWithin,
            usagePctByIndex,
            usagePctFormatter,
            usagePctLabel,
            xAxisCategories,
        ]
    );

    /** Stacked bottomâ†’top: used, remaining, top-up covered excess, uncovered. */
    const series = useMemo(
        () => [
            {
                name: t(
                    "credit_insurance_dashboard.policy_usage_legend_used",
                    nsDashboard
                ),
                type: "column",
                data: usedSeriesValues,
            },
            {
                name: t(
                    "credit_insurance_dashboard.policy_usage_legend_remaining",
                    nsDashboard
                ),
                type: "column",
                data: showTopUpBar
                    ? [...baseRemaining, topUpRemaining]
                    : baseRemaining,
            },
            {
                name: t(
                    "credit_insurance_dashboard.policy_usage_legend_top_up_covered",
                    {
                        ...nsDashboard,
                        defaultValue: "Top-Up Covered",
                    }
                ),
                type: "column",
                data: showTopUpBar
                    ? [...baseTopUpCovered, 0]
                    : baseTopUpCovered,
            },
            {
                name: t(
                    "credit_insurance_dashboard.policy_usage_legend_over_limit",
                    nsDashboard
                ),
                type: "column",
                data: showTopUpBar
                    ? [...baseUncovered, topUpOver]
                    : baseUncovered,
            },
        ],
        [
            baseRemaining,
            baseTopUpCovered,
            baseUncovered,
            showTopUpBar,
            t,
            topUpOver,
            topUpRemaining,
            usedSeriesValues,
        ]
    );

    const policyUsageCaption = useMemo(
        () => categoryFullLabels.join(" Â· "),
        [categoryFullLabels]
    );

    return (
        <Card
            sx={{
                ...c.card(theme, { clickable: false, hoverable: true }),
                height: "100%",
                minHeight: 320,
            }}
        >
            <CardContent
                sx={{
                    ...c.cardContent(theme, { withChartBody: true }),
                    pb: 1,
                    direction: isRtl ? "rtl" : "ltr",
                }}
            >
                <Box
                    className="card-icon"
                    aria-hidden
                    sx={c.headerIconLeading(theme, isRtl, "receivables")}
                >
                    <BarChartIcon />
                </Box>
                <Box sx={c.headerColumn(theme, isRtl)}>
                    <Box
                        sx={{
                            ...c.headerTitleRow(theme, isRtl),
                            mb: theme.spacing(1),
                        }}
                    >
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
                                "credit_insurance_dashboard.policy_usage_title",
                                nsDashboard
                            )}
                        </Typography>
                        <CreditDashboardTitleInfoIcon
                            isRtl={isRtl}
                            title={t(
                                "tooltips.credit_insurance_policy_usage_calculation",
                                nsDashboard
                            )}
                            ariaLabel={t(
                                "credit_insurance_dashboard.chart_title_help_aria",
                                nsDashboard
                            )}
                        />
                    </Box>
                    <Typography variant="caption" sx={c.headerCaption(theme, isRtl)}>
                        {policyUsageCaption}
                    </Typography>
                </Box>
                <Box
                    className="credit-dashboard-policy-usage-chart"
                    sx={{
                        flex: 1,
                        minHeight: 200,
                        direction: "ltr",
                        ...(isRtl
                            ? {
                                  "& .apexcharts-legend-series": {
                                      direction: "ltr",
                                      display: "flex",
                                      flexDirection: "row",
                                      alignItems: "center",
                                      gap: theme.spacing(1),
                                  },
                                  "& .apexcharts-legend-text": {
                                      order: 1,
                                      direction: "rtl",
                                      textAlign: "right",
                                  },
                                  "& .apexcharts-legend-marker": {
                                      order: 2,
                                  },
                              }
                            : {}),
                    }}
                >
                    <ReactApexChart
                        options={options}
                        series={series}
                        type="bar"
                        height={showTopUpBar ? 300 : 290}
                    />
                </Box>
            </CardContent>
        </Card>
    );
}
