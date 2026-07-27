/**
 * Operation Dashboard Cache Service
 *
 * Manages pre-calculated operation dashboard data stored in the DashboardCache table.
 * Reduces database load by caching dashboard calculations for 10 minutes.
 * Uses "op_" prefix in cache keys to distinguish from financial dashboard cache.
 */

import { prisma } from "@/lib/prisma";
import { OperationDashboardResponse } from "@/types/OperationDashboard";
import { LogLevel } from "@/types/enums";
import { resolveCustomerFirstCurrency } from "@/utils/stringFormatters";

import { LogService } from "./LogService";

interface OperationCacheFilters {
    accountId: number;
    businessUnitId?: number | null;
    ownerId?: string | null;
    startDate: string; // ISO string
    endDate: string; // ISO string
    filterUserId?: string | null; // Filter by specific user ID
}

interface OperationCacheKeyComponents {
    accountId: number;
    businessUnitId: string; // "all" or number
    ownerId: string; // "all" or string
    startDate: string;
    endDate: string;
    filterUserId: string; // "all" or user ID
}

export class OperationDashboardCacheService {
    private static instance: OperationDashboardCacheService;
    private logService: LogService;
    private readonly CACHE_TTL_MINUTES = 10; // Shorter TTL for operation dashboard (more dynamic data)

    private constructor() {
        this.logService = LogService.getInstance();
    }

    public static getInstance(): OperationDashboardCacheService {
        if (!OperationDashboardCacheService.instance) {
            OperationDashboardCacheService.instance =
                new OperationDashboardCacheService();
        }
        return OperationDashboardCacheService.instance;
    }

    /**
     * Generate a unique cache key from filter parameters
     * Format: op_{accountId}_{businessUnitId}_{ownerId}_{startDate}_{endDate}_{filterUserId}
     * Dates are encoded as base64 to avoid issues with special characters
     */
    public generateCacheKey(filters: OperationCacheFilters): string {
        const businessUnitId = filters.businessUnitId?.toString() || "all";
        const ownerId = filters.ownerId || "all";
        const filterUserId = filters.filterUserId || "all";
        // Normalize dates to ISO strings and encode to base64 for safe key generation
        const startDate = Buffer.from(
            new Date(filters.startDate).toISOString()
        ).toString("base64");
        const endDate = Buffer.from(
            new Date(filters.endDate).toISOString()
        ).toString("base64");

        return `op_${filters.accountId}_${businessUnitId}_${ownerId}_${startDate}_${endDate}_${filterUserId}`;
    }

    /**
     * Parse cache key into components
     */
    private parseCacheKey(
        cacheKey: string
    ): OperationCacheKeyComponents | null {
        if (!cacheKey.startsWith("op_")) {
            return null;
        }

        const parts = cacheKey.substring(3).split("_"); // Remove "op_" prefix
        if (parts.length < 6) {
            return null;
        }

        const accountId = parseInt(parts[0], 10);
        if (isNaN(accountId)) {
            return null;
        }

        const businessUnitId = parts[1];
        const ownerId = parts[2];
        const startDateEncoded = parts[3];
        const endDateEncoded = parts[4];
        const filterUserId = parts.slice(5).join("_"); // Rest is filterUserId (in case it has underscores)

        // Decode dates from base64
        let startDate: string;
        let endDate: string;
        try {
            startDate = Buffer.from(startDateEncoded, "base64").toString();
            endDate = Buffer.from(endDateEncoded, "base64").toString();
        } catch (error) {
            // If decoding fails, return null
            return null;
        }

        return {
            accountId,
            businessUnitId,
            ownerId,
            startDate,
            endDate,
            filterUserId,
        };
    }

