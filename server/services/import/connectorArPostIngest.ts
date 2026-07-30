import type { EntitySyncStats } from "@/models/ConnectorSyncExecution";
import {
    runArPostIngestForCustomers,
    type ArPostIngestResult,
} from "@/server/services/import/arPostIngestForCustomers";

export type ConnectorArPostIngestParams = {
    accountId: number;
    customerIds: number[];
    skipReportingBreachPromotion: boolean;
    entityStats: Record<string, EntitySyncStats>;
};

/**
 * Connector AR post-ingest: chronological replay + maturity + live refresh,
 * writing `_replay` / `_maturity` into connector entity stats.
 *
 * Used after Invoice ingest and for the payment-only fallback when Invoice
 * post-ingest did not run in the same sync.
 */
export async function applyConnectorArPostIngest(
    params: ConnectorArPostIngestParams
): Promise<ArPostIngestResult> {
    const postIngest = await runArPostIngestForCustomers({
        accountId: params.accountId,
        customerIds: params.customerIds,
        runMaturity: true,
        runLiveRefresh: true,
        liveRefreshOptions: {
            skipReportingBreachPromotion: params.skipReportingBreachPromotion,
        },
    });

    if (postIngest.replayStats) {
        params.entityStats["_replay"] = {
            pulled: postIngest.replayStats.eventsApplied,
            success: postIngest.replayStats.paymentsLinked,
            failed: 0,
            skipped: postIngest.replayStats.deferredRemaining,
        };
    }

    if (postIngest.maturityResult) {
        params.entityStats["_maturity"] = {
            pulled:
                postIngest.maturityResult.matured +
                postIngest.maturityResult.deferredRemaining,
            success: postIngest.maturityResult.matured,
            failed: 0,
            skipped: postIngest.maturityResult.deferredRemaining,
        };
    }

    return postIngest;
}

/**
 * Payment-only fallback runs when Invoice post-ingest did not run in this sync
 * and Payment ingest touched AR customers.
 */
export function shouldRunConnectorPaymentOnlyArFallback(params: {
    invoiceArPostIngestRan: boolean;
    paymentAffectedCustomerIds: number[];
}): boolean {
    return (
        !params.invoiceArPostIngestRan &&
        params.paymentAffectedCustomerIds.length > 0
    );
}
