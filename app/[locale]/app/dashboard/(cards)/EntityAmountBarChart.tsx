"use client";

import { useTheme } from "@mui/material";
import { useMemo } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    LabelList,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import {
    formatPortfolioAxisMoney,
    formatPortfolioMoney,
    portfolioMoneyHtmlStyle,
    portfolioMoneySvgTextProps,
} from "@/app/[locale]/app/credit-portfolio-health/formatPortfolioMoney";
import { TruncatedChartLabel } from "@/shared/components/TruncatedChartLabel";

const ROW_HEIGHT = 36;
const CATEGORY_AXIS_WIDTH = 150;
const CHART_RIGHT = 88;
const CHART_LEFT = 8;

export type EntityAmountBarRow = {
    name: string;
    amount: number;
    color: string;
    percentage?: number;
};

export type EntityAmountBarChartProps = {
    data: EntityAmountBarRow[];
    currency: string;
    language: string;
    /** Horizontal bars (category on Y). Default true. */
    horizontal?: boolean;
};

function EntityNameTick({
    x = 0,
    y = 0,
    payload,
    isRtl,
    axisWidth,
}: {
    x?: number | string;
    y?: number | string;
    payload?: { value?: string };
    isRtl: boolean;
    axisWidth: number;
}) {
    const name = String(payload?.value ?? "");
    const width = axisWidth - 8;
    return (
        <foreignObject
            x={Number(x) - width}
            y={Number(y) - 10}
            width={width}
            height={20}
        >
            <div title={name}>
                <TruncatedChartLabel
                    text={name}
                    fallbackDir={isRtl ? "rtl" : "ltr"}
                    textAlign="right"
                    style={{
                        fontSize: 11.5,
                        lineHeight: "20px",
                        color: "inherit",
                    }}
                />
            </div>
        </foreignObject>
    );
}

function AmountEndLabel(props: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
    value?: number | string;
    horizontal?: boolean;
    currency: string;
    language: string;
    fill: string;
}) {
    const amount = Number(props.value);
    if (!Number.isFinite(amount) || amount <= 0) {
        return null;
    }
    const x = Number(props.x ?? 0);
    const y = Number(props.y ?? 0);
    const width = Number(props.width ?? 0);
    const height = Number(props.height ?? 0);
    const text = formatPortfolioMoney(
        amount,
        props.currency,
        props.language
    );
    const labelX = props.horizontal ? x + width + 6 : x + width / 2;
    const labelY = props.horizontal ? y + height / 2 : y - 6;

    return (
        <text
            x={labelX}
            y={labelY}
            fill={props.fill}
            fontSize={11}
            fontWeight={600}
            textAnchor={props.horizontal ? "start" : "middle"}
            dominantBaseline={props.horizontal ? "middle" : "auto"}
            {...portfolioMoneySvgTextProps}
        >
            {text}
        </text>
    );
}

type AmountTooltipProps = {
    active?: boolean;
    payload?: Array<{ payload?: EntityAmountBarRow }>;
    currency: string;
    language: string;
    isRtl: boolean;
};

function AmountTooltip({
    active,
    payload,
    currency,
    language,
    isRtl,
}: AmountTooltipProps) {
    const theme = useTheme();
    const row = payload?.[0]?.payload;
    if (!active || row == null) {
        return null;
    }
    return (
        <div
            dir={isRtl ? "rtl" : "ltr"}
            style={{
                padding: 8,
                background: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 4,
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                fontSize: 12,
            }}
        >
            <div
                style={{
                    fontWeight: 600,
                    marginBottom: 4,
                    color: theme.palette.text.primary,
                    fontSize: 14,
                }}
            >
                {row.name}
            </div>
            <div
                style={{
                    color: theme.palette.text.secondary,
                    ...portfolioMoneyHtmlStyle,
                }}
            >
                {formatPortfolioMoney(row.amount, currency, language)}
                {row.percentage != null
                    ? ` (${row.percentage.toFixed(1)}%)`
                    : null}
            </div>
        </div>
    );
}

