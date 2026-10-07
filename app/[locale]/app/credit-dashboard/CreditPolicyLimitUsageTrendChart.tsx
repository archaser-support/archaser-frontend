"use client";

import { ShowChart as ShowChartIcon } from "@mui/icons-material";
import { Box, Card, CardContent, Typography, useTheme } from "@mui/material";
import { useSession } from "next-auth/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { CustomerPolicyUsageTrendResponse } from "@/types/creditInsurance";
import {
    formatDateForDisplay,
    getUserDateLocale,
} from "@/utils/datetimeOperations";

import { CreditDashboardTitleInfoIcon } from "./creditDashboardTitleTooltip";
import { PolicyUsageTopCustomersBarChart } from "./PolicyUsageTopCustomersBarChart";

function parseSnapshotDate(snapshotDate: string): Date {
    return new Date(`${snapshotDate}T12:00:00.000Z`);
}

function formatSnapshotDate(snapshotDate: string, dateLocale: string): string {
    return formatDateForDisplay(
        parseSnapshotDate(snapshotDate),
        "date",
        dateLocale,
        "UTC"
    );
}

export type CreditPolicyLimitUsageTrendChartProps = {
    data: CustomerPolicyUsageTrendResponse | undefined;
    isLoading?: boolean;
};

export function CreditPolicyLimitUsageTrendChart({
    data,
    isLoading,
}: CreditPolicyLimitUsageTrendChartProps) {
    const theme = useTheme();
    const c = theme.creditDashboardChartCard;
    const { data: session } = useSession();
    const { t, i18n } = useTranslation(["dashboard", "common"]);
    const isRtl = i18n.language === "he";
    const nsDashboard = { ns: "dashboard" as const };
    const accountCurrency = data?.accountCurrency || "USD";

    const dateLocale = useMemo(() => {
        const fallback = i18n.language?.startsWith("he") ? "he-IL" : "en-US";
        return getUserDateLocale(session, fallback);
    }, [session, i18n.language]);

    const snapshotLabel = useMemo(() => {
        if (!data?.snapshotDate) {
            return null;
        }
        return formatSnapshotDate(data.snapshotDate, dateLocale);
    }, [data?.snapshotDate, dateLocale]);

    const topCustomers = data?.topCustomers ?? [];
    const showTopUpStack = data?.hasTopUpPolicies === true;
    const empty = !isLoading && topCustomers.length === 0;

    const labels = useMemo(
        () => ({
            currentAr: t(
                "credit_insurance_dashboard.top_customers_current_ar_series",
                nsDashboard
            ),
            approvedLimit: t(
                "credit_insurance_dashboard.top_customers_limit_amount_series",
                nsDashboard
            ),
            topUpTotal: t(
                "credit_insurance_dashboard.top_up_cover_amount",
                nsDashboard
            ),
            effectiveLimit: t(
                "credit_insurance_dashboard.effective_limit",
                nsDashboard
            ),
            policyUsage: t(
                "credit_insurance_dashboard.top_customers_policy_usage_pct_series",
                {
                    ...nsDashboard,
                    defaultValue: "Policy usage",
                }
            ),
            topUpUsage: t(
                "credit_insurance_dashboard.top_customers_top_up_usage_pct_series",
                {
                    ...nsDashboard,
                    defaultValue: "Top-up usage",
                }
            ),
            effectiveUsage: t(
                "credit_insurance_dashboard.top_customers_effective_usage_pct_series",
                {
                    ...nsDashboard,
                    defaultValue: "Effective usage",
                }
            ),
            usagePct: t(
                "credit_insurance_dashboard.top_customers_usage_pct_series",
                nsDashboard
            ),
            policySeries: t(
                "credit_insurance_dashboard.top_customers_bar_policy_series",
                {
                    ...nsDashboard,
                    defaultValue: "Policy limit",
                }
            ),
            topUpSeries: t(
                "credit_insurance_dashboard.top_customers_bar_top_up_series",
                {
                    ...nsDashboard,
                    defaultValue: "Top-up",
                }
            ),
            overSeries: t(
                "credit_insurance_dashboard.top_customers_bar_over_series",
                {
                    ...nsDashboard,
                    defaultValue: "Over effective limit",
                }
            ),
        }),
        [t]
    );

    return (
        <Card
            sx={{
                ...c.card(theme, { hoverable: false }),
                height: "100%",
                minHeight: 320,
                overflow: "visible",
            }}
        >
            <CardContent
                sx={{
                    ...c.cardContent(theme, { withChartBody: true }),
                    pb: 1,
                    direction: isRtl ? "rtl" : "ltr",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <Box
                    className="card-icon"
                    aria-hidden
                    sx={c.headerIconLeading(theme, isRtl, "limitWarnings")}
                >
                    <ShowChartIcon />
                </Box>
                <Box sx={c.headerColumn(theme, isRtl)}>
                    <Box
                        sx={{
                            ...c.headerTitleRow(theme, isRtl),
                            mb: theme.spacing(1),
                        }}
                    >
                        <Typography
                            variant="body2"
                            component="span"
                            sx={{
                                ...c.headerTitleInRow(theme, isRtl),
                                ml: 0,
                                mr: 0,
                                mb: 0,
                                minWidth: 0,
                            }}
                        >
                            {t(
                                "credit_insurance_dashboard.top_customers_usage_vs_limit_title",
                                nsDashboard
                            )}
                            <CreditDashboardTitleInfoIcon
                                isRtl={isRtl}
                                title={t(
                                    "tooltips.credit_insurance_top_customers_usage_chart",
                                    nsDashboard
                                )}
                                ariaLabel={t(
                                    "credit_insurance_dashboard.chart_title_help_aria",
                                    { ns: "dashboard" }
                                )}
                            />
                        </Typography>
                    </Box>
                    {snapshotLabel ? (
                        <Typography sx={c.headerCaption(theme, isRtl)}>
                            {t(
                                "credit_insurance_dashboard.top_customers_usage_vs_limit_subtitle",
                                {
                                    ...nsDashboard,
                                    date: snapshotLabel,
                                }
                            )}
                        </Typography>
                    ) : null}
                </Box>

                <Box
                    sx={{
                        flex: 1,
                        minHeight: 200,
                        mt: 1,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "visible",
                    }}
                >
                    {isLoading ? (
                        <Typography color="text.secondary" variant="body2">
                            {t("messages.loading", { ns: "common" })}
                        </Typography>
                    ) : empty ? (
                        <Typography color="text.secondary" variant="body2">
                            {t(
                                "credit_insurance_dashboard.top_customers_usage_vs_limit_empty",
                                nsDashboard
                            )}
                        </Typography>
                    ) : (
                        <PolicyUsageTopCustomersBarChart
                            rows={topCustomers}
                            hasTopUpPolicies={showTopUpStack}
                            accountCurrency={accountCurrency}
                            language={i18n.language}
                            isRtl={isRtl}
                            labels={labels}
                        />
                    )}
                </Box>
            </CardContent>
        </Card>
    );
}
