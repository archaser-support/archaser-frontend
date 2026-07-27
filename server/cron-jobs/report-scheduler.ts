import { LogLevel } from "@/types/enums";

import { LogService } from "../services/LogService";
import { ReportScheduleService } from "../services/ReportScheduleService";

/**
 * Cron job to execute scheduled reports
 * This should be called periodically (e.g., every hour) to check for due reports
 */
export async function executeScheduledReports(
    jobId?: number,
    logCallback?: (
        message: string,
        level: "INFO" | "ERROR" | "WARNING" | "DEBUG",
        parameters?: any,
        results?: any
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
): Promise<void> {
    const startTime = new Date();
    const logService = LogService.getInstance();
    const scheduleService = ReportScheduleService.getInstance();

    try {
        // Add start step to step collector
        if (stepCollector) {
            stepCollector.addStep(
                "START",
                "Starting scheduled reports execution",
                LogLevel.INFO,
                { jobId, startTime: startTime.toISOString() }
            );
        }

        // Log start
        await logService.logMessage(
            LogLevel.INFO,
            "Starting scheduled reports execution",
            "ReportScheduler",
            { jobId },
            undefined,
            undefined,
            jobId
        );

        if (logCallback) {
            logCallback("Starting scheduled reports execution", "INFO", {
                jobId,
                startTime: startTime.toISOString(),
            });
        }

        // Execute scheduled reports
        const executeStart = Date.now();
        await scheduleService.executeScheduledReports();
        const executeDuration = Date.now() - executeStart;

        // Add completion step
        if (stepCollector) {
            stepCollector.addStep(
                "COMPLETE",
                "Scheduled reports execution completed",
                LogLevel.INFO,
                undefined,
                { duration: executeDuration }
            );
        }

        // Log completion
        await logService.logMessage(
            LogLevel.INFO,
            "Completed scheduled reports execution",
            "ReportScheduler",
            { jobId, duration: executeDuration },
            undefined,
            undefined,
            jobId
        );

        if (logCallback) {
            logCallback("Completed scheduled reports execution", "INFO", {
                jobId,
                duration: executeDuration,
            });
        }
    } catch (error) {
        const errorMessage =
            error instanceof Error ? error.message : String(error);

        // Add error step
        if (stepCollector) {
            stepCollector.addStep(
                "ERROR",
                `Failed to execute scheduled reports: ${errorMessage}`,
                LogLevel.ERROR,
                { error: errorMessage, jobId }
            );
        }

        // Log error
        await logService.logMessage(
            LogLevel.ERROR,
            `Failed to execute scheduled reports: ${errorMessage}`,
            "ReportScheduler",
            { jobId, error: errorMessage },
            undefined,
            undefined,
            jobId
        );

        if (logCallback) {
            logCallback(
                `Failed to execute scheduled reports: ${errorMessage}`,
                "ERROR",
                { jobId, error: errorMessage }
            );
        }

        throw error;
    }
}