export function EntityAmountBarChart({
    data,
    currency,
    language,
    horizontal = true,
}: EntityAmountBarChartProps) {
    const theme = useTheme();
    const isRtl = language === "he" || language.startsWith("he-");
    const axisColor = theme.palette.text.secondary;
    const gridColor = theme.palette.divider;
    const labelColor = theme.palette.text.primary;

    const chartData = useMemo(
        () =>
            data.map((row, index) => ({
                ...row,
                rowKey: `${row.name}-${index}`,
            })),
        [data]
    );

    const chartHeight = horizontal
        ? Math.max(250, chartData.length * ROW_HEIGHT + 40)
        : Math.max(250, 280);

    if (chartData.length === 0) {
        return null;
    }

    return (
        <div
            style={{
                width: "100%",
                height: chartHeight,
                direction: "ltr",
                overflow: "visible",
                color: axisColor,
            }}
        >
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    layout={horizontal ? "vertical" : "horizontal"}
                    data={chartData}
                    accessibilityLayer={false}
                    margin={{
                        left: horizontal ? CHART_LEFT : 8,
                        right: horizontal ? CHART_RIGHT : 12,
                        top: horizontal ? 4 : 24,
                        bottom: horizontal ? 4 : 48,
                    }}
                    barCategoryGap="18%"
                >
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={gridColor}
                        horizontal={!horizontal}
                        vertical={horizontal}
                    />
                    {horizontal ? (
                        <>
                            <XAxis
                                type="number"
                                tick={{ fill: axisColor, fontSize: 12 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(v: number) =>
                                    formatPortfolioAxisMoney(
                                        v,
                                        currency,
                                        language
                                    )
                                }
                            />
                            <YAxis
                                type="category"
                                dataKey="name"
                                width={CATEGORY_AXIS_WIDTH}
                                interval={0}
                                tickMargin={6}
                                tick={(tickProps) => (
                                    <EntityNameTick
                                        x={tickProps.x}
                                        y={tickProps.y}
                                        payload={tickProps.payload}
                                        isRtl={isRtl}
                                        axisWidth={CATEGORY_AXIS_WIDTH}
                                    />
                                )}
                                axisLine={false}
                                tickLine={false}
                                // Match credit CoverageTopCustomersChart: LTR plot
                                // geometry, reverse category order for Hebrew.
                                reversed={isRtl}
                            />
                        </>
                    ) : (
                        <>
                            <XAxis
                                type="category"
                                dataKey="name"
                                interval={0}
                                angle={-35}
                                textAnchor="end"
                                height={60}
                                tick={{ fill: axisColor, fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(v: string) =>
                                    v.length > 14 ? `${v.slice(0, 13)}…` : v
                                }
                            />
                            <YAxis
                                type="number"
                                tick={{ fill: axisColor, fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(v: number) =>
                                    formatPortfolioAxisMoney(
                                        v,
                                        currency,
                                        language
                                    )
                                }
                                width={64}
                            />
                        </>
                    )}
                    <Tooltip
                        cursor={{ fill: theme.palette.action.hover }}
                        content={
                            <AmountTooltip
                                currency={currency}
                                language={language}
                                isRtl={isRtl}
                            />
                        }
                    />
                    <Bar
                        dataKey="amount"
                        name="Amount"
                        radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                        isAnimationActive={false}
                        maxBarSize={horizontal ? 24 : 48}
                    >
                        {chartData.map((row) => (
                            <Cell key={row.rowKey} fill={row.color} />
                        ))}
                        <LabelList
                            dataKey="amount"
                            content={(labelProps) => (
                                <AmountEndLabel
                                    x={labelProps.x}
                                    y={labelProps.y}
                                    width={labelProps.width}
                                    height={labelProps.height}
                                    value={
                                        typeof labelProps.value === "string" ||
                                        typeof labelProps.value === "number"
                                            ? labelProps.value
                                            : undefined
                                    }
                                    horizontal={horizontal}
                                    currency={currency}
                                    language={language}
                                    fill={labelColor}
                                />
                            )}
                        />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
