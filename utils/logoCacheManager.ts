/**
 * Logo Cache Manager
 * 
 * Utility functions for managing the logo cache.
 * Useful for debugging, monitoring, and manual cache control.
 */

import { logoCache } from './logoCache';

/**
 * Get detailed cache information
 */
export function getCacheInfo() {
    const stats = logoCache.getCacheStats();
    const now = Date.now();

    return {
        ...stats,
        cacheHitRate: stats.total > 0 ? (stats.valid / stats.total) * 100 : 0,
        timestamp: now,
        memoryUsage: {
            estimated: stats.total * 200, // Rough estimate: ~200 bytes per entry
            unit: 'bytes'
        }
    };
}

/**
 * Clear all cached logos
 */
export function clearAllLogos() {
    logoCache.clearCache();
}

/**
 * Clear expired logos only
 */
export function clearExpiredLogos() {
    // The cache service handles this automatically
    const stats = logoCache.getCacheStats();
    return stats.expired;
}

/**
 * Get cache entries for debugging
 */
export function getCacheEntries() {
    // Note: This would require exposing internal cache data
    // For now, we'll just return the stats
    return getCacheInfo();
}

/**
 * Preload a specific logo
 */
export async function preloadLogo(s3Path: string): Promise<boolean> {
    try {
        const { FileUploadServiceClient } = await import('@/lib/fileUploadServiceClient');

        if (!FileUploadServiceClient.isS3File(s3Path)) {
            return false;
        }

        if (logoCache.isCached(s3Path)) {
            return true;
        }

        const presignedUrl = await FileUploadServiceClient.getFileUrl(s3Path);
        logoCache.setCachedUrl(s3Path, presignedUrl);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Development helper: Log cache status
 */
export function logCacheStatus() {
    const info = getCacheInfo();
    // Cache status logging removed
}

// Development helper: Make cache manager available globally in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    (window as any).logoCacheManager = {
        getInfo: getCacheInfo,
        clearAll: clearAllLogos,
        clearExpired: clearExpiredLogos,
        preload: preloadLogo,
        log: logCacheStatus
    };
}
