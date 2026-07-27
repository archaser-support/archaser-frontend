"use client";

import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import FavoriteIcon from "@mui/icons-material/Favorite";
import GavelIcon from "@mui/icons-material/Gavel";
import PaidIcon from "@mui/icons-material/Paid";
import PolicyIcon from "@mui/icons-material/Policy";
import SecurityIcon from "@mui/icons-material/Security";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
    Box,
    MenuItem,
    Stack,
    TextField,
    Typography,
    useTheme,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { CreditMetricCard } from "@/app/[locale]/app/credit-dashboard/CreditMetricCard";
import {
    customerDashboardKpisQueryKey,
    fetchCustomerDashboardKpis,
} from "@/app/[locale]/app/customers/[customerId]/customerDashboardKpisQuery";
import type { TermsBreachCountByReason } from "@/server/services/creditInsurance/creditInsuranceDashboardService";
import { resolveCapacityGapDisplayAmounts } from "@/shared/creditInsurance/invoiceBucketAmounts";
import { resolveCustomerDetailDashboardUx } from "@/shared/customerDetailDashboardUx";
import { currencies } from "@/shared/data/common/currencies";
import { Customer } from "@/types/Customer";
import { formatAmountWithoutSymbol } from "@/utils/stringFormatters";

import {
    buildDashboardCardContract,
    type CustomerCreditKpiCards,
    type TermsBreachReasonSlice,
} from "./customerDashboardCardViewModel";
import { CustomerDashboardCreditCharts } from "./CustomerDashboardCreditCharts";
import { CustomerDashboardDailyCostChart } from "./CustomerDashboardDailyCostChart";
import { buildDailyCostChangeKpiDisplay } from "./customerDashboardDailyCostViewModel";
import {
    customerPolicyTrendQueryKey,
    fetchCustomerPolicyTrend,
} from "./customerDashboardPolicyTrendQuery";

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
    })).filter((slice) => slice.count > 0);
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

const getCurrencySymbol = (currencyCode: string): string => {
    const currency = currencies.find((c) => c.code === currencyCode);
    return currency?.symbol || currencyCode;
};

function formatDualCurrencyCreditInsuranceLine(
    langHebrew: boolean,
    accountAmount: number,
    accountCurrency: string,
    secondaryAmount: number | null | undefined,
    secondaryCurrency: string | null | undefined
): string {
    const amountLocale = langHebrew ? "he-IL" : "en-US";
    const acctSym = getCurrencySymbol(accountCurrency);
    const main = formatAmountWithoutSymbol(accountAmount, amountLocale);
    const mainPart = langHebrew ? `${main} ${acctSym}` : `${acctSym} ${main}`;
    if (
        secondaryCurrency &&
        secondaryAmount != null &&
        Number.isFinite(secondaryAmount)
    ) {
        const secSym = getCurrencySymbol(secondaryCurrency);
        const sec = formatAmountWithoutSymbol(secondaryAmount, amountLocale);
        const secPart = langHebrew ? `${sec} ${secSym}` : `${secSym} ${sec}`;
        return `${secPart} (${mainPart})`;
    }
    return mainPart;
}

