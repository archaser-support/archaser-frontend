"use client";

import type { ImportType } from "@/types/db";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
    discoverBillingConnectorFields,
    fetchBillingConnectorDiscoveredFields,
    type DiscoverFieldsResponse,
} from "@/shared/services/billingConnectorService";

export function billingConnectorDiscoveredFieldsQueryKey(
    accountId: number,
    importType: ImportType
) {
    return [
        "billing-connector-discovered-fields",
        accountId,
        importType,
    ] as const;
}

/**
 * Shared Priority field discovery for pull-filter + field-mapper Autocomplete.
 * Loads the DB cache on mount; only hits Priority when Discover / Re-discover is clicked.
 */
export function useBillingConnectorDiscoveredFields(
    accountId: number,
    importType: ImportType
) {
    const queryClient = useQueryClient();
    const queryKey = billingConnectorDiscoveredFieldsQueryKey(
        accountId,
        importType
    );

    const { data, isLoading } = useQuery<DiscoverFieldsResponse>({
        queryKey,
        queryFn: () =>
            fetchBillingConnectorDiscoveredFields(accountId, importType),
        enabled: accountId > 0,
        staleTime: Infinity,
    });

    const discoverMutation = useMutation({
        mutationFn: () =>
            discoverBillingConnectorFields(accountId, importType),
        onSuccess: (result) => {
            queryClient.setQueryData(queryKey, result);
        },
    });

    return {
        rawHeaders: data?.raw_headers ?? [],
        exampleValues: data?.example_values ?? {},
        discoveredAt: data?.discovered_at ?? null,
        isLoading,
        isDiscovering: discoverMutation.isPending,
        discover: discoverMutation.mutateAsync,
        discoverError: discoverMutation.error,
    };
}
