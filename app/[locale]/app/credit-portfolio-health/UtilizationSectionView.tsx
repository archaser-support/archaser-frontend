"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
    Activity,
    AlertTriangle,
    Award,
    ChevronRight,
    Layers,
    RefreshCw,
    TrendingUp,
    Users,
} from "lucide-react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    LabelList,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { useParams, useRouter } from "next/navigation";

import type { PortfolioUtilizationSection, UtilizationDistributionBinKey } from "@/types/creditInsurance";
import { appendDashboardBusinessUnitId } from "@/shared/dashboard/dashboardBusinessUnitParams";
import { applyCreditReportDocumentTitle } from "../credit-dashboard/report/creditReportTitles";
import { formatPortfolioMoney } from "./formatPortfolioMoney";
import { BigNumber } from "./BigNumber";
import { ChartTooltip } from "./ChartTooltip";
import { Eyebrow } from "./Eyebrow";
import { IslandCard } from "./IslandCard";
import { UtilizationDailyChart } from "./UtilizationDailyChart";
import { StatNumber } from "./StatNumber";
import { CPH } from "./designTokens";
import { SPACE_GROTESK_FONT_FAMILY } from "./fontTokens";
import layout from "./islandLayout.module.css";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export type UtilizationSectionViewProps = {
    section: PortfolioUtilizationSection;
    fromYmd: string;
    toYmd: string;
    policyId?: number | null;
    businessUnitId?: number | null;
    includeNoPolicyExposure?: boolean;
};

type UtilizationRiskZone = "calm" | "warning" | "danger";

function riskZoneForBin(bin: UtilizationDistributionBinKey): UtilizationRiskZone {
    if (
        bin === "0_20" ||
        bin === "20_40" ||
        bin === "40_60" ||
        bin === "60_80"
    ) {
        return "calm";
    }
    if (bin === "80_100") {
        return "warning";
    }
    return "danger";
}

function averageTopCustomersUtilization(
    customers: {
        utilizationPct: number | null;
        openAr?: number;
    }[],
    totalOpenAr: number
): {
    averagePct: number | null;
    count: number;
    total: number;
    openArTotal: number;
    /** Top cohort open AR as % of portfolio open AR; null when denom is 0. */
    openArSharePct: number | null;
} {
    const total = customers.length;
    const openArTotal = customers.reduce(
        (sum, row) => sum + Math.max(0, Number(row.openAr) || 0),
        0
    );
    const denom = Math.max(0, Number(totalOpenAr) || 0);
    const openArSharePct =
        denom > 0 ? Math.min(100, (100 * openArTotal) / denom) : null;
    const withPct = customers.filter(
        (row): row is { utilizationPct: number; openAr?: number } =>
            row.utilizationPct != null && Number.isFinite(row.utilizationPct)
    );
    const count = withPct.length;
    if (count === 0) {
        return { averagePct: null, count, total, openArTotal, openArSharePct };
    }
    const averagePct =
        withPct.reduce((sum, row) => sum + row.utilizationPct, 0) / count;
    return { averagePct, count, total, openArTotal, openArSharePct };
}

function seriesFillForRisk(
    series: "customers" | "usage",
    zone: UtilizationRiskZone
): string {
    if (zone === "danger") {
        return CPH.critical;
    }
    // Below 100%: customers = teal, usage = violet (one color = one meaning).
    return series === "customers" ? CPH.teal : CPH.violet;
}

const BIN_LABEL_KEYS: Record<
    UtilizationDistributionBinKey,
    { key: string; defaultValue: string }
> = {
    "0_20": {
        key: "credit_portfolio_health.bin_0_20",
        defaultValue: "0–20%",
    },
    "20_40": {
        key: "credit_portfolio_health.bin_20_40",
        defaultValue: "20–40%",
    },
    "40_60": {
        key: "credit_portfolio_health.bin_40_60",
        defaultValue: "40–60%",
    },
    "60_80": {
        key: "credit_portfolio_health.bin_60_80",
        defaultValue: "60–80%",
    },
    "80_100": {
        key: "credit_portfolio_health.bin_80_100",
        defaultValue: "80–100%",
    },
    "100_110": {
        key: "credit_portfolio_health.bin_100_110",
        defaultValue: "100–110%",
    },
    "110_120": {
        key: "credit_portfolio_health.bin_110_120",
        defaultValue: "110–120%",
    },
    "120_130": {
        key: "credit_portfolio_health.bin_120_130",
        defaultValue: "120–130%",
    },
    "130_150": {
        key: "credit_portfolio_health.bin_130_150",
        defaultValue: "130–150%",
    },
    "150_plus": {
        key: "credit_portfolio_health.bin_150_plus",
        defaultValue: "≥150%",
    },
};

