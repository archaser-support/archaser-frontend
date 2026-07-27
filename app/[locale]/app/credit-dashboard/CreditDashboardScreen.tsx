"use client";

import {
    AccountBalance as AccountBalanceIcon,
    Event as EventIcon,
    Flag as FlagIcon,
    Gavel as GavelIcon,
    Policy as PolicyOffIcon,
    Schedule as ScheduleIcon,
    Security as SecurityIcon,
    TrendingUp as TrendingUpIcon,
    VerifiedUser as VerifiedUserIcon,
    Warning as WarningIcon,
} from "@mui/icons-material";
import {
    Box,
    CircularProgress,
    Link,
    Typography,
    useTheme,
} from "@mui/material";
import { useMemo, useRef } from "react";
import { Trans, useTranslation } from "react-i18next";

import PageHeader from "@/components/PageHeader";
import BusinessUnitDashboardFilter from "@/shared/components/BusinessUnitDashboardFilter";
import { CreditInsuranceNavIcon } from "@/shared/components/CreditInsuranceNavIcon";
import type { CreditDashboardHistoryDelta, CreditDashboardHistoryInterval, CreditDashboardHistoryPoint, CreditDashboardMonthPct } from "@/server/services/creditInsurance/creditDashboardSnapshotService";
import type { CustomerPolicyUsageTrendResponse } from "@/server/services/creditInsurance/customerPolicyTrendService";
import type { CreditDashboardSummary } from "@/server/services/creditInsurance/creditInsuranceDashboardService";
import Seo from "@/shared/layout-components/seo/seo";
import {
    formatDateForDisplay,
    getUserDateLocale,
    getUserTimezone,
} from "@/utils/datetimeOperations";

import {
    CreditDashboardPolicySelect,
    type CreditDashboardPolicyItem,
} from "./CreditDashboardPolicySelect";
import { CreditDashboardExcludedCustomersFilter } from "./CreditDashboardExcludedCustomersFilter";
import { appendDashboardBusinessUnitId } from "@/shared/dashboard/dashboardBusinessUnitParams";
import { CreditDashboardTrendChart } from "./CreditDashboardTrendChart";
import { CreditHealthIndexGauge } from "./CreditHealthIndexGauge";
import { CreditMetricCard } from "./CreditMetricCard";
import { CreditPolicyUsageChart } from "./CreditPolicyUsageChart";
import { CreditTermsBreachBarChart } from "./CreditTermsBreachBarChart";
import { CreditPolicyLimitUsageTrendChart } from "./CreditPolicyLimitUsageTrendChart";

function fmt(n: number, language: string): string {
    return new Intl.NumberFormat(
        language === "he" ? "he-IL" : "en-US",
        { maximumFractionDigits: 0, minimumFractionDigits: 0 }
    ).format(n);
}

export type CreditDashboardScreenProps = {
    locale: string;
    policies: CreditDashboardPolicyItem[];
    policyIdForSummary: number | null;
    onPolicyScopeChange: (id: number | null) => void;
    selectedBusinessUnitId: number | null;
    onBusinessUnitScopeChange: (id: number | null) => void;
    includeNoPolicyExposure: boolean;
    onIncludeNoPolicyExposureChange: (value: boolean) => void;
    summary: CreditDashboardSummary | undefined;
    isSummaryLoading: boolean;
    isSummaryError: boolean;
    summaryError: Error | null;
    isSummaryFetching: boolean;
    historySeries: CreditDashboardHistoryPoint[];
    historyDelta: CreditDashboardHistoryDelta;
    historyLoadFailed: boolean;
    historyDays: number;
    trendInterval: CreditDashboardHistoryInterval;
    onTrendIntervalChange: (interval: CreditDashboardHistoryInterval) => void;
    monthPct: CreditDashboardMonthPct | null;
    topCustomerUsage: CustomerPolicyUsageTrendResponse | undefined;
    isTopCustomerUsageLoading: boolean;
    onNavigateReport: (path: string) => void;
};

