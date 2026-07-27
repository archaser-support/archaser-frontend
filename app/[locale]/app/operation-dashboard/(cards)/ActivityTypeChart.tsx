"use client";
import { DonutLarge as DonutLargeIcon } from "@mui/icons-material";
import { Box, Card, CardContent, Typography, useTheme } from "@mui/material";
import dynamic from "next/dynamic";
import React from "react";
import { useTranslation } from "react-i18next";

import { OperationDashboardResponse } from "@/types/OperationDashboard";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface ActivityTypeChartProps {
    data: OperationDashboardResponse;
}

const ActivityTypeChart: React.FC<ActivityTypeChartProps> = ({ data }) => {
    const { t, i18n } = useTranslation(["activities", "common"]);
    const theme = useTheme();
    const c = theme.creditDashboardChartCard;
    const isRtl = i18n.language === "he";

    const { byType } = data.aggregate.activities;

    const series = [
        byType.SMS || 0,
        byType.Email || 0,
        byType.Call || 0,
        byType.WhatsApp || 0,
        byType.Internal || 0,
    ];

    const total = series.reduce((sum, value) => sum + value, 0);

    const chartData = {
        series,
        options: {
            chart: {
                type: "donut" as const,
                height: 350,
            },
            labels: ["SMS", "Email", "Call", "WhatsApp", "Internal"],
            colors: [
                theme.palette.chartPalette.dark,
                theme.palette.chartPalette.main,
                theme.palette.chartPalette.light,
                `${theme.palette.chartPalette.main}99`,
                `${theme.palette.chartPalette.main}4D`,
            ],
            legend: {
                position: "bottom" as const,
                formatter: function (seriesName: string, opts: any) {
                    const value = series[opts.seriesIndex];
                    const percentage =
                        total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
                    return `${seriesName}\n${value.toLocaleString()}\n(${percentage}%)`;
                },
            },
            dataLabels: {
                enabled: true,
                formatter: function (val: number, opts: any) {
                    const value = series[opts.seriesIndex];
                    const percentage =
                        total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
                    return `${value.toLocaleString()}\n(${percentage}%)`;
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
                                formatter: function (val: string) {
                                    return val;
                                },
                            },
                            total: {
                                show: true,
                                label: "Total",
                                fontSize: "14px",
                                fontWeight: 600,
                                formatter: function () {
                                    return total.toLocaleString();
                                },
                            },
                        },
                    },
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
                    sx={c.headerIconLeading(theme, isRtl, "default")}
                >
                    <DonutLargeIcon />
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
                        {t("fields.activity_type_chart_title", {
                            ns: "activities",
                        })}
                    </Typography>
                </Box>
                <Box sx={{ flex: 1, minHeight: 300 }}>
                    <Chart
                        options={chartData.options}
                        series={chartData.series}
                        type="donut"
                        height={350}
                    />
                </Box>
            </CardContent>
        </Card>
    );
};

export default ActivityTypeChart;
