"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";

import type {
    PortfolioHealthTopNOption,
    PortfolioTopCustomerCreditProtectionSection,
} from "@/types/creditInsurance";
import {
    PORTFOLIO_HEALTH_TOP_N_DEFAULT,
    PORTFOLIO_HEALTH_TOP_N_OPTIONS,
} from "@/types/creditInsurance";

import { BigNumber } from "./BigNumber";
import { CoverageHalo } from "./CoverageHalo";
import { Eyebrow } from "./Eyebrow";
import { IslandCard } from "./IslandCard";
import { CPH } from "./designTokens";
import { portfolioMoneyAffixes } from "./formatPortfolioMoney";
import layout from "./islandLayout.module.css";

export type TopCustomerCreditProtectionCardProps = {
    section: PortfolioTopCustomerCreditProtectionSection | null | undefined;
    accountCurrency: string;
};

function emptyCohort(n: PortfolioHealthTopNOption) {
    return {
        nRequested: n,
        nActual: 0,
        creditProtectionLevel: 100,
        totalReceivables: 0,
        totalReceivablesSharePct: 0,
        compliantExposure: 0,
        compliantExposureSharePct: 0,
        atRiskExposure: 0,
        atRiskExposureSharePct: 0,
    };
}

function emptyTopNSection(): PortfolioTopCustomerCreditProtectionSection {
    return {
        defaultN: PORTFOLIO_HEALTH_TOP_N_DEFAULT,
        options: PORTFOLIO_HEALTH_TOP_N_OPTIONS,
        cohorts: {
            5: emptyCohort(5),
            10: emptyCohort(10),
            20: emptyCohort(20),
        },
    };
}

function isTopNOption(value: number): value is PortfolioHealthTopNOption {
    return (PORTFOLIO_HEALTH_TOP_N_OPTIONS as readonly number[]).includes(
        value
    );
}

