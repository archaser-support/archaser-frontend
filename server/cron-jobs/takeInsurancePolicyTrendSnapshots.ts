import { takeInsurancePolicyTrendSnapshots } from "@/server/services/creditInsurance/insurancePolicyTrendService";

export default async function takeInsurancePolicyTrendSnapshotsJob(
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
            "INSURANCE_POLICY_TREND_START",
            "Starting insurance policy trend daily snapshots",
            "INFO"
        );
        const result = await takeInsurancePolicyTrendSnapshots();
        const duration = Date.now() - start;
        const message = `Insurance policy trend snapshots: ${result.policyRowsUpserted} policies, ${result.countryRowsUpserted} countries, ${result.namedRowsUpserted} named rows across ${result.accountsProcessed} accounts`;
        stepCollector?.addStep("INSURANCE_POLICY_TREND_DONE", message, "INFO", result);
        logCallback?.(message, "INFO", result);
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
                : "Insurance policy trend snapshot cron failed";
        stepCollector?.addStep("INSURANCE_POLICY_TREND_ERROR", message, "ERROR", {
            stack: error instanceof Error ? error.stack : undefined,
        });
        logCallback?.(message, "ERROR");
        if (error instanceof Error) {
            throw error;
        }
        throw new Error(message);
    }
}