function formatPct(value: number, language: string, decimals = 1): string {
    const locale = language.startsWith("he") ? "he-IL" : "en-US";
    return `${value.toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    })}%`;
}

/** Leave room for long legal names; ellipsis via tick keeps bars clear. */
const TOP_CUSTOMERS_Y_AXIS_WIDTH = 180;
const TOP_CUSTOMERS_Y_LABEL_MAX_CHARS = 22;

function truncateChartLabel(
    value: string,
    maxChars: number,
    rtl: boolean
): string {
    if (value.length <= maxChars) {
        return value;
    }
    const truncated = value.slice(0, Math.max(0, maxChars - 1));
    // Chart SVG is LTR; prefix … in RTL so it sits on the visual left.
    return rtl ? `…${truncated}` : `${truncated}…`;
}

type DistributionChartRow = {
    bin: UtilizationDistributionBinKey;
    label: string;
    customerPct: number;
    usagePct: number;
    customerCount: number;
    usageAmount: number;
};

type DistributionTooltipProps = {
    active?: boolean;
    label?: string;
    payload?: Array<{
        dataKey?: string | number;
        name?: string;
        value?: number | string;
        color?: string;
        payload?: DistributionChartRow;
    }>;
    language: string;
    currency: string;
    customerSeriesName: string;
    usageSeriesName: string;
};

