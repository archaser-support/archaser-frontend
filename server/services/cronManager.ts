/**
 * Cron Manager Service
 *
 * This service manages the execution of cron jobs with comprehensive logging,
 * error handling, and email notifications for exceptions.
 *
 * Features:
 * - Automatic job scheduling and execution (one job at a time)
 * - Detailed logging with correlation IDs
 * - Email notifications for job failures
 * - Rate limiting for notifications (configurable cooldown)
 * - Performance metrics tracking
 * - Warning notifications for long-running jobs (>30 minutes)
 * - Timeout detection and job termination
 *
 * Environment Variables:
 * - CRON_EXCEPTION_EMAIL: Email address for exception notifications
 * - CRON_NOTIFICATION_COOLDOWN_MINUTES: Cooldown period for notifications in minutes (default: 30)
 * - CRON_WARNING_THRESHOLD_MINUTES: Threshold for long-running job warnings in minutes (default: 30)
 * - ENABLE_CRON_JOBS: Set to "true" to enable cron job execution
 * - LOG_CONNECTION_POOL_STATUS: Set to "true" to log connection pool status
 */

import { CronJob } from "@prisma/client";
import { parseExpression } from "cron-parser";

import { cronJobExecutions } from "../../lib/metrics";
import { prismaCron } from "../../lib/prisma";
import { LogLevel } from "../../types/enums";
import { EmailService } from "../EmailService";

import { CronJobExecutionService } from "./CronJobExecutionService";
import { InforuStatusChecker } from "./InforuStatusChecker";
import { LogService } from "./LogService";

// Configuration for cron job notifications
const CRON_NOTIFICATIONS_ENABLED = false; // Set to false to disable all cron job notifications
const CRON_EXCEPTION_EMAIL: string[] = []; // Disabled - no emails will be sent
const NOTIFICATION_COOLDOWN_MINUTES = parseInt(
    process.env.CRON_NOTIFICATION_COOLDOWN_MINUTES || "30",
    10
);
const WARNING_THRESHOLD_MINUTES = parseInt(
    process.env.CRON_WARNING_THRESHOLD_MINUTES || "30",
    10
);

// Simple in-memory cache for notification cooldown (in production, consider using Redis)
const notificationCooldownCache = new Map<string, number>();
const warningNotificationCooldownCache = new Map<string, number>();

