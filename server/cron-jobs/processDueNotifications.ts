/**
 * Process Due Notifications
 *
 * Sends notifications for invoices that are due (or due in N days) based on
 * ActivitiesSequence steps with step_type='due' and days_before_due.
 *
 * Run daily, before handleOverdueInvoices, so invoices due today get
 * notifications before potentially becoming overdue.
 */

import { DueNotificationService } from "../services/DueNotificationService";

async function processDueNotifications(
    _customerId?: number,
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
    },
    options?: {
        skipSmsSend?: boolean;
        fastForwardScheduledActivities?: boolean;
    }
): Promise<{
    success: boolean;
    message: string;
    summary?: any;
    error?: string;
    stack?: string;
    duration: number;
}> {
    const startTime = new Date();

    try {
        if (stepCollector) {
            stepCollector.addStep(
                "START",
                "Starting Process Due Notifications process",
                "INFO",
                {
                    processName: "processDueNotifications",
                    startTime: startTime.toISOString(),
                    customerId: _customerId ?? "ALL",
                }
            );
        }

        // When running from cron debugger, forward all logCallback messages (including DEBUG) to stepCollector
        const effectiveLogCallback =
            stepCollector ?
                (message: string, level: "INFO" | "ERROR" | "WARNING" | "DEBUG" = "INFO", parameters?: any) => {
                    stepCollector.addStep("DUE_DEBUG", message, level, parameters);
                    logCallback?.(message, level, parameters);
                }
                : logCallback;

        effectiveLogCallback?.("Starting due notification processing", "INFO");

        if (options?.skipSmsSend && stepCollector) {
            stepCollector.addStep(
                "SMS_DRY_RUN",
                "SMS dry run enabled - no actual SMS will be sent (by Activity Workflow Manager when sending scheduled activities)",
                "INFO",
                { skipSmsSend: true }
            );
        }

        if (options?.fastForwardScheduledActivities && stepCollector) {
            stepCollector.addStep(
                "FAST_FORWARD_SCHEDULED_ACTIVITIES",
                "Fast-forward enabled - created activities will have schedule_time set to 1 hour in the past",
                "INFO",
                { fastForwardScheduledActivities: true }
            );
        }

        const service = new DueNotificationService();
        const result = await service.processDueNotifications({
            customerId: _customerId,
            logCallback: effectiveLogCallback,
            stepCollector,
            skipSmsSend: options?.skipSmsSend,
            fastForwardScheduledActivities: options?.fastForwardScheduledActivities,
        });

        const duration = Date.now() - startTime.getTime();

        if (stepCollector) {
            stepCollector.addStep(
                "COMPLETE",
                "Process Due Notifications process completed successfully",
                "INFO",
                {
                    totalDuration: duration,
                    finalStats: {
                        processed: result.processed,
                        sent: result.sent,
                        skipped: result.skipped,
                        errors: result.errors,
                    },
                },
                undefined,
                duration
            );
        }

        return {
            success: result.success,
            message: `Processed ${result.processed}, sent ${result.sent}, skipped ${result.skipped}`,
            summary: {
                processed: result.processed,
                sent: result.sent,
                skipped: result.skipped,
                errors: result.errors,
            },
            duration,
        };
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        const duration = Date.now() - startTime.getTime();
        const errorMessage = `Critical error in processDueNotifications: ${err.message}`;

        if (stepCollector) {
            stepCollector.addStep("CRITICAL_ERROR", errorMessage, "ERROR", {
                error: err.message,
                stack: err.stack,
                duration,
            });
        }

        throw err;
    }
}

export { processDueNotifications };
