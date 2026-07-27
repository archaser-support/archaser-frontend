import type { CustomerDashboardKpisResponse } from "@/server/services/creditInsurance/customerDashboardKpisService";

export function customerDashboardKpisQueryKey(
    customerId: number,
    accountId: number,
    policyId: number | null | undefined
) {
    return [
        "customer-dashboard-kpis",
        customerId,
        accountId,
        policyId ?? "all",
    ] as const;
}

export async function fetchCustomerDashboardKpis(
    customerId: number,
    policyId: number | null | undefined,
    days = 90
): Promise<CustomerDashboardKpisResponse> {
    const params = new URLSearchParams({
        customerId: String(customerId),
        days: String(days),
    });
    if (policyId != null) {
        params.set("policyId", String(policyId));
    }
    const url = `/api/credit-insurance/customer-dashboard-kpis?${params.toString()}`;

    const res = await fetch(url);
    if (!res.ok) {
        const errorBody = await res.text().catch(() => "");
        let parsedError: string | null = null;
        try {
            const json = JSON.parse(errorBody) as { error?: string };
            parsedError = json.error ?? null;
        } catch {
            parsedError = errorBody || null;
        }
        throw new Error(
            parsedError || `Failed to fetch customer dashboard KPIs (${res.status})`
        );
    }

    return (await res.json()) as CustomerDashboardKpisResponse;
}
