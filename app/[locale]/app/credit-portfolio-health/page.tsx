"use client";
import { apiFetch } from "@/utils/apiFetch";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { parseDashboardBusinessUnitIdFromUrl } from "@/shared/dashboard/dashboardBusinessUnitParams";
import { defaultPortfolioHealthDateRange } from "@/shared/creditInsurance/portfolioHealthDateRange";
import type { CreditPortfolioHealthResponse } from "@/types/creditInsurance";
import { useCreditDashboardPoliciesQuery } from "@/app/[locale]/app/credit-dashboard/CreditDashboardPolicySelect";

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

    const policiesQuery = useCreditDashboardPoliciesQuery();
    const policies = useMemo(
        () => policiesQuery.data ?? [],
        [policiesQuery.data]
    );

    const fromYmd = toYmdLocal(startDate);
    const toYmd = toYmdLocal(endDate);

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

    const { data, isLoading, isError, error } = useQuery({
        queryKey: [
            "credit-insurance",
            "portfolio-health",
            fromYmd,
            toYmd,
            selectedPolicyId,
            selectedBusinessUnitId,
            includeNoPolicyExposure,
        ],
        queryFn: async () => {
            const params = buildPortfolioHealthSearchParams({
                from: fromYmd,
                to: toYmd,
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
        />
    );
}
