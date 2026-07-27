"use client";

import { Gavel as GavelIcon, ShowChart as ShowChartIcon } from "@mui/icons-material";
import { alpha, Box, Card, CardContent, Typography, useTheme } from "@mui/material";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type {
    RiskExposureTrendSeries,
    TermsBreachReasonSlice,
} from "./customerDashboardCardViewModel";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

const CHART_GRID_SX = {
    display: "grid",
    gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.2fr) minmax(0, 1fr)" },
    gap: 2,
    width: "100%",
    minWidth: 0,
} as const;

export type CustomerDashboardCreditChartsProps = {
    riskExposureByPolicy: RiskExposureTrendSeries[];
    termsBreachReasonSlices: TermsBreachReasonSlice[];
    formatAmount: (amount: number) => string;
    zeroLineSubtitle: string;
    noBreachesLabel: string;
    riskExposureTitle: string;
    termsBreachReasonTitle: string;
    termsBreachSupplementaryLine?: string;
    isRtl: boolean;
};

export function CustomerDashboardCreditCharts({
    riskExposureByPolicy,
    termsBreachReasonSlices,
    formatAmount,
    zeroLineSubtitle,
    noBreachesLabel,
    riskExposureTitle,
    termsBreachReasonTitle,
    termsBreachSupplementaryLine,
    isRtl,
}: CustomerDashboardCreditChartsProps) {
    const theme = useTheme();
    const chartCard = theme.creditDashboardChartCard;
    const { t } = useTranslation(["dashboard", "common"]);
    const cp = theme.palette.chartPalette;

    const lineChart = useMemo(() => {
        const policies = riskExposureByPolicy.filter(
            (p) => p.policyId > 0 && p.policyLabel.trim().length > 0
        );
        const effectivePolicies =
            policies.length > 0 ? policies : riskExposureByPolicy;
        const categories =
            effectivePolicies[0]?.series.map((p) => p.snapshotDate) ?? [];
        const series = effectivePolicies.map((policy) => ({
            name: policy.policyLabel || riskExposureTitle,
            data: policy.series.map((p) => p.amount),
        }));

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
                alpha(cp.main, 0.75),
            ],
            xaxis: {
                categories,
                labels: {
                    rotate: -45,
                    style: { fontSize: "10px" },
                },
            },
            yaxis: {
                labels: {
                    formatter: (val: number) => formatAmount(val),
                },
            },
            legend: {
                show: effectivePolicies.length > 1,
                position: "top",
            },
            tooltip: {
                y: {
                    formatter: (val: number) => formatAmount(val),
                },
            },
            grid: { borderColor: alpha(theme.palette.divider, 0.6) },
        };

        return { series, options, hasData: categories.length > 0 };
    }, [
        riskExposureByPolicy,
        riskExposureTitle,
        formatAmount,
        cp.dark,
        cp.main,
        cp.light,
        theme.palette.divider,
    ]);

    const donutTotal = useMemo(
        () =>
            termsBreachReasonSlices.reduce((sum, slice) => sum + slice.count, 0),
        [termsBreachReasonSlices]
    );

    const donutChart = useMemo(() => {
        const labels = termsBreachReasonSlices.map((slice) =>
            t(`credit_insurance_dashboard.${slice.labelKey}`, {
                ns: "dashboard",
            })
        );
        const values = termsBreachReasonSlices.map((slice) => slice.count);
        const showEmptyRing = donutTotal === 0;
        const effectiveLabels = showEmptyRing ? [noBreachesLabel] : labels;
        const effectiveValues = showEmptyRing ? [1] : values;

        const options: ApexOptions = {
            chart: {
                type: "donut",
                toolbar: { show: false },
                background: "transparent",
            },
            labels: effectiveLabels,
            colors: [
                cp.dark,
                cp.main,
                cp.light,
                alpha(cp.dark, 0.85),
                alpha(cp.main, 0.85),
                alpha(cp.light, 0.9),
                theme.palette.text.disabled,
            ],
            plotOptions: {
                pie: {
                    donut: {
                        size: "68%",
                        labels: {
                            show: true,
                            total: {
                                show: true,
                                label:
                                    donutTotal === 0
                                        ? noBreachesLabel
                                        : t(
                                              "credit_insurance_dashboard.terms_breach_chart_series_name",
                                              { ns: "dashboard" }
                                          ),
                                formatter: () =>
                                    donutTotal === 0 ? "" : String(donutTotal),
                            },
                        },
                    },
                },
            },
            dataLabels: { enabled: donutTotal > 0 },
            legend: { show: donutTotal > 0, position: "bottom" },
            tooltip: { enabled: donutTotal > 0 },
        };

        return { series: effectiveValues, options };
    }, [
        termsBreachReasonSlices,
        t,
        cp,
        theme.palette.text.disabled,
        donutTotal,
        noBreachesLabel,
    ]);

    return (
        <Box sx={CHART_GRID_SX}>
            <Card
                elevation={0}
                sx={{ ...chartCard.card(theme, { hoverable: false }), minWidth: 0 }}
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
                        sx={chartCard.headerIconLeading(
                            theme,
                            isRtl,
                            "atRisk"
                        )}
                    >
                        <ShowChartIcon />
                    </Box>
                    <Box sx={chartCard.headerColumn(theme, isRtl)}>
                        <Typography sx={chartCard.headerTitle(theme, isRtl)}>
                            {riskExposureTitle}
                        </Typography>
                        {!lineChart.hasData && (
                            <Typography variant="caption" color="text.secondary">
                                {zeroLineSubtitle}
                            </Typography>
                        )}
                    </Box>
                    <Box sx={{ width: "100%", minHeight: 280, mt: 1 }}>
                        <ReactApexChart
                            type="line"
                            height={280}
                            series={lineChart.series}
                            options={lineChart.options}
                        />
                    </Box>
                </CardContent>
            </Card>

            <Card
                elevation={0}
                sx={{ ...chartCard.card(theme, { hoverable: false }), minWidth: 0 }}
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
                        sx={chartCard.headerIconLeading(theme, isRtl, "terms")}
                    >
                        <GavelIcon />
                    </Box>
                    <Box sx={chartCard.headerColumn(theme, isRtl)}>
                        <Typography sx={chartCard.headerTitle(theme, isRtl)}>
                            {termsBreachReasonTitle}
                        </Typography>
                        {termsBreachSupplementaryLine ? (
                            <Typography variant="caption" color="text.secondary">
                                {termsBreachSupplementaryLine}
                            </Typography>
                        ) : null}
                    </Box>
                    <Box sx={{ width: "100%", minHeight: 280, mt: 1 }}>
                        <ReactApexChart
                            type="donut"
                            height={280}
                            series={donutChart.series}
                            options={donutChart.options}
                        />
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
}
