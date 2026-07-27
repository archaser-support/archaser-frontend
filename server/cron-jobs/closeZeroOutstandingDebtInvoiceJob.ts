/*
    This cron job is used to close invoices with zero outstanding debt.
    Algorithm:
    1. Find all invoices with zero outstanding debt
    2. Close these invoices by updating their status
    3. Log the process and results
*/
import { LogLevel } from "@/types/enums";

import { InvoiceService } from "../services/InvoiceService";
import { LogService } from "../services/LogService";

async function closeZeroOutstandingDebtInvoiceJob(
    customerId?: number,
    logCallback?: (message: string, level: 'INFO' | 'ERROR' | 'WARNING' | 'DEBUG', parameters?: any, results?: any) => void,
    stepCollector?: {
        addStep: (step: string, message: string, level?: 'INFO' | 'ERROR' | 'WARNING' | 'DEBUG', parameters?: any, results?: any, duration?: number) => void;
    }
) {
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
        totalInvoicesProcessed: 0,
        invoicesClosed: 0,
        errors: [] as string[],
    };

    try {
        // Add process start message to step collector
        if (stepCollector) {
            stepCollector.addStep("START", "Starting closeZeroOutstandingDebtInvoiceJob process", "INFO", {
                processName: "closeZeroOutstandingDebtInvoiceJob",
                startTime: startTime.toISOString(),
                customerId: customerId || 'ALL',
            });
        }
        // Call logCallback if provided (for real-time frontend logging)
        if (logCallback) {
            logCallback(
                "Starting closeZeroOutstandingDebtInvoiceJob process",
                'INFO',
                {
                    processName: "closeZeroOutstandingDebtInvoiceJob",
                    startTime: startTime.toISOString(),
                    customerId: customerId || 'ALL',
                    step: "START",
                    stepNumber: 1,
                }
            );
        }

        const invoiceService = new InvoiceService();

        // Close zero outstanding debt invoices
        const closeInvoicesStart = Date.now();
        await invoiceService.closeZeroOutstandingDebtInvoices();
        const closeInvoicesDuration = Date.now() - closeInvoicesStart;

        // Since the method doesn't return details, we'll log the completion
        processStats.invoicesClosed = 0; // Will be updated if we can get this info
        processStats.totalInvoicesProcessed = 0; // Will be updated if we can get this info
        const totalDuration = Date.now() - startTime.getTime();

        if (logCallback) {
            logCallback(
                "closeZeroOutstandingDebtInvoiceJob process completed successfully",
                'INFO',
                {
                    processName: "closeZeroOutstandingDebtInvoiceJob",
                    startTime: startTime.toISOString(),
                    customerId: customerId || 'ALL',
                    step: "COMPLETE",
                    stepNumber: 3,
                    duration: totalDuration,
                    processStats: {
                        totalInvoicesProcessed: processStats.totalInvoicesProcessed,
                        invoicesClosed: processStats.invoicesClosed,
                        errors: processStats.errors.length
                    },
                    performanceMetrics: {
                        closeInvoices: closeInvoicesDuration,
                        totalExecution: totalDuration,
                    }
                }
            );
        }

        // Add process completion message to step collector
        if (stepCollector) {
            stepCollector.addStep("COMPLETE", "closeZeroOutstandingDebtInvoiceJob process completed successfully", "INFO", {
                totalDuration,
                finalStats: processStats,
            });
        }

        return {
            success: true,
            duration: totalDuration,
        };
    } catch (err) {
        const error = err as Error;
        const totalDuration = Date.now() - startTime.getTime();

        // Add error to step collector if available
        if (stepCollector) {
            stepCollector.addStep("ERROR", `closeZeroOutstandingDebtInvoiceJob process failed: ${error.message}`, "ERROR", {
                error: error.message,
                stack: error.stack,
                finalStats: processStats,
                duration: totalDuration,
            });
        }

        throw error;
    }
}

export { closeZeroOutstandingDebtInvoiceJob };
