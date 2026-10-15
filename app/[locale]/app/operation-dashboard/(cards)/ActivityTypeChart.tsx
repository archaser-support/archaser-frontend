"use client";

import { OperationDashboardNavIcon } from "@/shared/components/sidebar-icons";
import { Box, Typography, useTheme } from "@mui/material";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { DashboardDonutChart } from "@/app/[locale]/app/dashboard/(cards)/DashboardDonutChart";
import { FinancialDashboardChartCard } from "@/app/[locale]/app/dashboard/(cards)/FinancialDashboardChartCard";
import { OperationDashboardResponse } from "@/types/OperationDashboard";

interface ActivityTypeChartProps {
    data: OperationDashboardResponse;
}

const ActivityTypeChart: React.FC<ActivityTypeChartProps> = ({ data }) => {
    const { t, i18n } = useTranslation(["activities", "common"]);
    const theme = useTheme();

    const { byType } = data.aggregate.activities;

    const chartData = useMemo(() => {
        const colors = [
            theme.palette.chartPalette.dark,
            theme.palette.chartPalette.main,
            theme.palette.chartPalette.light,
            `${theme.palette.chartPalette.main}99`,
            `${theme.palette.chartPalette.main}4D`,
        ];
        const rows = [
            { name: "SMS", value: byType.SMS || 0 },
            { name: "Email", value: byType.Email || 0 },
            { name: "Call", value: byType.Call || 0 },
            { name: "WhatsApp", value: byType.WhatsApp || 0 },
            { name: "Internal", value: byType.Internal || 0 },
        ];
        return rows.map((row, index) => ({
            ...row,
            color: colors[index % colors.length],
        }));
    }, [byType, theme]);

    const total = useMemo(
        () => chartData.reduce((sum, row) => sum + row.value, 0),
        [chartData]
    );

    return (
        <FinancialDashboardChartCard
            icon={<OperationDashboardNavIcon />}
            iconAccent="default"
            title={t("fields.activity_type_chart_title", { ns: "activities" })}
            titleTooltip={t("fields.activity_type_chart_description", {
                ns: "activities",
            })}
            minHeight={400}
        >
            <Box sx={{ flex: 1, minHeight: 300 }}>
                {total === 0 ? (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ textAlign: "center", py: 4 }}
                    >
                        {t("messages.no_data", { ns: "common" })}
                    </Typography>
                ) : (
                    <DashboardDonutChart
                        data={chartData}
                        language={i18n.language}
                        height={320}
                        showLegend
                        showCenterTotal
                        centerLabel={t("fields.total", { ns: "common" })}
                        showPercentLabels
                    />
                )}
            </Box>
        </FinancialDashboardChartCard>
    );
};

export default ActivityTypeChart;
