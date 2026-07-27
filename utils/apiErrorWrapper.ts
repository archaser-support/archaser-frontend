/**
 * API Error Wrapper
 *
 * Wraps API handlers to catch all errors and prevent server crashes.
 * This ensures individual request failures don't bring down the whole server.
 */

import { NextApiRequest, NextApiResponse } from "next";

type ApiHandler = (
    req: NextApiRequest,
    res: NextApiResponse
) => Promise<void | NextApiResponse>;

/**
 * Wraps an API handler with comprehensive error handling
 * to prevent crashes from unhandled exceptions.
 */
export function withErrorBoundary(handler: ApiHandler): ApiHandler {
    return async (req: NextApiRequest, res: NextApiResponse) => {
        try {
            return await handler(req, res);
        } catch (error: any) {
            // Log the error with context
            console.error(`[API ERROR] ${req.method} ${req.url}:`, {
                timestamp: new Date().toISOString(),
                error: error?.message || String(error),
                stack: error?.stack,
                query: req.query,
                // Don't log full body to avoid sensitive data exposure
                hasBody: !!req.body,
            });

            // Check if response has already been sent
            if (res.headersSent) {
                console.error(
                    "[API ERROR] Response already sent, cannot send error response"
                );
                return;
            }

            // Determine appropriate error response
            const statusCode = error?.statusCode || error?.status || 500;
            const message =
                process.env.NODE_ENV === "production"
                    ? "Internal Server Error"
                    : error?.message || "An unexpected error occurred";

            return res.status(statusCode).json({
                error: message,
                timestamp: new Date().toISOString(),
            });
        }
    };
}

/**
 * Wraps an async API handler with timeout protection
 * to prevent hanging requests from consuming resources.
 */
export function withTimeout(
    handler: ApiHandler,
    timeoutMs: number = 30000
): ApiHandler {
    return async (req: NextApiRequest, res: NextApiResponse) => {
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Request timeout after ${timeoutMs}ms`));
            }, timeoutMs);
        });

        try {
            return await Promise.race([handler(req, res), timeoutPromise]);
        } catch (error: any) {
            if (error.message?.includes("timeout")) {
                console.error(`[API TIMEOUT] ${req.method} ${req.url}`);
                if (!res.headersSent) {
                    return res.status(504).json({
                        error: "Request timeout",
                        timestamp: new Date().toISOString(),
                    });
                }
            }
            throw error;
        }
    };
}

/**
 * Combined wrapper with both error boundary and timeout
 */
export function withSafeHandler(
    handler: ApiHandler,
    timeoutMs: number = 30000
): ApiHandler {
    return withErrorBoundary(withTimeout(handler, timeoutMs));
}
