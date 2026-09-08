"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
    Award,
    ChevronRight,
    Gauge,
    Layers,
    Users,
} from "lucide-react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import type { PortfolioCostsSection } from "@/types/creditInsurance";
import { padSeriesByUtcMonth } from "@/shared/creditInsurance/portfolioHealthDateRange";

import { ChartTooltip } from "./ChartTooltip";
import { Eyebrow } from "./Eyebrow";
import {
    formatPortfolioAxisMoney,
    formatPortfolioMoney,
} from "./formatPortfolioMoney";
import { IslandCard } from "./IslandCard";
import { StatNumber } from "./StatNumber";
import { CPH } from "./designTokens";
import { SPACE_GROTESK_FONT_FAMILY } from "./fontTokens";
import layout from "./islandLayout.module.css";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export type CostsSectionViewProps = {
    section: PortfolioCostsSection;
    fromYmd: string;
    toYmd: string;
};

type MonthlyCostChartRow = {
    label: string;
    cost: number | null;
    insuranceCost: number | null;
    registrationFeeCost: number | null;
    topUpCost: number | null;
    totalCost: number | null;
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

export function CostsSectionView({
    section,
    fromYmd,
    toYmd,
}: CostsSectionViewProps) {
    const { t, i18n } = useTranslation(["dashboard"]);
    const language = i18n.language;
    const ns = { ns: "dashboard" as const };
    const prefersReducedMotion = usePrefersReducedMotion();
    const animDuration = prefersReducedMotion ? 0 : 1200;
    const currency = section.accountCurrency || "USD";

    const monthlyChartData = useMemo(
        () =>
            padSeriesByUtcMonth(
                section.monthly ?? [],
                fromYmd,
                toYmd,
                (point) => point.month
            ).map(({ month, point }): MonthlyCostChartRow => ({
                label: formatMonthLabel(month, language),
                cost: point?.totalCost ?? null,
                insuranceCost: point?.insuranceCost ?? null,
                registrationFeeCost: point?.registrationFeeCost ?? null,
                topUpCost: point?.topUpCost ?? null,
                totalCost: point?.totalCost ?? null,
            })),
        [section.monthly, fromYmd, toYmd, language]
    );

    const showMonthlyBars = monthlyChartData.length >= 1;

    return (
        <div className={layout.grid12}>
            <IslandCard
                accent="teal"
                className={`${layout.span6} ${layout.mdSpan4} ${layout.cardPad}`}
            >
                <Eyebrow
                    icon={Award}
                    help={t("credit_portfolio_health.kpi_period_cost_help", {
                        ...ns,
                        defaultValue:
                            "Issued sales × cost % (Actual Sales) + annualized limit cost (Limit), plus registration as a percent of that insurance premium, plus amortized top-ups over the selected range.",
                    })}
                >
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
                    {formatPortfolioMoney(section.periodCost, currency, language)}
                </div>
                <div className="mt-1 text-sm" style={{ color: CPH.slate }}>
                    {t("credit_portfolio_health.kpi_period_cost_label", {
                        ...ns,
                        defaultValue: "Total, incl. top-ups",
                    })}
                </div>
            </IslandCard>

            <IslandCard
                accent="teal"
                className={`${layout.span6} ${layout.mdSpan4} ${layout.cardPad}`}
            >
                <Eyebrow
                    icon={Gauge}
                    help={t("credit_portfolio_health.kpi_effective_cost_help", {
                        ...ns,
                        defaultValue:
                            "Period cost ÷ average daily compliant exposure. Shown in account currency; subunit wording (e.g. agorot) only when applicable.",
                    })}
                >
                    {t("credit_portfolio_health.kpi_effective_cost", {
                        ...ns,
                        defaultValue: "Effective cost",
                    })}
                </Eyebrow>
                {section.effectiveCost == null ? (
                    <span className="text-3xl" style={{ color: CPH.muted }}>
                        —
                    </span>
                ) : (
                    <div>
                        <div
                            className="text-3xl font-semibold tracking-tight"
                            style={{
                                color: CPH.teal,
                                fontFamily: SPACE_GROTESK_FONT_FAMILY,
                            }}
                        >
                            {formatPortfolioMoney(
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
                                    defaultValue: "Per 1 of compliant coverage",
                                }
                            )}
                        </div>
                    </div>
                )}
            </IslandCard>

            <IslandCard
                accent="violet"
                className={`${layout.span6} ${layout.mdSpan4} ${layout.cardPad}`}
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

            {showMonthlyBars ? (
                <IslandCard
                    accent="teal"
                    className={`${layout.span12} ${layout.cardPad}`}
                >
                    <Eyebrow
                        icon={Award}
                        help={t(
                            "credit_portfolio_health.monthly_cost_chart_help",
                            {
                                ...ns,
                                defaultValue:
                                    "Same as period Policy cost, scoped to each calendar month (issued sales, annualized limit days, registration as a percent of the insurance premium, and amortized top-ups).",
                            }
                        )}
                    >
                        {t("credit_portfolio_health.monthly_cost_chart_title", {
                            ...ns,
                            defaultValue: "Monthly policy cost",
                        })}
                    </Eyebrow>
                    <div style={{ width: "100%", height: 220 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={monthlyChartData}
                                margin={{ top: 10, left: 8, right: 10 }}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 6"
                                    stroke={CPH.border}
                                    vertical={false}
                                />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fill: CPH.slate, fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fill: CPH.slate, fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={84}
                                    tickFormatter={(v: number) =>
                                        formatPortfolioAxisMoney(
                                            v,
                                            currency,
                                            language
                                        )
                                    }
                                />
                                <Tooltip
                                    cursor={{ fill: CPH.surfaceMuted }}
                                    content={(props) => {
                                        const row = (
                                            props.payload as
                                                | Array<{
                                                      payload?: MonthlyCostChartRow;
                                                  }>
                                                | undefined
                                        )?.[0]?.payload;
                                        if (
                                            row == null ||
                                            row.totalCost == null
                                        ) {
                                            return null;
                                        }
                                        return (
                                            <ChartTooltip
                                                active={props.active}
                                                label={
                                                    typeof props.label ===
                                                        "string" ||
                                                    typeof props.label ===
                                                        "number"
                                                        ? String(props.label)
                                                        : undefined
                                                }
                                                items={[
                                                    {
                                                        name: t(
                                                            "credit_portfolio_health.chart_monthly_cost_insurance",
                                                            {
                                                                ...ns,
                                                                defaultValue:
                                                                    "Insurance fee",
                                                            }
                                                        ),
                                                        value:
                                                            row.insuranceCost ??
                                                            0,
                                                        color: CPH.teal,
                                                        dataKey:
                                                            "insuranceCost",
                                                    },
                                                    {
                                                        name: t(
                                                            "credit_portfolio_health.chart_monthly_cost_registration",
                                                            {
                                                                ...ns,
                                                                defaultValue:
                                                                    "Registration fee",
                                                            }
                                                        ),
                                                        value:
                                                            row.registrationFeeCost ??
                                                            0,
                                                        color: CPH.teal,
                                                        dataKey:
                                                            "registrationFeeCost",
                                                    },
                                                    {
                                                        name: t(
                                                            "credit_portfolio_health.chart_monthly_cost_top_ups",
                                                            {
                                                                ...ns,
                                                                defaultValue:
                                                                    "Top-ups",
                                                            }
                                                        ),
                                                        value:
                                                            row.topUpCost ?? 0,
                                                        color: CPH.teal,
                                                        dataKey: "topUpCost",
                                                    },
                                                    {
                                                        name: t(
                                                            "credit_portfolio_health.chart_monthly_cost_total",
                                                            {
                                                                ...ns,
                                                                defaultValue:
                                                                    "Total",
                                                            }
                                                        ),
                                                        value: row.totalCost,
                                                        color: CPH.teal,
                                                        dataKey: "totalCost",
                                                    },
                                                ]}
                                                formatValue={(v) =>
                                                    formatPortfolioMoney(
                                                        v,
                                                        currency,
                                                        language
                                                    )
                                                }
                                            />
                                        );
                                    }}
                                />
                                <Bar
                                    dataKey="cost"
                                    name={t(
                                        "credit_portfolio_health.chart_monthly_cost",
                                        {
                                            ...ns,
                                            defaultValue: "Policy cost",
                                        }
                                    )}
                                    fill={CPH.teal}
                                    radius={[8, 8, 0, 0]}
                                    animationDuration={animDuration}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </IslandCard>
            ) : null}

            <IslandCard
                accent="good"
                className={`${layout.span12} ${layout.mdSpan6} ${layout.cardPad}`}
            >
                <Eyebrow
                    icon={Layers}
                    tone={CPH.good}
                    help={t(
                        "credit_portfolio_health.kpi_approved_footprint_help",
                        {
                            ...ns,
                            defaultValue:
                                "Mean daily share of customers and open AR with a linked policy and no exclusion reason. Avg. daily total AR is the mean daily open AR for that cohort.",
                        }
                    )}
                >
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
                                color: CPH.good,
                                fontFamily: SPACE_GROTESK_FONT_FAMILY,
                            }}
                        >
                            <StatNumber
                                value={section.approvedCustomerPct}
                                decimals={0}
                                suffix="%"
                                locale={language}
                                color={CPH.good}
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
                                color: CPH.good,
                                fontFamily: SPACE_GROTESK_FONT_FAMILY,
                            }}
                        >
                            <StatNumber
                                value={section.approvedArSharePct}
                                decimals={0}
                                suffix="%"
                                locale={language}
                                color={CPH.good}
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
                <div className={layout.dividerTop}>
                    <div
                        className="text-2xl font-semibold tracking-tight"
                        style={{
                            color: CPH.good,
                            fontFamily: SPACE_GROTESK_FONT_FAMILY,
                        }}
                    >
                        {formatPortfolioMoney(
                            section.approvedAverageAr,
                            currency,
                            language
                        )}
                    </div>
                    <div className="mt-1 text-xs" style={{ color: CPH.slate }}>
                        {t("credit_portfolio_health.footprint_total_ar", {
                            ...ns,
                            defaultValue: "Avg. daily total AR",
                        })}
                    </div>
                </div>
                <p className="m-0 mt-3 text-xs" style={{ color: CPH.slate }}>
                    {t("credit_portfolio_health.footprint_covered_only_remark", {
                        ...ns,
                        defaultValue:
                            "Calculation includes only covered customers (Named + DCL).",
                    })}
                </p>
            </IslandCard>

            <IslandCard
                accent="slate"
                className={`${layout.span12} ${layout.mdSpan6} ${layout.cardPad}`}
            >
                <Eyebrow
                    icon={Users}
                    help={t("credit_portfolio_health.kpi_self_footprint_help", {
                        ...ns,
                        defaultValue:
                            "Mean daily share of customers and open AR with no linked policy or any exclusion reason. Avg. daily total AR is the mean daily open AR for that cohort.",
                    })}
                >
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
                <div className={layout.dividerTop}>
                    <div
                        className="text-2xl font-semibold tracking-tight"
                        style={{
                            color: CPH.ink,
                            fontFamily: SPACE_GROTESK_FONT_FAMILY,
                        }}
                    >
                        {formatPortfolioMoney(
                            section.selfUnderwrittenAverageAr,
                            currency,
                            language
                        )}
                    </div>
                    <div className="mt-1 text-xs" style={{ color: CPH.slate }}>
                        {t("credit_portfolio_health.footprint_total_ar", {
                            ...ns,
                            defaultValue: "Avg. daily total AR",
                        })}
                    </div>
                </div>
                <p className="m-0 mt-3 text-xs" style={{ color: CPH.slate }}>
                    {t("credit_portfolio_health.footprint_covered_only_remark", {
                        ...ns,
                        defaultValue:
                            "Calculation includes only covered customers (Named + DCL).",
                    })}
                </p>
            </IslandCard>
        </div>
    );
}