export function CreditDashboardScreen({
    locale,
    policies,
    policyIdForSummary,
    onPolicyScopeChange,
    selectedBusinessUnitId,
    onBusinessUnitScopeChange,
    includeNoPolicyExposure,
    onIncludeNoPolicyExposureChange,
    summary,
    isSummaryLoading,
    isSummaryError,
    summaryError,
    isSummaryFetching,
    historySeries,
    historyDelta,
    historyLoadFailed,
    historyDays,
    trendInterval,
    onTrendIntervalChange,
    monthPct,
    topCustomerUsage,
    isTopCustomerUsageLoading,
    onNavigateReport,
}: CreditDashboardScreenProps) {
    const { t, i18n } = useTranslation(["common", "dashboard"]);
    const theme = useTheme();
    const language = i18n.language;
    const userLocale = useMemo(() => {
        const fallback = language?.startsWith("he") ? "he-IL" : "en-US";
        return getUserDateLocale(null, fallback);
    }, [language]);
    const userTimezone = useMemo(() => getUserTimezone(null), []);
    const headerRef = useRef<HTMLDivElement | null>(null);
    const pageTitle = t("credit_insurance_dashboard.page_title", {
        ns: "dashboard",
    });
    const pageDescription = t("credit_insurance_dashboard.page_description", {
        ns: "dashboard",
    });

    const dashboardShellSx = {
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        m: 0,
        p: 0,
        mt: { xs: -1, sm: -1.5 },
        mx: { xs: -1, sm: -1.5 },
        width: { xs: "calc(100% + 16px)", sm: "calc(100% + 24px)" },
        maxWidth: { xs: "calc(100% + 16px)", sm: "calc(100% + 24px)" },
    } as const;

    const stickyHeaderSx = {
        position: "sticky",
        top: { xs: "-8px", sm: "-12px" },
        left: 0,
        right: 0,
        zIndex: 30,
        bgcolor: "background.paper",
        flexShrink: 0,
        px: { xs: 1, sm: 1.5 },
        pt: { xs: 2, sm: 2.5 },
        pb: 0,
        m: 0,
        mt: 0,
        backgroundColor: "background.paper",
        width: "100%",
        maxWidth: "100%",
    } as const;

    const contentAreaSx = {
        flex: 1,
        width: "100%",
        position: "relative",
        px: { xs: 1, sm: 1.5 },
        scrollbarGutter: "stable",
    } as const;

    const policyExpirationAlerts = summary?.policyExpirationAlerts ?? [];
    const visiblePolicyExpirationAlerts =
        policyIdForSummary == null
            ? policyExpirationAlerts
            : policyExpirationAlerts.filter(
                (alert) => Number(alert.policyId) === Number(policyIdForSummary)
            );
    const urgentTopUpCount =
        summary?.topUp?.expiringWithinDays.urgentCustomerCount ?? 0;
    const showTopUpToolbarBanner =
        (summary?.hasTopUpPolicies ?? false) && urgentTopUpCount > 0;

    const isRtl = i18n.language === "he";

    if (isSummaryLoading) {
        return (
            <>
                <Seo title={pageTitle} />
                <Box sx={dashboardShellSx}>
                    <Box ref={headerRef} sx={stickyHeaderSx}>
                        <PageHeader
                            title={pageTitle}
                            description={pageDescription}
                            sticky={false}
                        />
                    </Box>
                    <Box sx={contentAreaSx}>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                minHeight: { xs: "300px", sm: "400px" },
                            }}
                        >
                            <CircularProgress color="primary" size={48} />
                        </Box>
                    </Box>
                </Box>
            </>
        );
    }

    if (isSummaryError) {
        return (
            <>
                <Seo title={pageTitle} />
                <Box sx={dashboardShellSx}>
                    <Box ref={headerRef} sx={stickyHeaderSx}>
                        <PageHeader
                            title={pageTitle}
                            description={pageDescription}
                            sticky={false}
                        />
                    </Box>
                    <Box sx={contentAreaSx}>
                        <Box sx={{ p: 3 }}>
                            <Typography color="error">
                                {summaryError?.message === "forbidden"
                                    ? t("messages.credit_dashboard_forbidden", {
                                        ns: "dashboard",
                                    })
                                    : t("messages.credit_dashboard_load_failed", {
                                        ns: "dashboard",
                                    })}
                            </Typography>
                        </Box>
                    </Box>
                </Box>
            </>
        );
    }

    const s = summary;
    if (
        !s ||
        s.reportingCountdown == null ||
        s.termsBreach == null ||
        s.withoutPolicy == null ||
        s.capacityGap == null
    ) {
        return null;
    }

    const reportHref = (reportType: string, extra?: Record<string, string>) => {
        const sp = new URLSearchParams({ type: reportType });
        if (policyIdForSummary != null) {
            sp.set("policyId", String(policyIdForSummary));
        }
        if (extra) {
            for (const [key, value] of Object.entries(extra)) {
                sp.set(key, value);
            }
        }
        if (!includeNoPolicyExposure) {
            sp.set("includeNoPolicyExposure", "0");
        }
        appendDashboardBusinessUnitId(sp, selectedBusinessUnitId);
        return `/${locale}/app/credit-dashboard/report?${sp.toString()}`;
    };

    const showTopUpMetrics = s.hasTopUpPolicies && s.topUp != null;

    const notificationBannerSx = {
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 0.75,
        borderRadius: 2,
        bgcolor: "error.light",
        color: "#fff",
        direction: isRtl ? "rtl" : "ltr",
        flexWrap: "wrap",
        flexShrink: 0,
        width: "fit-content",
        maxWidth: "100%",
    } as const;

    const notificationTypeRowSx = {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: theme.spacing(1),
        width: "100%",
        alignItems: "flex-start",
    } as const;

    const notificationTextSx = {
        fontWeight: 500,
        whiteSpace: "normal",
        wordBreak: "break-word",
    } as const;

    const hasToolbarNotifications =
        visiblePolicyExpirationAlerts.length > 0 || showTopUpToolbarBanner;

    return (
        <>
            <Seo title={pageTitle} />
            <Box sx={dashboardShellSx}>
                <Box ref={headerRef} sx={stickyHeaderSx}>
                    <PageHeader
                        title={pageTitle}
                        description={pageDescription}
                        sticky={false}
                    />
                </Box>
                <Box sx={contentAreaSx}>
                    <Box
                        sx={{
                            pb: 2,
                            display: "flex",
                            flexDirection: "column",
                            gap: theme.spacing(2),
                        }}
                    >
                        <Box
                            className="endless-scroll-toolbar"
                            sx={{
                                pt: theme.spacing(1.5),
                                pb: theme.spacing(0.625),
                                px: 0,
                                backgroundColor: "transparent",
                                display: "flex",
                                flexDirection: "row",
                                gap: theme.spacing(1),
                                alignItems: "flex-start",
                                minHeight: "56px",
                                direction: isRtl ? "rtl" : "ltr",
                                flexWrap: "wrap",
                                overflow: "visible",
                                justifyContent: "flex-start",
                                boxSizing: "border-box",
                                boxShadow: "none",
                            }}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "row",
                                    gap: theme.spacing(1),
                                    flexShrink: 0,
                                    alignItems: "flex-start",
                                }}
                            >
                                <BusinessUnitDashboardFilter
                                    value={selectedBusinessUnitId}
                                    onChange={onBusinessUnitScopeChange}
                                />
                                {policies.length > 1 ? (
                                    <CreditDashboardPolicySelect
                                        policies={policies}
                                        value={policyIdForSummary}
                                        onChange={onPolicyScopeChange}
                                    />
                                ) : null}
                                <CreditDashboardExcludedCustomersFilter
                                    value={includeNoPolicyExposure}
                                    onChange={onIncludeNoPolicyExposureChange}
                                />
                            </Box>
                            {hasToolbarNotifications ? (
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: theme.spacing(1),
                                        flex: 1,
                                        minWidth: 0,
                                        maxWidth: "100%",
                                        alignItems: "flex-start",
                                    }}
                                >
                                    {visiblePolicyExpirationAlerts.length >
                                    0 ? (
                                        <Box sx={notificationTypeRowSx}>
                                            {visiblePolicyExpirationAlerts.map(
                                                (alert) => (
                                                    <Box
                                                        key={alert.policyId}
                                                        sx={
                                                            notificationBannerSx
                                                        }
                                                    >
                                                        <WarningIcon
                                                            fontSize="small"
                                                            sx={{
                                                                flexShrink: 0,
                                                            }}
                                                        />
                                                        <Typography
                                                            variant="body2"
                                                            sx={
                                                                notificationTextSx
                                                            }
                                                        >
                                                            {policyIdForSummary ==
                                                            null ? (
                                                                <Trans
                                                                    i18nKey="credit_insurance_dashboard.policy_expired_with_policy"
                                                                    ns="dashboard"
                                                                    values={{
                                                                        policy:
                                                                            alert.policyNumber ??
                                                                            t(
                                                                                "credit_insurance_dashboard.policy_number_fallback",
                                                                                {
                                                                                    ns: "dashboard",
                                                                                    id: alert.policyId,
                                                                                }
                                                                            ),
                                                                        end_date:
                                                                            formatDateForDisplay(
                                                                                alert.endDate,
                                                                                "date",
                                                                                userLocale,
                                                                                userTimezone
                                                                            ),
                                                                    }}
                                                                    components={{
                                                                        policy: (
                                                                            <Box
                                                                                component="span"
                                                                                sx={{
                                                                                    fontWeight: 700,
                                                                                }}
                                                                            />
                                                                        ),
                                                                    }}
                                                                />
                                                            ) : (
                                                                t(
                                                                    "credit_insurance_dashboard.policy_expired_single",
                                                                    {
                                                                        ns: "dashboard",
                                                                        end_date:
                                                                            formatDateForDisplay(
                                                                                alert.endDate,
                                                                                "date",
                                                                                userLocale,
                                                                                userTimezone
                                                                            ),
                                                                    }
                                                                )
                                                            )}
                                                        </Typography>
                                                    </Box>
                                                )
                                            )}
                                        </Box>
                                    ) : null}
                                    {showTopUpToolbarBanner ? (
                                        <Box sx={notificationTypeRowSx}>
                                            <Link
                                                href={reportHref(
                                                    "top_up_expiring",
                                                    {
                                                        withinDays: "7",
                                                    }
                                                )}
                                                underline="none"
                                                sx={notificationBannerSx}
                                            >
                                                <WarningIcon
                                                    fontSize="small"
                                                    sx={{ flexShrink: 0 }}
                                                />
                                                <Typography
                                                    variant="body2"
                                                    sx={notificationTextSx}
                                                >
                                                    {t(
                                                        "credit_insurance_dashboard.top_ups_expiring_urgent_banner",
                                                        {
                                                            ns: "dashboard",
                                                            count: urgentTopUpCount,
                                                        }
                                                    )}
                                                </Typography>
                                            </Link>
                                        </Box>
                                    ) : null}
                                </Box>
                            ) : null}
                        </Box>
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 2,
                                direction: isRtl ? "rtl" : "ltr",
                            }}
                        >
                            <Box
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: {
                                        xs: "1fr",
                                        sm: "repeat(2, minmax(0, 1fr))",
                                        lg: "repeat(3, minmax(0, 1fr))",
                                    },
                                    alignItems: "stretch",
                                    gap: 2,
                                    direction: isRtl ? "rtl" : "ltr",
                                }}
                            >
                                <CreditMetricCard
                                    icon={<AccountBalanceIcon />}
                                    iconAccent="receivables"
                                    label={t(
                                        "credit_insurance_dashboard.total_receivables",
                                        { ns: "dashboard" }
                                    )}
                                    value={fmt(
                                        s.totalReceivables,
                                        language
                                    )}
                                    tooltip={t(
                                        "tooltips.credit_insurance_metric_total_receivables",
                                        { ns: "dashboard" }
                                    )}
                                    changePct={monthPct?.totalReceivables}
                                    changePolarity="up-is-good"
                                />
                                <CreditMetricCard
                                    icon={<VerifiedUserIcon />}
                                    iconAccent="compliant"
                                    label={t(
                                        "credit_insurance_dashboard.compliant_exposure",
                                        { ns: "dashboard" }
                                    )}
                                    value={fmt(
                                        s.compliantExposure,
                                        language
                                    )}
                                    tooltip={t(
                                        "tooltips.credit_insurance_metric_compliant_exposure",
                                        { ns: "dashboard" }
                                    )}
                                    changePct={monthPct?.compliantExposure}
                                    changePolarity="up-is-good"
                                />
                                <CreditMetricCard
                                    icon={<WarningIcon />}
                                    iconAccent="atRisk"
                                    label={t(
                                        "credit_insurance_dashboard.at_risk_exposure",
                                        { ns: "dashboard" }
                                    )}
                                    value={fmt(
                                        s.atRiskExposure,
                                        language
                                    )}
                                    tooltip={t(
                                        "tooltips.credit_insurance_metric_at_risk_exposure",
                                        { ns: "dashboard" }
                                    )}
                                    changePct={monthPct?.atRiskExposure}
                                    changePolarity="up-is-bad"
                                />
                            </Box>

                            <Box
                                sx={{
                                    display: { xs: "flex", md: "grid" },
                                    flexDirection: { xs: "column", md: undefined },
                                    gridTemplateColumns: {
                                        md: "minmax(0, 380px) minmax(0, 1fr)",
                                    },
                                    alignItems: "stretch",
                                    gap: 2,
                                    width: "100%",
                                    minWidth: 0,
                                    /** Mirror column placement only — do not swap track sizes (RTL + swapped cols double-inverts widths). */
                                    direction: isRtl ? "rtl" : "ltr",
                                }}
                            >
                                <Box
                                    sx={{
                                        minWidth: 0,
                                        width: "100%",
                                        display: "flex",
                                        flexDirection: "column",
                                    }}
                                >
                                    <CreditHealthIndexGauge
                                        compact
                                        healthIndex={s.healthIndex}
                                        loading={isSummaryFetching}
                                    />
                                </Box>
                                <Box
                                    sx={{
                                        minWidth: 0,
                                        width: "100%",
                                        display: "flex",
                                        flexDirection: "column",
                                    }}
                                >
                                    {historyLoadFailed ? (
                                        <Typography
                                            color="error"
                                            variant="body2"
                                            sx={{ mb: 1, flexShrink: 0 }}
                                        >
                                            {t(
                                                "credit_insurance_dashboard.trend_history_load_failed",
                                                {
                                                    ns: "dashboard",
                                                    path: "/api/credit-insurance/summary-history",
                                                }
                                            )}
                                        </Typography>
                                    ) : null}
                                    <CreditDashboardTrendChart
                                        compact
                                        series={historySeries}
                                        delta={historyDelta}
                                        interval={trendInterval}
                                        historyDays={historyDays}
                                        onIntervalChange={onTrendIntervalChange}
                                    />
                                </Box>
                            </Box>

                            <Box
                                display="grid"
                                gap={2}
                                sx={{
                                    gridTemplateColumns: {
                                        xs: "1fr",
                                        sm: "1fr 1fr",
                                        md: showTopUpMetrics
                                            ? "repeat(4, minmax(0, 1fr))"
                                            : "repeat(3, minmax(0, 1fr))",
                                    },
                                }}
                            >
                                <CreditMetricCard
                                    icon={<EventIcon />}
                                    iconAccent="reporting"
                                    label={t(
                                        "credit_insurance_dashboard.reporting_countdown",
                                        { ns: "dashboard" }
                                    )}
                                    value={fmt(
                                        s.reportingCountdown.invoiceCount,
                                        language
                                    )}
                                    footnote={t(
                                        "credit_insurance_dashboard.reporting_countdown_subtitle",
                                        {
                                            ns: "dashboard",
                                            days: s.reportingCountdown
                                                .windowDays,
                                        }
                                    )}
                                    tooltip={t(
                                        "tooltips.credit_insurance_metric_reporting_countdown",
                                        { ns: "dashboard" }
                                    )}
                                    changePct={monthPct?.reportingCountdownInvoiceCount}
                                    changePolarity="up-is-bad"
                                    onClick={() =>
                                        onNavigateReport(reportHref("reporting"))
                                    }
                                />
                                <CreditMetricCard
                                    icon={<FlagIcon />}
                                    iconAccent="limitWarnings"
                                    label={t(
                                        "credit_insurance_dashboard.limit_warnings",
                                        { ns: "dashboard" }
                                    )}
                                    value={fmt(
                                        s.limitWarnings.customerCount,
                                        language
                                    )}
                                    footnote={t(
                                        "credit_insurance_dashboard.limit_warnings_subtitle",
                                        {
                                            ns: "dashboard",
                                            threshold_pct:
                                                s.limitWarnings.thresholdPct,
                                            score_warn_days:
                                                s.limitWarnings.scoreWarnDays,
                                        }
                                    )}
                                    tooltip={t(
                                        "tooltips.credit_insurance_metric_limit_warnings",
                                        { ns: "dashboard" }
                                    )}
                                    changePct={monthPct?.limitWarningsCustomerCount}
                                    changePolarity="up-is-bad"
                                    onClick={() =>
                                        onNavigateReport(
                                            reportHref("limit_warning")
                                        )
                                    }
                                />
                                {showTopUpMetrics && s.topUp ? (
                                    <>
                                        <CreditMetricCard
                                            icon={<SecurityIcon />}
                                            iconAccent="limitWarnings"
                                            label={t(
                                                "credit_insurance_dashboard.active_top_up_cover",
                                                { ns: "dashboard" }
                                            )}
                                            value={fmt(
                                                s.topUp.activeCoverTotal,
                                                language
                                            )}
                                            footnote={
                                                s.topUp.coverDeclinedDueToLimit
                                                    .customerCount > 0
                                                    ? t(
                                                        "credit_insurance_dashboard.active_top_up_cover_footnote_declined",
                                                        {
                                                            ns: "dashboard",
                                                            count: s.topUp
                                                                .coverDeclinedDueToLimit
                                                                .customerCount,
                                                            amount: fmt(
                                                                s.topUp
                                                                    .coverDeclinedDueToLimit
                                                                    .coverLostTotal,
                                                                language
                                                            ),
                                                        }
                                                    )
                                                    : t(
                                                        "credit_insurance_dashboard.active_top_up_cover_footnote",
                                                        {
                                                            ns: "dashboard",
                                                            count: s.topUp
                                                                .customersWithActiveCount,
                                                        }
                                                    )
                                            }
                                            footnoteTone={
                                                s.topUp.coverDeclinedDueToLimit
                                                    .customerCount > 0
                                                    ? "error"
                                                    : "default"
                                            }
                                            tooltip={t(
                                                "tooltips.credit_insurance_metric_active_top_up_cover",
                                                { ns: "dashboard" }
                                            )}
                                            onClick={() =>
                                                onNavigateReport(
                                                    reportHref(
                                                        "top_up",
                                                        (s.topUp
                                                            ?.coverDeclinedDueToLimit
                                                            .customerCount ?? 0) >
                                                            0
                                                            ? {
                                                                reason: "limit_declined",
                                                            }
                                                            : undefined
                                                    )
                                                )
                                            }
                                        />
                                    </>
                                ) : null}
                                <CreditMetricCard
                                    icon={<WarningIcon />}
                                    iconAccent="zeroLimit"
                                    label={t(
                                        "credit_insurance_dashboard.zero_limit_warning",
                                        { ns: "dashboard" }
                                    )}
                                    value={fmt(
                                        s.zeroLimitWarnings.customerCount,
                                        language
                                    )}
                                    footnote={t(
                                        "credit_insurance_dashboard.zero_limit_warning_subtitle",
                                        { ns: "dashboard" }
                                    )}
                                    tooltip={t(
                                        "tooltips.credit_insurance_metric_zero_limit_warning",
                                        { ns: "dashboard" }
                                    )}
                                    onClick={() =>
                                        onNavigateReport(
                                            reportHref("zero_limit_warning")
                                        )
                                    }
                                />
                            </Box>

                            <Box
                                display="grid"
                                gap={2}
                                sx={{
                                    gridTemplateColumns: {
                                        xs: "1fr",
                                        lg: "1fr 1fr",
                                    },
                                    alignItems: "stretch",
                                }}
                            >
                                <CreditTermsBreachBarChart
                                    countByReason={s.termsBreach.countByReason}
                                    onOpenReport={() =>
                                        onNavigateReport(reportHref("terms"))
                                    }
                                />
                                <Box
                                    display="grid"
                                    columnGap={2}
                                    rowGap={3}
                                    sx={{
                                        gridTemplateColumns: {
                                            xs: "1fr",
                                            sm: "repeat(2, minmax(0, 1fr))",
                                        },
                                    }}
                                >
                                    <CreditMetricCard
                                        icon={<TrendingUpIcon />}
                                        iconAccent="capacity"
                                        label={t(
                                            "credit_insurance_dashboard.capacity_gap",
                                            { ns: "dashboard" }
                                        )}
                                        value={fmt(
                                            s.capacityGap.totalAmount,
                                            language
                                        )}
                                        secondaryLine={t(
                                            "credit_insurance_dashboard.capacity_gap_customers_over_limit",
                                            {
                                                ns: "dashboard",
                                                count: s.capacityGap
                                                    .customerOverLimitCount,
                                            }
                                        )}
                                        tooltip={t(
                                            "tooltips.credit_insurance_metric_capacity_gap",
                                            { ns: "dashboard" }
                                        )}
                                        changePct={monthPct?.capacityGapTotalAmount}
                                        changePolarity="up-is-bad"
                                        onClick={() =>
                                            onNavigateReport(reportHref("capacity"))
                                        }
                                    />
                                    <CreditMetricCard
                                        icon={<ScheduleIcon />}
                                        iconAccent="overdue"
                                        label={t(
                                            "credit_insurance_dashboard.overdue_block",
                                            { ns: "dashboard" }
                                        )}
                                        value={fmt(
                                            s.overdueBlockCustomerCount,
                                            language
                                        )}
                                        footnote={t(
                                            "credit_insurance_dashboard.overdue_block_subtitle",
                                            { ns: "dashboard" }
                                        )}
                                        footnoteTone="error"
                                        tooltip={t(
                                            "tooltips.credit_insurance_metric_overdue_block",
                                            { ns: "dashboard" }
                                        )}
                                        changePct={monthPct?.overdueBlockCustomerCount}
                                        changePolarity="up-is-bad"
                                        onClick={() =>
                                            onNavigateReport(reportHref("overdue"))
                                        }
                                    />
                                    <CreditMetricCard
                                        icon={<GavelIcon />}
                                        iconAccent="terms"
                                        label={t(
                                            "credit_insurance_dashboard.terms_breach",
                                            { ns: "dashboard" }
                                        )}
                                        value={fmt(
                                            s.termsBreach.totalAmount,
                                            language
                                        )}
                                        secondaryLine={t(
                                            "credit_insurance_dashboard.terms_breach_invoices",
                                            {
                                                ns: "dashboard",
                                                count: s.termsBreach.invoiceCount,
                                            }
                                        )}
                                        tooltip={t(
                                            "tooltips.credit_insurance_metric_terms_breach_amount",
                                            { ns: "dashboard" }
                                        )}
                                        changePct={monthPct?.termsBreachTotalAmount}
                                        changePolarity="up-is-bad"
                                        onClick={() =>
                                            onNavigateReport(reportHref("terms"))
                                        }
                                    />
                                    <CreditMetricCard
                                        icon={<PolicyOffIcon />}
                                        iconAccent="noPolicy"
                                        label={t(
                                            "credit_insurance_dashboard.no_policy_exposure",
                                            { ns: "dashboard" }
                                        )}
                                        value={fmt(
                                            s.withoutPolicy.totalAmount,
                                            language
                                        )}
                                        secondaryLine={t(
                                            "credit_insurance_dashboard.no_policy_customers",
                                            {
                                                ns: "dashboard",
                                                count: s.withoutPolicy
                                                    .customerCount,
                                            }
                                        )}
                                        secondaryLineNoWrap
                                        tooltip={t(
                                            "tooltips.credit_insurance_metric_no_policy_exposure",
                                            { ns: "dashboard" }
                                        )}
                                        changePct={
                                            policyIdForSummary != null
                                                ? null
                                                : monthPct?.withoutPolicyTotalAmount
                                        }
                                        changePolarity="up-is-bad"
                                        onClick={() =>
                                            onNavigateReport(
                                                reportHref("no_policy_exposure")
                                            )
                                        }
                                    />
                                </Box>
                            </Box>
                            <Box
                                display="grid"
                                gap={2}
                                sx={{
                                    gridTemplateColumns: {
                                        xs: "1fr",
                                        md: "1fr 1fr",
                                    },
                                    alignItems: "stretch",
                                }}
                            >
                                <Box sx={{ gridColumn: { xs: "1", md: "1 / 2" } }}>
                                    <CreditPolicyUsageChart
                                        combined={s.policyUsage.combined}
                                        named={s.policyUsage.named}
                                        dclSdl={s.policyUsage.dclSdl}
                                        topUpCoverTotal={
                                            showTopUpMetrics
                                                ? s.policyUsage.topUpCoverTotal
                                                : undefined
                                        }
                                        topUpCoverUsed={
                                            showTopUpMetrics
                                                ? s.policyUsage.topUpCoverUsed
                                                : undefined
                                        }
                                        topUpCoverRemaining={
                                            showTopUpMetrics
                                                ? s.policyUsage.topUpCoverRemaining
                                                : undefined
                                        }
                                        topUpCoverOverEffective={
                                            showTopUpMetrics
                                                ? s.policyUsage.topUpCoverOverEffective
                                                : undefined
                                        }
                                    />
                                </Box>
                                <Box sx={{ gridColumn: { xs: "1", md: "2 / 3" } }}>
                                    <CreditPolicyLimitUsageTrendChart
                                        data={topCustomerUsage}
                                        isLoading={isTopCustomerUsageLoading}
                                    />
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                </Box>
            </Box>
        </>
    );
}
