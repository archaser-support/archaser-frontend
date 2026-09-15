"use client";

import { Gavel as GavelIcon, ShowChart as ShowChartIcon } from "@mui/icons-material";
import { alpha, Box, Card, CardContent, Stack, Typography, useTheme } from "@mui/material";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { CreditDashboardTitleInfoIcon } from "@/app/[locale]/app/credit-dashboard/creditDashboardTitleTooltip";

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
    riskExposureTooltip: string;
    termsBreachReasonTitle: string;
    termsBreachReasonTooltip: string;
    termsBreachSupplementaryLine?: string;
    /** Dual normalized AR vs compliant series — only when limit-capped flag is true. */
    limitCappedNormalizedSeries?: Array<{
        snapshotDate: string;
        totalArNormalized: number;
        compliantNormalized: number;
    }>;
    isRtl: boolean;
};

export function CustomerDashboardCreditCharts({
    riskExposureByPolicy,
    termsBreachReasonSlices,
    formatAmount,
    zeroLineSubtitle,
    noBreachesLabel,
    riskExposureTitle,
    riskExposureTooltip,
    termsBreachReasonTitle,
    termsBreachReasonTooltip,
    termsBreachSupplementaryLine,
    limitCappedNormalizedSeries,
    isRtl,
}: CustomerDashboardCreditChartsProps) {
    const theme = useTheme();
    const chartCard = theme.creditDashboardChartCard;
    const { t } = useTranslation(["dashboard", "common"]);
    const cp = theme.palette.chartPalette;
    const chartTitleHelpAria = t(
        "credit_insurance_dashboard.chart_title_help_aria",
        { ns: "dashboard" }
    );

    const openArSeriesLabel = t("credit_insurance_dashboard.open_ar", {
        ns: "dashboard",
        defaultValue: "Open AR",
    });
    const atRiskSeriesLabel = t(
        "credit_insurance_dashboard.at_risk_exposure",
        { ns: "dashboard", defaultValue: "At Risk Exposure" }
    );
    const capacityGapSeriesLabel = t(
        "credit_insurance_dashboard.capacity_gap",
        { ns: "dashboard", defaultValue: "Capacity Gap" }
    );
    const termsBreachSeriesLabel = t(
        "credit_insurance_dashboard.terms_breach",
        { ns: "dashboard", defaultValue: "Terms Breach" }
    );

    const lineChart = useMemo(() => {
        const policies = riskExposureByPolicy.filter(
            (p) => p.policyId > 0 && p.policyLabel.trim().length > 0
        );
        const effectivePolicies =
            policies.length > 0 ? policies : riskExposureByPolicy;
        const categories =
            effectivePolicies[0]?.series.map((p) => p.snapshotDate) ?? [];
        const multiPolicy = effectivePolicies.length > 1;
        const seriesName = (base: string, policyLabel: string) =>
            multiPolicy
                ? `${base} (${policyLabel || riskExposureTitle})`
                : base;

        const openArSeries = effectivePolicies.map((policy) => ({
            name: seriesName(
                openArSeriesLabel,
                policy.policyLabel || riskExposureTitle
            ),
            data: policy.series.map((p) =>
                Math.max(0, Number(p.openArAmount ?? 0))
            ),
        }));
        const atRiskSeries = effectivePolicies.map((policy) => ({
            name: seriesName(
                atRiskSeriesLabel,
                policy.policyLabel || riskExposureTitle
            ),
            data: policy.series.map((p) => p.amount),
        }));
        const capacityGapSeries = effectivePolicies.map((policy) => ({
            name: seriesName(
                capacityGapSeriesLabel,
                policy.policyLabel || riskExposureTitle
            ),
            data: policy.series.map((p) =>
                Math.max(0, Number(p.capacityGapAmount ?? 0))
            ),
        }));
        const termsBreachSeries = effectivePolicies.map((policy) => ({
            name: seriesName(
                termsBreachSeriesLabel,
                policy.policyLabel || riskExposureTitle
            ),
            data: policy.series.map((p) =>
                Math.max(0, Number(p.termsBreachAmount ?? 0))
            ),
        }));
        const series = [
            ...openArSeries,
            ...atRiskSeries,
            ...capacityGapSeries,
            ...termsBreachSeries,
        ];

        const openArColors = [
            theme.palette.info.main,
            alpha(theme.palette.info.main, 0.8),
            alpha(theme.palette.info.dark, 0.85),
            alpha(theme.palette.info.light, 0.9),
            alpha(theme.palette.info.main, 0.65),
        ];
        const atRiskColors = [
            cp.dark,
            cp.main,
            cp.light,
            alpha(cp.dark, 0.75),
            alpha(cp.main, 0.75),
        ];
        const capacityGapColors = [
            theme.palette.error.main,
            alpha(theme.palette.error.main, 0.75),
            alpha(theme.palette.error.main, 0.55),
            alpha(theme.palette.error.dark, 0.85),
            alpha(theme.palette.error.light, 0.9),
        ];
        const termsBreachColors = [
            theme.palette.warning.main,
            alpha(theme.palette.warning.main, 0.8),
            alpha(theme.palette.warning.dark, 0.85),
            alpha(theme.palette.warning.light, 0.9),
            alpha(theme.palette.warning.main, 0.6),
        ];
        const options: ApexOptions = {
            chart: {
                type: "line",
                toolbar: { show: false },
                background: "transparent",
                animations: { enabled: true },
            },
            stroke: {
                width: [
                    ...openArSeries.map(() => 2.5),
                    ...atRiskSeries.map(() => 2.5),
                    ...capacityGapSeries.map(() => 2),
                    ...termsBreachSeries.map(() => 2),
                ],
                curve: "smooth",
                dashArray: [
                    ...openArSeries.map(() => 0),
                    ...atRiskSeries.map(() => 0),
                    ...capacityGapSeries.map(() => 6),
                    ...termsBreachSeries.map(() => 4),
                ],
            },
            colors: [
                ...openArSeries.map(
                    (_, i) => openArColors[i % openArColors.length]
                ),
                ...atRiskSeries.map(
                    (_, i) => atRiskColors[i % atRiskColors.length]
                ),
                ...capacityGapSeries.map(
                    (_, i) => capacityGapColors[i % capacityGapColors.length]
                ),
                ...termsBreachSeries.map(
                    (_, i) => termsBreachColors[i % termsBreachColors.length]
                ),
            ],
            markers: {
                size: 0,
            },
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
                show: series.length > 1,
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
        openArSeriesLabel,
        atRiskSeriesLabel,
        capacityGapSeriesLabel,
        termsBreachSeriesLabel,
        formatAmount,
        cp.dark,
        cp.main,
        cp.light,
        theme.palette.divider,
        theme.palette.info.main,
        theme.palette.info.dark,
        theme.palette.info.light,
        theme.palette.error.main,
        theme.palette.error.dark,
        theme.palette.error.light,
        theme.palette.warning.main,
        theme.palette.warning.dark,
        theme.palette.warning.light,
    ]);

    const donutTotal = useMemo(
        () =>
            termsBreachReasonSlices.reduce(
                (sum, slice) => sum + Math.max(0, Number(slice.count) || 0),
                0
            ),
        [termsBreachReasonSlices]
    );

    const donutChart = useMemo(() => {
        const activeSlices = termsBreachReasonSlices.filter(
            (slice) => Math.max(0, Number(slice.count) || 0) > 0
        );
        const labels = activeSlices.map((slice) =>
            t(`credit_insurance_dashboard.${slice.labelKey}`, {
                ns: "dashboard",
            })
        );
        const values = activeSlices.map((slice) =>
            Math.max(0, Number(slice.count) || 0)
        );
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
            legend: {
                show: donutTotal > 0,
                position: "bottom",
                formatter: (legendName: string, opts) => {
                    const value =
                        opts?.w?.globals?.series?.[opts.seriesIndex] ?? 0;
                    return `${legendName}: ${value}`;
                },
            },
            tooltip: {
                enabled: donutTotal > 0,
                y: {
                    formatter: (val: number) =>
                        t(
                            "credit_insurance_dashboard.terms_breach_chart_tooltip_y",
                            { ns: "dashboard", count: val }
                        ),
                },
            },
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

    const limitCappedChart = useMemo(() => {
        const points = limitCappedNormalizedSeries ?? [];
        if (points.length === 0) {
            return null;
        }
        const categories = points.map((p) => p.snapshotDate);
        const series = [
            {
                name: t("tooltips.customer_credit_limit_capped_series_ar", {
                    ns: "dashboard",
                    defaultValue: "Total AR (normalized)",
                }),
                data: points.map((p) =>
                    Number((p.totalArNormalized * 100).toFixed(2))
                ),
            },
            {
                name: t(
                    "tooltips.customer_credit_limit_capped_series_compliant",
                    {
                        ns: "dashboard",
                        defaultValue: "Compliant (normalized)",
                    }
                ),
                data: points.map((p) =>
                    Number((p.compliantNormalized * 100).toFixed(2))
                ),
            },
        ];
        const options: ApexOptions = {
            chart: {
                type: "line",
                toolbar: { show: false },
                background: "transparent",
                animations: { enabled: true },
            },
            stroke: { width: 2.5, curve: "smooth" },
            colors: [cp.dark, cp.main],
            markers: { size: 0 },
            xaxis: {
                categories,
                labels: {
                    rotate: -45,
                    style: { fontSize: "10px" },
                },
            },
            yaxis: {
                min: 0,
                max: 100,
                labels: {
                    formatter: (val: number) => `${val.toFixed(0)}%`,
                },
            },
            legend: { show: true, position: "top" },
            tooltip: {
                y: {
                    formatter: (val: number) => `${val.toFixed(1)}%`,
                },
            },
            grid: { borderColor: alpha(theme.palette.divider, 0.6) },
        };
        return { series, options };
    }, [
        limitCappedNormalizedSeries,
        t,
        cp.dark,
        cp.main,
        theme.palette.divider,
    ]);

    return (
        <Stack spacing={2} sx={{ width: "100%", minWidth: 0 }}>
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
                        <Box
                            sx={{
                                ...chartCard.headerTitleRow(theme, isRtl),
                                mb: theme.spacing(1),
                            }}
                        >
                            <Typography
                                variant="body2"
                                component="span"
                                sx={{
                                    ...chartCard.headerTitleInRow(theme, isRtl),
                                    ml: 0,
                                    mr: 0,
                                    mb: 0,
                                    minWidth: 0,
                                }}
                            >
                                {riskExposureTitle}
                            </Typography>
                            <CreditDashboardTitleInfoIcon
                                isRtl={isRtl}
                                title={riskExposureTooltip}
                                ariaLabel={chartTitleHelpAria}
                            />
                        </Box>
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
                        <Box
                            sx={{
                                ...chartCard.headerTitleRow(theme, isRtl),
                                mb: theme.spacing(1),
                            }}
                        >
                            <Typography
                                variant="body2"
                                component="span"
                                sx={{
                                    ...chartCard.headerTitleInRow(theme, isRtl),
                                    ml: 0,
                                    mr: 0,
                                    mb: 0,
                                    minWidth: 0,
                                }}
                            >
                                {termsBreachReasonTitle}
                            </Typography>
                            <CreditDashboardTitleInfoIcon
                                isRtl={isRtl}
                                title={termsBreachReasonTooltip}
                                ariaLabel={chartTitleHelpAria}
                            />
                        </Box>
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
            {limitCappedChart ? (
                <Card
                    elevation={0}
                    sx={{
                        ...chartCard.card(theme, { hoverable: false }),
                        minWidth: 0,
                    }}
                >
                    <CardContent
                        sx={{
                            ...chartCard.cardContent(theme, {
                                withChartBody: true,
                            }),
                            direction: isRtl ? "rtl" : "ltr",
                        }}
                    >
                        <Box sx={chartCard.headerColumn(theme, isRtl)}>
                            <Box
                                sx={{
                                    ...chartCard.headerTitleRow(theme, isRtl),
                                    mb: theme.spacing(1),
                                }}
                            >
                                <Typography
                                    variant="body2"
                                    component="span"
                                    sx={{
                                        ...chartCard.headerTitleInRow(
                                            theme,
                                            isRtl
                                        ),
                                        ml: 0,
                                        mr: 0,
                                        mb: 0,
                                        minWidth: 0,
                                    }}
                                >
                                    {t(
                                        "tooltips.customer_credit_limit_capped_chart_title",
                                        {
                                            ns: "dashboard",
                                            defaultValue:
                                                "Total AR vs compliant exposure (normalized)",
                                        }
                                    )}
                                </Typography>
                                <CreditDashboardTitleInfoIcon
                                    isRtl={isRtl}
                                    title={t(
                                        "tooltips.customer_credit_limit_capped_chart_help",
                                        {
                                            ns: "dashboard",
                                            defaultValue:
                                                "Both series are scaled to their own min–max so divergence is visible even at different money scales. Shown only when the limit-capped flag fires.",
                                        }
                                    )}
                                    ariaLabel={chartTitleHelpAria}
                                />
                            </Box>
                        </Box>
                        <Box sx={{ width: "100%", minHeight: 280, mt: 1 }}>
                            <ReactApexChart
                                type="line"
                                height={280}
                                series={limitCappedChart.series}
                                options={limitCappedChart.options}
                            />
                        </Box>
                    </CardContent>
                </Card>
            ) : null}
        </Stack>
    );
}
