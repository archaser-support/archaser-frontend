"use client";

import { useQuery } from "@tanstack/react-query";

import { customerCreditPoolQueryKey } from "@/shared/customerCreditPool";
import { getCustomerAggregatedData } from "@/shared/services/customerService";

/**
 * Shared Aggregated Data / credit-pool query for shell-parent Dashboard + header.
 */
export function useCustomerCreditPool(
    customerId: number | null | undefined,
    enabled: boolean
) {
    return useQuery({
        queryKey: customerCreditPoolQueryKey(customerId ?? 0),
        queryFn: () => getCustomerAggregatedData(customerId!),
        enabled: !!customerId && enabled,
        staleTime: 60_000,
    });
}
