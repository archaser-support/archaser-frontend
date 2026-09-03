import type { QueryClient } from "@tanstack/react-query";

export const billingConnectorQueryKey = (accountId: number) =>
    ["billing-connector", accountId] as const;

export const billingConnectorSyncRunsQueryKey = (accountId: number) =>
    ["billing-connector-sync-runs", accountId] as const;

export const billingConnectorSyncHistoryQueryKey = (accountId: number) =>
    ["billing-connector-sync-history", accountId] as const;

export type InvalidateBillingConnectorOptions = {
    /** Default true */
    config?: boolean;
    /** Default true */
    syncRuns?: boolean;
    /** Default false — history is durable and only needs refresh on run transitions */
    history?: boolean;
};

/** Invalidate billing-connector React Query caches for an account. */
export function invalidateBillingConnectorQueries(
    queryClient: QueryClient,
    accountId: number,
    options?: InvalidateBillingConnectorOptions
): Promise<void> {
    const invalidateConfig = options?.config !== false;
    const invalidateSyncRuns = options?.syncRuns !== false;
    const invalidateHistory = options?.history === true;
    const tasks: Array<Promise<unknown>> = [];
    if (invalidateConfig) {
        tasks.push(
            queryClient.invalidateQueries({
                queryKey: billingConnectorQueryKey(accountId),
            })
        );
    }
    if (invalidateSyncRuns) {
        tasks.push(
            queryClient.invalidateQueries({
                queryKey: billingConnectorSyncRunsQueryKey(accountId),
            })
        );
    }
    if (invalidateHistory) {
        tasks.push(
            queryClient.invalidateQueries({
                queryKey: billingConnectorSyncHistoryQueryKey(accountId),
            })
        );
    }
    return Promise.all(tasks).then(() => undefined);
}

/** Poll interval while a sync / backfill / deferred AR drain is in flight. */
export const BILLING_CONNECTOR_BUSY_POLL_MS = 2500;
