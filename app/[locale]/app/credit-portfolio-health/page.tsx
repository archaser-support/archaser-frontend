"use client";
import { apiFetch } from "@/utils/apiFetch";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { parseDashboardBusinessUnitIdFromUrl } from "@/shared/dashboard/dashboardBusinessUnitParams";
import {
    clampPortfolioHealthRangeEnd,
    defaultPortfolioHealthDateRange,
} from "@/shared/creditInsurance/portfolioHealthDateRange";
import type {
    CreditAsOfBackfillJobView,
    CreditPortfolioHealthResponse,
} from "@/types/creditInsurance";
import { useCreditDashboardPoliciesQuery } from "@/app/[locale]/app/credit-dashboard/CreditDashboardPolicySelect";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";

import { CreditPortfolioHealthScreen } from "./CreditPortfolioHealthScreen";
import {
    parsePortfolioHealthTab,
    type PortfolioHealthTabId,
} from "./PillTabs";

function toYmdLocal(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function parseYmdToLocalDate(ymd: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
        return null;
    }
    const [year, month, day] = ymd.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }
    date.setHours(0, 0, 0, 0);
    return date;
}

function endOfLocalDay(date: Date): Date {
    const next = new Date(date);
    next.setHours(23, 59, 59, 999);
    return next;
}

function defaultLocalDateRange(): { start: Date; end: Date } {
    const { from, to } = defaultPortfolioHealthDateRange();
    const start = parseYmdToLocalDate(from)!;
    const end = endOfLocalDay(parseYmdToLocalDate(to)!);
    return { start, end };
}

function buildPortfolioHealthSearchParams(options: {
    from: string;
    to: string;
    policyId: number | null;
    businessUnitId: number | null;
    includeNoPolicyExposure: boolean;
    tab?: PortfolioHealthTabId;
}): URLSearchParams {
    const params = new URLSearchParams();
    params.set("from", options.from);
    params.set("to", options.to);
    if (options.policyId != null) {
        params.set("policyId", String(options.policyId));
    }
    if (options.businessUnitId != null) {
        params.set("businessUnitId", String(options.businessUnitId));
    }
    if (!options.includeNoPolicyExposure) {
        params.set("includeNoPolicyExposure", "0");
    }
    if (options.tab != null && options.tab !== "health") {
        params.set("tab", options.tab);
    }
    return params;
}

