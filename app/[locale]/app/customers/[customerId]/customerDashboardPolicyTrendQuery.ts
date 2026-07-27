import type { CustomerPolicyCustomerTrendResponse } from "@/server/services/creditInsurance/customerPolicyTrendService";

export function customerPolicyTrendQueryKey(
    customerId: number,
    accountId: number,
    policyId: number | null | undefined,
    days = 90
) {
    return [
        "customer-policy-trend",
        customerId,
        accountId,
        policyId ?? "all",
        days,
    ] as const;
}

export async function fetchCustomerPolicyTrend(
    customerId: number,
    policyId: number | null | undefined,
    days = 90
): Promise<CustomerPolicyCustomerTrendResponse> {
    const params = new URLSearchParams({
        customerId: String(customerId),
        days: String(days),
    });
    if (policyId != null) {
        params.set("policyId", String(policyId));
    }
    const url = `/api/credit-insurance/customer-policy-trend?${params.toString()}`;

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
            parsedError ||
                `Failed to fetch customer policy trend (${res.status})`
        );
    }

    return (await res.json()) as CustomerPolicyCustomerTrendResponse;
}
