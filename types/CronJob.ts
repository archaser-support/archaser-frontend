import { CronJobExecution } from "./CronJobExecution";
import { Log } from "./Log";

export interface CronJob {
    id: number;
    created_at: Date;
    name: string;
    active?: boolean;
    cronExpression: string;
    cronExpressionText?: string; // Add this field
    lastRunAt?: Date;
    nextRunAt?: Date;
    timeoutPeriodSeconds?: number; // Timeout period in seconds, default 1800 seconds (30 minutes)
    lastExecutionDurationSeconds?: number;
    averageExecutionDurationSeconds?: number;
    minExecutionDurationSeconds?: number;
    maxExecutionDurationSeconds?: number;
    successCount30d?: number;
    failureCount30d?: number;
    timeoutCount30d?: number;
    lastSuccessAt?: Date;
    lastFailureAt?: Date;
    lastTimeoutAt?: Date;
    performanceBaselineSeconds?: number;
    performanceDegradationAlertSentAt?: Date;
    alertDurationThresholdSeconds?: number;
    alertFailureRateThreshold?: number;
    alertConnectionThreshold?: number;
    alertEnabled?: boolean;
    modifiedAt: Date;
    logs: Log[];
    executions?: CronJobExecution[];
}
