"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Layers } from "lucide-react";

import type { PortfolioHealthMonthlyPoint } from "@/types/creditInsurance";
import { padSeriesByUtcMonth } from "@/shared/creditInsurance/portfolioHealthDateRange";

import { Eyebrow } from "./Eyebrow";
import { ExposureTrendLinesChart } from "./ExposureTrendLinesChart";
import { IslandCard } from "./IslandCard";
import { CPH } from "./designTokens";
import layout from "./islandLayout.module.css";

export type PortfolioHealthMonthlyChartProps = {
    monthly: PortfolioHealthMonthlyPoint[];
    fromYmd: string;
    toYmd: string;
    accountCurrency: string;
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

export function PortfolioHealthMonthlyChart({
    monthly,
    fromYmd,
    toYmd,
    accountCurrency,
}: PortfolioHealthMonthlyChartProps) {
    const { i18n, t } = useTranslation(["dashboard"]);
    const language = i18n.language;
    const ns = { ns: "dashboard" as const };
    const currency = accountCurrency || "USD";

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
        <IslandCard accent="teal" className={layout.cardPad}>
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
                <ExposureTrendLinesChart
                    data={data}
                    height={300}
                    currency={currency}
                    language={language}
                    seriesLabels={seriesLabels}
                />
            )}
        </IslandCard>
    );
}
