"use client";

import { Box, useTheme } from "@mui/material";
import { alpha, lighten } from "@mui/material/styles";
import { useEffect, useMemo } from "react";

import type { CustomerPolicyTrendTopRow } from "@/types/creditInsurance";
import {
    formatPortfolioAxisMoney,
    formatPortfolioMoney,
} from "@/app/[locale]/app/credit-portfolio-health/formatPortfolioMoney";
import ReactApexChart from "@/shared/components/ApexChart";
import { truncateWithEllipsis } from "@/utils/textDirection";

export type PolicyUsageTopCustomersBarChartLabels = {
    currentAr: string;
    approvedLimit: string;
    topUpTotal: string;
    effectiveLimit: string;
    policyUsage: string;
    topUpUsage: string;
    effectiveUsage: string;
    usagePct: string;
    policySeries: string;
    topUpSeries: string;
    overSeries: string;
};

export type PolicyUsageTopCustomersBarChartProps = {
    rows: CustomerPolicyTrendTopRow[];
    hasTopUpPolicies: boolean;
    accountCurrency: string;
    language: string;
    isRtl: boolean;
    labels: PolicyUsageTopCustomersBarChartLabels;
    height?: number;
    /** Extra room for limit / usage pills on the right. */
    gridPaddingRight?: number;
};

