"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Activity } from "lucide-react";
import {
    CartesianGrid,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import type { PortfolioHealthDailyPoint } from "@/types/creditInsurance";

import { ChartTooltip } from "./ChartTooltip";
import { Eyebrow } from "./Eyebrow";
import { IslandCard } from "./IslandCard";
import { CPH } from "./designTokens";
import layout from "./islandLayout.module.css";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export type PortfolioHealthDailyChartProps = {
    daily: PortfolioHealthDailyPoint[];
    averageHealthPct: number;
};

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

function formatPct(value: number, language: string): string {
    const locale = language.startsWith("he") ? "he-IL" : "en-US";
    return `${value.toLocaleString(locale, {
        maximumFractionDigits: 1,
        minimumFractionDigits: 0,
    })}%`;
}

export function PortfolioHealthDailyChart({
    daily,
    averageHealthPct,
}: PortfolioHealthDailyChartProps) {
    const { i18n, t } = useTranslation(["dashboard"]);
    const language = i18n.language;
    const ns = { ns: "dashboard" as const };
    const prefersReducedMotion = usePrefersReducedMotion();
    const animDuration = prefersReducedMotion ? 0 : 1200;

    const data = useMemo(
        () =>
            daily.map((point) => ({
                date: point.snapshotDate,
                label: formatDayLabel(point.snapshotDate, language),
                health: point.healthIndex,
            })),
        [daily, language]
    );

    const avgLabel = t("credit_portfolio_health.chart_avg_health_ref", {
        ...ns,
        defaultValue: "Period avg. health",
    });

    return (
        <IslandCard accent="jade" className={layout.cardPad}>
            <Eyebrow
                icon={Activity}
                help={t("credit_portfolio_health.daily_health_chart_help", {
                    ...ns,
                    defaultValue:
                        "Daily portfolio health (compliant AR ÷ total open AR × 100). The reference line is the period average over available days.",
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
                        <LineChart
                            data={data}
                            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
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
                                interval="preserveStartEnd"
                                minTickGap={28}
                            />
                            <YAxis
                                tick={{ fill: CPH.slate, fontSize: 12 }}
                                axisLine={false}
                                tickLine={false}
                                width={48}
                                domain={[0, 100]}
                                tickFormatter={(v: number) =>
                                    formatPct(v, language)
                                }
                            />
                            <Tooltip
                                content={
                                    <ChartTooltip
                                        formatValue={(v) =>
                                            formatPct(v, language)
                                        }
                                    />
                                }
                            />
                            <ReferenceLine
                                y={averageHealthPct}
                                stroke={CPH.copper}
                                strokeDasharray="6 4"
                                strokeWidth={1.5}
                                label={{
                                    value: avgLabel,
                                    fill: CPH.copper,
                                    fontSize: 11,
                                    position: "insideTopRight",
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="health"
                                name={t(
                                    "credit_portfolio_health.chart_daily_health",
                                    {
                                        ...ns,
                                        defaultValue: "Avg. health",
                                    }
                                )}
                                stroke={CPH.jade}
                                strokeWidth={2.5}
                                dot={false}
                                animationDuration={animDuration}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}
        </IslandCard>
    );
}
