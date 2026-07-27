/**
 * Dashboard Cache Service
 *
 * Manages pre-calculated dashboard data stored in the DashboardCache table.
 * Reduces database load by caching dashboard calculations for 30 minutes.
 */

import { prisma } from "@/lib/prisma";
import { DashboardResponse } from "@/types/Dashboard";
import { LogLevel } from "@/types/enums";
import { resolveCustomerFirstCurrency } from "@/utils/stringFormatters";

import { LogService } from "./LogService";

interface CacheFilters {
    accountId: number;
    businessUnitId?: number | null;
    ownerId?: string | null;
    viewMode: "child" | "parent";
}

interface CacheKeyComponents {
    accountId: number;
    businessUnitId: string; // "all" or number
    ownerId: string; // "all" or string
    viewMode: "child" | "parent";
}

export class DashboardCacheService {
    private static instance: DashboardCacheService;
    private logService: LogService;
    private readonly CACHE_TTL_MINUTES = 30;

    private constructor() {
        this.logService = LogService.getInstance();
    }

    public static getInstance(): DashboardCacheService {
        if (!DashboardCacheService.instance) {
            DashboardCacheService.instance = new DashboardCacheService();
        }
        return DashboardCacheService.instance;
    }

    /**
     * Generate a unique cache key from filter parameters
     */
    public generateCacheKey(filters: CacheFilters): string {
        const businessUnitId = filters.businessUnitId?.toString() || "all";
        const ownerId = filters.ownerId || "all";
        return `${filters.accountId}_${businessUnitId}_${ownerId}_${filters.viewMode}`;
    }

    /**
     * Parse cache key into components
     */
    private parseCacheKey(cacheKey: string): CacheKeyComponents | null {
        const parts = cacheKey.split("_");
        if (parts.length < 4) {
            return null;
        }

        const accountId = parseInt(parts[0], 10);
        if (isNaN(accountId)) {
            return null;
        }

        return {
            accountId,
            businessUnitId: parts[1],
            ownerId: parts[2],
            viewMode: parts[3] as "child" | "parent",
        };
    }

