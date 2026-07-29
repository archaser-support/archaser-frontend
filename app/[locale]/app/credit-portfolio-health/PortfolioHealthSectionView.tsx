"use client";

import { useSession } from "next-auth/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, TrendingDown } from "lucide-react";

import type { PortfolioHealthSection } from "@/types/creditInsurance";
import {
    formatDateForDisplay,
    getUserDateLocale,
    getUserTimezone,
} from "@/utils/datetimeOperations";

import { BigNumber } from "./BigNumber";
import { CoverageHalo } from "./CoverageHalo";
import { Eyebrow } from "./Eyebrow";
import { IslandCard } from "./IslandCard";
import { PortfolioHealthMonthlyChart } from "./PortfolioHealthMonthlyChart";
import { StatNumber } from "./StatNumber";
import { CPH } from "./designTokens";
import { SPACE_GROTESK_FONT_FAMILY } from "./fontTokens";
import layout from "./islandLayout.module.css";

export type PortfolioHealthSectionViewProps = {
    section: PortfolioHealthSection;
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

export function PortfolioHealthSectionView({
    section,
}: PortfolioHealthSectionViewProps) {
    const { t, i18n } = useTranslation(["dashboard"]);
    const { data: session } = useSession();
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
                      "Longest trough: {{days}} days ({{start}} â€“ {{end}})",
                  days: section.seriesA.lowestHealthStreakDays,
                  start: startLabel,
                  end: endLabel,
              })
            : t("credit_portfolio_health.kpi_lowest_health_streak", {
                  ...ns,
                  defaultValue: "Longest streak at trough: {{days}} days",
                  days: section.seriesA.lowestHealthStreakDays,
              });

    return (
        <div className={layout.grid12}>
            <IslandCard
                accent="jade"
                className={`${layout.span12} ${layout.lgSpan4} ${layout.haloCard}`}
            >
                <CoverageHalo
                    valuePct={section.seriesA.averageHealthPct}
                    label={t("credit_portfolio_health.coverage_halo_avg_label", {
                        ...ns,
                        defaultValue: "Avg. Health",
                    })}
                    locale={language}
                />
                <div className={layout.miniRow}>
                    <div
                        className={layout.miniTile}
                        style={{ backgroundColor: CPH.surfaceMuted }}
                    >
                        <div
                            style={{
                                color: CPH.jade,
                                fontFamily: SPACE_GROTESK_FONT_FAMILY,
                                fontSize: 18,
                                fontWeight: 600,
                            }}
                        >
                            <StatNumber
                                value={section.seriesA.averageHealthPct}
                                suffix="%"
                                locale={language}
                                color={CPH.jade}
                            />
                        </div>
                        <div
                            style={{
                                marginTop: 2,
                                fontSize: 11,
                                color: CPH.slate,
                            }}
                        >
                            {t("credit_portfolio_health.series_a_short", {
                                ...ns,
                                defaultValue: "Health A",
                            })}
                        </div>
                    </div>
                    <div
                        className={layout.miniTile}
                        style={{ backgroundColor: CPH.surfaceMuted }}
                    >
                        <div
                            style={{
                                color: CPH.ink,
                                fontFamily: SPACE_GROTESK_FONT_FAMILY,
                                fontSize: 18,
                                fontWeight: 600,
                            }}
                        >
                            <StatNumber
                                value={section.seriesB.averageHealthPct}
                                suffix="%"
                                locale={language}
                            />
                        </div>
                        <div
                            style={{
                                marginTop: 2,
                                fontSize: 11,
                                color: CPH.slate,
                            }}
                        >
                            {t("credit_portfolio_health.series_b_short", {
                                ...ns,
                                defaultValue: "Health B",
                            })}
                        </div>
                    </div>
                </div>
            </IslandCard>

            <IslandCard
                accent="copper"
                className={`${layout.span12} ${layout.smSpan6} ${layout.lgSpan4} ${layout.cardPad}`}
            >
                <Eyebrow
                    icon={TrendingDown}
                    tone={CPH.copper}
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
                    color={CPH.copper}
                    locale={language}
                    sub={t("credit_portfolio_health.series_a_short", {
                        ...ns,
                        defaultValue: "Health A",
                    })}
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
                            "Share of available days where portfolio health was below 85%.",
                    })}
                >
                    {t("credit_portfolio_health.kpi_pct_below_85", {
                        ...ns,
                        defaultValue: "% of days below 85%",
                    })}
                </Eyebrow>
                <BigNumber
                    value={section.seriesA.pctDaysBelow85}
                    suffix="%"
                    label={t(
                        "credit_portfolio_health.kpi_pct_below_85_label",
                        {
                            ...ns,
                            defaultValue: "Of time spent below 85% health",
                        }
                    )}
                    color={CPH.critical}
                    locale={language}
                    sub={t("credit_portfolio_health.series_b_below_note", {
                        ...ns,
                        defaultValue: "Health B: {{pct}}%",
                        pct: Number(section.seriesB.pctDaysBelow85.toFixed(1)),
                    })}
                />
            </IslandCard>

            <div className={layout.span12}>
                <PortfolioHealthMonthlyChart
                    monthlyA={section.monthlyA}
                    monthlyB={section.monthlyB}
                />
            </div>
        </div>
    );
}
