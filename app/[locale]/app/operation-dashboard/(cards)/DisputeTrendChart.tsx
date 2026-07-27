"use client";
import { ShowChart as ShowChartIcon } from "@mui/icons-material";
import { Box, Card, CardContent, Typography, useTheme } from "@mui/material";
import dynamic from "next/dynamic";
import React from "react";
import { useTranslation } from "react-i18next";

import { OperationDashboardResponse } from "@/types/OperationDashboard";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface DisputeTrendChartProps {
    data: OperationDashboardResponse;
}

const DisputeTrendChart: React.FC<DisputeTrendChartProps> = ({ data }) => {
    const { t, i18n } = useTranslation(["disputes", "dashboard", "common"]);
    const theme = useTheme();
    const c = theme.creditDashboardChartCard;
    const isRtl = i18n.language === "he";

    // Use dispute trend data if available, otherwise fall back to aggregate totals
    const hasTrendData =
        data.disputeTrend && data.disputeTrend.dates.length > 0;

    const chartData = hasTrendData
        ? {
            series: [
                {
                    name: t("fields.disputes_created", { ns: "disputes" }),
                    data: data.disputeTrend!.created,
                },
                {
                    name: t("fields.disputes_closed", { ns: "disputes" }),
                    data: data.disputeTrend!.closed,
                },
            ],
            options: {
                chart: {
                    type: "line" as const,
                    height: 350,
                    toolbar: { show: false },
                },
                stroke: {
                    curve: "smooth" as const,
                    width: 3,
                },
                markers: {
                    size: 4,
                    hover: { size: 7 },
                },
                xaxis: {
                    categories: data.disputeTrend!.dates.map((date) => {
                        const d = new Date(date);
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                    }),
                    labels: {
                        style: { colors: theme.palette.text.secondary },
                    },
                },
                yaxis: {
                    labels: {
                        style: { colors: theme.palette.text.secondary },
                    },
                },
                colors: [
                    theme.palette.chartPalette.main,
                    theme.palette.success.main,
                ],
                legend: {
                    position: "bottom" as const,
                    horizontalAlign: "center" as const,
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
                    fillSeriesColor: false,
                    custom: function ({
                        series,
                        dataPointIndex,
                        w,
                    }: {
                        series: number[][];
                        dataPointIndex: number;
                        w: any;
                    }) {
                        const isHebrew = i18n.language === "he";
                        const textAlign = isHebrew ? "right" : "left";
                        const direction = isHebrew ? "rtl" : "ltr";
                        const dateLabel = t("fields.chart_details_date", {
                            ns: "dashboard",
                        });
                        const disputesCreatedLabel = t(
                            "fields.disputes_created",
                            { ns: "disputes" }
                        );
                        const disputesClosedLabel = t(
                            "fields.disputes_closed",
                            { ns: "disputes" }
                        );
                        const labels = [
                            disputesCreatedLabel,
                            disputesClosedLabel,
                        ];
                        const colors = [
                            theme.palette.chartPalette.main,
                            theme.palette.success.main,
                        ];
                        const categoryLabel =
                            w.globals.labels[dataPointIndex] || "";

                        let tooltipContent = `<div class="custom-tooltip" style="background: white !important; border: 1px solid #DCE3EB !important; border-radius: 4px !important; padding: 8px !important; box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important; font-size: 12px !important; font-family: inherit !important; text-align: ${textAlign} !important; direction: ${direction} !important; width: 100% !important; max-width: 200px !important;">`;
                        tooltipContent += `<div style="font-weight: 700 !important; color: #2F3B52 !important; margin-bottom: 6px !important; border-bottom: 1px solid #DCE3EB !important; padding-bottom: 4px !important; text-align: ${textAlign} !important; direction: ${direction} !important;">${dateLabel}: ${categoryLabel}</div>`;

                        series.forEach((seriesData, index) => {
                            const value = seriesData[dataPointIndex];
                            if (value !== undefined && value !== null) {
                                if (isHebrew) {
                                    tooltipContent +=
                                        `<div style="display: flex !important; justify-content: space-between !important; align-items: center !important; margin-bottom: 4px !important; gap: 8px !important; width: 100% !important;">` +
                                        `<div style="font-weight: 600 !important; color: #2F3B52 !important; text-align: right !important; direction: rtl !important; flex: 1 !important;">${labels[index]}</div>` +
                                        `<div style="color: ${colors[index]} !important; font-weight: 500 !important; text-align: left !important; direction: ltr !important; flex-shrink: 0 !important;">${value}</div>` +
                                        `</div>`;
                                } else {
                                    tooltipContent +=
                                        `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 16px;">` +
                                        `<div style="font-weight: 600; color: #2F3B52; text-align: left !important; direction: ltr; flex: 1;">${labels[index]}</div>` +
                                        `<div style="color: ${colors[index]}; font-weight: 500; text-align: right !important; direction: ltr;">${value}</div>` +
                                        `</div>`;
                                }
                            }
                        });

                        tooltipContent += "</div>";
                        return tooltipContent;
                    },
                },
            },
        }
        : {
            series: [
                {
                    name: t("fields.disputes_created", { ns: "disputes" }),
                    data: [data.aggregate.disputes.created],
                },
                {
                    name: t("fields.disputes_closed", { ns: "disputes" }),
                    data: [data.aggregate.disputes.closed],
                },
            ],
            options: {
                chart: {
                    type: "bar" as const,
                    height: 350,
                },
                plotOptions: {
                    bar: {
                        horizontal: false,
                        columnWidth: "55%",
                    },
                },
                dataLabels: {
                    enabled: true,
                },
                xaxis: {
                    categories: [
                        t("fields.current_period", { ns: "dashboard" }),
                    ],
                },
                colors: [
                    theme.palette.chartPalette.main,
                    theme.palette.chartPalette.light,
                ],
                legend: {
                    position: "bottom" as const,
                    horizontalAlign: "center" as const,
                },
                tooltip: {
                    theme: "light",
                    style: {
                        fontSize: "12px",
                        fontFamily: "inherit",
                    },
                    fillSeriesColor: false,
                    custom: function ({
                        series,
                        dataPointIndex,
                        w,
                    }: {
                        series: number[][];
                        dataPointIndex: number;
                        w: any;
                    }) {
                        const isHebrew = i18n.language === "he";
                        const textAlign = isHebrew ? "right" : "left";
                        const direction = isHebrew ? "rtl" : "ltr";
                        const dateLabel = t("fields.chart_details_date", {
                            ns: "dashboard",
                        });
                        const disputesCreatedLabel = t(
                            "fields.disputes_created",
                            { ns: "disputes" }
                        );
                        const disputesClosedLabel = t(
                            "fields.disputes_closed",
                            { ns: "disputes" }
                        );
                        const labels = [
                            disputesCreatedLabel,
                            disputesClosedLabel,
                        ];
                        const colors = [
                            theme.palette.chartPalette.main,
                            theme.palette.chartPalette.light,
                        ];
                        const categoryLabel =
                            w.globals.labels[dataPointIndex] || "";

                        let tooltipContent = `<div class="custom-tooltip" style="background: white !important; border: 1px solid #DCE3EB !important; border-radius: 4px !important; padding: 8px !important; box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important; font-size: 12px !important; font-family: inherit !important; text-align: ${textAlign} !important; direction: ${direction} !important; width: 100% !important; max-width: 200px !important;">`;
                        tooltipContent += `<div style="font-weight: 700 !important; color: #2F3B52 !important; margin-bottom: 6px !important; border-bottom: 1px solid #DCE3EB !important; padding-bottom: 4px !important; text-align: ${textAlign} !important; direction: ${direction} !important;">${dateLabel}: ${categoryLabel}</div>`;

                        series.forEach((seriesData, index) => {
                            const value = seriesData[dataPointIndex];
                            if (value !== undefined && value !== null) {
                                if (isHebrew) {
                                    tooltipContent +=
                                        `<div style="display: flex !important; justify-content: space-between !important; align-items: center !important; margin-bottom: 4px !important; gap: 8px !important; width: 100% !important;">` +
                                        `<div style="font-weight: 600 !important; color: #2F3B52 !important; text-align: right !important; direction: rtl !important; flex: 1 !important;">${labels[index]}</div>` +
                                        `<div style="color: ${colors[index]} !important; font-weight: 500 !important; text-align: left !important; direction: ltr !important; flex-shrink: 0 !important;">${value}</div>` +
                                        `</div>`;
                                } else {
                                    tooltipContent +=
                                        `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 16px;">` +
                                        `<div style="font-weight: 600; color: #2F3B52; text-align: left !important; direction: ltr; flex: 1;">${labels[index]}</div>` +
                                        `<div style="color: ${colors[index]}; font-weight: 500; text-align: right !important; direction: ltr;">${value}</div>` +
                                        `</div>`;
                                }
                            }
                        });

                        tooltipContent += "</div>";
                        return tooltipContent;
                    },
                },
            },
        };

    return (
        <Card
            sx={{
                ...c.card(theme, { clickable: false, hoverable: true }),
                height: "100%",
                minHeight: 400,
            }}
        >
            <CardContent
                sx={{
                    ...c.cardContent(theme, { withChartBody: true }),
                    flex: 1,
                    minHeight: 0,
                    pb: 1,
                    direction: isRtl ? "rtl" : "ltr",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <Box
                    className="card-icon"
                    aria-hidden
                    sx={c.headerIconLeading(theme, isRtl, "terms")}
                >
                    <ShowChartIcon />
                </Box>
                <Box sx={c.headerColumn(theme, isRtl)}>
                    <Typography
                        variant="body2"
                        component="span"
                        sx={{
                            ...c.headerTitle(theme, isRtl),
                            ml: 0,
                            mr: 0,
                            mb: theme.spacing(1),
                            display: "block",
                        }}
                    >
                        {t("fields.dispute_trend_chart_title", { ns: "disputes" })}
                    </Typography>
                </Box>
                <Box sx={{ flex: 1, minHeight: 300 }}>
                    {i18n.language === "he" && (
                        <style>
                            {`
                                .apexcharts-legend {
                                    direction: rtl !important;
                                }
                                .apexcharts-legend-series {
                                    direction: rtl !important;
                                    display: flex !important;
                                    flex-direction: row-reverse !important;
                                    align-items: center !important;
                                }
                                .apexcharts-legend-marker {
                                    order: 2 !important;
                                    margin-left: 8px !important;
                                }
                                .apexcharts-legend-text {
                                    order: 1 !important;
                                    text-align: right !important;
                                    margin-right: 8px !important;
                                }
                            `}
                        </style>
                    )}
                    {hasTrendData && chartData.series[0].data.length > 0 ? (
                        <Chart
                            options={chartData.options}
                            series={chartData.series}
                            type="line"
                            height={350}
                        />
                    ) : chartData.series[0].data.length > 0 ? (
                        <Chart
                            options={chartData.options}
                            series={chartData.series}
                            type="bar"
                            height={350}
                        />
                    ) : (
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ textAlign: "center", py: 4 }}
                        >
                            {t("messages.no_data_available", { ns: "common" })}
                        </Typography>
                    )}
                </Box>
            </CardContent>
        </Card>
    );
};

export default DisputeTrendChart;