    /**
     * Get cached operation dashboard data if valid (not expired)
     */
    public async getCachedData(
        cacheKey: string
    ): Promise<OperationDashboardResponse | null> {
        const startTime = Date.now();

        try {
            const cached = await prisma.dashboardCache.findUnique({
                where: { cache_key: cacheKey },
            });

            if (!cached) {
                await this.logService.logMessage(
                    LogLevel.DEBUG,
                    "Operation dashboard cache miss",
                    "OperationDashboardCacheService",
                    { cacheKey }
                );
                return null;
            }

            // Check if cache is expired
            const now = new Date();
            if (cached.expires_at < now) {
                await this.logService.logMessage(
                    LogLevel.DEBUG,
                    "Operation dashboard cache expired",
                    "OperationDashboardCacheService",
                    {
                        cacheKey,
                        expiresAt: cached.expires_at,
                        now,
                    }
                );
                return null;
            }

            // Reconstruct operation dashboard response from cached data
            // All operation dashboard data is stored in chart_data JSON field
            const chartData = (cached.chart_data as any) || {};
            const operationData = chartData.operationDashboard || null;

            if (!operationData) {
                await this.logService.logMessage(
                    LogLevel.DEBUG,
                    "Operation dashboard cache missing data",
                    "OperationDashboardCacheService",
                    { cacheKey }
                );
                return null;
            }

            const dashboardData: OperationDashboardResponse = {
                aggregate: operationData.aggregate,
                agents: operationData.agents,
                currency: resolveCustomerFirstCurrency({
                    fallbackCurrency: operationData.currency,
                }),
                dateRange: operationData.dateRange,
                disputeTrend: operationData.disputeTrend,
            };

            const duration = Date.now() - startTime;
            const cacheAge = Math.floor(
                (now.getTime() - cached.last_calculated_at.getTime()) / 1000
            );

            await this.logService.logMessage(
                LogLevel.DEBUG,
                "Operation dashboard cache hit",
                "OperationDashboardCacheService",
                {
                    cacheKey,
                    cacheAge,
                    duration,
                    agentsCount: dashboardData.agents?.length || 0,
                }
            );

            return dashboardData;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "Failed to get cached operation dashboard data",
                "OperationDashboardCacheService",
                {
                    cacheKey,
                    error: error.message,
                    errorCode: error.code,
                    errorMeta: error.meta,
                    stack: error.stack,
                }
            );
            // Don't throw - return null to allow fallback to real-time calculation
            return null;
        }
    }

    /**
     * Store operation dashboard response in cache
     */
    public async setCachedData(
        cacheKey: string,
        dashboardData: OperationDashboardResponse,
        filters: OperationCacheFilters
    ): Promise<void> {
        const startTime = Date.now();

        try {
            const now = new Date();
            const expiresAt = new Date(
                now.getTime() + this.CACHE_TTL_MINUTES * 60 * 1000
            );

            // Store all operation dashboard data in chart_data JSON field
            // Use a nested structure to avoid conflicts with financial dashboard data
            const chartData = {
                operationDashboard: {
                    aggregate: dashboardData.aggregate,
                    agents: dashboardData.agents,
                    currency: dashboardData.currency,
                    dateRange: dashboardData.dateRange,
                    disputeTrend: dashboardData.disputeTrend,
                },
            };

            // Use JSON.stringify to ensure proper serialization
            const chartDataSerialized = JSON.parse(
                JSON.stringify(chartData, (key, value) => {
                    // Skip functions - they can't be serialized
                    if (typeof value === "function") {
                        return undefined;
                    }
                    // Convert Date objects to ISO strings
                    if (value instanceof Date) {
                        return value.toISOString();
                    }
                    return value;
                })
            );

            await prisma.dashboardCache.upsert({
                where: { cache_key: cacheKey },
                create: {
                    cache_key: cacheKey,
                    account_id: filters.accountId,
                    business_unit_id: filters.businessUnitId || null,
                    owner_id: filters.ownerId || null,
                    view_mode: "child", // Operation dashboard doesn't use view_mode, but field is required
                    // Scalar metrics are not used for operation dashboard, set to defaults
                    active_customers: 0,
                    overdue_amount: 0,
                    overdue_invoices: 0,
                    total_collected: 0,
                    total_due: 0,
                    due_today: 0,
                    due_this_week: 0,
                    due_this_month: 0,
                    due_next_month: 0,
                    chart_data: chartDataSerialized as any,
                    last_calculated_at: now,
                    expires_at: expiresAt,
                },
                update: {
                    chart_data: chartDataSerialized as any,
                    last_calculated_at: now,
                    expires_at: expiresAt,
                    modified_at: now,
                },
            });

            const duration = Date.now() - startTime;

            await this.logService.logMessage(
                LogLevel.INFO,
                "Operation dashboard cache stored",
                "OperationDashboardCacheService",
                {
                    cacheKey,
                    duration,
                    accountId: filters.accountId,
                    agentsCount: dashboardData.agents?.length || 0,
                    dateRange: dashboardData.dateRange,
                }
            );
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "Failed to store operation dashboard cache",
                "OperationDashboardCacheService",
                {
                    cacheKey,
                    accountId: filters.accountId,
                    error: error.message,
                    errorCode: error.code,
                    errorMeta: error.meta,
                    stack: error.stack,
                }
            );
            // Don't throw - cache storage failure shouldn't break dashboard
        }
    }

    /**
     * Invalidate cache entries for operation dashboard matching criteria
     */
    public async invalidateCache(
        accountId: number,
        businessUnitId?: number | null,
        ownerId?: string | null
    ): Promise<number> {
        try {
            // Delete all operation dashboard cache entries for this account
            // Operation dashboard cache keys start with "op_"
            const result = await prisma.dashboardCache.deleteMany({
                where: {
                    account_id: accountId,
                    cache_key: {
                        startsWith: "op_",
                    },
                    ...(businessUnitId !== undefined && {
                        business_unit_id: businessUnitId,
                    }),
                    ...(ownerId !== undefined && { owner_id: ownerId }),
                },
            });

            await this.logService.logMessage(
                LogLevel.INFO,
                "Operation dashboard cache invalidated",
                "OperationDashboardCacheService",
                {
                    accountId,
                    businessUnitId,
                    ownerId,
                    deletedCount: result.count,
                }
            );

            return result.count;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "Failed to invalidate operation dashboard cache",
                "OperationDashboardCacheService",
                {
                    accountId,
                    businessUnitId,
                    ownerId,
                    error: error.message,
                    errorCode: error.code,
                    errorMeta: error.meta,
                    stack: error.stack,
                }
            );
            return 0;
        }
    }

    /**
     * Cleanup expired operation dashboard cache entries
     */
    public async cleanupExpiredCache(): Promise<number> {
        try {
            const now = new Date();
            const result = await prisma.dashboardCache.deleteMany({
                where: {
                    cache_key: {
                        startsWith: "op_",
                    },
                    expires_at: {
                        lt: now,
                    },
                },
            });

            await this.logService.logMessage(
                LogLevel.INFO,
                "Expired operation dashboard cache cleaned up",
                "OperationDashboardCacheService",
                {
                    deletedCount: result.count,
                }
            );

            return result.count;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "Failed to cleanup expired operation dashboard cache",
                "OperationDashboardCacheService",
                {
                    error: error.message,
                    errorCode: error.code,
                    errorMeta: error.meta,
                    stack: error.stack,
                }
            );
            return 0;
        }
    }
}
