"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
    Activity,
    AlertTriangle,
    Award,
    ChevronRight,
    Gauge,
    Layers,
    RefreshCw,
    TrendingUp,
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

import type { PortfolioUtilizationSection, UtilizationDistributionBinKey } from "@/types/creditInsurance";

import { BigNumber } from "./BigNumber";
import { ChartTooltip } from "./ChartTooltip";
import { Eyebrow } from "./Eyebrow";
import { IslandCard } from "./IslandCard";
import { StatNumber } from "./StatNumber";
import { CPH } from "./designTokens";
import { SPACE_GROTESK_FONT_FAMILY } from "./fontTokens";
import layout from "./islandLayout.module.css";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export type UtilizationSectionViewProps = {
    section: PortfolioUtilizationSection;
};

const BIN_LABEL_KEYS: Record<
    UtilizationDistributionBinKey,
    { key: string; defaultValue: string }
> = {
    "0_10": {
        key: "credit_portfolio_health.bin_0_10",
        defaultValue: "0â€“10%",
    },
    "10_20": {
        key: "credit_portfolio_health.bin_10_20",
        defaultValue: "10â€“20%",
    },
    "20_50": {
        key: "credit_portfolio_health.bin_20_50",
        defaultValue: "20â€“50%",
    },
    "50_75": {
        key: "credit_portfolio_health.bin_50_75",
        defaultValue: "50â€“75%",
    },
    "75_plus": {
        key: "credit_portfolio_health.bin_75_plus",
        defaultValue: "â‰¥75%",
    },
};

function formatPct(value: number, language: string, decimals = 1): string {
    const locale = language.startsWith("he") ? "he-IL" : "en-US";
    return `${value.toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    })}%`;
}

