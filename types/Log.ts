import { Account } from "./Account";
import { CronJob } from "./CronJob";
import { Customer } from "./Customer";
import { LogLevel } from "./enums";
import { User } from "./User";

export interface Log {
    id: bigint;
    timestamp: Date;
    level: LogLevel;
    message: string;
    source: string;
    details?: Record<string, any>;
    accountId?: number;
    userId?: string;
    jobId?: number;
    customer?: Account;
    cronJob?: CronJob;
    user?: User;
}