// Generate a unique correlation ID for cron job execution
const generateCorrelationId = () => {
    return `cron_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
};

// Enhanced logging interface for cron jobs
interface CronJobLogData {
    jobId?: number; // Make jobId optional since it can be undefined in error cases
    jobName: string;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    status: "STARTED" | "COMPLETED" | "FAILED" | "SKIPPED";
    recordsProcessed?: number;
    recordsCreated?: number;
    recordsUpdated?: number;
    recordsDeleted?: number;
    error?: string;
    performanceMetrics?: Record<string, number>;
    additionalData?: Record<string, any>;
}

/**
 * Unified consolidated logging function for all cron jobs
 * Used by both manual triggers and scheduled jobs
 * Currently a no-op for compatibility (logging handled by StepCollector)
 */
export const logCronJobConsolidated = async (
    _logData: CronJobLogData & {
        steps?: Array<{
            step: string;
            stepNumber: number;
            message: string;
            level: "INFO" | "ERROR" | "WARNING" | "DEBUG";
            timestamp: Date;
            duration?: number;
            parameters?: any;
            results?: any;
        }>;
    }
) => {
    // Logging is handled by StepCollector for real-time visibility
};

// Function to send cron job exception notifications
export const sendCronExceptionNotification = async (jobData: {
    jobId?: number;
    jobName: string;
    error: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    stack?: string;
    correlationId?: string;
}) => {
    if (!CRON_NOTIFICATIONS_ENABLED) {
        return; // Notifications disabled
    }
    try {
        // Check if we should skip notification due to cooldown
        const jobKey = `${jobData.jobName}_${jobData.jobId || "unknown"}`;
        const now = Date.now();
        const lastNotification = notificationCooldownCache.get(jobKey);
        const cooldownMs = NOTIFICATION_COOLDOWN_MINUTES * 60 * 1000;

        if (lastNotification && now - lastNotification < cooldownMs) {
            return; // Notification skipped due to cooldown
        }

        // Update the cooldown cache
        notificationCooldownCache.set(jobKey, now);

        const emailService = new EmailService();

        const subject = `[CRON EXCEPTION] ${jobData.jobName} - Job Failed`;

        const body = `
			<h2>Cron Job Exception Alert</h2>
			<p><strong>Job Name:</strong> ${jobData.jobName}</p>
			<p><strong>Job ID:</strong> ${jobData.jobId || "N/A"}</p>
			<p><strong>Correlation ID:</strong> ${jobData.correlationId || "N/A"}</p>
			<p><strong>Start Time:</strong> ${jobData.startTime.toISOString()}</p>
			<p><strong>End Time:</strong> ${jobData.endTime.toISOString()}</p>
			<p><strong>Duration:</strong> ${jobData.duration}ms</p>
			<p><strong>Error:</strong> ${jobData.error}</p>
			${jobData.stack ? `<p><strong>Stack Trace:</strong></p><pre>${jobData.stack}</pre>` : ""}
			<p><strong>Environment:</strong> ${process.env.NODE_ENV || "development"}</p>
			<p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
			<p><strong>Notification Cooldown:</strong> ${NOTIFICATION_COOLDOWN_MINUTES} minutes</p>
		`;

        for (const email of CRON_EXCEPTION_EMAIL) {
            await emailService.sendEmail(email, subject, body);
        }
    } catch (error) {
        console.error("Failed to send cron exception notification:", error);
    }
};

// Function to send cron job warning notifications for long-running jobs
export const sendCronWarningNotification = async (jobData: {
    jobId: number;
    jobName: string;
    startTime: Date;
    duration: number;
    thresholdMinutes: number;
}) => {
    if (!CRON_NOTIFICATIONS_ENABLED) {
        return; // Notifications disabled
    }
    try {
        // Check if we should skip notification due to cooldown
        const jobKey = `warning_${jobData.jobName}_${jobData.jobId}`;
        const now = Date.now();
        const lastNotification = warningNotificationCooldownCache.get(jobKey);
        const cooldownMs = NOTIFICATION_COOLDOWN_MINUTES * 60 * 1000;

        if (lastNotification && now - lastNotification < cooldownMs) {
            return; // Warning notification skipped due to cooldown
        }

        // Update the cooldown cache
        warningNotificationCooldownCache.set(jobKey, now);

        const emailService = new EmailService();

        const subject = `[CRON WARNING] ${jobData.jobName} - Long Running Job`;

        const durationMinutes = Math.round(jobData.duration / (1000 * 60));

        const body = `
			<h2>Cron Job Warning Alert</h2>
			<p><strong>Job Name:</strong> ${jobData.jobName}</p>
			<p><strong>Job ID:</strong> ${jobData.jobId}</p>
			<p><strong>Start Time:</strong> ${jobData.startTime.toISOString()}</p>
			<p><strong>Current Duration:</strong> ${durationMinutes} minutes (${jobData.duration}ms)</p>
			<p><strong>Warning Threshold:</strong> ${jobData.thresholdMinutes} minutes</p>
			<p><strong>Status:</strong> Still Running</p>
			<p><strong>Environment:</strong> ${process.env.NODE_ENV || "development"}</p>
			<p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
			<p><strong>Notification Cooldown:</strong> ${NOTIFICATION_COOLDOWN_MINUTES} minutes</p>
			<br>
			<p><em>This job has been running longer than the expected threshold. Please investigate if it's stuck or experiencing issues.</em></p>
		`;

        for (const email of CRON_EXCEPTION_EMAIL) {
            await emailService.sendEmail(email, subject, body);
        }
    } catch (error) {
        console.error("Failed to send cron warning notification:", error);
    }
};

// Function to check for long-running jobs and send warnings
export const checkForLongRunningJobs = async (activeJob: CronJob) => {
    try {
        const now = new Date();
        const thresholdMs = WARNING_THRESHOLD_MINUTES * 60 * 1000;

        if (activeJob.modified_at) {
            const duration = now.getTime() - activeJob.modified_at.getTime();

            if (duration > thresholdMs) {
                await sendCronWarningNotification({
                    jobId: activeJob.id,
                    jobName: activeJob.name,
                    startTime: activeJob.modified_at,
                    duration,
                    thresholdMinutes: WARNING_THRESHOLD_MINUTES,
                });
            }
        }
    } catch (error) {
        console.error("Error checking for long-running jobs:", error);
    }
};

// Function to check for timed-out jobs and terminate them
export const checkForTimedOutJobs = async (activeJob: CronJob) => {
    try {
        const now = new Date();
        const timeoutSeconds = activeJob.timeout_period_seconds || 1800; // Default 1800 seconds (30 minutes)
        const timeoutMs = timeoutSeconds * 1000;

        if (activeJob.modified_at) {
            const duration = now.getTime() - activeJob.modified_at.getTime();

            if (duration > timeoutMs) {
                // Job has exceeded its timeout period - terminate it
                await terminateTimedOutJob(activeJob, duration, timeoutSeconds);
            }
        }
    } catch (error) {
        console.error("Error checking for timed-out jobs:", error);
    }
};

// Store active job processes for termination
const activeJobProcesses = new Map<number, { process: any; startTime: Date }>();

// Function to terminate a timed-out job
const terminateTimedOutJob = async (
    job: CronJob,
    duration: number,
    timeoutSeconds: number
) => {
    try {
        // Try to kill the actual running process
        const activeProcess = activeJobProcesses.get(job.id);
        if (activeProcess) {
            try {
                // If it's a Promise, we can't directly kill it, but we can reject it
                // The timeout mechanism in executeJobWithLogging should handle this
                activeJobProcesses.delete(job.id);
            } catch (processError) {
                console.error(
                    `Failed to terminate process for job ${job.name}:`,
                    processError
                );
            }
        }

        // Mark job as inactive and update timestamps using raw SQL
        const nextRunAt = calculateNextRun(job.cron_expression);
        await prismaCron().$executeRaw`
            UPDATE "CronJob"
            SET 
                active = false,
                last_run_at = NOW(),
                next_run_at = ${nextRunAt},
                modified_at = NOW()
            WHERE id = ${job.id}
        `;

        // Verify termination
        const afterTerminate = await prismaCron().$queryRaw<
            Array<{ id: number; active: boolean }>
        >`
            SELECT id, active FROM "CronJob" WHERE id = ${job.id}
        `;
        if (afterTerminate && afterTerminate.length > 0) {
            if (afterTerminate[0].active) {
                console.error(
                    `[ACTIVE_FIELD_DEBUG] terminateTimedOutJob: ERROR - Active field is still TRUE after termination! Expected FALSE`
                );
            }
        }

        // Send timeout notification
        await sendCronTimeoutNotification({
            jobId: job.id,
            jobName: job.name,
            startTime: job.modified_at!,
            endTime: new Date(),
            duration,
            timeoutSeconds,
        });

        // Increment Prometheus metric for TIMEOUT
        cronJobExecutions.labels(job.name, "TIMEOUT").inc();
    } catch (error) {
        console.error("Error terminating timed-out job:", error);
    }
};

// Function to send cron job timeout notifications
export const sendCronTimeoutNotification = async (jobData: {
    jobId: number;
    jobName: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    timeoutSeconds: number;
}) => {
    if (!CRON_NOTIFICATIONS_ENABLED) {
        return; // Notifications disabled
    }
    try {
        // Check if we should skip notification due to cooldown
        const jobKey = `timeout_${jobData.jobName}_${jobData.jobId}`;
        const now = Date.now();
        const lastNotification = notificationCooldownCache.get(jobKey);
        const cooldownMs = NOTIFICATION_COOLDOWN_MINUTES * 60 * 1000;

        if (lastNotification && now - lastNotification < cooldownMs) {
            return; // Timeout notification skipped due to cooldown
        }

        // Update the cooldown cache
        notificationCooldownCache.set(jobKey, now);

        const emailService = new EmailService();

        const subject = `[CRON TIMEOUT] ${jobData.jobName} - Job Terminated Due to Timeout`;

        // Round to at least 1 second for display consistency
        const durationSeconds = Math.max(
            1,
            Math.round(jobData.duration / 1000)
        );
        const durationMinutes = Math.round(durationSeconds / 60);
        const timeoutMinutes = Math.round(jobData.timeoutSeconds / 60);

        const body = `
			<h2>Cron Job Timeout Alert</h2>
			<p><strong>Job Name:</strong> ${jobData.jobName}</p>
			<p><strong>Job ID:</strong> ${jobData.jobId}</p>
			<p><strong>Start Time:</strong> ${jobData.startTime.toISOString()}</p>
			<p><strong>End Time:</strong> ${jobData.endTime.toISOString()}</p>
			<p><strong>Duration:</strong> ${durationSeconds} seconds (${durationMinutes} minutes)</p>
			<p><strong>Timeout Limit:</strong> ${jobData.timeoutSeconds} seconds (${timeoutMinutes} minutes)</p>
			<p><strong>Status:</strong> Terminated due to timeout</p>
			<p><strong>Environment:</strong> ${process.env.NODE_ENV || "development"}</p>
			<p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
			<p><strong>Notification Cooldown:</strong> ${NOTIFICATION_COOLDOWN_MINUTES} minutes</p>
			<br>
			<p><em>This job exceeded its configured timeout period and has been automatically terminated. Please investigate the job logic for potential performance issues or consider increasing the timeout period if the job legitimately requires more time.</em></p>
		`;

        for (const email of CRON_EXCEPTION_EMAIL) {
            await emailService.sendEmail(email, subject, body);
        }
    } catch (error) {
        console.error("Failed to send cron timeout notification:", error);
    }
};

export const runCronJobs = async () => {
    const startTime = new Date();
    const correlationId = generateCorrelationId();

    // Set the correlation context for this cron job execution
    LogService.setContext(correlationId);

    try {
        // Atomically check for active job AND claim next job in single operation
        // This prevents race conditions where multiple calls claim different jobs
        const { job: nextJob, activeJob } = await getAndMarkNextJob();

        if (!nextJob) {
            if (activeJob) {
                // There's an active job running
                await logCronJobConsolidated({
                    jobId: activeJob.id,
                    jobName: activeJob.name,
                    startTime,
                    status: "SKIPPED",
                    additionalData: {
                        reason: "Another job is already running",
                    },
                });

                // Check for long-running jobs (warnings)
                await checkForLongRunningJobs(activeJob);

                // Check for timed-out jobs (termination)
                await checkForTimedOutJobs(activeJob);

                return {
                    message: "Job is already running",
                    job: activeJob,
                };
            }

            return {
                message: "No jobs scheduled to run.",
            };
        }

        // Add try-finally to ensure cleanup
        try {
            // Log job start
            await logCronJobConsolidated({
                jobId: nextJob.id,
                jobName: nextJob.name,
                startTime,
                status: "STARTED",
            });

            // Execute the job-specific logic with enhanced logging
            const executionResult = await executeJobWithLogging(
                nextJob,
                correlationId
            );

            const endTime = new Date();
            const duration = endTime.getTime() - startTime.getTime();
            // Round to at least 1 second - jobs that complete in < 500ms should show as 1s
            const durationSeconds = Math.max(1, Math.round(duration / 1000));

            // Mark job as complete with execution duration and status
            await markJobAsComplete(nextJob.id, {
                durationSeconds,
                status: "SUCCESS",
            });

            // Increment Prometheus metric for SUCCESS
            cronJobExecutions.labels(nextJob.name, "SUCCESS").inc();

            // Force final update before completion
            if (executionResult.stepCollector) {
                await executionResult.stepCollector.forceUpdate();
            }

            // Log job completion (now handled by real-time StepCollector)

            return {
                message: "Job completed",
                job: nextJob,
                executionResult,
            };
        } catch (error) {
            // Ensure active is set to false if job was marked active
            if (nextJob) {
                try {
                    await prismaCron().$executeRaw`
                        UPDATE "CronJob"
                        SET active = false, modified_at = NOW()
                        WHERE id = ${nextJob.id}
                    `;

                    // Verify cleanup
                    const afterCleanup = await prismaCron().$queryRaw<
                        Array<{ id: number; active: boolean }>
                    >`
                        SELECT id, active FROM "CronJob" WHERE id = ${nextJob.id}
                    `;
                    if (afterCleanup && afterCleanup.length > 0) {
                        if (afterCleanup[0].active) {
                            console.error(
                                `[ACTIVE_FIELD_DEBUG] runCronJobs: ERROR - Active field is still TRUE after error cleanup! Expected FALSE`
                            );
                        }
                    }
                } catch (cleanupError) {
                    console.error(
                        `[ACTIVE_FIELD_DEBUG] runCronJobs: Failed to cleanup active flag for job ${nextJob.id}:`,
                        cleanupError
                    );
                }
            }

            // Increment Prometheus metric for FAILED
            if (nextJob) {
                cronJobExecutions.labels(nextJob.name, "FAILED").inc();
            } else {
                cronJobExecutions.labels("unknown", "FAILED").inc();
            }

            const endTime = new Date();
            const duration = endTime.getTime() - startTime.getTime();

            await logCronJobConsolidated({
                jobId: undefined,
                jobName: "CronManager",
                startTime,
                endTime,
                duration,
                status: "FAILED",
                error: error instanceof Error ? error.message : "Unknown error",
                additionalData: {
                    stack: error instanceof Error ? error.stack : undefined,
                    context: "runCronJobs",
                },
                steps: [], // No steps for manager-level errors
            });

            await sendCronExceptionNotification({
                jobId: undefined,
                jobName: "CronManager",
                error: error instanceof Error ? error.message : "Unknown error",
                startTime,
                endTime,
                duration,
                stack: error instanceof Error ? error.stack : undefined,
                correlationId,
            });

            throw error;
        } finally {
            // Clear the correlation context when done
            LogService.clearContext();
        }
    } catch (error) {
        // Handle errors that occur before the inner try block
        // (e.g., if getAndMarkNextJob() throws an error)
        console.error("Error in runCronJobs:", error);
        throw error;
    }
};

// Atomically find and mark the next eligible job as active
// This uses an atomic UPDATE ... RETURNING operation to prevent concurrent execution
// Only one instance can successfully mark a job as active, preventing connection spikes
const getAndMarkNextJob = async (): Promise<{
    job: CronJob | null;
    activeJob: CronJob | null;
}> => {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // First, check if ANY job is already active
            const activeCheck = await prismaCron().$queryRaw<CronJob[]>`
                SELECT * FROM "CronJob" WHERE active = true LIMIT 1
            `;

            const activeJob =
                activeCheck && activeCheck.length > 0 ? activeCheck[0] : null;

            // If there's an active job, don't try to claim a new one
            if (activeJob) {
                return { job: null, activeJob };
            }

            // No active job, so atomically find and mark the next eligible job as active
            const result = await prismaCron().$queryRaw<CronJob[]>`
                UPDATE "CronJob"
                SET 
                    active = true,
                    modified_at = NOW()
                WHERE id = (
                    SELECT id
                    FROM "CronJob"
                    WHERE active = false
                        AND next_run_at <= NOW()
                    ORDER BY next_run_at ASC
                    LIMIT 1
                )
                AND active = false
                RETURNING *
            `;

            // If no rows were updated, no job is available
            if (!result || result.length === 0) {
                return { job: null, activeJob: null };
            }

            const claimedJob = result[0];

            // Verify the active field was actually set
            const verifyCheck = await prismaCron().$queryRaw<
                Array<{ id: number; active: boolean }>
            >`
                SELECT id, active FROM "CronJob" WHERE id = ${claimedJob.id}
            `;
            if (verifyCheck && verifyCheck.length > 0) {
                if (!verifyCheck[0].active) {
                    console.error(
                        `[ACTIVE_FIELD_DEBUG] getAndMarkNextJob: ERROR - Active field is FALSE after claiming! Expected TRUE`
                    );
                }
            }

            return { job: claimedJob, activeJob: null };
        } catch (error: any) {
            lastError = error;
            console.error(
                `getAndMarkNextJob: Database connection attempt ${attempt} failed:`,
                error.message
            );

            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }

    throw new Error(
        `Failed to connect to database after ${maxRetries} attempts. Last error: ${lastError?.message}`
    );
};

export const markJobAsComplete = async (
    jobId: number,
    options?: {
        durationSeconds?: number;
        status?: "SUCCESS" | "FAILED" | "TIMEOUT" | "CANCELLED";
    }
) => {
    // Check current state before update
    const beforeCheck = await prismaCron().$queryRaw<
        Array<{ id: number; active: boolean; name: string }>
    >`
        SELECT id, active, name FROM "CronJob" WHERE id = ${jobId}
    `;
    if (!beforeCheck || beforeCheck.length === 0) {
        console.error(
            `markJobAsComplete: ERROR - Job ${jobId} not found before update!`
        );
    }

    // Fetch the job's cron_expression using raw SQL to minimize connection usage
    const jobResult = await prismaCron().$queryRaw<
        Array<{ cron_expression: string }>
    >`
        SELECT cron_expression
        FROM "CronJob"
        WHERE id = ${jobId}
    `;

    if (!jobResult || jobResult.length === 0 || !jobResult[0].cron_expression) {
        throw new Error(
            `Job with ID ${jobId} does not exist or has no cron expression defined.`
        );
    }

    // Calculate the next run time using cron-parser
    const nextRunAt = calculateNextRun(jobResult[0].cron_expression);

    try {
        // Update the job's status and next run time using raw SQL
        if (options?.durationSeconds !== undefined) {
            try {
                // Try to update with durationSeconds (column may not exist in database)
                await prismaCron().$executeRaw`
                    UPDATE "CronJob"
                    SET 
                        active = false,
                        last_run_at = NOW(),
                        next_run_at = ${nextRunAt},
                        last_execution_duration_seconds = ${options.durationSeconds},
                        modified_at = NOW()
                    WHERE id = ${jobId}
                `;

                // Update statistics fields if status is provided (separate update to handle missing columns gracefully)
                if (options?.status) {
                    await updateJobStatistics(
                        jobId,
                        options.status,
                        options.durationSeconds
                    );
                }
            } catch (durationError: any) {
                // If column doesn't exist, fall back to update without durationSeconds
                if (
                    durationError?.meta?.code === "42703" ||
                    durationError?.message?.includes("does not exist")
                ) {
                    await prismaCron().$executeRaw`
                        UPDATE "CronJob"
                        SET 
                            active = false,
                            last_run_at = NOW(),
                            next_run_at = ${nextRunAt},
                            modified_at = NOW()
                        WHERE id = ${jobId}
                    `;

                    // Update statistics fields if status is provided
                    if (options?.status) {
                        await updateJobStatistics(
                            jobId,
                            options.status,
                            options.durationSeconds
                        );
                    }
                } else {
                    // Re-throw if it's a different error
                    throw durationError;
                }
            }
        } else {
            await prismaCron().$executeRaw`
                UPDATE "CronJob"
                SET 
                    active = false,
                    last_run_at = NOW(),
                    next_run_at = ${nextRunAt},
                    modified_at = NOW()
                WHERE id = ${jobId}
            `;

            // Update statistics fields if status is provided
            if (options?.status) {
                await updateJobStatistics(jobId, options.status);
            }
        }

        // Verify the active field was actually set to false
        const afterCheck = await prismaCron().$queryRaw<
            Array<{ id: number; active: boolean; name: string }>
        >`
            SELECT id, active, name FROM "CronJob" WHERE id = ${jobId}
        `;
        if (afterCheck && afterCheck.length > 0) {
            if (afterCheck[0].active) {
                console.error(
                    `markJobAsComplete: ERROR - Active field is still TRUE after update! Expected FALSE`
                );
            }
        } else {
            console.error(
                `markJobAsComplete: ERROR - Job ${jobId} not found after update!`
            );
        }
    } catch (error) {
        console.error(
            `[ACTIVE_FIELD_DEBUG] markJobAsComplete: Failed to mark job ${jobId} as complete:`,
            error
        );
        // Safety measure: ensure active is set to false even if update fails
        try {
            await prismaCron().$executeRaw`
                UPDATE "CronJob"
                SET active = false, modified_at = NOW()
                WHERE id = ${jobId}
            `;
        } catch (cleanupError) {
            console.error(
                `markJobAsComplete: Critical: Failed to set active=false for job ${jobId}:`,
                cleanupError
            );
            throw cleanupError;
        }
        throw error;
    }
};

// Helper function to calculate the next run time using cron-parser
const calculateNextRun = (cronExpression: string) => {
    try {
        const interval = parseExpression(cronExpression);
        return interval.next().toDate(); // Get the next execution time as a JavaScript Date
    } catch (error) {
        throw new Error(`Invalid cron expression: ${cronExpression}`);
    }
};

// Helper function to update job statistics fields
const updateJobStatistics = async (
    jobId: number,
    status: "SUCCESS" | "FAILED" | "TIMEOUT" | "CANCELLED",
    durationSeconds?: number
) => {
    try {
        // Get statistics from MongoDB execution history (last 30 days)
        const stats = await CronJobExecutionService.getStats(jobId, 30);

        // Build update SQL with error handling for missing columns
        const updates: string[] = [];

        // Update last_*_at timestamps based on status
        if (status === "SUCCESS") {
            updates.push(`last_success_at = NOW()`);
        } else if (status === "FAILED") {
            updates.push(`last_failure_at = NOW()`);
        } else if (status === "TIMEOUT") {
            updates.push(`last_timeout_at = NOW()`);
        }

        // Recalculate counts from MongoDB stats (not increment - ensures accuracy)
        // Calculate success count: total executions minus failures, timeouts, and cancelled
        const successCount = Math.max(
            0,
            stats.totalExecutions -
            stats.totalFailures -
            stats.totalTimeouts -
            stats.totalCancelled
        );
        updates.push(`success_count_30d = ${successCount}`);
        updates.push(`failure_count_30d = ${stats.totalFailures || 0}`);
        updates.push(`timeout_count_30d = ${stats.totalTimeouts || 0}`);

        // Update duration statistics from MongoDB stats
        // Only update if we have execution data (totalExecutions > 0)
        if (stats.totalExecutions > 0) {
            // Update average duration if available
            if (stats.averageDuration && stats.averageDuration > 0) {
                updates.push(
                    `average_execution_duration_seconds = ${Math.round(stats.averageDuration)}`
                );
            } else {
                updates.push(`average_execution_duration_seconds = NULL`);
            }

            // Update min duration (0 is valid, but null means no data)
            if (stats.minDuration !== undefined && stats.minDuration !== null) {
                updates.push(
                    `min_execution_duration_seconds = ${stats.minDuration}`
                );
            } else {
                updates.push(`min_execution_duration_seconds = NULL`);
            }

            // Update max duration (0 is valid, but null means no data)
            if (stats.maxDuration !== undefined && stats.maxDuration !== null) {
                updates.push(
                    `max_execution_duration_seconds = ${stats.maxDuration}`
                );
            } else {
                updates.push(`max_execution_duration_seconds = NULL`);
            }
        } else {
            // No executions in last 30 days - set all duration stats to NULL
            updates.push(`average_execution_duration_seconds = NULL`);
            updates.push(`min_execution_duration_seconds = NULL`);
            updates.push(`max_execution_duration_seconds = NULL`);
        }

        if (updates.length > 0) {
            // Execute update with error handling for missing columns
            try {
                await prismaCron().$executeRawUnsafe(
                    `
                    UPDATE "CronJob"
                    SET ${updates.join(", ")}, modified_at = NOW()
                    WHERE id = $1
                `,
                    jobId
                );
            } catch (updateError: any) {
                // Silently fail if columns don't exist - this is expected if migration hasn't run
                if (
                    updateError?.meta?.code === "42703" ||
                    updateError?.message?.includes("does not exist")
                ) {
                    // Statistics columns don't exist yet, skipping update
                } else {
                    console.error(
                        `updateJobStatistics: Failed to update statistics:`,
                        updateError
                    );
                }
            }
        }
    } catch (statsError) {
        // Silently fail - statistics update is optional and requires MongoDB
        console.error(
            `updateJobStatistics: Failed to calculate statistics:`,
            statsError
        );
    }
};

// Step collector for consolidated logging with performance optimization
class StepCollector {
    private steps: Array<{
        step: string;
        stepNumber: number;
        message: string;
        level: "INFO" | "ERROR" | "WARNING" | "DEBUG";
        timestamp: Date;
        duration?: number;
        parameters?: any;
        results?: any;
    }> = [];
    private stepCounter = 0;
    private logService: any;
    private jobId: number;
    private jobName: string;
    private startTime: Date;
    private executionId: string;

    // Batching properties for database performance (currently unused but kept for future use)
    private updateIntervalMs: number = 5000;
    private pendingUpdate: boolean = false;
    private updateTimer: NodeJS.Timeout | null = null;

    constructor(
        jobId: number,
        jobName: string,
        startTime: Date,
        executionId?: string
    ) {
        this.jobId = jobId;
        this.jobName = jobName;
        this.startTime = startTime;
        this.logService = LogService.getInstance();
        this.executionId =
            executionId ||
            `exec_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    }

    async createInitialLogRecord() {
        // Add initial log entry to in-memory store for real-time visibility
        this.logService.addInMemoryLog(
            this.executionId,
            "INFO",
            `Starting execution for job "${this.jobName}"`,
            this.jobName,
            undefined, // details
            undefined, // parameters
            undefined, // results
            undefined, // customerId
            this.jobId,
            this.jobName
        );
    }

    async addStep(
        step: string,
        message: string,
        level: "INFO" | "ERROR" | "WARNING" | "DEBUG" = "INFO",
        parameters?: any,
        results?: any,
        duration?: number
    ) {
        this.stepCounter++;
        const stepData = {
            step,
            stepNumber: this.stepCounter,
            message,
            level,
            timestamp: new Date(),
            duration,
            parameters,
            results,
        };

        this.steps.push(stepData);

        // Add to in-memory log store for cron debugger
        this.logService.addInMemoryLog(
            this.executionId,
            stepData.level,
            stepData.message,
            this.jobName,
            undefined, // details
            stepData.parameters,
            stepData.results,
            undefined, // customerId
            this.jobId,
            this.jobName
        );

        // Compress steps if we have too many to prevent memory issues
        if (this.steps.length > 1000) {
            // Keep only the most recent 500 steps and errors
            const recentSteps = this.steps.slice(-500);
            const errorSteps = this.steps.filter((s) => s.level === "ERROR");
            this.steps = [...errorSteps, ...recentSteps].slice(-500);
        }

        // Schedule batched update (currently no-op but kept for future database logging)
        this.scheduleBatchedUpdate();
    }

    private scheduleBatchedUpdate() {
        // Clear existing timer if any
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }

        // Only schedule if not already pending
        if (!this.pendingUpdate) {
            this.pendingUpdate = true;
            this.updateTimer = setTimeout(async () => {
                try {
                    await this.updateLogRecord();
                } finally {
                    this.pendingUpdate = false;
                    this.updateTimer = null;
                }
            }, this.updateIntervalMs);
        }
    }

    private async updateLogRecord() {
        // No-op: Logging handled by in-memory store
    }

    async finalizeLogRecord(
        _endTime: Date,
        _duration: number,
        _finalStats: any
    ) {
        // No-op: Logging handled by in-memory store
    }

    getSteps() {
        return this.steps;
    }

    getStepCount() {
        return this.steps.length;
    }

    getExecutionId() {
        return this.executionId;
    }

    // Force immediate update (useful for critical steps)
    async forceUpdate() {
        // No-op: Logging handled by in-memory store
    }
}

