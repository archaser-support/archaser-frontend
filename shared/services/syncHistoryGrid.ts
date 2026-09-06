import type { SyncRunSummary } from "@/shared/services/billingConnectorService";
import { MATURITY_ENTITY_STATS_KEY } from "@/shared/services/backfillImportProgress";

export type SyncHistoryEntityColumnKey =
    | "Customer"
    | "Contact"
    | "Invoice"
    | "Payment"
    | typeof MATURITY_ENTITY_STATS_KEY;

/** Format entity_stats slice as `pulled / success / failed`, or `—` when missing. */
export function formatEntityStatsCell(
    entityStats: SyncRunSummary["entity_stats"] | undefined,
    key: SyncHistoryEntityColumnKey
): string {
    const slice = entityStats?.[key];
    if (!slice) {
        return "—";
    }
    const base = `${slice.pulled} / ${slice.success} / ${slice.failed}`;
    if (slice.deleted != null) {
        return `${base} · ${slice.deleted} deleted`;
    }
    return base;
}

export function formatSyncHistoryDuration(
    durationSeconds: number | null | undefined
): string {
    if (durationSeconds == null) {
        return "—";
    }
    return `${durationSeconds}s`;
}

export type SyncHistoryGridRow = {
    id: string;
    started: string;
    status: string;
    mode: string;
    trigger: string;
    duration: string;
    error: string;
    customer: string;
    contact: string;
    invoice: string;
    payment: string;
    linkPayments: string;
    customerSampleErrors: string[];
    contactSampleErrors: string[];
    invoiceSampleErrors: string[];
    paymentSampleErrors: string[];
    linkPaymentsSampleErrors: string[];
};

function sampleErrorsForEntity(
    entityStats: SyncRunSummary["entity_stats"] | undefined,
    key: SyncHistoryEntityColumnKey
): string[] {
    return entityStats?.[key]?.sample_errors ?? [];
}

export function toSyncHistoryGridRow(run: SyncRunSummary): SyncHistoryGridRow {
    const stats = run.entity_stats;
    return {
        id: run.id,
        started: new Date(run.started_at).toLocaleString(),
        status: run.status,
        mode: run.sync_mode,
        trigger: run.trigger,
        duration: formatSyncHistoryDuration(run.duration_seconds),
        error: run.error_message?.trim() ? run.error_message : "—",
        customer: formatEntityStatsCell(stats, "Customer"),
        contact: formatEntityStatsCell(stats, "Contact"),
        invoice: formatEntityStatsCell(stats, "Invoice"),
        payment: formatEntityStatsCell(stats, "Payment"),
        linkPayments: formatEntityStatsCell(stats, MATURITY_ENTITY_STATS_KEY),
        customerSampleErrors: sampleErrorsForEntity(stats, "Customer"),
        contactSampleErrors: sampleErrorsForEntity(stats, "Contact"),
        invoiceSampleErrors: sampleErrorsForEntity(stats, "Invoice"),
        paymentSampleErrors: sampleErrorsForEntity(stats, "Payment"),
        linkPaymentsSampleErrors: sampleErrorsForEntity(
            stats,
            MATURITY_ENTITY_STATS_KEY
        ),
    };
}
