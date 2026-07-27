import mongoose, { Schema, Document, Model } from "mongoose";

// Execution status enum
export type ExecutionStatus = "SUCCESS" | "FAILED" | "TIMEOUT" | "CANCELLED";

// CronJobExecution document interface
export interface ICronJobExecution extends Document {
    _id: mongoose.Types.ObjectId;
    job_id: number;
    started_at: Date;
    completed_at?: Date;
    duration_seconds?: number;
    status: ExecutionStatus;
    error_message?: string;
    error_type?: string;
    records_processed?: number;
    records_created?: number;
    records_updated?: number;
    records_deleted?: number;
    peak_connections?: number;
    timeout_period_seconds?: number;
    correlation_id?: string;
    performance_metrics?: Record<string, any>;
    created_at: Date;
    modified_at: Date;
}

// CronJobExecution model interface with static methods
interface ICronJobExecutionModel extends Model<ICronJobExecution> {
    findByJobId(
        jobId: number,
        limit?: number,
        days?: number
    ): Promise<ICronJobExecution[]>;
    findByCorrelationId(correlationId: string): Promise<ICronJobExecution[]>;
    findByStatus(
        status: ExecutionStatus,
        limit?: number,
        days?: number
    ): Promise<ICronJobExecution[]>;
    getStats(jobId?: number, days?: number): Promise<any>;
    cleanupOldExecutions(
        retentionDays?: number
    ): Promise<{ deletedCount?: number }>;
}

// CronJobExecution schema definition
const CronJobExecutionSchema: Schema = new Schema(
    {
        job_id: {
            type: Number,
            required: true,
            index: true,
        },
        started_at: {
            type: Date,
            required: true,
            default: Date.now,
            // Index created below as part of TTL index
        },
        completed_at: {
            type: Date,
            default: null,
        },
        duration_seconds: {
            type: Number,
            default: null,
        },
        status: {
            type: String,
            required: true,
            enum: ["SUCCESS", "FAILED", "TIMEOUT", "CANCELLED"],
            index: true,
        },
        error_message: {
            type: String,
            default: null,
        },
        error_type: {
            type: String,
            default: null,
        },
        records_processed: {
            type: Number,
            default: 0,
        },
        records_created: {
            type: Number,
            default: 0,
        },
        records_updated: {
            type: Number,
            default: 0,
        },
        records_deleted: {
            type: Number,
            default: 0,
        },
        peak_connections: {
            type: Number,
            default: null,
        },
        timeout_period_seconds: {
            type: Number,
            default: null,
        },
        correlation_id: {
            type: String,
            index: true,
            sparse: true,
        },
        performance_metrics: {
            type: Schema.Types.Mixed,
            default: null,
        },
    },
    {
        timestamps: { created_at: 'created_at', modified_at: 'modified_at' } as any, // snake_case timestamp fields
        collection: "cron_job_executions", // Explicit collection name
    }
);

// Compound indexes for common query patterns
CronJobExecutionSchema.index({ job_id: 1, started_at: -1 });
CronJobExecutionSchema.index({ status: 1, started_at: -1 });
CronJobExecutionSchema.index({ correlation_id: 1, started_at: -1 });

// TTL index for automatic cleanup (90 days retention)
CronJobExecutionSchema.index(
    { started_at: 1 },
    {
        expireAfterSeconds: 90 * 24 * 60 * 60, // 7776000 seconds (90 days)
    }
);

// Static methods
CronJobExecutionSchema.statics.findByJobId = function (
    jobId: number,
    limit: number = 100,
    days?: number
) {
    const query: any = { job_id: jobId };

    if (days) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        query.started_at = { $gte: cutoffDate };
    }

    return this.find(query).sort({ started_at: -1 }).limit(limit);
};

CronJobExecutionSchema.statics.findByCorrelationId = function (
    correlationId: string
) {
    return this.find({ correlation_id: correlationId }).sort({ started_at: 1 });
};

CronJobExecutionSchema.statics.findByStatus = function (
    status: ExecutionStatus,
    limit: number = 100,
    days?: number
) {
    const query: any = { status };

    if (days) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        query.started_at = { $gte: cutoffDate };
    }

    return this.find(query).sort({ started_at: -1 }).limit(limit);
};

CronJobExecutionSchema.statics.getStats = function (
    jobId?: number,
    days: number = 30
) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const matchStage: any = {
        started_at: { $gte: cutoffDate },
    };

    if (jobId) {
        matchStage.job_id = jobId;
    }

    return this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: jobId ? null : "$job_id",
                totalExecutions: { $sum: 1 },
                successCount: {
                    $sum: { $cond: [{ $eq: ["$status", "SUCCESS"] }, 1, 0] },
                },
                failedCount: {
                    $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] },
                },
                timeoutCount: {
                    $sum: { $cond: [{ $eq: ["$status", "TIMEOUT"] }, 1, 0] },
                },
                cancelledCount: {
                    $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] },
                },
                avgDuration: { $avg: "$duration_seconds" },
                minDuration: { $min: "$duration_seconds" },
                maxDuration: { $max: "$duration_seconds" },
                totalRecordsProcessed: { $sum: "$records_processed" },
                totalRecordsCreated: { $sum: "$records_created" },
                totalRecordsUpdated: { $sum: "$records_updated" },
                totalRecordsDeleted: { $sum: "$records_deleted" },
            },
        },
    ]);
};

CronJobExecutionSchema.statics.cleanupOldExecutions = function (
    retentionDays: number = 365
) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    return this.deleteMany({
        started_at: { $lt: cutoffDate },
    });
};

// Pre-save middleware
CronJobExecutionSchema.pre<ICronJobExecution>(
    "save",
    function (this: ICronJobExecution, next: () => void) {
        // Ensure started_at is set if not provided
        if (!this.started_at) {
            this.started_at = new Date();
        }
        next();
    }
);

// Create and export the model
const CronJobExecution: ICronJobExecutionModel =
    (mongoose.models.CronJobExecution as ICronJobExecutionModel) ||
    mongoose.model<ICronJobExecution, ICronJobExecutionModel>(
        "CronJobExecution",
        CronJobExecutionSchema
    );

export default CronJobExecution;
