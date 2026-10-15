"use client";

import { DisputesNavIcon } from "@/shared/components/sidebar-icons";
import { Box, Typography, useTheme } from "@mui/material";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
    Bar,
    CartesianGrid,
    ComposedChart,
    Legend,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { FinancialDashboardChartCard } from "@/app/[locale]/app/dashboard/(cards)/FinancialDashboardChartCard";
import { OperationDashboardResponse } from "@/types/OperationDashboard";

interface DisputeTrendChartProps {
    data: OperationDashboardResponse;
}

type ChartRow = {
    label: string;
    created: number;
    closed: number;
};

type DisputeTooltipProps = {
    active?: boolean;
    label?: string | number;
    payload?: ReadonlyArray<{ payload?: ChartRow }>;
    createdLabel: string;
    closedLabel: string;
    createdColor: string;
    closedColor: string;
    dateLabel: string;
    isRtl: boolean;
};

function DisputeTooltip({
    active,
    label,
    payload,
    createdLabel,
    closedLabel,
    createdColor,
    closedColor,
    dateLabel,
    isRtl,
}: DisputeTooltipProps) {
    const row = payload?.[0]?.payload;
    if (!active || row == null) {
        return null;
    }
    const items = [
        { name: createdLabel, value: row.created, color: createdColor },
        { name: closedLabel, value: row.closed, color: closedColor },
    ];
    return (
        <div
            dir={isRtl ? "rtl" : "ltr"}
            style={{
                background: "white",
                border: "1px solid #DCE3EB",
                borderRadius: 4,
                padding: 8,
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                fontSize: 12,
                minWidth: 160,
                maxWidth: 220,
            }}
        >
            <div
                style={{
                    fontWeight: 700,
                    color: "#2F3B52",
                    marginBottom: 6,
                    borderBottom: "1px solid #DCE3EB",
                    paddingBottom: 4,
                }}
            >
                {dateLabel}: {label ?? row.label}
            </div>
            {items.map((item) => (
                <div
                    key={item.name}
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: isRtl ? 8 : 16,
                        marginBottom: 4,
                    }}
                >
                    <span style={{ fontWeight: 600, color: "#2F3B52" }}>
                        {item.name}
                    </span>
                    <span
                        style={{
                            color: item.color,
                            fontWeight: 500,
                            direction: "ltr",
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        {item.value.toLocaleString()}
                    </span>
                </div>
            ))}
        </div>
    );
}

function ChartLegend({
    createdLabel,
    closedLabel,
    createdColor,
    closedColor,
    isRtl,
    showLine,
}: {
    createdLabel: string;
    closedLabel: string;
    createdColor: string;
    closedColor: string;
    isRtl: boolean;
    showLine: boolean;
}) {
    const items = [
        {
            label: createdLabel,
            color: createdColor,
            kind: showLine ? ("line" as const) : ("square" as const),
        },
        {
            label: closedLabel,
            color: closedColor,
            kind: showLine ? ("line" as const) : ("square" as const),
        },
    ];
    return (
        <ul
            style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 14,
                fontSize: 12,
                color: "#7C8DA1",
                direction: isRtl ? "rtl" : "ltr",
            }}
        >
            {items.map((item) => (
                <li
                    key={item.label}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                    }}
                >
                    {item.kind === "square" ? (
                        <span
                            style={{
                                width: 10,
                                height: 10,
                                borderRadius: 2,
                                backgroundColor: item.color,
                                flexShrink: 0,
                            }}
                        />
                    ) : (
                        <span
                            style={{
                                width: 14,
                                height: 0,
                                borderTop: `3px solid ${item.color}`,
                                flexShrink: 0,
                            }}
                        />
                    )}
                    {item.label}
                </li>
            ))}
        </ul>
    );
}

