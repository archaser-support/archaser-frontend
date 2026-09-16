"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
    AlertTriangle,
    CalendarClock,
    TrendingDown,
    TrendingUp,
} from "lucide-react";

import type {
    PortfolioHealthSection,
    PortfolioOverLimitGapSection,
    PortfolioStaleSlopeVolatilitySection,
} from "@/types/creditInsurance";
import {
    formatDateForDisplay,
    getUserDateLocale,
    getUserTimezone,
} from "@/utils/datetimeOperations";

import { BigNumber } from "./BigNumber";
import { CoverageHalo } from "./CoverageHalo";
import { Eyebrow } from "./Eyebrow";
import { IslandCard } from "./IslandCard";
import { PortfolioHealthDailyChart } from "./PortfolioHealthDailyChart";
import { PortfolioHealthMonthlyChart } from "./PortfolioHealthMonthlyChart";
import { CPH } from "./designTokens";
import layout from "./islandLayout.module.css";
import {
    PORTFOLIO_HEALTH_BELOW_THRESHOLD_MAX,
    PORTFOLIO_HEALTH_BELOW_THRESHOLD_MIN,
} from "./portfolioHealthBelowThreshold";
import { usePortfolioHealthBelowThreshold } from "./usePortfolioHealthBelowThreshold";

export type PortfolioHealthSectionViewProps = {
    section: PortfolioHealthSection;
    fromYmd: string;
    toYmd: string;
    accountCurrency: string;
    policyId?: number | null;
    includeNoPolicyExposure?: boolean;
    businessUnitId?: number | null;
};

