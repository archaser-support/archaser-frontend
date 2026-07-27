"use client";

import { Paid as PaidIcon } from "@mui/icons-material";
import { alpha, Box, Card, CardContent, Typography, useTheme } from "@mui/material";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
    buildDailyCostChangeChartSeries,
    formatSignedCostChangeAmount,
    isDailyCostChangeChartEmpty,
    type DailyCostChangeChartPoint,
} from "./customerDashboardDailyCostViewModel";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export type CustomerDashboardDailyCostChartProps = {
    points: DailyCostChangeChartPoint[];
    isRtl: boolean;
    locale: string;
    title: string;
    emptyLabel: string;
    policySeriesLabel: string;
    topUpSeriesLabel: string;
    totalSeriesLabel: string;
};

export function CustomerDashboardDailyCostChart({
    points,
    isRtl,
    locale,
    title,
    emptyLabel,
    policySeriesLabel,
    topUpSeriesLabel,
    totalSeriesLabel,
}: CustomerDashboardDailyCostChartProps) {
    const theme = useTheme();
    const chartCard = theme.creditDashboardChartCard;
    const cp = theme.palette.chartPalette;
    const isEmpty = isDailyCostChangeChartEmpty(points);

    const chart = useMemo(() => {
        const mapped = buildDailyCostChangeChartSeries(points);
        const series = [
            {
                name: policySeriesLabel,
                data: mapped.policySeries,
            },
            {
                name: topUpSeriesLabel,
                data: mapped.topUpSeries,
            },
        ];
        if (mapped.showTotal) {
            series.push({
                name: totalSeriesLabel,
                data: mapped.totalSeries,
            });
        }

        const options: ApexOptions = {
            chart: {
                type: "line",
                toolbar: { show: false },
                background: "transparent",
                animations: { enabled: true },
            },
            stroke: { width: 2.5, curve: "smooth" },
            colors: [
                cp.dark,
                cp.main,
                cp.light,
                alpha(cp.dark, 0.75),
            ],
            xaxis: {
                categories: mapped.categories,
                labels: {
                    rotate: -45,
                    style: { fontSize: "10px" },
                },
            },
            yaxis: {
                labels: {
                    formatter: (val: number) =>
                        formatSignedCostChangeAmount(val, null, locale, isRtl),
                },
            },
            legend: {
                show: true,
                position: "top",
            },
            tooltip: {
                y: {
                    formatter: (val: number) =>
                        formatSignedCostChangeAmount(val, null, locale, isRtl),
                },
            },
            grid: { borderColor: alpha(theme.palette.divider, 0.6) },
        };

        return { series, options, hasData: mapped.hasData };
    }, [
        points,
        policySeriesLabel,
        topUpSeriesLabel,
        totalSeriesLabel,
        locale,
        isRtl,
        cp.dark,
        cp.main,
        cp.light,
        theme.palette.divider,
    ]);

    return (
        <Card
            elevation={0}
            sx={{ ...chartCard.card(theme, { hoverable: false }), minWidth: 0, width: "100%" }}
        >
            <CardContent
                sx={{
                    ...chartCard.cardContent(theme, { withChartBody: true }),
                    direction: isRtl ? "rtl" : "ltr",
                }}
            >
                <Box
                    className="card-icon"
                    aria-hidden
                    sx={chartCard.headerIconLeading(theme, isRtl, "capacity")}
                >
                    <PaidIcon />
                </Box>
                <Box sx={chartCard.headerColumn(theme, isRtl)}>
                    <Typography sx={chartCard.headerTitle(theme, isRtl)}>
                        {title}
                    </Typography>
                    {isEmpty && (
                        <Typography variant="caption" color="text.secondary">
                            {emptyLabel}
                        </Typography>
                    )}
                </Box>
                <Box sx={{ width: "100%", minHeight: 280, mt: 1 }}>
                    <ReactApexChart
                        type="line"
                        height={280}
                        series={chart.series}
                        options={chart.options}
                    />
                </Box>
            </CardContent>
        </Card>
    );
}