export interface ExecuteJobOptions {
    skipSmsSend?: boolean;
    fastForwardScheduledActivities?: boolean;
}

// Enhanced job execution with detailed logging and timeout monitoring
export const executeJobWithLogging = async (
    job: CronJob,
    correlationId: string,
    customerId?: number,
    options?: ExecuteJobOptions
) => {
    const jobStartTime = new Date();
    const performanceMetrics: Record<string, number> = {};
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    // Create execution record in MongoDB
    let mongoExecutionId: string | null = null;
    try {
        // Create with FAILED status initially - will be updated to SUCCESS on completion
        // This ensures records with N/A duration are marked as FAILED if update never happens
        const execution = await CronJobExecutionService.createExecution(
            job.id,
            {
                startedAt: jobStartTime,
                status: "FAILED", // Will be updated to SUCCESS on completion, or stay FAILED if error occurs
                correlationId: correlationId,
                timeoutPeriodSeconds: job.timeout_period_seconds || 1800,
            }
        );
        mongoExecutionId = execution._id.toString();
    } catch (error) {
        // Log error but don't fail the job execution
        console.error(
            `Failed to create execution record for job ${job.id}:`,
            error
        );
    }

    // Create StepCollector for logging
    const stepCollector = new StepCollector(
        job.id,
        job.name,
        jobStartTime,
        executionId
    );

    // Create initial log record
    await stepCollector.createInitialLogRecord();
    const result = {
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsDeleted: 0,
        performanceMetrics,
        additionalData: {},
        stepCollector, // Include stepCollector for external access
        executionId, // Include execution ID for cron debugger
        steps: [] as Array<{
            step: string;
            stepNumber: number;
            message: string;
            level: "INFO" | "ERROR" | "WARNING" | "DEBUG";
            timestamp: Date;
            duration?: number;
            parameters?: any;
            results?: any;
        }>,
    };

    // Set up timeout monitoring
    const timeoutSeconds = job.timeout_period_seconds || 1800; // Default 1800 seconds (30 minutes)
    const timeoutMs = timeoutSeconds * 1000;
    let timeoutId: NodeJS.Timeout | null = null;
    let isTimedOut = false;

    // Create a timeout promise that will reject if the job takes too long
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            isTimedOut = true;
            reject(
                new Error(
                    `Job ${job.name} exceeded timeout period of ${timeoutSeconds} seconds`
                )
            );
        }, timeoutMs);
    });

    try {
        // Verify job is marked as active before starting execution
        const preExecutionCheck = await prismaCron().$queryRaw<
            Array<{ id: number; active: boolean; name: string }>
        >`
            SELECT id, active, name FROM "CronJob" WHERE id = ${job.id}
        `;
        if (preExecutionCheck && preExecutionCheck.length > 0) {
            if (!preExecutionCheck[0].active) {
                console.error(
                    `executeJobWithLogging: ERROR - Job ${job.id} is not marked as active before execution! Expected TRUE`
                );
            }
        }

        // Track this job as active (jobStartTime already declared above)
        activeJobProcesses.set(job.id, {
            process: null,
            startTime: jobStartTime,
        });

        // Log connection pool status before job execution (optional, for debugging)
        if (process.env.LOG_CONNECTION_POOL_STATUS === "true") {
            try {
                const poolStatus = await prismaCron().$queryRaw<
                    Array<{
                        active_connections: bigint;
                        max_connections: number;
                        available_connections: number;
                    }>
                >`
                    SELECT 
                        count(*)::bigint as active_connections,
                        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
                        ((SELECT setting::int FROM pg_settings WHERE name = 'max_connections') - count(*)) as available_connections
                    FROM pg_stat_activity
                    WHERE datname = current_database()
                `;

                // Connection pool status logged (optional monitoring)
            } catch (error) {
                // Silently fail - monitoring is optional
            }
        }

        // Create the job execution promise
        const jobExecutionPromise = (async () => {
            stepCollector.addStep(
                "START",
                `Starting ${job.name} execution`,
                LogLevel.INFO
            );
            stepCollector.addStep(
                "EXECUTION_PARAMS",
                `Execution parameters: customer ID ${customerId ?? "all customers"}, fast-forward ${options?.fastForwardScheduledActivities ? "enabled" : "disabled"}${job.name === "Activity Workflow Manager" || job.name === "Process Due Notifications" ? `, skip SMS send ${options?.skipSmsSend ? "enabled" : "disabled"}` : ""}`,
                LogLevel.INFO,
                {
                    customerId: customerId ?? null,
                    customerIdLabel:
                        customerId != null
                            ? String(customerId)
                            : "all customers",
                    fastForwardScheduledActivities:
                        options?.fastForwardScheduledActivities ?? false,
                    ...((job.name === "Activity Workflow Manager" ||
                        job.name === "Process Due Notifications") && {
                        skipSmsSend: options?.skipSmsSend ?? false,
                    }),
                }
            );

            switch (job.name) {
                case "Activity Workflow Manager": {
                    stepCollector.addStep(
                        "EXECUTE",
                        "Executing activity workflow manager",
                        LogLevel.INFO
                    );
                    const workflowStart = Date.now();
                    const { activityWorkflowManager } = await import(
                        "../cron-jobs/activityWorkflowManager"
                    );
                    await activityWorkflowManager(
                        job.id,
                        job.last_run_at || undefined,
                        customerId,
                        undefined,
                        stepCollector,
                        options?.skipSmsSend,
                        options?.fastForwardScheduledActivities
                    );
                    const workflowDuration = Date.now() - workflowStart;
                    performanceMetrics["activityWorkflowManager"] =
                        workflowDuration;
                    stepCollector.addStep(
                        "COMPLETE",
                        "Activity workflow manager completed",
                        LogLevel.INFO,
                        undefined,
                        { duration: workflowDuration }
                    );
                    result.additionalData = { workflowCompleted: "success" };
                    break;
                }

                case "Process Due Notifications": {
                    stepCollector.addStep(
                        "EXECUTE",
                        "Executing Process Due Notifications logic",
                        LogLevel.INFO
                    );
                    const dueNotifStart = Date.now();
                    const { processDueNotifications } = await import(
                        "../cron-jobs/processDueNotifications"
                    );
                    const dueNotifResult = await (
                        processDueNotifications as any
                    )(
                        customerId,
                        undefined,
                        stepCollector,
                        {
                            skipSmsSend: options?.skipSmsSend,
                            fastForwardScheduledActivities:
                                options?.fastForwardScheduledActivities,
                        }
                    );
                    const dueNotifDuration = Date.now() - dueNotifStart;
                    performanceMetrics["processDueNotifications"] =
                        dueNotifDuration;
                    stepCollector.addStep(
                        "COMPLETE",
                        "Process Due Notifications completed",
                        LogLevel.INFO,
                        undefined,
                        { duration: dueNotifDuration }
                    );
                    result.additionalData = { dueNotifResult };
                    break;
                }

                case "Over Due Invoice":
                case "Process Overdue Invoices": {
                    stepCollector.addStep(
                        "EXECUTE",
                        "Executing Handle Overdue Invoices logic",
                        LogLevel.INFO
                    );
                    const overdueStart = Date.now();
                    const { handleOverdueInvoices } = await import(
                        "../cron-jobs/handleOverdueInvoices"
                    );
                    const overdueResult = await (handleOverdueInvoices as any)(
                        customerId,
                        undefined,
                        stepCollector
                    );
                    const overdueDuration = Date.now() - overdueStart;
                    performanceMetrics["handleOverdueInvoices"] =
                        overdueDuration;
                    stepCollector.addStep(
                        "COMPLETE",
                        "Handle Overdue Invoices processing completed",
                        LogLevel.INFO,
                        undefined,
                        { duration: overdueDuration }
                    );
                    result.additionalData = { overdueResult };
                    break;
                }

                case "Compute Customer Overdue Metrics": {
                    stepCollector.addStep(
                        "EXECUTE",
                        "Executing computeCustomerOverdueMetrics",
                        LogLevel.INFO
                    );
                    const mStart = Date.now();
                    const computeCustomerOverdueMetrics = (
                        await import("../cron-jobs/computeCustomerOverdueMetrics")
                    ).default;
                    const metricsResult = await (
                        computeCustomerOverdueMetrics as any
                    )(customerId, undefined, stepCollector);
                    const mDuration = Date.now() - mStart;
                    performanceMetrics["computeCustomerOverdueMetrics"] =
                        mDuration;
                    stepCollector.addStep(
                        "COMPLETE",
                        "computeCustomerOverdueMetrics completed",
                        LogLevel.INFO,
                        undefined,
                        { duration: mDuration }
                    );
                    result.additionalData = { metricsResult };
                    break;
                }

                case "Process Notification Rules": {
                    stepCollector.addStep(
                        "EXECUTE",
                        "Executing processNotificationRules",
                        LogLevel.INFO
                    );
                    const notificationRulesStart = Date.now();
                    const processNotificationRules = (
                        await import("../cron-jobs/processNotificationRules")
                    ).default;
                    const notificationRulesResult = await (
                        processNotificationRules as any
                    )(customerId, undefined, stepCollector);
                    const notificationRulesDuration =
                        Date.now() - notificationRulesStart;
                    performanceMetrics["processNotificationRules"] =
                        notificationRulesDuration;
                    stepCollector.addStep(
                        "COMPLETE",
                        "processNotificationRules completed",
                        LogLevel.INFO,
                        undefined,
                        { duration: notificationRulesDuration }
                    );
                    result.additionalData = { notificationRulesResult };
                    break;
                }

                case "Move Collection To Next Category": {
                    stepCollector.addStep(
                        "EXECUTE",
                        "Executing Move Collection To Next Category logic",
                        LogLevel.INFO
                    );
                    const moveStart = Date.now();
                    const { MoveCollectionToNextCategory } = await import(
                        "../cron-jobs/MoveCollectionToNextCategory"
                    );
                    const moveResult = await (
                        MoveCollectionToNextCategory as any
                    )(customerId, undefined, stepCollector, {
                        fastForwardScheduledActivities:
                            options?.fastForwardScheduledActivities,
                    });
                    const moveDuration = Date.now() - moveStart;
                    performanceMetrics["MoveCollectionToNextCategory"] =
                        moveDuration;
                    stepCollector.addStep(
                        "COMPLETE",
                        "Move Collection To Next Category completed",
                        LogLevel.INFO,
                        undefined,
                        { duration: moveDuration }
                    );
                    result.additionalData = { moveResult };
                    break;
                }

                case "Process Automated Collection Periods": {
                    stepCollector.addStep(
                        "EXECUTE",
                        "Executing Process Automated Collection Periods logic",
                        LogLevel.INFO
                    );
                    const processStart = Date.now();
                    const { processAutomatedCollectionPeriods } = await import(
                        "../cron-jobs/processAutomatedCollectionPeriods"
                    );
                    const processResult = await (
                        processAutomatedCollectionPeriods as any
                    )(customerId, undefined, stepCollector);
                    const processDuration = Date.now() - processStart;
                    performanceMetrics["processAutomatedCollectionPeriods"] =
                        processDuration;
                    stepCollector.addStep(
                        "COMPLETE",
                        "Process Automated Collection Periods completed",
                        LogLevel.INFO,
                        undefined,
                        { duration: processDuration }
                    );
                    result.additionalData = { processResult };
                    break;
                }

                case "Fix Closed Collection Data": {
                    stepCollector.addStep(
                        "EXECUTE",
                        "Executing Fix Closed Collection Data logic",
                        LogLevel.INFO
                    );
                    const fixStart = Date.now();
                    const { fixClosedCollectionData } = await import(
                        "../cron-jobs/fixClosedCollectionData"
                    );
                    const fixResult = await (fixClosedCollectionData as any)(
                        job.last_run_at || new Date(),
                        customerId,
                        undefined,
                        stepCollector
                    );
                    const fixDuration = Date.now() - fixStart;
                    performanceMetrics["fixClosedCollectionData"] = fixDuration;
                    stepCollector.addStep(
                        "COMPLETE",
                        "Fix Closed Collection Data completed",
                        LogLevel.INFO,
                        undefined,
                        { duration: fixDuration }
                    );
                    result.additionalData = { fixResult };
                    break;
                }

                case "Close Zero Outstanding Debt Invoices": {
                    stepCollector.addStep(
                        "EXECUTE",
                        "Executing Close Zero Outstanding Debt Invoices logic",
                        LogLevel.INFO
                    );
                    const closeStart = Date.now();
                    const { closeZeroOutstandingDebtInvoiceJob } = await import(
                        "../cron-jobs/closeZeroOutstandingDebtInvoiceJob"
                    );
                    const closeResult = await (
                        closeZeroOutstandingDebtInvoiceJob as any
                    )(customerId, undefined, stepCollector);
                    const closeDuration = Date.now() - closeStart;
                    performanceMetrics["closeZeroOutstandingDebtInvoiceJob"] =
                        closeDuration;
                    stepCollector.addStep(
                        "COMPLETE",
                        "Close Zero Outstanding Debt Invoices completed",
                        LogLevel.INFO,
                        undefined,
                        { duration: closeDuration }
                    );
                    result.additionalData = { closeResult };
                    break;
                }


                case "Inforu SMS Status Check": {
                    stepCollector.addStep(
                        "EXECUTE",
                        "Executing Inforu SMS Status Check logic",
                        LogLevel.INFO
                    );
                    const smsCheckStart = Date.now();
                    const statusChecker = new InforuStatusChecker(
                        stepCollector
                    );
                    await statusChecker.checkPendingSMSStatus();
                    const smsCheckDuration = Date.now() - smsCheckStart;
                    performanceMetrics["inforuSMSStatusCheck"] =
                        smsCheckDuration;
                    stepCollector.addStep(
                        "COMPLETE",
                        "Inforu SMS Status Check completed",
                        LogLevel.INFO,
                        undefined,
                        { duration: smsCheckDuration }
                    );
                    result.additionalData = {
                        statusCheckCompleted: "success",
                        provider: "inforu",
                    };
                    break;
                }

                case "Report Scheduler": {
                    stepCollector.addStep(
                        "EXECUTE",
                        "Executing scheduled reports",
                        LogLevel.INFO
                    );
                    const reportSchedulerStart = Date.now();
                    const { executeScheduledReports } = await import(
                        "../cron-jobs/report-scheduler"
                    );
                    await executeScheduledReports(
                        job.id,
                        undefined,
                        stepCollector
                    );
                    const reportSchedulerDuration =
                        Date.now() - reportSchedulerStart;
                    performanceMetrics["executeScheduledReports"] =
                        reportSchedulerDuration;
                    stepCollector.addStep(
                        "COMPLETE",
                        "Scheduled reports execution completed",
                        LogLevel.INFO,
                        undefined,
                        { duration: reportSchedulerDuration }
                    );
                    result.additionalData = {
                        reportSchedulerCompleted: "success",
                    };
                    break;
                }

                case "Credit Dashboard Daily Snapshot": {
                    stepCollector.addStep(
                        "EXECUTE",
                        "Executing credit dashboard daily snapshots",
                        LogLevel.INFO
                    );
                    const snapshotStart = Date.now();
                    const takeCreditDashboardDailySnapshotsJob = (
                        await import("../cron-jobs/takeCreditDashboardDailySnapshots")
                    ).default;
                    const snapshotResult =
                        await takeCreditDashboardDailySnapshotsJob(
                            customerId,
                            undefined,
                            stepCollector
                        );
                    const snapshotDuration = Date.now() - snapshotStart;
                    performanceMetrics["takeCreditDashboardDailySnapshots"] =
                        snapshotDuration;
                    stepCollector.addStep(
                        "COMPLETE",
                        "Credit dashboard daily snapshots completed",
                        LogLevel.INFO,
                        undefined,
                        { duration: snapshotDuration }
                    );
                    result.additionalData = { snapshotResult };
                    break;
                }
                case "Fetch Currency Rates": {
                    stepCollector.addStep(
                        "EXECUTE",
                        "Executing fetch currency rates cron",
                        LogLevel.INFO
                    );
                    const fxStart = Date.now();
                    const fetchCurrencyRatesJob = (
                        await import("../cron-jobs/fetchCurrencyRates")
                    ).default;
                    const fxResult = await fetchCurrencyRatesJob(
                        customerId,
                        undefined,
                        stepCollector
                    );
                    const fxDuration = Date.now() - fxStart;
                    performanceMetrics["fetchCurrencyRates"] = fxDuration;
                    stepCollector.addStep(
                        "COMPLETE",
                        "Fetch currency rates cron completed",
                        LogLevel.INFO,
                        undefined,
                        { duration: fxDuration }
                    );
                    result.additionalData = { fxResult };
                    break;
                }
                case "Customer Policy Trend Daily Snapshot": {
                    stepCollector.addStep(
                        "EXECUTE",
                        "Executing customer policy trend daily snapshots",
                        LogLevel.INFO
                    );
                    const trendStart = Date.now();
                    const takeCustomerPolicyTrendSnapshotsJob = (
                        await import("../cron-jobs/takeCustomerPolicyTrendSnapshots")
                    ).default;
                    const trendResult =
                        await takeCustomerPolicyTrendSnapshotsJob(
                            customerId,
                            undefined,
                            stepCollector
                        );
                    const trendDuration = Date.now() - trendStart;
                    performanceMetrics["takeCustomerPolicyTrendSnapshots"] =
                        trendDuration;
                    stepCollector.addStep(
                        "COMPLETE",
                        "Customer policy trend daily snapshots completed",
                        LogLevel.INFO,
                        undefined,
                        { duration: trendDuration }
                    );
                    result.additionalData = { trendResult };
                    break;
                }
                case "Insurance Policy Trend Daily Snapshot": {
                    stepCollector.addStep(
                        "EXECUTE",
                        "Executing insurance policy trend daily snapshots",
                        LogLevel.INFO
                    );
                    const insuranceTrendStart = Date.now();
                    const takeInsurancePolicyTrendSnapshotsJob = (
                        await import("../cron-jobs/takeInsurancePolicyTrendSnapshots")
                    ).default;
                    const insuranceTrendResult =
                        await takeInsurancePolicyTrendSnapshotsJob(
                            customerId,
                            undefined,
                            stepCollector
                        );
                    const insuranceTrendDuration =
                        Date.now() - insuranceTrendStart;
                    performanceMetrics["takeInsurancePolicyTrendSnapshots"] =
                        insuranceTrendDuration;
                    stepCollector.addStep(
                        "COMPLETE",
                        "Insurance policy trend daily snapshots completed",
                        LogLevel.INFO,
                        undefined,
                        { duration: insuranceTrendDuration }
                    );
                    result.additionalData = { insuranceTrendResult };
                    break;
                }
                case "Compute Gap In Base Currency": {
                    stepCollector.addStep(
                        "EXECUTE",
                        "Executing compute gap in base currency cron",
                        LogLevel.INFO
                    );
                    const gapStart = Date.now();
                    const computeGapInBaseCurrencyJob = (
                        await import("../cron-jobs/computeGapInBaseCurrency")
                    ).default;
                    const gapResult = await computeGapInBaseCurrencyJob(
                        customerId,
                        undefined,
                        stepCollector
                    );
                    const gapDuration = Date.now() - gapStart;
                    performanceMetrics["computeGapInBaseCurrency"] =
                        gapDuration;
                    stepCollector.addStep(
                        "COMPLETE",
                        "Compute gap in base currency cron completed",
                        LogLevel.INFO,
                        undefined,
                        { duration: gapDuration }
                    );
                    result.additionalData = { gapResult };
                    break;
                }
                case "Sync Billing Connectors": {
                    stepCollector.addStep(
                        "EXECUTE",
                        "Executing billing connector sync cron",
                        LogLevel.INFO
                    );
                    const connectorStart = Date.now();
                    const syncBillingConnectorsJob = (
                        await import("../cron-jobs/syncBillingConnectors")
                    ).default;
                    const connectorResult = await syncBillingConnectorsJob(
                        customerId,
                        undefined,
                        stepCollector
                    );
                    const connectorDuration = Date.now() - connectorStart;
                    performanceMetrics["syncBillingConnectors"] =
                        connectorDuration;
                    stepCollector.addStep(
                        "COMPLETE",
                        "Billing connector sync cron completed",
                        LogLevel.INFO,
                        undefined,
                        { duration: connectorDuration }
                    );
                    result.additionalData = { connectorResult };
                    break;
                }

                default:
                    result.additionalData = {
                        reason: "No logic defined for this job",
                    };
            }

            performanceMetrics["totalExecution"] =
                Date.now() - jobStartTime.getTime();

            // Add final step and collect all steps
            stepCollector.addStep(
                "FINISH",
                "Job execution completed successfully",
                LogLevel.INFO,
                undefined,
                {
                    totalDuration: performanceMetrics["totalExecution"],
                }
            );
            result.steps = stepCollector.getSteps();

            // Finalize the log record with completion status
            const endTime = new Date();
            const duration = endTime.getTime() - jobStartTime.getTime();
            await stepCollector.finalizeLogRecord(endTime, duration, {
                recordsProcessed: result.recordsProcessed,
                recordsCreated: result.recordsCreated,
                recordsUpdated: result.recordsUpdated,
                recordsDeleted: result.recordsDeleted,
                performanceMetrics: performanceMetrics,
            });

            // Update execution record in MongoDB
            if (mongoExecutionId) {
                try {
                    // Round to at least 1 second - jobs that complete in < 500ms should show as 1s
                    const durationSeconds = Math.max(
                        1,
                        Math.round(duration / 1000)
                    );

                    // First attempt: Use service method
                    let updateResult =
                        await CronJobExecutionService.updateExecution(
                            mongoExecutionId,
                            {
                                completedAt: endTime,
                                durationSeconds: durationSeconds,
                                status: "SUCCESS",
                                recordsProcessed: result.recordsProcessed,
                                recordsCreated: result.recordsCreated,
                                recordsUpdated: result.recordsUpdated,
                                recordsDeleted: result.recordsDeleted,
                                performanceMetrics: performanceMetrics,
                            }
                        );

                    // Verify update succeeded and duration was saved
                    if (updateResult) {
                        if (
                            updateResult.duration_seconds === undefined ||
                            updateResult.duration_seconds === null
                        ) {
                            console.warn(
                                `[DURATION_UPDATE] Update returned but duration_seconds is missing for ${mongoExecutionId}. Retrying with direct MongoDB update...`
                            );
                            updateResult = null; // Trigger fallback
                        }
                    }

                    // Fallback: Direct MongoDB update if service method failed or didn't save duration
                    if (
                        !updateResult ||
                        updateResult.duration_seconds === undefined ||
                        updateResult.duration_seconds === null
                    ) {
                        try {
                            const CronJobExecution = (
                                await import("@/models/CronJobExecution")
                            ).default;
                            const directUpdate =
                                await CronJobExecution.findByIdAndUpdate(
                                    mongoExecutionId,
                                    {
                                        $set: {
                                            duration_seconds: durationSeconds,
                                            status: "SUCCESS",
                                            completed_at: endTime,
                                            records_processed:
                                                result.recordsProcessed,
                                            records_created:
                                                result.recordsCreated,
                                            records_updated:
                                                result.recordsUpdated,
                                            records_deleted:
                                                result.recordsDeleted,
                                        },
                                    },
                                    { new: true }
                                );

                            if (
                                directUpdate &&
                                directUpdate.duration_seconds !== undefined &&
                                directUpdate.duration_seconds !== null
                            ) {
                                // Direct MongoDB update successful
                            } else {
                                console.error(
                                    `[DURATION_UPDATE] Direct MongoDB update failed to save duration for ${mongoExecutionId}`
                                );
                            }
                        } catch (directError: any) {
                            console.error(
                                `[DURATION_UPDATE] Direct MongoDB update failed for ${mongoExecutionId}:`,
                                directError.message || directError
                            );
                        }
                    }
                } catch (error: any) {
                    console.error(
                        `[DURATION_UPDATE] Failed to update execution record ${mongoExecutionId}:`,
                        error.message || error
                    );

                    // Last resort: Try direct MongoDB update even on error
                    try {
                        // Round to at least 1 second - jobs that complete in < 500ms should show as 1s
                        const durationSeconds = Math.max(
                            1,
                            Math.round(duration / 1000)
                        );
                        const CronJobExecution = (
                            await import("@/models/CronJobExecution")
                        ).default;
                        await CronJobExecution.findByIdAndUpdate(
                            mongoExecutionId,
                            {
                                $set: {
                                    duration_seconds: durationSeconds,
                                    status: "SUCCESS",
                                    completed_at: endTime,
                                },
                            },
                            { new: true }
                        );
                    } catch (finalError: any) {
                        console.error(
                            `[DURATION_UPDATE] All update attempts failed for ${mongoExecutionId}:`,
                            finalError.message || finalError
                        );
                    }
                }
            }

            return result;
        })();

        // Race between job execution and timeout
        const executionResult = await Promise.race([
            jobExecutionPromise,
            timeoutPromise,
        ]);

        // Clean up active process tracking
        activeJobProcesses.delete(job.id);

        // Clear the timeout if job completed successfully
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        // Ensure execution record is updated even if update was missed in jobExecutionPromise
        // Always try to update if mongoExecutionId exists, regardless of executionResult
        if (mongoExecutionId) {
            try {
                const endTime = new Date();
                const duration = endTime.getTime() - jobStartTime.getTime();
                // Round to at least 1 second - jobs that complete in < 500ms should show as 1s
                const durationSeconds = Math.max(
                    1,
                    Math.round(duration / 1000)
                );

                // Get values from executionResult if available, otherwise use defaults
                const recordsProcessed = executionResult?.recordsProcessed || 0;
                const recordsCreated = executionResult?.recordsCreated || 0;
                const recordsUpdated = executionResult?.recordsUpdated || 0;
                const recordsDeleted = executionResult?.recordsDeleted || 0;
                const performanceMetrics =
                    executionResult?.performanceMetrics || {};

                // First attempt: Use service method
                let updateResult =
                    await CronJobExecutionService.updateExecution(
                        mongoExecutionId,
                        {
                            completedAt: endTime,
                            durationSeconds: durationSeconds,
                            status: "SUCCESS",
                            recordsProcessed: recordsProcessed,
                            recordsCreated: recordsCreated,
                            recordsUpdated: recordsUpdated,
                            recordsDeleted: recordsDeleted,
                            performanceMetrics: performanceMetrics,
                        }
                    );

                // Verify update succeeded and duration was saved
                if (updateResult) {
                    // Check if duration was actually saved
                    if (
                        updateResult.duration_seconds === undefined ||
                        updateResult.duration_seconds === null
                    ) {
                        console.warn(
                            `[DURATION_UPDATE] Update returned but duration_seconds is missing for ${mongoExecutionId}. Retrying with direct MongoDB update...`
                        );
                        updateResult = null; // Trigger fallback
                    }
                }

                // Fallback: Direct MongoDB update if service method failed or didn't save duration
                if (
                    !updateResult ||
                    updateResult.duration_seconds === undefined ||
                    updateResult.duration_seconds === null
                ) {
                    try {
                        const CronJobExecution = (
                            await import("@/models/CronJobExecution")
                        ).default;
                        const directUpdate =
                            await CronJobExecution.findByIdAndUpdate(
                                mongoExecutionId,
                                {
                                    $set: {
                                        duration_seconds: durationSeconds,
                                        status: "SUCCESS",
                                        completed_at: endTime,
                                        records_processed: recordsProcessed,
                                        records_created: recordsCreated,
                                        records_updated: recordsUpdated,
                                        records_deleted: recordsDeleted,
                                    },
                                },
                                { new: true }
                            );

                        if (directUpdate) {
                            // Verify one more time
                            if (
                                directUpdate.duration_seconds === undefined ||
                                directUpdate.duration_seconds === null
                            ) {
                                console.error(
                                    `[DURATION_UPDATE] CRITICAL: Direct update still didn't save duration for ${mongoExecutionId}`
                                );
                            }
                        } else {
                            console.error(
                                `[DURATION_UPDATE] Direct MongoDB update returned null for ${mongoExecutionId}`
                            );
                        }
                    } catch (directError: any) {
                        console.error(
                            `[DURATION_UPDATE] Direct MongoDB update failed for ${mongoExecutionId}:`,
                            directError.message || directError
                        );
                    }
                }
            } catch (updateError: any) {
                console.error(
                    `[DURATION_UPDATE] Failed to ensure execution record update for ${mongoExecutionId}:`,
                    updateError.message || updateError
                );

                // Last resort: Try direct MongoDB update even on error
                try {
                    const endTime = new Date();
                    const duration = endTime.getTime() - jobStartTime.getTime();
                    // Round to at least 1 second - jobs that complete in < 500ms should show as 1s
                    const durationSeconds = Math.max(
                        1,
                        Math.round(duration / 1000)
                    );

                    const CronJobExecution = (
                        await import("@/models/CronJobExecution")
                    ).default;
                    await CronJobExecution.findByIdAndUpdate(
                        mongoExecutionId,
                        {
                            $set: {
                                duration_seconds: durationSeconds,
                                status: "SUCCESS",
                                completed_at: endTime,
                            },
                        },
                        { new: true }
                    );
                } catch (finalError: any) {
                    console.error(
                        `[DURATION_UPDATE] All update attempts failed for ${mongoExecutionId}:`,
                        finalError.message || finalError
                    );
                }
            }
        } else {
            console.warn(
                `[DURATION_UPDATE] No mongoExecutionId available for backup update`
            );
        }

        return executionResult;
    } catch (error) {
        const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
        performanceMetrics["totalExecution"] =
            Date.now() - jobStartTime.getTime();

        // Clear timeout if it exists
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        // Clean up active process tracking
        activeJobProcesses.delete(job.id);

        // Determine if this is a timeout error
        const isTimeoutError =
            isTimedOut || errorMessage.includes("exceeded timeout period");

        // Update execution record in MongoDB with failure status
        const failureStatus: "FAILED" | "TIMEOUT" = isTimeoutError
            ? "TIMEOUT"
            : "FAILED";
        if (mongoExecutionId) {
            try {
                await CronJobExecutionService.updateExecution(
                    mongoExecutionId,
                    {
                        completedAt: new Date(),
                        durationSeconds: Math.round(
                            performanceMetrics["totalExecution"] / 1000
                        ),
                        status: failureStatus,
                        errorMessage: errorMessage,
                        errorType:
                            error instanceof Error
                                ? error.constructor.name
                                : "Unknown",
                        recordsProcessed: result.recordsProcessed,
                        recordsCreated: result.recordsCreated,
                        recordsUpdated: result.recordsUpdated,
                        recordsDeleted: result.recordsDeleted,
                        performanceMetrics: performanceMetrics,
                    }
                );
            } catch (updateError) {
                console.error(
                    `Failed to update execution record ${mongoExecutionId}:`,
                    updateError
                );
            }
        }

        // Update CronJob statistics for failed/timeout executions
        try {
            await updateJobStatistics(
                job.id,
                failureStatus,
                Math.round(performanceMetrics["totalExecution"] / 1000)
            );
        } catch (statsError) {
            // Silently fail - statistics update is optional
            console.error(
                `[ACTIVE_FIELD_DEBUG] Failed to update statistics for failed job:`,
                statsError
            );
        }

        // Add error step to collector
        stepCollector.addStep(
            "ERROR",
            `Job execution failed: ${errorMessage}`,
            LogLevel.ERROR,
            {
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
                isTimeoutError,
                totalDuration: performanceMetrics["totalExecution"],
            }
        );

        await logCronJobConsolidated({
            jobId: job.id,
            jobName: job.name,
            startTime: jobStartTime,
            endTime: new Date(),
            duration: performanceMetrics["totalExecution"],
            status: "FAILED",
            error: errorMessage,
            performanceMetrics,
            additionalData: {
                stack: error instanceof Error ? error.stack : undefined,
                context: "executeJobWithLogging",
                isTimeoutError,
                timeoutSeconds,
            },
            steps: stepCollector.getSteps(),
        });

        // Send appropriate notification based on error type
        if (isTimeoutError) {
            await sendCronTimeoutNotification({
                jobId: job.id,
                jobName: job.name,
                startTime: jobStartTime,
                endTime: new Date(),
                duration: performanceMetrics["totalExecution"],
                timeoutSeconds,
            });
        } else {
            // Skip sending exception notifications for Activity Workflow Manager
            if (job.name !== "Activity Workflow Manager") {
                await sendCronExceptionNotification({
                    jobId: job.id,
                    jobName: job.name,
                    error: errorMessage,
                    startTime: jobStartTime,
                    endTime: new Date(),
                    duration: performanceMetrics["totalExecution"],
                    stack: error instanceof Error ? error.stack : undefined,
                    correlationId,
                });
            }
        }

        throw error;
    } finally {
        // Clean up resources only - do NOT set active = false here
        // The finally block runs synchronously when executeJobWithLogging returns,
        // which is BEFORE runCronJobs() calls markJobAsComplete()
        activeJobProcesses.delete(job.id);

        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
};

