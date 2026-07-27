import { LogLevel } from "../../types/enums";
import { CreateLogData } from "../../types/MongoLog";

import { mongoLogService } from "./MongoLogService";

// Interfaces for type safety
export interface LogDetails {
    correlationId?: string;
    step?: string;
    stepNumber?: number;
    processName?: string;
    performanceMetrics?: Record<string, number>;
    processStats?: Record<string, any>;
    error?: string;
    stack?: string;
    [key: string]: any;
}

export interface LogOptions {
    orderBy?: "timestamp" | "level" | "source";
    order?: "asc" | "desc";
    limit?: number;
}

export interface ProcessSummary {
    correlationId: string;
    processName: string;
    startTime: Date;
    endTime: Date | null;
    duration: number | null;
    status: "COMPLETED" | "FAILED" | "RUNNING";
    totalSteps: number;
    steps: ProcessStep[];
    errors: ProcessError[];
    performanceMetrics: Record<string, number>;
    processStats: Record<string, any>;
}

export interface ProcessStep {
    step: string;
    stepNumber: number;
    timestamp: Date;
    level: LogLevel;
    message: string;
    performanceMetrics: Record<string, number>;
}

export interface ProcessError {
    step: string;
    message: string;
    details: LogDetails;
}

export interface PerformanceAnalytics {
    processName: string;
    period: string;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    totalErrors: number;
    stepPerformance: Record<string, StepPerformance>;
    errorBreakdown: Record<string, number>;
}

export interface StepPerformance {
    count: number;
    totalTime: number;
    averageTime: number;
    errors: number;
}

export interface LogEntry {
    level: LogLevel;
    message: string;
    source: string;
    details?: LogDetails;
    accountId?: number;
    userId?: string;
    jobId?: number;
    correlationId?: string;
}

/**
 * LogService class for handling application logging with correlation tracking
 */
export class LogService {
    private static instance: LogService;
    private static currentCorrelationId: string | null = null;
    private readonly validLevels: LogLevel[] = [
        LogLevel.DEBUG,
        LogLevel.INFO,
        LogLevel.WARNING,
        LogLevel.ERROR,
        LogLevel.CRITICAL,
    ];
    private readonly maxMessageLength = 1000;
    private readonly maxSourceLength = 100;
    private readonly maxDetailsLength = 5000;

    // In-memory log store for cron debugger
    private inMemoryLogs: Map<string, Array<{
        id: string;
        timestamp: string;
        level: LogLevel;
        message: string;
        source: string;
        details?: LogDetails;
        parameters?: any;
        results?: any;
        customerId?: number;
        jobId?: number;
        jobName?: string;
    }>> = new Map();
    private readonly maxLogsPerExecution = 1000; // Limit to prevent memory issues

    private constructor() { }

    /**
     * Get singleton instance of LogService
     */
    public static getInstance(): LogService {
        if (!LogService.instance) {
            LogService.instance = new LogService();
        }
        return LogService.instance;
    }

    /**
     * Set the current correlation context for all subsequent log messages
     */
    public static setContext(correlationId: string): void {
        LogService.currentCorrelationId = correlationId;
    }

    /**
     * Clear the current correlation context
     */
    public static clearContext(): void {
        LogService.currentCorrelationId = null;
    }

    /**
     * Get the current correlation context
     */
    public static getContext(): string | null {
        return LogService.currentCorrelationId;
    }

    /**
     * Log a message with optional correlation tracking
     */
    public async logMessage(
        level: LogLevel,
        message: string,
        source: string,
        details?: LogDetails,
        accountId?: number,
        userId?: string,
        jobId?: number,
        correlationId?: string,
        existingLogId?: number
    ): Promise<void> {
        try {
            this.validateLogLevel(level);

            const finalCorrelationId = this.extractCorrelationId(
                details,
                correlationId
            );

            const sanitizedData = this.sanitizeLogData(
                message,
                source,
                details
            );

            // Create log data for MongoDB
            const logData: CreateLogData = {
                level,
                message: sanitizedData.message,
                source: sanitizedData.source,
                details: sanitizedData.details,
                account_id: accountId,
                user_id: userId ? parseInt(userId) : undefined,
                job_id: jobId,
                correlation_id: finalCorrelationId || undefined,
                timestamp: new Date()
            };

            // MongoDB doesn't support updating by ID like Prisma, so we'll create a new log
            // If existingLogId is provided, we'll log it as a new entry with correlation
            if (existingLogId) {
                logData.details = {
                    ...logData.details,
                    originalLogId: existingLogId,
                    isUpdate: true
                };
            }

            await mongoLogService.logMessage(logData);

            this.logToConsole(
                level,
                message,
                source,
                finalCorrelationId
            );
        } catch (error: any) {
            this.handleLogError(error, level, message, source);
        }
    }

