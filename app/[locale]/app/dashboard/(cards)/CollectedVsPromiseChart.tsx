"use client";

import { Box, useTheme } from "@mui/material";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
    Bar,
    CartesianGrid,
    ComposedChart,
    LabelList,
    Legend,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import {
    formatPortfolioAxisMoney,
    formatPortfolioMoney,
} from "@/app/[locale]/app/credit-portfolio-health/formatPortfolioMoney";
import { PromiseToPayNavIcon } from "@/shared/components/sidebar-icons";

import { FinancialDashboardChartCard } from "./FinancialDashboardChartCard";

type CollectedVsPromiseChartProps = {
    options: {
        xaxis?: { categories?: string[] };
    };
    series: Array<{ name?: string; data?: number[] }>;
    currency?: string;
};

type ChartRow = {
    label: string;
    collected: number;
    promiseToPay: number;
};

function ChartLegend({
    collectedLabel,
    promiseLabel,
    collectedColor,
    promiseColor,
    isRtl,
}: {
    collectedLabel: string;
    promiseLabel: string;
    collectedColor: string;
    promiseColor: string;
    isRtl: boolean;
}) {
    const items = [
        { label: collectedLabel, color: collectedColor, kind: "square" as const },
        { label: promiseLabel, color: promiseColor, kind: "line" as const },
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

type AmountTooltipProps = {
    active?: boolean;
    label?: string | number;
    payload?: ReadonlyArray<{ payload?: ChartRow }>;
    currency: string;
    language: string;
    collectedLabel: string;
    promiseLabel: string;
    collectedColor: string;
    promiseColor: string;
    monthAxisLabel: string;
};

function AmountTooltip({
    active,
    label,
    payload,
    currency,
    language,
    collectedLabel,
    promiseLabel,
    collectedColor,
    promiseColor,
    monthAxisLabel,
}: AmountTooltipProps) {
    const row = payload?.[0]?.payload;
    if (!active || row == null) {
        return null;
    }
    const isRtl = language === "he" || language.startsWith("he-");
    const items = [
        {
            name: collectedLabel,
            value: formatPortfolioMoney(row.collected, currency, language),
            color: collectedColor,
        },
        {
            name: promiseLabel,
            value: formatPortfolioMoney(row.promiseToPay, currency, language),
            color: promiseColor,
        },
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
                {monthAxisLabel}: {label ?? row.label}
            </div>
            {items.map((item) => (
                <div
                    key={item.name}
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 4,
                        gap: isRtl ? 8 : 16,
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
                        {item.value}
                    </span>
                </div>
            ))}
        </div>
    );
}

function MoneyTopLabel(props: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    value?: number | string;
    currency: string;
    language: string;
}) {
    const amount = Number(props.value);
    if (!Number.isFinite(amount) || amount <= 0) {
        return null;
    }
    const x = Number(props.x ?? 0);
    const y = Number(props.y ?? 0);
    const width = Number(props.width ?? 0);
    return (
        <text
            x={x + width / 2}
            y={y - 6}
            fill="#2F3B52"
            fontSize={11}
            fontWeight={600}
            textAnchor="middle"
            style={{ fontVariantNumeric: "tabular-nums" }}
        >
            {formatPortfolioMoney(amount, props.currency, props.language)}
        </text>
    );
}

const CollectedVsPromiseChart = ({
    options = {},
    series = [],
    currency = "USD",
}: CollectedVsPromiseChartProps) => {
    const theme = useTheme();
    const { t, i18n } = useTranslation(["dashboard", "common"]);
    const isRtl = i18n.language === "he";
    const collectedColor = theme.palette.chartPalette.main;
    const promiseColor = theme.palette.chartPalette.light;

    const collectedLabel =
        t("fields.charts_collection_stats_total_collected_m_t_d") ||
        "Total Collected (MTD)";
    const promiseLabel =
        t("fields.charts_collection_stats_promise_to_pay") || "Promise to Pay";
    const monthAxisLabel = t("fields.charts_collected_vs_promise_x-axis");
    const amountAxisLabel = t("fields.charts_collected_vs_promise_y-axis");

    const chartData = useMemo((): ChartRow[] => {
        const categories = options.xaxis?.categories ?? [];
        const collected = series[0]?.data ?? [];
        const promiseToPay = series[1]?.data ?? [];
        const len = Math.max(
            categories.length,
            collected.length,
            promiseToPay.length
        );
        const rows: ChartRow[] = [];
        for (let i = 0; i < len; i++) {
            rows.push({
                label: categories[i] ?? String(i + 1),
                collected: Number(collected[i] ?? 0),
                promiseToPay: Number(promiseToPay[i] ?? 0),
            });
        }
        return rows;
    }, [options.xaxis?.categories, series]);

    return (
        <FinancialDashboardChartCard
            icon={<PromiseToPayNavIcon />}
            iconAccent="compliant"
            title={t("fields.charts_collected_vs_promise_title")}
            titleTooltip={t("fields.charts_collected_vs_promise_description")}
            minHeight={400}
        >
            <Box
                sx={{
                    pt: 0.5,
                    height: "100%",
                    minHeight: 280,
                    overflow: "visible",
                }}
            >
                <div
                    style={{
                        width: "100%",
                        height: "100%",
                        minHeight: 280,
                        direction: "ltr",
                        overflow: "visible",
                    }}
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                            data={chartData}
                            // Left margin holds the rotated axis title; YAxis
                            // width holds compact axis ticks so SVG overflow
                            // does not clip either.
                            margin={{ top: 28, right: 16, left: 36, bottom: 8 }}
                        >
                            <CartesianGrid
                                strokeDasharray="5 5"
                                stroke="#DCE3EB"
                            />
                            <XAxis
                                dataKey="label"
                                tick={{ fill: "#7C8DA1", fontSize: 12 }}
                                axisLine={{ stroke: "#DCE3EB" }}
                                tickLine={{ stroke: "#DCE3EB" }}
                                label={{
                                    value: monthAxisLabel,
                                    position: "insideBottom",
                                    offset: -2,
                                    fill: "#7C8DA1",
                                    fontSize: 12,
                                    fontWeight: 500,
                                }}
                                height={48}
                            />
                            <YAxis
                                tick={{ fill: "#7C8DA1", fontSize: 12 }}
                                axisLine={false}
                                tickLine={false}
                                width={72}
                                tickFormatter={(v: number) =>
                                    formatPortfolioAxisMoney(
                                        v,
                                        currency,
                                        i18n.language
                                    )
                                }
                                label={{
                                    value: amountAxisLabel,
                                    angle: -90,
                                    position: "left",
                                    offset: 12,
                                    fill: "#7C8DA1",
                                    fontSize: 12,
                                    fontWeight: 500,
                                }}
                            />
                            <Tooltip
                                content={
                                    <AmountTooltip
                                        currency={currency}
                                        language={i18n.language}
                                        collectedLabel={collectedLabel}
                                        promiseLabel={promiseLabel}
                                        collectedColor={collectedColor}
                                        promiseColor={promiseColor}
                                        monthAxisLabel={monthAxisLabel}
                                    />
                                }
                            />
                            <Legend
                                verticalAlign="bottom"
                                content={() => (
                                    <ChartLegend
                                        collectedLabel={collectedLabel}
                                        promiseLabel={promiseLabel}
                                        collectedColor={collectedColor}
                                        promiseColor={promiseColor}
                                        isRtl={isRtl}
                                    />
                                )}
                            />
                            <Bar
                                dataKey="collected"
                                name={collectedLabel}
                                fill={collectedColor}
                                fillOpacity={0.8}
                                radius={[4, 4, 0, 0]}
                                maxBarSize={28}
                                isAnimationActive={false}
                            >
                                <LabelList
                                    dataKey="collected"
                                    content={(labelProps) => (
                                        <MoneyTopLabel
                                            {...labelProps}
                                            currency={currency}
                                            language={i18n.language}
                                        />
                                    )}
                                />
                            </Bar>
                            <Line
                                type="monotone"
                                dataKey="promiseToPay"
                                name={promiseLabel}
                                stroke={promiseColor}
                                strokeWidth={3}
                                dot={{
                                    r: 4,
                                    fill: promiseColor,
                                    stroke: "#FFFFFF",
                                    strokeWidth: 1.5,
                                }}
                                activeDot={{
                                    r: 6,
                                    fill: promiseColor,
                                    stroke: "#FFFFFF",
                                    strokeWidth: 2,
                                }}
                                isAnimationActive={false}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </Box>
        </FinancialDashboardChartCard>
    );
};

export default CollectedVsPromiseChart;