export function PolicyUsageTopCustomersBarChart({
    rows,
    hasTopUpPolicies,
    accountCurrency,
    language,
    isRtl,
    labels,
    height,
    gridPaddingRight = 100,
}: PolicyUsageTopCustomersBarChartProps) {
    const theme = useTheme();
    const isLight = theme.palette.mode === "light";
    const showTopUpStack = hasTopUpPolicies === true;

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
            new Intl.NumberFormat(language === "he" ? "he-IL" : "en-US", {
                maximumFractionDigits: 1,
                minimumFractionDigits: 0,
            }),
        [language]
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
            rows.map((row) => {
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
                let rawPolicyPct = showTopUpStack
                    ? Math.max(0, row.barPolicyPct)
                    : Math.max(0, row.policyUsagePct ?? row.usagePct ?? 0);
                const rawTopUpPct = showTopUpStack
                    ? Math.max(0, row.barTopUpPct)
                    : 0;
                let rawOverPct = showTopUpStack
                    ? Math.max(0, row.barOverPct)
                    : 0;
                if (
                    showTopUpStack &&
                    rawOverPct === 0 &&
                    rawTopUpPct === 0 &&
                    rawPolicyPct > 100
                ) {
                    rawOverPct = rawPolicyPct - 100;
                    rawPolicyPct = 100;
                }
                const rawTotalPct = rawPolicyPct + rawTopUpPct + rawOverPct;
                const barFillPct = Math.min(100, rawTotalPct);

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
                    barPolicyPct: rawPolicyPct,
                    barTopUpPct: rawTopUpPct,
                    barOverPct: rawOverPct,
                    barFillPct,
                    barTotalPct: rawTotalPct,
                    policyNumber: row.policyNumber,
                    status,
                    color: palette.fill,
                    borderColor: palette.border,
                };
            }),
        [rows, showTopUpStack, usageStatusColors]
    );

    const hasTopUpInChart = chartData.some((row) => row.barTopUpPct > 0);

    const xAxisMax = useMemo(() => {
        if (!showTopUpStack) {
            return 100;
        }
        const peak = chartData.reduce(
            (max, row) => Math.max(max, row.barTotalPct, row.usagePct),
            0
        );
        return Math.max(100, Math.ceil(peak / 20) * 20);
    }, [chartData, showTopUpStack]);
    const xAxisTickStep = 20;

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
                            ? formatPortfolioAxisMoney(
                                  item.limit,
                                  accountCurrency,
                                  language
                              )
                            : null;
                    const topUpText =
                        showTopUpStack &&
                        item.topUpTotal != null &&
                        item.topUpTotal > 0
                            ? formatPortfolioAxisMoney(
                                  item.topUpTotal,
                                  accountCurrency,
                                  language
                              )
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
                    // Sit just past the bar tip (not at axis max) so long pills
                    // are not clipped by the card edge.
                    const barEndPct = showTopUpStack
                        ? item.barTotalPct
                        : item.barFillPct;
                    const pillX = Math.min(
                        Math.max(0, barEndPct),
                        xAxisMax
                    );
                    return {
                        x: pillX,
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
                            offsetX: 6,
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
                stepSize: xAxisTickStep,
                decimalsInFloat: 0,
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
                    // Match portfolio-health CustomerNameYTick: right-aligned
                    // into the Y-axis slot (flush to the plot / bars).
                    align: "right" as const,
                    offsetX: -4,
                    formatter: function (val: number | string) {
                        return truncateWithEllipsis(String(val ?? ""), 28);
                    },
                    style: {
                        colors: theme.palette.text.secondary,
                        fontSize: "11.5px",
                    },
                    maxWidth: 172,
                    minWidth: 172,
                },
            },
            grid: {
                borderColor: theme.palette.divider,
                strokeDashArray: 3,
                padding: {
                    left: 8,
                    right: gridPaddingRight,
                },
            },
            legend: {
                show: showTopUpStack,
                position: "bottom" as const,
                horizontalAlign: "center" as const,
                customLegendItems: showTopUpStack
                    ? hasTopUpInChart
                        ? [
                              labels.policySeries,
                              labels.topUpSeries,
                              labels.overSeries,
                          ]
                        : [labels.policySeries, labels.overSeries]
                    : undefined,
            },
            colors: showTopUpStack
                ? hasTopUpInChart
                    ? [policyBarColor, topUpBarColor, overBarColor]
                    : [policyBarColor, overBarColor]
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
                    const row = (
                        label: string,
                        value: string,
                        valueColor = labelColor
                    ) =>
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
                            ? formatPortfolioMoney(
                                  item.limit,
                                  accountCurrency,
                                  language
                              )
                            : "-";
                    const topUpText =
                        item.topUpTotal != null && item.topUpTotal > 0
                            ? formatPortfolioMoney(
                                  item.topUpTotal,
                                  accountCurrency,
                                  language
                              )
                            : "-";
                    const effectiveText =
                        item.effectiveLimit != null && item.effectiveLimit > 0
                            ? formatPortfolioMoney(
                                  item.effectiveLimit,
                                  accountCurrency,
                                  language
                              )
                            : "-";

                    let tooltipContent =
                        `<div class="custom-tooltip" style="background: ${theme.palette.background.paper}; border: 1px solid ${theme.palette.divider}; border-radius: 4px; padding: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); font-size: 12px; font-family: inherit; text-align: ${textAlign}; direction: ${direction};">` +
                        `<div style="font-weight: 700; color: ${theme.palette.text.primary}; margin-bottom: 6px; border-bottom: 1px solid ${theme.palette.divider}; padding-bottom: 4px; text-align: ${textAlign}; direction: ${direction};">${item.customer}</div>`;

                    tooltipContent += row(
                        labels.currentAr,
                        formatPortfolioMoney(
                            item.amount,
                            accountCurrency,
                            language
                        )
                    );
                    tooltipContent += row(labels.approvedLimit, limitText);
                    if (showTopUpStack) {
                        tooltipContent += row(labels.topUpTotal, topUpText);
                        tooltipContent += row(
                            labels.effectiveLimit,
                            effectiveText
                        );
                    }
                    if (item.policyUsagePct != null) {
                        tooltipContent += row(
                            labels.policyUsage,
                            `${percentFormatter.format(item.policyUsagePct)}%`,
                            mutedColor
                        );
                    }
                    if (showTopUpStack && item.topUpUsagePct != null) {
                        tooltipContent += row(
                            labels.topUpUsage,
                            `${percentFormatter.format(item.topUpUsagePct)}%`,
                            mutedColor
                        );
                    }
                    if (showTopUpStack && item.effectiveUsagePct != null) {
                        tooltipContent += row(
                            labels.effectiveUsage,
                            `${percentFormatter.format(item.effectiveUsagePct)}%`,
                            mutedColor
                        );
                    } else if (!showTopUpStack) {
                        tooltipContent += row(
                            labels.usagePct,
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
            accountCurrency,
            language,
            percentFormatter,
            pillPercentFormatter,
            labels,
            policyBarColor,
            topUpBarColor,
            overBarColor,
            xAxisMax,
            xAxisTickStep,
            hasTopUpInChart,
            gridPaddingRight,
        ]
    );

    const barChartSeries = useMemo(() => {
        if (showTopUpStack) {
            const policySeries = {
                name: labels.policySeries,
                data: chartData.map((item) => item.barPolicyPct),
            };
            const overSeries = {
                name: labels.overSeries,
                data: chartData.map((item) => item.barOverPct),
            };
            if (!hasTopUpInChart) {
                return [policySeries, overSeries];
            }
            return [
                policySeries,
                {
                    name: labels.topUpSeries,
                    data: chartData.map((item) => item.barTopUpPct),
                },
                overSeries,
            ];
        }
        return [
            {
                name: labels.usagePct,
                data: chartData.map((item) => ({
                    x: item.customer,
                    y: item.barFillPct,
                    fillColor: item.color,
                })),
            },
        ];
    }, [chartData, showTopUpStack, labels, hasTopUpInChart]);

    const chartKey = useMemo(() => {
        if (chartData.length === 0) return "empty";
        const hash = chartData
            .map(
                (item) =>
                    `${item.customer}-${item.amount}-${item.barTotalPct}-${item.barTopUpPct}`
            )
            .join("|");
        return `${showTopUpStack}-${hasTopUpInChart}-${chartData.length}-${hash.substring(0, 50)}`;
    }, [chartData, showTopUpStack, hasTopUpInChart]);

    useEffect(() => {
        const addTooltipsToLabels = () => {
            const allYAxisTexts = document.querySelectorAll(
                ".apexcharts-yaxis-texts-g text"
            );
            allYAxisTexts.forEach((label, index) => {
                const fullName =
                    chartData[index]?.customer || label.textContent || "";
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

    const chartHeight =
        height ?? (showTopUpStack ? 290 : 260);

    return (
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
                height={chartHeight}
            />
        </Box>
    );
}
