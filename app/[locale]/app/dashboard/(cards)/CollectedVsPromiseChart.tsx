import { AccountBalance as AccountBalanceIcon } from "@mui/icons-material";
import { Box, useTheme } from "@mui/material";
import dynamic from "next/dynamic";
import { useTranslation } from "react-i18next";

import { formatAmountWithoutSymbol } from "@/utils/stringFormatters";

import { FinancialDashboardChartCard } from "./FinancialDashboardChartCard";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
    ssr: false,
});

type CollectedVsPromiseChartProps = {
    options: any;
    series: any;
};

const CollectedVsPromiseChart = ({
    options = {},
    series = [],
}: CollectedVsPromiseChartProps) => {
    const theme = useTheme();
    const { t, i18n } = useTranslation(["dashboard", "common"]);

    // Enhanced chart options with AgentList color palette
    const enhancedOptions = {
        ...options,
        chart: {
            ...options.chart,
            background: theme.palette.background.paper,
            foreColor: "#2F3B52",
            toolbar: {
                show: false, // Hide toolbar (zoom, download, etc.)
            },
            zoom: {
                enabled: false, // Disable zoom functionality
            },
            animations: {
                enabled: false, // Disable animations for cleaner look
            },
            selection: {
                enabled: false, // Disable selection
            },
            brush: {
                enabled: false, // Disable brush selection
            },
        },
        colors: [theme.palette.chartPalette.main, theme.palette.chartPalette.light],
        grid: {
            ...options.grid,
            borderColor: "#DCE3EB",
            strokeDashArray: 5,
            xaxis: {
                lines: {
                    show: true,
                    color: "#DCE3EB",
                },
            },
            yaxis: {
                lines: {
                    show: true,
                    color: "#DCE3EB",
                },
            },
        },
        xaxis: {
            ...options.xaxis,
            title: {
                text: t("fields.charts_collected_vs_promise_x-axis"),
                style: {
                    color: "#7C8DA1",
                    fontSize: "12px",
                    fontFamily: "inherit",
                    fontWeight: 500,
                },
            },
            labels: {
                ...options.xaxis?.labels,
                style: {
                    colors: "#7C8DA1",
                    fontSize: "12px",
                    fontFamily: "inherit",
                },
            },
            axisBorder: {
                color: "#DCE3EB",
            },
            axisTicks: {
                color: "#DCE3EB",
            },
        },
        yaxis: {
            ...options.yaxis,
            title: {
                text: t("fields.charts_collected_vs_promise_y-axis"),
                style: {
                    color: "#7C8DA1",
                    fontSize: "12px",
                    fontFamily: "inherit",
                    fontWeight: 500,
                },
            },
            labels: {
                ...options.yaxis?.labels,
                style: {
                    colors: "#7C8DA1",
                    fontSize: "12px",
                    fontFamily: "inherit",
                },
            },
        },
        dataLabels: {
            enabled: true,
            style: {
                fontSize: "11px",
                fontFamily: "inherit",
                fontWeight: "600",
                colors: ["#FFFFFF"],
            },
            background: {
                enabled: true,
                foreColor: "#2F3B52",
                borderRadius: 4,
                padding: 4,
                opacity: 0.9, // Increased opacity for better contrast
                borderWidth: 1,
                borderColor: "#ffffff",
            },
            dropShadow: {
                enabled: true,
                opacity: 0.5, // Increased shadow opacity
                blur: 3,
                left: 0,
                top: 0,
            },
            formatter: function (val: number) {
                return formatAmountWithoutSymbol(val);
            },
        },
        tooltip: {
            ...options.tooltip,
            theme: "light",
            style: {
                fontSize: "12px",
                fontFamily: "inherit",
            },
            fillSeriesColor: false,
            custom: function ({
                series,
                seriesIndex: _seriesIndex,
                dataPointIndex,
                w: _w,
            }: {
                series: number[][];
                seriesIndex: number;
                dataPointIndex: number;
                w: any;
            }) {
                const colors = [
                    theme.palette.chartPalette.main,
                    theme.palette.chartPalette.light,
                ];

                // Use direct translation keys that exist in the Hebrew file
                const totalCollectedLabel =
                    t("fields.charts_collection_stats_total_collected_m_t_d") ||
                    "סה״כ נאסף (MTD)";
                const promiseToPayLabel =
                    t("fields.charts_collection_stats_promise_to_pay") ||
                    "הבטחת תשלום";

                const labels = [totalCollectedLabel, promiseToPayLabel];
                const monthName = _w.globals.labels[dataPointIndex]; // Get the month name from x-axis labels

                // RTL alignment for Hebrew
                const isHebrew = i18n.language === "he";
                const textAlign = isHebrew ? "right" : "left";
                const direction = isHebrew ? "rtl" : "ltr";

                // Show month name and both values in the tooltip
                let tooltipContent = `<div class="custom-tooltip" style="background: white !important; border: 1px solid #DCE3EB !important; border-radius: 4px !important; padding: 8px !important; box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important; font-size: 12px !important; font-family: inherit !important; text-align: ${textAlign} !important; direction: ${direction} !important; width: 100% !important; max-width: 200px !important;">`;

                // Add month name header
                tooltipContent += `<div style="font-weight: 700 !important; color: #2F3B52 !important; margin-bottom: 6px !important; border-bottom: 1px solid #DCE3EB !important; padding-bottom: 4px !important; text-align: ${textAlign} !important; direction: ${direction} !important;">${t(
                    "fields.charts_collected_vs_promise_x-axis"
                )}: ${monthName}</div>`;

                // Add both series values
                series.forEach((seriesData, index) => {
                    const value = seriesData[dataPointIndex];
                    if (value !== undefined && value !== null) {
                        const formattedValue = formatAmountWithoutSymbol(value);
                        if (isHebrew) {
                            // For Hebrew: value on left, label on right (RTL order)
                            tooltipContent +=
                                `<div style="display: flex !important; justify-content: space-between !important; align-items: center !important; margin-bottom: 4px !important; gap: 8px !important; width: 100% !important;">` +
                                `<div style="font-weight: 600 !important; color: #2F3B52 !important; text-align: right !important; direction: rtl !important; flex: 1 !important;">${labels[index]}</div>` +
                                `<div style="color: ${colors[index]} !important; font-weight: 500 !important; text-align: left !important; direction: ltr !important; flex-shrink: 0 !important;">${formattedValue}</div>` +
                                `</div>`;
                        } else {
                            // For English: label on left, value on right (LTR order)
                            tooltipContent +=
                                `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 16px;">` +
                                `<div style="font-weight: 600; color: #2F3B52; text-align: left !important; direction: ltr; flex: 1;">${labels[index]}</div>` +
                                `<div style="color: ${colors[index]}; font-weight: 500; text-align: right !important; direction: ltr;">${formattedValue}</div>` +
                                `</div>`;
                        }
                    }
                });

                tooltipContent += "</div>";
                return tooltipContent;
            },
        },
        stroke: {
            ...options.stroke,
            colors: [theme.palette.chartPalette.main, theme.palette.chartPalette.light],
            width: [0, 5], // No stroke for bars (index 0), 3px for line (index 1)
            curve: "smooth",
        },
        fill: {
            type: "solid",
            opacity: 0.8,
        },
        plotOptions: {
            bar: {
                columnWidth: "7%", // Very thin bars
                borderRadius: 4,
                dataLabels: {
                    position: "top",
                },
            },
        },
        legend: {
            ...options.legend,
            labels: {
                colors: [theme.palette.chartPalette.main, theme.palette.chartPalette.light],
                useSeriesColors: false,
            },
            markers: {
                fillColors: [
                    theme.palette.chartPalette.main,
                    theme.palette.chartPalette.light,
                ],
            },
        },
    };

    return (
        <FinancialDashboardChartCard
            icon={<AccountBalanceIcon />}
            iconAccent="compliant"
            title={t("fields.charts_collected_vs_promise_title")}
            subtitle={t("fields.charts_collected_vs_promise_description")}
            minHeight={400}
        >
            <Box sx={{ pt: 0.5, height: "100%", minHeight: 280 }}>
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
                    <ReactApexChart
                        options={enhancedOptions}
                        series={[
                            {
                                name:
                                    t(
                                        "fields.charts_collection_stats_total_collected_m_t_d"
                                    ) || "סה״כ נאסף (MTD)",
                                data: series[0]?.data || [],
                                type: "column",
                            },
                            {
                                name:
                                    t(
                                        "fields.charts_collection_stats_promise_to_pay"
                                    ) || "הבטחת תשלום",
                                data: series[1]?.data || [],
                                type: "line",
                            },
                        ]}
                        type="line"
                        height="100%"
                    />
            </Box>
        </FinancialDashboardChartCard>
    );
};

export default CollectedVsPromiseChart;
