/**
 * Portfolio summary POC — render the backend data bundle as a skeleton Hebrew
 * RTL HTML + PDF (title, range, days-with-data note, KPI table per area).
 *
 * Labels come from the dashboard's Hebrew locale files and values use the
 * Portfolio Health formatters, so the PDF reads like the dashboard. Static SVG
 * charts (`summary-charts.ts`), colors, fonts and the logo reuse the dashboard
 * tokens and assets; print CSS lives only in the generated HTML.
 * Output must stay in a gitignored `.scratch` folder (bundle holds customer data).
 *
 * PDF uses the Playwright already in this repo. It never downloads a browser:
 * pass `--chromium <path>` to any local Chromium-based browser, or approve
 * `npx playwright install chromium` first. Without one, only the HTML is written.
 *
 * Optional `--narrative <path>` (JSON, also kept in `.scratch`) adds the written
 * analysis. Its text quotes numbers only through `{{path|format}}` placeholders
 * filled from the bundle (`derived.*` = arithmetic declared in the narrative,
 * `meta.*` = renderer constants); any unresolved placeholder aborts the render.
 *
 * Usage (from the frontend repo root):
 *   ../backend/node_modules/.bin/tsx scripts/portfolio-summary-poc/render-skeleton-pdf.ts \
 *     --bundle ../backend/.scratch/portfolio-summary-poc/bundle-10149-2026-04-01_2026-09-30.json \
 *     [--narrative ../backend/.scratch/portfolio-summary-poc/narrative-10149-2026-04-01_2026-09-30.json] \
 *     [--chromium "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"]
 */
import * as fs from "fs";
import * as path from "path";

import { chromium } from "@playwright/test";

import { chartColors } from "@/app/[locale]/app/credit-portfolio-health/chartColors";
import { CPH } from "@/app/[locale]/app/credit-portfolio-health/designTokens";
import { SPACE_GROTESK_FONT_FAMILY } from "@/app/[locale]/app/credit-portfolio-health/fontTokens";
import {
    formatPortfolioMoney,
    formatPortfolioNumber,
    resolvePortfolioNumberDecimals,
} from "@/app/[locale]/app/credit-portfolio-health/formatPortfolioMoney";
import {
    BREACH_REASON_LABEL_KEYS,
    NO_COVERAGE_REASON_LABEL_KEYS,
} from "@/app/[locale]/app/credit-portfolio-health/noCoverageReasonLabels";
import {
    dclSdlCoverAmount,
    formatPolicyDate,
    showPolicySummaryCommercialTerms,
    toFiniteNumber,
    type PolicySummaryDetail,
} from "@/app/[locale]/app/credit-portfolio-health/policySummaryModel";
import { sectionTopCustomersUtilization } from "@/app/[locale]/app/credit-portfolio-health/topCustomersUtilization";
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY } from "@/app/theme/constants";
import { buildTypography } from "@/app/theme/typography";
import heClaims from "@/locales/he/claims.json";
import heCommon from "@/locales/he/common.json";
import heDashboard from "@/locales/he/dashboard.json";
import heSettings from "@/locales/he/settings.json";
import type { RemainingExcessYear } from "@/shared/services/claimsService";
import {
    PORTFOLIO_HEALTH_BELOW_THRESHOLD_PCT,
    type PortfolioCostsSection,
    type PortfolioHealthSection,
    type PortfolioNoCoverageSection,
    type PortfolioUtilizationSection,
} from "@/types/creditInsurance";
import { formatMoney } from "@/utils/stringFormatters";

import {
    CHART_CSS,
    dailyHealthChart,
    dailyUtilizationChart,
    monthlyCostChart,
    monthlyExposureChart,
    topUpDrawChart,
    type ChartContext,
} from "./summary-charts";

const LANGUAGE = "he";
const HEALTH_THRESHOLD_PCT = PORTFOLIO_HEALTH_BELOW_THRESHOLD_PCT;
const TOP_N = 10;
const LOGO_PATH = path.resolve(
    __dirname,
    "../../public/assets/images/brand-logos/logo.png"
);

type PortfolioBundle = {
    bundleVersion: number;
    generatedAt: string;
    account: { id: number; name: string | null; currency: string | null };
    range: { from: string; to: string };
    daysAvailable: number;
    daysInRange: number;
    policySummary: {
        details: Array<{
            terms: PolicySummaryDetail;
            countryCount: number;
            namedCount: number;
            claimsExcess: { years: RemainingExcessYear[] } | null;
            claimsExcessError: string | null;
        }>;
    };
    portfolioHealth: PortfolioHealthSection | null;
    noCoverage: PortfolioNoCoverageSection | null;
    utilization: PortfolioUtilizationSection | null;
    costs: PortfolioCostsSection | null;
};

type Row = [label: string, value: string];
type Table = { title: string; rows: Row[] };

const KPI_GROUPS = [
    "policy",
    "health",
    "noCoverage",
    "utilization",
    "costs",
] as const;
type KpiGroup = (typeof KPI_GROUPS)[number];

