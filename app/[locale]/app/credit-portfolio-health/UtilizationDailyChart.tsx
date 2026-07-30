"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Activity } from "lucide-react";
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import type { PortfolioUtilizationDailyPoint } from "@/server/services/creditInsurance/creditPortfolioHealthService";

import { ChartTooltip } from "./ChartTooltip";
import { Eyebrow } from "./Eyebrow";
import { IslandCard } from "./IslandCard";
import { CPH } from "./designTokens";
import layout from "./islandLayout.module.css";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export type UtilizationDailyChartProps = {
    daily: PortfolioUtilizationDailyPoint[];
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

export function UtilizationDailyChart({ daily }: UtilizationDailyChartProps) {
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
                portfolio: point.utilizationPct,
                dcl: point.dclUtilizationPct,
                named: point.namedUtilizationPct,
            })),
        [daily, language]
    );

    const hasSignal = data.some(
        (row) =>
            row.portfolio != null || row.dcl != null || row.named != null
    );

    return (
        <IslandCard accent="jade" className={`${layout.span12} ${layout.cardPad}`}>
            <Eyebrow
                icon={Activity}
                help={t("credit_portfolio_health.daily_util_chart_help", {
                    ...ns,
                    defaultValue:
                        "Daily effective utilization (usage ÷ effective approved limit × 100) for the portfolio, Named, and DCL cohorts among approved customers.",
                })}
            >
                {t("credit_portfolio_health.daily_util_chart_title", {
                    ...ns,
                    defaultValue: "Daily avg. utilization",
                })}
            </Eyebrow>

            {!hasSignal ? (
                <p className="m-0 text-sm" style={{ color: CPH.slate }}>
                    {t("credit_portfolio_health.no_chart_data", {
                        ...ns,
                        defaultValue: "No monthly history in this range.",
                    })}
                </p>
            ) : (
                <div style={{ width: "100%", height: 280 }}>
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
                                domain={[0, "auto"]}
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
                            <Legend
                                wrapperStyle={{ fontSize: 12, color: CPH.slate }}
                            />
                            <Line
                                type="monotone"
                                dataKey="portfolio"
                                name={t(
                                    "credit_portfolio_health.chart_util_portfolio",
                                    {
                                        ...ns,
                                        defaultValue: "Avg. utilization",
                                    }
                                )}
                                stroke={CPH.jade}
                                strokeWidth={2.5}
                                dot={false}
                                connectNulls
                                animationDuration={animDuration}
                            />
                            <Line
                                type="monotone"
                                dataKey="dcl"
                                name={t(
                                    "credit_portfolio_health.chart_util_sdl",
                                    {
                                        ...ns,
                                        defaultValue: "SDL avg. utilization",
                                    }
                                )}
                                stroke={CPH.copper}
                                strokeWidth={2}
                                dot={false}
                                connectNulls
                                animationDuration={animDuration}
                                animationBegin={prefersReducedMotion ? 0 : 100}
                            />
                            <Line
                                type="monotone"
                                dataKey="named"
                                name={t(
                                    "credit_portfolio_health.chart_util_issuer",
                                    {
                                        ...ns,
                                        defaultValue: "Issuer avg. utilization",
                                    }
                                )}
                                stroke={CPH.ink}
                                strokeWidth={2}
                                dot={false}
                                connectNulls
                                animationDuration={animDuration}
                                animationBegin={prefersReducedMotion ? 0 : 200}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}
        </IslandCard>
    );
}
