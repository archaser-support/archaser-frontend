"use client";

import { Box, LinearProgress, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import {
    BadgePercent,
    FileText,
    Landmark,
    Shield,
} from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { CreditDashboardPolicyItem } from "@/app/[locale]/app/credit-dashboard/CreditDashboardPolicySelect";
import { apiFetch } from "@/utils/apiFetch";

import { Eyebrow } from "./Eyebrow";
import { formatPortfolioMoney } from "./formatPortfolioMoney";
import { IslandCard } from "./IslandCard";
import { CPH } from "./designTokens";
import { SPACE_GROTESK_FONT_FAMILY } from "./fontTokens";
import layout from "./islandLayout.module.css";
import {
    countryRowCount,
    dclSdlCoverAmount,
    formatPolicyDate,
    namedRowCount,
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
    const { t, i18n } = useTranslation(["dashboard", "settings"]);
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
            <IslandCard accent="slate" className={layout.cardPad}>
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
        </div>
    );
}
