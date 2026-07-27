/**
 * Rate Limiting Utility for Next.js API Routes
 *
 * Provides in-memory rate limiting (use Redis for production scaling)
 */

interface RateLimitStore {
    [key: string]: {
        count: number;
        resetTime: number;
    };
}

class RateLimiter {
    private store: RateLimitStore = {};
    private windowMs: number;
    private maxRequests: number;

    constructor(windowMs: number, maxRequests: number) {
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;

        // Clean up expired entries every minute
        setInterval(() => {
            this.cleanup();
        }, 60000);
    }

    private cleanup(): void {
        const now = Date.now();
        Object.keys(this.store).forEach((key) => {
            if (this.store[key].resetTime < now) {
                delete this.store[key];
            }
        });
    }

    private getKey(identifier: string): string {
        return identifier;
    }

    check(identifier: string): {
        allowed: boolean;
        remaining: number;
        resetTime: number;
    } {
        const key = this.getKey(identifier);
        const now = Date.now();

        // Clean up expired entry if exists
        if (this.store[key] && this.store[key].resetTime < now) {
            delete this.store[key];
        }

        // Initialize or get existing entry
        if (!this.store[key]) {
            this.store[key] = {
                count: 0,
                resetTime: now + this.windowMs,
            };
        }

        const entry = this.store[key];

        // Check if limit exceeded
        if (entry.count >= this.maxRequests) {
            return {
                allowed: false,
                remaining: 0,
                resetTime: entry.resetTime,
            };
        }

        // Increment count
        entry.count++;

        return {
            allowed: true,
            remaining: Math.max(0, this.maxRequests - entry.count),
            resetTime: entry.resetTime,
        };
    }

    reset(identifier: string): void {
        const key = this.getKey(identifier);
        delete this.store[key];
    }
}

// Create rate limiters with different configurations
const rateLimitWindowMs =
    parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10) || 900000; // 15 minutes default
const rateLimitMaxRequests =
    parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "1000", 10) || 1000;
const authRateLimitMaxRequests =
    parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || "10000", 10) || 10000;
const webhookRateLimitMaxRequests =
    parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX_REQUESTS || "1000", 10) || 1000;
const webhookRateLimitWindowMs =
    parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS || "3600000", 10) ||
    3600000; // 1 hour default

// General API rate limiter
export const generalRateLimiter = new RateLimiter(
    rateLimitWindowMs,
    rateLimitMaxRequests
);

// Stricter rate limiter for authentication endpoints
export const authRateLimiter = new RateLimiter(
    60000, // 1 minute window for stress testing
    authRateLimitMaxRequests
);

// Rate limiter for webhook endpoints
export const webhookRateLimiter = new RateLimiter(
    webhookRateLimitWindowMs,
    webhookRateLimitMaxRequests
);

/**
 * Get client identifier from request (IP address)
 */
export function getClientIdentifier(req: {
    headers: { [key: string]: string | string[] | undefined };
    socket?: { remoteAddress?: string };
}): string {
    // Try to get real IP from various headers (for proxies/load balancers)
    const forwardedFor = req.headers["x-forwarded-for"];
    const realIp = req.headers["x-real-ip"];
    const cfConnectingIp = req.headers["cf-connecting-ip"]; // Cloudflare

    let ip: string | undefined;

    if (typeof forwardedFor === "string") {
        ip = forwardedFor.split(",")[0].trim();
    } else if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
        ip = forwardedFor[0].split(",")[0].trim();
    } else if (typeof realIp === "string") {
        ip = realIp;
    } else if (typeof cfConnectingIp === "string") {
        ip = cfConnectingIp;
    } else if (req.socket?.remoteAddress) {
        ip = req.socket.remoteAddress;
    }

    return ip || "unknown";
}

/**
 * Rate limit middleware for Next.js API routes
 */
export function withRateLimit(
    limiter: RateLimiter,
    req: {
        headers: { [key: string]: string | string[] | undefined };
        socket?: { remoteAddress?: string };
    }
): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter: number;
} {
    const identifier = getClientIdentifier(req);
    const result = limiter.check(identifier);

    const retryAfter = result.resetTime
        ? Math.ceil((result.resetTime - Date.now()) / 1000)
        : 0;

    return {
        ...result,
        retryAfter: Math.max(0, retryAfter),
    };
}
