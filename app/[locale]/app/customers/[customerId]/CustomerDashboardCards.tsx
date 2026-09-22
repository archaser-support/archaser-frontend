"use client";

import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import FavoriteIcon from "@mui/icons-material/Favorite";
import GavelIcon from "@mui/icons-material/Gavel";
import PolicyIcon from "@mui/icons-material/Policy";
import SecurityIcon from "@mui/icons-material/Security";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
    Alert,
    Box,
    MenuItem,
    Stack,
    TextField,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { CreditMetricCard } from "@/app/[locale]/app/credit-dashboard/CreditMetricCard";
import {
    customerDashboardKpisQueryKey,
    fetchCustomerDashboardKpis,
} from "@/app/[locale]/app/customers/[customerId]/customerDashboardKpisQuery";
import type { TermsBreachCountByReason } from "@/types/creditInsurance";
import { resolveCapacityGapDisplayAmounts } from "@/shared/creditInsurance/invoiceBucketAmounts";
import { resolveCustomerDetailDashboardUx } from "@/shared/customerDetailDashboardUx";
import { Customer } from "@/types/Customer";
import {
    formatDateForDisplay,
    getUserDateLocale,
    getUserTimezone,
} from "@/utils/datetimeOperations";
import { formatMoney, formatMoneyDual } from "@/utils/stringFormatters";

import {
    buildDashboardCardContract,
    type CustomerCreditKpiCards,
    type TermsBreachReasonSlice,
} from "./customerDashboardCardViewModel";
import { CustomerDashboardCreditCharts } from "./CustomerDashboardCreditCharts";

interface CustomerDashboardCardsProps {
    customerId: string;
    customer: Customer;
    hasCreditProduct: boolean;
    onTimelineRefresh?: () => void;
}

const METRIC_GRID_SX = {
    display: "grid",
    gridTemplateColumns: {
        xs: "1fr",
        sm: "repeat(2, minmax(0, 1fr))",
        md: "repeat(4, minmax(0, 1fr))",
    },
    gap: 2,
} as const;

const DASHBOARD_SECTION_HEADER_ICON_SX = {
    color: "primary.main",
    fontSize: { xs: 18, sm: 20 },
} as const;

const BREACH_SLICE_ORDER: Array<{
    key: keyof (TermsBreachCountByReason & { other: number });
    labelKey: string;
}> = [
        { key: "reportingBreach", labelKey: "breach_type_reporting_breach" },
        { key: "paymentTerm", labelKey: "breach_type_payment_term" },
        { key: "customerOverdueMep", labelKey: "breach_type_customer_overdue_mep" },
        { key: "outdatedDcl", labelKey: "breach_type_outdated_dcl" },
        {
            key: "invoiceAfterPolicyEnd",
            labelKey: "breach_type_invoice_after_policy_end",
        },
        { key: "other", labelKey: "breach_type_other" },
    ];

function mapBreachDistributionToSlices(
    distribution: TermsBreachCountByReason & { other: number }
): TermsBreachReasonSlice[] {
    return BREACH_SLICE_ORDER.map(({ key, labelKey }) => ({
        key,
        labelKey,
        count: Number(distribution[key] ?? 0),
    }));
}

function formatHealthIndexPercent(value: number, locale: string): string {
    const ratio = Math.max(0, Math.min(1, value / 100));
    const digits =
        value <= 0
            ? 0
            : value < 0.1
                ? 3
                : value < 1
                    ? 2
                    : value < 10
                        ? 1
                        : 0;
    return new Intl.NumberFormat(locale, {
        style: "percent",
        maximumFractionDigits: digits,
        minimumFractionDigits: 0,
    }).format(ratio);
}