type DerivedSpec = {
    op:
        | "sum"
        | "len"
        | "add"
        | "sub"
        | "mul"
        | "div"
        | "pct"
        | "topCustomersUtilization";
    args: Array<string | number>;
};

type NarrativeSection = {
    title: string;
    paragraphs?: string[];
    bullets?: string[];
    numbered?: string[];
    kpiTables?: KpiGroup[];
};

type Narrative = {
    narrativeVersion: number;
    appendixTitle: string;
    derived?: Record<string, DerivedSpec>;
    sections: NarrativeSection[];
};

const LOCALES: Record<string, unknown> = {
    dashboard: heDashboard,
    settings: heSettings,
    claims: heClaims,
    common: heCommon,
};

function t(
    ns: keyof typeof LOCALES,
    key: string,
    vars: Record<string, string | number> = {},
    defaultValue = key
): string {
    let node: unknown = LOCALES[ns];
    for (const part of key.split(".")) {
        node =
            node && typeof node === "object"
                ? (node as Record<string, unknown>)[part]
                : undefined;
    }
    const template = typeof node === "string" ? node : defaultValue;
    return template.replace(/\{\{(\w+)\}\}/g, (_m, name: string) =>
        vars[name] != null ? String(vars[name]) : ""
    );
}

const cph = (key: string, vars?: Record<string, string | number>) =>
    t("dashboard", `credit_portfolio_health.${key}`, vars);
const EMPTY = t("dashboard", "credit_insurance_dashboard.em_dash", {}, "—");

function pct(value: number | null | undefined, decimals = 1): string {
    if (value == null || !Number.isFinite(value)) {
        return EMPTY;
    }
    const digits = resolvePortfolioNumberDecimals(value, decimals);
    return `${formatPortfolioNumber(value, LANGUAGE, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    })}%`;
}

function policyPct(value: number | null): string {
    return value == null
        ? EMPTY
        : `${formatPortfolioNumber(value, LANGUAGE, { maximumFractionDigits: 3 })}%`;
}

function count(value: number | null | undefined, decimals = 0): string {
    return value == null || !Number.isFinite(value)
        ? EMPTY
        : formatPortfolioNumber(value, LANGUAGE, {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
          });
}

function money(value: number | null | undefined, currency: string): string {
    return value == null || !Number.isFinite(value)
        ? EMPTY
        : formatPortfolioMoney(value, currency, LANGUAGE);
}

function date(ymd: string | null | undefined): string {
    return formatPolicyDate(ymd ?? null, LANGUAGE) ?? EMPTY;
}

function dateWindow(start: string | null, end: string | null): string {
    return start && end ? `${date(start)} – ${date(end)}` : EMPTY;
}

function days(value: number | null | undefined): string {
    return value == null ? EMPTY : cph("policy_summary_days", { days: value });
}

function enumLabel(
    value: string | null | undefined,
    keys: Record<string, string>
): string {
    if (!value?.trim()) {
        return EMPTY;
    }
    const key = keys[value];
    return key ? t("settings", key) : value;
}

