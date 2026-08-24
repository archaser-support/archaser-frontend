"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Layers } from "lucide-react";
import {
    CartesianGrid,
    ComposedChart,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import type { PortfolioHealthMonthlyPoint } from "@/types/creditInsurance";
import { padSeriesByUtcMonth } from "@/shared/creditInsurance/portfolioHealthDateRange";

import { ChartTooltip } from "./ChartTooltip";
import { Eyebrow } from "./Eyebrow";
import { IslandCard } from "./IslandCard";
import { CPH } from "./designTokens";
import layout from "./islandLayout.module.css";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export type PortfolioHealthMonthlyChartProps = {
    monthly: PortfolioHealthMonthlyPoint[];
    fromYmd: string;
    toYmd: string;
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
    monthly,
    fromYmd,
    toYmd,
}: PortfolioHealthMonthlyChartProps) {
    const { i18n, t } = useTranslation(["dashboard"]);
    const language = i18n.language;
    const ns = { ns: "dashboard" as const };
    const prefersReducedMotion = usePrefersReducedMotion();
    const animDuration = prefersReducedMotion ? 0 : 1200;

    const data = useMemo(
        () =>
            padSeriesByUtcMonth(
                monthly,
                fromYmd,
                toYmd,
                (p) => p.month
            ).map(({ month, point }) => ({
                label: formatMonthLabel(month, language),
                total: point?.totalReceivables ?? null,
                covered: point?.compliantExposure ?? null,
                uncovered: point?.atRiskExposure ?? null,
            })),
        [monthly, fromYmd, toYmd, language]
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
        total: t("credit_portfolio_health.chart_series_total_ar", {
            ...ns,
            defaultValue: "Total AR",
        }),
    };

    return (
        <IslandCard accent="jade" className={layout.cardPad}>
            <Eyebrow
                icon={Layers}
                help={t("credit_portfolio_health.monthly_chart_help", {
                    ...ns,
                    defaultValue:
                        "Average daily open AR, compliant (covered), and at-risk (uncovered) amounts per calendar month in the selected range.",
                })}
            >
                {t("credit_portfolio_health.monthly_chart_title", {
                    ...ns,
                    defaultValue:
                        "Monthly trend — total exposure, covered vs. uncovered",
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
                <div style={{ width: "100%", height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
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
                            <Line
                                type="monotone"
                                dataKey="covered"
                                name={seriesLabels.covered}
                                stroke={CPH.jade}
                                strokeWidth={2}
                                dot={false}
                                connectNulls={false}
                                animationDuration={animDuration}
                            />
                            <Line
                                type="monotone"
                                dataKey="uncovered"
                                name={seriesLabels.uncovered}
                                stroke={CPH.copper}
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
                                stroke={CPH.ink}
                                strokeWidth={2}
                                dot={false}
                                connectNulls={false}
                                animationDuration={animDuration}
                                animationBegin={prefersReducedMotion ? 0 : 250}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            )}
        </IslandCard>
    );
}
