"use client";

import { Box, Typography } from "@mui/material";
import {
    Cell,
    LabelList,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
} from "recharts";

import { portfolioMoneyHtmlStyle } from "@/app/[locale]/app/credit-portfolio-health/formatPortfolioMoney";

export type DashboardDonutSlice = {
    name: string;
    value: number;
    color: string;
    /** When set, used for on-slice labels; otherwise derived from value/total. */
    percentage?: number;
};

export type DashboardDonutChartProps = {
    data: DashboardDonutSlice[];
    language: string;
    height?: number;
    /** Formats the slice value in the tooltip (defaults to locale number). */
    formatValue?: (value: number, slice: DashboardDonutSlice) => string;
    showLegend?: boolean;
    showCenterTotal?: boolean;
    centerLabel?: string;
    /** Override the center numeric text (defaults to formatted sum of slice values). */
    centerValue?: string;
    /** Show `%` labels on slices (default true). */
    showPercentLabels?: boolean;
    innerRadius?: number;
    outerRadius?: number;
    /** Vertical bias of the pie within the chart (percent). Default 50. */
    cyPercent?: number;
};

type SliceTooltipProps = {
    active?: boolean;
    payload?: Array<{ payload?: DashboardDonutSlice }>;
    total: number;
    isRtl: boolean;
    formatValue: (value: number, slice: DashboardDonutSlice) => string;
};

function SliceTooltip({
    active,
    payload,
    total,
    isRtl,
    formatValue,
}: SliceTooltipProps) {
    const row = payload?.[0]?.payload;
    if (!active || row == null) {
        return null;
    }
    const pct =
        row.percentage != null
            ? row.percentage.toFixed(1)
            : total > 0
              ? ((row.value / total) * 100).toFixed(1)
              : "0.0";
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
                minWidth: 140,
            }}
        >
            <div style={{ fontWeight: 700, color: "#2F3B52", marginBottom: 4 }}>
                {row.name}
            </div>
            <div style={{ color: "#7C8DA1", ...portfolioMoneyHtmlStyle }}>
                {formatValue(row.value, row)} ({pct}%)
            </div>
        </div>
    );
}

function PercentLabel(props: {
    cx?: number;
    cy?: number;
    midAngle?: number;
    innerRadius?: number;
    outerRadius?: number;
    percent?: number;
    payload?: DashboardDonutSlice;
}) {
    const {
        cx = 0,
        cy = 0,
        midAngle = 0,
        innerRadius = 0,
        outerRadius = 0,
        percent = 0,
        payload,
    } = props;
    const displayPct =
        payload?.percentage != null
            ? payload.percentage
            : percent * 100;
    if (!(displayPct >= 4)) {
        return null;
    }
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
        <text
            x={x}
            y={y}
            fill="#FFFFFF"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            fontWeight={700}
            style={{ paintOrder: "stroke", stroke: "rgba(47,59,82,0.35)", strokeWidth: 2 }}
        >
            {`${Math.round(displayPct)}%`}
        </text>
    );
}

export function DashboardDonutChart({
    data,
    language,
    height = 280,
    formatValue,
    showLegend = false,
    showCenterTotal = false,
    centerLabel,
    centerValue,
    showPercentLabels = true,
    innerRadius = 72,
    outerRadius = 110,
    cyPercent = 46,
}: DashboardDonutChartProps) {
    const isRtl = language === "he" || language.startsWith("he-");
    const total = data.reduce((sum, row) => sum + Math.max(0, row.value), 0);
    const formatSliceValue =
        formatValue ??
        ((value: number) =>
            value.toLocaleString(isRtl ? "he-IL" : "en-US"));

    if (total <= 0 || data.length === 0) {
        return null;
    }

    return (
        <Box sx={{ width: "100%", height, position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy={`${cyPercent}%`}
                        innerRadius={innerRadius}
                        outerRadius={outerRadius}
                        paddingAngle={1}
                        isAnimationActive={false}
                    >
                        {data.map((row) => (
                            <Cell key={row.name} fill={row.color} />
                        ))}
                        {showPercentLabels ? (
                            <LabelList
                                content={(labelProps) => (
                                    <PercentLabel {...labelProps} />
                                )}
                            />
                        ) : null}
                    </Pie>
                    <Tooltip
                        content={
                            <SliceTooltip
                                total={total}
                                isRtl={isRtl}
                                formatValue={formatSliceValue}
                            />
                        }
                    />
                    {showLegend ? (
                        <Legend
                            verticalAlign="bottom"
                            formatter={(value, entry) => {
                                const row = (
                                    entry as { payload?: DashboardDonutSlice }
                                ).payload;
                                const amount = row?.value ?? 0;
                                const pct =
                                    row?.percentage != null
                                        ? row.percentage.toFixed(1)
                                        : total > 0
                                          ? ((amount / total) * 100).toFixed(1)
                                          : "0.0";
                                return `${value} (${pct}%)`;
                            }}
                        />
                    ) : null}
                </PieChart>
            </ResponsiveContainer>
            {showCenterTotal ? (
                <Box
                    sx={{
                        position: "absolute",
                        top: `${cyPercent - 8}%`,
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        textAlign: "center",
                        pointerEvents: "none",
                    }}
                >
                    {centerLabel ? (
                        <Typography
                            variant="caption"
                            sx={{
                                display: "block",
                                color: "text.secondary",
                                fontWeight: 600,
                            }}
                        >
                            {centerLabel}
                        </Typography>
                    ) : null}
                    <Typography
                        variant="body1"
                        sx={{ fontWeight: 700, color: "text.primary" }}
                    >
                        {centerValue ??
                            formatSliceValue(total, {
                                name: centerLabel ?? "Total",
                                value: total,
                                color: "",
                            })}
                    </Typography>
                </Box>
            ) : null}
        </Box>
    );
}