function policyTables(bundle: PortfolioBundle): Table[] {
    return bundle.policySummary.details.flatMap((entry) => {
        const detail = entry.terms;
        const currency = detail.currency?.trim() || "USD";
        const policyName = detail.policy_number?.trim() || `#${detail.id}`;
        const rows: Row[] = [
            [cph("policy_summary_number"), policyName],
            [
                cph("policy_summary_kind"),
                enumLabel(detail.policy_kind, {
                    Primary: "credit_insurance.fields.policy_kind_primary",
                    TopUp: "credit_insurance.fields.policy_kind_top_up",
                }),
            ],
            [
                cph("policy_summary_status"),
                enumLabel(detail.status, {
                    Active: "credit_insurance.status.active",
                    Inactive: "credit_insurance.status.inactive",
                    Draft: "credit_insurance.status.draft",
                }),
            ],
            [
                cph("policy_summary_insurer"),
                detail.insurer_name?.trim() || EMPTY,
            ],
            [
                cph("policy_summary_term"),
                dateWindow(detail.start_date ?? null, detail.end_date ?? null),
            ],
            [
                cph("policy_summary_max_cover"),
                money(toFiniteNumber(detail.max_total_cover), currency),
            ],
            [
                cph("policy_summary_dcl_cover"),
                money(dclSdlCoverAmount(detail), currency),
            ],
            [
                cph("policy_summary_cost"),
                policyPct(toFiniteNumber(detail.cost_percent)),
            ],
            [
                cph("policy_summary_cost_method"),
                enumLabel(detail.cost_calculation_method, {
                    Limit: "credit_insurance.fields.cost_calculation_method_limit",
                    ActualSales:
                        "credit_insurance.fields.cost_calculation_method_actual_sales",
                }),
            ],
            [
                cph("policy_summary_registration_fee"),
                policyPct(toFiniteNumber(detail.registration_fee_percent)),
            ],
            [
                cph("policy_summary_annual_credit_assessment_fee"),
                money(
                    toFiniteNumber(detail.annual_credit_assessment_fee),
                    currency
                ),
            ],
            [cph("policy_summary_payment_term"), days(detail.max_payment_term)],
            [cph("policy_summary_mep"), days(detail.max_allowed_mep)],
            [cph("policy_summary_reporting_days"), days(detail.reporting_days)],
            [
                cph("policy_summary_country_count"),
                cph("policy_summary_countries_value", {
                    count: entry.countryCount,
                }),
            ],
            [
                cph("policy_summary_named_count"),
                cph("policy_summary_named_value", { count: entry.namedCount }),
            ],
        ];

        if (showPolicySummaryCommercialTerms(detail)) {
            rows.push(
                [
                    cph("policy_summary_insured_percentage"),
                    policyPct(toFiniteNumber(detail.insured_percentage)),
                ],
                [
                    cph("policy_summary_nql"),
                    money(
                        toFiniteNumber(detail.non_qualifying_loss_threshold),
                        currency
                    ),
                ],
                [
                    cph("policy_summary_aggregate_excess"),
                    money(toFiniteNumber(detail.aggregate_excess), currency),
                ],
                [
                    cph("policy_summary_sdl_excess"),
                    money(toFiniteNumber(detail.sdl_excess), currency),
                ]
            );
        }

        const tables: Table[] = [
            { title: `${cph("tab_policy_summary")} — ${policyName}`, rows },
        ];

        if (showPolicySummaryCommercialTerms(detail)) {
            const excessRows: Row[] = [];
            if (entry.claimsExcessError) {
                excessRows.push([
                    cph("policy_summary_claims_excess_load_failed"),
                    entry.claimsExcessError,
                ]);
            }
            for (const year of entry.claimsExcess?.years ?? []) {
                const yearLabel = `${cph("policy_summary_policy_year", {
                    year: year.policy_year,
                })} (${dateWindow(
                    String(year.policy_year_start).slice(0, 10),
                    String(year.policy_year_end).slice(0, 10)
                )})`;
                const claims = year.claims ?? [];
                excessRows.push(
                    [
                        `${yearLabel} · ${cph("policy_summary_remaining_sdl_excess")}`,
                        money(year.remaining_sdl_excess, currency),
                    ],
                    [
                        `${yearLabel} · ${cph("policy_summary_remaining_aggregate_excess")}`,
                        money(year.remaining_aggregate_excess, currency),
                    ]
                );
                if (claims.length === 0) {
                    excessRows.push([
                        yearLabel,
                        cph("policy_summary_no_claims_in_year"),
                    ]);
                }
                for (const claim of claims) {
                    excessRows.push([
                        yearLabel,
                        cph("policy_summary_claim_row", {
                            id: claim.id,
                            details: [
                                t("claims", `statuses.${claim.status}`),
                                money(
                                    toFiniteNumber(
                                        claim.recognized_loss as number | string
                                    ),
                                    currency
                                ),
                            ].join(" · "),
                        }),
                    ]);
                }
            }
            if (excessRows.length === 0) {
                excessRows.push([
                    cph("policy_summary_claims_excess"),
                    cph("policy_summary_claims_excess_empty"),
                ]);
            }
            tables.push({
                title: `${cph("policy_summary_claims_excess")} — ${policyName}`,
                rows: excessRows,
            });
        }
        return tables;
    });
}

function healthTable(section: PortfolioHealthSection): Table {
    const a = section.seriesA;
    const overLimit = section.overLimitGap;
    const topN = section.topCustomerCreditProtection?.cohorts?.[TOP_N];
    return {
        title: cph("section_health_title"),
        rows: [
            [cph("kpi_average_health"), pct(a.averageHealthPct)],
            [cph("kpi_lowest_health"), pct(a.lowestHealthPct)],
            [
                cph("kpi_lowest_health_streak_window", {
                    days: a.lowestHealthStreakDays,
                    start: date(a.lowestHealthStreakStart),
                    end: date(a.lowestHealthStreakEnd),
                }),
                count(a.lowestHealthStreakDays),
            ],
            [
                cph("kpi_pct_below_85_label", { pct: HEALTH_THRESHOLD_PCT }),
                pct(a.pctDaysBelow85),
            ],
            [
                cph("kpi_longest_over_limit_streak"),
                overLimit && overLimit.longestStreakDays > 0
                    ? `${cph("kpi_longest_over_limit_streak_label_days", {
                          days: overLimit.longestStreakDays,
                      })} (${dateWindow(
                          overLimit.longestStreakStart,
                          overLimit.longestStreakEnd
                      )})`
                    : cph("kpi_longest_over_limit_streak_none"),
            ],
            [
                cph("kpi_top_n_credit_protection", { n: TOP_N }),
                topN ? pct(topN.creditProtectionLevel) : EMPTY,
            ],
        ],
    };
}

