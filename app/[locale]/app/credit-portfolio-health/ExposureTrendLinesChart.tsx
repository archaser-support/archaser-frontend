"use client";

import {
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

    return (
        <div style={{ width: "100%", height }}>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                    data={data}
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
                        content={(props) => (
                            <ChartTooltip
                                active={props.active}
                                label={
                                    typeof props.label === "string" ||
                                    typeof props.label === "number"
                                        ? String(props.label)
                                        : undefined
                                }
                                payload={
                                    props.payload as unknown as
                                        | ReadonlyArray<{
                                              name?: string;
                                              value?: number | string;
                                              color?: string;
                                              dataKey?: string | number;
                                          }>
                                        | undefined
                                }
                                formatValue={(v) =>
                                    formatPortfolioMoney(
                                        v,
                                        currencyCode,
                                        language
                                    )
                                }
                            />
                        )}
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
                        dataKey="uncovered"
                        name={seriesLabels.uncovered}
                        stroke={CPH.critical}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                        animationDuration={animDuration}
                        animationBegin={prefersReducedMotion ? 0 : 150}
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
