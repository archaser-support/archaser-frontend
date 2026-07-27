import { ensureMongoConnection } from "@/lib/mongoose";
import { prisma } from "@/lib/prisma";
import CronJobExecution, {
    ICronJobExecution,
    ExecutionStatus,
} from "@/models/CronJobExecution";
import { CronJobExecution as CronJobExecutionType } from "@/types/CronJobExecution";

/**
 * Service for managing CronJobExecution records in MongoDB
 * Provides CRUD operations with application-level validation
 */
export class CronJobExecutionService {
    /**
     * Validate that a job_id exists in PostgreSQL CronJob table
     * Application-level validation (no DB foreign key)
     */
    private static async validateJobId(jobId: number): Promise<boolean> {
        try {
            const job = await prisma.cronJob.findUnique({
                where: { id: jobId },
                select: { id: true },
            });
            return job !== null;
        } catch (error) {
            console.error(`Error validating job_id ${jobId}:`, error);
            return false;
        }
    }

    /**
     * Create a new execution record
     * Validates job_id exists before creating
     */
    static async createExecution(
        jobId: number,
        data: {
            startedAt?: Date;
            status: ExecutionStatus;
            correlationId?: string;
            timeoutPeriodSeconds?: number;
        }
    ): Promise<ICronJobExecution> {
        // Ensure MongoDB connection
        await ensureMongoConnection();

        // Validate job_id exists
        const isValid = await this.validateJobId(jobId);
        if (!isValid) {
            throw new Error(
                `Invalid job_id: ${jobId}. CronJob does not exist.`
            );
        }

        const execution = new CronJobExecution({
            job_id: jobId,
            started_at: data.startedAt || new Date(),
            status: data.status,
            correlation_id: data.correlationId,
            timeout_period_seconds: data.timeoutPeriodSeconds,
        });

        return await execution.save();
    }

    /**
     * Update an execution record
     */
    static async updateExecution(
        executionId: string,
        data: {
            completedAt?: Date;
            durationSeconds?: number;
            status?: ExecutionStatus;
            errorMessage?: string;
            errorType?: string;
            recordsProcessed?: number;
            recordsCreated?: number;
            recordsUpdated?: number;
            recordsDeleted?: number;
            peakConnections?: number;
            performanceMetrics?: Record<string, any>;
        }
    ): Promise<ICronJobExecution | null> {
        // Ensure MongoDB connection
        await ensureMongoConnection();

        // Validate executionId
        if (!executionId || typeof executionId !== "string") {
            console.error(
                `[DURATION_UPDATE] Invalid executionId: ${executionId}`
            );
            return null;
        }

        const modified_ata: any = {};

        if (data.completedAt !== undefined)
            modified_ata.completed_at = data.completedAt;

        // CRITICAL: Explicitly check for undefined/null to allow 0 values
        // This ensures 0 is saved, not skipped
        if (
            data.durationSeconds !== undefined &&
            data.durationSeconds !== null
        ) {
            // Ensure it's a valid number (handle edge cases)
            const durationValue =
                typeof data.durationSeconds === "number"
                    ? Math.max(0, Math.round(data.durationSeconds))
                    : parseInt(String(data.durationSeconds), 10);

            if (!isNaN(durationValue)) {
                modified_ata.duration_seconds = durationValue;
            }
        }

        if (data.status !== undefined) modified_ata.status = data.status;
        if (data.errorMessage !== undefined)
            modified_ata.error_message = data.errorMessage;
        if (data.errorType !== undefined)
            modified_ata.error_type = data.errorType;
        if (data.recordsProcessed !== undefined)
            modified_ata.records_processed = data.recordsProcessed;
        if (data.recordsCreated !== undefined)
            modified_ata.records_created = data.recordsCreated;
        if (data.recordsUpdated !== undefined)
            modified_ata.records_updated = data.recordsUpdated;
        if (data.recordsDeleted !== undefined)
            modified_ata.records_deleted = data.recordsDeleted;
        if (data.peakConnections !== undefined)
            modified_ata.peak_connections = data.peakConnections;
        if (data.performanceMetrics !== undefined)
            modified_ata.performance_metrics = data.performanceMetrics;

        // Use explicit $set operator to ensure fields are always updated
        // This handles edge cases where fields might not be set
        try {
            const updateResult = await CronJobExecution.findByIdAndUpdate(
                executionId,
                { $set: modified_ata },
                { new: true, runValidators: false }
            );

            // Verify critical fields were saved (especially duration_seconds)
            if (
                updateResult &&
                data.durationSeconds !== undefined &&
                data.durationSeconds !== null
            ) {
                // Re-query to verify the update was actually persisted
                const verification =
                    await CronJobExecution.findById(executionId).lean();
                if (verification) {
                    const expectedDuration = Math.max(
                        0,
                        Math.round(data.durationSeconds)
                    );
                    if (verification.duration_seconds !== expectedDuration) {
                        // Retry with explicit $set for duration only
                        console.warn(
                            `[DURATION_UPDATE] Verification failed for ${executionId}. Expected: ${expectedDuration}, Got: ${verification.duration_seconds}. Retrying...`
                        );
                        await CronJobExecution.findByIdAndUpdate(
                            executionId,
                            { $set: { duration_seconds: expectedDuration } },
                            { new: true }
                        );
                    }
                }
            }

            return updateResult;
        } catch (error: any) {
            console.error(
                `[DURATION_UPDATE] MongoDB update failed for ${executionId}:`,
                error.message || error
            );
            // Return null to indicate failure - caller can retry
            return null;
        }
    }

