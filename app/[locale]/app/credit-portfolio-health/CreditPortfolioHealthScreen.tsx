"use client";

import {
    Box,
    Button,
    CircularProgress,
    LinearProgress,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import { useSession } from "next-auth/react";
import { CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import PageHeader from "@/components/PageHeader";
import DateRangePicker from "@/app/[locale]/app/operation-dashboard/(cards)/DateRangePicker";
import {
    CreditDashboardPolicySelect,
    type CreditDashboardPolicyItem,
} from "@/app/[locale]/app/credit-dashboard/CreditDashboardPolicySelect";
import { CreditDashboardExcludedCustomersFilter } from "@/app/[locale]/app/credit-dashboard/CreditDashboardExcludedCustomersFilter";
import BusinessUnitDashboardFilter from "@/shared/components/BusinessUnitDashboardFilter";
import { resolveGenerateModalAutoOpen } from "@/shared/creditInsurance/generateModalAttention";
import {
    countInclusiveCalendarDays,
    PORTFOLIO_HEALTH_LARGE_RANGE_DAYS,
} from "@/shared/creditInsurance/portfolioHealthDateRange";
import AppDialog from "@/shared/layout-components/modal/AppDialog";
import Seo from "@/shared/layout-components/seo/seo";
import {
    formatDateForDisplay,
    getUserDateLocale,
    getUserTimezone,
} from "@/utils/datetimeOperations";
import { getRTLTooltipProps } from "@/utils/reportFieldUtils";
import type {
    CreditAsOfBackfillJobStatus,
    CreditAsOfBackfillJobView,
    CreditPortfolioHealthResponse,
} from "@/types/creditInsurance";

import { CostsSectionView } from "./CostsSectionView";
import { PolicySummarySectionView } from "./PolicySummarySectionView";
import { CPH } from "./designTokens";
import { spaceGrotesk } from "./fonts";
import layout from "./islandLayout.module.css";
import islandMotion from "./islandMotion.module.css";
import { NoCoverageSectionView } from "./NoCoverageSectionView";
import {
    PillTabs,
    type PortfolioHealthTabId,
} from "./PillTabs";
import { PortfolioHealthIntroOverlay } from "./PortfolioHealthIntroOverlay";
import { PortfolioHealthSectionView } from "./PortfolioHealthSectionView";
import { UtilizationSectionView } from "./UtilizationSectionView";
import { usePortfolioHealthIntro } from "./usePortfolioHealthIntro";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export type CreditPortfolioHealthScreenProps = {
    policies: CreditDashboardPolicyItem[];
    policyId: number | null;
    onPolicyScopeChange: (id: number | null) => void;
    selectedBusinessUnitId: number | null;
    onBusinessUnitScopeChange: (id: number | null) => void;
    includeNoPolicyExposure: boolean;
    onIncludeNoPolicyExposureChange: (value: boolean) => void;
    startDate: Date;
    endDate: Date;
    onStartDateChange: (date: Date) => void;
    onEndDateChange: (date: Date) => void;
    onDateRangeChange: (start: Date, end: Date) => void;
    activeTab: PortfolioHealthTabId;
    onTabChange: (tab: PortfolioHealthTabId) => void;
    data: CreditPortfolioHealthResponse | undefined;
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
    error: Error | null;
    backfillJob: CreditAsOfBackfillJobView | undefined;
    onGenerateSnapshots: () => void;
    onGenerateRecentSnapshots: () => void;
    onStopGenerate: () => void;
    onRetryGenerate: () => void;
    generatePending: boolean;
    generateRecentPending: boolean;
    stopPending: boolean;
    retryPending: boolean;
    generateDaysInRange: number;
};

function formatCalendarDateForDisplay(
    value: Date | string,
    dateLocale: string,
    timezone: string
): string {
    if (typeof value === "string") {
        const parsed = new Date(`${value}T12:00:00.000Z`);
        if (Number.isNaN(parsed.getTime())) {
            return value;
        }
        return formatDateForDisplay(parsed, "date", dateLocale, timezone);
    }
    return formatDateForDisplay(value, "date", dateLocale, timezone);
}

function formatEstimatedSecondsRemaining(
    seconds: number,
    t: (key: string, options?: Record<string, unknown>) => string
): string {
    const ns = { ns: "dashboard" as const };
    if (seconds < 60) {
        return t("credit_portfolio_health.generate_eta_seconds", {
            ...ns,
            defaultValue: "~{{count}} sec",
            count: Math.max(1, Math.round(seconds)),
        });
    }
    if (seconds < 3600) {
        return t("credit_portfolio_health.generate_eta_minutes", {
            ...ns,
            defaultValue: "~{{count}} min",
            count: Math.max(1, Math.round(seconds / 60)),
        });
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    if (mins > 0) {
        return t("credit_portfolio_health.generate_eta_hours_minutes", {
            ...ns,
            defaultValue: "~{{hours}} hr {{mins}} min",
            hours,
            mins,
        });
    }
    return t("credit_portfolio_health.generate_eta_hours", {
        ...ns,
        defaultValue: "~{{hours}} hr",
        hours,
    });
}

export function CreditPortfolioHealthScreen({
    policies,
    policyId,
    onPolicyScopeChange,
    selectedBusinessUnitId,
    onBusinessUnitScopeChange,
    includeNoPolicyExposure,
    onIncludeNoPolicyExposureChange,
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    onDateRangeChange,
    activeTab,
    onTabChange,
    data,
    isLoading,
    isFetching,
    isError,
    error,
    backfillJob,
    onGenerateSnapshots,
    onGenerateRecentSnapshots,
    onStopGenerate,
    onRetryGenerate,
    generatePending,
    generateRecentPending,
    stopPending,
    retryPending,
    generateDaysInRange,
}: CreditPortfolioHealthScreenProps) {
    const { t, i18n } = useTranslation(["dashboard"]);
    const { data: session } = useSession();
    const theme = useTheme();
    const isRtl = i18n.language === "he" || i18n.language.startsWith("he-");
    const prefersReducedMotion = usePrefersReducedMotion();
    const dateLocale = getUserDateLocale(session ?? null);
    const userTimezone = getUserTimezone(session ?? null);
    const ns = { ns: "dashboard" as const };
    const accountCurrency = useMemo(() => {
        const fromApi =
            data?.noCoverage?.accountCurrency ||
            data?.utilization?.accountCurrency ||
            data?.costs?.accountCurrency;
        const fromSession = session?.user?.currency;
        return (fromApi || fromSession || "USD").trim().toUpperCase() || "USD";
    }, [
        data?.noCoverage?.accountCurrency,
        data?.utilization?.accountCurrency,
        data?.costs?.accountCurrency,
        session?.user?.currency,
    ]);
    const [generateModalOpen, setGenerateModalOpen] = useState(false);
    const [generateModalDismissed, setGenerateModalDismissed] = useState(false);
    const [confirmingLargeGenerate, setConfirmingLargeGenerate] = useState<
        null | "full" | "recent"
    >(null);
    const previousBackfillStatusRef = useRef<CreditAsOfBackfillJobStatus | null>(
        null
    );
    const isLargeGenerateRange =
        generateDaysInRange > PORTFOLIO_HEALTH_LARGE_RANGE_DAYS;
    const titleClickCountRef = useRef(0);
    const titleClickResetTimerRef = useRef<number | null>(null);

    const pageTitle = t("credit_portfolio_health.page_title", {
        ...ns,
        defaultValue: "Portfolio Health",
    });
    const pageDescription = t("credit_portfolio_health.page_description", {
        ...ns,
        defaultValue:
            "Period analytics for portfolio health, coverage, utilization, and cost.",
    });

    const introStatusLines = useMemo(
        () => [
            t("credit_portfolio_health.intro_status_health", {
                ...ns,
                defaultValue: "Loading portfolio health…",
            }),
            t("credit_portfolio_health.intro_status_utilisation", {
                ...ns,
                defaultValue: "Loading utilisation…",
            }),
            t("credit_portfolio_health.intro_status_coverage", {
                ...ns,
                defaultValue: "Loading coverage…",
            }),
            t("credit_portfolio_health.intro_status_costs", {
                ...ns,
                defaultValue: "Loading costs…",
            }),
        ],
        [t, i18n.language]
    );

    const intro = usePortfolioHealthIntro({
        prefersReducedMotion,
        statusLines: introStatusLines,
    });

    const handlePageTitleClick = useCallback(() => {
        if (titleClickResetTimerRef.current != null) {
            window.clearTimeout(titleClickResetTimerRef.current);
        }
        titleClickCountRef.current += 1;
        if (titleClickCountRef.current >= 3) {
            titleClickCountRef.current = 0;
            intro.replay();
            return;
        }
        titleClickResetTimerRef.current = window.setTimeout(() => {
            titleClickCountRef.current = 0;
            titleClickResetTimerRef.current = null;
        }, 3000);
    }, [intro.replay]);

    useEffect(() => {
        return () => {
            if (titleClickResetTimerRef.current != null) {
                window.clearTimeout(titleClickResetTimerRef.current);
            }
        };
    }, []);

    const tabLabels = {
        "policy-summary": t("credit_portfolio_health.tab_policy_summary", {
            ...ns,
            defaultValue: "Policy summary",
        }),
        health: t("credit_portfolio_health.tab_health", {
            ...ns,
            defaultValue: "Portfolio Health",
        }),
        "no-coverage": t("credit_portfolio_health.tab_no_coverage", {
            ...ns,
            defaultValue: "No Coverage",
        }),
        utilization: t("credit_portfolio_health.tab_utilization", {
            ...ns,
            defaultValue: "Utilization",
        }),
        costs: t("credit_portfolio_health.tab_costs", {
            ...ns,
            defaultValue: "Costs & Effectiveness",
        }),
    };

    const dashboardShellSx = {
        display: "flex",
        flexDirection: "column",
        position: "relative",
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

    const daysFootnote =
        data != null
            ? t("credit_portfolio_health.days_available_footnote", {
                  ...ns,
                  defaultValue: "{{available}} of {{total}} days available",
                  available: data.daysAvailable,
                  total: data.daysInRange,
              })
            : null;

    const backfillStatus = backfillJob?.status ?? "idle";
    const isBackfillRunning = backfillStatus === "running";
    const showProgress =
        isBackfillRunning ||
        backfillStatus === "paused" ||
        backfillStatus === "failed";
    const progressPct =
        backfillJob != null && backfillJob.daysTotal > 0
            ? Math.min(
                  100,
                  (backfillJob.daysDone / backfillJob.daysTotal) * 100
              )
            : 0;
    const showIndeterminateProgress =
        isBackfillRunning && (backfillJob?.daysDone ?? 0) === 0;
    const startActionsPending = generatePending || generateRecentPending;
    const generateDisabled =
        isBackfillRunning ||
        startActionsPending ||
        stopPending ||
        retryPending;
    const pendingRewrite = backfillJob?.pendingRewrite ?? null;
    const pendingRewriteDays = pendingRewrite
        ? countInclusiveCalendarDays(pendingRewrite.from, pendingRewrite.to)
        : 0;
    const isLargeRecentRange =
        pendingRewriteDays > PORTFOLIO_HEALTH_LARGE_RANGE_DAYS;
    const generateRecentDisabled =
        generateDisabled || pendingRewrite == null;
    const generateRecentTooltip = pendingRewrite
        ? t("credit_portfolio_health.generate_recent_snapshots_tooltip", {
              ...ns,
              from: formatCalendarDateForDisplay(
                  pendingRewrite.from,
                  dateLocale,
                  userTimezone
              ),
              to: formatCalendarDateForDisplay(
                  pendingRewrite.to,
                  dateLocale,
                  userTimezone
              ),
              defaultValue:
                  "Rebuilds portfolio health for the pending rewrite window ({{from}} – {{to}}). Does not use the page date range.",
          })
        : t("credit_portfolio_health.generate_recent_disabled_reason", {
              ...ns,
              defaultValue:
                  "No pending rewrite window. Generate recent is available after an import enqueues days for nightly rewrite.",
          });
    const backfillUpdatedAtMs = backfillJob?.updatedAt
        ? Date.parse(backfillJob.updatedAt)
        : 0;
    const isStaleRunning =
        isBackfillRunning &&
        backfillUpdatedAtMs > 0 &&
        Date.now() - backfillUpdatedAtMs > 45_000;
    const showDataRefreshSpinner =
        activeTab !== "policy-summary" && (isLoading || isFetching);

    useEffect(() => {
        if (
            (confirmingLargeGenerate === "full" && !isLargeGenerateRange) ||
            (confirmingLargeGenerate === "recent" && !isLargeRecentRange)
        ) {
            setConfirmingLargeGenerate(null);
        }
    }, [
        confirmingLargeGenerate,
        isLargeGenerateRange,
        isLargeRecentRange,
        generateDaysInRange,
        pendingRewriteDays,
    ]);

    useEffect(() => {
        const status = backfillStatus;
        const result = resolveGenerateModalAutoOpen({
            status,
            previousStatus: previousBackfillStatusRef.current,
            dismissed: generateModalDismissed,
        });
        previousBackfillStatusRef.current = status;
        if (result.nextDismissed !== generateModalDismissed) {
            setGenerateModalDismissed(result.nextDismissed);
        }
        if (result.shouldOpen) {
            setGenerateModalOpen(true);
        }
    }, [backfillStatus, generateModalDismissed]);

    const openGenerateModal = () => {
        setGenerateModalDismissed(false);
        setGenerateModalOpen(true);
    };

    const closeGenerateModal = () => {
        setGenerateModalOpen(false);
        setConfirmingLargeGenerate(null);
        setGenerateModalDismissed(true);
    };

    const handleGenerateClick = () => {
        if (isLargeGenerateRange) {
            setConfirmingLargeGenerate("full");
            return;
        }
        onGenerateSnapshots();
    };

    const handleGenerateRecentClick = () => {
        if (isLargeRecentRange) {
            setConfirmingLargeGenerate("recent");
            return;
        }
        onGenerateRecentSnapshots();
    };

    const handleConfirmLargeGenerate = () => {
        const mode = confirmingLargeGenerate;
        setConfirmingLargeGenerate(null);
        if (mode === "recent") {
            onGenerateRecentSnapshots();
            return;
        }
        onGenerateSnapshots();
    };

    const largeConfirmDays =
        confirmingLargeGenerate === "recent"
            ? pendingRewriteDays
            : generateDaysInRange;
    const largeConfirmPending =
        confirmingLargeGenerate === "recent"
            ? generateRecentPending
            : generatePending;

    const pageRangeLabel = `${formatCalendarDateForDisplay(
        startDate,
        dateLocale,
        userTimezone
    )} – ${formatCalendarDateForDisplay(endDate, dateLocale, userTimezone)}`;
    const pendingRewriteLabel = pendingRewrite
        ? `${formatCalendarDateForDisplay(
              pendingRewrite.from,
              dateLocale,
              userTimezone
          )} – ${formatCalendarDateForDisplay(
              pendingRewrite.to,
              dateLocale,
              userTimezone
          )}`
        : t("credit_portfolio_health.generate_modal_pending_rewrite_none", {
              ...ns,
              defaultValue: "None",
          });

    const openGenerateButtonLabel =
        backfillStatus === "running" || isStaleRunning
            ? t("credit_portfolio_health.open_generate_running", {
                  ...ns,
                  defaultValue: "Generate running",
              })
            : backfillStatus === "paused"
              ? t("credit_portfolio_health.open_generate_paused", {
                    ...ns,
                    defaultValue: "Generate paused",
                })
              : backfillStatus === "failed"
                ? t("credit_portfolio_health.open_generate_failed", {
                      ...ns,
                      defaultValue: "Generate failed",
                  })
                : t("credit_portfolio_health.open_generate", {
                      ...ns,
                      defaultValue: "Generate",
                  });

    const estimatedRemainingLabel =
        backfillJob?.estimatedSecondsRemaining != null &&
        backfillJob.estimatedSecondsRemaining > 0
            ? formatEstimatedSecondsRemaining(
                  backfillJob.estimatedSecondsRemaining,
                  t
              )
            : null;

    return (
        <>
            <Seo title={pageTitle} />
            <Box sx={dashboardShellSx} className={spaceGrotesk.variable}>
                {intro.isOverlayVisible ? (
                    <PortfolioHealthIntroOverlay
                        progress={intro.progress}
                        statusLine={intro.statusLine}
                        isFading={intro.isFading}
                        isRtl={isRtl}
                    />
                ) : null}
                <Box sx={stickyHeaderSx}>
                    <PageHeader
                        title={
                            <Box
                                onClick={handlePageTitleClick}
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    width: "100%",
                                    minWidth: 0,
                                    cursor: "default",
                                    userSelect: "none",
                                    py: 0.5,
                                    // Widen the hit target around the label block
                                    mx: { xs: -0.5, sm: -1 },
                                    px: { xs: 0.5, sm: 1 },
                                    alignItems: isRtl
                                        ? "flex-end"
                                        : "flex-start",
                                }}
                            >
                                <Typography
                                    variant={
                                        isRtl
                                            ? "hebrewTitle"
                                            : "listPageHeaderTitle"
                                    }
                                    sx={{
                                        color: theme.palette.text.primary,
                                        mb: pageDescription ? "2px" : 0,
                                        width: "100%",
                                        ...(!isRtl && {
                                            textAlign: "left",
                                            direction: "ltr",
                                        }),
                                    }}
                                >
                                    {pageTitle}
                                </Typography>
                                {pageDescription ? (
                                    <Typography
                                        variant={
                                            isRtl
                                                ? "hebrewSubtitle"
                                                : "listPageHeaderDescription"
                                        }
                                        sx={{
                                            color: theme.palette.text.secondary,
                                            width: "100%",
                                            ...(!isRtl && {
                                                textAlign: "left",
                                                direction: "ltr",
                                            }),
                                        }}
                                    >
                                        {pageDescription}
                                    </Typography>
                                ) : null}
                            </Box>
                        }
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
                            width: "100%",
                        }}
                    >
                        <BusinessUnitDashboardFilter
                            value={selectedBusinessUnitId}
                            onChange={onBusinessUnitScopeChange}
                        />
                        {policies.length > 1 ? (
                            <CreditDashboardPolicySelect
                                policies={policies}
                                value={policyId}
                                onChange={onPolicyScopeChange}
                            />
                        ) : null}
                        <CreditDashboardExcludedCustomersFilter
                            value={includeNoPolicyExposure}
                            onChange={onIncludeNoPolicyExposureChange}
                        />
                        <DateRangePicker
                            startDate={startDate}
                            endDate={endDate}
                            onStartDateChange={onStartDateChange}
                            onEndDateChange={onEndDateChange}
                            onDateRangeChange={onDateRangeChange}
                        />
                        <Tooltip
                            title={t(
                                "credit_portfolio_health.generate_snapshots_tooltip",
                                {
                                    ...ns,
                                    defaultValue:
                                        "Builds daily portfolio health snapshots for the selected date range. Runs in the background — use Stop to pause and Resume to continue.",
                                }
                            )}
                            {...getRTLTooltipProps(i18n)}
                        >
                            <span>
                                <Button
                                    variant="contained"
                                    size="small"
                                    onClick={openGenerateModal}
                                >
                                    {openGenerateButtonLabel}
                                </Button>
                            </span>
                        </Tooltip>
                    </Box>
                    {showProgress ? (
                        <Box
                            sx={{
                                width: "100%",
                                display: "flex",
                                flexDirection: "column",
                                gap: 0.75,
                                direction: isRtl ? "rtl" : "ltr",
                                textAlign: isRtl ? "right" : "left",
                            }}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 1,
                                    flexWrap: "wrap",
                                    width: "100%",
                                }}
                            >
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                >
                                    {t(
                                        "credit_portfolio_health.generate_progress",
                                        {
                                            ...ns,
                                            defaultValue:
                                                "Generating snapshots: {{done}} of {{total}} days",
                                            done: backfillJob?.daysDone ?? 0,
                                            total: backfillJob?.daysTotal ?? 0,
                                        }
                                    )}
                                </Typography>
                                {estimatedRemainingLabel ? (
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        {t(
                                            "credit_portfolio_health.generate_eta",
                                            {
                                                ...ns,
                                                defaultValue:
                                                    "Estimated time remaining: {{estimate}}",
                                                estimate:
                                                    estimatedRemainingLabel,
                                            }
                                        )}
                                    </Typography>
                                ) : null}
                            </Box>
                            <Box sx={{ direction: isRtl ? "rtl" : "ltr" }}>
                                <LinearProgress
                                    variant={
                                        showIndeterminateProgress
                                            ? "indeterminate"
                                            : "determinate"
                                    }
                                    value={progressPct}
                                    sx={{
                                        height: 8,
                                        borderRadius: 4,
                                        ...(isRtl && {
                                            transform: "scaleX(-1)",
                                        }),
                                    }}
                                />
                            </Box>
                            {backfillJob?.lastError ? (
                                <Typography variant="body2" color="error">
                                    {backfillJob.lastError}
                                </Typography>
                            ) : null}
                        </Box>
                    ) : null}
                    {isError && error?.message === "forbidden" ? (
                        <Box sx={{ p: 3, width: "100%" }}>
                            <Typography color="error">
                                {t("messages.credit_dashboard_forbidden", {
                                    ns: "dashboard",
                                })}
                            </Typography>
                        </Box>
                    ) : (
                        <Box
                            className="cph-island"
                            sx={{
                                width: "100%",
                                maxWidth: "100%",
                                m: 0,
                                p: 0,
                                pb: 3,
                                minHeight: "60vh",
                                direction: isRtl ? "rtl" : "ltr",
                            }}
                        >
                            <div className={layout.islandShell}>
                                <div className={layout.tabsRow}>
                                    <PillTabs
                                        activeTab={activeTab}
                                        onChange={onTabChange}
                                        labels={tabLabels}
                                        ariaLabel={t(
                                            "credit_portfolio_health.tablist_aria",
                                            {
                                                ...ns,
                                                defaultValue:
                                                    "Portfolio health sections",
                                            }
                                        )}
                                        isRtl={isRtl}
                                    />
                                    {activeTab !== "policy-summary" &&
                                    !showDataRefreshSpinner &&
                                    data != null &&
                                    daysFootnote ? (
                                        <div
                                            className={layout.daysMeta}
                                            title={t(
                                                "credit_portfolio_health.days_available_tooltip",
                                                {
                                                    ...ns,
                                                    defaultValue:
                                                        "Snapshot data exists for {{available}} of {{total}} days in the selected range.",
                                                    available:
                                                        data.daysAvailable,
                                                    total: data.daysInRange,
                                                }
                                            )}
                                            aria-label={daysFootnote}
                                        >
                                            <CalendarDays
                                                size={16}
                                                strokeWidth={2.25}
                                                aria-hidden
                                            />
                                            <div className={layout.daysMetaCopy}>
                                                <span
                                                    className={
                                                        layout.daysMetaLabel
                                                    }
                                                >
                                                    {t(
                                                        "credit_portfolio_health.days_with_data_label",
                                                        {
                                                            ...ns,
                                                            defaultValue:
                                                                "Days with data",
                                                        }
                                                    )}
                                                </span>
                                                <span
                                                    className={
                                                        layout.daysMetaRatio
                                                    }
                                                >
                                                    {data.daysAvailable}
                                                    <span
                                                        className={
                                                            layout.daysMetaRatioMuted
                                                        }
                                                    >
                                                        {t(
                                                            "credit_portfolio_health.days_of_range_suffix",
                                                            {
                                                                ...ns,
                                                                defaultValue:
                                                                    " of {{total}} in range",
                                                                total: data.daysInRange,
                                                            }
                                                        )}
                                                    </span>
                                                </span>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>

                                <div
                                    id={`cph-panel-${activeTab}`}
                                    role="tabpanel"
                                    aria-labelledby={`cph-tab-${activeTab}`}
                                    key={activeTab}
                                    className={`${layout.panel}${
                                        prefersReducedMotion
                                            ? ""
                                            : ` ${islandMotion.panelEnter}`
                                    }`}
                                >
                                    {activeTab === "policy-summary" ? (
                                        <PolicySummarySectionView
                                            policies={policies}
                                            policyId={policyId}
                                            onSelectPolicy={onPolicyScopeChange}
                                        />
                                    ) : null}
                                    {showDataRefreshSpinner ? (
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                minHeight: {
                                                    xs: "300px",
                                                    sm: "400px",
                                                },
                                            }}
                                        >
                                            <CircularProgress
                                                color="primary"
                                                size={48}
                                            />
                                        </Box>
                                    ) : null}
                                    {!showDataRefreshSpinner &&
                                    activeTab === "health" ? (
                                        isError ? (
                                            <Typography color="error">
                                                {t(
                                                    "credit_portfolio_health.load_failed",
                                                    {
                                                        ...ns,
                                                        defaultValue:
                                                            "Failed to load portfolio health.",
                                                    }
                                                )}
                                            </Typography>
                                        ) : data?.portfolioHealth != null ? (
                                            <PortfolioHealthSectionView
                                                section={data.portfolioHealth}
                                                fromYmd={data.from}
                                                toYmd={data.to}
                                                accountCurrency={accountCurrency}
                                                policyId={policyId}
                                                includeNoPolicyExposure={
                                                    includeNoPolicyExposure
                                                }
                                                businessUnitId={
                                                    selectedBusinessUnitId
                                                }
                                            />
                                        ) : (
                                            <p
                                                className="m-0 text-sm"
                                                style={{ color: CPH.slate }}
                                            >
                                                {t(
                                                    "credit_portfolio_health.no_section_data",
                                                    {
                                                        ...ns,
                                                        defaultValue:
                                                            "No portfolio health data for this range.",
                                                    }
                                                )}
                                            </p>
                                        )
                                    ) : null}
                                    {!showDataRefreshSpinner &&
                                    activeTab === "no-coverage" ? (
                                        isError ? (
                                            <Typography color="error">
                                                {t(
                                                    "credit_portfolio_health.load_failed",
                                                    {
                                                        ...ns,
                                                        defaultValue:
                                                            "Failed to load portfolio health.",
                                                    }
                                                )}
                                            </Typography>
                                        ) : data?.noCoverage != null ? (
                                            <NoCoverageSectionView
                                                section={data.noCoverage}
                                            />
                                        ) : (
                                            <p
                                                className="m-0 text-sm"
                                                style={{ color: CPH.slate }}
                                            >
                                                {t(
                                                    "credit_portfolio_health.no_section_data",
                                                    {
                                                        ...ns,
                                                        defaultValue:
                                                            "No coverage data for this range.",
                                                    }
                                                )}
                                            </p>
                                        )
                                    ) : null}
                                    {!showDataRefreshSpinner &&
                                    activeTab === "utilization" ? (
                                        isError ? (
                                            <Typography color="error">
                                                {t(
                                                    "credit_portfolio_health.load_failed",
                                                    {
                                                        ...ns,
                                                        defaultValue:
                                                            "Failed to load portfolio health.",
                                                    }
                                                )}
                                            </Typography>
                                        ) : data?.utilization != null ? (
                                            <UtilizationSectionView
                                                section={data.utilization}
                                                fromYmd={data.from}
                                                toYmd={data.to}
                                                policyId={policyId}
                                                businessUnitId={
                                                    selectedBusinessUnitId
                                                }
                                                includeNoPolicyExposure={
                                                    includeNoPolicyExposure
                                                }
                                            />
                                        ) : (
                                            <p
                                                className="m-0 text-sm"
                                                style={{ color: CPH.slate }}
                                            >
                                                {t(
                                                    "credit_portfolio_health.no_section_data",
                                                    {
                                                        ...ns,
                                                        defaultValue:
                                                            "No utilization data for this range.",
                                                    }
                                                )}
                                            </p>
                                        )
                                    ) : null}
                                    {!showDataRefreshSpinner &&
                                    activeTab === "costs" ? (
                                        isError ? (
                                            <Typography color="error">
                                                {t(
                                                    "credit_portfolio_health.load_failed",
                                                    {
                                                        ...ns,
                                                        defaultValue:
                                                            "Failed to load portfolio health.",
                                                    }
                                                )}
                                            </Typography>
                                        ) : data?.costs != null ? (
                                            <CostsSectionView
                                                section={data.costs}
                                                fromYmd={data.from}
                                                toYmd={data.to}
                                                policyId={policyId}
                                                businessUnitId={
                                                    selectedBusinessUnitId
                                                }
                                                includeNoPolicyExposure={
                                                    includeNoPolicyExposure
                                                }
                                            />
                                        ) : (
                                            <p
                                                className="m-0 text-sm"
                                                style={{ color: CPH.slate }}
                                            >
                                                {t(
                                                    "credit_portfolio_health.no_section_data",
                                                    {
                                                        ...ns,
                                                        defaultValue:
                                                            "No cost data for this range.",
                                                    }
                                                )}
                                            </p>
                                        )
                                    ) : null}
                                </div>
                            </div>
                        </Box>
                    )}
                    </Box>
                </Box>
            </Box>
            <AppDialog
                open={generateModalOpen}
                onClose={closeGenerateModal}
                isRTL={isRtl}
                title={t("credit_portfolio_health.generate_modal_title", {
                    ...ns,
                    defaultValue: "Generate snapshots",
                })}
                titleIcon={<CalendarDays size={18} />}
                paperWidth="360px"
                actions={
                    confirmingLargeGenerate != null ? (
                        <>
                            <Button
                                onClick={() => setConfirmingLargeGenerate(null)}
                                disabled={largeConfirmPending}
                            >
                                {t(
                                    "credit_portfolio_health.large_range_cancel_button",
                                    {
                                        ...ns,
                                        defaultValue: "Cancel",
                                    }
                                )}
                            </Button>
                            <Button
                                variant="contained"
                                color="warning"
                                onClick={handleConfirmLargeGenerate}
                                disabled={
                                    largeConfirmPending ||
                                    (confirmingLargeGenerate === "recent"
                                        ? generateRecentDisabled
                                        : generateDisabled)
                                }
                            >
                                {largeConfirmPending ? (
                                    <CircularProgress size={18} color="inherit" />
                                ) : (
                                    t(
                                        "credit_portfolio_health.large_range_confirm_button",
                                        {
                                            ...ns,
                                            defaultValue: "Generate anyway",
                                        }
                                    )
                                )}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button onClick={closeGenerateModal}>
                                {t(
                                    "credit_portfolio_health.generate_modal_close",
                                    {
                                        ...ns,
                                        defaultValue: "Close",
                                    }
                                )}
                            </Button>
                            <Tooltip
                                title={t(
                                    "credit_portfolio_health.generate_snapshots_tooltip",
                                    {
                                        ...ns,
                                        defaultValue:
                                            "Builds daily portfolio health snapshots for the selected date range. Runs in the background — use Stop to pause and Resume to continue.",
                                    }
                                )}
                                {...getRTLTooltipProps(i18n)}
                            >
                                <span>
                                    <Button
                                        variant="contained"
                                        disabled={generateDisabled}
                                        onClick={handleGenerateClick}
                                    >
                                        {generatePending ? (
                                            <CircularProgress
                                                size={18}
                                                color="inherit"
                                            />
                                        ) : (
                                            t(
                                                "credit_portfolio_health.generate_snapshots",
                                                {
                                                    ...ns,
                                                    defaultValue: "Generate",
                                                }
                                            )
                                        )}
                                    </Button>
                                </span>
                            </Tooltip>
                            <Tooltip
                                title={generateRecentTooltip}
                                {...getRTLTooltipProps(i18n)}
                            >
                                <span>
                                    <Button
                                        variant="contained"
                                        disabled={generateRecentDisabled}
                                        onClick={handleGenerateRecentClick}
                                    >
                                        {generateRecentPending ? (
                                            <CircularProgress
                                                size={18}
                                                color="inherit"
                                            />
                                        ) : (
                                            t(
                                                "credit_portfolio_health.generate_recent_snapshots",
                                                {
                                                    ...ns,
                                                    defaultValue:
                                                        "Generate recent",
                                                }
                                            )
                                        )}
                                    </Button>
                                </span>
                            </Tooltip>
                            {isBackfillRunning ? (
                                <Button
                                    variant="outlined"
                                    color="warning"
                                    disabled={stopPending}
                                    onClick={onStopGenerate}
                                >
                                    {stopPending ? (
                                        <CircularProgress
                                            size={18}
                                            color="inherit"
                                        />
                                    ) : (
                                        t(
                                            "credit_portfolio_health.stop_generate",
                                            {
                                                ...ns,
                                                defaultValue: "Stop",
                                            }
                                        )
                                    )}
                                </Button>
                            ) : null}
                            {backfillStatus === "paused" ||
                            backfillStatus === "failed" ||
                            isStaleRunning ? (
                                <Button
                                    variant="outlined"
                                    disabled={
                                        retryPending || startActionsPending
                                    }
                                    onClick={onRetryGenerate}
                                >
                                    {retryPending ? (
                                        <CircularProgress
                                            size={18}
                                            color="inherit"
                                        />
                                    ) : isStaleRunning ? (
                                        t(
                                            "credit_portfolio_health.resume_generate",
                                            {
                                                ...ns,
                                                defaultValue: "Resume",
                                            }
                                        )
                                    ) : (
                                        t(
                                            "credit_portfolio_health.retry_generate",
                                            {
                                                ...ns,
                                                defaultValue: "Retry",
                                            }
                                        )
                                    )}
                                </Button>
                            ) : null}
                        </>
                    )
                }
            >
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t("credit_portfolio_health.generate_modal_help", {
                        ...ns,
                        defaultValue:
                            "Generate builds daily snapshots for the page date range. Generate recent rebuilds only the pending rewrite window from imports.",
                    })}
                </Typography>
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 2,
                        py: 0.5,
                    }}
                >
                    <Typography variant="body2" color="text.secondary">
                        {t(
                            "credit_portfolio_health.generate_modal_page_range",
                            {
                                ...ns,
                                defaultValue: "Page date range",
                            }
                        )}
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ textAlign: "end" }}
                    >
                        {pageRangeLabel}
                    </Typography>
                </Box>
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 2,
                        py: 0.5,
                    }}
                >
                    <Typography variant="body2" color="text.secondary">
                        {t(
                            "credit_portfolio_health.generate_modal_pending_rewrite",
                            {
                                ...ns,
                                defaultValue: "Pending rewrite window",
                            }
                        )}
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ textAlign: "end" }}
                    >
                        {pendingRewriteLabel}
                    </Typography>
                </Box>
                {confirmingLargeGenerate != null ? (
                    <Box sx={{ mt: 2 }}>
                        <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 600, mb: 0.5 }}
                        >
                            {t(
                                "credit_portfolio_health.large_range_confirm_title",
                                {
                                    ...ns,
                                    defaultValue: "Generate snapshot history",
                                }
                            )}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t(
                                "credit_portfolio_health.large_range_confirm",
                                {
                                    ...ns,
                                    defaultValue:
                                        "Generate {{days}} days of snapshot history? This can take a while on large accounts.",
                                    days: largeConfirmDays,
                                }
                            )}
                        </Typography>
                    </Box>
                ) : null}
            </AppDialog>
        </>
    );
}
