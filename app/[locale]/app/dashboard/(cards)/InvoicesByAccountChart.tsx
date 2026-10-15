import { FinancialDashboardNavIcon } from "@/shared/components/sidebar-icons";
import { Box, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { formatPortfolioMoney } from "@/app/[locale]/app/credit-portfolio-health/formatPortfolioMoney";

import { DashboardDonutChart } from "./DashboardDonutChart";
import { EntityAmountBarChart } from "./EntityAmountBarChart";
import { FinancialDashboardChartCard } from "./FinancialDashboardChartCard";

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
    const language = i18n.language;

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

    // Override API colors with theme-based colors for per-account theming
    const chartData = useMemo(() => {
        const rawData = data && data.length > 0 ? data : [];
        const colors = getThemeColors();
        return rawData.map((item, index) => ({
            ...item,
            color: colors[index % colors.length],
        }));
    }, [data, theme]);

    const barRows = useMemo(
        () =>
            chartData.map((item) => ({
                name: item.customer,
                amount: item.amount,
                color: item.color,
                percentage: item.percentage,
            })),
        [chartData]
    );

    const donutRows = useMemo(
        () =>
            chartData.map((item) => ({
                name: item.customer,
                value: item.amount,
                color: item.color,
                percentage: item.percentage,
            })),
        [chartData]
    );

    return (
        <FinancialDashboardChartCard
            icon={<FinancialDashboardNavIcon />}
            iconAccent="receivables"
            title={t(titleKey)}
            minHeight={400}
        >
            <Box sx={{ pt: 0.5, flex: 1, overflow: "visible" }}>
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
                        gap: 3,
                        height: "100%",
                        minHeight: "300px",
                    }}
                >
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
                        <Box
                            sx={{
                                flex: 1,
                                minHeight: "250px",
                                overflow: "visible",
                            }}
                        >
                            <EntityAmountBarChart
                                data={barRows}
                                currency={currency}
                                language={language}
                                horizontal={horizontal}
                            />
                        </Box>
                    </Box>

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
                            <DashboardDonutChart
                                data={donutRows}
                                language={language}
                                height={280}
                                formatValue={(value) =>
                                    formatPortfolioMoney(
                                        value,
                                        currency,
                                        language
                                    )
                                }
                                showLegend
                                showPercentLabels
                            />
                        </Box>
                    </Box>
                </Box>
            </Box>
        </FinancialDashboardChartCard>
    );
};

export default InvoicesByAccountChart;
