import { Timeline as TimelineIcon } from "@mui/icons-material";
import { Box, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import AppUrls from "@/utils/appUrls";
import { useDashboardBusinessUnitId } from "@/shared/dashboard/DashboardBusinessUnitContext";
import { appendDashboardBusinessUnitId } from "@/shared/dashboard/dashboardBusinessUnitParams";
import { formatAmountWithoutSymbol } from "@/utils/stringFormatters";
import { FinancialDashboardChartCard } from "./FinancialDashboardChartCard";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
    ssr: false,
});

type AutomatedPhaseSplitProps = {
    options?: ApexOptions;
    series?: ApexOptions["series"];
    type?:
    | "line"
    | "area"
    | "bar"
    | "pie"
    | "donut"
    | "radialBar"
    | "scatter"
    | "bubble"
    | "heatmap"
    | "candlestick"
    | "boxPlot"
    | "radar"
    | "polarArea"
    | "rangeBar"
    | "rangeArea"
    | "treemap";
    width?: string | number;
    height?: string | number;
};

const AutomatedPhaseSplit = ({
    options = {},
    series = [],
    type = "line",
    width = "100%",
    height = 280,
}: AutomatedPhaseSplitProps) => {
    const theme = useTheme();
    const { t, i18n } = useTranslation(["dashboard", "common"]);
    const router = useRouter();
    const chartColors = [
        theme.palette.chartPalette.dark,
        theme.palette.chartPalette.main,
        theme.palette.chartPalette.light,
        alpha(theme.palette.chartPalette.main, 0.8),
        alpha(theme.palette.chartPalette.main, 0.6),
        alpha(theme.palette.chartPalette.dark, 0.8),
        alpha(theme.palette.chartPalette.light, 0.8),
    ];
    const params = useParams();
    const locale = (params?.locale as string) || "en";
    const businessUnitId = useDashboardBusinessUnitId();

    // Determine chart type from options or default
    const chartType = options?.chart?.type || type;

    // Check if we have mixed series types (column + line)
    const hasMixedSeries =
        Array.isArray(series) &&
        series.some((s: any) => s && typeof s === "object" && s.type) &&
        series.some(
            (s: any) =>
                !s ||
                typeof s !== "object" ||
                !s.type ||
                s.type !==
                (Array.isArray(series) &&
                    series[0] &&
                    typeof series[0] === "object"
                    ? series[0].type
                    : undefined)
        );

    const handleChartClick = () => {
        // Navigate to dashboard with tab parameter first
        router.push(`/${locale}${AppUrls.DASHBOARD}?tab=overdue`);

        // Then navigate to chart details after a short delay
        setTimeout(() => {
            const searchParams = appendDashboardBusinessUnitId(
                new URLSearchParams({
                    type: "automated-phase-split",
                    period: new Date().toISOString().slice(0, 7),
                }),
                businessUnitId
            );
            router.push(
                `/${locale}${AppUrls.DASHBOARD}/chart-details?${searchParams.toString()}`
            );
        }, 0);
    };

    // Enhanced chart options with consistent styling
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
        colors: chartColors,
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
                text: t("fields.charts_automated_phase_split_x-axis"),
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
        yaxis: Array.isArray(options.yaxis)
            ? options.yaxis.map((yaxis: any, index: number) => ({
                ...yaxis,
                title: {
                    ...yaxis.title,
                    style: {
                        color: "#7C8DA1",
                        fontSize: "12px",
                        fontFamily: "inherit",
                        fontWeight: 500,
                        ...yaxis.title?.style,
                    },
                },
                labels: {
                    ...yaxis.labels,
                    style: {
                        colors: chartColors[index] ?? chartColors[0],
                        fontSize: "12px",
                        fontFamily: "inherit",
                        ...yaxis.labels?.style,
                    },
                },
            }))
            : {
                ...options.yaxis,
                title: {
                    text: t("fields.charts_automated_phase_split_y-axis"),
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
                const colors = chartColors;
                const labels = [
                    t("fields.charts_automated_phase_split_customers"),
                    t("fields.charts_automated_phase_split_invoices"),
                ];
                const stepNumber = dataPointIndex + 1; // Step numbers start from 1

                // RTL alignment for Hebrew
                const isHebrew = i18n.language === "he";
                const textAlign = isHebrew ? "right" : "left";
                const direction = isHebrew ? "rtl" : "ltr";

                // Debug: Log the language detection

                // Use simple inline styles like CollectedVsPromiseChart
                let tooltipContent = `<div class="custom-tooltip" style="background: white; border: 1px solid #DCE3EB; border-radius: 4px; padding: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); font-size: 12px; font-family: inherit; text-align: ${textAlign}; direction: ${direction};">`;

                // Add step number header
                tooltipContent += `<div style="font-weight: 700; color: #2F3B52; margin-bottom: 6px; border-bottom: 1px solid #DCE3EB; padding-bottom: 4px; text-align: ${textAlign}; direction: ${direction};">${t(
                    "fields.charts_automated_phase_split_x-axis"
                )} ${stepNumber}</div>`;

                // Add series values
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
            colors: chartColors,
            width: [0, 0], // No stroke for bars
            curve: "smooth" as const,
        },
        fill: {
            type: "solid",
            opacity: 0.8,
        },
        plotOptions: {
            bar: {
                columnWidth: "60%", // Wider bars for better visibility
                borderRadius: 4,
                dataLabels: {
                    position: "top",
                },
            },
        },
        legend: {
            position: "top" as const,
            horizontalAlign: "center" as const,
            fontFamily: "inherit",
            labels: {
                colors: "#7C8DA1",
                useSeriesColors: false,
            },
            markers: {
                fillColors: chartColors,
            },
        },
        states: {
            hover: {
                filter: {
                    type: "darken",
                },
            },
            active: {
                filter: {
                    type: "darken",
                },
            },
        },
    };

    return (
        <FinancialDashboardChartCard
            icon={<TimelineIcon />}
            iconAccent="capacity"
            title={t("fields.charts_automated_phase_split_title")}
            subtitle={t("fields.charts_automated_phase_split_description")}
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
                        series={
                            [
                                {
                                    name:
                                        t(
                                            "fields.charts_automated_phase_split_customers"
                                        ) || "לקוחות",
                                    data:
                                        Array.isArray(series) &&
                                            series[0] &&
                                            typeof series[0] === "object" &&
                                            "data" in series[0]
                                            ? (series[0].data as number[])
                                            : [],
                                    type: "column",
                                },
                                {
                                    name:
                                        t(
                                            "fields.charts_automated_phase_split_invoices"
                                        ) || "חשבוניות",
                                    data:
                                        Array.isArray(series) &&
                                            series[1] &&
                                            typeof series[1] === "object" &&
                                            "data" in series[1]
                                            ? (series[1].data as number[])
                                            : [],
                                    type: "column",
                                },
                            ] as ApexOptions["series"]
                        }
                        type={hasMixedSeries ? "line" : chartType}
                        width={width}
                        height="100%"
                    />
            </Box>
        </FinancialDashboardChartCard>
    );
};

export default AutomatedPhaseSplit;
