"use client";

import { ShowChart as ShowChartIcon } from "@mui/icons-material";
import { Box, Card, CardContent, Typography, useTheme } from "@mui/material";
import { alpha, lighten } from "@mui/material/styles";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { CustomerPolicyUsageTrendResponse } from "@/server/services/creditInsurance/customerPolicyTrendService";
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
                const barPolicyPct = showTopUpStack
                    ? row.barPolicyPct
                    : Math.max(0, row.policyUsagePct ?? row.usagePct ?? 0);
                const barTopUpPct = showTopUpStack ? row.barTopUpPct : 0;
                const barOverPct = showTopUpStack ? row.barOverPct : 0;
                const barTotalPct = barPolicyPct + barTopUpPct + barOverPct;

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
                    barTotalPct,
                    policyNumber: row.policyNumber,
                    status,
                    color: palette.fill,
                    borderColor: palette.border,
                };
            }),
        [topCustomers, showTopUpStack, usageStatusColors]
    );

    const { xAxisMax, xAxisTickStep } = useMemo(() => {
        const maxBarPct = chartData.reduce(
            (acc, item) => Math.max(acc, item.barTotalPct),
            0
        );
        const paddedMax = maxBarPct <= 100 ? 100 : maxBarPct * 1.1;
        const tickStep =
            paddedMax <= 100
                ? 20
                : paddedMax <= 200
                  ? 50
                  : paddedMax <= 500
                    ? 100
                    : 200;

        return {
            xAxisMax: Math.ceil(paddedMax / tickStep) * tickStep,
            xAxisTickStep: tickStep,
        };
    }, [chartData]);

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

    const barChartOptions = useMemo(
        () => ({
            chart: {
                type: "bar" as const,
                height: "auto",
                stacked: showTopUpStack,
                toolbar: { show: false },
                ...(isRtl && { animations: { enabled: false } }),
                background: "transparent",
            },
            plotOptions: {
                bar: {
                    horizontal: true,
                    barHeight: "68%",
                    borderRadius: 4,
                    ...(showTopUpStack ? {} : { distributed: true }),
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
                    const anchorX = showTopUpStack
                        ? item.barTotalPct
                        : item.usagePct;
                    const pillColor =
                        showTopUpStack && item.barOverPct > 0
                            ? overBarColor
                            : item.color;
                    const pillBorder =
                        showTopUpStack && item.barOverPct > 0
                            ? theme.palette.error.dark
                            : item.borderColor;
                    return {
                        x: anchorX,
                        y: item.customer as unknown as number,
                        marker: {
                            size: 0,
                            strokeWidth: 0,
                            fillColor: "transparent",
                        },
                        label: {
                            text: pillText,
                            borderColor: pillBorder,
                            borderWidth: 1,
                            borderRadius: 4,
                            textAnchor: "start" as const,
                            offsetX: 8,
                            offsetY: 9,
                            style: {
                                background: pillColor,
                                color: "#ffffff",
                                fontSize: "10px",
                                fontWeight: 600,
                                padding: {
                                    left: 6,
                                    right: 6,
                                    top: 2,
                                    bottom: 2,
                                },
                            },
                        },
                    };
                }),
            },
            xaxis: {
                categories: chartData.map((item) => item.customer),
                max: xAxisMax,
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
            },
            colors: showTopUpStack
                ? [policyBarColor, topUpBarColor, overBarColor]
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
                    const policyLine =
                        item.policyUsagePct != null
                            ? `<div style="color: ${theme.palette.text.secondary}; font-size: 12px;">${policyUsageLabel}: ${percentFormatter.format(item.policyUsagePct)}%</div>`
                            : "";
                    const topUpLine =
                        showTopUpStack && item.topUpUsagePct != null
                            ? `<div style="color: ${theme.palette.text.secondary}; font-size: 12px;">${topUpUsageLabel}: ${percentFormatter.format(item.topUpUsagePct)}%</div>`
                            : "";
                    const effectiveLine =
                        showTopUpStack && item.effectiveUsagePct != null
                            ? `<div style="color: ${theme.palette.text.secondary}; font-size: 12px;">${effectiveUsageLabel}: ${percentFormatter.format(item.effectiveUsagePct)}%</div>`
                            : `<div style="color: ${theme.palette.text.secondary}; font-size: 12px;">${usagePctLabel}: ${item.usagePct != null ? `${percentFormatter.format(item.usagePct)}%` : "-"}</div>`;
                    const policyNumberLine = item.policyNumber
                        ? `<div style="color: ${theme.palette.text.secondary}; font-size: 11px; margin-top: 4px;">${item.policyNumber}</div>`
                        : "";
                    return `
                        <div style="padding: 8px; background: ${theme.palette.background.paper}; border: 1px solid ${theme.palette.divider}; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <div style="font-weight: 600; margin-bottom: 6px; color: ${theme.palette.text.primary}; font-size: 14px;">${item.customer}</div>
                            <div style="color: ${theme.palette.text.secondary}; font-size: 12px;">${currentArLabel}: ${amountFormatter.format(item.amount)}</div>
                            <div style="color: ${theme.palette.text.secondary}; font-size: 12px;">${approvedLimitLabel}: ${limitText}</div>
                            ${showTopUpStack ? `<div style="color: ${theme.palette.text.secondary}; font-size: 12px;">${topUpTotalLabel}: ${topUpText}</div>` : ""}
                            ${showTopUpStack ? `<div style="color: ${theme.palette.text.secondary}; font-size: 12px;">${effectiveLimitLabel}: ${effectiveText}</div>` : ""}
                            ${policyLine}
                            ${topUpLine}
                            ${effectiveLine}
                            ${policyNumberLine}
                        </div>
                    `;
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
            ];
        }
        return [
            {
                name: usagePctLabel,
                data: chartData.map((item) => item.usagePct),
            },
        ];
    }, [
        chartData,
        showTopUpStack,
        policySeriesLabel,
        topUpSeriesLabel,
        overSeriesLabel,
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
                            {t("common.loading", { ns: "common" })}
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
