import { Types } from 'mongoose';

// Log levels enum
export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARNING = 'WARNING',
    ERROR = 'ERROR',
    CRITICAL = 'CRITICAL'
}

// MongoDB log document interface
export interface MongoLogDocument {
    _id?: Types.ObjectId;
    timestamp: Date;
    level: LogLevel;
    message: string;
    source: string;
    details?: any;
    account_id?: number;
    user_id?: number;
    job_id?: number;
    correlation_id?: string;
    sub_source?: string;
    // MongoDB-specific fields
    created_at?: Date;
    modified_at?: Date;
}

// Log creation interface (without MongoDB-specific fields)
export interface CreateLogData {
    timestamp?: Date;
    level: LogLevel;
    message: string;
    source: string;
    details?: any;
    account_id?: number;
    user_id?: number;
    job_id?: number;
    correlation_id?: string;
    sub_source?: string;
}

// Log query interface for filtering
export interface LogQuery {
    level?: LogLevel;
    source?: string;
    account_id?: number;
    user_id?: number;
    job_id?: number;
    correlation_id?: string;
    sub_source?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string; // Text search across message and source
}

// Log query options for pagination and sorting
export interface LogQueryOptions {
    page?: number;
    limit?: number;
    sortField?: string;
    sortDirection?: 'asc' | 'desc';
}

// Admin log query interface (extends LogQuery with admin-specific options)
export interface AdminLogQuery extends LogQuery {
    jobName?: string;
    userName?: string;
    customerName?: string;
}

// Log aggregation result interface for admin queries
export interface LogAggregationResult {
    _id: Types.ObjectId;
    timestamp: Date;
    level: LogLevel;
    message: string;
    source: string;
    details?: any;
    account_id?: number;
    user_id?: number;
    job_id?: number;
    correlation_id?: string;
    sub_source?: string;
    job_name?: string;
    user_name?: string;
    account_name?: string;
    created_at: Date;
    modified_at: Date;
}

// Batch log operation interface
export interface BatchLogOperation {
    insertOne?: {
        document: CreateLogData;
    };
    updateOne?: {
        filter: any;
        update: any;
        upsert?: boolean;
    };
    deleteOne?: {
        filter: any;
    };
}

// Log statistics interface
export interface LogStatistics {
    totalLogs: number;
    logsByLevel: Record<LogLevel, number>;
    logsBySource: Record<string, number>;
    logsByDate: Array<{
        date: string;
        count: number;
    }>;
    averageLogsPerDay: number;
    topSources: Array<{
        source: string;
        count: number;
    }>;
    topLevels: Array<{
        level: LogLevel;
        count: number;
    }>;
}

// Log cleanup result interface
export interface LogCleanupResult {
    deletedCount: number;
    cutoffDate: Date;
    levelsDeleted: Record<LogLevel, number>;
    sourcesDeleted: Record<string, number>;
}

// MongoDB collection indexes configuration
export interface LogIndexConfig {
    timestamp: 1;
    correlation_id: 1;
    account_id: 1;
    level: 1;
    source: 1;
    job_id: 1;
    user_id: 1;
    message: 'text';
    source_text: 'text';
}

// TTL index configuration for automatic cleanup
export interface TTLIndexConfig {
    field: string;
    expireAfterSeconds: number;
}

// Log search result interface
export interface LogSearchResult {
    logs: LogAggregationResult[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

// Log source statistics for admin dropdown
export interface LogSourceStats {
    source: string;
    count: number;
    lastUsed: Date;
}

// Log level statistics for admin filtering
export interface LogLevelStats {
    level: LogLevel;
    count: number;
    percentage: number;
}

// MongoDB connection health interface
export interface MongoConnectionHealth {
    isConnected: boolean;
    database: string;
    collection: string;
    lastPing: Date;
    connectionTime: number;
    error?: string;
}

// Log migration interface for PostgreSQL to MongoDB migration
export interface LogMigrationData {
    id: number;
    timestamp: Date;
    level: string;
    message: string;
    source: string;
    details?: any;
    account_id?: number;
    user_id?: number;
    job_id?: number;
    correlation_id?: string;
    sub_source?: string;
}

// Migration result interface
export interface LogMigrationResult {
    totalRecords: number;
    migratedRecords: number;
    failedRecords: number;
    errors: Array<{
        recordId: number;
        error: string;
    }>;
    startTime: Date;
    endTime: Date;
    duration: number;
}

// Export default log collection name
export const LOG_COLLECTION_NAME = 'logs';

// Export default TTL configuration (5 days in seconds)
export const DEFAULT_TTL_SECONDS = 5 * 24 * 60 * 60; // 432000 seconds
