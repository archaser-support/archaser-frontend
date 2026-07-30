"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import type { PortfolioNoCoverageSection } from "@/server/services/creditInsurance/creditPortfolioHealthService";
import { formatCurrencyWithRTLSupport } from "@/utils/stringFormatters";

import { BigNumber } from "./BigNumber";
import { ChartTooltip } from "./ChartTooltip";
import { Eyebrow } from "./Eyebrow";
import { IslandCard } from "./IslandCard";
import { CPH } from "./designTokens";
import { SPACE_GROTESK_FONT_FAMILY } from "./fontTokens";
import layout from "./islandLayout.module.css";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export type NoCoverageSectionViewProps = {
    section: PortfolioNoCoverageSection;
};

const REASON_LABEL_KEYS: Record<
    string,
    { key: string; defaultValue: string }
> = {
    pending_review: {
        key: "credit_portfolio_health.reason_pending_review",
        defaultValue: "Pending review",
    },
    credit_hold: {
        key: "credit_portfolio_health.reason_credit_hold",
        defaultValue: "Credit hold",
    },
    insurer_declined: {
        key: "credit_portfolio_health.reason_insurer_declined",
        defaultValue: "Insurer declined",
    },
    other: {
        key: "credit_portfolio_health.reason_other",
        defaultValue: "Other",
    },
    no_linked_policy: {
        key: "credit_portfolio_health.reason_no_linked_policy",
        defaultValue: "No linked policy",
    },
};

const BREACH_REASON_LABEL_KEYS: Record<
    string,
    { key: string; defaultValue: string }
> = {
    reportingBreach: {
        key: "credit_insurance_dashboard.breach_type_reporting_breach",
        defaultValue: "Reporting Breach",
    },
    paymentTerm: {
        key: "credit_insurance_dashboard.breach_type_payment_term",
        defaultValue: "Payment Term Breach",
    },
    customerOverdueMep: {
        key: "credit_insurance_dashboard.breach_type_customer_overdue_mep",
        defaultValue: "Customer Overdue MEP",
    },
    outdatedDcl: {
        key: "credit_insurance_dashboard.breach_type_outdated_dcl",
        defaultValue: "Outdated DCL",
    },
    invoiceAfterPolicyEnd: {
        key: "credit_insurance_dashboard.breach_type_invoice_after_policy_end",
        defaultValue: "Invoice After Policy End",
    },
    other: {
        key: "credit_insurance_dashboard.breach_type_other",
        defaultValue: "Other",
    },
};

function formatAmount(value: number, language: string): string {
    const locale = language.startsWith("he") ? "he-IL" : "en-US";
    return value.toLocaleString(locale, { maximumFractionDigits: 0 });
}

function formatMoney(
    amount: number,
    currencyCode: string,
    language: string
): string {
    const locale = language.startsWith("he") ? "he-IL" : "en-US";
    return formatCurrencyWithRTLSupport(
        amount,
        currencyCode,
        locale,
        language.startsWith("he") ? "he" : language
    );
}

