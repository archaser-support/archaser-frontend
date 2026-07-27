import { takeCreditDashboardDailySnapshots } from "@/server/services/creditInsurance/creditDashboardSnapshotService";

export default async function takeCreditDashboardDailySnapshotsJob(
    _customerId?: number,
    logCallback?: (
        message: string,
        level: "INFO" | "ERROR" | "WARNING" | "DEBUG",
        parameters?: any
    ) => void,
    stepCollector?: {
        addStep: (
            step: string,
            message: string,
            level?: "INFO" | "ERROR" | "WARNING" | "DEBUG",
            parameters?: any,
            results?: any,
            duration?: number
        ) => void;
    }
): Promise<{
    success: boolean;
    message: string;
    summary?: any;
    duration: number;
}> {
    const start = Date.now();
    try {
        stepCollector?.addStep(
            "SNAPSHOT_START",
            "Starting credit dashboard daily snapshots",
            "INFO"
        );
        const result = await takeCreditDashboardDailySnapshots();
        const duration = Date.now() - start;
        const message = `Credit dashboard daily snapshots completed: ${result.scopesProcessed} scopes`;
        stepCollector?.addStep(
            "SNAPSHOT_DONE",
            message,
            "INFO",
            { scopesProcessed: result.scopesProcessed }
        );
        logCallback?.(message, "INFO", { scopesProcessed: result.scopesProcessed });
        return {
            success: true,
            message,
            summary: result,
            duration,
        };
    } catch (error: any) {
        const duration = Date.now() - start;
        const message =
            error?.message || "Credit dashboard daily snapshot cron failed";
        stepCollector?.addStep(
            "SNAPSHOT_ERROR",
            message,
            "ERROR",
            { stack: error?.stack }
        );
        logCallback?.(message, "ERROR", { stack: error?.stack });
        if (error instanceof Error) {
            throw error;
        }
        throw new Error(message);
    }
}
