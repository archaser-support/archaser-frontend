import { triggerPostImportOverdueMetrics } from "@/server/services/creditInsurance/postImportOverdueMetrics";
import {
    applyMaturedDeferredPayments,
    replayArImportForCustomers,
    type MaturityResult,
    type ReplayBatchSummary,
} from "@/server/services/import/importArReplayService";

export type ArPostIngestOptions = {
    accountId: number;
    customerIds: number[];
    /** When true, apply deferred payments whose payment_date is eligible. */
    runMaturity?: boolean;
    /** When true, refresh live overdue/MEP + capacity gap for the customers. */
    runLiveRefresh?: boolean;
    liveRefreshOptions?: { skipReportingBreachPromotion?: boolean };
    /** Maturity as-of instant; defaults to start of today UTC. */
    maturityAsOf?: Date;
};

export type ArPostIngestResult = {
    replayStats: ReplayBatchSummary | null;
    maturityResult: MaturityResult | null;
};

function uniqueFiniteIds(customerIds: number[]): number[] {
    return Array.from(
        new Set(
            customerIds.filter((id) => typeof id === "number" && Number.isFinite(id))
        )
    );
}

function startOfTodayUtc(reference: Date = new Date()): Date {
    const asOf = new Date(reference);
    asOf.setUTCHours(0, 0, 0, 0);
    return asOf;
}

/**
 * Shared AR post-ingest orchestration for affected customers:
 * chronological replay → optional maturity → optional live overdue/MEP/capacity refresh.
 *
 * Used by invoice/payment import job complete, backdated UI payment create, and
 * billing-connector post-ingest paths so those callers cannot drift.
 */
export async function runArPostIngestForCustomers(
    options: ArPostIngestOptions
): Promise<ArPostIngestResult> {
    const customerIds = uniqueFiniteIds(options.customerIds);
    let replayStats: ReplayBatchSummary | null = null;
    let maturityResult: MaturityResult | null = null;

    if (customerIds.length > 0) {
        replayStats = await replayArImportForCustomers(
            customerIds,
            options.accountId
        );
    }

    if (options.runMaturity) {
        maturityResult = await applyMaturedDeferredPayments(
            options.accountId,
            options.maturityAsOf ?? startOfTodayUtc()
        );
    }

    if (options.runLiveRefresh && customerIds.length > 0) {
        await triggerPostImportOverdueMetrics(
            customerIds,
            options.liveRefreshOptions
        );
    }

    return { replayStats, maturityResult };
}