    /**
     * Get cached dashboard data if valid (not expired)
     */
    public async getCachedData(
        cacheKey: string
    ): Promise<DashboardResponse | null> {
        const startTime = Date.now();

        try {
            const cached = await prisma.dashboardCache.findUnique({
                where: { cache_key: cacheKey },
            });

            if (!cached) {
                await this.logService.logMessage(
                    LogLevel.DEBUG,
                    "Dashboard cache miss",
                    "DashboardCacheService",
                    { cacheKey }
                );
                return null;
            }

            // Validate that cached viewMode matches the requested viewMode
            // This handles cases where old cache entries might not have viewMode in the key
            const parsedKey = this.parseCacheKey(cacheKey);
            if (parsedKey && cached.view_mode) {
                const requestedViewMode = parsedKey.viewMode;
                const cachedViewMode = cached.view_mode as "child" | "parent";
                if (requestedViewMode !== cachedViewMode) {
                    // Cache entry exists but viewMode doesn't match - treat as cache miss
                    await this.logService.logMessage(
                        LogLevel.DEBUG,
                        "Dashboard cache viewMode mismatch",
                        "DashboardCacheService",
                        {
                            cacheKey,
                            requestedViewMode,
                            cachedViewMode,
                        }
                    );
                    return null;
                }
            }

            // Check if cache is expired
            const now = new Date();
            if (cached.expires_at < now) {
                await this.logService.logMessage(
                    LogLevel.DEBUG,
                    "Dashboard cache expired",
                    "DashboardCacheService",
                    {
                        cacheKey,
                        expiresAt: cached.expires_at,
                        now,
                    }
                );
                return null;
            }

            // Reconstruct dashboard response from cached data
            const dashboardData: DashboardResponse = {
                activeCustomers: cached.active_customers,
                overdueAmount: cached.overdue_amount,
                overdueInvoices: cached.overdue_invoices,
                totalCollected: cached.total_collected,
                totalDue: cached.total_due,
                dueToday: cached.due_today,
                dueThisWeek: cached.due_this_week,
                dueThisMonth: cached.due_this_month,
                dueNextMonth: cached.due_next_month,
                receivablesMaturitySchedule:
                    (cached.receivables_schedule as any) || [],
                invoicesByCustomer: (cached.invoices_by_customer as any) || [],
                invoicesByBusinessUnit:
                    (cached.invoices_by_business_unit as any) || [],
                overdueInvoicesByCustomer:
                    (cached.overdue_invoices_by_customer as any) || [],
                overdueInvoicesByBusinessUnit:
                    (cached.overdue_invoices_by_business_unit as any) || [],
                audienceReport: (cached.chart_data as any)?.audienceReport || {
                    options: {},
                    series: [],
                },
                activeCustomersChart: (cached.chart_data as any)
                    ?.activeCustomersChart || {
                    options: {},
                    series: [],
                },
                agingPortfolio: (cached.aging_portfolio as any) || {
                    chartData: [],
                    details: [],
                },
                collectionStats: (cached.collection_stats as any) || [],
                lastSynced: cached.last_calculated_at.toISOString(),
                collectionEffortsPhase: (cached.chart_data as any)
                    ?.collectionEffortsPhase || {
                    options: {},
                    series: [],
                    stats: [],
                },
                automatedPhaseSplit: (cached.chart_data as any)
                    ?.automatedPhaseSplit || {
                    options: {},
                    series: [],
                },
                currency: resolveCustomerFirstCurrency({
                    fallbackCurrency: (cached.chart_data as any)?.currency,
                }),
                viewMode: cached.view_mode as "child" | "parent",
                hasChildBusinessUnits:
                    (cached.chart_data as any)?.hasChildBusinessUnits || false,
                fromCache: true,
                cacheAge: Math.floor(
                    (now.getTime() - cached.last_calculated_at.getTime()) / 1000
                ),
            };

            const duration = Date.now() - startTime;

            // Log collectionStats and agingPortfolio from cache for debugging
            const collectionStatsFromCache =
                dashboardData.collectionStats || [];
            const agingPortfolioFromCache = dashboardData.agingPortfolio || {
                chartData: [],
                details: [],
            };

            // Extract dispute and promise to pay stats from collectionStats
            const disputeStats = collectionStatsFromCache.find((stat: any) =>
                stat.label?.toLowerCase().includes("dispute")
            );
            const promiseStats = collectionStatsFromCache.find((stat: any) =>
                stat.label?.toLowerCase().includes("promise")
            );

            const logData = {
                cacheKey,
                duration,
                cacheAge: dashboardData.cacheAge,
                agingPortfolio: {
                    chartDataLength:
                        agingPortfolioFromCache.chartData?.length || 0,
                    detailsLength: agingPortfolioFromCache.details?.length || 0,
                    chartDataSample:
                        agingPortfolioFromCache.chartData?.slice(0, 2) || [],
                    fullChartData: agingPortfolioFromCache.chartData || [],
                },
                disputeStats: disputeStats
                    ? {
                          label: disputeStats.label,
                          customers: disputeStats.value?.[0]?.value,
                          invoices: disputeStats.value?.[1]?.value,
                          amount: disputeStats.value?.[2]?.value,
                          fullStat: disputeStats,
                      }
                    : null,
                promiseStats: promiseStats
                    ? {
                          label: promiseStats.label,
                          customers: promiseStats.value?.[0]?.value,
                          invoices: promiseStats.value?.[1]?.value,
                          amount: promiseStats.value?.[2]?.value,
                          fullStat: promiseStats,
                      }
                    : null,
                collectionStatsLength: collectionStatsFromCache.length,
                fullCollectionStats: collectionStatsFromCache,
            };

            await this.logService.logMessage(
                LogLevel.INFO,
                "Dashboard cache hit - Aging Portfolio & Dispute/Promise data",
                "DashboardCacheService",
                logData
            );

            return dashboardData;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "Failed to get cached dashboard data",
                "DashboardCacheService",
                {
                    cacheKey,
                    error: error.message,
                    stack: error.stack,
                }
            );
            // Don't throw - return null to allow fallback to real-time calculation
            return null;
        }
    }

    /**
     * Store dashboard response in cache
     */
    public async setCachedData(
        cacheKey: string,
        dashboardData: DashboardResponse,
        filters: CacheFilters
    ): Promise<void> {
        const startTime = Date.now();

        try {
            const now = new Date();
            const expiresAt = new Date(
                now.getTime() + this.CACHE_TTL_MINUTES * 60 * 1000
            );

            // Prepare chart data JSON - remove functions that can't be serialized
            // Use JSON.stringify with replacer for better performance than manual recursion
            // This is more efficient as it leverages native JSON serialization
            const chartDataRaw = {
                audienceReport: dashboardData.audienceReport,
                activeCustomersChart: dashboardData.activeCustomersChart,
                collectionEffortsPhase: dashboardData.collectionEffortsPhase,
                automatedPhaseSplit: dashboardData.automatedPhaseSplit,
                currency: dashboardData.currency,
                hasChildBusinessUnits: dashboardData.hasChildBusinessUnits,
            };

            // Use JSON.stringify with replacer to efficiently remove functions
            // This is faster than manual recursion and handles edge cases better
            const chartData = JSON.parse(
                JSON.stringify(chartDataRaw, (key, value) => {
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
                    view_mode: filters.viewMode,
                    active_customers: dashboardData.activeCustomers,
                    overdue_amount: dashboardData.overdueAmount,
                    overdue_invoices: dashboardData.overdueInvoices,
                    total_collected: dashboardData.totalCollected,
                    total_due: dashboardData.totalDue,
                    due_today: dashboardData.dueToday,
                    due_this_week: dashboardData.dueThisWeek,
                    due_this_month: dashboardData.dueThisMonth,
                    due_next_month: dashboardData.dueNextMonth,
                    collection_stats: dashboardData.collectionStats as any,
                    category_stats:
                        (dashboardData as any).categoryStats || null,
                    dispute_stats: (dashboardData as any).disputeStats || null,
                    chart_data: chartData as any,
                    aging_portfolio: dashboardData.agingPortfolio as any,
                    receivables_schedule:
                        dashboardData.receivablesMaturitySchedule as any,
                    invoices_by_customer:
                        dashboardData.invoicesByCustomer as any,
                    invoices_by_business_unit:
                        dashboardData.invoicesByBusinessUnit as any,
                    overdue_invoices_by_customer:
                        dashboardData.overdueInvoicesByCustomer as any,
                    overdue_invoices_by_business_unit:
                        dashboardData.overdueInvoicesByBusinessUnit as any,
                    last_calculated_at: now,
                    expires_at: expiresAt,
                },
                update: {
                    active_customers: dashboardData.activeCustomers,
                    overdue_amount: dashboardData.overdueAmount,
                    overdue_invoices: dashboardData.overdueInvoices,
                    total_collected: dashboardData.totalCollected,
                    total_due: dashboardData.totalDue,
                    due_today: dashboardData.dueToday,
                    due_this_week: dashboardData.dueThisWeek,
                    due_this_month: dashboardData.dueThisMonth,
                    due_next_month: dashboardData.dueNextMonth,
                    collection_stats: dashboardData.collectionStats as any,
                    category_stats:
                        (dashboardData as any).categoryStats || null,
                    dispute_stats: (dashboardData as any).disputeStats || null,
                    chart_data: chartData as any,
                    aging_portfolio: dashboardData.agingPortfolio as any,
                    receivables_schedule:
                        dashboardData.receivablesMaturitySchedule as any,
                    invoices_by_customer:
                        dashboardData.invoicesByCustomer as any,
                    invoices_by_business_unit:
                        dashboardData.invoicesByBusinessUnit as any,
                    overdue_invoices_by_customer:
                        dashboardData.overdueInvoicesByCustomer as any,
                    overdue_invoices_by_business_unit:
                        dashboardData.overdueInvoicesByBusinessUnit as any,
                    last_calculated_at: now,
                    expires_at: expiresAt,
                    modified_at: now,
                },
            });

            const duration = Date.now() - startTime;

            // Log collectionStats and agingPortfolio being stored for debugging
            const collectionStatsToStore = dashboardData.collectionStats || [];
            const agingPortfolioToStore = dashboardData.agingPortfolio || {
                chartData: [],
                details: [],
            };

            // Extract dispute and promise to pay stats from collectionStats
            const disputeStats = collectionStatsToStore.find((stat: any) =>
                stat.label?.toLowerCase().includes("dispute")
            );
            const promiseStats = collectionStatsToStore.find((stat: any) =>
                stat.label?.toLowerCase().includes("promise")
            );

            const logData = {
                cacheKey,
                duration,
                accountId: filters.accountId,
                agingPortfolio: {
                    chartDataLength:
                        agingPortfolioToStore.chartData?.length || 0,
                    detailsLength: agingPortfolioToStore.details?.length || 0,
                    chartDataSample:
                        agingPortfolioToStore.chartData?.slice(0, 2) || [],
                },
                disputeStats: disputeStats
                    ? {
                          label: disputeStats.label,
                          customers: disputeStats.value?.[0]?.value,
                          invoices: disputeStats.value?.[1]?.value,
                          amount: disputeStats.value?.[2]?.value,
                      }
                    : null,
                promiseStats: promiseStats
                    ? {
                          label: promiseStats.label,
                          customers: promiseStats.value?.[0]?.value,
                          invoices: promiseStats.value?.[1]?.value,
                          amount: promiseStats.value?.[2]?.value,
                      }
                    : null,
                collectionStatsLength: collectionStatsToStore.length,
            };

            await this.logService.logMessage(
                LogLevel.INFO,
                "Dashboard cache stored - Aging Portfolio & Dispute/Promise data",
                "DashboardCacheService",
                logData
            );
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "Failed to store dashboard cache",
                "DashboardCacheService",
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
     * Invalidate cache entries matching criteria
     */
    public async invalidateCache(
        accountId: number,
        businessUnitId?: number | null,
        ownerId?: string | null
    ): Promise<number> {
        try {
            const where: any = {
                account_id: accountId,
            };

            if (businessUnitId !== undefined) {
                where.business_unit_id = businessUnitId;
            }

            if (ownerId !== undefined) {
                where.owner_id = ownerId;
            }

            const result = await prisma.dashboardCache.deleteMany({
                where,
            });

            await this.logService.logMessage(
                LogLevel.INFO,
                "Dashboard cache invalidated",
                "DashboardCacheService",
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
                "Failed to invalidate dashboard cache",
                "DashboardCacheService",
                {
                    accountId,
                    businessUnitId,
                    ownerId,
                    error: error.message,
                    stack: error.stack,
                }
            );
            return 0;
        }
    }

    /**
     * Get expired cache keys that need refresh
     */
    public async getExpiredCacheKeys(): Promise<
        Array<{ cache_key: string; account_id: number }>
    > {
        try {
            const now = new Date();
            const expired = await prisma.dashboardCache.findMany({
                where: {
                    expires_at: {
                        lt: now,
                    },
                },
                select: {
                    cache_key: true,
                    account_id: true,
                },
            });

            return expired;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "Failed to get expired cache keys",
                "DashboardCacheService",
                {
                    error: error.message,
                    stack: error.stack,
                }
            );
            return [];
        }
    }

    /**
     * Cleanup expired cache entries
     */
    public async cleanupExpiredCache(): Promise<number> {
        try {
            const now = new Date();
            const result = await prisma.dashboardCache.deleteMany({
                where: {
                    expires_at: {
                        lt: now,
                    },
                },
            });

            await this.logService.logMessage(
                LogLevel.INFO,
                "Expired dashboard cache cleaned up",
                "DashboardCacheService",
                {
                    deletedCount: result.count,
                }
            );

            return result.count;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "Failed to cleanup expired cache",
                "DashboardCacheService",
                {
                    error: error.message,
                    stack: error.stack,
                }
            );
            return 0;
        }
    }

    /**
     * Refresh cache for a specific account and filters
     * This method calculates fresh dashboard data and stores it in cache
     */
    public async refreshCacheForAccount(
        filters: CacheFilters
    ): Promise<boolean> {
        try {
            // This will be called by the cron job
            // The actual calculation is done in the dashboard API handler
            // This method just marks the cache as needing refresh
            // The API handler will recalculate when cache is missing/expired

            await this.logService.logMessage(
                LogLevel.INFO,
                "Dashboard cache refresh requested",
                "DashboardCacheService",
                {
                    accountId: filters.accountId,
                    businessUnitId: filters.businessUnitId,
                    ownerId: filters.ownerId,
                    viewMode: filters.viewMode,
                }
            );

            // Delete existing cache to force refresh on next request
            await this.invalidateCache(
                filters.accountId,
                filters.businessUnitId,
                filters.ownerId
            );

            return true;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "Failed to refresh dashboard cache",
                "DashboardCacheService",
                {
                    accountId: filters.accountId,
                    error: error.message,
                    stack: error.stack,
                }
            );
            return false;
        }
    }
}
