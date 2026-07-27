export interface CronJobExecution {
    _id: string; // MongoDB ObjectId as string
    jobId: number;
    startedAt: Date;
    completedAt?: Date;
    durationSeconds?: number;
    status: "SUCCESS" | "FAILED" | "TIMEOUT" | "CANCELLED";
    errorMessage?: string;
    errorType?: string;
    recordsProcessed?: number;
    recordsCreated?: number;
    recordsUpdated?: number;
    recordsDeleted?: number;
    peakConnections?: number;
    timeoutPeriodSeconds?: number;
    correlationId?: string;
    performanceMetrics?: Record<string, any>;
    created_at: Date;
    modified_at?: Date; // Mongoose timestamps
}
