"use client";
import { apiFetch } from "@/utils/apiFetch";

import { useQuery } from "@tanstack/react-query";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { parseDashboardBusinessUnitIdFromUrl } from "@/shared/dashboard/dashboardBusinessUnitParams";
import type { CreditDashboardSummary } from "@/server/services/creditInsurance/creditInsuranceDashboardService";
import type { CreditDashboardHistoryInterval, CreditDashboardSummaryHistory } from "@/server/services/creditInsurance/creditDashboardSnapshotService";
import type { CustomerPolicyUsageTrendResponse } from "@/server/services/creditInsurance/customerPolicyTrendService";

import { CreditDashboardScreen } from "./CreditDashboardScreen";
import {
    useCreditDashboardPoliciesQuery,
} from "./CreditDashboardPolicySelect";

const EMPTY_HISTORY_SERIES: CreditDashboardSummaryHistory["series"] = [];
const EMPTY_HISTORY_DELTA: CreditDashboardSummaryHistory["delta"] = {
    totalReceivables: null,
    compliantExposure: null,
    atRiskExposure: null,
    healthIndex: null,
};

function buildCreditDashboardSearchParams(options: {
    policyId: number | null;
    businessUnitId: number | null;
    includeNoPolicyExposure: boolean;
}): URLSearchParams {
    const params = new URLSearchParams();
    if (options.policyId != null) {
        params.set("policyId", String(options.policyId));
    }
    if (options.businessUnitId != null) {
        params.set("businessUnitId", String(options.businessUnitId));
    }
    if (!options.includeNoPolicyExposure) {
        params.set("includeNoPolicyExposure", "0");
    }
    return params;
}

