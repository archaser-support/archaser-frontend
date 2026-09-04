"use client";

import {
    Box,
    Button,
    CircularProgress,
    FormControlLabel,
    LinearProgress,
    Switch,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import { CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";

import PageHeader from "@/components/PageHeader";
import DateRangePicker from "@/app/[locale]/app/operation-dashboard/(cards)/DateRangePicker";
import {
    CreditDashboardPolicySelect,
    type CreditDashboardPolicyItem,
} from "@/app/[locale]/app/credit-dashboard/CreditDashboardPolicySelect";
import { CreditDashboardExcludedCustomersFilter } from "@/app/[locale]/app/credit-dashboard/CreditDashboardExcludedCustomersFilter";
import BusinessUnitDashboardFilter from "@/shared/components/BusinessUnitDashboardFilter";
import { PORTFOLIO_HEALTH_LARGE_RANGE_DAYS } from "@/shared/creditInsurance/portfolioHealthDateRange";
import Seo from "@/shared/layout-components/seo/seo";
import { getRTLTooltipProps } from "@/utils/reportFieldUtils";
import type {
    CreditAsOfBackfillJobView,
    CreditPortfolioHealthResponse,
} from "@/types/creditInsurance";

import { CostsSectionView } from "./CostsSectionView";
import { CPH } from "./designTokens";
import { spaceGrotesk } from "./fonts";
import layout from "./islandLayout.module.css";
import islandMotion from "./islandMotion.module.css";
import { NoCoverageSectionView } from "./NoCoverageSectionView";
import {
    PillTabs,
    type PortfolioHealthTabId,
} from "./PillTabs";
import { PortfolioHealthSectionView } from "./PortfolioHealthSectionView";
import { UtilizationSectionView } from "./UtilizationSectionView";
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
    isError: boolean;
    error: Error | null;
    backfillJob: CreditAsOfBackfillJobView | undefined;
    onGenerateSnapshots: () => void;
    onStopGenerate: () => void;
    onRetryGenerate: () => void;
    generatePending: boolean;
    stopPending: boolean;
    retryPending: boolean;
    ignoreReportingBreach: boolean;
    onIgnoreReportingBreachChange: (value: boolean) => void;
    generateDaysInRange: number;
};

function formatEstimatedSecondsRemaining(seconds: number): string {
    if (seconds < 60) {
        return `~${Math.max(1, Math.round(seconds))} sec`;
    }
    if (seconds < 3600) {
        return `~${Math.max(1, Math.round(seconds / 60))} min`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return mins > 0 ? `~${hours} hr ${mins} min` : `~${hours} hr`;
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
    isError,
    error,
    backfillJob,
    onGenerateSnapshots,
    onStopGenerate,
    onRetryGenerate,
    generatePending,
    stopPending,
    retryPending,
    ignoreReportingBreach,
    onIgnoreReportingBreachChange,
    generateDaysInRange,
}: CreditPortfolioHealthScreenProps) {
    const { t, i18n } = useTranslation(["dashboard"]);
    const theme = useTheme();
    const isRtl = i18n.language === "he" || i18n.language.startsWith("he-");
    const prefersReducedMotion = usePrefersReducedMotion();
    const ns = { ns: "dashboard" as const };
    const [confirmingLargeGenerate, setConfirmingLargeGenerate] =
        useState(false);
    const isLargeGenerateRange =
        generateDaysInRange > PORTFOLIO_HEALTH_LARGE_RANGE_DAYS;

    useEffect(() => {
        if (!isLargeGenerateRange) {
            setConfirmingLargeGenerate(false);
        }
    }, [isLargeGenerateRange, generateDaysInRange]);

    const pageTitle = t("credit_portfolio_health.page_title", {
        ...ns,
        defaultValue: "Portfolio Health",
    });
    const pageDescription = t("credit_portfolio_health.page_description", {
        ...ns,
        defaultValue:
            "Period analytics for portfolio health, coverage, utilization, and cost.",
    });

    const tabLabels = {
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
    const generateDisabled =
        isBackfillRunning || generatePending || stopPending || retryPending;
    const backfillUpdatedAtMs = backfillJob?.updatedAt
        ? Date.parse(backfillJob.updatedAt)
        : 0;
    const isStaleRunning =
        isBackfillRunning &&
        backfillUpdatedAtMs > 0 &&
        Date.now() - backfillUpdatedAtMs > 45_000;
    const ignoreReportingBreachLocked =
        backfillStatus === "running" ||
        backfillStatus === "paused" ||
        backfillStatus === "failed" ||
        generatePending;

    const handleGenerateClick = () => {
        if (isLargeGenerateRange && !confirmingLargeGenerate) {
            setConfirmingLargeGenerate(true);
            return;
        }
        setConfirmingLargeGenerate(false);
        onGenerateSnapshots();
    };

    const estimatedRemainingLabel =
        backfillJob?.estimatedSecondsRemaining != null &&
        backfillJob.estimatedSecondsRemaining > 0
            ? formatEstimatedSecondsRemaining(
                  backfillJob.estimatedSecondsRemaining
              )
            : null;

    return (
        <>
            <Seo title={pageTitle} />
            <Box sx={dashboardShellSx} className={spaceGrotesk.variable}>
                <Box sx={stickyHeaderSx}>
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
                                "credit_portfolio_health.ignore_reporting_breach_tooltip",
                                {
                                    ...ns,
                                    defaultValue:
                                        "Only this Generate. Snapshots treat reporting-late as off. Invoice records and the nightly job stay unchanged.",
                                }
                            )}
                            {...getRTLTooltipProps(i18n)}
                        >
                            <span>
                                <FormControlLabel
                                    disabled={ignoreReportingBreachLocked}
                                    control={
                                        <Switch
                                            color="primary"
                                            checked={ignoreReportingBreach}
                                            onChange={(event) =>
                                                onIgnoreReportingBreachChange(
                                                    event.target.checked
                                                )
                                            }
                                            {...(isRtl
                                                ? { "data-rtl": true }
                                                : {})}
                                        />
                                    }
                                    label={t(
                                        "credit_portfolio_health.ignore_reporting_breach",
                                        {
                                            ...ns,
                                            defaultValue:
                                                "Ignore reporting breach",
                                        }
                                    )}
                                />
                            </span>
                        </Tooltip>
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
                                    disabled={generateDisabled}
                                    onClick={handleGenerateClick}
                                >
                                    {t(
                                        "credit_portfolio_health.generate_snapshots",
                                        {
                                            ...ns,
                                            defaultValue: "Generate",
                                        }
                                    )}
                                </Button>
                            </span>
                        </Tooltip>
                        {isBackfillRunning ? (
                            <Button
                                variant="outlined"
                                size="small"
                                disabled={stopPending}
                                onClick={onStopGenerate}
                            >
                                {t("credit_portfolio_health.stop_generate", {
                                    ...ns,
                                    defaultValue: "Stop",
                                })}
                            </Button>
                        ) : null}
                        {backfillStatus === "paused" ||
                        backfillStatus === "failed" ||
                        isStaleRunning ? (
                            <Button
                                variant="outlined"
                                size="small"
                                disabled={retryPending || generatePending}
                                onClick={onRetryGenerate}
                            >
                                {isStaleRunning
                                    ? t(
                                          "credit_portfolio_health.resume_generate",
                                          {
                                              ...ns,
                                              defaultValue: "Resume",
                                          }
                                      )
                                    : t(
                                          "credit_portfolio_health.retry_generate",
                                          {
                                              ...ns,
                                              defaultValue: "Retry",
                                          }
                                      )}
                            </Button>
                        ) : null}
                    </Box>
                    {confirmingLargeGenerate ? (
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 1,
                            }}
                        >
                            <Typography variant="body2" color="text.secondary">
                                {t(
                                    "credit_portfolio_health.large_range_confirm",
                                    {
                                        ...ns,
                                        defaultValue:
                                            "Generate {{days}} days of snapshot history? This can take a while on large accounts.",
                                        days: generateDaysInRange,
                                    }
                                )}
                            </Typography>
                            <Box sx={{ display: "flex", gap: 1 }}>
                                <Button
                                    variant="contained"
                                    size="small"
                                    disabled={generateDisabled}
                                    onClick={handleGenerateClick}
                                >
                                    {t(
                                        "credit_portfolio_health.large_range_confirm_button",
                                        {
                                            ...ns,
                                            defaultValue: "Generate anyway",
                                        }
                                    )}
                                </Button>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() =>
                                        setConfirmingLargeGenerate(false)
                                    }
                                >
                                    {t(
                                        "credit_portfolio_health.large_range_cancel_button",
                                        {
                                            ...ns,
                                            defaultValue: "Cancel",
                                        }
                                    )}
                                </Button>
                            </Box>
                        </Box>
                    ) : null}
                    {showProgress ? (
                        <Box
                            sx={{
                                width: "100%",
                                display: "flex",
                                flexDirection: "column",
                                gap: 0.75,
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
                            <LinearProgress
                                variant={
                                    showIndeterminateProgress
                                        ? "indeterminate"
                                        : "determinate"
                                }
                                value={progressPct}
                                sx={{ height: 8, borderRadius: 4 }}
                            />
                            {backfillJob?.lastError ? (
                                <Typography variant="body2" color="error">
                                    {backfillJob.lastError}
                                </Typography>
                            ) : null}
                        </Box>
                    ) : null}
                    {isLoading ? (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                minHeight: { xs: "300px", sm: "400px" },
                                width: "100%",
                            }}
                        >
                            <CircularProgress color="primary" size={48} />
                        </Box>
                    ) : isError ? (
                        <Box sx={{ p: 3, width: "100%" }}>
                            <Typography color="error">
                                {error?.message === "forbidden"
                                    ? t("messages.credit_dashboard_forbidden", {
                                          ns: "dashboard",
                                      })
                                    : t(
                                          "credit_portfolio_health.load_failed",
                                          {
                                              ...ns,
                                              defaultValue:
                                                  "Failed to load portfolio health.",
                                          }
                                      )}
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
                                    {data != null && daysFootnote ? (
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
                                    {activeTab === "health" ? (
                                        data?.portfolioHealth != null ? (
                                            <PortfolioHealthSectionView
                                                section={data.portfolioHealth}
                                                fromYmd={data.from}
                                                toYmd={data.to}
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
                                    {activeTab === "no-coverage" ? (
                                        data?.noCoverage != null ? (
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
                                    {activeTab === "utilization" ? (
                                        data?.utilization != null ? (
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
                                    {activeTab === "costs" ? (
                                        data?.costs != null ? (
                                            <CostsSectionView
                                                section={data.costs}
                                                fromYmd={data.from}
                                                toYmd={data.to}
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
        </>
    );
}
