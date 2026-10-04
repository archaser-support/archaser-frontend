import type { CreditDashboardSummary } from "@/types/creditInsurance";
import { apiFetch } from "@/utils/apiFetch";

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
