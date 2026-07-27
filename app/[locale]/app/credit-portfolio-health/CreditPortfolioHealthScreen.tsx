"use client";

import { Box, CircularProgress, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";

import PageHeader from "@/components/PageHeader";
import DateRangePicker from "@/app/[locale]/app/operation-dashboard/(cards)/DateRangePicker";
import {
    CreditDashboardPolicySelect,
    type CreditDashboardPolicyItem,
} from "@/app/[locale]/app/credit-dashboard/CreditDashboardPolicySelect";
import { CreditDashboardExcludedCustomersFilter } from "@/app/[locale]/app/credit-dashboard/CreditDashboardExcludedCustomersFilter";
import BusinessUnitDashboardFilter from "@/shared/components/BusinessUnitDashboardFilter";
import Seo from "@/shared/layout-components/seo/seo";
import type { CreditPortfolioHealthResponse } from "@/server/services/creditInsurance/creditPortfolioHealthService";

import { CostsSectionView } from "./CostsSectionView";
import { CPH } from "./designTokens";
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
    activeTab: PortfolioHealthTabId;
    onTabChange: (tab: PortfolioHealthTabId) => void;
    data: CreditPortfolioHealthResponse | undefined;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
};

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
    activeTab,
    onTabChange,
    data,
    isLoading,
    isError,
    error,
}: CreditPortfolioHealthScreenProps) {
    const { t, i18n } = useTranslation(["dashboard"]);
    const theme = useTheme();
    const isRtl = i18n.language === "he" || i18n.language.startsWith("he-");
    const prefersReducedMotion = usePrefersReducedMotion();
    const ns = { ns: "dashboard" as const };

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

    return (
        <>
            <Seo title={pageTitle} />
            <Box sx={dashboardShellSx}>
                <Box sx={stickyHeaderSx}>
                    <PageHeader
                        title={pageTitle}
                        description={pageDescription}
                        sticky={false}
                    />
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
                        />
                    </Box>
                </Box>
                <Box sx={contentAreaSx}>
                    {isLoading ? (
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
                    ) : isError ? (
                        <Box sx={{ p: 3 }}>
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
                        <div
                            className="cph-island"
                            dir={isRtl ? "rtl" : "ltr"}
                            style={{
                                marginInline: "-0.25rem",
                                paddingInline: "1rem",
                                paddingTop: 24,
                                paddingBottom: 24,
                                minHeight: "60vh",
                            }}
                        >
                            <div className={layout.islandShell}>
                                {daysFootnote ? (
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: 14,
                                            color: CPH.slate,
                                        }}
                                    >
                                        {daysFootnote}
                                    </p>
                                ) : null}

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

                                <div
                                    id={`cph-panel-${activeTab}`}
                                    role="tabpanel"
                                    aria-labelledby={`cph-tab-${activeTab}`}
                                    key={activeTab}
                                    className={
                                        prefersReducedMotion
                                            ? undefined
                                            : islandMotion.panelEnter
                                    }
                                >
                                    {activeTab === "health" ? (
                                        data?.portfolioHealth != null ? (
                                            <PortfolioHealthSectionView
                                                section={data.portfolioHealth}
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
                        </div>
                    )}
                </Box>
            </Box>
        </>
    );
}
