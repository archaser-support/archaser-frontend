"use client";

import { Gavel as GavelIcon } from "@mui/icons-material";
import { Box, CircularProgress, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import dynamic from "next/dynamic";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { FinancialDashboardChartCard } from "@/app/[locale]/app/dashboard/(cards)/FinancialDashboardChartCard";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface DisputeReasonChartProps {
    pieChartData?: {
        labels: string[];
        series: number[];
    };
    isLoading?: boolean;
}

const REASON_MAP: Record<string, string> = {
    "1": "dispute.reasons.billing_error",
    "2": "dispute.reasons.service_issue",
    "3": "dispute.reasons.product_defect",
    "4": "dispute.reasons.delivery_issue",
    "5": "dispute.reasons.other",
};

function translateReasonLabel(label: string, t: (key: string) => string) {
    if (/^\d+$/.test(label)) {
        const translationKey = REASON_MAP[label] || `dispute.reasons.${label}`;
        const translated = t(translationKey);
        return translated === translationKey ? label : translated;
    }
    return label;
}

const DisputeReasonChart: React.FC<DisputeReasonChartProps> = ({
    pieChartData,
    isLoading = false,
}) => {
    const { t, i18n } = useTranslation(["disputes", "common"]);
    const theme = useTheme();
    const isRtl = i18n.language === "he";
    const hasData = Boolean(pieChartData && pieChartData.labels.length > 0);

    const chartColors = useMemo(
        () => [
            theme.palette.chartPalette.dark,
            theme.palette.chartPalette.main,
            theme.palette.chartPalette.light,
            alpha(theme.palette.chartPalette.main, 0.8),
            alpha(theme.palette.chartPalette.main, 0.6),
        ],
        [theme.palette.chartPalette]
    );

    const categories = useMemo(
        () => pieChartData?.labels?.map((label) => translateReasonLabel(label, t)) || [],
        [pieChartData?.labels, t]
    );

    const chartOptions = useMemo(
        () => ({
            chart: {
                type: "bar" as const,
                height: 200,
                toolbar: { show: false },
                background: "transparent",
            },
            plotOptions: {
                bar: {
                    horizontal: true,
                    borderRadius: 4,
                    barHeight: "60%",
                },
            },
            colors: chartColors,
            dataLabels: {
                enabled: true,
                dropShadow: { enabled: false },
                style: {
                    fontSize: "12px",
                    fontFamily: "inherit",
                    fontWeight: 600,
                    colors: ["#FFFFFF"],
                },
                formatter(val: number, opts: { globals: { seriesTotals: number[] } }) {
                    const total = opts.globals.seriesTotals.reduce(
                        (a, b) => a + b,
                        0
                    );
                    const percentage =
                        total > 0 ? ((val / total) * 100).toFixed(1) : "0.0";
                    return `${percentage}%`;
                },
            },
            xaxis: {
                categories,
                labels: {
                    style: {
                        colors: theme.palette.text.secondary,
                        fontSize: "12px",
                        fontFamily: "inherit",
                    },
                    rotate: isRtl ? -45 : 0,
                },
                axisBorder: { color: theme.palette.divider },
                axisTicks: { color: theme.palette.divider },
            },
            yaxis: {
                labels: {
                    style: {
                        colors: theme.palette.text.secondary,
                        fontSize: "12px",
                        fontFamily: "inherit",
                    },
                },
            },
            grid: {
                borderColor: theme.palette.divider,
                strokeDashArray: 4,
            },
            tooltip: {
                theme: "light",
                style: {
                    fontSize: "12px",
                    fontFamily: "inherit",
                },
                custom({
                    series,
                    dataPointIndex,
                    w,
                }: {
                    series: number[][];
                    dataPointIndex: number;
                    w: { globals: { labels: string[] } };
                }) {
                    let val = 0;
                    if (Array.isArray(series) && series.length > 0) {
                        if (Array.isArray(series[0])) {
                            val = Number(series[0][dataPointIndex]) || 0;
                        } else {
                            val = Number(series[dataPointIndex]) || 0;
                        }
                    }
                    const rawLabel = w.globals.labels[dataPointIndex];
                    const translatedLabel = translateReasonLabel(rawLabel, t);
                    const displayValue = Math.round(Number(val)) || 0;
                    const valueColor =
                        chartColors[dataPointIndex % chartColors.length] ||
                        chartColors[0];
                    return `<div style="background: white; border: 1px solid #DCE3EB; border-radius: 4px; padding: 8px; font-size: 12px; font-family: inherit;">
                        <div style="font-weight: 600; color: #2F3B52; margin-bottom: 4px;">${translatedLabel}</div>
                        <div style="color: ${valueColor}; font-weight: 500;">${displayValue} ${t("sections.title", { count: displayValue })}</div>
                    </div>`;
                },
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
        [categories, chartColors, isRtl, t, theme.palette.divider, theme.palette.text.secondary]
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
                    series={[{ name: "Disputes", data: pieChartData?.series || [] }]}
                    type="bar"
                    height={200}
                />
            )}
        </Box>
    );

    return (
        <FinancialDashboardChartCard
            icon={<GavelIcon />}
            iconAccent="atRisk"
            title={t("sections.disputes_by_reason")}
            clickable={false}
            minHeight={280}
            bodySx={{ minHeight: 180 }}
        >
            {chartContent}
        </FinancialDashboardChartCard>
    );
};

export default DisputeReasonChart;