/**
 * Get cron job statistics
 * Queries CronJobExecution collection in MongoDB
 */
export const getCronJobStats = async (jobId?: number, days: number = 30) => {
    try {
        return await CronJobExecutionService.getStats(jobId, days);
    } catch (error) {
        console.error("Error getting cron job stats:", error);
        return {
            totalExecutions: 0,
            totalFailures: 0,
            totalSkipped: 0,
            totalTimeouts: 0,
            totalCancelled: 0,
            averageDuration: 0,
            recentExecutions: [],
            performanceMetrics: {},
        };
    }
};

/**
 * Get execution history for a specific job
 */
export const getExecutionHistory = async (jobId: number, days: number = 30) => {
    try {
        return await CronJobExecutionService.getExecutionHistory(jobId, days);
    } catch (error) {
        console.error(
            `Error getting execution history for job ${jobId}:`,
            error
        );
        return [];
    }
};

/**
 * Get error history (failed and timeout executions)
 */
export const getErrorHistory = async (jobId: number, days: number = 30) => {
    try {
        return await CronJobExecutionService.getErrorHistory(jobId, days);
    } catch (error) {
        console.error(`Error getting error history for job ${jobId}:`, error);
        return {
            errorBreakdown: {},
            errors: [],
        };
    }
};

/**
 * Get performance trend data
 */
export const getPerformanceTrend = async (
    jobId: number,
    days: number = 30
): Promise<Array<{ date: Date; duration: number; status: string }>> => {
    try {
        return await CronJobExecutionService.getPerformanceTrend(jobId, days);
    } catch (error) {
        console.error(
            `Error getting performance trend for job ${jobId}:`,
            error
        );
        return [];
    }
};
