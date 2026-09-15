"use client";

import { useMemo } from "react";
import {
    Area,
    CartesianGrid,
    ComposedChart,
    Legend,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { ChartTooltip } from "./ChartTooltip";
import {
    formatPortfolioAxisMoney,
    formatPortfolioMoney,
} from "./formatPortfolioMoney";
import { CPH } from "./designTokens";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export type ExposureTrendLinesPoint = {
    label: string;
    total: number | null;
    covered: number | null;
    uncovered: number | null;
};

export type ExposureTrendLinesChartProps = {
    data: ExposureTrendLinesPoint[];
    height: number;
    currency: string;
    language: string;
    seriesLabels: {
        covered: string;
        uncovered: string;
        total: string;
    };
    /** When false, omit the bottom legend (e.g. compact credit-dashboard card). */
    showLegend?: boolean;
    /** Extra gap between x ticks for dense daily series. */
    minTickGap?: number;
};

/**
 * Shared three-line exposure chart (covered / uncovered / total AR)
 * used by portfolio-health monthly trend and credit-dashboard history trend.
 * Uncovered is shown as a tinted band between the covered and total lines.
 */
export function ExposureTrendLinesChart({
    data,
    height,
    currency,
    language,
    seriesLabels,
    showLegend = true,
    minTickGap = 16,
}: ExposureTrendLinesChartProps) {
    const prefersReducedMotion = usePrefersReducedMotion();
    const animDuration = prefersReducedMotion ? 0 : 1200;
    const currencyCode = currency || "USD";

    const chartData = useMemo(
        () =>
            data.map((point) => {
                const canBand =
                    point.covered != null &&
                    point.total != null &&
                    Number.isFinite(point.covered) &&
                    Number.isFinite(point.total);
                return {
                    ...point,
                    /** Light-green fill under covered; stack base for the uncovered tint. */
                    bandBase: canBand ? (point.covered as number) : null,
                    /** Gap to total — fills between covered and total lines. */
                    bandGap: canBand
                        ? Math.max(
                              0,
                              (point.total as number) -
                                  (point.covered as number)
                          )
                        : null,
                };
            }),
        [data]
    );

    return (
        <div style={{ width: "100%", height }}>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                    data={chartData}
                    margin={{
                        top: 10,
                        right: 12,
                        left: 8,
                        bottom: showLegend ? 8 : 0,
                    }}
                >
                    <CartesianGrid
                        strokeDasharray="3 6"
                        stroke={CPH.border}
                        vertical={false}
                    />
                    <XAxis
                        dataKey="label"
                        tick={{ fill: CPH.slate, fontSize: 12 }}
                        axisLine={{ stroke: CPH.border }}
                        tickLine={false}
                        minTickGap={minTickGap}
                    />
                    <YAxis
                        tick={{ fill: CPH.slate, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={84}
                        tickFormatter={(v: number) =>
                            formatPortfolioAxisMoney(v, currencyCode, language)
                        }
                    />
                    <Tooltip
                        wrapperStyle={{
                            direction: language.startsWith("he") ? "rtl" : "ltr",
                        }}
                        content={(props) => {
                            const raw = props.payload?.[0]?.payload as
                                | {
                                      covered?: number | null;
                                      uncovered?: number | null;
                                      total?: number | null;
                                  }
                                | undefined;
                            const items = [
                                {
                                    name: seriesLabels.covered,
                                    value:
                                        raw?.covered != null
                                            ? raw.covered
                                            : undefined,
                                    color: CPH.good,
                                    dataKey: "covered",
                                },
                                {
                                    name: seriesLabels.uncovered,
                                    value:
                                        raw?.uncovered != null
                                            ? raw.uncovered
                                            : undefined,
                                    color: CPH.criticalArea,
                                    dataKey: "uncovered",
                                },
                                {
                                    name: seriesLabels.total,
                                    value:
                                        raw?.total != null
                                            ? raw.total
                                            : undefined,
                                    color: CPH.seriesSlate,
                                    dataKey: "total",
                                },
                            ];
                            return (
                                <ChartTooltip
                                    active={props.active}
                                    label={
                                        typeof props.label === "string" ||
                                        typeof props.label === "number"
                                            ? String(props.label)
                                            : undefined
                                    }
                                    items={items}
                                    language={language}
                                    formatValue={(v) =>
                                        formatPortfolioMoney(
                                            v,
                                            currencyCode,
                                            language
                                        )
                                    }
                                />
                            );
                        }}
                    />
                    {showLegend ? (
                        <Legend
                            verticalAlign="bottom"
                            height={32}
                            wrapperStyle={{
                                fontSize: 12,
                                color: CPH.slate,
                                paddingTop: 8,
                            }}
                        />
                    ) : null}
                    <Area
                        stackId="uncoveredBand"
                        type="monotone"
                        dataKey="bandBase"
                        fill={CPH.goodTint}
                        stroke="none"
                        connectNulls={false}
                        isAnimationActive={false}
                        legendType="none"
                        tooltipType="none"
                    />
                    <Area
                        stackId="uncoveredBand"
                        type="monotone"
                        dataKey="bandGap"
                        name={seriesLabels.uncovered}
                        fill={CPH.criticalArea}
                        fillOpacity={0.55}
                        stroke="none"
                        connectNulls={false}
                        isAnimationActive={!prefersReducedMotion}
                        animationDuration={animDuration}
                        animationBegin={prefersReducedMotion ? 0 : 150}
                    />
                    <Line
                        type="monotone"
                        dataKey="covered"
                        name={seriesLabels.covered}
                        stroke={CPH.good}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                        animationDuration={animDuration}
                    />
                    <Line
                        type="monotone"
                        dataKey="total"
                        name={seriesLabels.total}
                        stroke={CPH.seriesSlate}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                        animationDuration={animDuration}
                        animationBegin={prefersReducedMotion ? 0 : 250}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}
