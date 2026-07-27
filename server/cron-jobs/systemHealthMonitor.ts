import { LogLevel } from "@/types/enums";

import { LogService } from "../services/LogService";
import { SystemMonitoringService } from "../services/SystemMonitoringService";

export async function systemHealthMonitor(
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

    // Check if monitoring is enabled
    const monitoringEnabled =
        process.env.SYSTEM_MONITORING_ENABLED?.toLowerCase() !== "false";

    if (!monitoringEnabled) {
        const message =
            "System health monitoring is disabled via SYSTEM_MONITORING_ENABLED";

        if (stepCollector) {
            stepCollector.addStep("SKIPPED", message, "INFO", {
                processName: "systemHealthMonitor",
                startTime: startTime.toISOString(),
                jobId,
                reason: "SYSTEM_MONITORING_ENABLED=false",
            });
        }

        await logService.logMessage(
            LogLevel.INFO,
            message,
            "SystemHealthMonitor",
            { jobId }
        );

        if (logCallback) {
            logCallback(message, "INFO", {
                processName: "systemHealthMonitor",
                startTime: startTime.toISOString(),
                jobId,
            });
        }

        return;
    }

    const monitoringService = new SystemMonitoringService();

    try {
        // Add start step to step collector
        if (stepCollector) {
            stepCollector.addStep(
                "START",
                "Starting system health monitoring checks",
                "INFO",
                {
                    processName: "systemHealthMonitor",
                    startTime: startTime.toISOString(),
                    jobId,
                }
            );
        }

        await logService.logMessage(
            LogLevel.INFO,
            "Starting system health monitoring checks",
            "SystemHealthMonitor",
            { jobId }
        );

        if (logCallback) {
            logCallback("Starting system health monitoring checks", "INFO", {
                processName: "systemHealthMonitor",
                startTime: startTime.toISOString(),
                jobId,
            });
        }

        // Run all monitoring checks with detailed logging
        const checkStartTime = Date.now();
        await monitoringService.runAllChecks(stepCollector);
        const checkDuration = Date.now() - checkStartTime;

        // Add completion step to step collector
        if (stepCollector) {
            stepCollector.addStep(
                "COMPLETE",
                "System health monitoring checks completed successfully",
                "INFO",
                {
                    totalDuration: checkDuration,
                    startTime: startTime.toISOString(),
                    endTime: new Date().toISOString(),
                },
                undefined,
                checkDuration
            );
        }

        await logService.logMessage(
            LogLevel.INFO,
            "System health monitoring checks completed",
            "SystemHealthMonitor",
            {
                jobId,
                duration: checkDuration,
            }
        );

        if (logCallback) {
            logCallback("System health monitoring checks completed", "INFO", {
                duration: checkDuration,
            });
        }
    } catch (error: any) {
        const errorDuration = Date.now() - startTime.getTime();

        // Add error step to step collector
        if (stepCollector) {
            stepCollector.addStep(
                "ERROR",
                `System health monitoring failed: ${error.message}`,
                "ERROR",
                {
                    error: error.message,
                    stack: error.stack,
                    duration: errorDuration,
                    startTime: startTime.toISOString(),
                }
            );
        }

        await logService.logMessage(
            LogLevel.ERROR,
            `System health monitoring failed: ${error.message}`,
            "SystemHealthMonitor",
            {
                jobId,
                error: error.message,
                stack: error.stack,
                duration: errorDuration,
            }
        );

        if (logCallback) {
            logCallback(
                `System health monitoring failed: ${error.message}`,
                "ERROR",
                {
                    error: error.message,
                    stack: error.stack,
                    duration: errorDuration,
                }
            );
        }

        throw error;
    }
}