function DistributionTooltip({
    active,
    label,
    payload,
    language,
    currency,
    customerSeriesName,
    usageSeriesName,
}: DistributionTooltipProps) {
    const row = payload?.[0]?.payload;
    if (!active || row == null) {
        return null;
    }
    const locale = language.startsWith("he") ? "he-IL" : "en-US";
    const isRtl = language === "he" || language.startsWith("he-");
    const customerLine = `${row.customerCount.toLocaleString(locale)} (${formatPct(row.customerPct, language)})`;
    const usageLine = `${formatPortfolioMoney(
        row.usageAmount,
        currency,
        language
    )} (${formatPct(row.usagePct, language)})`;

    const items = [
        {
            name: customerSeriesName,
            display: customerLine,
            color: CPH.teal,
        },
        {
            name: usageSeriesName,
            display: usageLine,
            color: CPH.violet,
        },
    ];

    return (
        <div
            dir={isRtl ? "rtl" : "ltr"}
            style={{
                borderRadius: 8,
                border: `1px solid ${CPH.border}`,
                padding: "8px 12px",
                fontSize: 12,
                backgroundColor: CPH.card,
                color: CPH.ink,
                boxShadow: CPH.shadow,
                direction: isRtl ? "rtl" : "ltr",
                textAlign: isRtl ? "right" : "left",
                unicodeBidi: "isolate",
            }}
        >
            {label ? (
                <div
                    style={{
                        marginBottom: 4,
                        fontWeight: 500,
                        color: CPH.slate,
                        direction: isRtl ? "rtl" : "ltr",
                        textAlign: isRtl ? "right" : "left",
                    }}
                >
                    {label}
                </div>
            ) : null}
            <ul
                style={{
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                }}
            >
                {items.map((entry) => (
                    <li
                        key={entry.name}
                        style={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            direction: isRtl ? "rtl" : "ltr",
                            width: "100%",
                        }}
                    >
                        <span
                            style={{
                                display: "inline-block",
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                flexShrink: 0,
                                backgroundColor: entry.color,
                            }}
                        />
                        <span
                            style={{
                                color: CPH.slate,
                                flex: 1,
                                minWidth: 0,
                                textAlign: isRtl ? "right" : "left",
                            }}
                        >
                            {entry.name}
                        </span>
                        <span
                            style={{
                                flexShrink: 0,
                                fontWeight: 500,
                                fontVariantNumeric: "tabular-nums",
                                color: CPH.ink,
                                direction: "ltr",
                                textAlign: isRtl ? "left" : "right",
                                unicodeBidi: "isolate",
                            }}
                        >
                            {entry.display}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function UtilizationSectionView({
    section,
    fromYmd,
    toYmd,
    policyId = null,
    businessUnitId = null,
    includeNoPolicyExposure = true,
}: UtilizationSectionViewProps) {
    const { t, i18n } = useTranslation(["dashboard"]);
    const language = i18n.language;
    const isRtl = language === "he" || language.startsWith("he-");
    const ns = { ns: "dashboard" as const };
    const prefersReducedMotion = usePrefersReducedMotion();
    const animDuration = prefersReducedMotion ? 0 : 1100;
    const router = useRouter();
    const params = useParams();
    const locale =
        typeof params?.locale === "string" ? params.locale : "en";

    const peakSub =
        section.peakUtilizationStreakStart != null &&
        section.peakUtilizationStreakEnd != null
            ? t("credit_portfolio_health.kpi_peak_util_streak_window", {
                  ...ns,
                  defaultValue: "Longest peak: {{days}} days ({{start}} – {{end}})",
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

    const topCustomersChartDomainMax = useMemo(() => {
        const peak = topCustomersChartData.reduce(
            (max, row) => Math.max(max, row.utilization),
            0
        );
        // Allow over-limit bars to extend past 100% (old domain [0, 100] clipped them).
        return Math.max(100, Math.ceil(peak / 10) * 10);
    }, [topCustomersChartData]);

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
                    customerPct: item.customerPct,
                    usagePct: item.usagePct ?? 0,
                    customerCount: item.customerCount,
                    usageAmount: item.usageAmount ?? 0,
                } satisfies DistributionChartRow;
            }),
        [section.distribution, t]
    );

    const customerSeriesName = t("credit_portfolio_health.chart_customer_share", {
        ...ns,
        defaultValue: "Of customers",
    });
    const usageSeriesName = t("credit_portfolio_health.chart_usage_share", {
        ...ns,
        defaultValue: "Of usage",
    });
    const currency = section.accountCurrency || "USD";

    const openUtilizationBinReport = (bin: UtilizationDistributionBinKey) => {
        const sp = new URLSearchParams({
            type: "utilization_bin",
            bin,
            from: fromYmd,
            to: toYmd,
        });
        if (policyId != null) {
            sp.set("policyId", String(policyId));
        }
        if (!includeNoPolicyExposure) {
            sp.set("includeNoPolicyExposure", "0");
        }
        appendDashboardBusinessUnitId(sp, businessUnitId);
        applyCreditReportDocumentTitle(t, "utilization_bin");
        router.push(`/${locale}/app/credit-dashboard/report?${sp.toString()}`);
    };

    const overshoot = section.overshoot ?? null;

    const openOvershootReport = () => {
        const sp = new URLSearchParams({
            type: "utilization_overshoot",
            from: fromYmd,
            to: toYmd,
        });
        if (policyId != null) {
            sp.set("policyId", String(policyId));
        }
        if (!includeNoPolicyExposure) {
            sp.set("includeNoPolicyExposure", "0");
        }
        appendDashboardBusinessUnitId(sp, businessUnitId);
        applyCreditReportDocumentTitle(t, "utilization_overshoot");
        router.push(`/${locale}/app/credit-dashboard/report?${sp.toString()}`);
    };

    const rankingPreview = useMemo(
        () => (overshoot?.ranking ?? []).slice(0, 10),
        [overshoot?.ranking]
    );

    const top10AvgUtilization = useMemo(() => {
        const totalOpenAr =
            Math.max(0, Number(section.selfUnderwrittenAverageAr) || 0) +
            Math.max(0, Number(section.approvedAverageAr) || 0);
        return averageTopCustomersUtilization(
            section.topCustomers,
            totalOpenAr
        );
    }, [
        section.topCustomers,
        section.selfUnderwrittenAverageAr,
        section.approvedAverageAr,
    ]);

    const topChartHeight = Math.max(220, topCustomersChartData.length * 28);
    const distChartHeight = 280;

    return (
        <div className={layout.grid12}>
            <IslandCard
                accent="teal"
                className={`${layout.span6} ${layout.mdSpan3} ${layout.cardPad}`}
            >
                <Eyebrow
                    icon={Activity}
                    help={t(
                        "credit_portfolio_health.kpi_avg_utilization_help",
                        {
                            ...ns,
                            defaultValue:
                                "Mean of daily (sum usage ÷ sum effective approved limit × 100) for approved customers over available days.",
                        }
                    )}
                >
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
                    color={CPH.teal}
                    locale={language}
                />
            </IslandCard>

            <IslandCard
                accent={
                    top10AvgUtilization.averagePct != null &&
                    top10AvgUtilization.averagePct > 100
                        ? "critical"
                        : "teal"
                }
                className={`${layout.span6} ${layout.mdSpan3} ${layout.cardPad}`}
            >
                <Eyebrow
                    icon={Users}
                    tone={
                        top10AvgUtilization.averagePct != null &&
                        top10AvgUtilization.averagePct > 100
                            ? CPH.critical
                            : undefined
                    }
                    help={t(
                        "credit_portfolio_health.kpi_avg_utilization_top10_help",
                        {
                            ...ns,
                            defaultValue:
                                "Shows average utilization of the largest customers by open AR so you can see concentration risk among the biggest names.\n\nUnweighted mean of each of those customers’ period-average utilization %. Customers without an effective limit are excluded.",
                        }
                    )}
                >
                    {t("credit_portfolio_health.kpi_avg_utilization_top10", {
                        ...ns,
                        defaultValue: "Avg. utilization (top 10)",
                    })}
                </Eyebrow>
                {top10AvgUtilization.averagePct == null ? (
                    <div>
                        <span style={{ color: CPH.muted }}>—</span>
                        {top10AvgUtilization.openArSharePct != null ? (
                            <div
                                style={{
                                    marginTop: 8,
                                    fontSize: 12,
                                    color: CPH.muted,
                                }}
                            >
                                {t(
                                    "credit_portfolio_health.kpi_avg_utilization_top10_open_ar_share",
                                    {
                                        ...ns,
                                        defaultValue:
                                            "{{pct}}% of all open AR",
                                        pct: formatPct(
                                            top10AvgUtilization.openArSharePct,
                                            language,
                                            1
                                        ).replace(/%$/, ""),
                                    }
                                )}
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <BigNumber
                        value={top10AvgUtilization.averagePct}
                        suffix="%"
                        color={
                            top10AvgUtilization.averagePct > 100
                                ? CPH.critical
                                : CPH.teal
                        }
                        locale={language}
                        sub={
                            top10AvgUtilization.openArSharePct != null
                                ? t(
                                      "credit_portfolio_health.kpi_avg_utilization_top10_open_ar_share",
                                      {
                                          ...ns,
                                          defaultValue:
                                              "{{pct}}% of all open AR",
                                          pct: formatPct(
                                              top10AvgUtilization.openArSharePct,
                                              language,
                                              1
                                          ).replace(/%$/, ""),
                                      }
                                  )
                                : undefined
                        }
                    />
                )}
            </IslandCard>

            <IslandCard
                accent="critical"
                className={`${layout.span6} ${layout.mdSpan3} ${layout.cardPad}`}
            >
                <Eyebrow
                    icon={AlertTriangle}
                    tone={CPH.critical}
                    help={t(
                        "credit_portfolio_health.kpi_pct_days_above_100_help",
                        {
                            ...ns,
                            defaultValue:
                                "Share of available days where portfolio effective utilization exceeded 100%.",
                        }
                    )}
                >
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
                accent="teal"
                className={`${layout.span6} ${layout.mdSpan3} ${layout.cardPad}`}
            >
                <Eyebrow
                    icon={TrendingUp}
                    help={t(
                        "credit_portfolio_health.kpi_peak_utilization_help",
                        {
                            ...ns,
                            defaultValue:
                                "Highest daily effective utilization and the longest consecutive calendar streak at that exact peak (most recent on ties).",
                        }
                    )}
                >
                    {t("credit_portfolio_health.kpi_peak_utilization", {
                        ...ns,
                        defaultValue: "Coverage peak",
                    })}
                </Eyebrow>
                <BigNumber
                    value={section.peakUtilizationPct}
                    suffix="%"
                    label={peakSub}
                    color={CPH.teal}
                    locale={language}
                />
            </IslandCard>

            <IslandCard
                accent="violet"
                className={`${layout.span12} ${layout.mdSpan6} ${layout.cardPad}`}
            >
                <Eyebrow
                    icon={Users}
                    help={t(
                        "credit_portfolio_health.kpi_idle_named_customers_help",
                        {
                            ...ns,
                            defaultValue:
                                "Shows Named customers with no positive open AR on any day they were named in the selected range — including named customers who had no daily open AR snapshot in the range — so you can see the cost of unused named cover.\n\nCount and share vs all Named in that set (CPT named-in-range plus current NamedPolicy roster; DCL excluded). Assessment cost uses each policy’s current fee × idle count × whole years (ceil days÷365, minimum 1). Null fee counts as $0.",
                        }
                    )}
                >
                    {t("credit_portfolio_health.kpi_idle_named_customers", {
                        ...ns,
                        defaultValue: "Idle named customers",
                    })}
                </Eyebrow>
                <div className={layout.footprintRow}>
                    <div>
                        <div
                            className="text-3xl font-semibold tracking-tight"
                            style={{
                                color: CPH.ink,
                                fontFamily: SPACE_GROTESK_FONT_FAMILY,
                            }}
                        >
                            {(section.idleNamedCustomerCount ?? 0).toLocaleString(
                                language.startsWith("he") ? "he-IL" : "en-US"
                            )}
                        </div>
                        <div
                            className="mt-1 text-xs"
                            style={{ color: CPH.slate }}
                        >
                            {t(
                                "credit_portfolio_health.kpi_idle_named_customers_label",
                                {
                                    ...ns,
                                    defaultValue:
                                        "{{idle}} of {{named}} named · {{pct}} idle",
                                    idle: section.idleNamedCustomerCount ?? 0,
                                    named:
                                        section.namedCustomerCountInRange ?? 0,
                                    pct: formatPct(
                                        section.idleNamedCustomerPct ?? 0,
                                        language,
                                        0
                                    ),
                                }
                            )}
                        </div>
                    </div>
                    <ChevronRight size={18} style={{ color: CPH.muted }} />
                    <div>
                        <div
                            className="text-3xl font-semibold tracking-tight"
                            style={{
                                color: CPH.ink,
                                fontFamily: SPACE_GROTESK_FONT_FAMILY,
                            }}
                        >
                            {formatPortfolioMoney(
                                section.idleNamedAnnualCreditAssessmentCost ??
                                    0,
                                section.accountCurrency,
                                language
                            )}
                        </div>
                        <div
                            className="mt-1 text-xs"
                            style={{ color: CPH.slate }}
                        >
                            {t(
                                "credit_portfolio_health.kpi_idle_named_customers_cost_label",
                                {
                                    ...ns,
                                    defaultValue:
                                        "Assessment cost · ×{{years}} year(s)",
                                    years: section.yearMultiplier ?? 1,
                                }
                            )}
                        </div>
                    </div>
                </div>
            </IslandCard>

            <IslandCard
                accent="violet"
                className={`${layout.span12} ${layout.mdSpan6} ${layout.cardPad}`}
            >
                <Eyebrow
                    icon={RefreshCw}
                    help={t("credit_portfolio_health.kpi_top_ups_help", {
                        ...ns,
                        defaultValue:
                            "Top-up count: policies active any time in the period. Customers with top-up: average daily count with at least one active top-up.",
                    })}
                >
                    {t("credit_portfolio_health.kpi_top_ups_title", {
                        ...ns,
                        defaultValue: "Top-ups",
                    })}
                </Eyebrow>
                <div className={layout.kpiStrip}>
                    <BigNumber
                        value={section.periodActiveTopUpCount}
                        decimals={0}
                        suffix=""
                        label={t("credit_portfolio_health.kpi_top_up_count", {
                            ...ns,
                            defaultValue: "Top-up count",
                        })}
                        color={CPH.ink}
                        locale={language}
                    />
                    <BigNumber
                        value={section.periodCustomersWithTopUp}
                        decimals={0}
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
            </IslandCard>

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
                                "Mean daily share of customers and open AR with a linked policy and no exclusion reason. Avg. utilization is the mean daily effective utilization for that cohort.",
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
                    {section.approvedAverageUtilizationPct == null ? (
                        <span style={{ color: CPH.muted }}>—</span>
                    ) : (
                        <BigNumber
                            value={section.approvedAverageUtilizationPct}
                            suffix="%"
                            label={t(
                                "credit_portfolio_health.footprint_avg_utilization",
                                {
                                    ...ns,
                                    defaultValue: "Avg. utilization",
                                }
                            )}
                            color={CPH.good}
                            locale={language}
                        />
                    )}
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
                            "Mean daily share of customers and open AR with no linked policy or any exclusion reason. Avg. utilization is shown when an effective limit applies.",
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
                    {section.selfUnderwrittenAverageUtilizationPct == null ? (
                        <span style={{ color: CPH.muted }}>—</span>
                    ) : (
                        <BigNumber
                            value={
                                section.selfUnderwrittenAverageUtilizationPct
                            }
                            suffix="%"
                            label={t(
                                "credit_portfolio_health.footprint_avg_utilization",
                                {
                                    ...ns,
                                    defaultValue: "Avg. utilization",
                                }
                            )}
                            color={CPH.ink}
                            locale={language}
                        />
                    )}
                </div>
                <p className="m-0 mt-3 text-xs" style={{ color: CPH.slate }}>
                    {t("credit_portfolio_health.footprint_covered_only_remark", {
                        ...ns,
                        defaultValue:
                            "Calculation includes only covered customers (Named + DCL).",
                    })}
                </p>
            </IslandCard>

            <UtilizationDailyChart
                daily={section.daily}
                fromYmd={fromYmd}
                toYmd={toYmd}
            />

            {section.distributionCustomerCount > 0 ? (
                <IslandCard
                    accent="teal"
                    className={`${layout.span12} ${layout.cardPad}`}
                >
                    <Eyebrow
                        icon={Users}
                        help={t("credit_portfolio_health.distribution_help", {
                            ...ns,
                            count: section.distributionCustomerCount,
                            defaultValue:
                                "Among {{count}} approved customers with a positive effective limit on at least one day in the range. Binned by mean daily effective utilization %. Grouped bars: share of customers and share of mean usage. Exclusive bins; each series sums to ~100%.",
                        })}
                    >
                        {t("credit_portfolio_health.distribution_title", {
                            ...ns,
                            defaultValue: "Utilization distribution",
                        })}
                    </Eyebrow>
                    <div style={{ width: "100%", height: distChartHeight }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={distributionChartData}
                                margin={{ top: 28, left: 8, right: 12, bottom: 4 }}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 6"
                                    stroke={CPH.border}
                                    vertical={false}
                                />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fill: CPH.slate, fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    interval={0}
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
                                        <DistributionTooltip
                                            language={language}
                                            currency={currency}
                                            customerSeriesName={
                                                customerSeriesName
                                            }
                                            usageSeriesName={usageSeriesName}
                                        />
                                    }
                                />
                                <Legend
                                    wrapperStyle={{
                                        fontSize: 12,
                                        color: CPH.slate,
                                    }}
                                />
                                <Bar
                                    dataKey="customerPct"
                                    name={customerSeriesName}
                                    fill={CPH.teal}
                                    radius={[8, 8, 0, 0]}
                                    animationDuration={animDuration}
                                    cursor="pointer"
                                    onClick={(entry) => {
                                        const row = (
                                            entry as {
                                                payload?: DistributionChartRow;
                                            }
                                        )?.payload;
                                        if (
                                            row?.bin != null &&
                                            row.customerCount > 0
                                        ) {
                                            openUtilizationBinReport(row.bin);
                                        }
                                    }}
                                >
                                    {distributionChartData.map((row) => (
                                        <Cell
                                            key={`cust-${row.bin}`}
                                            fill={seriesFillForRisk(
                                                "customers",
                                                riskZoneForBin(row.bin)
                                            )}
                                            cursor={
                                                row.customerCount > 0
                                                    ? "pointer"
                                                    : "default"
                                            }
                                        />
                                    ))}
                                    <LabelList
                                        dataKey="customerPct"
                                        position="top"
                                        offset={6}
                                        fill={CPH.ink}
                                        fontSize={10}
                                        formatter={(label) => {
                                            const value =
                                                typeof label === "number"
                                                    ? label
                                                    : Number(label);
                                            return Number.isFinite(value) &&
                                                value > 0
                                                ? formatPct(value, language, 0)
                                                : "";
                                        }}
                                    />
                                </Bar>
                                <Bar
                                    dataKey="usagePct"
                                    name={usageSeriesName}
                                    fill={CPH.violet}
                                    radius={[8, 8, 0, 0]}
                                    animationDuration={animDuration}
                                    cursor="pointer"
                                    onClick={(entry) => {
                                        const row = (
                                            entry as {
                                                payload?: DistributionChartRow;
                                            }
                                        )?.payload;
                                        if (
                                            row?.bin != null &&
                                            row.customerCount > 0
                                        ) {
                                            openUtilizationBinReport(row.bin);
                                        }
                                    }}
                                >
                                    {distributionChartData.map((row) => {
                                        const zone = riskZoneForBin(row.bin);
                                        return (
                                            <Cell
                                                key={`usage-${row.bin}`}
                                                fill={seriesFillForRisk(
                                                    "usage",
                                                    zone
                                                )}
                                                fillOpacity={
                                                    zone === "danger" ? 0.85 : 1
                                                }
                                                cursor={
                                                    row.customerCount > 0
                                                        ? "pointer"
                                                        : "default"
                                                }
                                            />
                                        );
                                    })}
                                    <LabelList
                                        dataKey="usagePct"
                                        position="top"
                                        offset={6}
                                        fill={CPH.ink}
                                        fontSize={10}
                                        formatter={(label) => {
                                            const value =
                                                typeof label === "number"
                                                    ? label
                                                    : Number(label);
                                            return Number.isFinite(value) &&
                                                value > 0
                                                ? formatPct(value, language, 0)
                                                : "";
                                        }}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </IslandCard>
            ) : null}

            {topCustomersChartData.length > 0 ? (
                <IslandCard
                    accent="teal"
                    className={`${layout.span12} ${layout.cardPad}`}
                >
                    <Eyebrow
                        icon={Award}
                        help={t("credit_portfolio_health.top_customers_help", {
                            ...ns,
                            defaultValue:
                                "Top 10 by mean daily open AR in the range. Bars show mean daily effective utilization %.",
                        })}
                    >
                        {t("credit_portfolio_health.top_customers_title", {
                            ...ns,
                            defaultValue: "Coverage — 10 largest customers",
                        })}
                    </Eyebrow>
                    <div
                        style={{
                            width: "100%",
                            height: topChartHeight,
                            // Keep Recharts geometry LTR so Y ticks don't bleed into bars under page RTL.
                            direction: "ltr",
                        }}
                    >
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                layout="vertical"
                                data={topCustomersChartData}
                                margin={{ left: 8, right: 48, top: 4, bottom: 4 }}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 6"
                                    stroke={CPH.border}
                                    horizontal={false}
                                />
                                <XAxis
                                    type="number"
                                    domain={[0, topCustomersChartDomainMax]}
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
                                    width={TOP_CUSTOMERS_Y_AXIS_WIDTH}
                                    tickMargin={6}
                                    tick={{ fill: CPH.slate, fontSize: 11.5 }}
                                    tickFormatter={(value: string) =>
                                        truncateChartLabel(
                                            value,
                                            TOP_CUSTOMERS_Y_LABEL_MAX_CHARS,
                                            isRtl
                                        )
                                    }
                                    axisLine={false}
                                    tickLine={false}
                                    reversed={isRtl}
                                />
                                <Tooltip
                                    cursor={{ fill: CPH.surfaceMuted }}
                                    content={
                                        <ChartTooltip
                                            language={language}
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
                                            defaultValue: "Avg. utilization",
                                        }
                                    )}
                                    fill={CPH.teal}
                                    radius={[0, 6, 6, 0]}
                                    animationDuration={animDuration}
                                >
                                    {topCustomersChartData.map((row, i) => (
                                        <Cell
                                            key={`top-${i}-${row.name}`}
                                            fill={
                                                row.utilization >= 100
                                                    ? CPH.critical
                                                    : CPH.teal
                                            }
                                        />
                                    ))}
                                    <LabelList
                                        dataKey="utilization"
                                        position="right"
                                        formatter={(label) => {
                                            const value =
                                                typeof label === "number"
                                                    ? label
                                                    : Number(label);
                                            return Number.isFinite(value)
                                                ? formatPct(value, language, 0)
                                                : "";
                                        }}
                                        style={{
                                            fill: CPH.slate,
                                            fontSize: 11,
                                            fontVariantNumeric: "tabular-nums",
                                        }}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </IslandCard>
            ) : null}

            <IslandCard
                accent="critical"
                className={`${layout.span12} ${layout.cardPad}`}
            >
                <Eyebrow
                    icon={Users}
                    tone={CPH.critical}
                    help={t("credit_portfolio_health.overshoot_ranking_help", {
                        ...ns,
                        defaultValue:
                            "Customers ranked by average utilization above 100%. Click a row to open the customer; export opens the full sortable report.",
                    })}
                >
                    {t("credit_portfolio_health.overshoot_ranking_title", {
                        ...ns,
                        defaultValue: "Customers above 100% utilization",
                    })}
                </Eyebrow>
                {rankingPreview.length === 0 ? (
                    <p className="m-0 text-sm" style={{ color: CPH.muted }}>
                        {t("credit_portfolio_health.overshoot_ranking_empty", {
                            ...ns,
                            defaultValue:
                                "No customers with effective-limit days in this range.",
                        })}
                    </p>
                ) : (
                    <div className="mt-3 overflow-x-auto">
                        <table
                            className="w-full text-sm"
                            style={{
                                borderCollapse: "collapse",
                                color: CPH.ink,
                            }}
                        >
                            <thead>
                                <tr
                                    style={{
                                        color: CPH.slate,
                                        textAlign: "start",
                                    }}
                                >
                                    <th className="pb-2 pe-3 font-medium">
                                        {t(
                                            "credit_portfolio_health.overshoot_ranking_col_customer",
                                            {
                                                ...ns,
                                                defaultValue: "Customer",
                                            }
                                        )}
                                    </th>
                                    <th className="pb-2 pe-3 font-medium">
                                        {t(
                                            "credit_portfolio_health.overshoot_ranking_col_avg",
                                            {
                                                ...ns,
                                                defaultValue: "Avg overshoot",
                                            }
                                        )}
                                    </th>
                                    <th className="pb-2 pe-3 font-medium">
                                        {t(
                                            "credit_portfolio_health.overshoot_ranking_col_peak",
                                            {
                                                ...ns,
                                                defaultValue: "Peak usage",
                                            }
                                        )}
                                    </th>
                                    <th className="pb-2 pe-3 font-medium">
                                        {t(
                                            "credit_portfolio_health.overshoot_ranking_col_days_above",
                                            {
                                                ...ns,
                                                defaultValue:
                                                    "Days above limit",
                                            }
                                        )}
                                    </th>
                                    <th className="pb-2 font-medium">
                                        {t(
                                            "credit_portfolio_health.overshoot_ranking_col_longest",
                                            {
                                                ...ns,
                                                defaultValue:
                                                    "Longest above limit",
                                            }
                                        )}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {rankingPreview.map((row) => (
                                    <tr
                                        key={row.customerId}
                                        className="cursor-pointer"
                                        style={{
                                            borderTop: `1px solid ${CPH.border}`,
                                        }}
                                        onClick={() =>
                                            router.push(
                                                `/${locale}/app/customers/${row.customerId}`
                                            )
                                        }
                                    >
                                        <td className="py-2 pe-3">
                                            {row.customerName}
                                        </td>
                                        <td className="py-2 pe-3">
                                            +
                                            {formatPct(
                                                row.avgOvershootPts,
                                                language
                                            )}
                                        </td>
                                        <td className="py-2 pe-3">
                                            {row.peakUsagePct == null
                                                ? "—"
                                                : formatPct(
                                                      row.peakUsagePct,
                                                      language
                                                  )}
                                        </td>
                                        <td className="py-2 pe-3">
                                            {row.daysAboveLimit ?? 0}
                                        </td>
                                        <td className="py-2">
                                            {row.longestAboveLimitDays ?? 0}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button
                            type="button"
                            className="mt-3 text-xs underline"
                            style={{
                                color: CPH.teal,
                                background: "none",
                                border: 0,
                                cursor: "pointer",
                                padding: 0,
                            }}
                            onClick={openOvershootReport}
                        >
                            {t(
                                "credit_portfolio_health.kpi_overshoot_open_report",
                                {
                                    ...ns,
                                    defaultValue:
                                        "Open overshoot ranking report",
                                }
                            )}
                        </button>
                    </div>
                )}
            </IslandCard>
        </div>
    );
}
