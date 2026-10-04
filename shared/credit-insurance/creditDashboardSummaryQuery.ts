import type { CreditDashboardSummary } from "@/types/creditInsurance";
import { apiFetch } from "@/utils/apiFetch";

export const CREDIT_DASHBOARD_SUMMARY_PREFETCH_KEY =
    "creditDashboardSummaryPrefetch";

export const LOGIN_CREDIT_DASHBOARD_SUMMARY_SCOPE = {
    policyId: null as number | null,
    businessUnitId: null as number | null,
    includeNoPolicyExposure: true,
};

const PREFETCH_TTL_MS = 30_000;

type PrefetchRecord = {
    policyId: number | null;
    businessUnitId: number | null;
    includeNoPolicyExposure: boolean;
    fetchedAt: number;
    summary: CreditDashboardSummary;
};

export function buildCreditDashboardSearchParams(options: {
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

export function isCompleteCreditDashboardSummary(
    body: unknown
): body is CreditDashboardSummary {
    if (body == null || typeof body !== "object") {
        return false;
    }
    const summary = body as CreditDashboardSummary;
    return (
        summary.reportingCountdown != null &&
        typeof summary.reportingCountdown.invoiceCount === "number" &&
        summary.termsBreach != null &&
        summary.withoutPolicy != null &&
        summary.capacityGap != null
    );
}

export async function fetchCreditDashboardSummary(options: {
    policyId: number | null;
    businessUnitId: number | null;
    includeNoPolicyExposure: boolean;
}): Promise<CreditDashboardSummary> {
    const params = buildCreditDashboardSearchParams(options);
    const q = params.toString() ? `?${params.toString()}` : "";
    const res = await apiFetch(`/api/credit-insurance/summary${q}`);
    if (res.status === 403) {
        throw new Error("forbidden");
    }
    if (!res.ok) {
        throw new Error("load_failed");
    }
    const body = (await res.json()) as CreditDashboardSummary;
    if (!isCompleteCreditDashboardSummary(body)) {
        throw new Error("load_failed");
    }
    return body;
}

export function storeCreditDashboardSummaryPrefetch(
    options: {
        policyId: number | null;
        businessUnitId: number | null;
        includeNoPolicyExposure: boolean;
    },
    summary: CreditDashboardSummary
): void {
    if (typeof window === "undefined") {
        return;
    }
    const record: PrefetchRecord = {
        ...options,
        fetchedAt: Date.now(),
        summary,
    };
    try {
        sessionStorage.setItem(
            CREDIT_DASHBOARD_SUMMARY_PREFETCH_KEY,
            JSON.stringify(record)
        );
    } catch {
        sessionStorage.removeItem(CREDIT_DASHBOARD_SUMMARY_PREFETCH_KEY);
    }
}

export function readCreditDashboardSummaryPrefetch(options: {
    policyId: number | null;
    businessUnitId: number | null;
    includeNoPolicyExposure: boolean;
}): CreditDashboardSummary | undefined {
    if (typeof window === "undefined") {
        return undefined;
    }
    try {
        const raw = sessionStorage.getItem(
            CREDIT_DASHBOARD_SUMMARY_PREFETCH_KEY
        );
        if (!raw) {
            return undefined;
        }
        const record = JSON.parse(raw) as PrefetchRecord;
        if (
            record.policyId !== options.policyId ||
            record.businessUnitId !== options.businessUnitId ||
            record.includeNoPolicyExposure !== options.includeNoPolicyExposure
        ) {
            return undefined;
        }
        if (
            typeof record.fetchedAt !== "number" ||
            Date.now() - record.fetchedAt > PREFETCH_TTL_MS
        ) {
            sessionStorage.removeItem(CREDIT_DASHBOARD_SUMMARY_PREFETCH_KEY);
            return undefined;
        }
        if (!isCompleteCreditDashboardSummary(record.summary)) {
            sessionStorage.removeItem(CREDIT_DASHBOARD_SUMMARY_PREFETCH_KEY);
            return undefined;
        }
        return record.summary;
    } catch {
        sessionStorage.removeItem(CREDIT_DASHBOARD_SUMMARY_PREFETCH_KEY);
        return undefined;
    }
}

export async function prefetchCreditDashboardSummaryForLogin(): Promise<boolean> {
    try {
        const summary = await fetchCreditDashboardSummary(
            LOGIN_CREDIT_DASHBOARD_SUMMARY_SCOPE
        );
        storeCreditDashboardSummaryPrefetch(
            LOGIN_CREDIT_DASHBOARD_SUMMARY_SCOPE,
            summary
        );
        return true;
    } catch {
        return false;
    }
}
