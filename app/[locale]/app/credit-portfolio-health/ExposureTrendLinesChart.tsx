"use client";

import { useMemo } from "react";
import {
    Area,
    Bar,
    BarChart,
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

import { CPH } from "./designTokens";
import { chartColors } from "./chartColors";
import {
    formatCurrencyCompact,
    formatCurrencyFull,
    formatMonthYear,
} from "./chartFormat";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export type ExposureTrendLinesPoint = {
    label: string;
    /** Optional raw month key (`YYYY-MM`) for axis formatting. */
    month?: string;
    total: number | null;
    compliant: number | null;
    atRisk: number | null;
};

export type ExposureTrendLinesChartProps = {
    data: ExposureTrendLinesPoint[];
    height: number;
    currency: string;
    language: string;
    seriesLabels: {
        compliant: string;
        atRisk: string;
        total: string;
    };
    /** When false, omit the top legend (e.g. compact credit-dashboard card). */
    showLegend?: boolean;
    /** Extra gap between x ticks for dense daily series. */
    minTickGap?: number;
    /**
     * Compact companion bar chart of at-risk share % per period.
     * Default false so the credit-dashboard caller stays unchanged.
     */
    showAtRiskShare?: boolean;
    /** i18n label for the at-risk share tooltip / companion chart. */
    atRiskShareLabel?: string;
};

type ChartRow = ExposureTrendLinesPoint & {
    atRiskSharePct: number | null;
};

/** At-risk share of total AR (%); null when total is not positive. */
export function exposureAtRiskSharePct(
    total: number | null,
    atRisk: number | null
): number | null {
    return total != null &&
        total > 0 &&
        atRisk != null &&
        Number.isFinite(atRisk)
        ? (atRisk / total) * 100
        : null;
}

function ExposureLegend({
    seriesLabels,
}: {
    seriesLabels: ExposureTrendLinesChartProps["seriesLabels"];
}) {
    const items: Array<{
        label: string;
        color: string;
        kind: "square" | "line";
    }> = [
        {
            label: seriesLabels.compliant,
            color: chartColors.primary,
            kind: "square",
        },
        {
            label: seriesLabels.atRisk,
            color: chartColors.secondary,
            kind: "square",
        },
        {
            label: seriesLabels.total,
            color: chartColors.marker,
            kind: "line",
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
                justifyContent: "flex-end",
                gap: 14,
                fontSize: 12,
                color: chartColors.axisText,
                opacity: 1,
            }}
        >
            {items.map((item) => (
                <li
                    key={item.label}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        opacity: 1,
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
                                borderTop: `2px solid ${item.color}`,
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

type ExposureTooltipProps = {
    active?: boolean;
    label?: string | number;
    payload?: ReadonlyArray<{
        payload?: ChartRow;
    }>;
    currency: string;
    language: string;
    seriesLabels: ExposureTrendLinesChartProps["seriesLabels"];
    atRiskShareLabel: string;
};

function ExposureTooltip({
    active,
    label,
    payload,
    currency,
    language,
    seriesLabels,
    atRiskShareLabel,
}: ExposureTooltipProps) {
    const row = payload?.[0]?.payload;
    if (!active || row == null) {
        return null;
    }
    const isRtl = language === "he" || language.startsWith("he-");
    const header =
        row.month != null
            ? formatMonthYear(row.month)
            : label != null
              ? String(label)
              : "";

    const items: Array<{
        name: string;
        value: string;
        color: string;
        valueColor?: string;
    }> = [
        {
            name: seriesLabels.total,
            value:
                row.total != null
                    ? formatCurrencyFull(row.total, currency)
                    : "—",
            color: chartColors.marker,
        },
        {
            name: seriesLabels.atRisk,
            value:
                row.atRisk != null
                    ? formatCurrencyFull(row.atRisk, currency)
                    : "—",
            color: chartColors.secondary,
        },
        {
            name: seriesLabels.compliant,
            value:
                row.compliant != null
                    ? formatCurrencyFull(row.compliant, currency)
                    : "—",
            color: chartColors.primary,
        },
        {
            name: atRiskShareLabel,
            value:
                row.atRiskSharePct != null
                    ? `${row.atRiskSharePct.toFixed(1)}%`
                    : "—",
            color: chartColors.secondary,
            valueColor: chartColors.secondaryText,
        },
    ];

    return (
        <div
            dir={isRtl ? "rtl" : "ltr"}
            style={{
                borderRadius: 8,
                border: `1px solid ${CPH.border}`,
                padding: "8px 12px",
                fontSize: 12,
                backgroundColor: CPH.card,
                color: CPH.ink,
                boxShadow: CPH.shadow,
            }}
        >
            {header ? (
                <div
                    style={{
                        marginBottom: 4,
                        fontWeight: 500,
                        color: CPH.slate,
                    }}
                >
                    {header}
                </div>
            ) : null}
            <ul
                style={{
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                }}
            >
                {items.map((item) => (
                    <li
                        key={item.name}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <span
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                flexShrink: 0,
                                backgroundColor: item.color,
                            }}
                        />
                        <span style={{ color: CPH.slate, flex: 1 }}>
                            {item.name}
                        </span>
                        <span
                            style={{
                                fontWeight: 500,
                                fontVariantNumeric: "tabular-nums",
                                color: item.valueColor ?? CPH.ink,
                            }}
                        >
                            {item.value}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/**
 * Shared exposure trend chart (compliant / at-risk stacked areas + Total AR line)
 * used by portfolio-health monthly trend and credit-dashboard history trend.
 */
export function ExposureTrendLinesChart({
    data,
    height,
    currency,
    language,
    seriesLabels,
    showLegend = true,
    minTickGap = 16,
    showAtRiskShare = false,
    atRiskShareLabel = "At-risk share",
}: ExposureTrendLinesChartProps) {
    const prefersReducedMotion = usePrefersReducedMotion();
    const animDuration = prefersReducedMotion ? 0 : 1200;
    const currencyCode = currency || "USD";
    const isRtl = language === "he" || language.startsWith("he-");

    const chartData = useMemo<ChartRow[]>(
        () =>
            data.map((point) => ({
                ...point,
                atRiskSharePct: exposureAtRiskSharePct(
                    point.total,
                    point.atRisk
                ),
            })),
        [data]
    );

    const xTickFormatter = (value: string) => {
        const row = chartData.find(
            (p) => p.label === value || p.month === value
        );
        if (row?.month != null) {
            return formatMonthYear(row.month);
        }
        // Already-formatted labels (e.g. credit-dashboard daily) pass through.
        return value;
    };

    const companionHeight = 120;
    const mainHeight = showAtRiskShare
        ? Math.max(160, height - companionHeight - 12)
        : height;
    /** Month-grain series get a dot per point; dense daily series stay line-only. */
    const showTotalDots = chartData.some((row) => row.month != null);

    return (
        <div style={{ width: "100%" }}>
            <div style={{ width: "100%", height: mainHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={chartData}
                        margin={{
                            top: showLegend ? 28 : 10,
                            right: 12,
                            left: 8,
                            bottom: 0,
                        }}
                    >
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={chartColors.grid}
                            vertical={false}
                        />
                        <XAxis
                            dataKey="label"
                            tick={{
                                fill: chartColors.axisText,
                                fontSize: 12,
                            }}
                            axisLine={{ stroke: CPH.border }}
                            tickLine={false}
                            minTickGap={minTickGap}
                            tickFormatter={xTickFormatter}
                        />
                        <YAxis
                            tick={{
                                fill: chartColors.axisText,
                                fontSize: 11,
                            }}
                            axisLine={false}
                            tickLine={false}
                            width={84}
                            tickFormatter={(v: number) =>
                                formatCurrencyCompact(v, currencyCode)
                            }
                        />
                        <Tooltip
                            wrapperStyle={{
                                direction: isRtl ? "rtl" : "ltr",
                            }}
                            content={
                                <ExposureTooltip
                                    currency={currencyCode}
                                    language={language}
                                    seriesLabels={seriesLabels}
                                    atRiskShareLabel={atRiskShareLabel}
                                />
                            }
                        />
                        {showLegend ? (
                            <Legend
                                verticalAlign="top"
                                align="right"
                                content={() => (
                                    <ExposureLegend
                                        seriesLabels={seriesLabels}
                                    />
                                )}
                            />
                        ) : null}
                        <Area
                            stackId="exposure"
                            type="linear"
                            dataKey="compliant"
                            name={seriesLabels.compliant}
                            stroke={chartColors.primary}
                            fill={chartColors.primary}
                            fillOpacity={0.15}
                            connectNulls={false}
                            isAnimationActive={!prefersReducedMotion}
                            animationDuration={animDuration}
                            legendType="square"
                        />
                        <Area
                            stackId="exposure"
                            type="linear"
                            dataKey="atRisk"
                            name={seriesLabels.atRisk}
                            stroke={chartColors.secondary}
                            fill={chartColors.secondary}
                            fillOpacity={0.35}
                            connectNulls={false}
                            isAnimationActive={!prefersReducedMotion}
                            animationDuration={animDuration}
                            animationBegin={prefersReducedMotion ? 0 : 150}
                            legendType="square"
                        />
                        <Line
                            type="linear"
                            dataKey="total"
                            name={seriesLabels.total}
                            stroke={chartColors.marker}
                            strokeWidth={2}
                            dot={
                                showTotalDots
                                    ? {
                                          r: 3,
                                          fill: chartColors.marker,
                                          stroke: chartColors.markerRing,
                                          strokeWidth: 1.5,
                                      }
                                    : false
                            }
                            activeDot={{
                                r: 5,
                                fill: chartColors.marker,
                                stroke: chartColors.markerRing,
                                strokeWidth: 2,
                            }}
                            connectNulls={false}
                            animationDuration={animDuration}
                            animationBegin={prefersReducedMotion ? 0 : 250}
                            legendType="plainline"
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
            {showAtRiskShare ? (
                <div
                    style={{
                        width: "100%",
                        height: companionHeight,
                        marginTop: 12,
                    }}
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chartData}
                            margin={{ top: 18, right: 12, left: 8, bottom: 0 }}
                        >
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke={chartColors.grid}
                                vertical={false}
                            />
                            <XAxis
                                dataKey="label"
                                tick={{
                                    fill: chartColors.axisText,
                                    fontSize: 11,
                                }}
                                axisLine={{ stroke: CPH.border }}
                                tickLine={false}
                                minTickGap={minTickGap}
                                tickFormatter={xTickFormatter}
                            />
                            <YAxis
                                domain={[0, "auto"]}
                                tick={{
                                    fill: chartColors.axisText,
                                    fontSize: 11,
                                }}
                                axisLine={false}
                                tickLine={false}
                                width={48}
                                tickFormatter={(v: number) =>
                                    `${Number(v).toFixed(0)}%`
                                }
                            />
                            <Tooltip
                                formatter={(value) => {
                                    const n =
                                        typeof value === "number"
                                            ? value
                                            : Number(value);
                                    return Number.isFinite(n)
                                        ? `${n.toFixed(1)}%`
                                        : "—";
                                }}
                                labelFormatter={(label) =>
                                    xTickFormatter(String(label))
                                }
                            />
                            <Bar
                                dataKey="atRiskSharePct"
                                name={atRiskShareLabel}
                                fill={chartColors.secondary}
                                radius={[3, 3, 0, 0]}
                                isAnimationActive={!prefersReducedMotion}
                                animationDuration={animDuration}
                            >
                                <LabelList
                                    dataKey="atRiskSharePct"
                                    position="top"
                                    fill={chartColors.valueLabel}
                                    fontSize={10}
                                    formatter={(label) => {
                                        const v =
                                            typeof label === "number"
                                                ? label
                                                : Number(label);
                                        return Number.isFinite(v)
                                            ? `${v.toFixed(1)}%`
                                            : "";
                                    }}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            ) : null}
        </div>
    );
}
