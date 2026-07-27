import mongoose from "mongoose";

import { ensureMongoConnection } from "../../lib/mongoose";
import Log, { ILog } from "../../models/Log";
import {
    CreateLogData,
    LogQuery,
    LogQueryOptions,
    AdminLogQuery,
    LogAggregationResult,
    LogStatistics,
    LogCleanupResult,
    LogSearchResult,
    LogSourceStats,
    LogLevelStats,
    MongoConnectionHealth,
    LogMigrationData,
    LogMigrationResult,
    LogLevel,
    LOG_COLLECTION_NAME,
    DEFAULT_TTL_SECONDS,
} from "../../types/MongoLog";
import { lokiTransportService } from "./LokiTransportService";

/**
 * MongoDB Logging Service
 *
 * This service handles all logging operations using MongoDB as the storage backend.
 * It provides the same interface as the existing LogService but uses MongoDB
 * for improved performance and scalability.
 */
export class MongoLogService {
    private collectionName: string;
    private ttlSeconds: number;

    constructor(
        collectionName: string = LOG_COLLECTION_NAME,
        ttlSeconds: number = DEFAULT_TTL_SECONDS
    ) {
        this.collectionName = collectionName;
        this.ttlSeconds = ttlSeconds;
    }

    /**
     * Ensure MongoDB connection is established before operations
     */
    private async ensureConnection(): Promise<void> {
        try {
            if (mongoose.connection.readyState !== 1) {
                await ensureMongoConnection();
            }
        } catch (error) {
            console.error("Failed to ensure MongoDB connection:", error);
            throw error;
        }
    }

    /**
     * Create a single log entry
     * Note: Errors are caught and logged but not thrown to prevent logging failures from crashing the application
     */
    async logMessage(
        logData: CreateLogData
    ): Promise<mongoose.Types.ObjectId | null> {
        // Send to Loki (fire-and-forget)
        lokiTransportService.sendLog(logData).catch(() => {
            // Error already handled/logged in service
        });

        // Skip MongoDB logging outside production (Nest local often has NODE_ENV unset)
        if (process.env.NODE_ENV !== "production") {
            return null;
        }

        try {
            await this.ensureConnection();

            const log = new Log({
                timestamp: logData.timestamp || new Date(),
                level: logData.level,
                message: logData.message,
                source: logData.source,
                details: logData.details,
                account_id: logData.account_id,
                user_id: logData.user_id,
                job_id: logData.job_id,
                correlation_id: logData.correlation_id,
                sub_source: logData.sub_source,
            });

            const savedLog = await log.save();
            return savedLog._id;
        } catch (error) {
            // Log error but don't throw - logging failures shouldn't crash the application
            console.error(
                "[MongoLogService] Failed to create log entry:",
                error instanceof Error ? error.message : error
            );
            return null; // Return null instead of throwing
        }
    }

    /**
     * Create multiple log entries in a single operation
     */
    async batchLog(
        logDataArray: CreateLogData[]
    ): Promise<mongoose.Types.ObjectId[]> {
        // Send to Loki (fire-and-forget)
        logDataArray.forEach((logData) => {
            lokiTransportService.sendLog(logData).catch(() => {
                // Error already handled/logged in service
            });
        });

        // Skip MongoDB logging outside production
        if (process.env.NODE_ENV !== "production") {
            return [];
        }

        try {
            await this.ensureConnection();

            const logs = logDataArray.map((logData) => ({
                timestamp: logData.timestamp || new Date(),
                level: logData.level,
                message: logData.message,
                source: logData.source,
                details: logData.details,
                account_id: logData.account_id,
                user_id: logData.user_id,
                job_id: logData.job_id,
                correlation_id: logData.correlation_id,
                sub_source: logData.sub_source,
            }));

            const result = await Log.insertMany(logs);
            return result.map((log: any) => log._id);
        } catch (error) {
            console.error("Failed to create batch log entries:", error);
            throw error;
        }
    }