const CustomerDashboardCards: React.FC<CustomerDashboardCardsProps> = ({
    customerId: _customerId,
    customer,
    hasCreditProduct,
    onTimelineRefresh,
}) => {
    const { t, i18n } = useTranslation(["customers", "common", "dashboard"]);
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const isRtl = i18n.language === "he";
    const locale = isRtl ? "he-IL" : "en-US";

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
            dailyCostChangeTitle: t(
                "credit_insurance_dashboard.daily_cost_title",
                { ns: "dashboard" }
            ),
            dailyCostChangeNotConfigured: t(
                "credit_insurance_dashboard.daily_cost_not_configured",
                { ns: "dashboard" }
            ),
            dailyCostChangeBreakdownPolicy: t(
                "credit_insurance_dashboard.daily_cost_breakdown_policy",
                { ns: "dashboard" }
            ),
            dailyCostChangeBreakdownTopUp: t(
                "credit_insurance_dashboard.daily_cost_breakdown_top_up",
                { ns: "dashboard" }
            ),
            dailyCostChangeChartTitle: t(
                "credit_insurance_dashboard.daily_cost_chart_title",
                { ns: "dashboard" }
            ),
            dailyCostChangeChartEmpty: t(
                "credit_insurance_dashboard.daily_cost_chart_empty",
                { ns: "dashboard" }
            ),
            dailyCostChangeChartPolicySeries: t(
                "credit_insurance_dashboard.daily_cost_chart_policy_series",
                { ns: "dashboard" }
            ),
            dailyCostChangeChartTopUpSeries: t(
                "credit_insurance_dashboard.daily_cost_chart_top_up_series",
                { ns: "dashboard" }
            ),
            dailyCostChangeChartTotalSeries: t(
                "credit_insurance_dashboard.daily_cost_chart_total_series",
                { ns: "dashboard" }
            ),
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

    const policyTrendQuery = useQuery({
        queryKey: customerPolicyTrendQueryKey(
            customer.id,
            customer.account_id,
            selectedPolicyIdFromUrl,
            90
        ),
        queryFn: () =>
            fetchCustomerPolicyTrend(customer.id, selectedPolicyIdFromUrl, 90),
        enabled: hasCreditProduct,
        staleTime: 60_000,
    });

    const kpiCardsLoading = kpiQuery.isLoading;
    const kpiCardsError = kpiQuery.isError;
    const dailyCostTrendLoading = policyTrendQuery.isLoading;

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
        const excludedSlice = {
            key: "excludedFromPolicy",
            labelKey: "breach_type_customer_excluded_from_policy",
            count: 1,
        };

        if (!dist) {
            return isExcluded ? [excludedSlice] : [];
        }

        const slices = mapBreachDistributionToSlices(
            isExcluded
                ? {
                      ...dist,
                      other: Math.max(1, Number(dist.other ?? 0)),
                  }
                : dist
        );

        if (!isExcluded) {
            return slices;
        }

        const remapped = slices.map((slice) =>
            slice.key === "other"
                ? {
                      ...slice,
                      key: "excludedFromPolicy",
                      labelKey: "breach_type_customer_excluded_from_policy",
                  }
                : slice
        );
        return remapped.length > 0 ? remapped : [excludedSlice];
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
        creditKpis?.accountCurrency ??
        (customer as { Account?: { currency?: string } }).Account?.currency;

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

    const capacityGapCardLoading =
        selectedPolicyIdFromUrl != null
            ? overallKpiQuery.isLoading || overallCapacityGapCards == null
            : kpiQuery.isLoading || !creditKpis;

    const formatAmount = useMemo(
        () => (amount: number | null | undefined) => {
            if (amount == null || !Number.isFinite(amount)) {
                return "—";
            }
            const base = formatAmountWithoutSymbol(amount, locale);
            return accountCurrency ? `${base} ${accountCurrency}` : base;
        },
        [accountCurrency, locale]
    );

    const formatCreditInsuranceAmount = useMemo(
        () => (
            amount: number | null | undefined,
            secondaryAmount?: number | null,
            secondaryCurrencyOverride?: string | null
        ) => {
            if (amount == null || !Number.isFinite(amount)) {
                return "—";
            }
            return formatDualCurrencyCreditInsuranceLine(
                isRtl,
                Math.max(0, Number(amount)),
                accountCurrency ?? "",
                secondaryAmount ?? null,
                secondaryCurrencyOverride ?? secondaryCurrency
            );
        },
        [accountCurrency, secondaryCurrency, isRtl]
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
    const showDailyInsuranceCostChange = false;

    const dailyCostKpiDisplay = useMemo(() => {
        const formatPriorDate = (isoDate: string) =>
            new Intl.DateTimeFormat(locale, {
                year: "numeric",
                month: "short",
                day: "numeric",
                timeZone: "UTC",
            }).format(new Date(`${isoDate}T00:00:00.000Z`));

        return buildDailyCostChangeKpiDisplay({
            latest: policyTrendQuery.data?.latest,
            locale,
            isRtl,
            policyLabel: creditInsuranceLabels.dailyCostChangeBreakdownPolicy,
            topUpLabel: creditInsuranceLabels.dailyCostChangeBreakdownTopUp,
            notConfiguredLabel: creditInsuranceLabels.dailyCostChangeNotConfigured,
            formatPriorDate,
        });
    }, [
        policyTrendQuery.data?.latest,
        locale,
        isRtl,
        creditInsuranceLabels.dailyCostChangeBreakdownPolicy,
        creditInsuranceLabels.dailyCostChangeBreakdownTopUp,
        creditInsuranceLabels.dailyCostChangeNotConfigured,
    ]);

    const dailyCostSubtitle = useMemo(() => {
        if (dailyCostKpiDisplay.subtitleDate == null) {
            return undefined;
        }
        return t("credit_insurance_dashboard.daily_cost_change_since_date", {
            ns: "dashboard",
            date: dailyCostKpiDisplay.subtitleDate,
        });
    }, [dailyCostKpiDisplay.subtitleDate, t]);

    const dailyCostChartPoints = useMemo(
        () => policyTrendQuery.data?.series ?? [],
        [policyTrendQuery.data?.series]
    );

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
                            icon={<FavoriteIcon />}
                            iconAccent="healthIndex"
                            label={creditInsuranceLabels.healthIndex}
                            value={
                                kpiCardsLoading || !creditKpis
                                    ? t("loading", { ns: "common" })
                                    : formatHealthIndexPercent(
                                        creditKpis.healthIndex,
                                        locale
                                    )
                            }
                        />
                        <CreditMetricCard
                            icon={<WarningAmberIcon />}
                            iconAccent="atRisk"
                            label={creditInsuranceLabels.atRiskExposure}
                            value={
                                kpiCardsLoading || !creditKpis
                                    ? t("loading", { ns: "common" })
                                    : formatCreditInsuranceAmount(
                                        creditKpis.atRiskExposure,
                                        creditKpis.atRiskExposureSecondary
                                    )
                            }
                        />
                        <CreditMetricCard
                            icon={<TrendingUpIcon />}
                            iconAccent="capacity"
                            label={creditInsuranceLabels.policyUsage}
                            value={
                                kpiCardsLoading || !creditKpis
                                    ? t("loading", { ns: "common" })
                                    : formatUsagePct(creditKpis.policyUsagePct)
                            }
                        />
                        <CreditMetricCard
                            icon={<PolicyIcon />}
                            iconAccent="compliant"
                            label={creditInsuranceLabels.activePolicies}
                            value={
                                kpiCardsLoading || !creditKpis
                                    ? t("loading", { ns: "common" })
                                    : String(creditKpis.activePolicyCount)
                            }
                        />
                        <CreditMetricCard
                            icon={<GavelIcon />}
                            iconAccent="terms"
                            label={creditInsuranceLabels.termsBreach}
                            value={
                                kpiCardsLoading || !creditKpis
                                    ? t("loading", { ns: "common" })
                                    : formatCreditInsuranceAmount(
                                        creditKpis.termsBreachOutstanding,
                                        creditKpis.termsBreachOutstandingSecondary
                                    )
                            }
                        />
                        <CreditMetricCard
                            icon={<AttachMoneyIcon />}
                            iconAccent="capacity"
                            label={creditInsuranceLabels.capacityGap}
                            value={
                                capacityGapCardLoading
                                    ? t("loading", { ns: "common" })
                                    : formatCreditInsuranceAmount(
                                        capacityGapDisplay.primary,
                                        capacityGapDisplay.secondary,
                                        capacityGapDisplay.secondaryCurrency ??
                                        secondaryCurrency
                                    )
                            }
                        />
                        {showDailyInsuranceCostChange && (
                            <CreditMetricCard
                                icon={<PaidIcon />}
                                iconAccent="reporting"
                                label={creditInsuranceLabels.dailyCostChangeTitle}
                                value={
                                    dailyCostTrendLoading
                                        ? t("loading", { ns: "common" })
                                        : dailyCostKpiDisplay.primaryValue
                                }
                                secondaryLine={
                                    dailyCostTrendLoading
                                        ? undefined
                                        : dailyCostKpiDisplay.breakdownLine ?? undefined
                                }
                                footnote={
                                    dailyCostTrendLoading
                                        ? undefined
                                        : dailyCostSubtitle
                                }
                            />
                        )}
                        {showTopUpMetrics && (
                            <>
                                <CreditMetricCard
                                    icon={<SecurityIcon />}
                                    iconAccent="limitWarnings"
                                    label={creditInsuranceLabels.topUpValue}
                                    value={
                                        kpiCardsLoading || !creditKpis
                                            ? t("loading", { ns: "common" })
                                            : formatCreditInsuranceAmount(
                                                creditKpis.topUpTotal
                                            )
                                    }
                                />
                                <CreditMetricCard
                                    icon={<TrendingUpIcon />}
                                    iconAccent="reporting"
                                    label={creditInsuranceLabels.topUpUsage}
                                    value={
                                        kpiCardsLoading || !creditKpis
                                            ? t("loading", { ns: "common" })
                                            : formatUsagePct(
                                                creditKpis.topUpUsagePct
                                            )
                                    }
                                />
                                <CreditMetricCard
                                    icon={<TrendingUpIcon />}
                                    iconAccent="compliant"
                                    label={creditInsuranceLabels.effectiveUsage}
                                    value={
                                        kpiCardsLoading || !creditKpis
                                            ? t("loading", { ns: "common" })
                                            : formatUsagePct(
                                                creditKpis.effectiveUsagePct
                                            )
                                    }
                                />
                            </>
                        )}
                    </Box>

                    {!kpiCardsLoading && !kpiCardsError && (
                        <>
                            <CustomerDashboardCreditCharts
                                riskExposureByPolicy={vm.riskExposureByPolicy}
                                termsBreachReasonSlices={
                                    termsBreachReasonSlices.length > 0
                                        ? termsBreachReasonSlices
                                        : BREACH_SLICE_ORDER.map(({ key, labelKey }) => ({
                                            key,
                                            labelKey,
                                            count: 0,
                                        }))
                                }
                                formatAmount={(amount) => formatAmount(amount)}
                                zeroLineSubtitle={creditInsuranceLabels.zeroLineSubtitle}
                                noBreachesLabel={creditInsuranceLabels.noBreaches}
                                riskExposureTitle={creditInsuranceLabels.riskExposureChart}
                                termsBreachReasonTitle={
                                    creditInsuranceLabels.termsBreachReasonChart
                                }
                                termsBreachSupplementaryLine={
                                    termsBreachSupplementaryLine
                                }
                                isRtl={isRtl}
                            />
                            {showDailyInsuranceCostChange && !dailyCostTrendLoading && (
                                <CustomerDashboardDailyCostChart
                                    points={dailyCostChartPoints}
                                    isRtl={isRtl}
                                    locale={locale}
                                    title={creditInsuranceLabels.dailyCostChangeChartTitle}
                                    emptyLabel={creditInsuranceLabels.dailyCostChangeChartEmpty}
                                    policySeriesLabel={
                                        creditInsuranceLabels.dailyCostChangeChartPolicySeries
                                    }
                                    topUpSeriesLabel={
                                        creditInsuranceLabels.dailyCostChangeChartTopUpSeries
                                    }
                                    totalSeriesLabel={
                                        creditInsuranceLabels.dailyCostChangeChartTotalSeries
                                    }
                                />
                            )}
                        </>
                    )}
                </Stack>
            )}
        </Stack>
    );
};

export default React.memo(CustomerDashboardCards);
