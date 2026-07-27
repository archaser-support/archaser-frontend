import { takeCustomerPolicyTrendSnapshots } from "@/server/services/creditInsurance/customerPolicyTrendService";

export default async function takeCustomerPolicyTrendSnapshotsJob(
    _customerId?: number,
    logCallback?: (
        message: string,
        level: "INFO" | "ERROR" | "WARNING" | "DEBUG",
        parameters?: unknown
    ) => void,
    stepCollector?: {
        addStep: (
            step: string,
            message: string,
            level?: "INFO" | "ERROR" | "WARNING" | "DEBUG",
            parameters?: unknown,
            results?: unknown,
            duration?: number
        ) => void;
    }
): Promise<{
    success: boolean;
    message: string;
    summary?: unknown;
    duration: number;
}> {
    const start = Date.now();
    try {
        stepCollector?.addStep(
            "POLICY_TREND_START",
            "Starting customer policy trend daily snapshots",
            "INFO"
        );
        const result = await takeCustomerPolicyTrendSnapshots();
        const duration = Date.now() - start;
        const message = `Customer policy trend snapshots: ${result.rowsUpserted} rows across ${result.accountsProcessed} accounts`;
        stepCollector?.addStep("POLICY_TREND_DONE", message, "INFO", result);
        logCallback?.(message, "INFO", result);
        for (const warning of result.gapFillWarnings) {
            const warningMessage = `Customer policy trend gap-fill capped for account ${warning.accountId}: ${warning.gapDays} missing days, filled ${warning.gapFillDaysApplied}`;
            stepCollector?.addStep(
                "POLICY_TREND_GAP_FILL_WARNING",
                warningMessage,
                "WARNING",
                warning
            );
            logCallback?.(warningMessage, "WARNING", warning);
        }
        return {
            success: true,
            message,
            summary: result,
            duration,
        };
    } catch (error: unknown) {
        const duration = Date.now() - start;
        const message =
            error instanceof Error
                ? error.message
                : "Customer policy trend snapshot cron failed";
        stepCollector?.addStep("POLICY_TREND_ERROR", message, "ERROR", {
            stack: error instanceof Error ? error.stack : undefined,
        });
        logCallback?.(message, "ERROR");
        if (error instanceof Error) {
            throw error;
        }
        throw new Error(message);
    }
}