export function TopCustomerCreditProtectionCard({
    section,
    accountCurrency,
}: TopCustomerCreditProtectionCardProps) {
    const { t, i18n } = useTranslation(["dashboard"]);
    const language = i18n.language;
    const ns = { ns: "dashboard" as const };
    const currency = accountCurrency || "USD";

    const topN = section ?? emptyTopNSection();
    const options = topN.options?.length
        ? topN.options
        : PORTFOLIO_HEALTH_TOP_N_OPTIONS;
    const defaultN = isTopNOption(topN.defaultN)
        ? topN.defaultN
        : PORTFOLIO_HEALTH_TOP_N_DEFAULT;

    const [selectedN, setSelectedN] =
        useState<PortfolioHealthTopNOption>(defaultN);

    const safeSelectedN = isTopNOption(selectedN) ? selectedN : defaultN;
    const sliderIndex = Math.max(0, options.indexOf(safeSelectedN));
    const cohort =
        topN.cohorts[safeSelectedN] ?? emptyCohort(safeSelectedN);

    const moneyAffixes = useMemo(
        () => portfolioMoneyAffixes(currency, language),
        [currency, language]
    );

    const shareLabel = (pct: number) =>
        t("credit_portfolio_health.kpi_top_n_share_of_portfolio", {
            ...ns,
            defaultValue: "{{pct}}% of portfolio",
            pct: pct.toFixed(1),
        });

    const titleN = String(safeSelectedN);
    const titleText = t(
        "credit_portfolio_health.kpi_top_n_credit_protection",
        {
            ...ns,
            defaultValue: "Top {{n}} Credit Protection Level",
            n: titleN,
        }
    );
    const titleNIndex = titleText.indexOf(titleN);
    const titleNode =
        titleNIndex >= 0 ? (
            <>
                {titleText.slice(0, titleNIndex)}
                <strong
                    style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: CPH.ink,
                    }}
                >
                    {titleN}
                </strong>
                {titleText.slice(titleNIndex + titleN.length)}
            </>
        ) : (
            titleText
        );

    return (
        <IslandCard
            accent="teal"
            className={`${layout.span12} ${layout.smSpan6} ${layout.mdSpan8} ${layout.cardPad}`}
        >
            <Eyebrow
                icon={Users}
                tone={CPH.teal}
                help={t(
                    "credit_portfolio_health.kpi_top_n_credit_protection_help",
                    {
                        ...ns,
                        defaultValue:
                            "Credit Protection Level and exposure shares for the largest customers by mean daily open AR in the range. Switch Top 5 / 10 / 20 without reloading.",
                    }
                )}
                trailing={
                    <div
                        className={layout.thresholdSlider}
                        style={{ marginTop: 0 }}
                    >
                        <input
                            id="cph-top-n-slider"
                            className={layout.thresholdRange}
                            type="range"
                            min={0}
                            max={Math.max(0, options.length - 1)}
                            step={1}
                            value={sliderIndex}
                            aria-valuemin={0}
                            aria-valuemax={Math.max(0, options.length - 1)}
                            aria-valuenow={sliderIndex}
                            aria-valuetext={t(
                                "credit_portfolio_health.kpi_top_n_slider",
                                {
                                    ...ns,
                                    defaultValue: "Top {{n}}",
                                    n: safeSelectedN,
                                }
                            )}
                            aria-label={t(
                                "credit_portfolio_health.kpi_top_n_slider_aria",
                                {
                                    ...ns,
                                    defaultValue:
                                        "Top customers cohort size for Credit Protection Level",
                                }
                            )}
                            onChange={(event) => {
                                const next =
                                    options[Number(event.target.value)];
                                if (next != null && isTopNOption(next)) {
                                    setSelectedN(next);
                                }
                            }}
                            style={{
                                background: CPH.tealTint,
                            }}
                        />
                    </div>
                }
            >
                {titleNode}
            </Eyebrow>

            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 24,
                    marginTop: 8,
                }}
            >
                <CoverageHalo
                    valuePct={cohort.creditProtectionLevel}
                    label={t(
                        "credit_portfolio_health.kpi_top_n_gauge_label",
                        {
                            ...ns,
                            defaultValue: "Credit Protection Level",
                        }
                    )}
                    locale={language}
                    size={128}
                />

                <div
                    style={{
                        flex: "1 1 280px",
                        display: "grid",
                        gridTemplateColumns:
                            "repeat(auto-fit, minmax(140px, 1fr))",
                        gap: 16,
                        minWidth: 0,
                    }}
                >
                    <BigNumber
                        value={cohort.totalReceivables}
                        decimals={0}
                        prefix={moneyAffixes.prefix}
                        suffix={moneyAffixes.suffix}
                        label={t(
                            "credit_portfolio_health.kpi_top_n_total_receivables",
                            {
                                ...ns,
                                defaultValue: "Total Receivable",
                            }
                        )}
                        sub={shareLabel(cohort.totalReceivablesSharePct)}
                        color={CPH.ink}
                        locale={language}
                    />
                    <BigNumber
                        value={cohort.compliantExposure}
                        decimals={0}
                        prefix={moneyAffixes.prefix}
                        suffix={moneyAffixes.suffix}
                        label={t(
                            "credit_portfolio_health.kpi_top_n_compliant_exposure",
                            {
                                ...ns,
                                defaultValue: "Compliant Exposure",
                            }
                        )}
                        sub={shareLabel(cohort.compliantExposureSharePct)}
                        color={CPH.teal}
                        locale={language}
                    />
                    <BigNumber
                        value={cohort.atRiskExposure}
                        decimals={0}
                        prefix={moneyAffixes.prefix}
                        suffix={moneyAffixes.suffix}
                        label={t(
                            "credit_portfolio_health.kpi_top_n_at_risk_exposure",
                            {
                                ...ns,
                                defaultValue: "At-Risk Exposure",
                            }
                        )}
                        sub={shareLabel(cohort.atRiskExposureSharePct)}
                        color={CPH.critical}
                        locale={language}
                    />
                </div>
            </div>
        </IslandCard>
    );
}