function formatYmdForDisplay(
    ymd: string | null,
    dateLocale: string,
    timezone: string
): string | null {
    if (!ymd) {
        return null;
    }
    const date = new Date(`${ymd}T12:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
        return ymd;
    }
    return formatDateForDisplay(date, "date", dateLocale, timezone);
}

function emptyOverLimitGap(
    accountCurrency: string
): PortfolioOverLimitGapSection {
    return {
        customersWithData: 0,
        longestStreakDays: 0,
        longestStreakStart: null,
        longestStreakEnd: null,
        longestStreakCustomerId: null,
        longestStreakCustomerName: null,
        accountCurrency,
    };
}

function emptyStaleSlopeVolatility(
    accountCurrency: string
): PortfolioStaleSlopeVolatilitySection {
    return {
        staleCarriedForwardDayCount: 0,
        customersWithStaleDays: 0,
        customersWithExtremeMoves: 0,
        customersWithData: 0,
        portfolioHealthSlope: null,
        portfolioHealthClassification: null,
        portfolioHealthSlopeSuppressed: true,
        portfolioHealthDaysUsed: 0,
        portfolioPeakHealth: null,
        portfolioPeakDate: null,
        portfolioCurrentHealth: null,
        portfolioCurrentDate: null,
        avgCustomerArSigmaPct: null,
        accountCurrency,
    };
}

export function PortfolioHealthSectionView({
    section,
    fromYmd,
    toYmd,
    accountCurrency,
}: PortfolioHealthSectionViewProps) {
    const { t, i18n } = useTranslation(["dashboard"]);
    const { data: session } = useSession();
    const router = useRouter();
    const params = useParams();
    const routeLocale =
        typeof params?.locale === "string" ? params.locale : "en";
    const language = i18n.language;
    const ns = { ns: "dashboard" as const };

    const dateLocale = useMemo(() => {
        const fallback = language?.startsWith("he") ? "he-IL" : "en-US";
        return getUserDateLocale(session, fallback);
    }, [language, session]);
    const timezone = useMemo(() => getUserTimezone(session), [session]);

    const startLabel = formatYmdForDisplay(
        section.seriesA.lowestHealthStreakStart,
        dateLocale,
        timezone
    );
    const endLabel = formatYmdForDisplay(
        section.seriesA.lowestHealthStreakEnd,
        dateLocale,
        timezone
    );

    const troughSub =
        startLabel && endLabel
            ? t("credit_portfolio_health.kpi_lowest_health_streak_window", {
                  ...ns,
                  defaultValue:
                      "Longest trough: {{days}} days ({{start}} – {{end}})",
                  days: section.seriesA.lowestHealthStreakDays,
                  start: startLabel,
                  end: endLabel,
              })
            : t("credit_portfolio_health.kpi_lowest_health_streak", {
                  ...ns,
                  defaultValue: "Longest streak at trough: {{days}} days",
                  days: section.seriesA.lowestHealthStreakDays,
              });

    const { thresholdPct, setThresholdPct, pctDaysBelow } =
        usePortfolioHealthBelowThreshold(section.dailyA);

    const overLimitGap =
        section.overLimitGap ?? emptyOverLimitGap(accountCurrency);
    const slopeVol =
        section.staleSlopeVolatility ??
        emptyStaleSlopeVolatility(accountCurrency);

    const overLimitStreakStart = formatYmdForDisplay(
        overLimitGap.longestStreakStart,
        dateLocale,
        timezone
    );
    const overLimitStreakEnd = formatYmdForDisplay(
        overLimitGap.longestStreakEnd,
        dateLocale,
        timezone
    );

    const openLongestStreakCustomer = () => {
        if (overLimitGap.longestStreakCustomerId == null) {
            return;
        }
        router.push(
            `/${routeLocale}/app/customers/${overLimitGap.longestStreakCustomerId}`
        );
    };

    const overLimitStreakLabel =
        overLimitGap.longestStreakDays > 0 &&
        overLimitGap.longestStreakCustomerName &&
        overLimitStreakStart &&
        overLimitStreakEnd
            ? t(
                  "credit_portfolio_health.kpi_longest_over_limit_streak_label",
                  {
                      ...ns,
                      defaultValue:
                          "{{name}} · {{days}} days ({{start}} – {{end}})",
                      name: overLimitGap.longestStreakCustomerName,
                      days: overLimitGap.longestStreakDays,
                      start: overLimitStreakStart,
                      end: overLimitStreakEnd,
                  }
              )
            : overLimitGap.longestStreakDays > 0
              ? t(
                    "credit_portfolio_health.kpi_longest_over_limit_streak_label_days",
                    {
                        ...ns,
                        defaultValue: "{{days}} days",
                        days: overLimitGap.longestStreakDays,
                    }
                )
              : t("credit_portfolio_health.kpi_longest_over_limit_streak_none", {
                    ...ns,
                    defaultValue: "No over-limit streak in range",
                });

    const averageHealthHelpBase = t(
        "credit_portfolio_health.kpi_average_health_help",
        {
            ...ns,
            defaultValue:
                "Mean of daily portfolio health (compliant ÷ total AR × 100) over available days in the range.",
        }
    );
    const peakCurrentLabel =
        slopeVol.portfolioPeakHealth != null &&
        slopeVol.portfolioPeakDate &&
        slopeVol.portfolioCurrentHealth != null
            ? t("credit_portfolio_health.kpi_health_peak_current", {
                  ...ns,
                  defaultValue:
                      "Peaked at {{peak}}% on {{date}}, now {{current}}%",
                  peak: slopeVol.portfolioPeakHealth.toFixed(1),
                  date:
                      formatYmdForDisplay(
                          slopeVol.portfolioPeakDate,
                          dateLocale,
                          timezone
                      ) ?? slopeVol.portfolioPeakDate,
                  current: slopeVol.portfolioCurrentHealth.toFixed(1),
              })
            : null;
    const averageHealthHelp = peakCurrentLabel
        ? `${averageHealthHelpBase}\n\n${peakCurrentLabel}`
        : averageHealthHelpBase;

    const momentumSlopeTitle =
        slopeVol.portfolioHealthSlope != null
            ? t("credit_portfolio_health.kpi_health_momentum_slope", {
                  ...ns,
                  defaultValue: "Slope {{slope}} pts/day",
                  slope: slopeVol.portfolioHealthSlope.toFixed(3),
              })
            : undefined;
    const momentumInsufficient =
        slopeVol.portfolioHealthSlopeSuppressed ||
        slopeVol.portfolioHealthClassification == null;
    const momentumColor = momentumInsufficient
        ? CPH.slate
        : slopeVol.portfolioHealthClassification === "improving"
          ? CPH.teal
          : slopeVol.portfolioHealthClassification === "deteriorating"
            ? CPH.critical
            : CPH.slate;
    const momentumStatus = momentumInsufficient ? (
        t("credit_portfolio_health.kpi_health_momentum_insufficient", {
            ...ns,
            defaultValue: "Insufficient days for trend",
        })
    ) : (
        <>
            {slopeVol.portfolioHealthClassification === "improving" ? (
                <TrendingUp
                    size={12}
                    style={{
                        verticalAlign: "middle",
                        marginInlineEnd: 3,
                    }}
                />
            ) : slopeVol.portfolioHealthClassification === "deteriorating" ? (
                <TrendingDown
                    size={12}
                    style={{
                        verticalAlign: "middle",
                        marginInlineEnd: 3,
                    }}
                />
            ) : null}
            {t(
                `credit_portfolio_health.kpi_health_momentum_${slopeVol.portfolioHealthClassification}`,
                {
                    ...ns,
                    defaultValue: slopeVol.portfolioHealthClassification,
                }
            )}
        </>
    );

    return (
        <div className={layout.grid12}>
            <IslandCard
                accent="teal"
                className={`${layout.span12} ${layout.lgSpan4} ${layout.haloCard}`}
            >
                <Eyebrow centered help={averageHealthHelp}>
                    {t("credit_portfolio_health.kpi_average_health", {
                        ...ns,
                        defaultValue: "Average portfolio health",
                    })}
                </Eyebrow>
                <CoverageHalo
                    valuePct={section.seriesA.averageHealthPct}
                    label={t("credit_portfolio_health.coverage_halo_avg_label", {
                        ...ns,
                        defaultValue: "Avg. Health",
                    })}
                    locale={language}
                    status={momentumStatus}
                    statusColor={momentumColor}
                    statusTitle={momentumSlopeTitle}
                />
            </IslandCard>

            <IslandCard
                accent="violet"
                className={`${layout.span12} ${layout.smSpan6} ${layout.lgSpan4} ${layout.cardPad}`}
            >
                <Eyebrow
                    icon={TrendingDown}
                    tone={CPH.violet}
                    help={t("credit_portfolio_health.kpi_lowest_health_help", {
                        ...ns,
                        defaultValue:
                            "Minimum daily health in the range, and the longest consecutive streak at that exact value.",
                    })}
                >
                    {t("credit_portfolio_health.kpi_lowest_health", {
                        ...ns,
                        defaultValue: "Lowest health",
                    })}
                </Eyebrow>
                <BigNumber
                    value={section.seriesA.lowestHealthPct}
                    suffix="%"
                    label={troughSub}
                    color={CPH.violet}
                    locale={language}
                />
            </IslandCard>

            <IslandCard
                accent="critical"
                className={`${layout.span12} ${layout.smSpan6} ${layout.lgSpan4} ${layout.cardPad}`}
            >
                <Eyebrow
                    icon={AlertTriangle}
                    tone={CPH.critical}
                    help={t("credit_portfolio_health.kpi_pct_below_85_help", {
                        ...ns,
                        defaultValue:
                            "Share of available days where portfolio health was below {{pct}}%. Missing days are excluded from the denominator.",
                        pct: thresholdPct,
                    })}
                >
                    {t("credit_portfolio_health.kpi_pct_below_85", {
                        ...ns,
                        defaultValue: "Below {{pct}}%",
                        pct: thresholdPct,
                    })}
                </Eyebrow>
                <BigNumber
                    value={pctDaysBelow}
                    suffix="%"
                    label={t(
                        "credit_portfolio_health.kpi_pct_below_85_label",
                        {
                            ...ns,
                            defaultValue:
                                "Of time spent below {{pct}}% health",
                            pct: thresholdPct,
                        }
                    )}
                    color={CPH.critical}
                    locale={language}
                />
                <div className={layout.thresholdSlider}>
                    <label
                        className={layout.thresholdSliderLabel}
                        htmlFor="cph-below-threshold-slider"
                    >
                        {t("credit_portfolio_health.kpi_threshold_slider", {
                            ...ns,
                            defaultValue: "Threshold {{pct}}%",
                            pct: thresholdPct,
                        })}
                    </label>
                    <input
                        id="cph-below-threshold-slider"
                        className={layout.thresholdRange}
                        type="range"
                        min={PORTFOLIO_HEALTH_BELOW_THRESHOLD_MIN}
                        max={PORTFOLIO_HEALTH_BELOW_THRESHOLD_MAX}
                        step={1}
                        value={thresholdPct}
                        aria-valuemin={PORTFOLIO_HEALTH_BELOW_THRESHOLD_MIN}
                        aria-valuemax={PORTFOLIO_HEALTH_BELOW_THRESHOLD_MAX}
                        aria-valuenow={thresholdPct}
                        aria-label={t(
                            "credit_portfolio_health.kpi_threshold_slider_aria",
                            {
                                ...ns,
                                defaultValue:
                                    "Portfolio health below-threshold cut-off",
                            }
                        )}
                        onChange={(event) => {
                            setThresholdPct(Number(event.target.value));
                        }}
                    />
                </div>
            </IslandCard>

            <IslandCard
                accent="critical"
                className={`${layout.span12} ${layout.smSpan6} ${layout.lgSpan4} ${layout.cardPad}`}
            >
                <Eyebrow
                    icon={CalendarClock}
                    tone={CPH.critical}
                    help={t(
                        "credit_portfolio_health.kpi_longest_over_limit_streak_help",
                        {
                            ...ns,
                            defaultValue:
                                "Longest consecutive available-day streak with capacity gap > 0.",
                        }
                    )}
                >
                    {t(
                        "credit_portfolio_health.kpi_longest_over_limit_streak",
                        {
                            ...ns,
                            defaultValue: "Longest over-limit streak",
                        }
                    )}
                </Eyebrow>
                <BigNumber
                    value={overLimitGap.longestStreakDays}
                    suffix=""
                    decimals={0}
                    label={overLimitStreakLabel}
                    color={CPH.critical}
                    locale={language}
                />
                {overLimitGap.longestStreakCustomerId != null ? (
                    <button
                        type="button"
                        onClick={openLongestStreakCustomer}
                        style={{
                            marginTop: 8,
                            padding: 0,
                            border: "none",
                            background: "none",
                            color: CPH.critical,
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: "pointer",
                            textAlign: "inherit",
                        }}
                    >
                        {overLimitGap.longestStreakCustomerName}
                    </button>
                ) : null}
            </IslandCard>

            <div className={layout.span12}>
                <PortfolioHealthDailyChart
                    daily={section.dailyA}
                    averageHealthPct={section.seriesA.averageHealthPct}
                    belowThresholdPct={thresholdPct}
                    fromYmd={fromYmd}
                    toYmd={toYmd}
                />
            </div>

            <div className={layout.span12}>
                <PortfolioHealthMonthlyChart
                    monthly={section.monthlyA}
                    fromYmd={fromYmd}
                    toYmd={toYmd}
                    accountCurrency={accountCurrency}
                />
            </div>
        </div>
    );
}