export default function CreditPortfolioHealthPage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const pathForRouter = pathname ?? "/";
    const queryClient = useQueryClient();
    const { error: showError } = useToast();
    const { t } = useTranslation(["dashboard"]);
    const prevBackfillStatusRef = useRef<string | null>(null);

    const defaults = useMemo(() => defaultLocalDateRange(), []);

    const [startDate, setStartDate] = useState<Date>(() => {
        const fromParam = searchParams?.get("from");
        if (fromParam) {
            const parsed = parseYmdToLocalDate(fromParam);
            if (parsed) {
                return parsed;
            }
        }
        return defaults.start;
    });
    const [endDate, setEndDate] = useState<Date>(() => {
        const toParam = searchParams?.get("to");
        if (toParam) {
            const parsed = parseYmdToLocalDate(toParam);
            if (parsed) {
                return endOfLocalDay(parsed);
            }
        }
        return defaults.end;
    });

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
    const [activeTab, setActiveTab] = useState<PortfolioHealthTabId>(() =>
        parsePortfolioHealthTab(searchParams?.get("tab"))
    );
    const [ignoreReportingBreach, setIgnoreReportingBreach] = useState(true);

    const policiesQuery = useCreditDashboardPoliciesQuery();
    const policies = useMemo(
        () => policiesQuery.data ?? [],
        [policiesQuery.data]
    );

    const fromYmd = toYmdLocal(startDate);
    const toYmd = toYmdLocal(endDate);
    const requestToYmd = clampPortfolioHealthRangeEnd(
        fromYmd,
        toYmd,
        toYmdLocal(new Date())
    );

    const replacePortfolioHealthUrl = useCallback(
        (next: {
            from: string;
            to: string;
            policyId: number | null;
            businessUnitId: number | null;
            includeNoPolicyExposure: boolean;
            tab?: PortfolioHealthTabId;
        }) => {
            const nextParams = buildPortfolioHealthSearchParams({
                ...next,
                tab: next.tab ?? activeTab,
            });
            router.replace(`${pathForRouter}?${nextParams.toString()}`);
        },
        [pathForRouter, router, activeTab]
    );
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
        const fromParam = searchParams?.get("from");
        const toParam = searchParams?.get("to");
        if (fromParam) {
            const parsed = parseYmdToLocalDate(fromParam);
            if (parsed) {
                setStartDate(parsed);
            }
        }
        if (toParam) {
            const parsed = parseYmdToLocalDate(toParam);
            if (parsed) {
                setEndDate(endOfLocalDay(parsed));
            }
        }
        setActiveTab(parsePortfolioHealthTab(searchParams?.get("tab")));
    }, [searchParams]);

    // Seed from/to in the URL when missing so the network request matches defaults.
    useEffect(() => {
        const hasFrom = Boolean(searchParams?.get("from"));
        const hasTo = Boolean(searchParams?.get("to"));
        if (hasFrom && hasTo) {
            return;
        }
        replacePortfolioHealthUrl({
            from: fromYmd,
            to: toYmd,
            policyId: selectedPolicyId,
            businessUnitId: selectedBusinessUnitId,
            includeNoPolicyExposure,
        });
    }, [
        searchParams,
        fromYmd,
        toYmd,
        selectedPolicyId,
        selectedBusinessUnitId,
        includeNoPolicyExposure,
        replacePortfolioHealthUrl,
    ]);

    useEffect(() => {
        if (policies.length === 0) {
            return;
        }
        if (
            selectedPolicyId != null &&
            !policies.some((p) => Number(p.id) === Number(selectedPolicyId))
        ) {
            setSelectedPolicyId(null);
            replacePortfolioHealthUrl({
                from: fromYmd,
                to: toYmd,
                policyId: null,
                businessUnitId: selectedBusinessUnitId,
                includeNoPolicyExposure,
            });
        }
    }, [
        policies,
        selectedPolicyId,
        fromYmd,
        toYmd,
        selectedBusinessUnitId,
        includeNoPolicyExposure,
        replacePortfolioHealthUrl,
    ]);

    const setPolicyScope = (id: number | null) => {
        setSelectedPolicyId(id);
        replacePortfolioHealthUrl({
            from: fromYmd,
            to: toYmd,
            policyId: id,
            businessUnitId: selectedBusinessUnitId,
            includeNoPolicyExposure,
        });
    };

    const setBusinessUnitScope = (id: number | null) => {
        setSelectedBusinessUnitId(id);
        replacePortfolioHealthUrl({
            from: fromYmd,
            to: toYmd,
            policyId: selectedPolicyId,
            businessUnitId: id,
            includeNoPolicyExposure,
        });
    };

    const setIncludeNoPolicyExposureScope = (value: boolean) => {
        setIncludeNoPolicyExposure(value);
        replacePortfolioHealthUrl({
            from: fromYmd,
            to: toYmd,
            policyId: selectedPolicyId,
            businessUnitId: selectedBusinessUnitId,
            includeNoPolicyExposure: value,
        });
    };

    const handleStartDateChange = (date: Date) => {
        const nextStart = new Date(date);
        nextStart.setHours(0, 0, 0, 0);
        setStartDate(nextStart);
        replacePortfolioHealthUrl({
            from: toYmdLocal(nextStart),
            to: toYmd,
            policyId: selectedPolicyId,
            businessUnitId: selectedBusinessUnitId,
            includeNoPolicyExposure,
        });
    };

    const handleEndDateChange = (date: Date) => {
        const nextEnd = endOfLocalDay(date);
        setEndDate(nextEnd);
        replacePortfolioHealthUrl({
            from: fromYmd,
            to: toYmdLocal(nextEnd),
            policyId: selectedPolicyId,
            businessUnitId: selectedBusinessUnitId,
            includeNoPolicyExposure,
        });
    };

    const handleDateRangeChange = (start: Date, end: Date) => {
        const nextStart = new Date(start);
        nextStart.setHours(0, 0, 0, 0);
        const nextEnd = endOfLocalDay(end);
        setStartDate(nextStart);
        setEndDate(nextEnd);
        replacePortfolioHealthUrl({
            from: toYmdLocal(nextStart),
            to: toYmdLocal(nextEnd),
            policyId: selectedPolicyId,
            businessUnitId: selectedBusinessUnitId,
            includeNoPolicyExposure,
        });
    };

    const handleTabChange = (tab: PortfolioHealthTabId) => {
        setActiveTab(tab);
        replacePortfolioHealthUrl({
            from: fromYmd,
            to: toYmd,
            policyId: selectedPolicyId,
            businessUnitId: selectedBusinessUnitId,
            includeNoPolicyExposure,
            tab,
        });
    };

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: [
            "credit-insurance",
            "portfolio-health",
            fromYmd,
            requestToYmd,
            selectedPolicyId,
            selectedBusinessUnitId,
            includeNoPolicyExposure,
        ],
        queryFn: async () => {
            const params = buildPortfolioHealthSearchParams({
                from: fromYmd,
                to: requestToYmd,
                policyId: selectedPolicyId,
                businessUnitId: selectedBusinessUnitId,
                includeNoPolicyExposure,
            });
            const res = await apiFetch(`/api/credit-insurance/portfolio-health?${params.toString()}`
            );
            if (res.status === 403) {
                throw new Error("forbidden");
            }
            if (!res.ok) {
                throw new Error("load_failed");
            }
            return (await res.json()) as CreditPortfolioHealthResponse;
        },
        retry: false,
        staleTime: 0,
        refetchOnMount: "always",
        refetchOnWindowFocus: false,
        placeholderData: (previousData) => previousData,
    });

    const { data: backfillJob } = useQuery({
        queryKey: ["credit-insurance", "asof-backfill-status"],
        queryFn: async () => {
            const res = await apiFetch(
                "/api/credit-insurance/asof-backfill-status"
            );
            if (res.status === 403) {
                throw new Error("forbidden");
            }
            if (!res.ok) {
                throw new Error("backfill_status_failed");
            }
            return (await res.json()) as CreditAsOfBackfillJobView;
        },
        retry: false,
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            return status === "running" || status === "paused" ? 2000 : false;
        },
    });

    useEffect(() => {
        const status = backfillJob?.status ?? null;
        const prev = prevBackfillStatusRef.current;
        prevBackfillStatusRef.current = status;
        if (prev === "running" && status === "complete") {
            void refetch();
        }
    }, [backfillJob?.status, refetch]);

    useEffect(() => {
        const status = backfillJob?.status;
        if (
            status === "running" ||
            status === "paused" ||
            status === "failed"
        ) {
            setIgnoreReportingBreach(
                backfillJob?.skipReportingBreach !== false
            );
        }
    }, [backfillJob?.status, backfillJob?.skipReportingBreach]);

    const generateMutation = useMutation({
        mutationFn: async () => {
            const res = await apiFetch(
                "/api/credit-insurance/asof-backfill-start",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        from: fromYmd,
                        to: requestToYmd,
                        skipReportingBreach: ignoreReportingBreach,
                    }),
                }
            );
            if (res.status === 403) {
                throw new Error("forbidden");
            }
            if (res.status === 409) {
                throw new Error("already_running");
            }
            if (!res.ok) {
                throw new Error("generate_failed");
            }
            return (await res.json()) as CreditAsOfBackfillJobView;
        },
        onSuccess: (job) => {
            queryClient.setQueryData(
                ["credit-insurance", "asof-backfill-status"],
                job
            );
        },
        onError: () => {
            showError(
                t("credit_portfolio_health.generate_failed", {
                    ns: "dashboard",
                    defaultValue: "Could not generate snapshots.",
                })
            );
        },
    });

    const stopMutation = useMutation({
        mutationFn: async () => {
            const res = await apiFetch(
                "/api/credit-insurance/asof-backfill-pause",
                { method: "POST" }
            );
            if (!res.ok) {
                throw new Error("stop_failed");
            }
            return (await res.json()) as CreditAsOfBackfillJobView;
        },
        onSuccess: (job) => {
            queryClient.setQueryData(
                ["credit-insurance", "asof-backfill-status"],
                job
            );
        },
    });

    const retryMutation = useMutation({
        mutationFn: async () => {
            const res = await apiFetch(
                "/api/credit-insurance/asof-backfill-retry",
                { method: "POST" }
            );
            if (res.status === 409) {
                throw new Error("already_running");
            }
            if (!res.ok) {
                throw new Error("retry_failed");
            }
            return (await res.json()) as CreditAsOfBackfillJobView;
        },
        onSuccess: (job) => {
            queryClient.setQueryData(
                ["credit-insurance", "asof-backfill-status"],
                job
            );
        },
    });

    return (
        <CreditPortfolioHealthScreen
            policies={policies}
            policyId={selectedPolicyId}
            onPolicyScopeChange={setPolicyScope}
            selectedBusinessUnitId={selectedBusinessUnitId}
            onBusinessUnitScopeChange={setBusinessUnitScope}
            includeNoPolicyExposure={includeNoPolicyExposure}
            onIncludeNoPolicyExposureChange={setIncludeNoPolicyExposureScope}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={handleStartDateChange}
            onEndDateChange={handleEndDateChange}
            onDateRangeChange={handleDateRangeChange}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            data={data}
            isLoading={isLoading}
            isError={isError}
            error={
                isError
                    ? error instanceof Error
                        ? error
                        : new Error(String(error))
                    : null
            }
            backfillJob={backfillJob}
            onGenerateSnapshots={() => generateMutation.mutate()}
            onStopGenerate={() => stopMutation.mutate()}
            onRetryGenerate={() => retryMutation.mutate()}
            generatePending={generateMutation.isPending}
            stopPending={stopMutation.isPending}
            retryPending={retryMutation.isPending}
            ignoreReportingBreach={ignoreReportingBreach}
            onIgnoreReportingBreachChange={setIgnoreReportingBreach}
        />
    );
}
