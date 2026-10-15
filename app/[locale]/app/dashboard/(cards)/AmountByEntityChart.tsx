import { FinancialDashboardNavIcon } from "@/shared/components/sidebar-icons";
import { Box, Typography, useTheme } from "@mui/material";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { formatPortfolioMoney } from "@/app/[locale]/app/credit-portfolio-health/formatPortfolioMoney";

import { DashboardDonutChart } from "./DashboardDonutChart";
import { EntityAmountBarChart } from "./EntityAmountBarChart";
import { FinancialDashboardChartCard } from "./FinancialDashboardChartCard";
import { getEntityChartColors } from "./entityChartColors";

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

    // Override API colors with distinct categorical colors for per-account theming
    const chartData = useMemo(() => {
        const rawData = data && data.length > 0 ? data : [];
        const colors = getEntityChartColors(theme);
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

    const barPanel = (
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
            <Box sx={{ flex: 1, minHeight: "250px", overflow: "visible" }}>
                <EntityAmountBarChart
                    data={barRows}
                    currency={currency}
                    language={i18n.language}
                    horizontal={horizontal}
                />
            </Box>
        </Box>
    );

    const donutPanel = (
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
                    language={i18n.language}
                    height={300}
                    innerRadius={92}
                    outerRadius={138}
                    cyPercent={50}
                    formatValue={(value) =>
                        formatPortfolioMoney(value, currency, i18n.language)
                    }
                    showLegend={false}
                    showPercentLabels
                />
            </Box>
        </Box>
    );

    return (
        <FinancialDashboardChartCard
            icon={<FinancialDashboardNavIcon />}
            iconAccent="receivables"
            title={t(titleKey)}
            minHeight={400}
        >
            <Box sx={{ pt: 1, flex: 1, overflow: "visible" }}>
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
                        gap: 3,
                        height: "100%",
                        minHeight: "300px",
                    }}
                >
                    {donutFirst ? (
                        <>
                            {donutPanel}
                            {barPanel}
                        </>
                    ) : (
                        <>
                            {barPanel}
                            {donutPanel}
                        </>
                    )}
                </Box>
            </Box>
        </FinancialDashboardChartCard>
    );
};

export default AmountByEntityChart;