    /**
     * Get all logs for a specific correlation ID
     */
    public async getLogsByCorrelationId(
        correlationId: string,
        options: LogOptions = {}
    ): Promise<any[]> {
        try {
            const logs = await mongoLogService.getLogsByCorrelationId(correlationId);

            // Apply sorting and limiting
            const { orderBy = "timestamp", order = "asc", limit = 100 } = options;

            const sortedLogs = logs.sort((a, b) => {
                const aValue = a[orderBy];
                const bValue = b[orderBy];

                if (order === "asc") {
                    return aValue > bValue ? 1 : -1;
                } else {
                    return aValue < bValue ? 1 : -1;
                }
            });

            return sortedLogs.slice(0, limit);
        } catch (error) {
            // Failed to fetch logs by correlation ID
            throw new Error(
                `Failed to fetch logs for correlation ID ${correlationId}: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        }
    }

    /**
     * Get process execution summary by correlation ID
     */
    public async getProcessExecutionSummary(
        correlationId: string
    ): Promise<ProcessSummary | { error: string }> {
        try {
            const logs = await this.getLogsByCorrelationId(correlationId, {
                orderBy: "timestamp",
                order: "asc",
            });

            if (logs.length === 0) {
                return { error: "No logs found for this correlation ID" };
            }

            return this.buildProcessSummary(logs, correlationId);
        } catch (error) {
            // Failed to generate process execution summary
            throw new Error(
                `Failed to generate summary for correlation ID ${correlationId}: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        }
    }

    /**
     * Get recent process executions for a specific process name
     */
    public async getRecentProcessExecutions(
        processName: string,
        limit: number = 10
    ): Promise<ProcessSummary[]> {
        try {
            const logs = await this.getLogsByProcessName(
                processName,
                limit * 20
            );
            const correlationIds = this.extractCorrelationIds(
                logs,
                processName
            );

            const summaries: ProcessSummary[] = [];
            for (const correlationId of correlationIds.slice(0, limit)) {
                try {
                    const summary =
                        await this.getProcessExecutionSummary(correlationId);
                    if (summary && !("error" in summary)) {
                        summaries.push(summary);
                    }
                } catch (error) {
                    // Failed to get summary for correlation ID
                }
            }

            return summaries.sort(
                (a, b) =>
                    new Date(b.startTime).getTime() -
                    new Date(a.startTime).getTime()
            );
        } catch (error) {
            // Failed to get recent process executions
            throw new Error(
                `Failed to get recent executions for process ${processName}: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        }
    }

    /**
     * Get process performance analytics
     */
    public async getProcessPerformanceAnalytics(
        processName: string,
        days: number = 30
    ): Promise<PerformanceAnalytics> {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            // Use MongoDB to get logs by process name and date range
            const result = await mongoLogService.getLogsForAdmin({
                startDate,
                endDate: new Date(),
                search: processName
            }, {
                limit: 1000,
                sortField: 'timestamp',
                sortDirection: 'desc'
            });

            const correlationIds = this.extractCorrelationIds(
                result.logs,
                processName
            );
            return await this.buildPerformanceAnalytics(
                processName,
                correlationIds,
                days
            );
        } catch (error) {
            // Failed to get process performance analytics
            throw new Error(
                `Failed to get analytics for process ${processName}: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        }
    }

    /**
     * Batch log multiple entries efficiently
     */
    public async batchLog(entries: LogEntry[]): Promise<void> {
        try {
            const sanitizedEntries: CreateLogData[] = entries.map((entry) => {
                return {
                    level: entry.level,
                    message: this.sanitizeMessage(entry.message),
                    source: this.sanitizeSource(entry.source),
                    details: entry.details
                        ? this.sanitizeDetails(entry.details)
                        : undefined,
                    account_id: entry.accountId,
                    user_id: entry.userId ? parseInt(entry.userId) : undefined,
                    job_id: entry.jobId,
                    correlation_id: this.extractCorrelationId(
                        entry.details,
                        entry.correlationId
                    ) || undefined,
                    timestamp: new Date()
                };
            });

            await mongoLogService.batchLog(sanitizedEntries);

            // Log to console for immediate visibility
            entries.forEach((entry) => {
                const correlationId = this.extractCorrelationId(
                    entry.details,
                    entry.correlationId
                );
                this.logToConsole(
                    entry.level,
                    entry.message,
                    entry.source,
                    correlationId
                );
            });
        } catch (error) {
            // Failed to batch log entries
            // Fallback to individual logging
            for (const entry of entries) {
                try {
                    await this.logMessage(
                        entry.level,
                        entry.message,
                        entry.source,
                        entry.details,
                        entry.accountId,
                        entry.userId,
                        entry.jobId,
                        entry.correlationId
                    );
                } catch (e) {
                    // Failed to log individual entry
                }
            }
        }
    }

    /**
     * Clean up old logs (utility method)
     */
    public async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
        try {
            const result = await mongoLogService.cleanupOldLogs(daysToKeep);
            return result.deletedCount || 0;
        } catch (error) {
            // Failed to cleanup old logs
            throw new Error(
                `Failed to cleanup old logs: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        }
    }

    // Private helper methods

    private validateLogLevel(level: LogLevel): void {
        if (!this.validLevels.includes(level)) {
            throw new Error(`Invalid log level: ${level}`);
        }
    }

    private extractCorrelationId(
        details?: LogDetails,
        correlationId?: string
    ): string | null {
        if (correlationId) {
            return correlationId;
        }
        if (details?.correlationId) {
            return details.correlationId;
        }
        return LogService.currentCorrelationId;
    }

    private sanitizeLogData(
        message: string,
        source: string,
        details?: LogDetails
    ) {
        return {
            message: this.sanitizeMessage(message),
            source: this.sanitizeSource(source),
            details: details ? this.sanitizeDetails(details) : undefined,
        };
    }

    private sanitizeMessage(message: string): string {
        return message ? message.slice(0, this.maxMessageLength) : "";
    }

    private sanitizeSource(source: string): string {
        return source ? source.slice(0, this.maxSourceLength) : "";
    }

    private sanitizeDetails(details: LogDetails): any {
        return details;
    }

    private logToConsole(
        level: LogLevel,
        message: string,
        source: string,
        correlationId?: string | null
    ): void {
        const correlationInfo = correlationId
            ? `, Correlation: ${correlationId}`
            : "";
        // Log message processed
    }

    private handleLogError(
        error: unknown,
        level: LogLevel,
        message: string,
        source: string
    ): void {
        // Failed to insert log entry
        // Fallback to console logging to prevent data loss
    }

    private async getLogsByProcessName(
        processName: string,
        limit: number
    ): Promise<any[]> {
        const result = await mongoLogService.getLogsForAdmin({
            search: processName
        }, {
            limit,
            sortField: 'timestamp',
            sortDirection: 'desc'
        });
        return result.logs;
    }

    private extractCorrelationIds(logs: any[], processName: string): string[] {
        const correlationIds = new Set<string>();

        logs.forEach((log) => {
            if (log.details) {
                try {
                    const details =
                        typeof log.details === "string"
                            ? JSON.parse(log.details)
                            : log.details;
                    if (
                        details.correlationId &&
                        details.processName === processName
                    ) {
                        correlationIds.add(details.correlationId);
                    }
                } catch (e) {
                    // Ignore parsing errors
                }
            }
        });

        return Array.from(correlationIds);
    }

    private buildProcessSummary(
        logs: any[],
        correlationId: string
    ): ProcessSummary {
        const startLog = logs.find((log) => {
            try {
                const details =
                    typeof log.details === "string"
                        ? JSON.parse(log.details)
                        : log.details;
                return details.step === "START";
            } catch {
                return false;
            }
        });

        const endLog = logs.find((log) => {
            try {
                const details =
                    typeof log.details === "string"
                        ? JSON.parse(log.details)
                        : log.details;
                return details.step === "COMPLETED";
            } catch {
                return false;
            }
        });

        const errorLog = logs.find((log) => {
            try {
                const details =
                    typeof log.details === "string"
                        ? JSON.parse(log.details)
                        : log.details;
                return details.step === "ERROR";
            } catch {
                return false;
            }
        });

        const summary: ProcessSummary = {
            correlationId,
            processName: this.extractProcessName(startLog),
            startTime: startLog?.timestamp || logs[0].timestamp,
            endTime: endLog?.timestamp || errorLog?.timestamp || null,
            duration: null,
            status: errorLog ? "FAILED" : endLog ? "COMPLETED" : "RUNNING",
            totalSteps: logs.length,
            steps: [],
            errors: [],
            performanceMetrics: {},
            processStats: {},
        };

        // Calculate duration
        if (summary.endTime && summary.startTime) {
            summary.duration =
                new Date(summary.endTime).getTime() -
                new Date(summary.startTime).getTime();
        }

        // Extract step information and metrics
        this.extractStepsAndMetrics(logs, summary);

        return summary;
    }

    private extractProcessName(startLog: any): string {
        if (!startLog?.details) return "Unknown";
        try {
            const details =
                typeof startLog.details === "string"
                    ? JSON.parse(startLog.details)
                    : startLog.details;
            return details.processName || "Unknown";
        } catch {
            return "Unknown";
        }
    }

    private extractStepsAndMetrics(logs: any[], summary: ProcessSummary): void {
        logs.forEach((log) => {
            if (log.details) {
                try {
                    const details =
                        typeof log.details === "string"
                            ? JSON.parse(log.details)
                            : log.details;

                    if (details.step) {
                        summary.steps.push({
                            step: details.step,
                            stepNumber: details.stepNumber || 0,
                            timestamp: log.timestamp,
                            level: log.level,
                            message: log.message,
                            performanceMetrics:
                                details.performanceMetrics || {},
                        });
                    }

                    // Collect errors
                    if (log.level === "ERROR" || log.level === "WARNING") {
                        summary.errors.push({
                            step: details.step || "Unknown",
                            message: log.message,
                            details: details,
                        });
                    }

                    // Collect performance metrics
                    if (details.performanceMetrics) {
                        Object.assign(
                            summary.performanceMetrics,
                            details.performanceMetrics
                        );
                    }

                    // Collect process stats
                    if (details.processStats) {
                        Object.assign(
                            summary.processStats,
                            details.processStats
                        );
                    }
                } catch (e) {
                    // Failed to parse log details
                }
            }
        });
    }

    private async buildPerformanceAnalytics(
        processName: string,
        correlationIds: string[],
        days: number
    ): Promise<PerformanceAnalytics> {
        const analytics: PerformanceAnalytics = {
            processName,
            period: `${days} days`,
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            averageDuration: 0,
            minDuration: Infinity,
            maxDuration: 0,
            totalErrors: 0,
            stepPerformance: {},
            errorBreakdown: {},
        };

        const durations: number[] = [];

        // Analyze each execution
        for (const correlationId of correlationIds) {
            try {
                const summary =
                    await this.getProcessExecutionSummary(correlationId);
                if (summary && !("error" in summary)) {
                    analytics.totalExecutions++;

                    if (summary.status === "COMPLETED") {
                        analytics.successfulExecutions++;
                    } else if (summary.status === "FAILED") {
                        analytics.failedExecutions++;
                    }

                    if (summary.duration) {
                        durations.push(summary.duration);
                        analytics.minDuration = Math.min(
                            analytics.minDuration,
                            summary.duration
                        );
                        analytics.maxDuration = Math.max(
                            analytics.maxDuration,
                            summary.duration
                        );
                    }

                    analytics.totalErrors += summary.errors.length;

                    // Aggregate step performance
                    this.aggregateStepPerformance(summary, analytics);
                }
            } catch (e) {
                // Failed to analyze correlation ID
            }
        }

        // Calculate averages
        if (durations.length > 0) {
            analytics.averageDuration =
                durations.reduce((a, b) => a + b, 0) / durations.length;
        }

        // Calculate step averages
        this.calculateStepAverages(analytics);

        return analytics;
    }

    private aggregateStepPerformance(
        summary: ProcessSummary,
        analytics: PerformanceAnalytics
    ): void {
        summary.steps.forEach((step) => {
            if (!analytics.stepPerformance[step.step]) {
                analytics.stepPerformance[step.step] = {
                    count: 0,
                    totalTime: 0,
                    averageTime: 0,
                    errors: 0,
                };
            }

            analytics.stepPerformance[step.step].count++;
            if (step.performanceMetrics && step.performanceMetrics[step.step]) {
                analytics.stepPerformance[step.step].totalTime +=
                    step.performanceMetrics[step.step];
            }

            if (step.level === "ERROR") {
                analytics.stepPerformance[step.step].errors++;
            }
        });
    }

    private calculateStepAverages(analytics: PerformanceAnalytics): void {
        Object.keys(analytics.stepPerformance).forEach((step) => {
            const stepData = analytics.stepPerformance[step];
            if (stepData.count > 0) {
                stepData.averageTime = stepData.totalTime / stepData.count;
            }
        });
    }

    /**
     * Add a log entry to in-memory store for cron debugger
     */
    public addInMemoryLog(
        executionId: string,
        level: LogLevel,
        message: string,
        source: string,
        details?: LogDetails,
        parameters?: any,
        results?: any,
        customerId?: number,
        jobId?: number,
        jobName?: string
    ): void {
        if (!this.inMemoryLogs.has(executionId)) {
            this.inMemoryLogs.set(executionId, []);
        }

        const executionLogs = this.inMemoryLogs.get(executionId)!;

        // Limit the number of logs per execution to prevent memory issues
        if (executionLogs.length >= this.maxLogsPerExecution) {
            executionLogs.shift(); // Remove oldest log
        }

        const logEntry = {
            id: `${executionId}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
            timestamp: new Date().toISOString(),
            level,
            message,
            source,
            details,
            parameters,
            results,
            customerId,
            jobId,
            jobName,
        };

        executionLogs.push(logEntry);
    }

    /**
     * Get all logs for a specific execution from in-memory store
     */
    public getInMemoryLogs(executionId: string): Array<{
        id: string;
        timestamp: string;
        level: LogLevel;
        message: string;
        source: string;
        details?: LogDetails;
        parameters?: any;
        results?: any;
        customerId?: number;
        jobId?: number;
        jobName?: string;
    }> {
        return this.inMemoryLogs.get(executionId) || [];
    }

    /**
     * Clear logs for a specific execution from in-memory store
     */
    public clearInMemoryLogs(executionId: string): void {
        this.inMemoryLogs.delete(executionId);
    }

    /**
     * Clear all in-memory logs (for cleanup)
     */
    public clearAllInMemoryLogs(): void {
        this.inMemoryLogs.clear();
    }

    /**
     * Get execution IDs that have in-memory logs
     */
    public getInMemoryExecutionIds(): string[] {
        return Array.from(this.inMemoryLogs.keys());
    }

    /**
     * Clean up old in-memory logs (older than specified hours)
     */
    public cleanupOldInMemoryLogs(maxAgeHours: number = 24): void {
        const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);

        for (const [executionId, logs] of Array.from(this.inMemoryLogs.entries())) {
            const recentLogs = logs.filter(log =>
                new Date(log.timestamp).getTime() > cutoffTime
            );

            if (recentLogs.length === 0) {
                this.inMemoryLogs.delete(executionId);
            } else {
                this.inMemoryLogs.set(executionId, recentLogs);
            }
        }
    }
}

// Export singleton instance and convenience functions for backward compatibility
export const logService = LogService.getInstance();

// Convenience functions for easy usage
export const logMessage = (
    level: LogLevel,
    message: string,
    source: string,
    details?: LogDetails,
    accountId?: number,
    userId?: string,
    jobId?: number,
    correlationId?: string
) =>
    logService.logMessage(
        level,
        message,
        source,
        details,
        accountId,
        userId,
        jobId,
        correlationId
    );

export const getLogsByCorrelationId = (
    correlationId: string,
    options?: LogOptions
) => logService.getLogsByCorrelationId(correlationId, options);

export const getProcessExecutionSummary = (correlationId: string) =>
    logService.getProcessExecutionSummary(correlationId);

export const getRecentProcessExecutions = (
    processName: string,
    limit?: number
) => logService.getRecentProcessExecutions(processName, limit);

export const getProcessPerformanceAnalytics = (
    processName: string,
    days?: number
) => logService.getProcessPerformanceAnalytics(processName, days);