    /**
     * Get execution history for a specific job
     */
    static async getExecutionHistory(
        jobId: number,
        days: number = 30
    ): Promise<CronJobExecutionType[]> {
        // Ensure MongoDB connection
        await ensureMongoConnection();

        const executions = await CronJobExecution.findByJobId(jobId, 100, days);

        return executions.map((exec) => this.mapToType(exec));
    }

    /**
     * Get error history (failed and timeout executions)
     */
    static async getErrorHistory(
        jobId: number,
        days: number = 30
    ): Promise<{
        errorBreakdown: Record<string, number>;
        errors: CronJobExecutionType[];
    }> {
        // Ensure MongoDB connection
        await ensureMongoConnection();

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const errorExecutions = await CronJobExecution.find({
            job_id: jobId,
            status: { $in: ["FAILED", "TIMEOUT"] },
            started_at: { $gte: cutoffDate },
        })
            .sort({ started_at: -1 })
            .limit(100);

        const errorBreakdown: Record<string, number> = {
            FAILED: 0,
            TIMEOUT: 0,
        };

        errorExecutions.forEach((exec) => {
            if (exec.status === "FAILED" || exec.status === "TIMEOUT") {
                errorBreakdown[exec.status] =
                    (errorBreakdown[exec.status] || 0) + 1;
            }
        });

        return {
            errorBreakdown,
            errors: errorExecutions.map((exec) => this.mapToType(exec)),
        };
    }

    /**
     * Get performance trend data
     */
    static async getPerformanceTrend(
        jobId: number,
        days: number = 30
    ): Promise<
        Array<{ date: Date; duration: number; status: ExecutionStatus }>
    > {
        // Ensure MongoDB connection
        await ensureMongoConnection();

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const executions = await CronJobExecution.find({
            job_id: jobId,
            started_at: { $gte: cutoffDate },
            duration_seconds: { $ne: null },
        })
            .sort({ started_at: 1 })
            .select("started_at duration_seconds status")
            .lean();

        return executions.map((exec) => ({
            date: exec.started_at,
            duration: exec.duration_seconds || 0,
            status: exec.status,
        }));
    }

    /**
     * Get statistics for cron job executions
     */
    static async getStats(jobId?: number, days: number = 30): Promise<any> {
        // Ensure MongoDB connection
        await ensureMongoConnection();

        const stats = await CronJobExecution.getStats(jobId, days);

        if (stats.length === 0) {
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

        const stat = stats[0];
        const totalExecutions = stat.totalExecutions || 0;
        const totalFailures = stat.failedCount || 0;
        const totalTimeouts = stat.timeoutCount || 0;
        const totalCancelled = stat.cancelledCount || 0;

        // Get recent executions
        let recentExecutions: CronJobExecutionType[] = [];
        if (jobId) {
            recentExecutions = await this.getExecutionHistory(jobId, days);
        }

        return {
            totalExecutions,
            totalFailures,
            totalSkipped: 0, // Skipped jobs are not tracked in executions
            totalTimeouts,
            totalCancelled,
            averageDuration: stat.avgDuration
                ? Math.round(stat.avgDuration)
                : 0,
            minDuration: stat.minDuration || 0,
            maxDuration: stat.maxDuration || 0,
            recentExecutions: recentExecutions.slice(0, 10), // Last 10 executions
            performanceMetrics: {
                totalRecordsProcessed: stat.totalRecordsProcessed || 0,
                totalRecordsCreated: stat.totalRecordsCreated || 0,
                totalRecordsUpdated: stat.totalRecordsUpdated || 0,
                totalRecordsDeleted: stat.totalRecordsDeleted || 0,
            },
        };
    }

    /**
     * Find execution by correlation ID
     */
    static async findByCorrelationId(
        correlationId: string
    ): Promise<CronJobExecutionType[]> {
        // Ensure MongoDB connection
        await ensureMongoConnection();

        const executions =
            await CronJobExecution.findByCorrelationId(correlationId);
        return executions.map((exec) => this.mapToType(exec));
    }

    /**
     * Map MongoDB document to TypeScript interface
     */
    private static mapToType(exec: ICronJobExecution): CronJobExecutionType {
        return {
            _id: exec._id.toString(),
            jobId: exec.job_id,
            startedAt: exec.started_at,
            completedAt: exec.completed_at ?? undefined,
            // Use nullish coalescing to preserve 0 values (0 || undefined would convert 0 to undefined)
            durationSeconds: exec.duration_seconds ?? undefined,
            status: exec.status,
            errorMessage: exec.error_message ?? undefined,
            errorType: exec.error_type ?? undefined,
            recordsProcessed: exec.records_processed ?? undefined,
            recordsCreated: exec.records_created ?? undefined,
            recordsUpdated: exec.records_updated ?? undefined,
            recordsDeleted: exec.records_deleted ?? undefined,
            peakConnections: exec.peak_connections ?? undefined,
            timeoutPeriodSeconds: exec.timeout_period_seconds ?? undefined,
            correlationId: exec.correlation_id ?? undefined,
            performanceMetrics: exec.performance_metrics ?? undefined,
            created_at: exec.created_at,
            modified_at: exec.modified_at,
        };
    }
}
