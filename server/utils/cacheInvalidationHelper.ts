/**
 * Cache Invalidation Helper
 *
 * Centralized functions for invalidating dashboard cache (database table cache).
 * Use these functions in all data update points to ensure cache consistency.
 */

import { DashboardCacheService } from "@/server/services/DashboardCacheService";
import { OperationDashboardCacheService } from "@/server/services/OperationDashboardCacheService";

/**
 * Invalidate dashboard cache for a single account
 * Invalidates database table cache
 */
export async function invalidateDashboardCacheForAccount(
    accountId: number
): Promise<void> {
    try {
        // Invalidate table cache
        const cacheService = DashboardCacheService.getInstance();
        await cacheService.invalidateCache(accountId);
    } catch (error: any) {
        // Don't throw - cache invalidation failure shouldn't break operations
        console.error(
            `[CACHE INVALIDATION] Failed to invalidate dashboard cache for account ${accountId}:`,
            error.message,
            error.stack
        );
    }
}

/**
 * Invalidate dashboard cache for multiple accounts (batch operation)
 * Invalidates database table cache
 */
export async function invalidateDashboardCacheForAccounts(
    accountIds: number[]
): Promise<void> {
    if (accountIds.length === 0) {
        return;
    }

    try {
        // Invalidate table cache for all accounts
        const cacheService = DashboardCacheService.getInstance();
        const uniqueAccountIds = Array.from(new Set(accountIds));

        // Delete cache entries for all unique account IDs
        await Promise.all(
            uniqueAccountIds.map((accountId) =>
                cacheService.invalidateCache(accountId)
            )
        );
    } catch (error: any) {
        // Don't throw - cache invalidation failure shouldn't break operations
        console.error(
            `[CACHE] Failed to invalidate dashboard cache for accounts:`,
            error.message
        );
    }
}

/**
 * Invalidate dashboard cache for a specific account with filters
 * Useful when you know the specific business unit or owner that changed
 */
export async function invalidateDashboardCacheForAccountWithFilters(
    accountId: number,
    businessUnitId?: number | null,
    ownerId?: string | null
): Promise<void> {
    try {
        // Invalidate table cache with specific filters
        const cacheService = DashboardCacheService.getInstance();
        await cacheService.invalidateCache(accountId, businessUnitId, ownerId);
    } catch (error: any) {
        // Don't throw - cache invalidation failure shouldn't break operations
        console.error(
            `[CACHE] Failed to invalidate dashboard cache for account ${accountId}:`,
            error.message
        );
    }
}

/**
 * Invalidate operation dashboard cache for a single account
 * Invalidates database table cache for operation dashboard
 */
export async function invalidateOperationDashboardCacheForAccount(
    accountId: number
): Promise<void> {
    try {
        // Invalidate table cache
        const cacheService = OperationDashboardCacheService.getInstance();
        await cacheService.invalidateCache(accountId);
    } catch (error: any) {
        // Don't throw - cache invalidation failure shouldn't break operations
        console.error(
            `[CACHE INVALIDATION] Failed to invalidate operation dashboard cache for account ${accountId}:`,
            error.message,
            error.stack
        );
    }
}

/**
 * Invalidate operation dashboard cache for a specific account with filters
 * Useful when you know the specific business unit or owner that changed
 */
export async function invalidateOperationDashboardCacheForAccountWithFilters(
    accountId: number,
    businessUnitId?: number | null,
    ownerId?: string | null
): Promise<void> {
    try {
        // Invalidate table cache with specific filters
        const cacheService = OperationDashboardCacheService.getInstance();
        await cacheService.invalidateCache(accountId, businessUnitId, ownerId);
    } catch (error: any) {
        // Don't throw - cache invalidation failure shouldn't break operations
        console.error(
            `[CACHE] Failed to invalidate operation dashboard cache for account ${accountId}:`,
            error.message
        );
    }
}