export default function CreditDashboardPage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const params = useParams();
    const locale = (params?.locale as string) || "en";
    const policyIdParam = searchParams?.get("policyId") ?? "";
    const initialPolicyId =
        policyIdParam && /^\d+$/.test(policyIdParam)
            ? Number.parseInt(policyIdParam, 10)
            : null;
    const [selectedPolicyId, setSelectedPolicyId] = useState<number | null>(
        initialPolicyId
    );
    const [selectedBusinessUnitId, setSelectedBusinessUnitId] = useState<
        number | null
    >(() =>
        parseDashboardBusinessUnitIdFromUrl(
            searchParams?.get("businessUnitId")
        )
    );
    const [trendInterval, setTrendInterval] =
        useState<CreditDashboardHistoryInterval>("daily");
    const [includeNoPolicyExposure, setIncludeNoPolicyExposure] = useState(
        () => {
            const raw = searchParams?.get("includeNoPolicyExposure");
            if (!raw) {
                return true;
            }
            const value = raw.trim().toLowerCase();
            return !(value === "0" || value === "false" || value === "no");
        }
    );

    const policiesQuery = useCreditDashboardPoliciesQuery();
    const policies = useMemo(() => policiesQuery.data ?? [], [policiesQuery.data]);

    const pathForRouter = pathname ?? "/";

    const policyIdForSummary = selectedPolicyId;

    useEffect(() => {
        setSelectedBusinessUnitId(
            parseDashboardBusinessUnitIdFromUrl(
                searchParams?.get("businessUnitId")
            )
        );
        const raw = searchParams?.get("includeNoPolicyExposure");
        if (!raw) {
            setIncludeNoPolicyExposure(true);
        } else {
            const value = raw.trim().toLowerCase();
            setIncludeNoPolicyExposure(
                !(value === "0" || value === "false" || value === "no")
            );
        }
    }, [searchParams]);

    useEffect(() => {
        if (policies.length === 0) {
            return;
        }
        if (
            policyIdForSummary != null &&
            !policies.some(
                (p) => Number(p.id) === Number(policyIdForSummary)
            )
        ) {
            setSelectedPolicyId(null);
            const nextParams = buildCreditDashboardSearchParams({
                policyId: null,
                businessUnitId: selectedBusinessUnitId,
                includeNoPolicyExposure,
            });
            router.replace(
                nextParams.toString()
                    ? `${pathForRouter}?${nextParams.toString()}`
                    : pathForRouter
            );
        }
    }, [
        policies,
        policyIdForSummary,
        pathForRouter,
        router,
        selectedBusinessUnitId,
        includeNoPolicyExposure,
    ]);

    const replaceDashboardUrl = useCallback(
        (
            policyId: number | null,
            businessUnitId: number | null,
            includeNoPolicyExposureValue: boolean
        ) => {
            const nextParams = buildCreditDashboardSearchParams({
                policyId,
                businessUnitId,
                includeNoPolicyExposure: includeNoPolicyExposureValue,
            });
            router.replace(
                nextParams.toString()
                    ? `${pathForRouter}?${nextParams.toString()}`
                    : pathForRouter
            );
        },
        [pathForRouter, router]
    );

    const setPolicyScope = (id: number | null) => {
        setSelectedPolicyId(id);
        replaceDashboardUrl(id, selectedBusinessUnitId, includeNoPolicyExposure);
    };

    const setBusinessUnitScope = (id: number | null) => {
        setSelectedBusinessUnitId(id);
        replaceDashboardUrl(selectedPolicyId, id, includeNoPolicyExposure);
    };

    const setIncludeNoPolicyExposureScope = (value: boolean) => {
        setIncludeNoPolicyExposure(value);
        replaceDashboardUrl(selectedPolicyId, selectedBusinessUnitId, value);
    };

    const appendDashboardScopeQuery = (query: string) => {
        const params = buildCreditDashboardSearchParams({
            policyId: null,
            businessUnitId: selectedBusinessUnitId,
            includeNoPolicyExposure,
        });
        const suffix = params.toString();
        if (!suffix) {
            return query;
        }
        const separator = query.includes("?") ? "&" : "?";
        return `${query}${separator}${suffix}`;
    };

    const { data, isLoading, isFetching, isError, error } = useQuery({
        queryKey: [
            "credit-insurance",
            "summary",
            policyIdForSummary,
            selectedBusinessUnitId,
            includeNoPolicyExposure,
        ],
        queryFn: async () => {
            const params = buildCreditDashboardSearchParams({
                policyId: policyIdForSummary,
                businessUnitId: selectedBusinessUnitId,
                includeNoPolicyExposure,
            });
            const q = params.toString() ? `?${params.toString()}` : "";
            const res = await apiFetch(`/api/credit-insurance/summary${q}`);
            if (res.status === 403) {
                throw new Error("forbidden");
            }
            if (!res.ok) {
                throw new Error("load_failed");
            }
            const body = (await res.json()) as CreditDashboardSummary;
            // Incomplete Nest stubs (missing reportingCountdown) must not reach
            // CreditDashboardScreen — that path throws on invoiceCount.
            if (
                body == null ||
                typeof body !== "object" ||
                body.reportingCountdown == null ||
                typeof body.reportingCountdown.invoiceCount !== "number" ||
                body.termsBreach == null ||
                body.withoutPolicy == null ||
                body.capacityGap == null
            ) {
                throw new Error("load_failed");
            }
            return body;
        },
        retry: false,
        staleTime: 0,
        refetchOnMount: "always",
        refetchOnWindowFocus: false,
        // Do not keep a previous incomplete/error payload as placeholder.
        placeholderData: (previousData) => {
            if (
                previousData?.reportingCountdown == null ||
                typeof previousData.reportingCountdown.invoiceCount !== "number"
            ) {
                return undefined;
            }
            return previousData;
        },
    });

    const historyDays = 30;

    const historyQuery = useQuery({
        queryKey: [
            "credit-insurance",
            "summary-history",
            policyIdForSummary,
            selectedBusinessUnitId,
            historyDays,
            trendInterval,
            includeNoPolicyExposure,
        ],
        queryFn: async () => {
            const params = new URLSearchParams({
                days: String(historyDays),
                interval: trendInterval,
            });
            if (policyIdForSummary != null) {
                params.set("policyId", String(policyIdForSummary));
            }
            if (selectedBusinessUnitId != null) {
                params.set("businessUnitId", String(selectedBusinessUnitId));
            }
            if (!includeNoPolicyExposure) {
                params.set("includeNoPolicyExposure", "0");
            }
            const res = await apiFetch(`/api/credit-insurance/summary-history?${params.toString()}`
            );
            if (!res.ok) {
                throw new Error("history_load_failed");
            }
            return (await res.json()) as CreditDashboardSummaryHistory;
        },
        retry: false,
        staleTime: 0,
        refetchOnMount: "always",
        refetchOnWindowFocus: false,
        placeholderData: (previousData, previousQuery) => {
            const prev = previousQuery?.queryKey;
            if (
                prev?.[4] !== historyDays ||
                prev?.[5] !== trendInterval
            ) {
                return undefined;
            }
            return previousData;
        },
    });

    const topCustomerUsageQuery = useQuery({
        queryKey: [
            "credit-insurance",
            "customer-policy-usage",
            policyIdForSummary,
            selectedBusinessUnitId,
            includeNoPolicyExposure,
        ],
        queryFn: async () => {
            const params = new URLSearchParams({ limit: "10" });
            if (policyIdForSummary != null) {
                params.set("policyId", String(policyIdForSummary));
            }
            if (selectedBusinessUnitId != null) {
                params.set("businessUnitId", String(selectedBusinessUnitId));
            }
            if (!includeNoPolicyExposure) {
                params.set("includeNoPolicyExposure", "0");
            }
            const res = await apiFetch(`/api/credit-insurance/customer-policy-trend?${params.toString()}`
            );
            if (!res.ok) {
                throw new Error("usage_trend_load_failed");
            }
            return (await res.json()) as CustomerPolicyUsageTrendResponse;
        },
        retry: false,
        staleTime: 0,
        refetchOnMount: "always",
        refetchOnWindowFocus: false,
        placeholderData: (previousData) => previousData,
    });

    return (
        <CreditDashboardScreen
            locale={locale}
            policies={policies}
            policyIdForSummary={policyIdForSummary}
            onPolicyScopeChange={setPolicyScope}
            selectedBusinessUnitId={selectedBusinessUnitId}
            onBusinessUnitScopeChange={setBusinessUnitScope}
            includeNoPolicyExposure={includeNoPolicyExposure}
            onIncludeNoPolicyExposureChange={setIncludeNoPolicyExposureScope}
            summary={data}
            isSummaryLoading={isLoading}
            isSummaryError={isError}
            summaryError={
                isError
                    ? error instanceof Error
                        ? error
                        : new Error(String(error))
                    : null
            }
            isSummaryFetching={isFetching}
            historySeries={historyQuery.data?.series ?? EMPTY_HISTORY_SERIES}
            historyDelta={historyQuery.data?.delta ?? EMPTY_HISTORY_DELTA}
            historyLoadFailed={historyQuery.isError}
            historyDays={historyDays}
            trendInterval={trendInterval}
            onTrendIntervalChange={setTrendInterval}
            monthPct={historyQuery.data?.monthPct ?? null}
            topCustomerUsage={topCustomerUsageQuery.data}
            isTopCustomerUsageLoading={topCustomerUsageQuery.isLoading}
            onNavigateReport={(path) =>
                router.push(appendDashboardScopeQuery(path))
            }
        />
    );
}