function noCoverageTable(section: PortfolioNoCoverageSection): Table {
    const currency = section.accountCurrency || "USD";
    const mainReason = section.mainViolationReason;
    const mainMeta = mainReason
        ? (BREACH_REASON_LABEL_KEYS[mainReason] ??
          BREACH_REASON_LABEL_KEYS.other)
        : null;
    const reasonRows: Row[] = section.reasons
        .filter((r) => r.averageAmount > 0 || r.averageCustomerCount > 0)
        .sort((x, y) => y.averageAmount - x.averageAmount)
        .map((r) => {
            const meta = NO_COVERAGE_REASON_LABEL_KEYS[r.reason];
            const label = meta ? t("dashboard", meta.key) : r.reason;
            return [
                `${cph("no_coverage_reasons_title")} · ${label}`,
                money(r.averageAmount, currency),
            ];
        });
    return {
        title: cph("section_no_coverage_title"),
        rows: [
            [
                cph("kpi_at_risk_customer_pct"),
                pct(section.averageAtRiskCustomerPct),
            ],
            [
                cph("kpi_at_risk_customer_count", { count: "" }).replace(
                    /[:\s]+$/,
                    ""
                ),
                count(section.averageAtRiskCustomerCount, 1),
            ],
            [
                cph("kpi_at_risk_amount"),
                money(section.averageAtRiskAmount, currency),
            ],
            [cph("kpi_violation_pct"), pct(section.averageViolationPct)],
            [
                cph("kpi_main_violation"),
                mainMeta
                    ? t("dashboard", mainMeta.key, {}, mainReason ?? "")
                    : cph("kpi_main_violation_none"),
            ],
            [
                cph("kpi_main_violation_share_label"),
                pct(section.mainViolationReasonSharePct, 0),
            ],
            ...reasonRows,
        ],
    };
}

function utilizationTable(section: PortfolioUtilizationSection): Table {
    const currency = section.accountCurrency || "USD";
    const years = section.yearMultiplier ?? 1;
    const top = sectionTopCustomersUtilization(section);
    return {
        title: cph("section_utilization_title"),
        rows: [
            [
                cph("kpi_avg_utilization_label"),
                pct(section.averageUtilizationPct),
            ],
            [
                cph("kpi_avg_utilization_top10"),
                top.openArSharePct == null
                    ? pct(top.averagePct)
                    : `${pct(top.averagePct)} · ${cph(
                          "kpi_avg_utilization_top10_open_ar_share",
                          { pct: count(top.openArSharePct, 1) }
                      )}`,
            ],
            [cph("kpi_pct_days_above_100_label"), pct(section.pctDaysAbove100)],
            [cph("kpi_peak_utilization"), pct(section.peakUtilizationPct)],
            [
                cph("kpi_peak_util_streak_window", {
                    days: section.peakUtilizationStreakDays,
                    start: date(section.peakUtilizationStreakStart),
                    end: date(section.peakUtilizationStreakEnd),
                }),
                count(section.peakUtilizationStreakDays),
            ],
            [
                `${cph("kpi_approved_footprint_title")} · ${cph("footprint_customers")}`,
                pct(section.approvedCustomerPct, 0),
            ],
            [
                `${cph("kpi_approved_footprint_title")} · ${cph("footprint_ar")}`,
                pct(section.approvedArSharePct, 0),
            ],
            [
                `${cph("kpi_approved_footprint_title")} · ${cph("footprint_avg_utilization")}`,
                pct(section.approvedAverageUtilizationPct),
            ],
            [
                `${cph("kpi_self_footprint_title")} · ${cph("footprint_customers")}`,
                pct(section.selfUnderwrittenCustomerPct, 0),
            ],
            [
                `${cph("kpi_self_footprint_title")} · ${cph("footprint_ar")}`,
                pct(section.selfUnderwrittenArSharePct, 0),
            ],
            [
                `${cph("kpi_self_footprint_title")} · ${cph("footprint_avg_utilization")}`,
                pct(section.selfUnderwrittenAverageUtilizationPct),
            ],
            [cph("kpi_top_up_count"), count(section.periodActiveTopUpCount)],
            [
                cph("kpi_top_up_customers"),
                count(section.periodCustomersWithTopUp),
            ],
            [
                cph("kpi_idle_named_customers"),
                cph("kpi_idle_named_customers_label", {
                    idle: count(section.idleNamedCustomerCount),
                    named: count(section.namedCustomerCountInRange),
                    pct: pct(section.idleNamedCustomerPct, 0),
                }),
            ],
            [
                cph("kpi_idle_named_customers_cost_label", { years }),
                money(
                    section.idleNamedAnnualCreditAssessmentCost ?? 0,
                    currency
                ),
            ],
        ],
    };
}

