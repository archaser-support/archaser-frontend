"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
    Award,
    ChevronRight,
    Gauge,
    Layers,
    TrendingUp,
    Users,
} from "lucide-react";
import {
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
} from "recharts";

import type { PortfolioCostsSection } from "@/types/creditInsurance";
import { currencies } from "@/shared/data/common/currencies";
import { formatAmountWithoutSymbol } from "@/utils/stringFormatters";

import { BigNumber } from "./BigNumber";
import { ChartTooltip } from "./ChartTooltip";
import { Eyebrow } from "./Eyebrow";
import { IslandCard } from "./IslandCard";
import { StatNumber } from "./StatNumber";
import { CPH } from "./designTokens";
import { SPACE_GROTESK_FONT_FAMILY } from "./fontTokens";
import layout from "./islandLayout.module.css";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export type CostsSectionViewProps = {
    section: PortfolioCostsSection;
};

const CURRENCY_SUBUNITS: Record<
    string,
    { factor: number; en: string; he: string }
> = {
    ILS: { factor: 100, en: "agorot", he: "אגורות" },
};

function getCurrencySymbol(currencyCode: string): string {
    const currency = currencies.find((c) => c.code === currencyCode);
    return currency?.symbol || currencyCode;
}

function formatMoney(
    amount: number,
    currencyCode: string,
    language: string
): string {
    const locale = language.startsWith("he") ? "he-IL" : "en-US";
    const absolute = formatAmountWithoutSymbol(amount, locale);
    const symbol = getCurrencySymbol(currencyCode);
    if (language.startsWith("he")) {
        return `${absolute} ${symbol}`;
    }
    return `${symbol}${absolute}`;
}

