import { AttachMoney as MoneyIcon } from "@mui/icons-material";
import { Box, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { formatCurrencyWithRTLSupport } from "@/utils/stringFormatters";
import dynamic from "next/dynamic";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FinancialDashboardChartCard } from "./FinancialDashboardChartCard";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
    ssr: false,
});

// Helper function to get currency code (use code instead of symbol)
const getCurrencySymbol = (currencyCode: string): string => {
    return currencyCode;
};

type EntityData = {
    customer: string; // Can represent customer, business unit, or any entity name
    amount: number;
    percentage: number;
    color: string;
};

interface AmountByEntityChartProps {
    data?: EntityData[];
    currency?: string;
    titleKey?: string;
    barLabelKey?: string;
    donutLabelKey?: string;
    horizontal?: boolean; // Control bar chart orientation
    donutFirst?: boolean; // Control whether donut chart appears first (left) or second (right)
}

const AmountByEntityChart = ({
    data = [],
    currency = "USD",
    titleKey = "fields.stats_invoices_by_customer",
    barLabelKey = "fields.stats_invoices_by_customer_bar",
    donutLabelKey = "fields.stats_invoices_by_customer_doughnut",
    horizontal = true, // Default to horizontal
    donutFirst = false, // Default to bar chart first
}: AmountByEntityChartProps) => {
    const { t, i18n } = useTranslation(["dashboard", "common"]);
    const theme = useTheme();
    const currencySymbol = getCurrencySymbol(currency);
    const locale = i18n.language === "he" ? "he-IL" : "en-US";

    // Generate theme-based colors for donut/bar - variations of chart palette
    const getThemeColors = () => [
        theme.palette.chartPalette.dark,
        theme.palette.chartPalette.main,
        theme.palette.chartPalette.light,
        alpha(theme.palette.chartPalette.main, 0.8),
        alpha(theme.palette.chartPalette.main, 0.6),
        alpha(theme.palette.chartPalette.main, 0.4),
        alpha(theme.palette.chartPalette.dark, 0.8),
        alpha(theme.palette.chartPalette.light, 0.8),
        alpha(theme.palette.chartPalette.main, 0.7),
    ];

    // Default data for demonstration with theme colors - cycling through 4 colors
    const defaultData: EntityData[] = [
        {
            customer: "Coastal Shipping",
            amount: 15500,
            percentage: 26.0,
            color: getThemeColors()[0],
        },
        {
            customer: "City Construction",
            amount: 10500,
            percentage: 19.3,
            color: getThemeColors()[1],
        },
        {
            customer: "TechAdvantage Software",
            amount: 8500,
            percentage: 15.1,
            color: getThemeColors()[2],
        },
        {
            customer: "Urban Apparel",
            amount: 6500,
            percentage: 12.7,
            color: getThemeColors()[3],
        },
        {
            customer: "Global Exports Co.",
            amount: 5500,
            percentage: 10.0,
            color: getThemeColors()[0],
        },
        {
            customer: "Green Gardens",
            amount: 3500,
            percentage: 6.7,
            color: getThemeColors()[1],
        },
        {
            customer: "Innovative Tech",
            amount: 3000,
            percentage: 6.2,
            color: getThemeColors()[2],
        },
        {
            customer: "Solar Solutions",
            amount: 2500,
            percentage: 4.0,
            color: getThemeColors()[3],
        },
    ];

    // Override API colors with theme-based colors for per-account theming
    const chartData = useMemo(() => {
        const rawData = data && data.length > 0 ? data : [];
        const colors = getThemeColors();
        return rawData.map((item, index) => ({
            ...item,
            color: colors[index % colors.length],
        }));
    }, [data, theme]);

    // Keep data in original order (sorted by amount descending)
    // RTL layout is handled by ApexCharts xaxis.reversed option
    const reversedChartData = chartData;

    // Memoize chart options and series to ensure they update when data changes
    // Bar chart options
    const barChartOptions = useMemo(
        () => ({
            chart: {
                type: "bar" as const,
                height: "auto",
                toolbar: {
                    show: false,
                },
                ...(horizontal && i18n.language === "he" && {
                    animations: {
                        enabled: false,
                    },
                }),
            },
            plotOptions: {
                bar: {
                    horizontal: horizontal,
                    borderRadius: 4,
                    distributed: true,
                    dataLabels: {
                        position: horizontal ? "top" : "top",
                    },
                },
            },
            dataLabels: {
                enabled: true,
                formatter: function (val: number) {
                    return formatCurrencyWithRTLSupport(val, currency, locale, i18n.language);
                },
                style: {
                    colors: ["#ffffff"],
                    fontSize: "11px",
                    fontWeight: 600,
                },
                background: {
                    enabled: true,
                    foreColor: theme.palette.chartPalette.main,
                    padding: 4,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: theme.palette.chartPalette.main,
                },
            },
            xaxis: horizontal
                ? {
                    reversed: i18n.language === "he",
                    categories: chartData.map(
                        (item: EntityData) => item.customer
                    ),
                    labels: {
                        formatter: function (val: string) {
                            return `${(Number(val) / 1000).toFixed(2)}K`;
                        },
                        style: {
                            colors: theme.palette.text.secondary,
                            fontSize: "12px",
                        },
                    },
                }
                : {
                    categories: chartData.map(
                        (item: EntityData) => item.customer
                    ),
                    labels: {
                        style: {
                            colors: theme.palette.text.secondary,
                            fontSize: "12px",
                        },
                        rotate: -45,
                        rotateAlways: false,
                    },
                },
            yaxis: horizontal
                ? {
                    opposite: i18n.language === "he",
                    labels: {
                        formatter: function (val: number | string) {
                            const strVal = String(val);
                            // Truncate if longer than 20 characters
                            if (strVal && strVal.length > 20) {
                                return strVal.substring(0, 20) + "...";
                            }
                            return strVal || "";
                        },
                        style: {
                            colors: theme.palette.text.secondary,
                            fontSize: "11px",
                        },
                        maxWidth: 150,
                    },
                }
                : {
                    labels: {
                        formatter: function (val: number) {
                            return formatCurrencyWithRTLSupport(val, currency, locale, i18n.language);
                        },
                        style: {
                            colors: theme.palette.text.secondary,
                            fontSize: "11px",
                        },
                    },
                },
            grid: {
                borderColor: theme.palette.divider,
                strokeDashArray: 3,
            },
            legend: {
                show: false,
            },
            colors: chartData.map((item: EntityData) => item.color),
            tooltip: {
                custom: function ({ series, seriesIndex, dataPointIndex, w }: any) {
                    const item = chartData[dataPointIndex];
                    const customerName = item?.customer || "";
                    const amount = series[seriesIndex][dataPointIndex];
                    return `
                        <div style="padding: 8px; background: ${theme.palette.background.paper}; border: 1px solid ${theme.palette.divider}; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <div style="font-weight: 600; margin-bottom: 4px; color: ${theme.palette.text.primary}; font-size: 14px;">${customerName}</div>
                            <div style="color: ${theme.palette.text.secondary}; font-size: 12px;">${formatCurrencyWithRTLSupport(amount, currency, locale, i18n.language)}</div>
                        </div>
                    `;
                },
            },
        }),
        [chartData, currencySymbol, theme, horizontal, i18n.language]
    );

    const barChartSeries = useMemo(
        () => [
            {
                name: "Amount",
                data: chartData.map((item: EntityData) => item.amount),
            },
        ],
        [chartData]
    );

    // Doughnut chart options
    const doughnutChartOptions = useMemo(
        () => ({
            chart: {
                type: "donut" as const,
                height: "auto",
            },
            labels: chartData.map((item: EntityData) => item.customer),
            colors: chartData.map((item: EntityData) => item.color),
            plotOptions: {
                pie: {
                    donut: {
                        size: "60%",
                    },
                },
            },
            legend: {
                position: i18n.language === "he" ? ("right" as const) : ("left" as const),
                fontSize: "12px",
                labels: {
                    colors: theme.palette.text.primary,
                },
            },
            tooltip: {
                y: {
                    formatter: function (val: number, { seriesIndex }: any) {
                        const item = chartData[seriesIndex];
                        return `${formatCurrencyWithRTLSupport(item.amount, currency, locale, i18n.language)} (${item.percentage}%)`;
                    },
                },
            },
            dataLabels: {
                enabled: true,
                formatter: function (val: number, opts: any) {
                    const seriesIndex = opts.seriesIndex;
                    const item = chartData[seriesIndex];
                    return `${item.percentage}%`;
                },
                style: {
                    colors: ["#ffffff"],
                    fontSize: "12px",
                    fontWeight: 600,
                },
                background: {
                    enabled: false,
                },
            },
        }),
        [chartData, currencySymbol, theme, i18n.language]
    );

    const doughnutChartSeries = useMemo(
        () => chartData.map((item: EntityData) => item.amount),
        [chartData]
    );

    // Create a unique key based on data to force chart re-render when data changes
    const chartKey = useMemo(() => {
        if (chartData.length === 0) return "empty";
        // Create a hash from customer names and amounts to detect changes
        const hash = chartData
            .map((item: EntityData) => `${item.customer}-${item.amount}`)
            .join("|");
        return `${chartData.length}-${hash.substring(0, 50)}`; // Limit hash length
    }, [chartData]);

    // Add tooltips to truncated y-axis labels
    useEffect(() => {
        if (!horizontal) return;

        const addTooltipsToLabels = () => {
            // Find all y-axis label text elements
            const yAxisLabels = document.querySelectorAll(
                '.apexcharts-yaxis-texts-g text[data-testid="y-axis-label"]'
            );

            // If the specific selector doesn't work, try a more general one
            const allYAxisTexts = document.querySelectorAll(
                '.apexcharts-yaxis-texts-g text'
            );

            const labels = allYAxisTexts.length > 0 ? allYAxisTexts : yAxisLabels;

            labels.forEach((label, index) => {
                const textContent = label.textContent || "";
                // Check if the text is truncated (ends with "...")
                if (textContent.endsWith("...")) {
                    // Find the corresponding full customer name
                    const dataIndex = index;
                    const fullName = chartData[dataIndex]?.customer || textContent;
                    // Add title attribute for native browser tooltip
                    label.setAttribute("title", fullName);
                    label.setAttribute("data-full-name", fullName);
                } else {
                    // Even if not truncated, add title for consistency
                    const dataIndex = index;
                    const fullName = chartData[dataIndex]?.customer || textContent;
                    label.setAttribute("title", fullName);
                }
            });
        };

        // Wait for chart to render, then add tooltips
        const timer = setTimeout(addTooltipsToLabels, 100);

        // Also try after a longer delay in case chart takes longer to render
        const timer2 = setTimeout(addTooltipsToLabels, 500);

        return () => {
            clearTimeout(timer);
            clearTimeout(timer2);
        };
    }, [chartKey, horizontal, i18n.language, chartData]);

    return (
        <FinancialDashboardChartCard
            icon={<MoneyIcon />}
            iconAccent="receivables"
            title={t(titleKey)}
            minHeight={400}
        >
            <Box sx={{ pt: 1, flex: 1, overflow: "hidden" }}>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
                            gap: 3,
                            height: "100%",
                            minHeight: "300px",
                        }}
                    >
                        {/* Bar Chart */}
                        {!donutFirst && (
                            <Box
                                sx={{
                                    height: "100%",
                                    minHeight: "300px",
                                    display: "flex",
                                    flexDirection: "column",
                                }}
                            >
                                <Typography
                                    variant="subtitle2"
                                    sx={{
                                        fontWeight: 600,
                                        color: "#2F3B52",
                                        fontSize: "0.875rem",
                                        mb: 1,
                                        textAlign: "center",
                                    }}
                                >
                                    {t(barLabelKey)}
                                </Typography>
                                <Box sx={{ flex: 1, minHeight: "250px" }}>
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
                                        key={`bar-${chartKey}`}
                                        options={barChartOptions}
                                        series={barChartSeries}
                                        type="bar"
                                        height="100%"
                                    />
                                </Box>
                            </Box>
                        )}

                        {/* Doughnut Chart */}
                        <Box
                            sx={{
                                height: "100%",
                                minHeight: "300px",
                                display: "flex",
                                flexDirection: "column",
                            }}
                        >
                            <Typography
                                variant="subtitle2"
                                sx={{
                                    fontWeight: 600,
                                    color: "#2F3B52",
                                    fontSize: "0.875rem",
                                    mb: 1,
                                    textAlign: "center",
                                }}
                            >
                                {t(donutLabelKey)}
                            </Typography>
                            <Box sx={{ flex: 1, minHeight: "250px" }}>
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
                                    key={`donut-${chartKey}`}
                                    options={doughnutChartOptions}
                                    series={doughnutChartSeries}
                                    type="donut"
                                    height="100%"
                                />
                            </Box>
                        </Box>

                        {/* Bar Chart - when donutFirst is true */}
                        {donutFirst && (
                            <Box
                                sx={{
                                    height: "100%",
                                    minHeight: "300px",
                                    display: "flex",
                                    flexDirection: "column",
                                }}
                            >
                                <Typography
                                    variant="subtitle2"
                                    sx={{
                                        fontWeight: 600,
                                        color: "#2F3B52",
                                        fontSize: "0.875rem",
                                        mb: 1,
                                        textAlign: "center",
                                    }}
                                >
                                    {t(barLabelKey)}
                                </Typography>
                                <Box sx={{ flex: 1, minHeight: "250px" }}>
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
                                        key={`bar-${chartKey}`}
                                        options={barChartOptions}
                                        series={barChartSeries}
                                        type="bar"
                                        height="100%"
                                    />
                                </Box>
                            </Box>
                        )}
                    </Box>
            </Box>
        </FinancialDashboardChartCard>
    );
};

export default AmountByEntityChart;