    /**
     * Get logs by correlation ID
     */
    async getLogsByCorrelationId(correlationId: string): Promise<ILog[]> {
        // Skip MongoDB operations outside production
        if (process.env.NODE_ENV !== "production") {
            return [];
        }

        try {
            await this.ensureConnection();
            return await Log.findByCorrelationId(correlationId);
        } catch (error) {
            console.error("Failed to get logs by correlation ID:", error);
            throw error;
        }
    }

    /**
     * Get logs by customer ID
     */
    async getLogsByCustomer(
        accountId: number,
        limit: number = 100
    ): Promise<ILog[]> {
        // Skip MongoDB operations outside production
        if (process.env.NODE_ENV !== "production") {
            return [];
        }

        try {
            return await Log.findByCustomer(accountId, limit);
        } catch (error) {
            console.error("Failed to get logs by customer ID:", error);
            throw error;
        }
    }

    /**
     * Get logs for admin interface with advanced filtering and pagination
     */
    async getLogsForAdmin(
        query: AdminLogQuery,
        options: LogQueryOptions = {}
    ): Promise<LogSearchResult> {
        try {
            await this.ensureConnection();

            // Build filter
            const filter: any = {};

            if (query.level) filter.level = query.level;
            if (query.source) filter.source = query.source;
            if (query.account_id) filter.account_id = query.account_id;
            if (query.user_id) filter.user_id = query.user_id;
            if (query.job_id) filter.job_id = query.job_id;
            if (query.correlation_id)
                filter.correlation_id = query.correlation_id;
            if (query.sub_source) filter.sub_source = query.sub_source;

            if (query.startDate || query.endDate) {
                filter.timestamp = {};
                if (query.startDate) filter.timestamp.$gte = query.startDate;
                if (query.endDate) filter.timestamp.$lte = query.endDate;
            }

            // Text search
            if (query.search) {
                filter.$or = [
                    { message: { $regex: query.search, $options: "i" } },
                    { source: { $regex: query.search, $options: "i" } },
                    { correlation_id: { $regex: query.search, $options: "i" } },
                ];
            }

            // Pagination
            const page = options.page || 1;
            const limit = options.limit || 50;
            const skip = (page - 1) * limit;

            // Sorting
            const sortField = options.sortField || "timestamp";
            const sortDirection = options.sortDirection || "desc";
            const sort: any = {};
            sort[sortField] = sortDirection === "asc" ? 1 : -1;

            // Get total count
            const totalCount = await Log.countDocuments(filter);

            // Get logs with pagination
            const logs = await Log.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean();

            return {
                logs: logs as LogAggregationResult[],
                totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit),
                hasNextPage: page < Math.ceil(totalCount / limit),
                hasPreviousPage: page > 1,
            };
        } catch (error) {
            console.error("Failed to get logs for admin:", error);
            throw error;
        }
    }

    /**
     * Get unique log sources for admin dropdown
     */
    async getLogSources(): Promise<LogSourceStats[]> {
        try {
            const pipeline = [
                {
                    $group: {
                        _id: "$source",
                        count: { $sum: 1 },
                        lastUsed: { $max: "$timestamp" },
                    },
                },
                {
                    $sort: { count: -1 },
                } as any,
                {
                    $project: {
                        source: "$_id",
                        count: 1,
                        lastUsed: 1,
                        _id: 0,
                    },
                },
            ];

            return await Log.aggregate<LogSourceStats>(pipeline);
        } catch (error) {
            console.error("Failed to get log sources:", error);
            throw error;
        }
    }

    /**
     * Get log level statistics
     */
    async getLogLevelStats(): Promise<LogLevelStats[]> {
        try {
            const pipeline = [
                {
                    $group: {
                        _id: "$level",
                        count: { $sum: 1 },
                    },
                },
                {
                    $addFields: {
                        total: { $sum: "$count" },
                    },
                },
                {
                    $addFields: {
                        percentage: {
                            $multiply: [{ $divide: ["$count", "$total"] }, 100],
                        },
                    },
                },
                {
                    $sort: { count: -1 },
                } as any,
                {
                    $project: {
                        level: "$_id",
                        count: 1,
                        percentage: 1,
                        _id: 0,
                    },
                },
            ];

            return await Log.aggregate<LogLevelStats>(pipeline);
        } catch (error) {
            console.error("Failed to get log level stats:", error);
            throw error;
        }
    }

    /**
     * Clean up old logs based on retention policy
     */
    async cleanupOldLogs(retentionDays: number = 5): Promise<LogCleanupResult> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

            // Get statistics before deletion
            const statsBefore = await Log.aggregate([
                { $match: { timestamp: { $lt: cutoffDate } } },
                {
                    $group: {
                        _id: null,
                        totalCount: { $sum: 1 },
                        levelsDeleted: {
                            $push: {
                                level: "$level",
                                count: 1,
                            },
                        },
                        sourcesDeleted: {
                            $push: {
                                source: "$source",
                                count: 1,
                            },
                        },
                    },
                },
            ]);

            // Delete old logs using the static method
            const deleteResult = await Log.cleanupOldLogs(retentionDays);

            // Process statistics
            const levelsDeleted: Record<LogLevel, number> = {} as Record<
                LogLevel,
                number
            >;
            const sourcesDeleted: Record<string, number> = {};

            if (statsBefore.length > 0) {
                const stats = statsBefore[0];
                stats.levelsDeleted?.forEach((item: any) => {
                    const level = item.level as LogLevel;
                    levelsDeleted[level] =
                        (levelsDeleted[level] || 0) + item.count;
                });
                stats.sourcesDeleted?.forEach((item: any) => {
                    sourcesDeleted[item.source] =
                        (sourcesDeleted[item.source] || 0) + item.count;
                });
            }

            return {
                deletedCount: deleteResult.deletedCount || 0,
                cutoffDate,
                levelsDeleted,
                sourcesDeleted,
            };
        } catch (error) {
            console.error("Failed to cleanup old logs:", error);
            throw error;
        }
    }

    /**
     * Clean up old logs with selective retention for ImportJob logs
     * Regular logs: deleted after retentionDays
     * ImportJob logs: deleted after importJobRetentionDays
     */
    async cleanupOldLogsSelective(
        retentionDays: number = 5,
        importJobRetentionDays: number = 15
    ): Promise<{
        regularLogsDeleted: number;
        importJobLogsDeleted: number;
        regularLogsCutoffDate: Date;
        importJobLogsCutoffDate: Date;
    }> {
        try {
            const regularLogsCutoffDate = new Date();
            regularLogsCutoffDate.setDate(
                regularLogsCutoffDate.getDate() - retentionDays
            );

            const importJobLogsCutoffDate = new Date();
            importJobLogsCutoffDate.setDate(
                importJobLogsCutoffDate.getDate() - importJobRetentionDays
            );

            // Delete regular logs (older than retentionDays, excluding ImportJob logs)
            // ImportJob logs are identified by source containing 'Import' keywords
            const regularLogsResult = await Log.deleteMany({
                timestamp: { $lt: regularLogsCutoffDate },
                source: {
                    $not: {
                        $regex: /import/i,
                    },
                },
            });

            // Delete ImportJob logs (older than importJobRetentionDays)
            const importJobLogsResult = await Log.deleteMany({
                timestamp: { $lt: importJobLogsCutoffDate },
                source: {
                    $regex: /import/i,
                },
            });

            return {
                regularLogsDeleted: regularLogsResult.deletedCount || 0,
                importJobLogsDeleted: importJobLogsResult.deletedCount || 0,
                regularLogsCutoffDate,
                importJobLogsCutoffDate,
            };
        } catch (error) {
            console.error(
                "Failed to cleanup old logs with selective retention:",
                error
            );
            throw error;
        }
    }

    /**
     * Get log statistics
     */
    async getLogStatistics(): Promise<LogStatistics> {
        try {
            const pipeline = [
                {
                    $group: {
                        _id: null,
                        totalLogs: { $sum: 1 },
                        logsByLevel: {
                            $push: {
                                level: "$level",
                                count: 1,
                            },
                        },
                        logsBySource: {
                            $push: {
                                source: "$source",
                                count: 1,
                            },
                        },
                        logsByDate: {
                            $push: {
                                date: {
                                    $dateToString: {
                                        format: "%Y-%m-%d",
                                        date: "$timestamp",
                                    },
                                },
                                count: 1,
                            },
                        },
                    },
                },
            ];

            const result = await Log.aggregate(pipeline);

            if (result.length === 0) {
                return {
                    totalLogs: 0,
                    logsByLevel: {} as Record<LogLevel, number>,
                    logsBySource: {},
                    logsByDate: [],
                    averageLogsPerDay: 0,
                    topSources: [],
                    topLevels: [],
                };
            }

            const stats = result[0];

            // Process logs by level
            const logsByLevel: Record<LogLevel, number> = {} as Record<
                LogLevel,
                number
            >;
            stats.logsByLevel?.forEach((item: any) => {
                const level = item.level as LogLevel;
                logsByLevel[level] = (logsByLevel[level] || 0) + item.count;
            });

            // Process logs by source
            const logsBySource: Record<string, number> = {};
            stats.logsBySource?.forEach((item: any) => {
                logsBySource[item.source] =
                    (logsBySource[item.source] || 0) + item.count;
            });

            // Process logs by date
            const logsByDate: Record<string, number> = {};
            stats.logsByDate?.forEach((item: any) => {
                logsByDate[item.date] =
                    (logsByDate[item.date] || 0) + item.count;
            });

            const logsByDateArray = Object.entries(logsByDate).map(
                ([date, count]) => ({
                    date,
                    count,
                })
            );

            // Calculate top sources and levels
            const topSources = Object.entries(logsBySource)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([source, count]) => ({ source, count }));

            const topLevels = Object.entries(logsByLevel)
                .sort(([, a], [, b]) => b - a)
                .map(([level, count]) => ({ level: level as LogLevel, count }));

            const averageLogsPerDay =
                logsByDateArray.length > 0
                    ? logsByDateArray.reduce(
                          (sum, item) => sum + item.count,
                          0
                      ) / logsByDateArray.length
                    : 0;

            return {
                totalLogs: stats.totalLogs,
                logsByLevel,
                logsBySource,
                logsByDate: logsByDateArray,
                averageLogsPerDay,
                topSources,
                topLevels,
            };
        } catch (error) {
            console.error("Failed to get log statistics:", error);
            throw error;
        }
    }

    /**
     * Check MongoDB connection health
     */
    async checkConnectionHealth(): Promise<MongoConnectionHealth> {
        const startTime = Date.now();

        try {
            const isHealthy = mongoose.connection.readyState === 1;
            const connectionTime = Date.now() - startTime;

            return {
                isConnected: isHealthy,
                database: process.env.MONGODB_DATABASE || "archaser",
                collection: this.collectionName,
                lastPing: new Date(),
                connectionTime,
            };
        } catch (error) {
            return {
                isConnected: false,
                database: process.env.MONGODB_DATABASE || "archaser",
                collection: this.collectionName,
                lastPing: new Date(),
                connectionTime: Date.now() - startTime,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }

    /**
     * Create MongoDB indexes for optimal performance
     */
    async createIndexes(): Promise<void> {
        try {
            // Mongoose will automatically create indexes defined in the schema
            // Additional indexes can be created using ensureIndexes()
            await Log.ensureIndexes();
        } catch (error) {
            console.error("Failed to create MongoDB indexes:", error);
            throw error;
        }
    }

    /**
     * Drop all indexes (use with caution)
     */
    async dropIndexes(): Promise<void> {
        try {
            await Log.collection.dropIndexes();
        } catch (error) {
            console.error("Failed to drop MongoDB indexes:", error);
            throw error;
        }
    }
}

// Export singleton instance
export const mongoLogService = new MongoLogService();
export default mongoLogService;
