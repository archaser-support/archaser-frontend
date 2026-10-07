"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Activity } from "lucide-react";
import {
    CartesianGrid,
    ComposedChart,
    Line,
    ReferenceArea,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import type { PortfolioHealthDailyPoint } from "@/types/creditInsurance";
import { padSeriesByUtcYmd } from "@/shared/creditInsurance/portfolioHealthDateRange";

import { ChartTooltip } from "./ChartTooltip";
import { Eyebrow } from "./Eyebrow";
import { IslandCard } from "./IslandCard";
import { CPH } from "./designTokens";
import { chartColors } from "./chartColors";
import { formatPct } from "./chartFormat";
import layout from "./islandLayout.module.css";

export type PortfolioHealthDailyChartProps = {
    daily: PortfolioHealthDailyPoint[];
    averageHealthPct: number;
    /** Health cut-off drawn as a critical reference line (slider-driven). */
    belowThresholdPct: number;
    fromYmd: string;
    toYmd: string;
};

const HEALTH_KEY = "health" as const;
const CARRIED_FORWARD_KEY = "stale" as const;

function formatDayLabel(ymd: string, language: string): string {
    const date = new Date(`${ymd}T12:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
        return ymd;
    }
    const locale = language.startsWith("he") ? "he-IL" : "en-US";
    return date.toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
    });
}

function formatPctPrecise(value: number, language: string): string {
    const locale = language.startsWith("he") ? "he-IL" : "en-US";
    return `${value.toLocaleString(locale, {
        maximumFractionDigits: 1,
        minimumFractionDigits: 0,
    })}%`;
}

type HealthDotProps = {
    cx?: number;
    cy?: number;
    payload?: {
        health?: number | null;
        stale?: boolean;
    };
};

function makeHealthDot(threshold: number) {
    return function HealthDot({ cx, cy, payload }: HealthDotProps) {
        if (cx == null || cy == null || payload?.health == null) {
            return null;
        }
        if (payload.health < threshold) {
            return (
                <circle
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={chartColors.danger}
                    stroke={chartColors.markerRing}
                    strokeWidth={1.5}
                />
            );
        }
        if (payload[CARRIED_FORWARD_KEY]) {
            return (
                <circle
                    cx={cx}
                    cy={cy}
                    r={3.5}
                    fill={chartColors.markerRing}
                    stroke={chartColors.muted}
                    strokeWidth={1.5}
                />
            );
        }
        return null;
    };
}

export function PortfolioHealthDailyChart({
    daily,
    averageHealthPct,
    belowThresholdPct,
    fromYmd,
    toYmd,
}: PortfolioHealthDailyChartProps) {
    const { i18n, t } = useTranslation(["dashboard"]);
    const language = i18n.language;
    const ns = { ns: "dashboard" as const };
    const HealthDot = useMemo(
        () => makeHealthDot(belowThresholdPct),
        [belowThresholdPct]
    );

    const data = useMemo(
        () =>
            padSeriesByUtcYmd(
                daily,
                fromYmd,
                toYmd,
                (point) => point.snapshotDate
            ).map(({ ymd, point }) => ({
                label: formatDayLabel(ymd, language),
                [HEALTH_KEY]: point?.healthIndex ?? null,
                [CARRIED_FORWARD_KEY]: Boolean(point?.isStaleCarriedForward),
            })),
        [daily, fromYmd, toYmd, language]
    );

    const showDotFootnote = useMemo(
        () =>
            data.some(
                (d) =>
                    d.health != null &&
                    (d.stale || d.health < belowThresholdPct)
            ),
        [data, belowThresholdPct]
    );

    const yMin = useMemo(() => {
        const values = data
            .map((d) => d.health)
            .filter((v): v is number => v != null && Number.isFinite(v));
        const minVal = Math.min(...values, belowThresholdPct);
        if (!Number.isFinite(minVal)) {
            return 0;
        }
        return Math.max(0, Math.floor((minVal - 5) / 5) * 5);
    }, [data, belowThresholdPct]);

    const thresholdLabel = t("credit_portfolio_health.chart_threshold_ref", {
        ...ns,
        defaultValue: "Threshold {{pct}}%",
        pct: belowThresholdPct,
    });
    const avgLabel = t("credit_portfolio_health.chart_avg_health_ref_value", {
        ...ns,
        defaultValue: "Period avg. {{pct}}%",
        pct: Number.isFinite(averageHealthPct)
            ? averageHealthPct.toFixed(1)
            : "—",
    });

    return (
        <IslandCard accent="primary" className={layout.cardPad}>
            <Eyebrow
                icon={Activity}
                help={t("credit_portfolio_health.daily_health_chart_help", {
                    ...ns,
                    defaultValue:
                        "Daily portfolio health (compliant AR ÷ total open AR × 100). Gray dashed line: period average. Orange-red dashed line: below-threshold cut-off ({{pct}}%). Light orange-red band: zone below the threshold.",
                    pct: belowThresholdPct,
                })}
            >
                {t("credit_portfolio_health.daily_health_chart_title", {
                    ...ns,
                    defaultValue: "Daily avg. health",
                })}
            </Eyebrow>

            {data.length === 0 ? (
                <p
                    style={{
                        margin: 0,
                        fontSize: 14,
                        color: CPH.slate,
                    }}
                >
                    {t("credit_portfolio_health.no_chart_data", {
                        ...ns,
                        defaultValue: "No monthly history in this range.",
                    })}
                </p>
            ) : (
                <div style={{ width: "100%", height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                            data={data}
                            margin={{
                                top: 10,
                                right: 110,
                                left: -10,
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
                                interval="preserveStartEnd"
                                minTickGap={28}
                            />
                            <YAxis
                                tick={{
                                    fill: chartColors.axisText,
                                    fontSize: 12,
                                }}
                                axisLine={false}
                                tickLine={false}
                                width={48}
                                domain={[yMin, 100]}
                                tickFormatter={formatPct}
                            />
                            <Tooltip
                                content={
                                    <ChartTooltip
                                        language={language}
                                        formatValue={(v) =>
                                            formatPctPrecise(v, language)
                                        }
                                    />
                                }
                            />
                            <ReferenceArea
                                y1={yMin}
                                y2={belowThresholdPct}
                                fill={chartColors.danger}
                                fillOpacity={0.08}
                                ifOverflow="extendDomain"
                            />
                            <ReferenceLine
                                y={belowThresholdPct}
                                stroke={chartColors.danger}
                                strokeDasharray="6 4"
                                strokeWidth={1.5}
                                label={{
                                    value: thresholdLabel,
                                    position: "right",
                                    fill: chartColors.danger,
                                    fontSize: 12,
                                }}
                            />
                            <ReferenceLine
                                y={averageHealthPct}
                                stroke={chartColors.reference}
                                strokeDasharray="2 3"
                                strokeWidth={1.5}
                                label={{
                                    value: avgLabel,
                                    position: "right",
                                    fill: chartColors.reference,
                                    fontSize: 12,
                                }}
                            />
                            <Line
                                type="linear"
                                dataKey={HEALTH_KEY}
                                name={t(
                                    "credit_portfolio_health.chart_daily_health",
                                    {
                                        ...ns,
                                        defaultValue: "Avg. health",
                                    }
                                )}
                                stroke={chartColors.primary}
                                strokeWidth={2}
                                dot={<HealthDot />}
                                activeDot={{
                                    r: 5,
                                    fill: chartColors.marker,
                                    stroke: chartColors.markerRing,
                                    strokeWidth: 2,
                                }}
                                connectNulls={false}
                                isAnimationActive={false}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            )}
            {showDotFootnote ? (
                <p
                    style={{
                        margin: "8px 0 0",
                        fontSize: 12,
                        color: CPH.slate,
                    }}
                >
                    {t("credit_portfolio_health.chart_stale_days_note", {
                        ...ns,
                        defaultValue:
                            "Hollow gray dots mark carried-forward snapshot days. Orange-red dots mark days below threshold.",
                    })}
                </p>
            ) : null}
        </IslandCard>
    );
}