export function UtilizationSectionView({
    section,
}: UtilizationSectionViewProps) {
    const { t, i18n } = useTranslation(["dashboard"]);
    const language = i18n.language;
    const isRtl = language === "he" || language.startsWith("he-");
    const ns = { ns: "dashboard" as const };
    const prefersReducedMotion = usePrefersReducedMotion();
    const animDuration = prefersReducedMotion ? 0 : 1100;

    const peakSub =
        section.peakUtilizationStreakStart != null &&
        section.peakUtilizationStreakEnd != null
            ? t("credit_portfolio_health.kpi_peak_util_streak_window", {
                  ...ns,
                  defaultValue: "Longest peak: {{days}} days ({{start}} â€“ {{end}})",
                  days: section.peakUtilizationStreakDays,
                  start: section.peakUtilizationStreakStart,
                  end: section.peakUtilizationStreakEnd,
              })
            : t("credit_portfolio_health.kpi_peak_util_streak", {
                  ...ns,
                  defaultValue: "Longest streak at peak: {{days}} days",
                  days: section.peakUtilizationStreakDays,
              });

    const topCustomersChartData = useMemo(
        () =>
            section.topCustomers.map((item) => ({
                name: item.customerName,
                utilization:
                    item.utilizationPct != null ? item.utilizationPct : 0,
            })),
        [section.topCustomers]
    );

    const distributionChartData = useMemo(
        () =>
            section.distribution.map((item) => {
                const meta = BIN_LABEL_KEYS[item.bin];
                return {
                    bin: item.bin,
                    label: t(meta.key, {
                        ...ns,
                        defaultValue: meta.defaultValue,
                    }),
                    pct: item.customerPct,
                };
            }),
        [section.distribution, t]
    );

    const topChartHeight = Math.max(220, topCustomersChartData.length * 28);
    const distChartHeight = 220;

    return (
        <div className={layout.grid12}>
            <IslandCard
                accent="jade"
                className={`${layout.span6} ${layout.mdSpan3} ${layout.cardPad}`}
            >
                <Eyebrow icon={Activity}>
                    {t("credit_portfolio_health.kpi_avg_utilization", {
                        ...ns,
                        defaultValue: "Avg. utilization",
                    })}
                </Eyebrow>
                <BigNumber
                    value={section.averageUtilizationPct}
                    suffix="%"
                    label={t(
                        "credit_portfolio_health.kpi_avg_utilization_label",
                        {
                            ...ns,
                            defaultValue: "Policy utilization",
                        }
                    )}
                    color={CPH.jade}
                    locale={language}
                />
            </IslandCard>

            <IslandCard
                accent="critical"
                className={`${layout.span6} ${layout.mdSpan3} ${layout.cardPad}`}
            >
                <Eyebrow icon={AlertTriangle} tone={CPH.critical}>
                    {t("credit_portfolio_health.kpi_pct_days_above_100", {
                        ...ns,
                        defaultValue: "Over-coverage",
                    })}
                </Eyebrow>
                <BigNumber
                    value={section.pctDaysAbove100}
                    suffix="%"
                    label={t(
                        "credit_portfolio_health.kpi_pct_days_above_100_label",
                        {
                            ...ns,
                            defaultValue: "Time spent above 100%",
                        }
                    )}
                    color={CPH.critical}
                    locale={language}
                />
            </IslandCard>

            <IslandCard
                accent="jade"
                className={`${layout.span6} ${layout.mdSpan3} ${layout.cardPad}`}
            >
                <Eyebrow icon={TrendingUp}>
                    {t("credit_portfolio_health.kpi_peak_utilization", {
                        ...ns,
                        defaultValue: "Coverage peak",
                    })}
                </Eyebrow>
                <BigNumber
                    value={section.peakUtilizationPct}
                    suffix="%"
                    label={peakSub}
                    color={CPH.jade}
                    locale={language}
                />
            </IslandCard>

            <IslandCard
                accent="copper"
                className={`${layout.span6} ${layout.mdSpan3} ${layout.cardPad}`}
            >
                <Eyebrow icon={Gauge}>
                    {t("credit_portfolio_health.kpi_efficiency", {
                        ...ns,
                        defaultValue: "Efficiency ratio",
                    })}
                </Eyebrow>
                {section.efficiencyA == null ? (
                    <span style={{ color: CPH.muted }}>â€”</span>
                ) : (
                    <BigNumber
                        value={section.efficiencyA}
                        decimals={2}
                        suffix="Ã—"
                        label={t(
                            "credit_portfolio_health.kpi_efficiency_label",
                            {
                                ...ns,
                                defaultValue: "Health A Ã· utilization",
                            }
                        )}
                        color={CPH.copper}
                        locale={language}
                        sub={
                            section.efficiencyB == null
                                ? undefined
                                : t(
                                      "credit_portfolio_health.kpi_efficiency_b",
                                      {
                                          ...ns,
                                          defaultValue: "Health B: {{value}}Ã—",
                                          value: Number(
                                              section.efficiencyB.toFixed(2)
                                          ),
                                      }
                                  )
                        }
                    />
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

            {section.distributionCustomerCount > 0 ? (
                <IslandCard
                    accent="jade"
                    className={`${layout.span12} ${layout.mdSpan6} ${layout.cardPad}`}
                >
                    <Eyebrow icon={Users}>
                        {t("credit_portfolio_health.distribution_title", {
                            ...ns,
                            defaultValue: "Utilization distribution",
                        })}
                    </Eyebrow>
                    <div style={{ width: "100%", height: distChartHeight }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={distributionChartData}
                                margin={{ top: 10, left: -10, right: 10 }}
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
                                    tick={{ fill: CPH.slate, fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                    domain={[0, 100]}
                                    tickFormatter={(v: number) =>
                                        formatPct(v, language, 0)
                                    }
                                />
                                <Tooltip
                                    cursor={{ fill: CPH.surfaceMuted }}
                                    content={
                                        <ChartTooltip
                                            formatValue={(v) =>
                                                formatPct(v, language)
                                            }
                                        />
                                    }
                                />
                                <Bar
                                    dataKey="pct"
                                    name={t(
                                        "credit_portfolio_health.chart_customer_share",
                                        {
                                            ...ns,
                                            defaultValue: "Of customers",
                                        }
                                    )}
                                    fill={CPH.jade}
                                    radius={[8, 8, 0, 0]}
                                    animationDuration={animDuration}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </IslandCard>
            ) : null}

            {topCustomersChartData.length > 0 ? (
                <IslandCard
                    accent="jade"
                    className={`${layout.span12} ${layout.mdSpan7} ${layout.cardPad}`}
                >
                    <Eyebrow icon={Award}>
                        {t("credit_portfolio_health.top_customers_title", {
                            ...ns,
                            defaultValue: "Coverage â€” 10 largest customers",
                        })}
                    </Eyebrow>
                    <div style={{ width: "100%", height: topChartHeight }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                layout="vertical"
                                data={topCustomersChartData}
                                margin={{ left: 0, right: 20 }}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 6"
                                    stroke={CPH.border}
                                    horizontal={false}
                                />
                                <XAxis
                                    type="number"
                                    domain={[0, 100]}
                                    tick={{ fill: CPH.slate, fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(v: number) =>
                                        formatPct(v, language, 0)
                                    }
                                />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    width={100}
                                    tick={{ fill: CPH.slate, fontSize: 11.5 }}
                                    axisLine={false}
                                    tickLine={false}
                                    reversed={isRtl}
                                />
                                <Tooltip
                                    cursor={{ fill: CPH.surfaceMuted }}
                                    content={
                                        <ChartTooltip
                                            formatValue={(v) =>
                                                formatPct(v, language)
                                            }
                                        />
                                    }
                                />
                                <Bar
                                    dataKey="utilization"
                                    name={t(
                                        "credit_portfolio_health.chart_utilization_pct",
                                        {
                                            ...ns,
                                            defaultValue: "Coverage",
                                        }
                                    )}
                                    fill={CPH.jade}
                                    radius={[0, 6, 6, 0]}
                                    animationDuration={animDuration}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </IslandCard>
            ) : null}

            <IslandCard
                accent="copper"
                className={`${layout.cardPad} ${
                    topCustomersChartData.length > 0
                        ? `${layout.span12} ${layout.mdSpan5}`
                        : layout.span12
                }`}
            >
                <Eyebrow icon={RefreshCw}>
                    {t("credit_portfolio_health.kpi_top_ups_title", {
                        ...ns,
                        defaultValue: "Top-ups",
                    })}
                </Eyebrow>
                <div className={layout.kpiStrip} style={{ marginBottom: 16 }}>
                    <BigNumber
                        value={section.averageDailyTopUpCount}
                        decimals={1}
                        suffix=""
                        label={t("credit_portfolio_health.kpi_top_up_count", {
                            ...ns,
                            defaultValue: "Avg daily top-up count",
                        })}
                        color={CPH.ink}
                        locale={language}
                    />
                    <BigNumber
                        value={section.averageDailyCustomersWithTopUp}
                        decimals={1}
                        suffix=""
                        label={t(
                            "credit_portfolio_health.kpi_top_up_customers",
                            {
                                ...ns,
                                defaultValue: "Customers with top-up",
                            }
                        )}
                        color={CPH.ink}
                        locale={language}
                    />
                </div>
                <div className={layout.dividerTop}>
                    {section.averageTopUpUtilizationPct == null ? (
                        <span style={{ color: CPH.muted }}>â€”</span>
                    ) : (
                        <BigNumber
                            value={section.averageTopUpUtilizationPct}
                            suffix="%"
                            label={t(
                                "credit_portfolio_health.kpi_top_up_utilization",
                                {
                                    ...ns,
                                    defaultValue:
                                        "Avg. utilization of top-up amount",
                                }
                            )}
                            color={CPH.copper}
                            locale={language}
                        />
                    )}
                </div>
            </IslandCard>
        </div>
    );
}
