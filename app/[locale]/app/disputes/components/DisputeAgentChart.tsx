"use client";

import { Group as GroupIcon } from "@mui/icons-material";
import { Box, CircularProgress, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import dynamic from "next/dynamic";
import React, { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { FinancialDashboardChartCard } from "@/app/[locale]/app/dashboard/(cards)/FinancialDashboardChartCard";

const Chart = dynamic(() => import("react-apexcharts"), {
    ssr: false,
    loading: () => <CircularProgress color="primary" size={40} />,
});

interface DisputeAgentChartProps {
    disputeAssignFrequencyList?: Array<{
        name: string;
        dispute_count: number;
        user_image: string | null;
    }>;
    isLoading?: boolean;
}

const DisputeAgentChart: React.FC<DisputeAgentChartProps> = React.memo(
    ({ disputeAssignFrequencyList, isLoading = false }) => {
        const { t, i18n } = useTranslation(["disputes", "common"]);
        const theme = useTheme();
        const isRtl = i18n.language === "he";
        const locale = isRtl ? "he-IL" : "en-US";

        const { labels, series, hasData, total } = useMemo(() => {
            if (
                !disputeAssignFrequencyList ||
                disputeAssignFrequencyList.length === 0
            ) {
                return { labels: [], series: [], hasData: false, total: 0 };
            }
            const values = disputeAssignFrequencyList.map(
                (item) => item.dispute_count
            );
            return {
                labels: disputeAssignFrequencyList.map((item) => item.name),
                series: values,
                hasData: true,
                total: values.reduce((sum, value) => sum + value, 0),
            };
        }, [disputeAssignFrequencyList]);

        const tooltipCustom = useCallback(
            ({ series, seriesIndex, w }: { series: number[]; seriesIndex: number; w: { globals: { labels: string[] } } }) => {
                const val = series[seriesIndex];
                const agentName =
                    w.globals.labels?.[seriesIndex] ??
                    labels[seriesIndex] ??
                    "Unknown";
                const displayValue = Math.round(Number(val)) || 0;

                return `<div style="background: white; border: 1px solid #DCE3EB; border-radius: 4px; padding: 8px; font-size: 12px; font-family: inherit;">
                <div style="font-weight: 600; color: #2F3B52; margin-bottom: 4px;">${t("sections.disputes_by_agent")}</div>
                <div style="color: #7C8DA1; margin-bottom: 2px;">${agentName}</div>
                <div style="color: ${theme.palette.chartPalette.main}; font-weight: 500;">${displayValue} ${t("sections.title", { count: displayValue })}</div>
            </div>`;
            },
            [labels, t, theme.palette.chartPalette.main]
        );

        const chartOptions = useMemo(
            () => ({
                chart: {
                    type: "donut" as const,
                    height: 200,
                    toolbar: { show: false },
                    background: "transparent",
                },
                labels,
                colors: [
                    theme.palette.chartPalette.dark,
                    theme.palette.chartPalette.main,
                    theme.palette.chartPalette.light,
                    alpha(theme.palette.chartPalette.main, 0.8),
                    alpha(theme.palette.chartPalette.main, 0.6),
                ],
                legend: {
                    position: "bottom" as const,
                    horizontalAlign: "center" as const,
                    fontSize: "12px",
                    fontFamily: "inherit",
                    labels: {
                        colors: theme.palette.text.secondary,
                    },
                    formatter(seriesName: string, opts: { seriesIndex: number }) {
                        const value = series[opts.seriesIndex];
                        const percentage =
                            total > 0
                                ? ((value / total) * 100).toFixed(1)
                                : "0.0";
                        return `${seriesName} (${percentage}%)`;
                    },
                },
                dataLabels: {
                    enabled: true,
                    dropShadow: { enabled: false },
                    formatter(_val: number, opts: { seriesIndex: number }) {
                        return series[opts.seriesIndex]?.toLocaleString(locale) ?? "";
                    },
                    style: {
                        fontSize: "12px",
                        fontWeight: 600,
                    },
                },
                plotOptions: {
                    pie: {
                        donut: {
                            size: "65%",
                            labels: {
                                show: true,
                                name: {
                                    show: true,
                                    fontSize: "14px",
                                    fontWeight: 600,
                                },
                                value: {
                                    show: true,
                                    fontSize: "16px",
                                    fontWeight: 700,
                                    formatter(val: string) {
                                        return val;
                                    },
                                },
                                total: {
                                    show: true,
                                    label: t("sections.total_disputes") || "Total",
                                    fontSize: "14px",
                                    fontWeight: 600,
                                    formatter() {
                                        return total.toLocaleString(locale);
                                    },
                                },
                            },
                        },
                    },
                },
                tooltip: {
                    theme: "light",
                    style: {
                        fontSize: "12px",
                        fontFamily: "inherit",
                    },
                    custom: tooltipCustom,
                },
                noData: {
                    text: t("messages.no_data", { ns: "common" }),
                    align: "center" as const,
                    verticalAlign: "middle" as const,
                    style: {
                        color: theme.palette.text.secondary,
                        fontSize: "14px",
                        fontFamily: "inherit",
                    },
                },
            }),
            [labels, locale, series, t, theme, total, tooltipCustom]
        );

        const chartContent = (
            <Box
                sx={{
                    flex: 1,
                    minHeight: 180,
                    direction: isRtl ? "rtl" : "ltr",
                    "& .apexcharts-canvas svg": { background: "transparent" },
                    "& foreignObject": { background: "transparent !important" },
                    "& .apexcharts-tooltip": { boxShadow: "none !important" },
                }}
            >
                {isLoading ? (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: 180,
                        }}
                    >
                        <CircularProgress color="primary" size={40} />
                    </Box>
                ) : !hasData ? (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ textAlign: "center", py: 4 }}
                    >
                        {t("messages.no_data", { ns: "common" })}
                    </Typography>
                ) : (
                    <Chart
                        options={chartOptions}
                        series={series}
                        type="donut"
                        height={200}
                    />
                )}
            </Box>
        );

        return (
            <FinancialDashboardChartCard
                icon={<GroupIcon />}
                iconAccent="default"
                title={t("sections.disputes_by_agent")}
                clickable={false}
                minHeight={280}
                bodySx={{ minHeight: 180 }}
            >
                {chartContent}
            </FinancialDashboardChartCard>
        );
    }
);

DisputeAgentChart.displayName = "DisputeAgentChart";

export default DisputeAgentChart;
