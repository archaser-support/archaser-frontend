import { prisma } from "@/lib/prisma";

export interface ConnectionPoolStatus {
    activeConnections: number;
    maxConnections: number;
    availableConnections: number;
    idleConnections: number;
    activeConnectionsByApp: Array<{ app: string; count: number }>;
}

/**
 * Get current connection pool status from PostgreSQL
 */
export async function getConnectionPoolStatus(): Promise<ConnectionPoolStatus | null> {
    try {
        // Get connection status by application name
        const statusByApp = await prisma.$queryRaw<
            Array<{
                application_name: string | null;
                count: bigint;
            }>
        >`
            SELECT 
                application_name,
                count(*)::bigint as count
            FROM pg_stat_activity
            WHERE datname = current_database()
            GROUP BY application_name
        `;

        // Get max connections setting
        const maxConnResult = await prisma.$queryRaw<
            Array<{ setting: string }>
        >`
            SELECT setting FROM pg_settings WHERE name = 'max_connections'
        `;

        const maxConnections = parseInt(maxConnResult[0]?.setting || "100", 10);

        // Get total active and idle connections
        const summary = await prisma.$queryRaw<
            Array<{
                total: bigint;
                active: bigint;
                idle: bigint;
            }>
        >`
            SELECT 
                count(*)::bigint as total,
                count(*) FILTER (WHERE state = 'active')::bigint as active,
                count(*) FILTER (WHERE state = 'idle')::bigint as idle
            FROM pg_stat_activity
            WHERE datname = current_database()
        `;

        if (summary.length === 0) {
            return null;
        }

        const stats = summary[0];
        const activeConnections = Number(stats.active);
        const idleConnections = Number(stats.idle);

        const activeConnectionsByApp = statusByApp
            .filter((row) => row.application_name)
            .map((row) => ({
                app: row.application_name || "unknown",
                count: Number(row.count),
            }));

        return {
            activeConnections,
            maxConnections,
            availableConnections: maxConnections - activeConnections,
            idleConnections,
            activeConnectionsByApp,
        };
    } catch (error) {
        console.error("Failed to get connection pool status:", error);
        return null;
    }
}

/**
 * Track peak connections over a time period
 * This is a helper that can be called periodically during job execution
 */
export async function trackPeakConnections(
    currentPeak: number
): Promise<number> {
    const status = await getConnectionPoolStatus();
    if (status && status.activeConnections > currentPeak) {
        return status.activeConnections;
    }
    return currentPeak;
}
