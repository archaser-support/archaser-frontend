import { ensureMongoConnection } from "@/lib/mongoose";
import CronJobExecution from "@/models/CronJobExecution";

/**
 * Clean up old cron job execution records from MongoDB
 * - Keep detailed records for last 90 days (handled by TTL index)
 * - Delete records older than 1 year (manual cleanup)
 * - Run weekly via cron job
 */
export async function cleanupExecutionHistory(
    logCallback?: (
        message: string,
        level: "INFO" | "ERROR" | "WARNING" | "DEBUG",
        parameters?: any,
        results?: any
    ) => void
) {
    try {
        // Ensure MongoDB connection
        await ensureMongoConnection();

        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        // Delete records older than 1 year using the model's static method
        const deleteResult = await CronJobExecution.cleanupOldExecutions(365);

        if (logCallback) {
            logCallback(
                `Cleaned up ${deleteResult.deletedCount || 0} execution records older than 1 year`,
                "INFO",
                {
                    deletedCount: deleteResult.deletedCount || 0,
                    cutoffDate: oneYearAgo.toISOString(),
                }
            );
        }

        return {
            success: true,
            deletedCount: deleteResult.deletedCount || 0,
        };
    } catch (error) {
        const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

        if (logCallback) {
            logCallback(
                `Failed to cleanup execution history: ${errorMessage}`,
                "ERROR",
                {
                    error: errorMessage,
                    stack: error instanceof Error ? error.stack : undefined,
                }
            );
        }

        throw error;
    }
}
