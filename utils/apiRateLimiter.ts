/**
 * API Rate Limiter Wrapper for Next.js API Routes
 *
 * Provides a wrapper function to apply rate limiting to API route handlers
 */

import { NextApiRequest, NextApiResponse } from "next";

import {
    authRateLimiter,
    generalRateLimiter,
    webhookRateLimiter,
    withRateLimit,
} from "./rateLimiter";

export type RateLimitType = "general" | "auth" | "webhook";

/**
 * Wrapper function to apply rate limiting to API route handlers
 */
export function rateLimit(
    handler: (
        req: NextApiRequest,
        res: NextApiResponse
    ) => Promise<void | NextApiResponse>,
    type: RateLimitType = "general"
) {
    return async (req: NextApiRequest, res: NextApiResponse) => {
        // Select appropriate rate limiter
        const limiter =
            type === "auth"
                ? authRateLimiter
                : type === "webhook"
                  ? webhookRateLimiter
                  : generalRateLimiter;

        // Apply rate limiting
        const rateLimitResult = withRateLimit(limiter, req);

        // Set rate limit headers
        res.setHeader("X-RateLimit-Limit", limiter["maxRequests"]);
        res.setHeader("X-RateLimit-Remaining", rateLimitResult.remaining);
        res.setHeader(
            "X-RateLimit-Reset",
            new Date(rateLimitResult.resetTime).toISOString()
        );

        // Check if request is allowed
        if (!rateLimitResult.allowed) {
            res.setHeader("Retry-After", rateLimitResult.retryAfter);
            return res.status(429).json({
                error: "Too many requests",
                message: "Rate limit exceeded. Please try again later.",
                retryAfter: rateLimitResult.retryAfter,
            });
        }

        // Call the actual handler
        return handler(req, res);
    };
}

/**
 * Rate limit decorator for authentication endpoints
 */
export function withAuthRateLimit(
    handler: (
        req: NextApiRequest,
        res: NextApiResponse
    ) => Promise<void | NextApiResponse>
) {
    return rateLimit(handler, "auth");
}

/**
 * Rate limit decorator for webhook endpoints
 */
export function withWebhookRateLimit(
    handler: (
        req: NextApiRequest,
        res: NextApiResponse
    ) => Promise<void | NextApiResponse>
) {
    return rateLimit(handler, "webhook");
}