export function NoCoverageSectionView({ section }: NoCoverageSectionViewProps) {
    const { t, i18n } = useTranslation(["dashboard"]);
    const language = i18n.language;
    const ns = { ns: "dashboard" as const };
    const prefersReducedMotion = usePrefersReducedMotion();
    const animDuration = prefersReducedMotion ? 0 : 1100;
    const currency = section.accountCurrency || "USD";

    const reasonsWithSignal = section.reasons.filter(
        (item) => item.averageAmount > 0 || item.averageCustomerCount > 0
    );

    const reasonsChartData = useMemo(
        () =>
            [...reasonsWithSignal]
                .sort((a, b) => b.averageAmount - a.averageAmount)
                .map((item) => {
                    const meta = REASON_LABEL_KEYS[item.reason];
                    return {
                        reason: item.reason,
                        label: meta
                            ? t(meta.key, {
                                  ...ns,
                                  defaultValue: meta.defaultValue,
                              })
                            : item.reason,
                        amount: item.averageAmount,
                        customers: item.averageCustomerCount,
                    };
                }),
        [reasonsWithSignal, t]
    );

    const mainViolationLabel =
        section.mainViolationReason == null
            ? t("credit_portfolio_health.kpi_main_violation_none", {
                  ...ns,
                  defaultValue: "None",
              })
            : t(
                  BREACH_REASON_LABEL_KEYS[section.mainViolationReason]?.key ??
                      "credit_insurance_dashboard.breach_type_other",
                  {
                      ...ns,
                      defaultValue:
                          BREACH_REASON_LABEL_KEYS[section.mainViolationReason]
                              ?.defaultValue ?? section.mainViolationReason,
                  }
              );

    const chartHeight = Math.max(200, reasonsChartData.length * 42);

    return (
        <div className={layout.grid12}>
            <IslandCard
                accent="critical"
                className={`${layout.span12} ${layout.mdSpan4} ${layout.cardPad}`}
            >
                <Eyebrow
                    icon={ShieldAlert}
                    tone={CPH.critical}
                    help={t(
                        "credit_portfolio_health.kpi_uncovered_exposure_help",
                        {
                            ...ns,
                            defaultValue:
                                "Customer %: mean daily share of customers with no linked policy or any exclusion reason. Amount: mean daily open AR for that uncovered cohort over available days.",
                        }
                    )}
                >
                    {t("credit_portfolio_health.kpi_uncovered_exposure", {
                        ...ns,
                        defaultValue: "Uncovered exposure",
                    })}
                </Eyebrow>
                <BigNumber
                    value={section.averageUncoveredCustomerPct}
                    suffix="%"
                    label={t(
                        "credit_portfolio_health.kpi_uncovered_customer_pct",
                        {
                            ...ns,
                            defaultValue: "Of customers with zero coverage",
                        }
                    )}
                    color={CPH.critical}
                    locale={language}
                    sub={t(
                        "credit_portfolio_health.kpi_uncovered_customer_count",
                        {
                            ...ns,
                            defaultValue: "Avg daily customers: {{count}}",
                            count: section.averageUncoveredCustomerCount,
                        }
                    )}
                />
                <div className={layout.dividerTop}>
                    <div
                        className="text-3xl font-semibold tracking-tight"
                        style={{
                            color: CPH.ink,
                            fontFamily: SPACE_GROTESK_FONT_FAMILY,
                        }}
                    >
                        {formatMoney(
                            section.averageUncoveredAmount,
                            currency,
                            language
                        )}
                    </div>
                    <div className="mt-1 text-sm" style={{ color: CPH.slate }}>
                        {t("credit_portfolio_health.kpi_uncovered_amount", {
                            ...ns,
                            defaultValue: "Uncovered monetary exposure",
                        })}
                    </div>
                </div>
            </IslandCard>

            <IslandCard
                accent="copper"
                className={`${layout.span12} ${layout.mdSpan8} ${layout.cardPad}`}
            >
                <Eyebrow
                    icon={Info}
                    help={t(
                        "credit_portfolio_health.no_coverage_reasons_help",
                        {
                            ...ns,
                            defaultValue:
                                "Average daily uncovered open AR by exclusion reason (or no linked policy) over available days in the range.",
                        }
                    )}
                >
                    {t("credit_portfolio_health.no_coverage_reasons_title", {
                        ...ns,
                        defaultValue: "Reasons for lack of coverage",
                    })}
                </Eyebrow>
                {reasonsChartData.length === 0 ? (
                    <p className="m-0 text-sm" style={{ color: CPH.slate }}>
                        {t("credit_portfolio_health.no_section_data", {
                            ...ns,
                            defaultValue: "No data for this range.",
                        })}
                    </p>
                ) : (
                    <div style={{ width: "100%", height: chartHeight }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                layout="vertical"
                                data={reasonsChartData}
                                margin={{ left: 10, right: 20, top: 4, bottom: 4 }}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 6"
                                    stroke={CPH.border}
                                    horizontal={false}
                                />
                                <XAxis
                                    type="number"
                                    tick={{ fill: CPH.slate, fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(v: number) =>
                                        formatAmount(v, language)
                                    }
                                />
                                <YAxis
                                    type="category"
                                    dataKey="label"
                                    width={Math.min(
                                        220,
                                        Math.max(
                                            160,
                                            ...reasonsChartData.map(
                                                (row) =>
                                                    Math.min(
                                                        row.label.length * 7.2,
                                                        220
                                                    )
                                            )
                                        )
                                    )}
                                    tick={{ fill: CPH.slate, fontSize: 11.5 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    cursor={{ fill: CPH.surfaceMuted }}
                                    content={
                                        <ChartTooltip
                                            formatValue={(v) =>
                                                formatAmount(v, language)
                                            }
                                        />
                                    }
                                />
                                <Bar
                                    dataKey="amount"
                                    name={t(
                                        "credit_portfolio_health.kpi_uncovered_amount",
                                        {
                                            ...ns,
                                            defaultValue: "Uncovered amount",
                                        }
                                    )}
                                    radius={[0, 6, 6, 0]}
                                    animationDuration={animDuration}
                                >
                                    {reasonsChartData.map((_, i) => (
                                        <Cell
                                            key={i}
                                            fill={
                                                i === 0
                                                    ? CPH.copper
                                                    : CPH.jadeDim
                                            }
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </IslandCard>

            <IslandCard
                accent="critical"
                className={`${layout.span12} ${layout.cardPad}`}
            >
                <Eyebrow
                    icon={AlertTriangle}
                    tone={CPH.critical}
                    help={t("credit_portfolio_health.kpi_violations_help", {
                        ...ns,
                        defaultValue:
                            "Average policy violation rate is the mean of daily (terms-breach AR ÷ approved total AR × 100). Leading cause is the reason with the largest summed breach amount among approved customers, and that reason’s share of total breach amount.",
                    })}
                >
                    {t("credit_portfolio_health.kpi_violations_title", {
                        ...ns,
                        defaultValue: "Policy violations",
                    })}
                </Eyebrow>
                <div className={layout.violationsRow}>
                    <BigNumber
                        value={section.averageViolationPct}
                        suffix="%"
                        label={t("credit_portfolio_health.kpi_violation_pct", {
                            ...ns,
                            defaultValue: "Average policy violation rate",
                        })}
                        color={CPH.critical}
                        locale={language}
                    />
                    <div>
                        <div
                            className="text-sm font-medium"
                            style={{ color: CPH.ink }}
                        >
                            {mainViolationLabel}
                        </div>
                        <div
                            className="mt-1 text-xs"
                            style={{ color: CPH.slate }}
                        >
                            {t("credit_portfolio_health.kpi_main_violation", {
                                ...ns,
                                defaultValue: "Leading cause of violations",
                            })}
                        </div>
                    </div>
                    <BigNumber
                        value={section.mainViolationReasonSharePct}
                        decimals={0}
                        suffix="%"
                        label={t(
                            "credit_portfolio_health.kpi_main_violation_share_label",
                            {
                                ...ns,
                                defaultValue: "Share of total violations",
                            }
                        )}
                        color={CPH.copper}
                        locale={language}
                    />
                </div>
            </IslandCard>
        </div>
    );
}
