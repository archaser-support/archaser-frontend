/*
    This cron job is used to clean old log records.
    Algorithm:
    1. Calculate the cutoff date (5 days for regular logs, 15 days for ImportJob logs)
    2. Delete regular logs older than 5 days
    3. Delete ImportJob logs older than 15 days
    4. Log the cleanup process and results
*/
import { LogLevel } from "@/types/enums";

import { LogService } from "../services/LogService";
import { mongoLogService } from "../services/MongoLogService";

const RETENTION_DAYS = 5;
const IMPORT_JOB_RETENTION_DAYS = 15;

export const cleanLogs = async (
    customerId?: number,
    logCallback?: (message: string, level: 'INFO' | 'ERROR' | 'WARNING' | 'DEBUG', parameters?: any, results?: any) => void,
    stepCollector?: {
        addStep: (step: string, message: string, level?: 'INFO' | 'ERROR' | 'WARNING' | 'DEBUG', parameters?: any, results?: any, duration?: number) => void;
    }
) => {
    const startTime = new Date();
    const logService = LogService.getInstance();

    // Create a job-specific logging wrapper that routes to step collector
    const jobLogger = {
        logMessage: async (level: string, message: string, source: string, details?: any, accountId?: number, userId?: number, jobId?: number, correlationId?: string): Promise<void> => {
            if (stepCollector) {
                // Extract step information from details if available
                const step = details?.step || "PROCESS";
                const stepNumber = details?.stepNumber || 1;
                const parameters = details ? { ...details } : undefined;

                // Add to step collector ONLY - do not create individual log records
                stepCollector.addStep(step, message, level as 'INFO' | 'ERROR' | 'WARNING' | 'DEBUG', parameters);
            } else {
                // Fallback to original logService if no step collector
                return jobLogger.logMessage(level, message, source, details, accountId, userId, jobId, correlationId);
            }
        }
    };

    // Initialize process tracking
    const processStats = {
        regularLogsCutoffDate: new Date(),
        importJobLogsCutoffDate: new Date(),
        retentionDays: RETENTION_DAYS,
        importJobRetentionDays: IMPORT_JOB_RETENTION_DAYS,
        regularLogsDeleted: 0,
        importJobLogsDeleted: 0,
        totalRecordsDeleted: 0,
        errors: [] as string[],
    };

    try {
        // Add process start message to step collector
        if (stepCollector) {
            stepCollector.addStep("START", "Starting cleanLogs process", "INFO", {
                processName: "cleanLogs",
                startTime: startTime.toISOString(),
            });
        }
        // Call logCallback if provided (for real-time frontend logging)
        if (logCallback) {
            logCallback(
                "Starting cleanLogs process",
                'INFO',
                {
                    processName: "cleanLogs",
                    startTime: startTime.toISOString(),
                    customerId: customerId || 'ALL',
                    retentionDays: RETENTION_DAYS,
                    step: "START",
                    stepNumber: 1,
                }
            );
        }

        // Step 1: Calculate cutoff dates
        const calculateCutoffStart = Date.now();
        const regularLogsCutoffDate = new Date();
        regularLogsCutoffDate.setDate(regularLogsCutoffDate.getDate() - RETENTION_DAYS);
        const importJobLogsCutoffDate = new Date();
        importJobLogsCutoffDate.setDate(importJobLogsCutoffDate.getDate() - IMPORT_JOB_RETENTION_DAYS);
        const calculateCutoffDuration = Date.now() - calculateCutoffStart;
        processStats.regularLogsCutoffDate = regularLogsCutoffDate;
        processStats.importJobLogsCutoffDate = importJobLogsCutoffDate;

        // Step 2: Delete logs with selective retention using Mongoose
        const deleteLogsStart = Date.now();
        const deleteResult = await mongoLogService.cleanupOldLogsSelective(
            RETENTION_DAYS,
            IMPORT_JOB_RETENTION_DAYS
        );
        const deleteLogsDuration = Date.now() - deleteLogsStart;
        processStats.regularLogsDeleted = deleteResult.regularLogsDeleted || 0;
        processStats.importJobLogsDeleted = deleteResult.importJobLogsDeleted || 0;
        processStats.totalRecordsDeleted = processStats.regularLogsDeleted + processStats.importJobLogsDeleted;
        const totalDuration = Date.now() - startTime.getTime();

        // Add process completion message to step collector
        if (stepCollector) {
            stepCollector.addStep("COMPLETE", `cleanLogs process completed successfully - deleted ${processStats.totalRecordsDeleted} records (${processStats.regularLogsDeleted} regular, ${processStats.importJobLogsDeleted} ImportJob)`, "INFO", {
                totalDuration,
                finalStats: processStats,
            });
        }
        if (logCallback) {
            logCallback(
                `cleanLogs process completed successfully - deleted ${processStats.totalRecordsDeleted} records (${processStats.regularLogsDeleted} regular, ${processStats.importJobLogsDeleted} ImportJob)`,
                'INFO',
                {
                    processName: "cleanLogs",
                    startTime: startTime.toISOString(),
                    customerId: customerId || 'ALL',
                    step: "COMPLETE",
                    stepNumber: 3,
                    duration: totalDuration,
                    processStats: {
                        totalRecordsDeleted: processStats.totalRecordsDeleted,
                        regularLogsDeleted: processStats.regularLogsDeleted,
                        importJobLogsDeleted: processStats.importJobLogsDeleted,
                        retentionDays: RETENTION_DAYS,
                        importJobRetentionDays: IMPORT_JOB_RETENTION_DAYS,
                        regularLogsCutoffDate: regularLogsCutoffDate.toISOString(),
                        importJobLogsCutoffDate: importJobLogsCutoffDate.toISOString(),
                        errors: processStats.errors.length
                    },
                    performanceMetrics: {
                        calculateCutoff: calculateCutoffDuration,
                        deleteLogs: deleteLogsDuration,
                        totalExecution: totalDuration,
                    }
                }
            );
        }

        return {
            deletedCount: processStats.totalRecordsDeleted,
            regularLogsDeleted: processStats.regularLogsDeleted,
            importJobLogsDeleted: processStats.importJobLogsDeleted,
            regularLogsCutoffDate: regularLogsCutoffDate.toISOString(),
            importJobLogsCutoffDate: importJobLogsCutoffDate.toISOString(),
            retentionDays: RETENTION_DAYS,
            importJobRetentionDays: IMPORT_JOB_RETENTION_DAYS,
        };
    } catch (err) {
        const error = err as Error;
        const totalDuration = Date.now() - startTime.getTime();

        // Add error to step collector if available
        if (stepCollector) {
            stepCollector.addStep("ERROR", `cleanLogs process failed: ${error.message}`, "ERROR", {
                error: error.message,
                stack: error.stack,
                finalStats: processStats,
                duration: totalDuration,
            });
        }

        throw error;
    }
};
