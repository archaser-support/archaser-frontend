/**
 * Logo Cache Service
 * 
 * Caches S3 presigned URLs to reduce latency and API calls.
 * URLs are cached for 50 minutes (10 minutes before 1-hour expiration).
 */

interface CachedLogo {
    url: string;
    timestamp: number;
    expiresAt: number;
}

class LogoCacheService {
    private cache = new Map<string, CachedLogo>();
    private readonly CACHE_DURATION = 50 * 60 * 1000; // 50 minutes in milliseconds
    private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes cleanup interval

    constructor() {
        // Start periodic cleanup of expired entries
        this.startCleanup();
    }

    /**
     * Get cached presigned URL for an S3 file path
     */
    getCachedUrl(s3Path: string): string | null {
        const cached = this.cache.get(s3Path);

        if (!cached) {
            return null;
        }

        // Check if cache entry is still valid
        if (Date.now() > cached.expiresAt) {
            this.cache.delete(s3Path);
            return null;
        }

        return cached.url;
    }

    /**
     * Cache a presigned URL for an S3 file path
     */
    setCachedUrl(s3Path: string, presignedUrl: string): void {
        const now = Date.now();
        const cached: CachedLogo = {
            url: presignedUrl,
            timestamp: now,
            expiresAt: now + this.CACHE_DURATION
        };

        this.cache.set(s3Path, cached);
    }

    /**
     * Check if a presigned URL is cached and still valid
     */
    isCached(s3Path: string): boolean {
        const cached = this.cache.get(s3Path);
        return cached ? Date.now() <= cached.expiresAt : false;
    }

    /**
     * Remove a specific cache entry
     */
    removeCached(s3Path: string): void {
        this.cache.delete(s3Path);
    }

    /**
     * Clear all cached entries
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { total: number; valid: number; expired: number } {
        const now = Date.now();
        let valid = 0;
        let expired = 0;

        this.cache.forEach((cached) => {
            if (now <= cached.expiresAt) {
                valid++;
            } else {
                expired++;
            }
        });

        return {
            total: this.cache.size,
            valid,
            expired
        };
    }

    /**
     * Start periodic cleanup of expired entries
     */
    private startCleanup(): void {
        setInterval(() => {
            this.cleanupExpired();
        }, this.CLEANUP_INTERVAL);
    }

    /**
     * Remove expired cache entries
     */
    private cleanupExpired(): void {
        const now = Date.now();
        const expiredKeys: string[] = [];

        this.cache.forEach((cached, key) => {
            if (now > cached.expiresAt) {
                expiredKeys.push(key);
            }
        });

        expiredKeys.forEach(key => this.cache.delete(key));

        // Cleaned up expired entries silently
    }
}

// Export singleton instance
export const logoCache = new LogoCacheService();

// Export types for external use
export type { CachedLogo };