export function CostsSectionView({ section }: CostsSectionViewProps) {
    const { t, i18n } = useTranslation(["dashboard"]);
    const language = i18n.language;
    const isHe = language.startsWith("he");
    const ns = { ns: "dashboard" as const };
    const prefersReducedMotion = usePrefersReducedMotion();
    const animDuration = prefersReducedMotion ? 0 : 1200;
    const currency = section.accountCurrency || "USD";

    const sparklineData = useMemo(
        () =>
            section.daily.map((point) => ({
                date: point.snapshotDate,
                cost: point.totalDailyCost,
            })),
        [section.daily]
    );

    const showSparkline = sparklineData.length >= 1;
    const subunit = CURRENCY_SUBUNITS[currency];
    const useSubunit =
        section.effectiveCost != null &&
        subunit != null &&
        Math.abs(section.effectiveCost) > 0 &&
        Math.abs(section.effectiveCost) < 1;

    return (
        <div className={layout.grid12}>
            <IslandCard
                accent="jade"
                className={`${layout.span6} ${layout.mdSpan3} ${layout.cardPad}`}
            >
                <Eyebrow icon={Award}>
                    {t("credit_portfolio_health.kpi_period_cost", {
                        ...ns,
                        defaultValue: "Policy cost",
                    })}
                </Eyebrow>
                <div
                    className="text-3xl font-semibold tracking-tight"
                    style={{
                        color: CPH.ink,
                        fontFamily: SPACE_GROTESK_FONT_FAMILY,
                    }}
                >
                    {formatMoney(section.periodCost, currency, language)}
                </div>
                <div className="mt-1 text-sm" style={{ color: CPH.slate }}>
                    {t("credit_portfolio_health.kpi_period_cost_label", {
                        ...ns,
                        defaultValue: "Total, incl. top-ups",
                    })}
                </div>
            </IslandCard>

            <IslandCard
                accent="jade"
                className={`${layout.span6} ${layout.mdSpan3} ${layout.cardPad}`}
            >
                <Eyebrow icon={Gauge}>
                    {t("credit_portfolio_health.kpi_effective_cost", {
                        ...ns,
                        defaultValue: "Effective cost",
                    })}
                </Eyebrow>
                {section.effectiveCost == null ? (
                    <span className="text-3xl" style={{ color: CPH.muted }}>
                        —
                    </span>
                ) : useSubunit && subunit ? (
                    <BigNumber
                        value={section.effectiveCost * subunit.factor}
                        decimals={1}
                        suffix={` ${isHe ? subunit.he : subunit.en}`}
                        label={t(
                            "credit_portfolio_health.kpi_effective_cost_per_unit",
                            {
                                ...ns,
                                defaultValue: "Per 1 of compliant coverage",
                            }
                        )}
                        color={CPH.jade}
                        locale={language}
                    />
                ) : (
                    <div>
                        <div
                            className="text-3xl font-semibold tracking-tight"
                            style={{
                                color: CPH.jade,
                                fontFamily: SPACE_GROTESK_FONT_FAMILY,
                            }}
                        >
                            {formatMoney(
                                section.effectiveCost,
                                currency,
                                language
                            )}
                        </div>
                        <div
                            className="mt-1 text-sm"
                            style={{ color: CPH.slate }}
                        >
                            {t(
                                "credit_portfolio_health.kpi_effective_cost_per_unit",
                                {
                                    ...ns,
                                    defaultValue:
                                        "Per 1 of compliant coverage",
                                }
                            )}
                        </div>
                    </div>
                )}
            </IslandCard>

            <IslandCard
                accent="copper"
                className={`${layout.span6} ${layout.mdSpan3} ${layout.cardPad}`}
            >
                <Eyebrow
                    icon={Layers}
                    help={t("credit_portfolio_health.kpi_deductible_help", {
                        ...ns,
                        defaultValue: "Not configured yet",
                    })}
                >
                    {t("credit_portfolio_health.kpi_deductible", {
                        ...ns,
                        defaultValue: "Deductible",
                    })}
                </Eyebrow>
                <div
                    className="text-3xl font-semibold tracking-tight"
                    style={{
                        color: CPH.muted,
                        fontFamily: SPACE_GROTESK_FONT_FAMILY,
                    }}
                    title={t("credit_portfolio_health.kpi_deductible_help", {
                        ...ns,
                        defaultValue: "Not configured yet",
                    })}
                >
                    —
                </div>
                <div className="mt-1 text-sm" style={{ color: CPH.slate }}>
                    {t("credit_portfolio_health.kpi_deductible_help", {
                        ...ns,
                        defaultValue: "Not configured yet",
                    })}
                </div>
            </IslandCard>

            <IslandCard
                accent="jade"
                className={`${layout.span6} ${layout.mdSpan3} ${layout.cardPad}`}
            >
                <Eyebrow icon={TrendingUp}>
                    {t("credit_portfolio_health.kpi_cost_trend", {
                        ...ns,
                        defaultValue: "Cost trend",
                    })}
                </Eyebrow>
                {showSparkline ? (
                    <div style={{ width: "100%", height: 80 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={sparklineData}>
                                <Tooltip
                                    content={
                                        <ChartTooltip
                                            formatValue={(v) =>
                                                formatMoney(
                                                    v,
                                                    currency,
                                                    language
                                                )
                                            }
                                        />
                                    }
                                />
                                <Line
                                    type="monotone"
                                    dataKey="cost"
                                    name={t(
                                        "credit_portfolio_health.chart_daily_cost",
                                        {
                                            ...ns,
                                            defaultValue: "Daily cost",
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
                ) : (
                    <span style={{ color: CPH.muted }}>—</span>
                )}
            </IslandCard>

            <IslandCard
                accent="slate"
                className={`${layout.span12} ${layout.mdSpan6} ${layout.cardPad}`}
            >
                <Eyebrow icon={Users}>
                    {t("credit_portfolio_health.kpi_self_footprint_title", {
                        ...ns,
                        defaultValue: "Self-underwriting footprint",
                    })}
                </Eyebrow>
                <div className={layout.footprintRow}>
                    <div>
                        <div
                            className="text-3xl font-semibold"
                            style={{
                                color: CPH.ink,
                                fontFamily: SPACE_GROTESK_FONT_FAMILY,
                            }}
                        >
                            <StatNumber
                                value={section.selfUnderwrittenCustomerPct}
                                decimals={0}
                                suffix="%"
                                locale={language}
                                className="text-3xl"
                            />
                        </div>
                        <div
                            className="mt-1 text-xs"
                            style={{ color: CPH.slate }}
                        >
                            {t("credit_portfolio_health.footprint_customers", {
                                ...ns,
                                defaultValue: "of customers",
                            })}
                        </div>
                    </div>
                    <ChevronRight size={18} style={{ color: CPH.muted }} />
                    <div>
                        <div
                            className="text-3xl font-semibold"
                            style={{
                                color: CPH.ink,
                                fontFamily: SPACE_GROTESK_FONT_FAMILY,
                            }}
                        >
                            <StatNumber
                                value={section.selfUnderwrittenArSharePct}
                                decimals={0}
                                suffix="%"
                                locale={language}
                                className="text-3xl"
                            />
                        </div>
                        <div
                            className="mt-1 text-xs"
                            style={{ color: CPH.slate }}
                        >
                            {t("credit_portfolio_health.footprint_ar", {
                                ...ns,
                                defaultValue: "of monetary amount",
                            })}
                        </div>
                    </div>
                </div>
            </IslandCard>

            <IslandCard
                accent="jade"
                className={`${layout.span12} ${layout.mdSpan6} ${layout.cardPad}`}
            >
                <Eyebrow icon={Layers} tone={CPH.jade}>
                    {t("credit_portfolio_health.kpi_approved_footprint_title", {
                        ...ns,
                        defaultValue: "Insurer-approved footprint",
                    })}
                </Eyebrow>
                <div className={layout.footprintRow}>
                    <div>
                        <div
                            className="text-3xl font-semibold"
                            style={{
                                color: CPH.jade,
                                fontFamily: SPACE_GROTESK_FONT_FAMILY,
                            }}
                        >
                            <StatNumber
                                value={section.approvedCustomerPct}
                                decimals={0}
                                suffix="%"
                                locale={language}
                                color={CPH.jade}
                                className="text-3xl"
                            />
                        </div>
                        <div
                            className="mt-1 text-xs"
                            style={{ color: CPH.slate }}
                        >
                            {t("credit_portfolio_health.footprint_customers", {
                                ...ns,
                                defaultValue: "of customers",
                            })}
                        </div>
                    </div>
                    <ChevronRight size={18} style={{ color: CPH.muted }} />
                    <div>
                        <div
                            className="text-3xl font-semibold"
                            style={{
                                color: CPH.jade,
                                fontFamily: SPACE_GROTESK_FONT_FAMILY,
                            }}
                        >
                            <StatNumber
                                value={section.approvedArSharePct}
                                decimals={0}
                                suffix="%"
                                locale={language}
                                color={CPH.jade}
                                className="text-3xl"
                            />
                        </div>
                        <div
                            className="mt-1 text-xs"
                            style={{ color: CPH.slate }}
                        >
                            {t("credit_portfolio_health.footprint_ar", {
                                ...ns,
                                defaultValue: "of monetary amount",
                            })}
                        </div>
                    </div>
                </div>
            </IslandCard>
        </div>
    );
}