function costsTables(section: PortfolioCostsSection): Table[] {
    const currency = section.accountCurrency || "USD";
    return [
        {
            title: cph("section_costs_title"),
            rows: [
                [
                    `${cph("kpi_period_cost")} (${cph("kpi_period_cost_label")})`,
                    money(section.periodCost, currency),
                ],
                [
                    `${cph("kpi_effective_cost")} (${cph("kpi_effective_cost_per_unit")})`,
                    money(section.effectiveCost, currency),
                ],
                [
                    `${cph("kpi_annual_credit_assessment_cost")} (${cph(
                        "kpi_annual_credit_assessment_cost_label",
                        {
                            count: section.namedCustomerCountInRange ?? 0,
                            years: section.yearMultiplier ?? 1,
                        }
                    )})`,
                    money(section.annualCreditAssessmentCost ?? 0, currency),
                ],
                [
                    `${cph("kpi_approved_footprint_title")} · ${cph("footprint_total_ar")}`,
                    money(section.approvedAverageAr, currency),
                ],
                [
                    `${cph("kpi_self_footprint_title")} · ${cph("footprint_total_ar")}`,
                    money(section.selfUnderwrittenAverageAr, currency),
                ],
            ],
        },
        {
            title: cph("monthly_cost_chart_title"),
            rows: (section.monthly ?? []).flatMap((m): Row[] => [
                [
                    `${m.month} · ${cph("chart_monthly_cost_insurance")}`,
                    money(m.insuranceCost, currency),
                ],
                [
                    `${m.month} · ${cph("chart_monthly_cost_registration")}`,
                    money(m.registrationFeeCost, currency),
                ],
                [
                    `${m.month} · ${cph("chart_monthly_cost_top_ups")}`,
                    money(m.topUpCost, currency),
                ],
                [
                    `${m.month} · ${cph("chart_monthly_cost_total")}`,
                    money(m.totalCost, currency),
                ],
            ]),
        },
    ];
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function kpiTables(bundle: PortfolioBundle): Record<KpiGroup, Table[]> {
    return {
        policy: policyTables(bundle),
        health: bundle.portfolioHealth
            ? [healthTable(bundle.portfolioHealth)]
            : [],
        noCoverage: bundle.noCoverage
            ? [noCoverageTable(bundle.noCoverage)]
            : [],
        utilization: bundle.utilization
            ? [utilizationTable(bundle.utilization)]
            : [],
        costs: bundle.costs ? costsTables(bundle.costs) : [],
    };
}

function chartBlocks(bundle: PortfolioBundle): Record<KpiGroup, string[]> {
    const ctx: ChartContext = {
        language: LANGUAGE,
        currency: bundle.account.currency?.trim() || "USD",
        from: bundle.range.from,
        to: bundle.range.to,
        thresholdPct: HEALTH_THRESHOLD_PCT,
        label: cph,
        pct,
        count,
        date,
    };
    const health = bundle.portfolioHealth;
    const utilization = bundle.utilization;
    const costs = bundle.costs;
    const withCurrency = (currency: string | undefined): ChartContext => ({
        ...ctx,
        currency: currency || ctx.currency,
    });
    return {
        policy: [],
        noCoverage: [],
        costs: costs
            ? [monthlyCostChart(costs, withCurrency(costs.accountCurrency))]
            : [],
        utilization: utilization
            ? [
                  dailyUtilizationChart(utilization, ctx),
                  topUpDrawChart(
                      utilization,
                      withCurrency(utilization.accountCurrency)
                  ),
              ]
            : [],
        health: health
            ? [dailyHealthChart(health, ctx), monthlyExposureChart(health, ctx)]
            : [],
    };
}

function renderGroup(
    group: KpiGroup,
    tables: Record<KpiGroup, Table[]>,
    charts: Record<KpiGroup, string[]>,
    heading: "h2" | "h3"
): string {
    const kpi = tables[group].length
        ? `<div class="kpi">${renderTables(tables[group], heading)}</div>`
        : "";
    return `${charts[group].filter(Boolean).join("\n")}${kpi}`;
}

function renderTables(tables: Table[], heading: "h2" | "h3"): string {
    return tables
        .map(
            (table) => `<${heading}>${escapeHtml(table.title)}</${heading}>
<table>
${table.rows
    .map(
        ([label, value]) =>
            `<tr><th>${escapeHtml(label)}</th><td><bdi>${escapeHtml(value)}</bdi></td></tr>`
    )
    .join("\n")}
</table>`
        )
        .join("\n");
}

type PathValue = { found: boolean; value: unknown };

function resolvePath(root: unknown, ref: string): PathValue {
    const parts = ref
        .replace(/\[(\*|\d+)\]/g, ".$1")
        .split(".")
        .filter(Boolean);
    const walk = (node: unknown, index: number): PathValue => {
        if (index === parts.length) {
            return { found: node !== undefined, value: node };
        }
        const part = parts[index];
        if (part === "*") {
            if (!Array.isArray(node)) {
                return { found: false, value: undefined };
            }
            const values: unknown[] = [];
            for (const item of node) {
                const next = walk(item, index + 1);
                if (!next.found) {
                    return next;
                }
                values.push(
                    ...(Array.isArray(next.value) &&
                    parts.slice(index + 1).includes("*")
                        ? next.value
                        : [next.value])
                );
            }
            return { found: true, value: values };
        }
        if (node == null || typeof node !== "object") {
            return { found: false, value: undefined };
        }
        return walk((node as Record<string, unknown>)[part], index + 1);
    };
    return walk(root, 0);
}

function evaluateDerived(
    bundle: PortfolioBundle,
    specs: Record<string, DerivedSpec>,
    root: Record<string, unknown>
): Record<string, number> {
    const derived: Record<string, number> = {};
    root.derived = derived;
    const scalar = (name: string, arg: string | number): number => {
        if (typeof arg === "number") {
            return arg;
        }
        const resolved = resolvePath(root, arg);
        const value = toFiniteNumber(resolved.value as string | number | null);
        if (!resolved.found || value == null) {
            throw new Error(`derived.${name}: "${arg}" is not a number`);
        }
        return value;
    };
    const list = (name: string, arg: string | number): unknown[] => {
        const resolved =
            typeof arg === "string" ? resolvePath(root, arg) : null;
        if (!resolved?.found || !Array.isArray(resolved.value)) {
            throw new Error(`derived.${name}: "${arg}" is not a list`);
        }
        return resolved.value;
    };

    for (const [name, spec] of Object.entries(specs)) {
        const [a, b] = spec.args;
        let value: number | null;
        switch (spec.op) {
            case "sum":
                value = list(name, a).reduce<number>((sum, item) => {
                    const n = toFiniteNumber(item as string | number | null);
                    if (n == null) {
                        throw new Error(
                            `derived.${name}: non-numeric item in "${a}"`
                        );
                    }
                    return sum + n;
                }, 0);
                break;
            case "len":
                value = list(name, a).length;
                break;
            case "add":
                value = scalar(name, a) + scalar(name, b);
                break;
            case "sub":
                value = scalar(name, a) - scalar(name, b);
                break;
            case "mul":
                value = scalar(name, a) * scalar(name, b);
                break;
            case "div":
            case "pct": {
                const denom = scalar(name, b);
                if (denom === 0) {
                    throw new Error(`derived.${name}: division by zero`);
                }
                value =
                    (scalar(name, a) / denom) * (spec.op === "pct" ? 100 : 1);
                break;
            }
            case "topCustomersUtilization": {
                if (!bundle.utilization) {
                    throw new Error(
                        `derived.${name}: bundle has no utilization`
                    );
                }
                const summary = sectionTopCustomersUtilization(
                    bundle.utilization
                );
                const field = String(a) as keyof typeof summary;
                value = summary[field] ?? null;
                break;
            }
            default:
                throw new Error(
                    `derived.${name}: unknown op "${String(spec.op)}"`
                );
        }
        if (value == null || !Number.isFinite(value)) {
            throw new Error(`derived.${name}: result is not a finite number`);
        }
        derived[name] = value;
    }
    return derived;
}

function monthLabel(ym: string): string {
    const [year, month] = ym.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("he-IL", {
        month: "long",
        year: "numeric",
    });
}

function formatRef(value: unknown, format: string, currency: string): string {
    if (format === "text") {
        return String(value);
    }
    if (format === "date") {
        return date(String(value));
    }
    if (format === "month") {
        return monthLabel(String(value));
    }
    if (format === "breachReason") {
        const meta =
            BREACH_REASON_LABEL_KEYS[String(value)] ??
            BREACH_REASON_LABEL_KEYS.other;
        return t("dashboard", meta.key, {}, String(value));
    }
    const n = toFiniteNumber(value as string | number | null);
    if (n == null) {
        throw new Error(`value ${JSON.stringify(value)} is not a number`);
    }
    switch (format) {
        case "money":
            return money(n, currency);
        case "money2":
            return formatMoney(n, currency, {
                style: "symbol",
                locale: "he-IL",
                language: LANGUAGE,
            });
        case "pct":
            return pct(n);
        case "pct0":
            return pct(n, 0);
        case "policyPct":
            return policyPct(n);
        case "count":
            return count(n);
        case "count1":
            return count(n, 1);
        case "num2":
            return count(n, 2);
        case "raw":
            return formatPortfolioNumber(n, LANGUAGE, {
                maximumFractionDigits: 6,
            });
        case "days":
            return days(n);
        default:
            throw new Error(`unknown format "${format}"`);
    }
}

const PLACEHOLDER = /\{\{\s*([^|}]+?)\s*(?:\|\s*(\w+)\s*)?\}\}/g;