function DashboardSectionHeader({
    icon,
    title,
    endAdornment,
}: {
    icon: React.ReactNode;
    title: string;
    endAdornment?: React.ReactNode;
}) {
    const theme = useTheme();

    return (
        <Box
            sx={{
                p: { xs: 1, sm: 1.25 },
                mb: theme.spacing(1),
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
                flexWrap: "wrap",
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                {icon}
                <Typography
                    variant="h6"
                    sx={{
                        fontWeight: 500,
                        fontSize: { xs: "1rem", sm: "1.25rem" },
                    }}
                >
                    {title}
                </Typography>
            </Box>
            {endAdornment}
        </Box>
    );
}

function formatUsagePct(value: number | null | undefined) {
    if (value == null || !Number.isFinite(value)) {
        return "—";
    }
    return `${value.toFixed(1)}%`;
}

const CustomerDashboardCards: React.FC<CustomerDashboardCardsProps> = ({
    customerId: _customerId,
    customer,
    hasCreditProduct,
    onTimelineRefresh,
}) => {
    const { t, i18n } = useTranslation(["customers", "common", "dashboard"]);
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const isRtl = i18n.language === "he";
    const locale = isRtl ? "he-IL" : "en-US";
    const dateLocale = useMemo(() => {
        const fallback = isRtl ? "he-IL" : "en-US";
        return getUserDateLocale(session, fallback);
    }, [isRtl, session]);
    const timezone = useMemo(() => getUserTimezone(session), [session]);

    const selectedPolicyIdFromUrl = useMemo(() => {
        const raw = searchParams?.get("policyId");
        if (!raw) return null;
        const parsed = Number.parseInt(raw, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }, [searchParams]);

    const creditInsuranceLabels = useMemo(
        () => ({
            metricsSectionTitle: t("credit_insurance.metrics_section_title", {
                ns: "customers",
            }),
            healthIndex: t("credit_insurance_dashboard.health_index", {
                ns: "dashboard",
            }),
            atRiskExposure: t("credit_insurance_dashboard.at_risk_exposure", {
                ns: "dashboard",
            }),
            policyUsage: t("credit_insurance_dashboard.policy_usage_title", {
                ns: "dashboard",
            }),
            activePolicies: t("credit_insurance.active_policies", {
                ns: "customers",
            }),
            termsBreach: t("credit_insurance_dashboard.terms_breach", {
                ns: "dashboard",
            }),
            capacityGap: t("credit_insurance.capacity_gap", { ns: "customers" }),
            topUpValue: t("credit_insurance.top_up_value", { ns: "customers" }),
            topUpUsage: t("credit_insurance.top_up_usage", { ns: "customers" }),
            effectiveLimit: t("credit_insurance.effective_limit", {
                ns: "customers",
                defaultValue: "Effective Limit",
            }),
            effectiveUsage: t("credit_insurance.effective_usage", {
                ns: "customers",
                defaultValue: "Effective Usage",
            }),
            riskExposureChart: t(
                "credit_insurance_dashboard.policy_risk_exposure",
                { ns: "dashboard" }
            ),
            termsBreachReasonChart: t(
                "credit_insurance_dashboard.terms_breach_chart_subtitle",
                { ns: "dashboard" }
            ),
            zeroLineSubtitle: t("credit_insurance.risk_exposure_zero_line", {
                ns: "customers",
            }),
            noBreaches: t("credit_insurance.no_breaches", {
                ns: "customers",
            }),
            allPolicies: t("credit_insurance.all_policies", { ns: "customers" }),
        }),
        [t]
    );

    const showNoPolicyEmptyState = useMemo(
        () =>
            resolveCustomerDetailDashboardUx({
                customer,
                hasCreditInsurance: hasCreditProduct,
                hasCollection: true,
                hasChildren: false,
                explicitTab: null,
            }).showDashboardNoPolicyEmptyState,
        [customer, hasCreditProduct]
    );

    const kpiQuery = useQuery({
        queryKey: customerDashboardKpisQueryKey(
            customer.id,
            customer.account_id,
            selectedPolicyIdFromUrl
        ),
        queryFn: () =>
            fetchCustomerDashboardKpis(customer.id, selectedPolicyIdFromUrl),
        enabled: hasCreditProduct,
        staleTime: 60_000,
    });

    /** Capacity gap is always customer-wide; other KPI cards follow the policy filter. */
    const overallKpiQuery = useQuery({
        queryKey: customerDashboardKpisQueryKey(
            customer.id,
            customer.account_id,
            null
        ),
        queryFn: () => fetchCustomerDashboardKpis(customer.id, null),
        enabled: hasCreditProduct && selectedPolicyIdFromUrl != null,
        staleTime: 60_000,
    });

    const overallCapacityGapCards =
        selectedPolicyIdFromUrl != null
            ? (overallKpiQuery.data?.cards ?? null)
            : (kpiQuery.data?.cards ?? null);

    const kpiCardsLoading = kpiQuery.isLoading;
    const kpiCardsError = kpiQuery.isError;

    const creditKpis: CustomerCreditKpiCards | null = useMemo(
        () =>
            kpiQuery.data?.cards
                ? {
                      healthIndex: kpiQuery.data.cards.healthIndex,
                      atRiskExposure: kpiQuery.data.cards.atRiskExposure,
                      policyUsagePct: kpiQuery.data.cards.policyUsagePct,
                      activePolicyCount: kpiQuery.data.cards.activePolicyCount,
                      termsBreachOutstanding:
                          kpiQuery.data.cards.termsBreachOutstanding,
                      termsBreachInvoiceCount:
                          kpiQuery.data.cards.termsBreachInvoiceCount ?? 0,
                      capacityGapAmount: kpiQuery.data.cards.capacityGapAmount,
                      uninsuredAmount: kpiQuery.data.cards.uninsuredAmount,
                      accountCurrency: kpiQuery.data.cards.accountCurrency,
                      creditInsuranceSecondaryCurrency:
                          kpiQuery.data.cards.creditInsuranceSecondaryCurrency,
                      totalArSecondary: kpiQuery.data.cards.totalArSecondary,
                      capacityGapAmountSecondary:
                          kpiQuery.data.cards.capacityGapAmountSecondary,
                      capacityGapLimitCurrency:
                          kpiQuery.data.cards.capacityGapLimitCurrency,
                      uninsuredAmountSecondary:
                          kpiQuery.data.cards.uninsuredAmountSecondary,
                      termsBreachOutstandingSecondary:
                          kpiQuery.data.cards.termsBreachOutstandingSecondary,
                      atRiskExposureSecondary:
                          kpiQuery.data.cards.atRiskExposureSecondary,
                      isExcludedFromPolicy:
                          kpiQuery.data.cards.isExcludedFromPolicy,
                      topUpTotal: kpiQuery.data.cards.topUpTotal,
                      topUpUsagePct: kpiQuery.data.cards.topUpUsagePct,
                      effectiveLimit: kpiQuery.data.cards.effectiveLimit,
                      effectiveUsagePct: kpiQuery.data.cards.effectiveUsagePct,
                  }
                : null,
        [kpiQuery.data?.cards]
    );

    const riskExposureByPolicy = useMemo(
        () => kpiQuery.data?.riskExposureByPolicy ?? [],
        [kpiQuery.data?.riskExposureByPolicy]
    );

    const termsBreachReasonSlices = useMemo(() => {
        const dist = kpiQuery.data?.termsBreachReasonDistribution;
        const isExcluded = kpiQuery.data?.cards?.isExcludedFromPolicy === true;
        const emptyDist: TermsBreachCountByReason & { other: number } = {
            reportingBreach: 0,
            paymentTerm: 0,
            customerOverdueMep: 0,
            outdatedDcl: 0,
            invoiceAfterPolicyEnd: 0,
            other: 0,
        };
        const baseDist = dist ?? emptyDist;
        const slices = mapBreachDistributionToSlices(
            isExcluded
                ? {
                      ...baseDist,
                      other: Math.max(1, Number(baseDist.other ?? 0)),
                  }
                : baseDist
        );

        if (!isExcluded) {
            return slices;
        }

        return slices.map((slice) =>
            slice.key === "other"
                ? {
                      ...slice,
                      key: "excludedFromPolicy",
                      labelKey: "breach_type_customer_excluded_from_policy",
                  }
                : slice
        );
    }, [
        kpiQuery.data?.cards?.isExcludedFromPolicy,
        kpiQuery.data?.termsBreachReasonDistribution,
    ]);

    const vm = useMemo(
        () =>
            buildDashboardCardContract({
                customer,
                hasCreditProduct,
                selectedPolicyId: selectedPolicyIdFromUrl,
                trendStatus: "ready",
                trendPoints: [],
                creditKpis,
                riskExposureByPolicy,
                termsBreachReasonSlices,
            }),
        [
            customer,
            hasCreditProduct,
            selectedPolicyIdFromUrl,
            creditKpis,
            riskExposureByPolicy,
            termsBreachReasonSlices,
        ]
    );

    const accountCurrency =
        creditKpis?.accountCurrency?.trim() ||
        (customer as { Account?: { currency?: string } }).Account?.currency?.trim() ||
        undefined;

    const secondaryCurrency = creditKpis?.creditInsuranceSecondaryCurrency ?? null;

    const capacityGapDisplay = useMemo(
        () =>
            resolveCapacityGapDisplayAmounts(
                customer as Parameters<typeof resolveCapacityGapDisplayAmounts>[0],
                overallCapacityGapCards?.capacityGapAmount,
                {
                    kpiGapSecondary:
                        overallCapacityGapCards?.capacityGapAmountSecondary,
                    kpiSecondaryCurrency:
                        overallCapacityGapCards?.capacityGapLimitCurrency,
                }
            ),
        [
            customer,
            overallCapacityGapCards?.capacityGapAmount,
            overallCapacityGapCards?.capacityGapAmountSecondary,
            overallCapacityGapCards?.capacityGapLimitCurrency,
        ]
    );

    const periodKpiCards = kpiQuery.data?.cards ?? null;

    const healthMomentumLine = useMemo(() => {
        if (periodKpiCards == null) {
            return undefined;
        }
        const classification = periodKpiCards.healthMomentumClassification;
        const suppressed = periodKpiCards.healthMomentumSuppressed !== false;
        const peak = periodKpiCards.healthPeakValue;
        const peakDate = periodKpiCards.healthPeakDate;
        const current = periodKpiCards.healthCurrentValue;
        if (peak == null || current == null || !peakDate) {
            return suppressed
                ? t("tooltips.customer_credit_health_momentum_insufficient", {
                      ns: "dashboard",
                      defaultValue: "Insufficient days for trend",
                  })
                : undefined;
        }
        const peakLabel = formatDateForDisplay(
            new Date(`${peakDate}T12:00:00.000Z`),
            "date",
            dateLocale,
            timezone
        );
        const peakCurrent = t("tooltips.customer_credit_health_peak_current", {
            ns: "dashboard",
            defaultValue: "Peaked at {{peak}}% on {{date}}, now {{current}}%",
            peak: peak.toFixed(1),
            date: peakLabel,
            current: current.toFixed(1),
        });
        if (suppressed || classification == null) {
            return `${peakCurrent} · ${t(
                "tooltips.customer_credit_health_momentum_insufficient",
                {
                    ns: "dashboard",
                    defaultValue: "Insufficient days for trend",
                }
            )}`;
        }
        const badge = t(
            `tooltips.customer_credit_health_momentum_${classification}`,
            {
                ns: "dashboard",
                defaultValue: classification,
            }
        );
        return `${badge} · ${peakCurrent}`;
    }, [dateLocale, periodKpiCards, t, timezone]);

    const healthMomentumTooltip = useMemo(() => {
        const base = t("tooltips.customer_credit_metric_health_index", {
            ns: "dashboard",
        });
        const parts = [base];
        const slope = periodKpiCards?.healthMomentumSlope;
        if (slope != null && Number.isFinite(slope)) {
            parts.push(
                t("tooltips.customer_credit_health_slope_value", {
                    ns: "dashboard",
                    defaultValue: "Trailing slope: {{slope}} pts/day",
                    slope: slope.toFixed(3),
                })
            );
        }
        if (
            periodKpiCards?.breachDilutionClassification === "diluted" ||
            periodKpiCards?.breachDilutionClassification === "resolved"
        ) {
            parts.push(
                t("tooltips.customer_credit_metric_breach_dilution", {
                    ns: "dashboard",
                })
            );
        }
        return parts.join("\n\n");
    }, [
        periodKpiCards?.breachDilutionClassification,
        periodKpiCards?.healthMomentumSlope,
        t,
    ]);

    const MomentumIcon =
        periodKpiCards?.healthMomentumClassification === "improving"
            ? TrendingUpIcon
            : periodKpiCards?.healthMomentumClassification === "deteriorating"
              ? TrendingDownIcon
              : TrendingFlatIcon;

    const arVolatilitySparkline = useMemo(() => {
        const points = periodKpiCards?.arVolatilityDailyPctChanges ?? [];
        if (points.length === 0) {
            return null;
        }
        const width = 120;
        const height = 28;
        const maxAbs = Math.max(
            ...points.map((p) => Math.abs(p.pctChange)),
            0.01
        );
        const mid = height / 2;
        const barW = Math.max(1, width / points.length - 1);
        return (
            <svg
                width="100%"
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="none"
                aria-hidden
                style={{ display: "block" }}
            >
                <line
                    x1={0}
                    y1={mid}
                    x2={width}
                    y2={mid}
                    stroke="currentColor"
                    strokeOpacity={0.35}
                    strokeWidth={1}
                />
                {points.map((p, i) => {
                    const x = (i / points.length) * width;
                    const h = (Math.abs(p.pctChange) / maxAbs) * (mid - 1);
                    const y = p.pctChange >= 0 ? mid - h : mid;
                    return (
                        <rect
                            key={p.snapshotDate}
                            x={x}
                            y={y}
                            width={barW}
                            height={Math.max(1, h)}
                            fill={
                                p.extreme
                                    ? "currentColor"
                                    : "currentColor"
                            }
                            opacity={p.extreme ? 1 : 0.55}
                        />
                    );
                })}
            </svg>
        );
    }, [periodKpiCards?.arVolatilityDailyPctChanges]);

    const overshootSparkline = useMemo(() => {
        const points = periodKpiCards?.overshootDailyPts ?? [];
        if (points.length === 0) {
            return null;
        }
        const width = 120;
        const height = 28;
        const maxVal = Math.max(...points.map((p) => p.overshootPts), 0.01);
        const barW = Math.max(1, width / points.length - 1);
        return (
            <svg
                width="100%"
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="none"
                aria-hidden
                style={{ display: "block" }}
            >
                {points.map((p, i) => {
                    const x = (i / points.length) * width;
                    const h = (p.overshootPts / maxVal) * (height - 2);
                    return (
                        <rect
                            key={p.snapshotDate}
                            x={x}
                            y={height - h}
                            width={barW}
                            height={Math.max(1, h)}
                            fill="currentColor"
                            opacity={0.7}
                        />
                    );
                })}
            </svg>
        );
    }, [periodKpiCards?.overshootDailyPts]);

    const overshootSecondaryLine = useMemo(() => {
        if (periodKpiCards == null) {
            return undefined;
        }
        if ((periodKpiCards.overshootDaysWithLimit ?? 0) <= 0) {
            return undefined;
        }
        const avg = periodKpiCards.avgUsagePctPeriod;
        const peak = periodKpiCards.peakUsagePctPeriod;
        if (avg == null || peak == null) {
            return undefined;
        }
        return t("tooltips.customer_credit_overshoot_usage_subtext", {
            ns: "dashboard",
            defaultValue: "Avg usage {{avg}}% · Peak {{peak}}%",
            avg: avg.toFixed(1),
            peak: peak.toFixed(1),
        });
    }, [periodKpiCards, t]);

    const limitCappedBanner = useMemo(() => {
        if (periodKpiCards?.limitCapped !== true) {
            return null;
        }
        const arGrowth = periodKpiCards.limitCappedTotalArGrowthPct;
        const compliantGrowth = periodKpiCards.limitCappedCompliantGrowthPct;
        if (arGrowth == null || compliantGrowth == null) {
            return null;
        }
        return t("tooltips.customer_credit_limit_capped_banner", {
            ns: "dashboard",
            defaultValue:
                "Compliant exposure is capped near the limit — AR growth (+{{arGrowth}}%) is flowing into at-risk exposure, not compliant (+{{compliantGrowth}}%).",
            arGrowth: (arGrowth * 100).toFixed(1),
            compliantGrowth: (compliantGrowth * 100).toFixed(1),
        });
    }, [periodKpiCards, t]);

    const breachStreakLine = useMemo(() => {
        const status = periodKpiCards?.breachStreakStatus;
        if (status == null) {
            return undefined;
        }
        if (status === "none") {
            return t("tooltips.customer_credit_breach_streak_none", {
                ns: "dashboard",
                defaultValue: "No breach on record",
            });
        }
        const days = periodKpiCards?.breachStreakDays ?? 0;
        if (status === "open") {
            return t("tooltips.customer_credit_breach_streak_open", {
                ns: "dashboard",
                defaultValue: "In breach for {{days}} days",
                days,
            });
        }
        return t("tooltips.customer_credit_breach_streak_clean", {
            ns: "dashboard",
            defaultValue: "Breach-free for {{days}} days",
            days,
        });
    }, [periodKpiCards, t]);

    const capacityGapCardLoading =
        selectedPolicyIdFromUrl != null
            ? overallKpiQuery.isLoading || overallCapacityGapCards == null
            : kpiQuery.isLoading || !creditKpis;

    const formatAmount = useMemo(
        () => (amount: number | null | undefined) => {
            if (amount == null || !Number.isFinite(amount)) {
                return "—";
            }
            return formatMoney(amount, accountCurrency, {
                style: "symbol",
                locale,
                language: isRtl ? "he" : "en",
                wholeNumbers: true,
            });
        },
        [accountCurrency, isRtl, locale]
    );

    const breachDilutionBanner = useMemo(() => {
        const classification = periodKpiCards?.breachDilutionClassification;
        if (classification !== "diluted" && classification !== "resolved") {
            return null;
        }
        const breachFirst = periodKpiCards?.breachDilutionBreachFirst;
        const breachLast = periodKpiCards?.breachDilutionBreachLast;
        const arGrowth = periodKpiCards?.breachDilutionArGrowthPct;
        const breachChange = periodKpiCards?.breachDilutionBreachChangePct;
        if (classification === "diluted") {
            return t("tooltips.customer_credit_breach_diluted_banner", {
                ns: "dashboard",
                defaultValue:
                    "Health rose while breach $ stayed elevated ({{breachFirst}} → {{breachLast}}) and AR grew +{{arGrowth}}% — improvement looks diluted, not resolved.",
                breachFirst: formatAmount(breachFirst),
                breachLast: formatAmount(breachLast),
                arGrowth:
                    arGrowth == null ? "—" : (arGrowth * 100).toFixed(1),
            });
        }
        return t("tooltips.customer_credit_breach_resolved_banner", {
            ns: "dashboard",
            defaultValue:
                "Health rose as breach $ fell sharply ({{breachFirst}} → {{breachLast}}, {{breachChange}}%) — recovery looks resolved, not diluted by AR growth.",
            breachFirst: formatAmount(breachFirst),
            breachLast: formatAmount(breachLast),
            breachChange:
                breachChange == null
                    ? "—"
                    : (breachChange * 100).toFixed(1),
        });
    }, [formatAmount, periodKpiCards, t]);

    const formatCreditInsuranceAmount = useMemo(
        () => (
            amount: number | null | undefined,
            secondaryAmount?: number | null,
            secondaryCurrencyOverride?: string | null
        ) => {
            if (amount == null || !Number.isFinite(amount)) {
                return "—";
            }
            return formatMoneyDual(
                {
                    secondaryAmount: secondaryAmount ?? null,
                    secondaryCurrency:
                        secondaryCurrencyOverride ?? secondaryCurrency,
                    accountAmount: Math.max(0, Number(amount)),
                    accountCurrency: accountCurrency ?? "",
                },
                {
                    style: "symbol",
                    locale,
                    language: isRtl ? "he" : "en",
                    wholeNumbers: true,
                }
            );
        },
        [accountCurrency, secondaryCurrency, isRtl, locale]
    );

    const handlePolicyChange = (rawValue: string) => {
        const nextParams = new URLSearchParams(searchParams?.toString() ?? "");
        if (rawValue === "") {
            nextParams.delete("policyId");
        } else {
            nextParams.set("policyId", rawValue);
        }
        router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
    };

    const showTopUpMetrics =
        kpiCardsLoading ||
        (creditKpis?.topUpTotal != null && creditKpis.topUpTotal > 0);

    const termsBreachSupplementaryLine = useMemo(() => {
        if (
            kpiCardsLoading ||
            !creditKpis ||
            creditKpis.isExcludedFromPolicy !== true
        ) {
            return undefined;
        }
        const uninsuredLabel = t("credit_insurance.uninsured_amount", {
            ns: "customers",
        });
        return `${uninsuredLabel}: ${formatCreditInsuranceAmount(
            creditKpis.uninsuredAmount,
            creditKpis.uninsuredAmountSecondary
        )}`;
    }, [creditKpis, formatCreditInsuranceAmount, kpiCardsLoading, t]);

    if (showNoPolicyEmptyState) {
        return (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 4,
                    minHeight: 240,
                }}
            >
                <Box
                    sx={{
                        mb: 2,
                        color: "text.disabled",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <PolicyIcon sx={{ fontSize: { xs: 32, sm: 40, md: 60 } }} />
                </Box>
                <Typography
                    variant={isRtl ? "hebrewTitle" : "h6"}
                    sx={{
                        mb: 1,
                        color: "text.primary",
                        ...( !isRtl && {
                            textAlign: "center",
                            direction: "ltr",
                        }),
                    }}
                >
                    {t("credit_insurance.dashboard_no_policy_title", {
                        ns: "customers",
                    })}
                </Typography>
                <Typography
                    variant={isRtl ? "hebrewBodyText" : "body2"}
                    sx={{
                        color: "text.secondary",
                        textAlign: "center",
                        maxWidth: "28rem",
                        ...( !isRtl && {
                            direction: "ltr",
                        }),
                    }}
                >
                    {t("credit_insurance.dashboard_no_policy_description", {
                        ns: "customers",
                    })}
                </Typography>
            </Box>
        );
    }

    return (
        <Stack
            spacing={1.5}
            data-refresh-handler={onTimelineRefresh ? "enabled" : "disabled"}
        >
            {vm.eligibleForCreditSection && (
                <Stack spacing={1.5}>
                    <DashboardSectionHeader
                        icon={
                            <ShieldOutlinedIcon sx={DASHBOARD_SECTION_HEADER_ICON_SX} />
                        }
                        title={creditInsuranceLabels.metricsSectionTitle}
                        endAdornment={
                            vm.policyCards.length > 0 ? (
                                <TextField
                                    select
                                    size="small"
                                    value={
                                        vm.selectedPolicyId != null
                                            ? String(vm.selectedPolicyId)
                                            : ""
                                    }
                                    onChange={(event) =>
                                        handlePolicyChange(event.target.value)
                                    }
                                    slotProps={{
                                        select: { displayEmpty: true },
                                    }}
                                    sx={{ minWidth: 220 }}
                                >
                                    <MenuItem value="">
                                        {creditInsuranceLabels.allPolicies}
                                    </MenuItem>
                                    {vm.policyCards.map((policy) => (
                                        <MenuItem
                                            key={policy.policyId}
                                            value={String(policy.policyId)}
                                        >
                                            {policy.policyLabel}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            ) : undefined
                        }
                    />

                    {kpiCardsError && (
                        <Typography variant="body2" color="error.main">
                            {t("messages.error_message", { ns: "customers" })}
                        </Typography>
                    )}

                    <Box sx={METRIC_GRID_SX}>
                        <CreditMetricCard
                            icon={
                                periodKpiCards?.healthMomentumClassification !=
                                    null &&
                                periodKpiCards.healthMomentumSuppressed ===
                                    false ? (
                                    <MomentumIcon />
                                ) : (
                                    <FavoriteIcon />
                                )
                            }
                            iconAccent="healthIndex"
                            label={creditInsuranceLabels.healthIndex}
                            value={
                                kpiCardsLoading || !creditKpis
                                    ? t("messages.loading", { ns: "common" })
                                    : formatHealthIndexPercent(
                                          creditKpis.healthIndex,
                                          locale
                                      )
                            }
                            secondaryLine={healthMomentumLine}
                            forceSecondaryLineBelow
                            tooltip={healthMomentumTooltip}
                        />
                        {breachDilutionBanner ? (
                            <Alert
                                severity={
                                    periodKpiCards?.breachDilutionClassification ===
                                    "diluted"
                                        ? "warning"
                                        : "success"
                                }
                                icon={<WarningAmberIcon fontSize="inherit" />}
                                sx={{
                                    gridColumn: "1 / -1",
                                    width: "100%",
                                }}
                            >
                                {breachDilutionBanner}
                            </Alert>
                        ) : null}
                        <CreditMetricCard
                            icon={<WarningAmberIcon />}
                            iconAccent="atRisk"
                            label={creditInsuranceLabels.atRiskExposure}
                            value={
                                kpiCardsLoading || !creditKpis
                                    ? t("messages.loading", { ns: "common" })
                                    : formatCreditInsuranceAmount(
                                        creditKpis.atRiskExposure,
                                        creditKpis.atRiskExposureSecondary
                                    )
                            }
                            tooltip={t(
                                "tooltips.customer_credit_metric_at_risk_exposure",
                                { ns: "dashboard" }
                            )}
                        />
                        <CreditMetricCard
                            icon={<TrendingUpIcon />}
                            iconAccent="capacity"
                            label={creditInsuranceLabels.policyUsage}
                            value={
                                kpiCardsLoading || !creditKpis
                                    ? t("messages.loading", { ns: "common" })
                                    : formatUsagePct(creditKpis.policyUsagePct)
                            }
                            secondaryLine={
                                kpiQuery.data?.cards?.policyOpenArSharePct !=
                                    null &&
                                kpiQuery.data.cards.policyOpenArSharePolicyNumber
                                    ? t(
                                          "tooltips.customer_credit_policy_ar_share",
                                          {
                                              ns: "dashboard",
                                              pct: kpiQuery.data.cards.policyOpenArSharePct.toLocaleString(
                                                  locale,
                                                  { maximumFractionDigits: 1 }
                                              ),
                                              policy:
                                                  kpiQuery.data.cards
                                                      .policyOpenArSharePolicyNumber,
                                              defaultValue:
                                                  "{{pct}}% of policy {{policy}} open AR",
                                          }
                                      )
                                    : kpiQuery.data?.cards
                                            ?.limitBreachForecastStatus ===
                                          "projected" &&
                                      kpiQuery.data.cards
                                          .limitBreachForecastProjectedDate !=
                                          null
                                    ? t(
                                          "tooltips.customer_credit_forecast_projected",
                                          {
                                              ns: "dashboard",
                                              threshold:
                                                  kpiQuery.data.cards
                                                      .limitBreachForecastThresholdPct,
                                              date: kpiQuery.data.cards
                                                  .limitBreachForecastProjectedDate,
                                              defaultValue:
                                                  "Projected to reach {{threshold}}% by {{date}}",
                                          }
                                      )
                                    : undefined
                            }
                            forceSecondaryLineBelow
                            tooltip={t(
                                "tooltips.customer_credit_metric_policy_usage",
                                { ns: "dashboard" }
                            )}
                        />
                        <CreditMetricCard
                            icon={<PolicyIcon />}
                            iconAccent="compliant"
                            label={creditInsuranceLabels.activePolicies}
                            value={
                                kpiCardsLoading || !creditKpis
                                    ? t("messages.loading", { ns: "common" })
                                    : String(creditKpis.activePolicyCount)
                            }
                            tooltip={t(
                                "tooltips.customer_credit_metric_active_policies",
                                { ns: "dashboard" }
                            )}
                        />
                        <CreditMetricCard
                            icon={<GavelIcon />}
                            iconAccent="terms"
                            label={creditInsuranceLabels.termsBreach}
                            value={
                                kpiCardsLoading || !creditKpis
                                    ? t("messages.loading", { ns: "common" })
                                    : formatCreditInsuranceAmount(
                                        creditKpis.termsBreachOutstanding,
                                        creditKpis.termsBreachOutstandingSecondary
                                    )
                            }
                            tooltip={t(
                                "tooltips.customer_credit_metric_terms_breach",
                                { ns: "dashboard" }
                            )}
                            secondaryLine={breachStreakLine}
                            forceSecondaryLineBelow
                        />
                        <CreditMetricCard
                            icon={<AttachMoneyIcon />}
                            iconAccent="capacity"
                            label={creditInsuranceLabels.capacityGap}
                            value={
                                capacityGapCardLoading
                                    ? t("messages.loading", { ns: "common" })
                                    : formatCreditInsuranceAmount(
                                        capacityGapDisplay.primary,
                                        capacityGapDisplay.secondary,
                                        capacityGapDisplay.secondaryCurrency ??
                                        secondaryCurrency
                                    )
                            }
                            tooltip={t(
                                "tooltips.customer_credit_metric_capacity_gap",
                                { ns: "dashboard" }
                            )}
                        />
                        <CreditMetricCard
                            icon={<ShowChartIcon />}
                            iconAccent="atRisk"
                            label={t(
                                "credit_insurance_dashboard.ar_volatility",
                                {
                                    ns: "dashboard",
                                    defaultValue: "AR volatility",
                                }
                            )}
                            value={
                                kpiCardsLoading || periodKpiCards == null
                                    ? t("messages.loading", { ns: "common" })
                                    : periodKpiCards.arVolatilitySigmaPct ==
                                        null
                                      ? t(
                                            "tooltips.customer_credit_ar_volatility_no_data",
                                            {
                                                ns: "dashboard",
                                                defaultValue: "No data",
                                            }
                                        )
                                      : t(
                                            "tooltips.customer_credit_ar_volatility_sigma",
                                            {
                                                ns: "dashboard",
                                                defaultValue:
                                                    "σ {{sigma}}%",
                                                sigma: (
                                                    periodKpiCards.arVolatilitySigmaPct *
                                                    100
                                                ).toFixed(1),
                                            }
                                        )
                            }
                            secondaryLine={
                                periodKpiCards != null &&
                                (periodKpiCards.arVolatilityExtremeMoveCount ??
                                    0) > 0
                                    ? t(
                                          "tooltips.customer_credit_ar_volatility_extreme",
                                          {
                                              ns: "dashboard",
                                              defaultValue:
                                                  "{{count}} extreme single-day moves (±10%+)",
                                              count: periodKpiCards.arVolatilityExtremeMoveCount,
                                          }
                                      )
                                    : undefined
                            }
                            forceSecondaryLineBelow
                            footnote={
                                arVolatilitySparkline ? (
                                    <Tooltip
                                        title={t(
                                            "tooltips.customer_credit_ar_volatility_sparkline",
                                            {
                                                ns: "dashboard",
                                                defaultValue:
                                                    "Day-over-day % change (stale days excluded)",
                                            }
                                        )}
                                        placement="bottom"
                                        arrow
                                    >
                                        <Box
                                            component="span"
                                            sx={{
                                                display: "block",
                                                width: "100%",
                                                color: "text.secondary",
                                            }}
                                        >
                                            {arVolatilitySparkline}
                                        </Box>
                                    </Tooltip>
                                ) : undefined
                            }
                            tooltip={t(
                                "tooltips.customer_credit_metric_ar_volatility",
                                { ns: "dashboard" }
                            )}
                        />
                        <CreditMetricCard
                            icon={<TrendingUpIcon />}
                            iconAccent="reporting"
                            label={t(
                                "credit_insurance_dashboard.utilization_overshoot",
                                {
                                    ns: "dashboard",
                                    defaultValue: "Utilization overshoot",
                                }
                            )}
                            value={
                                kpiCardsLoading || periodKpiCards == null
                                    ? t("messages.loading", { ns: "common" })
                                    : (periodKpiCards.overshootDaysWithLimit ??
                                            0) <= 0 ||
                                        periodKpiCards.avgOvershootPts == null
                                      ? t(
                                            "tooltips.customer_credit_overshoot_no_data",
                                            {
                                                ns: "dashboard",
                                                defaultValue:
                                                    "No effective-limit days in range",
                                            }
                                        )
                                      : t(
                                            "tooltips.customer_credit_overshoot_avg",
                                            {
                                                ns: "dashboard",
                                                defaultValue:
                                                    "+{{pts}} pts avg",
                                                pts: periodKpiCards.avgOvershootPts.toFixed(
                                                    1
                                                ),
                                            }
                                        )
                            }
                            secondaryLine={overshootSecondaryLine}
                            forceSecondaryLineBelow
                            footnote={
                                overshootSparkline ? (
                                    <Tooltip
                                        title={t(
                                            "tooltips.customer_credit_overshoot_sparkline",
                                            {
                                                ns: "dashboard",
                                                defaultValue:
                                                    "Daily overshoot points (floored at 0 under 100%)",
                                            }
                                        )}
                                        placement="bottom"
                                        arrow
                                    >
                                        <Box
                                            component="span"
                                            sx={{
                                                display: "block",
                                                width: "100%",
                                                color: "text.secondary",
                                            }}
                                        >
                                            {overshootSparkline}
                                        </Box>
                                    </Tooltip>
                                ) : undefined
                            }
                            tooltip={t(
                                "tooltips.customer_credit_metric_utilization_overshoot",
                                { ns: "dashboard" }
                            )}
                        />
                        {showTopUpMetrics && (
                            <>
                                <CreditMetricCard
                                    icon={<SecurityIcon />}
                                    iconAccent="limitWarnings"
                                    label={creditInsuranceLabels.topUpValue}
                                    value={
                                        kpiCardsLoading || !creditKpis
                                            ? t("messages.loading", { ns: "common" })
                                            : formatCreditInsuranceAmount(
                                                creditKpis.topUpTotal
                                            )
                                    }
                                    tooltip={t(
                                        "tooltips.customer_credit_metric_top_up_value",
                                        { ns: "dashboard" }
                                    )}
                                />
                                <CreditMetricCard
                                    icon={<TrendingUpIcon />}
                                    iconAccent="reporting"
                                    label={creditInsuranceLabels.topUpUsage}
                                    value={
                                        kpiCardsLoading || !creditKpis
                                            ? t("messages.loading", { ns: "common" })
                                            : formatUsagePct(
                                                creditKpis.topUpUsagePct
                                            )
                                    }
                                    tooltip={t(
                                        "tooltips.customer_credit_metric_top_up_usage",
                                        { ns: "dashboard" }
                                    )}
                                />
                                <CreditMetricCard
                                    icon={<TrendingUpIcon />}
                                    iconAccent="compliant"
                                    label={creditInsuranceLabels.effectiveUsage}
                                    value={
                                        kpiCardsLoading || !creditKpis
                                            ? t("messages.loading", { ns: "common" })
                                            : formatUsagePct(
                                                creditKpis.effectiveUsagePct
                                            )
                                    }
                                    tooltip={t(
                                        "tooltips.customer_credit_metric_effective_usage",
                                        { ns: "dashboard" }
                                    )}
                                />
                            </>
                        )}
                    </Box>

                    {!kpiCardsLoading && !kpiCardsError && (
                        <>
                            {limitCappedBanner ? (
                                <Alert
                                    severity="warning"
                                    icon={<WarningAmberIcon fontSize="inherit" />}
                                    sx={{ width: "100%" }}
                                >
                                    {limitCappedBanner}
                                </Alert>
                            ) : null}
                            <CustomerDashboardCreditCharts
                                riskExposureByPolicy={vm.riskExposureByPolicy}
                                termsBreachReasonSlices={termsBreachReasonSlices}
                                formatAmount={(amount) => formatAmount(amount)}
                                zeroLineSubtitle={creditInsuranceLabels.zeroLineSubtitle}
                                noBreachesLabel={creditInsuranceLabels.noBreaches}
                                riskExposureTitle={creditInsuranceLabels.riskExposureChart}
                                riskExposureTooltip={t(
                                    "tooltips.customer_credit_risk_exposure_chart",
                                    { ns: "dashboard" }
                                )}
                                termsBreachReasonTitle={
                                    creditInsuranceLabels.termsBreachReasonChart
                                }
                                termsBreachReasonTooltip={t(
                                    "tooltips.customer_credit_terms_breach_chart",
                                    { ns: "dashboard" }
                                )}
                                termsBreachSupplementaryLine={
                                    termsBreachSupplementaryLine
                                }
                                limitCappedNormalizedSeries={
                                    periodKpiCards?.limitCapped
                                        ? periodKpiCards.limitCappedNormalizedSeries
                                        : undefined
                                }
                                isRtl={isRtl}
                            />
                        </>
                    )}
                </Stack>
            )}
        </Stack>
    );
};

export default React.memo(CustomerDashboardCards);
