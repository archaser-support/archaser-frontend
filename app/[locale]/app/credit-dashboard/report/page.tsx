"use client";
import { apiFetch } from "@/utils/apiFetch";

import { Alert, Box, Typography, useTheme } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import InternalPageWrapper from "@/components/InternalPageWrapper";
import PageHeader from "@/components/PageHeader";
import BusinessUnitDashboardFilter from "@/shared/components/BusinessUnitDashboardFilter";
import { parseDashboardBusinessUnitIdFromUrl } from "@/shared/dashboard/dashboardBusinessUnitParams";
import type { CreditDashboardSummary } from "@/types/creditInsurance";
import Seo from "@/shared/layout-components/seo/seo";
import { getUserDateLocale } from "@/utils/datetimeOperations";

import {
    CreditDashboardPolicySelect,
    useCreditDashboardPoliciesQuery,
} from "../CreditDashboardPolicySelect";
import { CreditDashboardReportViewGrid } from "./CreditDashboardReportViewGrid";
import { CreditReportSummaryCards } from "./CreditReportSummaryCards";
import {
    isCreditReportType,
    type CreditReportType,
} from "./creditReportTypes";


type ReportType = CreditReportType;

const REPORT_TITLE_KEY: Record<ReportType, string> = {
    overdue: "title_overdue",
    capacity: "title_capacity",
    terms: "title_terms",
    policy_risk: "title_policy_risk",
    reporting: "title_reporting",
    reported: "title_reported",
    limit_warning: "title_limit_warning",
    zero_limit_warning: "title_zero_limit_warning",
    top_up: "title_top_up",
    top_up_expiring: "title_top_up_expiring",
    no_policy_exposure: "title_no_policy_exposure",
    utilization_bin: "title_utilization_bin",
};

const REPORT_DESCRIPTION_KEY: Record<ReportType, string> = {
    overdue: "description_overdue",
    capacity: "description_capacity",
    terms: "description_terms",
    policy_risk: "description_policy_risk",
    reporting: "description_reporting",
    reported: "description_reported",
    limit_warning: "description_limit_warning",
    zero_limit_warning: "description_zero_limit_warning",
    top_up: "description_top_up",
    top_up_expiring: "description_top_up_expiring",
    no_policy_exposure: "description_no_policy_exposure",
    utilization_bin: "description_utilization_bin",
};

