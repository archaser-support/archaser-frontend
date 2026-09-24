"use client";

import { Box, LinearProgress, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import {
    BadgePercent,
    FileText,
    Landmark,
    Percent,
    Scale,
    Shield,
} from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { CreditDashboardPolicyItem } from "@/app/[locale]/app/credit-dashboard/CreditDashboardPolicySelect";
import {
    claimCustomerDisplayName,
    getPolicyExcessSummary,
    type RemainingExcessYear,
} from "@/shared/services/claimsService";
import { apiFetch } from "@/utils/apiFetch";

import { CPH } from "./designTokens";
import { Eyebrow } from "./Eyebrow";
import { SPACE_GROTESK_FONT_FAMILY } from "./fontTokens";
import { formatPortfolioMoney } from "./formatPortfolioMoney";
import { IslandCard } from "./IslandCard";
import layout from "./islandLayout.module.css";
import {
    countryRowCount,
    dclSdlCoverAmount,
    formatPolicyDate,
    namedRowCount,
    showPolicySummaryCommercialTerms,
    toFiniteNumber,
    type PolicySummaryDetail,
} from "./policySummaryModel";

export type PolicySummarySectionViewProps = {
    policies: CreditDashboardPolicyItem[];
    policyId: number | null;
    onSelectPolicy: (id: number) => void;
};

function dash(t: (key: string, opts: Record<string, unknown>) => string): string {
    return t("credit_insurance_dashboard.em_dash", {
        ns: "dashboard",
        defaultValue: "—",
    });
}

function formatDays(
    value: number | null | undefined,
    t: (key: string, opts: Record<string, unknown>) => string
): string {
    if (value == null) {
        return dash(t);
    }
    return t("credit_portfolio_health.policy_summary_days", {
        ns: "dashboard",
        defaultValue: "{{days}} days",
        days: value,
    });
}

function formatPercent(
    value: number | null,
    language: string,
    empty: string
): string {
    if (value == null) {
        return empty;
    }
    const locale = language.startsWith("he") ? "he-IL" : "en-US";
    return `${value.toLocaleString(locale, {
        maximumFractionDigits: 3,
    })}%`;
}

function statusLabel(
    status: string | null | undefined,
    t: (key: string, opts: Record<string, unknown>) => string
): string {
    const key =
        status === "Active"
            ? "credit_insurance.status.active"
            : status === "Inactive"
              ? "credit_insurance.status.inactive"
              : status === "Draft"
                ? "credit_insurance.status.draft"
                : null;
    if (key) {
        return t(key, { ns: "settings" });
    }
    return status?.trim() ? status : dash(t);
}

function kindLabel(
    kind: string | null | undefined,
    t: (key: string, opts: Record<string, unknown>) => string
): string {
    if (kind === "TopUp") {
        return t("credit_insurance.fields.policy_kind_top_up", {
            ns: "settings",
        });
    }
    if (kind === "Primary") {
        return t("credit_insurance.fields.policy_kind_primary", {
            ns: "settings",
        });
    }
    return kind?.trim() ? kind : dash(t);
}

function costMethodLabel(
    method: string | null | undefined,
    t: (key: string, opts: Record<string, unknown>) => string
): string | null {
    if (method === "Limit") {
        return t("credit_insurance.fields.cost_calculation_method_limit", {
            ns: "settings",
        });
    }
    if (method === "ActualSales") {
        return t(
            "credit_insurance.fields.cost_calculation_method_actual_sales",
            { ns: "settings" }
        );
    }
    return null;
}

function productTypeLabel(
    productType: string | null | undefined,
    t: (key: string, opts: Record<string, unknown>) => string
): string | null {
    if (productType === "TailorMade") {
        return t("credit_insurance.fields.product_type_tailor_made", {
            ns: "settings",
        });
    }
    if (productType === "Commodity") {
        return t("credit_insurance.fields.product_type_commodity", {
            ns: "settings",
        });
    }
    return productType?.trim() ? productType : null;
}

function policyLabel(
    policy: { id: number; policy_number?: string | null },
    t: (key: string, opts: Record<string, unknown>) => string
): string {
    const number = policy.policy_number?.trim();
    if (number) {
        return number;
    }
    return t("credit_insurance_dashboard.policy_number_fallback", {
        ns: "dashboard",
        defaultValue: "Policy {{id}}",
        id: policy.id,
    });
}

function formatMoneyOrDash(
    value: number | null | undefined,
    currency: string,
    language: string,
    empty: string
): string {
    if (value == null || !Number.isFinite(value)) {
        return empty;
    }
    return formatPortfolioMoney(value, currency, language);
}

function yearWindowLabel(
    year: RemainingExcessYear,
    language: string
): string {
    const start = formatPolicyDate(
        typeof year.policy_year_start === "string"
            ? year.policy_year_start
            : year.policy_year_start.toISOString(),
        language
    );
    const end = formatPolicyDate(
        typeof year.policy_year_end === "string"
            ? year.policy_year_end
            : year.policy_year_end.toISOString(),
        language
    );
    if (start && end) {
        return `${start} – ${end}`;
    }
    return start || end || "";
}

function claimStatusLabel(
    status: string,
    t: (key: string, opts: Record<string, unknown>) => string
): string {
    return t(`statuses.${status}`, {
        ns: "claims",
        defaultValue: status.replace(/_/g, " "),
    });
}

async function fetchPolicySummary(
    policyId: number
): Promise<PolicySummaryDetail> {
    const res = await apiFetch(
        `/api/entities/insurance-policies/${policyId}`
    );
    if (!res.ok) {
        throw new Error("policy_summary_load_failed");
    }
    return (await res.json()) as PolicySummaryDetail;
}

export function PolicySummarySectionView({
    policies,
    policyId,
    onSelectPolicy,
}: PolicySummarySectionViewProps) {
    const { t, i18n } = useTranslation(["dashboard", "settings", "claims"]);
    const language = i18n.language;
    const ns = { ns: "dashboard" as const };
    const empty = dash(t);

    const effectivePolicyId = useMemo(() => {
        if (policyId != null) {
            return policyId;
        }
        if (policies.length === 1) {
            return policies[0]!.id;
        }
        return null;
    }, [policyId, policies]);

    const showCards =
        effectivePolicyId == null && policies.length > 1;

    const detailQuery = useQuery({
        queryKey: ["credit-insurance", "policy-summary", effectivePolicyId],
        queryFn: () => fetchPolicySummary(effectivePolicyId!),
        enabled: effectivePolicyId != null,
        staleTime: 60_000,
    });

    const showClaimsExcess =
        detailQuery.data != null &&
        showPolicySummaryCommercialTerms(detailQuery.data);

    const excessSummaryQuery = useQuery({
        queryKey: [
            "claims",
            "policy-excess-summary",
            effectivePolicyId,
            "recent-3",
        ],
        queryFn: () =>
            getPolicyExcessSummary({
                insurance_policy_id: effectivePolicyId!,
                recent_years: 3,
                include_claims: true,
            }),
        enabled: effectivePolicyId != null && showClaimsExcess,
        staleTime: 30_000,
    });

    if (policies.length === 0) {
        return (
            <p className="m-0 text-sm" style={{ color: CPH.slate }}>
                {t("credit_portfolio_health.policy_summary_empty_no_policies", {
                    ...ns,
                    defaultValue: "No assigned policies on this account.",
                })}
            </p>
        );
    }

    if (showCards) {
        return (
            <div className={layout.grid12}>
                {policies.map((policy) => {
                    const label = policyLabel(policy, t);
                    return (
                        <button
                            key={policy.id}
                            type="button"
                            className={`${layout.span6} ${layout.mdSpan4}`}
                            onClick={() => onSelectPolicy(policy.id)}
                            aria-label={t(
                                "credit_portfolio_health.policy_summary_card_aria",
                                {
                                    ...ns,
                                    defaultValue:
                                        "Show policy summary for {{policy}}",
                                    policy: label,
                                }
                            )}
                            style={{
                                background: "none",
                                border: "none",
                                padding: 0,
                                cursor: "pointer",
                                textAlign: "inherit",
                                color: "inherit",
                                font: "inherit",
                            }}
                        >
                            <IslandCard
                                accent="teal"
                                className={layout.cardPad}
                            >
                                <Eyebrow icon={FileText}>
                                    {kindLabel(policy.policy_kind, t)}
                                </Eyebrow>
                                <div
                                    className="text-xl font-semibold tracking-tight"
                                    style={{
                                        color: CPH.ink,
                                        fontFamily: SPACE_GROTESK_FONT_FAMILY,
                                    }}
                                >
                                    {label}
                                </div>
                                <p
                                    className="m-0 mt-2 text-sm"
                                    style={{ color: CPH.slate }}
                                >
                                    {statusLabel(policy.status, t)}
                                </p>
                            </IslandCard>
                        </button>
                    );
                })}
            </div>
        );
    }

    if (detailQuery.isPending) {
        return (
            <Box sx={{ width: "100%" }}>
                <LinearProgress />
            </Box>
        );
    }

    if (detailQuery.isError || detailQuery.data == null) {
        return (
            <Typography color="error">
                {t("credit_portfolio_health.policy_summary_load_failed", {
                    ...ns,
                    defaultValue: "Could not load the policy summary.",
                })}
            </Typography>
        );
    }

    const detail = detailQuery.data;
    const currency = detail.currency?.trim() || "USD";
    const maxCover = toFiniteNumber(detail.max_total_cover);
    const dclCover = dclSdlCoverAmount(detail);
    const costPercent = toFiniteNumber(detail.cost_percent);
    const registrationFee = toFiniteNumber(detail.registration_fee_percent);
    const annualCreditAssessmentFee = toFiniteNumber(
        detail.annual_credit_assessment_fee
    );
    const method = costMethodLabel(detail.cost_calculation_method, t);
    const start = formatPolicyDate(detail.start_date, language);
    const end = formatPolicyDate(detail.end_date, language);
    const term =
        start && end
            ? `${start} – ${end}`
            : start || end || empty;

    const bullets: { key: string; text: string }[] = [
        {
            key: "status",
            text: `${t("credit_portfolio_health.policy_summary_status", {
                ...ns,
                defaultValue: "Status",
            })}: ${statusLabel(detail.status, t)}`,
        },
        {
            key: "kind",
            text: `${t("credit_portfolio_health.policy_summary_kind", {
                ...ns,
                defaultValue: "Policy type",
            })}: ${kindLabel(detail.policy_kind, t)}`,
        },
        {
            key: "number",
            text: `${t("credit_portfolio_health.policy_summary_number", {
                ...ns,
                defaultValue: "Policy number",
            })}: ${policyLabel(detail, t)}`,
        },
        {
            key: "insurer",
            text: `${t("credit_portfolio_health.policy_summary_insurer", {
                ...ns,
                defaultValue: "Insurer",
            })}: ${detail.insurer_name?.trim() || empty}`,
        },
        {
            key: "term",
            text: `${t("credit_portfolio_health.policy_summary_term", {
                ...ns,
                defaultValue: "Policy term",
            })}: ${term}`,
        },
        {
            key: "payment",
            text: `${t("credit_portfolio_health.policy_summary_payment_term", {
                ...ns,
                defaultValue: "Max payment term",
            })}: ${formatDays(detail.max_payment_term, t)}`,
        },
        {
            key: "mep",
            text: `${t("credit_portfolio_health.policy_summary_mep", {
                ...ns,
                defaultValue: "Max allowed MEP",
            })}: ${formatDays(detail.max_allowed_mep, t)}`,
        },
        {
            key: "reporting",
            text: `${t("credit_portfolio_health.policy_summary_reporting_days", {
                ...ns,
                defaultValue: "Reporting days",
            })}: ${formatDays(detail.reporting_days, t)}`,
        },
        {
            key: "countries",
            text: `${t("credit_portfolio_health.policy_summary_country_count", {
                ...ns,
                defaultValue: "Country caps",
            })}: ${t("credit_portfolio_health.policy_summary_countries_value", {
                ...ns,
                defaultValue: "{{count}} countries",
                count: countryRowCount(detail),
            })}`,
        },
        {
            key: "named",
            text: `${t("credit_portfolio_health.policy_summary_named_count", {
                ...ns,
                defaultValue: "Named customers",
            })}: ${t("credit_portfolio_health.policy_summary_named_value", {
                ...ns,
                defaultValue: "{{count}} customers",
                count: namedRowCount(detail),
            })}`,
        },
    ];

    const showCommercialTerms = showPolicySummaryCommercialTerms(detail);
    const insuredPercentage = toFiniteNumber(detail.insured_percentage);
    const nql = toFiniteNumber(detail.non_qualifying_loss_threshold);
    const minimumPremium = toFiniteNumber(detail.minimum_premium);
    const minimumPremiumYears =
        detail.minimum_premium_period_years != null &&
        Number.isFinite(detail.minimum_premium_period_years)
            ? detail.minimum_premium_period_years
            : null;
    const aggregateExcess = toFiniteNumber(detail.aggregate_excess);
    const sdlExcess = toFiniteNumber(detail.sdl_excess);
    const productType = productTypeLabel(detail.product_type, t);

    const commercialBullets: { key: string; text: string }[] = [
        {
            key: "insured_percentage",
            text: `${t(
                "credit_portfolio_health.policy_summary_insured_percentage",
                {
                    ...ns,
                    defaultValue: "Insured percentage",
                }
            )}: ${
                insuredPercentage != null
                    ? formatPercent(insuredPercentage, language, empty)
                    : empty
            }`,
        },
        {
            key: "nql",
            text: `${t("credit_portfolio_health.policy_summary_nql", {
                ...ns,
                defaultValue: "Non-qualifying loss threshold",
            })}: ${
                nql != null
                    ? formatPortfolioMoney(nql, currency, language)
                    : empty
            }`,
        },
        {
            key: "aggregate_excess",
            text: `${t(
                "credit_portfolio_health.policy_summary_aggregate_excess",
                {
                    ...ns,
                    defaultValue: "Aggregate excess",
                }
            )}: ${
                aggregateExcess != null
                    ? formatPortfolioMoney(aggregateExcess, currency, language)
                    : empty
            }`,
        },
        {
            key: "sdl_excess",
            text: `${t("credit_portfolio_health.policy_summary_sdl_excess", {
                ...ns,
                defaultValue: "SDL excess",
            })}: ${
                sdlExcess != null
                    ? formatPortfolioMoney(sdlExcess, currency, language)
                    : empty
            }`,
        },
        {
            key: "minimum_premium",
            text: (() => {
                const yearsPart =
                    minimumPremiumYears != null
                        ? t(
                              "credit_portfolio_health.policy_summary_minimum_premium_years",
                              {
                                  ...ns,
                                  defaultValue: "{{years}} years",
                                  years: minimumPremiumYears,
                              }
                          )
                        : null;
                let valueText = empty;
                if (minimumPremium != null && yearsPart) {
                    valueText = `${formatPortfolioMoney(minimumPremium, currency, language)} / ${yearsPart}`;
                } else if (minimumPremium != null) {
                    valueText = formatPortfolioMoney(
                        minimumPremium,
                        currency,
                        language
                    );
                } else if (yearsPart) {
                    valueText = yearsPart;
                }
                return `${t(
                    "credit_portfolio_health.policy_summary_minimum_premium",
                    {
                        ...ns,
                        defaultValue: "Minimum premium",
                    }
                )}: ${valueText}`;
            })(),
        },
        {
            key: "product_type",
            text: `${t(
                "credit_portfolio_health.policy_summary_product_type",
                {
                    ...ns,
                    defaultValue: "Product type",
                }
            )}: ${productType ?? empty}`,
        },
    ];

    const excessYears = excessSummaryQuery.data?.years ?? [];

    return (
        <div className={layout.stack}>
            <div className={layout.grid12}>
                <IslandCard
                    accent="teal"
                    className={`${layout.span6} ${layout.mdSpan4} ${layout.cardPad}`}
                >
                    <Eyebrow
                        icon={Landmark}
                        help={t(
                            "credit_portfolio_health.policy_summary_max_cover_help",
                            {
                                ...ns,
                                defaultValue:
                                    "Shows the policy’s maximum total cover so you know the insurer’s overall capacity ceiling for this policy.",
                            }
                        )}
                    >
                        {t("credit_portfolio_health.policy_summary_max_cover", {
                            ...ns,
                            defaultValue: "Max total cover",
                        })}
                    </Eyebrow>
                    <div
                        className="text-3xl font-semibold tracking-tight"
                        style={{
                            color: CPH.ink,
                            fontFamily: SPACE_GROTESK_FONT_FAMILY,
                        }}
                    >
                        {maxCover == null
                            ? empty
                            : formatPortfolioMoney(maxCover, currency, language)}
                    </div>
                </IslandCard>
                <IslandCard
                    accent="teal"
                    className={`${layout.span6} ${layout.mdSpan4} ${layout.cardPad}`}
                >
                    <Eyebrow
                        icon={Shield}
                        help={t(
                            "credit_portfolio_health.policy_summary_dcl_cover_help",
                            {
                                ...ns,
                                defaultValue:
                                    "Shows the max DCL/SDL cover band so you can judge discretionary-limit capacity under this policy.",
                            }
                        )}
                    >
                        {t("credit_portfolio_health.policy_summary_dcl_cover", {
                            ...ns,
                            defaultValue: "Max DCL/SDL cover",
                        })}
                    </Eyebrow>
                    <div
                        className="text-3xl font-semibold tracking-tight"
                        style={{
                            color: CPH.ink,
                            fontFamily: SPACE_GROTESK_FONT_FAMILY,
                        }}
                    >
                        {dclCover == null
                            ? empty
                            : formatPortfolioMoney(dclCover, currency, language)}
                    </div>
                </IslandCard>
                <IslandCard
                    accent="teal"
                    className={`${layout.span6} ${layout.mdSpan4} ${layout.cardPad}`}
                >
                    <Eyebrow
                        icon={BadgePercent}
                        help={t(
                            "credit_portfolio_health.policy_summary_cost_help",
                            {
                                ...ns,
                                defaultValue:
                                    "Shows the insurance fee rate (and related cost method) so you can understand premium economics for this policy.",
                            }
                        )}
                    >
                        {t("credit_portfolio_health.policy_summary_cost", {
                            ...ns,
                            defaultValue: "Insurance fee rate",
                        })}
                    </Eyebrow>
                    <div
                        className="text-3xl font-semibold tracking-tight"
                        style={{
                            color: CPH.teal,
                            fontFamily: SPACE_GROTESK_FONT_FAMILY,
                        }}
                    >
                        {formatPercent(costPercent, language, empty)}
                    </div>
                    {method ||
                    registrationFee != null ||
                    annualCreditAssessmentFee != null ? (
                        <ul
                            className="m-0 mt-2 list-disc ps-5 text-sm"
                            style={{ color: CPH.slate }}
                        >
                            {method ? (
                                <li>
                                    {t(
                                        "credit_portfolio_health.policy_summary_cost_method",
                                        {
                                            ...ns,
                                            defaultValue: "Cost method",
                                        }
                                    )}
                                    {`: ${method}`}
                                </li>
                            ) : null}
                            {registrationFee != null ? (
                                <li>
                                    {t(
                                        "credit_portfolio_health.policy_summary_registration_fee",
                                        {
                                            ...ns,
                                            defaultValue: "Registration fee",
                                        }
                                    )}
                                    {`: ${formatPercent(registrationFee, language, empty)}`}
                                </li>
                            ) : null}
                            {annualCreditAssessmentFee != null ? (
                                <li>
                                    {t(
                                        "credit_portfolio_health.policy_summary_annual_credit_assessment_fee",
                                        {
                                            ...ns,
                                            defaultValue:
                                                "Annual credit assessment fee",
                                        }
                                    )}
                                    {`: ${formatPortfolioMoney(
                                        annualCreditAssessmentFee,
                                        currency,
                                        language
                                    )}`}
                                </li>
                            ) : null}
                        </ul>
                    ) : null}
                </IslandCard>
            </div>
            <div className={layout.grid12}>
                <IslandCard
                    accent="slate"
                    className={`${
                        showCommercialTerms
                            ? `${layout.span6} ${layout.mdSpan6}`
                            : layout.span12
                    } ${layout.cardPad}`}
                >
                    <Eyebrow icon={FileText}>
                        {t("credit_portfolio_health.policy_summary_details", {
                            ...ns,
                            defaultValue: "Policy settings",
                        })}
                    </Eyebrow>
                    <ul
                        className="m-0 list-disc ps-5 text-sm"
                        style={{ color: CPH.slate }}
                    >
                        {bullets.map((item) => (
                            <li key={item.key} className="mb-1">
                                {item.text}
                            </li>
                        ))}
                    </ul>
                </IslandCard>
                {showCommercialTerms ? (
                    <IslandCard
                        accent="slate"
                        className={`${layout.span6} ${layout.mdSpan6} ${layout.cardPad}`}
                    >
                        <Eyebrow
                            icon={Percent}
                            help={t(
                                "credit_portfolio_health.policy_summary_commercial_terms_help",
                                {
                                    ...ns,
                                    defaultValue:
                                        "Shows key commercial policy terms (cover share, excesses, minimum premium, product type) for this Primary policy.",
                                }
                            )}
                        >
                            {t(
                                "credit_portfolio_health.policy_summary_commercial_terms",
                                {
                                    ...ns,
                                    defaultValue: "Commercial terms",
                                }
                            )}
                        </Eyebrow>
                        <ul
                            className="m-0 list-disc ps-5 text-sm"
                            style={{ color: CPH.slate }}
                        >
                            {commercialBullets.map((item) => (
                                <li key={item.key} className="mb-1">
                                    {item.text}
                                </li>
                            ))}
                        </ul>
                    </IslandCard>
                ) : null}
            </div>
            {showClaimsExcess ? (
                <div className={layout.grid12}>
                    <IslandCard
                        accent="slate"
                        className={`${layout.span12} ${layout.cardPad}`}
                    >
                        <Eyebrow
                            icon={Scale}
                            help={t(
                                "credit_portfolio_health.policy_summary_claims_excess_help",
                                {
                                    ...ns,
                                    defaultValue:
                                        "Shows remaining Aggregate/SDL excess (access amount) and claims for the current Primary policy year and the prior two anniversary years.",
                                }
                            )}
                        >
                            {t(
                                "credit_portfolio_health.policy_summary_claims_excess",
                                {
                                    ...ns,
                                    defaultValue:
                                        "Claims & remaining excess",
                                }
                            )}
                        </Eyebrow>
                        {excessSummaryQuery.isPending ? (
                            <Box sx={{ width: "100%", mt: 1 }}>
                                <LinearProgress />
                            </Box>
                        ) : excessSummaryQuery.isError ? (
                            <Typography color="error" variant="body2">
                                {t(
                                    "credit_portfolio_health.policy_summary_claims_excess_load_failed",
                                    {
                                        ...ns,
                                        defaultValue:
                                            "Could not load claims and remaining excess.",
                                    }
                                )}
                            </Typography>
                        ) : excessYears.length === 0 ? (
                            <p
                                className="m-0 mt-2 text-sm"
                                style={{ color: CPH.slate }}
                            >
                                {t(
                                    "credit_portfolio_health.policy_summary_claims_excess_empty",
                                    {
                                        ...ns,
                                        defaultValue:
                                            "No anniversary years in range for this policy.",
                                    }
                                )}
                            </p>
                        ) : (
                            <div className="mt-2 flex flex-col gap-4">
                                {excessYears.map((year) => {
                                    const range = yearWindowLabel(
                                        year,
                                        language
                                    );
                                    const claims = year.claims ?? [];
                                    return (
                                        <div key={year.policy_year}>
                                            <div
                                                className="text-sm font-semibold"
                                                style={{
                                                    color: CPH.ink,
                                                    fontFamily:
                                                        SPACE_GROTESK_FONT_FAMILY,
                                                }}
                                            >
                                                {t(
                                                    "credit_portfolio_health.policy_summary_policy_year",
                                                    {
                                                        ...ns,
                                                        defaultValue:
                                                            "Policy year {{year}}",
                                                        year: year.policy_year,
                                                    }
                                                )}
                                                {range ? ` (${range})` : ""}
                                            </div>
                                            <ul
                                                className="m-0 mt-1 list-disc ps-5 text-sm"
                                                style={{ color: CPH.slate }}
                                            >
                                                <li className="mb-1">
                                                    {t(
                                                        "credit_portfolio_health.policy_summary_remaining_sdl_excess",
                                                        {
                                                            ...ns,
                                                            defaultValue:
                                                                "Remaining SDL excess",
                                                        }
                                                    )}
                                                    {`: ${formatMoneyOrDash(
                                                        year.remaining_sdl_excess,
                                                        currency,
                                                        language,
                                                        empty
                                                    )}`}
                                                </li>
                                                <li className="mb-1">
                                                    {t(
                                                        "credit_portfolio_health.policy_summary_remaining_aggregate_excess",
                                                        {
                                                            ...ns,
                                                            defaultValue:
                                                                "Remaining Aggregate excess",
                                                        }
                                                    )}
                                                    {`: ${formatMoneyOrDash(
                                                        year.remaining_aggregate_excess,
                                                        currency,
                                                        language,
                                                        empty
                                                    )}`}
                                                </li>
                                            </ul>
                                            {claims.length === 0 ? (
                                                <p
                                                    className="m-0 mt-1 text-sm"
                                                    style={{ color: CPH.slate }}
                                                >
                                                    {t(
                                                        "credit_portfolio_health.policy_summary_no_claims_in_year",
                                                        {
                                                            ...ns,
                                                            defaultValue:
                                                                "No claims in this policy year.",
                                                        }
                                                    )}
                                                </p>
                                            ) : (
                                                <ul
                                                    className="m-0 mt-1 list-disc ps-5 text-sm"
                                                    style={{
                                                        color: CPH.slate,
                                                    }}
                                                >
                                                    {claims.map((claim) => {
                                                        const customer =
                                                            claimCustomerDisplayName(
                                                                claim.Customer
                                                            );
                                                        const invoice =
                                                            claim.Invoice
                                                                ?.invoice_number?.trim() ||
                                                            (claim.invoice_id !=
                                                            null
                                                                ? `#${claim.invoice_id}`
                                                                : null);
                                                        const loss =
                                                            toFiniteNumber(
                                                                claim.recognized_loss
                                                            );
                                                        const parts = [
                                                            claimStatusLabel(
                                                                String(
                                                                    claim.status
                                                                ),
                                                                t
                                                            ),
                                                            loss != null
                                                                ? formatPortfolioMoney(
                                                                      loss,
                                                                      currency,
                                                                      language
                                                                  )
                                                                : null,
                                                            customer || null,
                                                            invoice
                                                                ? t(
                                                                      "credit_portfolio_health.policy_summary_claim_invoice",
                                                                      {
                                                                          ...ns,
                                                                          defaultValue:
                                                                              "Invoice {{invoice}}",
                                                                          invoice,
                                                                      }
                                                                  )
                                                                : null,
                                                        ].filter(Boolean);
                                                        return (
                                                            <li
                                                                key={claim.id}
                                                                className="mb-1"
                                                            >
                                                                {t(
                                                                    "credit_portfolio_health.policy_summary_claim_row",
                                                                    {
                                                                        ...ns,
                                                                        defaultValue:
                                                                            "Claim #{{id}}: {{details}}",
                                                                        id: claim.id,
                                                                        details:
                                                                            parts.join(
                                                                                " · "
                                                                            ),
                                                                    }
                                                                )}
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </IslandCard>
                </div>
            ) : null}
        </div>
    );
}
