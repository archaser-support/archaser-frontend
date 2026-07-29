import { takeCustomerPolicyTrendSnapshots } from "@/server/services/creditInsurance/customerPolicyTrendService";
import { drainAsOfRewriteQueue } from "@/server/services/creditInsurance/asOfRewriteQueue";

type LogLevel = "INFO" | "ERROR" | "WARNING" | "DEBUG";

type StepCollector = {
    addStep: (
        step: string,
        message: string,
        level?: LogLevel,
        parameters?: unknown,
        results?: unknown,
        duration?: number
    ) => void;
};

function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

function errorStack(error: unknown): string | undefined {
    return error instanceof Error ? error.stack : undefined;
}

function toError(error: unknown, fallback: string): Error {
    return error instanceof Error ? error : new Error(fallback);
}

/**
 * Customer Policy Trend Daily Snapshot cron host.
 *
 * Always attempts as-of rewrite drain after the today-snapshot step (even when
 * today throws). Drain hard failures (throw or unclean completion) fail the
 * overall job; admin-backfill skips alone do not.
 */
export default async function takeCustomerPolicyTrendSnapshotsJob(
    _customerId?: number,
    logCallback?: (
        message: string,
        level: LogLevel,
        parameters?: unknown
    ) => void,
    stepCollector?: StepCollector
): Promise<{
    success: boolean;
    message: string;
    summary?: unknown;
    duration: number;
}> {
    const start = Date.now();
    stepCollector?.addStep(
        "POLICY_TREND_START",
        "Starting customer policy trend daily snapshots",
        "INFO"
    );

    let todayResult:
        | Awaited<ReturnType<typeof takeCustomerPolicyTrendSnapshots>>
        | undefined;
    let todayError: Error | undefined;
    let todayMessage = "Customer policy trend snapshots: skipped due to error";

    try {
        todayResult = await takeCustomerPolicyTrendSnapshots();
        todayMessage = `Customer policy trend snapshots: ${todayResult.rowsUpserted} rows across ${todayResult.accountsProcessed} accounts`;
        stepCollector?.addStep("POLICY_TREND_DONE", todayMessage, "INFO", todayResult);
        logCallback?.(todayMessage, "INFO", todayResult);
    } catch (error: unknown) {
        todayError = toError(error, "Customer policy trend snapshot cron failed");
        const message = errorMessage(
            error,
            "Customer policy trend snapshot cron failed"
        );
        stepCollector?.addStep("POLICY_TREND_ERROR", message, "ERROR", {
            stack: errorStack(error),
        });
        logCallback?.(message, "ERROR");
    }

    let drainError: Error | undefined;

    try {
        const drain = await drainAsOfRewriteQueue();
        const drainMessage = `As-of rewrite drain: ${drain.itemsProcessed} items, ${drain.daysRewritten} days, ${drain.failures} failures, ${drain.skippedForBackfill} skipped for admin backfill`;
        const drainLevel: LogLevel = drain.failures > 0 ? "ERROR" : "INFO";
        stepCollector?.addStep(
            "AS_OF_REWRITE_DRAIN_DONE",
            drainMessage,
            drainLevel,
            drain
        );
        logCallback?.(drainMessage, drainLevel, drain);
        if (drain.failures > 0) {
            drainError = new Error(drainMessage);
        }
    } catch (error: unknown) {
        const drainMessage = errorMessage(error, "As-of rewrite drain failed");
        stepCollector?.addStep("AS_OF_REWRITE_DRAIN_ERROR", drainMessage, "ERROR", {
            stack: errorStack(error),
        });
        logCallback?.(drainMessage, "ERROR");
        drainError = toError(error, "As-of rewrite drain failed");
    }

    if (todayResult) {
        for (const warning of todayResult.gapFillWarnings) {
            const warningMessage = `Customer policy trend gap-fill capped for account ${warning.accountId}: ${warning.gapDays} missing days, filled ${warning.gapFillDaysApplied}`;
            stepCollector?.addStep(
                "POLICY_TREND_GAP_FILL_WARNING",
                warningMessage,
                "WARNING",
                warning
            );
            logCallback?.(warningMessage, "WARNING", warning);
        }
    }

    const duration = Date.now() - start;

    // Prefer today's error as the thrown cause when both fail; both already
    // appear as ERROR steps / logs above.
    if (todayError) {
        throw todayError;
    }
    if (drainError) {
        throw drainError;
    }

    return {
        success: true,
        message: todayMessage,
        summary: todayResult,
        duration,
    };
}