const DisputeTrendChart: React.FC<DisputeTrendChartProps> = ({ data }) => {
    const { t, i18n } = useTranslation(["disputes", "dashboard", "common"]);
    const theme = useTheme();
    const isRtl = i18n.language === "he";
    const createdColor = theme.palette.chartPalette.main;
    const closedColor = theme.palette.success.main;
    const createdLabel = t("fields.disputes_created", { ns: "disputes" });
    const closedLabel = t("fields.disputes_closed", { ns: "disputes" });
    const dateLabel = t("fields.chart_details_date", { ns: "dashboard" });

    const hasTrendData =
        data.disputeTrend != null && data.disputeTrend.dates.length > 0;

    const chartData = useMemo((): ChartRow[] => {
        if (hasTrendData && data.disputeTrend) {
            return data.disputeTrend.dates.map((date, index) => {
                const d = new Date(date);
                return {
                    label: `${d.getMonth() + 1}/${d.getDate()}`,
                    created: data.disputeTrend!.created[index] ?? 0,
                    closed: data.disputeTrend!.closed[index] ?? 0,
                };
            });
        }
        return [
            {
                label: t("fields.current_period", { ns: "dashboard" }),
                created: data.aggregate.disputes.created,
                closed: data.aggregate.disputes.closed,
            },
        ];
    }, [data, hasTrendData, t]);

    const hasValues = chartData.some(
        (row) => row.created > 0 || row.closed > 0
    );

    return (
        <FinancialDashboardChartCard
            icon={<DisputesNavIcon />}
            iconAccent="terms"
            title={t("fields.dispute_trend_chart_title", { ns: "disputes" })}
            titleTooltip={t("fields.dispute_trend_chart_description", {
                ns: "disputes",
            })}
            minHeight={400}
        >
            <Box sx={{ flex: 1, minHeight: 300, direction: "ltr" }}>
                {!hasValues ? (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ textAlign: "center", py: 4 }}
                    >
                        {t("messages.no_data", { ns: "common" })}
                    </Typography>
                ) : (
                    <ResponsiveContainer width="100%" height={320}>
                        <ComposedChart
                            data={chartData}
                            margin={{ top: 16, right: 16, left: 8, bottom: 8 }}
                        >
                            <CartesianGrid
                                strokeDasharray="4 4"
                                stroke={theme.palette.divider}
                                vertical={false}
                            />
                            <XAxis
                                dataKey="label"
                                tick={{
                                    fill: theme.palette.text.secondary,
                                    fontSize: 12,
                                }}
                                axisLine={{ stroke: theme.palette.divider }}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{
                                    fill: theme.palette.text.secondary,
                                    fontSize: 12,
                                }}
                                axisLine={false}
                                tickLine={false}
                                width={40}
                                allowDecimals={false}
                            />
                            <Tooltip
                                content={
                                    <DisputeTooltip
                                        createdLabel={createdLabel}
                                        closedLabel={closedLabel}
                                        createdColor={createdColor}
                                        closedColor={
                                            hasTrendData
                                                ? closedColor
                                                : theme.palette.chartPalette
                                                      .light
                                        }
                                        dateLabel={dateLabel}
                                        isRtl={isRtl}
                                    />
                                }
                            />
                            <Legend
                                verticalAlign="bottom"
                                content={() => (
                                    <ChartLegend
                                        createdLabel={createdLabel}
                                        closedLabel={closedLabel}
                                        createdColor={createdColor}
                                        closedColor={
                                            hasTrendData
                                                ? closedColor
                                                : theme.palette.chartPalette
                                                      .light
                                        }
                                        isRtl={isRtl}
                                        showLine={hasTrendData}
                                    />
                                )}
                            />
                            {hasTrendData ? (
                                <>
                                    <Line
                                        type="monotone"
                                        dataKey="created"
                                        name={createdLabel}
                                        stroke={createdColor}
                                        strokeWidth={3}
                                        dot={{
                                            r: 4,
                                            fill: createdColor,
                                            stroke: "#fff",
                                            strokeWidth: 1.5,
                                        }}
                                        activeDot={{ r: 6 }}
                                        isAnimationActive={false}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="closed"
                                        name={closedLabel}
                                        stroke={closedColor}
                                        strokeWidth={3}
                                        dot={{
                                            r: 4,
                                            fill: closedColor,
                                            stroke: "#fff",
                                            strokeWidth: 1.5,
                                        }}
                                        activeDot={{ r: 6 }}
                                        isAnimationActive={false}
                                    />
                                </>
                            ) : (
                                <>
                                    <Bar
                                        dataKey="created"
                                        name={createdLabel}
                                        fill={createdColor}
                                        radius={[4, 4, 0, 0]}
                                        maxBarSize={48}
                                        isAnimationActive={false}
                                    />
                                    <Bar
                                        dataKey="closed"
                                        name={closedLabel}
                                        fill={theme.palette.chartPalette.light}
                                        radius={[4, 4, 0, 0]}
                                        maxBarSize={48}
                                        isAnimationActive={false}
                                    />
                                </>
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                )}
            </Box>
        </FinancialDashboardChartCard>
    );
};

export default DisputeTrendChart;
