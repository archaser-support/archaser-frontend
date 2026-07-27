import { AttachMoney as MoneyIcon } from "@mui/icons-material";
import { Box, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FinancialDashboardChartCard } from "./FinancialDashboardChartCard";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
    ssr: false,
});

// Helper function to get currency code (use code instead of symbol)
const getCurrencySymbol = (currencyCode: string): string => {
    return currencyCode;
};

type AccountData = {
    customer: string;
    amount: number;
    percentage: number;
    color: string;
};

interface InvoicesByAccountChartProps {
    data?: AccountData[];
    currency?: string;
    titleKey?: string;
    barLabelKey?: string;
    donutLabelKey?: string;
    horizontal?: boolean; // Control bar chart orientation
}

const InvoicesByAccountChart = ({
    data = [],
    currency = "USD",
    titleKey = "fields.stats_invoices_by_customer",
    barLabelKey = "fields.stats_invoices_by_customer_bar",
    donutLabelKey = "fields.stats_invoices_by_customer_doughnut",
    horizontal = true, // Default to horizontal
}: InvoicesByAccountChartProps) => {
    const { t, i18n } = useTranslation(["dashboard", "common"]);
    const theme = useTheme();
    const currencySymbol = getCurrencySymbol(currency);

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
    const defaultData: AccountData[] = [
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

    // Memoize chart options and series to ensure they update when data changes
    // Bar chart options
    const barChartOptions = useMemo(() => ({
        chart: {
            type: "bar" as const,
            height: "auto",
            toolbar: {
                show: false,
            },
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
                return `${currencySymbol} ${val.toLocaleString()}`;
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
                categories: chartData.map((item) => item.customer),
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
                categories: chartData.map((item) => item.customer),
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
                labels: {
                    style: {
                        colors: theme.palette.text.secondary,
                        fontSize: "11px",
                    },
                },
            }
            : {
                labels: {
                    formatter: function (val: number) {
                        return `${currencySymbol} ${val.toLocaleString()}`;
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
        colors: chartData.map((item) => item.color),
        tooltip: {
            y: {
                formatter: function (val: number) {
                    return `${currencySymbol} ${val.toLocaleString()}`;
                },
            },
        },
    }), [chartData, currencySymbol, theme, horizontal]);

    const barChartSeries = useMemo(() => [
        {
            name: "Amount",
            data: chartData.map((item) => item.amount),
        },
    ], [chartData]);

    // Doughnut chart options
    const doughnutChartOptions = useMemo(() => ({
        chart: {
            type: "donut" as const,
            height: "auto",
        },
        labels: chartData.map((item) => item.customer),
        colors: chartData.map((item) => item.color),
        plotOptions: {
            pie: {
                donut: {
                    size: "60%",
                },
            },
        },
        legend: {
            position: "right" as const,
            fontSize: "12px",
            labels: {
                colors: theme.palette.text.primary,
            },
        },
        tooltip: {
            y: {
                formatter: function (val: number, { seriesIndex }: any) {
                    const item = chartData[seriesIndex];
                    return `${currencySymbol} ${item.amount.toLocaleString()} (${item.percentage}%)`;
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
    }), [chartData, currencySymbol, theme]);

    const doughnutChartSeries = useMemo(() =>
        chartData.map((item) => item.amount),
        [chartData]
    );

    // Create a unique key based on data to force chart re-render when data changes
    const chartKey = useMemo(() => {
        if (chartData.length === 0) return 'empty';
        // Create a hash from customer names and amounts to detect changes
        const hash = chartData
            .map(item => `${item.customer}-${item.amount}`)
            .join('|');
        return `${chartData.length}-${hash.substring(0, 50)}`; // Limit hash length
    }, [chartData]);

    return (
        <FinancialDashboardChartCard
            icon={<MoneyIcon />}
            iconAccent="receivables"
            title={t(titleKey)}
            minHeight={400}
        >
            <Box sx={{ pt: 0.5, flex: 1, overflow: "hidden" }}>
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
                    </Box>
            </Box>
        </FinancialDashboardChartCard>
    );
};

export default InvoicesByAccountChart;