type NarrativeStats = {
    placeholders: number;
    refs: Set<string>;
    errors: string[];
};

function fillTemplate(
    template: string,
    root: Record<string, unknown>,
    currency: string,
    stats: NarrativeStats
): string {
    let html = "";
    let last = 0;
    for (const match of template.matchAll(PLACEHOLDER)) {
        const [whole, ref, format = "text"] = match;
        html += escapeHtml(template.slice(last, match.index));
        last = (match.index ?? 0) + whole.length;
        stats.placeholders += 1;
        stats.refs.add(ref);
        const resolved = resolvePath(root, ref);
        if (!resolved.found || resolved.value == null) {
            stats.errors.push(`${whole}: unresolved`);
            continue;
        }
        try {
            html += `<bdi>${escapeHtml(formatRef(resolved.value, format, currency))}</bdi>`;
        } catch (error) {
            stats.errors.push(
                `${whole}: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
    html += escapeHtml(template.slice(last));
    return html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function renderNarrative(
    bundle: PortfolioBundle,
    narrative: Narrative,
    tables: Record<KpiGroup, Table[]>,
    charts: Record<KpiGroup, string[]>
): { html: string; stats: NarrativeStats } {
    const root: Record<string, unknown> = {
        ...bundle,
        meta: { healthThresholdPct: HEALTH_THRESHOLD_PCT, topN: TOP_N },
    };
    evaluateDerived(bundle, narrative.derived ?? {}, root);
    const currency = bundle.account.currency?.trim() || "USD";
    const stats: NarrativeStats = {
        placeholders: 0,
        refs: new Set(),
        errors: [],
    };
    const fill = (text: string) => fillTemplate(text, root, currency, stats);
    const placed = new Set<KpiGroup>();

    const sections = narrative.sections.map((section) => {
        const parts = [`<h2>${fill(section.title)}</h2>`];
        for (const paragraph of section.paragraphs ?? []) {
            parts.push(`<p class="narrative">${fill(paragraph)}</p>`);
        }
        if (section.bullets?.length) {
            parts.push(
                `<ul>${section.bullets.map((item) => `<li>${fill(item)}</li>`).join("")}</ul>`
            );
        }
        if (section.numbered?.length) {
            parts.push(
                `<ol>${section.numbered.map((item) => `<li>${fill(item)}</li>`).join("")}</ol>`
            );
        }
        for (const group of section.kpiTables ?? []) {
            if (!KPI_GROUPS.includes(group)) {
                stats.errors.push(`kpiTables: unknown group "${group}"`);
                continue;
            }
            placed.add(group);
            parts.push(renderGroup(group, tables, charts, "h3"));
        }
        return `<section>${parts.join("\n")}</section>`;
    });

    const remaining = KPI_GROUPS.filter(
        (group) =>
            !placed.has(group) &&
            (tables[group].length > 0 || charts[group].some(Boolean))
    );
    if (remaining.length > 0) {
        sections.push(
            `<section class="appendix"><h2>${fill(narrative.appendixTitle)}</h2>
${remaining.map((group) => renderGroup(group, tables, charts, "h3")).join("\n")}</section>`
        );
    }
    return { html: sections.join("\n"), stats };
}

function renderHtml(
    bundle: PortfolioBundle,
    narrative: Narrative | null
): { html: string; stats: NarrativeStats | null } {
    const tables = kpiTables(bundle);
    const charts = chartBlocks(bundle);
    const accountName = bundle.account.name ?? String(bundle.account.id);
    const title = `${cph("page_title")} — ${accountName}`;
    const daysNote = cph("days_available_footnote", {
        available: bundle.daysAvailable,
        total: bundle.daysInRange,
    });
    const incomplete = bundle.daysAvailable < bundle.daysInRange;
    const rendered = narrative
        ? renderNarrative(bundle, narrative, tables, charts)
        : null;
    const body =
        rendered?.html ??
        KPI_GROUPS.map((group) =>
            renderGroup(group, tables, charts, "h2")
        ).join("\n");
    const logo = `data:image/png;base64,${fs.readFileSync(LOGO_PATH).toString("base64")}`;
    const generated = date(bundle.generatedAt.slice(0, 10));
    const coverRows: Row[] = [
        [
            t("dashboard", "fields.toolbar_date_range_label"),
            `${date(bundle.range.from)} – ${date(bundle.range.to)}`,
        ],
        [t("common", "fields.created_at"), generated],
    ];

    const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: ${buildTypography("").fontFamily}; color: ${CPH.ink}; margin: 0; font-size: 12px; }
h1 { font-size: 22px; margin: 0; color: ${CPH.ink}; }
h2 { font-size: 15px; margin: 18px 0 6px; padding-bottom: 4px; border-bottom: 1px solid ${CPH.border}; break-after: avoid; page-break-after: avoid; }
h3 { font-size: 13px; margin: 12px 0 4px; color: ${CPH.seriesSlate}; break-after: avoid; page-break-after: avoid; }
p { margin: 2px 0; color: ${CPH.slate}; }
p.narrative, li { color: ${CPH.ink}; line-height: 1.55; margin: 4px 0; orphans: 3; widows: 3; }
p.incomplete { color: ${CPH.criticalText}; font-weight: 600; }
ul, ol { margin: 4px 0; padding-inline-start: 20px; }
section { margin-bottom: 8px; }
section.appendix { break-before: page; page-break-before: always; }
.kpi { margin-top: 6px; }
table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
tr { break-inside: avoid; page-break-inside: avoid; }
th, td { border: 1px solid ${CPH.border}; padding: 4px 8px; text-align: start; vertical-align: top; }
th { width: 55%; font-weight: 600; background: ${CPH.bg}; }
td bdi { font-family: ${SPACE_GROTESK_FONT_FAMILY}; font-variant-numeric: tabular-nums; }
.cover { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 4px 0 12px; margin-bottom: 8px; border-bottom: 3px solid ${chartColors.primary}; break-inside: avoid; }
.cover .logo { flex-shrink: 0; padding: 8px 14px; border-radius: 10px; background: linear-gradient(225deg, ${DEFAULT_PRIMARY} 0%, ${DEFAULT_PRIMARY} 65%, ${DEFAULT_SECONDARY} 100%); }
.cover .logo img { display: block; height: 32px; }
.cover dl { margin: 6px 0 0; display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; color: ${CPH.slate}; }
.cover dt { font-weight: 600; }
.cover dd { margin: 0; color: ${CPH.ink}; }
${CHART_CSS}
</style>
</head>
<body>
<header class="cover">
<div>
<h1>${escapeHtml(title)}</h1>
<dl>${coverRows
        .map(
            ([label, value]) =>
                `<dt>${escapeHtml(label)}</dt><dd><bdi>${escapeHtml(value)}</bdi></dd>`
        )
        .join("")}</dl>
<p${incomplete ? ' class="incomplete"' : ""}>${escapeHtml(daysNote)}</p>
</div>
<div class="logo"><img src="${logo}" alt="ARchaser" /></div>
</header>
${body}
</body>
</html>
`;
    return { html, stats: rendered?.stats ?? null };
}

function readFlag(argv: string[], name: string): string | undefined {
    const index = argv.indexOf(name);
    if (index === -1) {
        return undefined;
    }
    const value = argv[index + 1];
    return value != null && !value.startsWith("--") ? value : undefined;
}

async function main() {
    const argv = process.argv.slice(2);
    const bundleArg = readFlag(argv, "--bundle");
    if (!bundleArg) {
        throw new Error(
            "Usage: --bundle <path to bundle JSON> [--narrative <path to narrative JSON>] [--out-dir <dir>] [--chromium <browser executable>]"
        );
    }
    const bundlePath = path.resolve(bundleArg);
    if (!fs.existsSync(bundlePath)) {
        throw new Error(`Bundle not found: ${bundlePath}`);
    }
    const outDir = path.resolve(
        readFlag(argv, "--out-dir") ?? path.dirname(bundlePath)
    );
    if (!outDir.split(path.sep).includes(".scratch")) {
        throw new Error(
            `Refusing to write outside a gitignored .scratch folder: ${outDir}`
        );
    }

    const bundle = JSON.parse(
        fs.readFileSync(bundlePath, "utf8")
    ) as PortfolioBundle;

    const narrativeArg = readFlag(argv, "--narrative");
    let narrative: Narrative | null = null;
    if (narrativeArg) {
        const narrativePath = path.resolve(narrativeArg);
        if (!narrativePath.split(path.sep).includes(".scratch")) {
            throw new Error(
                `Narrative must live in a gitignored .scratch folder: ${narrativePath}`
            );
        }
        narrative = JSON.parse(
            fs.readFileSync(narrativePath, "utf8")
        ) as Narrative;
    }

    const { html, stats } = renderHtml(bundle, narrative);
    if (stats) {
        if (stats.errors.length > 0) {
            throw new Error(
                `Narrative has ${stats.errors.length} unresolved reference(s):\n  ${stats.errors.join("\n  ")}`
            );
        }
        process.stdout.write(
            `[portfolio-summary-poc] narrative: ${stats.placeholders} placeholders, ${stats.refs.size} distinct refs, all resolved\n`
        );
    }

    const baseName = path
        .basename(bundlePath, ".json")
        .replace(/^bundle-/, narrative ? "summary-" : "skeleton-");
    fs.mkdirSync(outDir, { recursive: true });

    const htmlPath = path.join(outDir, `${baseName}.html`);
    fs.writeFileSync(htmlPath, html);
    process.stdout.write(`[portfolio-summary-poc] wrote ${htmlPath}\n`);

    const executablePath = readFlag(argv, "--chromium");
    let browser;
    try {
        browser = await chromium.launch(
            executablePath ? { executablePath } : {}
        );
    } catch (error) {
        console.error(
            `[portfolio-summary-poc] PDF skipped — no local Chromium (${
                error instanceof Error
                    ? error.message.split("\n")[0]
                    : String(error)
            }). Pass --chromium <path>, approve \`npx playwright install chromium\`, or open the HTML and print to PDF.`
        );
        process.exitCode = 2;
        return;
    }
    try {
        const page = await browser.newPage();
        await page.goto(`file://${htmlPath}`);
        const pdfPath = path.join(outDir, `${baseName}.pdf`);
        await page.pdf({
            path: pdfPath,
            format: "A4",
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: "<span></span>",
            footerTemplate: `<div style="width:100%;font-size:8px;color:${CPH.muted};text-align:center;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
            margin: {
                top: "12mm",
                bottom: "14mm",
                left: "10mm",
                right: "10mm",
            },
        });
        process.stdout.write(`[portfolio-summary-poc] wrote ${pdfPath}\n`);
    } finally {
        await browser.close();
    }
}

main().catch((error: unknown) => {
    console.error(
        `[portfolio-summary-poc] ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
});
