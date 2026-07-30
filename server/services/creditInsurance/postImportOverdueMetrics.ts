/**
 * Runs overdue/reporting metrics after import completes so Customer + Invoice breach
 * fields stay consistent when rows arrive out of order.
 *
 * When customerIds are provided, only those customers are synced (fast path for imports).
 * Otherwise runs the full account-wide sweep (cron-style).
 *
 * `skipReportingBreachPromotion` is accepted for connector backfill parity; full
 * mute wiring lands with dated-backfill. Until then the option is ignored.
 */
export async function triggerPostImportOverdueMetrics(
    customerIds?: number[],
    options?: { skipReportingBreachPromotion?: boolean }
): Promise<void> {
    void options;
    try {
        const { default: computeCustomerOverdueMetrics } = await import(
            "@/server/cron-jobs/computeCustomerOverdueMetrics"
        );
        const uniqueIds = customerIds?.length
            ? Array.from(new Set(customerIds))
            : undefined;

        if (uniqueIds?.length) {
            const { syncCreditInsuranceGapPipelineForCustomer } = await import(
                "@/server/services/creditInsurance/syncCreditInsuranceGapPipeline"
            );
            for (const customerId of uniqueIds) {
                await computeCustomerOverdueMetrics(
                    customerId,
                    undefined,
                    undefined
                );
                await syncCreditInsuranceGapPipelineForCustomer(customerId);
            }
            return;
        }

        await computeCustomerOverdueMetrics(undefined, undefined, undefined);
    } catch (e) {
        console.error(
            "[postImportOverdueMetrics] computeCustomerOverdueMetrics failed",
            e
        );
    }
}
