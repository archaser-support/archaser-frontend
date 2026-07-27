import { PrismaClient } from "@prisma/client";

// Module types for different application contexts
type PrismaModule = "web" | "jobs" | "cron";

// Configuration for each PrismaClient instance
interface PrismaClientConfig {
    connectionLimit: number;
    applicationName: string;
    module: PrismaModule;
}

/**
 * Creates the modified_at auto-update extension.
 * Intercepts all update, updateMany, and upsert operations across every model
 * and stamps modified_at with the current timestamp.
 */
function withAutoTimestamp(client: PrismaClient) {
    return client.$extends({
        query: {
            $allModels: {
                async create({ args, query }: { args: any, query: (args: any) => Promise<any> }) {
                    if (args.data) {
                        const now = new Date();
                        if ("created_at" in args.data) {
                            args.data.created_at = now;
                        }
                    }
                    return query(args);
                },
                async createMany({ args, query }: { args: any, query: (args: any) => Promise<any> }) {
                    if (args.data) {
                        const now = new Date();
                        if (Array.isArray(args.data)) {
                            args.data.forEach((item: any) => {
                                if ("created_at" in item) {
                                    item.created_at = now;
                                }
                            });
                        } else {
                            if ("created_at" in args.data) {
                                args.data.created_at = now;
                            }
                        }
                    }
                    return query(args);
                },
                async update({ args, query }: { args: any, query: (args: any) => Promise<any> }) {
                    if (args.data) {
                        const now = new Date();
                        if ("modified_at" in args.data) {
                            args.data.modified_at = now;
                        }
                    }
                    return query(args);
                },
                async updateMany({ args, query }: { args: any, query: (args: any) => Promise<any> }) {
                    if (args.data) {
                        const now = new Date();
                        if ("modified_at" in args.data) {
                            args.data.modified_at = now;
                        }
                    }
                    return query(args);
                },
                async upsert({ args, query }: { args: any, query: (args: any) => Promise<any> }) {
                    const now = new Date();
                    // Stamp on the update side
                    if (args.update) {
                        if ("modified_at" in args.update) {
                            args.update.modified_at = now;
                        }
                    }
                    // Stamp on the create side
                    if (args.create) {
                        if ("created_at" in args.create) {
                            args.create.created_at = now;
                        }
                    }
                    return query(args);
                },
            },
        },
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExtendedPrismaClient = ReturnType<typeof withAutoTimestamp>;

// Extend the Node.js global type to include prisma instances
declare global {
    // eslint-disable-next-line no-var
    var prisma: ExtendedPrismaClient | undefined;
    // eslint-disable-next-line no-var
    var prismaInstances: Map<PrismaModule, ExtendedPrismaClient> | undefined;
}

// Global instances per module (singleton pattern)
const prismaInstances: Map<PrismaModule, ExtendedPrismaClient> =
    global.prismaInstances || new Map();

if (!global.prismaInstances) {
    global.prismaInstances = prismaInstances;
}

/**
 * Create a PrismaClient instance with module-specific configuration
 */
function createPrismaClient(config: PrismaClientConfig): ExtendedPrismaClient {
    // Use module-specific DATABASE_URL if available, otherwise fall back to default
    const dbUrl =
        process.env[`DATABASE_URL_${config.module.toUpperCase()}`] ||
        process.env.DATABASE_URL ||
        "";

    let modifiedDbUrl = dbUrl;
    try {
        const url = new URL(dbUrl);

        // Set application_name (overwrite if already present to ensure correct value)
        url.searchParams.set("application_name", config.applicationName);

        // Set connection_limit (overwrite if already present to ensure correct value)
        url.searchParams.set(
            "connection_limit",
            config.connectionLimit.toString()
        );

        // Set pool_timeout if not already present (default: 20 seconds)
        if (!url.searchParams.has("pool_timeout")) {
            url.searchParams.set("pool_timeout", "20");
        }

        // Add connection timeout for serverless environments
        if (!url.searchParams.has("connect_timeout")) {
            url.searchParams.set("connect_timeout", "10");
        }

        // Add statement timeout to prevent long-running queries from holding connections
        if (!url.searchParams.has("statement_timeout")) {
            // 30 seconds for cron, 10 seconds for web/jobs
            const statementTimeout =
                config.module === "cron" ? "30000" : "10000";
            url.searchParams.set("statement_timeout", statementTimeout);
        }

        // Close idle transactions to prevent connection leaks
        if (!url.searchParams.has("idle_in_transaction_session_timeout")) {
            url.searchParams.set(
                "idle_in_transaction_session_timeout",
                "30000"
            );
        }

        // Set session timezone to UTC for consistent date/timestamp comparisons
        // (e.g. DATE columns like generic_date1 with Prisma DateTime filters)
        const existingOptions = url.searchParams.get("options") || "";
        const timezoneOption = "-c timezone=UTC";
        url.searchParams.set(
            "options",
            existingOptions ? `${existingOptions} ${timezoneOption}` : timezoneOption
        );

        modifiedDbUrl = url.toString();
    } catch (error) {
        // If URL parsing fails, use original URL
        console.warn(
            `Failed to parse DATABASE_URL for ${config.module} module:`,
            error
        );
        modifiedDbUrl = dbUrl;
    }

    const baseClient = new PrismaClient({
        log: ["error"], // Only show errors for cleaner logs
        datasources: {
            db: {
                url: modifiedDbUrl,
            },
        },
        // Add error formatting for better debugging
        errorFormat: "pretty",
    });

    // Apply the global modified_at / modified_at auto-timestamp extension
    return withAutoTimestamp(baseClient);
}

/**
 * Get or create a PrismaClient instance for a specific module
 */
function getPrismaClient(module: PrismaModule = "web"): ExtendedPrismaClient {
    if (!prismaInstances.has(module)) {
        // Detect serverless environment (Vercel, AWS Lambda, etc.)
        const isServerless =
            process.env.VERCEL ||
            process.env.AWS_LAMBDA_FUNCTION_NAME ||
            process.env.SERVERLESS ||
            false;

        // In serverless, reduce connection limits since each function has its own pool
        // Default limits are already conservative, but can be overridden via env vars
        const connectionLimitWeb =
            parseInt(
                process.env.CONNECTION_LIMIT_WEB ||
                (isServerless ? "10" : "20"),
                10
            ) || (isServerless ? 10 : 20);
        const connectionLimitJobs =
            parseInt(
                process.env.CONNECTION_LIMIT_JOBS ||
                (isServerless ? "6" : "12"),
                10
            ) || (isServerless ? 6 : 12);
        const connectionLimitCron =
            parseInt(
                process.env.CONNECTION_LIMIT_CRON || (isServerless ? "3" : "7"),
                10
            ) || (isServerless ? 3 : 7);

        const configs: Record<PrismaModule, PrismaClientConfig> = {
            web: {
                connectionLimit: connectionLimitWeb,
                applicationName: "archaser-web",
                module: "web",
            },
            jobs: {
                connectionLimit: connectionLimitJobs,
                applicationName: "archaser-jobs",
                module: "jobs",
            },
            cron: {
                connectionLimit: connectionLimitCron,
                applicationName: "archaser-cron",
                module: "cron",
            },
        };

        const config = configs[module];
        const client = createPrismaClient(config);
        prismaInstances.set(module, client);
    }

    return prismaInstances.get(module)!;
}

/**
 * Validate that total connection limits do not exceed database max_connections
 * This is a safety check to prevent connection pool exhaustion
 */
function validateConnectionLimits(): void {
    // Detect serverless environment (same logic as getPrismaClient)
    const isServerless =
        process.env.VERCEL ||
        process.env.AWS_LAMBDA_FUNCTION_NAME ||
        process.env.SERVERLESS ||
        false;

    const connectionLimitWeb =
        parseInt(
            process.env.CONNECTION_LIMIT_WEB || (isServerless ? "10" : "20"),
            10
        ) || (isServerless ? 10 : 20);
    const connectionLimitJobs =
        parseInt(
            process.env.CONNECTION_LIMIT_JOBS || (isServerless ? "6" : "12"),
            10
        ) || (isServerless ? 6 : 12);
    const connectionLimitCron =
        parseInt(
            process.env.CONNECTION_LIMIT_CRON || (isServerless ? "3" : "7"),
            10
        ) || (isServerless ? 3 : 7);

    const totalConnections =
        connectionLimitWeb + connectionLimitJobs + connectionLimitCron;
    const maxTotalConnections =
        parseInt(process.env.MAX_TOTAL_CONNECTIONS || "50", 10) || 50;

    const usagePercent = (totalConnections / maxTotalConnections) * 100;

    if (totalConnections > maxTotalConnections) {
        console.error(
            `[Prisma Connection Limits] ERROR: Total connection limits (${totalConnections}) exceed MAX_TOTAL_CONNECTIONS (${maxTotalConnections}). This may cause connection pool exhaustion.`
        );
        console.error(
            `  Web: ${connectionLimitWeb}, Jobs: ${connectionLimitJobs}, Cron: ${connectionLimitCron}`
        );
        console.error(
            `  Recommendation: Reduce connection limits or increase MAX_TOTAL_CONNECTIONS`
        );
    } else if (usagePercent > 80) {
        console.warn(
            `[Prisma Connection Limits] WARNING: Total connection limits (${totalConnections}) are ${usagePercent.toFixed(1)}% of MAX_TOTAL_CONNECTIONS (${maxTotalConnections}). Consider reducing limits to leave room for other connections.`
        );
        console.warn(
            `  Web: ${connectionLimitWeb}, Jobs: ${connectionLimitJobs}, Cron: ${connectionLimitCron}`
        );
    }
}

// Validate connection limits on module initialization
validateConnectionLimits();

// Export module-specific client functions
export const prismaWeb = () => getPrismaClient("web");
export const prismaJobs = () => getPrismaClient("jobs");
export const prismaCron = () => getPrismaClient("cron");

// Export default prisma for backward compatibility (uses web client)
// This ensures existing code continues to work without changes
const prisma = global.prisma || prismaWeb();

if (!global.prisma) {
    global.prisma = prisma;
}

export { prisma };

// Shared DB client shape that both global prisma and transaction client satisfy.
// Avoids union call-signature incompatibilities between extended prisma and tx.
export type DbClient = Omit<
    typeof prisma,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// Let Prisma handle its own connection lifecycle
// Connection pooling is managed by the DATABASE_URL parameters
// Manual connection management was causing "Engine is not yet connected" errors
//
// Connection Pool Configuration:
// Each module has its own connection pool with separate limits:
// - Web: Default 20 connections (archaser-web)
// - Jobs/Import: Default 12 connections (archaser-jobs)
// - Cron: Default 7 connections (archaser-cron)
//
// Total default: 39 connections (should be < PostgreSQL max_connections)
//
// Configuration via environment variables:
// - CONNECTION_LIMIT_WEB=20
// - CONNECTION_LIMIT_JOBS=12
// - CONNECTION_LIMIT_CRON=7
// - MAX_TOTAL_CONNECTIONS=50 (for validation)
//
// Module-specific database URLs (optional):
// - DATABASE_URL_WEB="postgresql://..."
// - DATABASE_URL_JOBS="postgresql://..."
// - DATABASE_URL_CRON="postgresql://..."
