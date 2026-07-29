"use client";

import { Gavel as GavelIcon } from "@mui/icons-material";
import { alpha, Box, Card, CardContent, Typography, useTheme } from "@mui/material";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { TermsBreachCountByReason } from "@/types/creditInsurance";

import { CreditDashboardTitleInfoIcon } from "./creditDashboardTitleTooltip";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

const BREACH_ORDER: {
    key: keyof TermsBreachCountByReason;
    labelKey: string;
}[] = [
    { key: "reportingBreach", labelKey: "breach_type_reporting_breach" },
    { key: "paymentTerm", labelKey: "breach_type_payment_term" },
    { key: "customerOverdueMep", labelKey: "breach_type_customer_overdue_mep" },
    { key: "outdatedDcl", labelKey: "breach_type_outdated_dcl" },
    {
        key: "invoiceAfterPolicyEnd",
        labelKey: "breach_type_invoice_after_policy_end",
    },
];

export type CreditTermsBreachBarChartProps = {
    countByReason: TermsBreachCountByReason;
    onOpenReport?: () => void;
};

export function CreditTermsBreachBarChart({
    countByReason,
    onOpenReport,
}: CreditTermsBreachBarChartProps) {
    const theme = useTheme();
    const c = theme.creditDashboardChartCard;
    const { t, i18n } = useTranslation(["dashboard"]);
    const isRtl = i18n.language === "he";
    const isLight = theme.palette.mode === "light";
    const clickable = Boolean(onOpenReport);

    const { categories, values, barColors } = useMemo(() => {
        const categories: string[] = [];
        const values: number[] = [];
        for (const { key, labelKey } of BREACH_ORDER) {
            categories.push(
                t(`credit_insurance_dashboard.${labelKey}`, {
                    ns: "dashboard",
                })
            );
            values.push(countByReason[key]);
        }
        const cp = theme.palette.chartPalette;
        const barColors = [
            cp.dark,
            cp.main,
            cp.light,
            alpha(cp.dark, 0.85),
            alpha(cp.main, 0.85),
        ];
        return { categories, values, barColors };
    }, [countByReason, t, theme.palette.chartPalette]);

    const series = useMemo(
        () => [
            {
                name: t(
                    "credit_insurance_dashboard.terms_breach_chart_series_name",
                    { ns: "dashboard" }
                ),
                data: values,
            },
        ],
        [t, values]
    );

    const options = useMemo<ApexOptions>(
        () => ({
            chart: {
                type: "bar",
                toolbar: { show: false },
                animations: { enabled: true },
                background: "transparent",
            },
            plotOptions: {
                bar: {
                    horizontal: true,
                    borderRadius: 4,
                    barHeight: "72%",
                    distributed: true,
                    dataLabels: { position: "top" },
                },
            },
            colors: barColors,
            legend: { show: false },
            dataLabels: {
                enabled: true,
                offsetX: 8,
                style: {
                    fontSize: "12px",
                    fontWeight: 600,
                    colors: [isLight ? "#2F3B52" : theme.palette.text.primary],
                },
            },
            xaxis: {
                categories,
                labels: {
                    offsetY: -2,
                    style: {
                        colors: isLight ? "#7C8DA1" : theme.palette.text.secondary,
                        fontWeight: 500,
                    },
                },
            },
            yaxis: {
                labels: {
                    maxWidth: 220,
                    align: "left",
                    style: {
                        fontSize: "11px",
                        colors: isLight ? "#2F3B52" : theme.palette.text.primary,
                    },
                },
            },
            grid: {
                borderColor: isLight ? "#DCE3EB" : theme.palette.divider,
                strokeDashArray: 4,
                xaxis: { lines: { show: true } },
                yaxis: { lines: { show: false } },
                padding: {
                    left: 4,
                    right: 4,
                    bottom: 0,
                },
            },
            tooltip: {
                theme: "light",
                custom: ({ series, seriesIndex, dataPointIndex, w }) => {
                    const textAlign = isRtl ? "right" : "left";
                    const direction = isRtl ? "rtl" : "ltr";
                    const label =
                        (w.globals.labels?.[dataPointIndex] as string | undefined) ??
                        categories[dataPointIndex] ??
                        "";
                    const value = series[seriesIndex]?.[dataPointIndex] ?? 0;
                    const formattedValue = t(
                        "credit_insurance_dashboard.terms_breach_chart_tooltip_y",
                        { ns: "dashboard", count: value }
                    );
                    const color = (w.globals.colors?.[seriesIndex] as string | undefined) ?? "#2F3B52";

                    let tooltipContent = `<div class="custom-tooltip" style="background: white; border: 1px solid #DCE3EB; border-radius: 4px; padding: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); font-size: 12px; font-family: inherit; text-align: ${textAlign}; direction: ${direction};">`;
                    tooltipContent += `<div style="font-weight: 700; color: #2F3B52; margin-bottom: 6px; border-bottom: 1px solid #DCE3EB; padding-bottom: 4px; text-align: ${textAlign}; direction: ${direction};">${label}</div>`;

                    if (isRtl) {
                        tooltipContent +=
                            `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 8px; width: 100%;">` +
                            `<div style="font-weight: 600; color: #2F3B52; text-align: right; direction: rtl; flex: 1;">${series[seriesIndex] ? w.globals.seriesNames?.[seriesIndex] : ""}</div>` +
                            `<div style="color: ${color}; font-weight: 500; text-align: left; direction: ltr; flex-shrink: 0;">${formattedValue}</div>` +
                            `</div>`;
                    } else {
                        tooltipContent +=
                            `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 16px;">` +
                            `<div style="font-weight: 600; color: #2F3B52; text-align: left; direction: ltr; flex: 1;">${series[seriesIndex] ? w.globals.seriesNames?.[seriesIndex] : ""}</div>` +
                            `<div style="color: ${color}; font-weight: 500; text-align: right; direction: ltr;">${formattedValue}</div>` +
                            `</div>`;
                    }

                    tooltipContent += "</div>";
                    return tooltipContent;
                },
            },
        }),
        [
            barColors,
            categories,
            isLight,
            isRtl,
            t,
            theme.palette.divider,
            theme.palette.text.primary,
            theme.palette.text.secondary,
        ]
    );

    return (
        <Card
            onClick={onOpenReport}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={
                clickable && onOpenReport
                    ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onOpenReport();
                          }
                      }
                    : undefined
            }
            sx={{
                ...c.card(theme, { clickable }),
                height: "100%",
                minHeight: 180,
            }}
        >
            {/* Spacer matches policy-usage caption row so the plot area is shorter. */}
            <Box
                aria-hidden
                sx={{
                    flexShrink: 0,
                    height: theme.spacing(3.25),
                    visibility: "hidden",
                    overflow: "hidden",
                    pointerEvents: "none",
                }}
            />
            <CardContent
                sx={{
                    ...c.cardContent(theme, { withChartBody: true }),
                    flex: 1,
                    minHeight: 0,
                    pb: 1,
                    direction: isRtl ? "rtl" : "ltr",
                }}
            >
                <Box
                    className="card-icon"
                    aria-hidden
                    sx={c.headerIconLeading(theme, isRtl, "terms")}
                >
                    <GavelIcon />
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
                                "credit_insurance_dashboard.terms_breach_chart_subtitle",
                                { ns: "dashboard" }
                            )}
                        </Typography>
                        <CreditDashboardTitleInfoIcon
                            isRtl={isRtl}
                            title={t(
                                "tooltips.credit_insurance_terms_breach_chart_calculation",
                                { ns: "dashboard" }
                            )}
                            ariaLabel={t(
                                "credit_insurance_dashboard.chart_title_help_aria",
                                { ns: "dashboard" }
                            )}
                        />
                    </Box>
                </Box>
                <Box
                    sx={{
                        flex: 1,
                        minHeight: 150,
                        position: "relative",
                    }}
                >
                    <ReactApexChart
                        options={options}
                        series={series}
                        type="bar"
                        height={170}
                    />
                </Box>
            </CardContent>
        </Card>
    );
}