export default function CreditDashboardReportPage() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const theme = useTheme();
    const { t } = useTranslation("dashboard");
    const { data: session } = useSession();
    const userLocale = getUserDateLocale(session);

    const typeParam = (searchParams?.get("type") || "overdue") as ReportType;
    const type: ReportType = isCreditReportType(typeParam)
        ? typeParam
        : "overdue";

    const policiesQuery = useCreditDashboardPoliciesQuery();
    const policies = policiesQuery.data ?? [];

    const pathForRouter = pathname ?? "/";

    const parsedPolicyIdFromUrl = useMemo(() => {
        const raw = searchParams?.get("policyId");
        if (!raw || !/^\d+$/.test(raw)) {
            return null;
        }
        return Number.parseInt(raw, 10);
    }, [searchParams]);

    const parsedCustomerIdFromUrl = useMemo(() => {
        const raw = searchParams?.get("customerId");
        if (!raw || !/^\d+$/.test(raw)) {
            return null;
        }
        return Number.parseInt(raw, 10);
    }, [searchParams]);

    const selectedBusinessUnitId = useMemo(
        () =>
            parseDashboardBusinessUnitIdFromUrl(
                searchParams?.get("businessUnitId")
            ),
        [searchParams]
    );

    const termsBreachReasonFromUrl = useMemo(() => {
        const raw = searchParams?.get("termsBreachReason")?.trim();
        return raw || null;
    }, [searchParams]);

    const termsOverdueOnlyFromUrl = useMemo(() => {
        const raw = searchParams?.get("termsOverdueOnly")?.trim().toLowerCase();
        return raw === "1" || raw === "true" || raw === "yes";
    }, [searchParams]);
    const includeNoPolicyExposureFromUrl = useMemo(() => {
        const raw = searchParams?.get("includeNoPolicyExposure")?.trim().toLowerCase();
        if (!raw) {
            return true;
        }
        return !(raw === "0" || raw === "false" || raw === "no");
    }, [searchParams]);
    const withinDaysFromUrl = useMemo(() => {
        const raw = searchParams?.get("withinDays");
        if (!raw || !/^\d+$/.test(raw)) {
            return null;
        }
        const n = Number.parseInt(raw, 10);
        if (!Number.isFinite(n) || n < 1) {
            return null;
        }
        return Math.min(n, 365);
    }, [searchParams]);

    const utilizationBinFromUrl = useMemo(() => {
        const raw = searchParams?.get("bin")?.trim() ?? "";
        return raw || null;
    }, [searchParams]);

    const asOfDateFromUrl = useMemo(() => {
        const raw = searchParams?.get("asOf")?.trim() ?? "";
        return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
    }, [searchParams]);

    const policyIdForScope = useMemo(() => {
        if (parsedPolicyIdFromUrl == null) {
            return null;
        }
        if (policies.length === 0) {
            return parsedPolicyIdFromUrl;
        }
        return policies.some((p) => p.id === parsedPolicyIdFromUrl)
            ? parsedPolicyIdFromUrl
            : null;
    }, [parsedPolicyIdFromUrl, policies]);

    useEffect(() => {
        if (policies.length === 0) {
            return;
        }
        if (
            parsedPolicyIdFromUrl != null &&
            !policies.some((p) => p.id === parsedPolicyIdFromUrl)
        ) {
            const sp = new URLSearchParams(searchParams?.toString() ?? "");
            sp.delete("policyId");
            router.replace(`${pathForRouter}?${sp.toString()}`);
        }
    }, [
        policies,
        parsedPolicyIdFromUrl,
        pathForRouter,
        router,
        searchParams,
    ]);

    const setPolicyScope = (id: number | null) => {
        const sp = new URLSearchParams(searchParams?.toString() ?? "");
        if (id == null) {
            sp.delete("policyId");
        } else {
            sp.set("policyId", String(id));
        }
        router.replace(`${pathForRouter}?${sp.toString()}`);
    };

    const setBusinessUnitScope = (id: number | null) => {
        const sp = new URLSearchParams(searchParams?.toString() ?? "");
        if (id == null) {
            sp.delete("businessUnitId");
        } else {
            sp.set("businessUnitId", String(id));
        }
        router.replace(`${pathForRouter}?${sp.toString()}`);
    };

    const summaryQuery = useQuery({
        queryKey: [
            "credit-insurance",
            "summary",
            policyIdForScope,
            selectedBusinessUnitId,
        ],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (policyIdForScope != null) {
                params.set("policyId", String(policyIdForScope));
            }
            if (selectedBusinessUnitId != null) {
                params.set("businessUnitId", String(selectedBusinessUnitId));
            }
            if (!includeNoPolicyExposureFromUrl) {
                params.set("includeNoPolicyExposure", "0");
            }
            const q = params.toString() ? `?${params.toString()}` : "";
            const res = await apiFetch(`/api/credit-insurance/summary${q}`);
            if (!res.ok) {
                return null;
            }
            return (await res.json()) as CreditDashboardSummary;
        },
    });

    const { isError, error, data: summary } = summaryQuery;

    const title = t(`credit_insurance_report.${REPORT_TITLE_KEY[type]}`);
    const pageDescription = t(
        `credit_insurance_report.${REPORT_DESCRIPTION_KEY[type]}`
    );
    const seoTitle = t("credit_insurance_report.seo_title", { title });

    if (isError) {
        return (
            <InternalPageWrapper>
                <Box sx={{ p: 3 }}>
                    <Alert severity="error">
                        {t("credit_insurance_report.load_summary_failed")}
                    </Alert>
                    {error instanceof Error && (
                        <Typography variant="caption" color="text.secondary">
                            {error.message}
                        </Typography>
                    )}
                </Box>
            </InternalPageWrapper>
        );
    }

    return (
        <>
            <Seo title={seoTitle} />
            <InternalPageWrapper>
                <Box
                    sx={{
                        bgcolor: "background.default",
                        borderRadius: theme.shape.borderRadius,
                    }}
                >
                    <PageHeader
                        title={title}
                        description={pageDescription}
                    />

                    <Box
                        sx={{
                            flex: 1,
                            width: "100%",
                            position: "relative",
                            px: 0,
                        }}
                    >
                        <Box sx={{ pb: 2 }}>
                            <Box
                                className="endless-scroll-toolbar"
                                sx={{
                                    display: "flex",
                                    flexDirection: "row",
                                    gap: theme.spacing(1),
                                    alignItems: "flex-end",
                                    flexWrap: "wrap",
                                    mb: 2,
                                }}
                            >
                                <BusinessUnitDashboardFilter
                                    value={selectedBusinessUnitId}
                                    onChange={setBusinessUnitScope}
                                />
                                <CreditDashboardPolicySelect
                                    policies={policies}
                                    value={policyIdForScope}
                                    onChange={setPolicyScope}
                                />
                            </Box>
                            {summary && type !== "utilization_bin" && (
                                <CreditReportSummaryCards
                                    type={type}
                                    summary={summary}
                                    userLocale={userLocale}
                                    accountCurrency={
                                        summary.accountCurrency
                                            ? String(summary.accountCurrency)
                                            : "USD"
                                    }
                                />
                            )}

                            <CreditDashboardReportViewGrid
                                type={type}
                                policyId={policyIdForScope}
                                businessUnitId={selectedBusinessUnitId}
                                customerId={parsedCustomerIdFromUrl}
                                includeNoPolicyExposure={
                                    includeNoPolicyExposureFromUrl
                                }
                                termsBreachReason={termsBreachReasonFromUrl}
                                termsOverdueOnly={termsOverdueOnlyFromUrl}
                                withinDays={withinDaysFromUrl}
                                utilizationBin={utilizationBinFromUrl}
                                asOfDate={asOfDateFromUrl}
                            />
                        </Box>
                    </Box>
                </Box>
            </InternalPageWrapper>
        </>
    );
}
