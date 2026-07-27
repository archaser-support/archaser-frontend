import { People as PeopleIcon } from "@mui/icons-material";
import { Box, useTheme } from "@mui/material";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import AppUrls from "@/utils/appUrls";
import { useDashboardBusinessUnitId } from "@/shared/dashboard/DashboardBusinessUnitContext";
import { appendDashboardBusinessUnitId } from "@/shared/dashboard/dashboardBusinessUnitParams";
import { formatAmountWithoutSymbol } from "@/utils/stringFormatters";

import { FinancialDashboardChartCard } from "./FinancialDashboardChartCard";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
    ssr: false,
});

type ActiveAccountsChartProps = {
    options: any;
    series: any;
};

const ActiveAccountsChart = ({
    options = {},
    series = [],
}: ActiveAccountsChartProps) => {
    const theme = useTheme();
    const { t, i18n } = useTranslation(["dashboard", "common"]);
    const router = useRouter();
    const businessUnitId = useDashboardBusinessUnitId();

    // Function to get month date range based on month index
    const getMonthDateRange = (monthIndex: number) => {
        const currentDate = new Date();
        const monthLabels = options.xaxis?.categories || [];
        const clickedMonthLabel = monthLabels[monthIndex];

        const monthMap: { [key: string]: number } = {
            Jan: 1,
            Feb: 2,
            Mar: 3,
            Apr: 4,
            May: 5,
            Jun: 6,
            Jul: 7,
            Aug: 8,
            Sep: 9,
            Oct: 10,
            Nov: 11,
            Dec: 12,
        };

        const monthNumber = monthMap[clickedMonthLabel];
        if (monthNumber === undefined) {
            return { start: "", end: "" };
        }

        // The API now provides data for the last 12 months
        // monthIndex 0 = 11 months ago, monthIndex 1 = 10 months ago, ..., monthIndex 11 = current month
        let targetYear = currentDate.getFullYear();
        const targetMonth = monthNumber;

        // If the clicked month is in the future relative to current month, it's from last year
        if (monthNumber > currentDate.getMonth()) {
            targetYear = currentDate.getFullYear() - 1;
        }

        const period = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}`;

        return {
            start: period,
            end: period,
        };
    };

    // Function to handle month click
    const handleMonthClick = (monthIndex: number) => {
        const { start } = getMonthDateRange(monthIndex);
        const searchParams = appendDashboardBusinessUnitId(
            new URLSearchParams({
                type: "active-customers",
                period: start,
            }),
            businessUnitId
        );
        router.push(
            `${AppUrls.DASHBOARD}/chart-details?${searchParams.toString()}`
        );
    };

    // Enhanced chart options with AgentList color palette
    const enhancedOptions = {
        ...options,
        chart: {
            ...options.chart,
            background: theme.palette.background.paper,
            foreColor: "#2F3B52",
            toolbar: {
                show: false,
            },
            zoom: {
                enabled: false,
            },
            animations: {
                enabled: false,
            },
            selection: {
                enabled: false,
            },
            brush: {
                enabled: false,
            },
            events: {
                dataPointSelection: function (
                    event: any,
                    chartContext: any,
                    config: any
                ) {
                    handleMonthClick(config.dataPointIndex);
                },
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
                text: t("fields.charts_active_customers_x-axis"),
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
                text: t("fields.charts_active_customers_y-axis"),
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
                opacity: 0.9,
                borderWidth: 1,
                borderColor: "#ffffff",
            },
            dropShadow: {
                enabled: true,
                opacity: 0.5,
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
                const labels = [
                    t("actions.charts_common_added"),
                    t("actions.charts_common_removed"),
                ];
                const monthName = _w.globals.labels[dataPointIndex];

                // RTL alignment for Hebrew
                const isHebrew = i18n.language === "he";
                const textAlign = isHebrew ? "right" : "left";
                const direction = isHebrew ? "rtl" : "ltr";

                let tooltipContent = `<div class="custom-tooltip" style="background: white; border: 1px solid #DCE3EB; border-radius: 4px; padding: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); font-size: 12px; font-family: inherit; text-align: ${textAlign}; direction: ${direction};">`;

                tooltipContent += `<div style="font-weight: 700; color: #2F3B52; margin-bottom: 6px; border-bottom: 1px solid #DCE3EB; padding-bottom: 4px; text-align: ${textAlign}; direction: ${direction};">${t(
                    "fields.charts_active_customers_x-axis"
                )}: ${monthName}</div>`;

                series.forEach((seriesData, index) => {
                    const value = seriesData[dataPointIndex];
                    if (value !== undefined && value !== null) {
                        if (isHebrew) {
                            // For Hebrew: value on left, label on right (RTL order)
                            tooltipContent +=
                                `<div style="display: flex !important; justify-content: space-between !important; align-items: center !important; margin-bottom: 4px !important; gap: 8px !important; width: 100% !important;">` +
                                `<div style="font-weight: 600 !important; color: #2F3B52 !important; text-align: right !important; direction: rtl !important; flex: 1 !important;">${labels[index]
                                }</div>` +
                                `<div style="color: ${colors[index]} !important; font-weight: 500 !important; text-align: left !important; direction: ltr !important; flex-shrink: 0 !important;">${value
                                }</div>` +
                                `</div>`;
                        } else {
                            // For English: label on left, value on right (LTR order)
                            tooltipContent +=
                                `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 16px;">` +
                                `<div style="font-weight: 600; color: #2F3B52; text-align: left !important; direction: ltr; flex: 1;">${labels[index]
                                }</div>` +
                                `<div style="color: ${colors[index]}; font-weight: 500; text-align: right !important; direction: ltr;">${value
                                }</div>` +
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
            width: [0, 5], // 0 for column (Added), 5 for line (Removed)
            curve: "smooth",
        },
        fill: {
            type: "solid",
            opacity: 0.8,
        },
        plotOptions: {
            bar: {
                columnWidth: "5%",
                borderRadius: 4,
                dataLabels: {
                    position: "top",
                },
            },
        },
        legend: {
            ...options.legend,
            position: "top",
            horizontalAlign: "center",
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
            icon={<PeopleIcon />}
            iconAccent="reporting"
            title={t("fields.charts_active_customers_title")}
            subtitle={t("fields.charts_active_customers_description")}
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
                                    t("actions.charts_common_added") || "נוסף",
                                data: series[0]?.data || [],
                                type: "column",
                            },
                            {
                                name:
                                    t("actions.charts_common_removed") ||
                                    "הוסר",
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

export default ActiveAccountsChart;
