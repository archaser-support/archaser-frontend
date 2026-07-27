"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layers } from "lucide-react";
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import type { PortfolioHealthMonthlyPoint } from "@/server/services/creditInsurance/creditPortfolioHealthService";

import { ChartTooltip } from "./ChartTooltip";
import { Eyebrow } from "./Eyebrow";
import { IslandCard } from "./IslandCard";
import { CPH } from "./designTokens";
import layout from "./islandLayout.module.css";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export type PortfolioHealthMonthlyChartProps = {
    monthlyA: PortfolioHealthMonthlyPoint[];
    monthlyB: PortfolioHealthMonthlyPoint[];
};

function formatMonthLabel(month: string, language: string): string {
    const [y, m] = month.split("-").map(Number);
    if (!y || !m) {
        return month;
    }
    const locale = language.startsWith("he") ? "he-IL" : "en-US";
    return new Date(y, m - 1, 1).toLocaleDateString(locale, {
        month: "short",
        year: "2-digit",
    });
}

function formatAmount(value: number, language: string): string {
    const locale = language.startsWith("he") ? "he-IL" : "en-US";
    return value.toLocaleString(locale, { maximumFractionDigits: 0 });
}

export function PortfolioHealthMonthlyChart({
    monthlyA,
    monthlyB,
}: PortfolioHealthMonthlyChartProps) {
    const { i18n, t } = useTranslation(["dashboard"]);
    const language = i18n.language;
    const ns = { ns: "dashboard" as const };
    const [seriesKey, setSeriesKey] = useState<"A" | "B">("A");
    const prefersReducedMotion = usePrefersReducedMotion();
    const animDuration = prefersReducedMotion ? 0 : 1200;

    const points = seriesKey === "A" ? monthlyA : monthlyB;

    const data = useMemo(
        () =>
            points.map((p) => ({
                month: p.month,
                label: formatMonthLabel(p.month, language),
                total: p.totalReceivables,
                covered: p.compliantExposure,
                uncovered: p.atRiskExposure,
            })),
        [points, language]
    );

    const seriesLabels = {
        covered: t("credit_portfolio_health.chart_series_covered", {
            ...ns,
            defaultValue: "Covered",
        }),
        uncovered: t("credit_portfolio_health.chart_series_uncovered", {
            ...ns,
            defaultValue: "Uncovered",
        }),
    };

    return (
        <IslandCard accent="jade" className={layout.cardPad}>
            <div
                className={layout.row}
                style={{ justifyContent: "space-between", marginBottom: 4 }}
            >
                <Eyebrow icon={Layers}>
                    {t("credit_portfolio_health.monthly_chart_title", {
                        ...ns,
                        defaultValue:
                            "Monthly trend — total exposure, covered vs. uncovered",
                    })}
                </Eyebrow>
                <div
                    role="group"
                    aria-label={t(
                        "credit_portfolio_health.series_toggle_aria",
                        {
                            ...ns,
                            defaultValue: "Health series A or B",
                        }
                    )}
                    className={layout.chartToggle}
                >
                    {(["A", "B"] as const).map((key) => {
                        const selected = seriesKey === key;
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setSeriesKey(key)}
                                className={layout.chartToggleBtn}
                                style={{
                                    backgroundColor: selected
                                        ? CPH.jade
                                        : "transparent",
                                    color: selected ? "#fff" : CPH.slate,
                                }}
                            >
                                {key === "A"
                                    ? t(
                                          "credit_portfolio_health.series_a_short",
                                          {
                                              ...ns,
                                              defaultValue: "Health A",
                                          }
                                      )
                                    : t(
                                          "credit_portfolio_health.series_b_short",
                                          {
                                              ...ns,
                                              defaultValue: "Health B",
                                          }
                                      )}
                            </button>
                        );
                    })}
                </div>
            </div>

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
                <div style={{ width: "100%", height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={data}
                            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                        >
                            <defs>
                                <linearGradient
                                    id="cphCovered"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="0%"
                                        stopColor={CPH.jade}
                                        stopOpacity={0.45}
                                    />
                                    <stop
                                        offset="100%"
                                        stopColor={CPH.jade}
                                        stopOpacity={0.02}
                                    />
                                </linearGradient>
                                <linearGradient
                                    id="cphUncovered"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="0%"
                                        stopColor={CPH.copper}
                                        stopOpacity={0.4}
                                    />
                                    <stop
                                        offset="100%"
                                        stopColor={CPH.copper}
                                        stopOpacity={0.02}
                                    />
                                </linearGradient>
                            </defs>
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
                            />
                            <YAxis
                                tick={{ fill: CPH.slate, fontSize: 12 }}
                                axisLine={false}
                                tickLine={false}
                                width={64}
                                tickFormatter={(v: number) =>
                                    formatAmount(v, language)
                                }
                            />
                            <Tooltip
                                content={
                                    <ChartTooltip
                                        formatValue={(v) =>
                                            formatAmount(v, language)
                                        }
                                    />
                                }
                            />
                            <Area
                                type="monotone"
                                dataKey="covered"
                                name={seriesLabels.covered}
                                stackId="1"
                                stroke={CPH.jade}
                                fill="url(#cphCovered)"
                                strokeWidth={2}
                                animationDuration={animDuration}
                            />
                            <Area
                                type="monotone"
                                dataKey="uncovered"
                                name={seriesLabels.uncovered}
                                stackId="1"
                                stroke={CPH.copper}
                                fill="url(#cphUncovered)"
                                strokeWidth={2}
                                animationDuration={animDuration}
                                animationBegin={prefersReducedMotion ? 0 : 150}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </IslandCard>
    );
}
