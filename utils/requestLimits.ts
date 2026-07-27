/**
 * Request Limits Configuration
 *
 * Provides request size limits and timeout configuration
 */

import { NextApiRequest, NextApiResponse } from "next";

// Maximum request body size (default: 10MB)
export const MAX_REQUEST_BODY_SIZE =
    parseInt(process.env.MAX_REQUEST_BODY_SIZE || "10485760", 10) || 10485760; // 10MB

// Maximum request timeout (default: 30 seconds)
export const MAX_REQUEST_TIMEOUT_MS =
    parseInt(process.env.MAX_REQUEST_TIMEOUT_MS || "30000", 10) || 30000;

// Maximum query string length (default: 2048 characters)
export const MAX_QUERY_STRING_LENGTH =
    parseInt(process.env.MAX_QUERY_STRING_LENGTH || "2048", 10) || 2048;

/**
 * Check request size limits
 */
export function validateRequestSize(req: NextApiRequest): {
    valid: boolean;
    error?: string;
} {
    // Check Content-Length header
    const contentLength = req.headers["content-length"];
    if (contentLength) {
        const size = parseInt(contentLength, 10);
        if (!isNaN(size) && size > MAX_REQUEST_BODY_SIZE) {
            return {
                valid: false,
                error: `Request body too large. Maximum size is ${MAX_REQUEST_BODY_SIZE / 1024 / 1024}MB`,
            };
        }
    }

    // Check query string length
    const queryString = req.url?.split("?")[1] || "";
    if (queryString.length > MAX_QUERY_STRING_LENGTH) {
        return {
            valid: false,
            error: `Query string too long. Maximum length is ${MAX_QUERY_STRING_LENGTH} characters`,
        };
    }

    return { valid: true };
}

/**
 * Apply request timeout to handler
 */
export function withTimeout<T>(
    handler: (req: NextApiRequest, res: NextApiResponse) => Promise<T>,
    timeoutMs: number = MAX_REQUEST_TIMEOUT_MS
) {
    return async (
        req: NextApiRequest,
        res: NextApiResponse
    ): Promise<T | void> => {
        return Promise.race([
            handler(req, res),
            new Promise<void>((_, reject) => {
                setTimeout(() => {
                    if (!res.headersSent) {
                        res.status(408).json({
                            error: "Request timeout",
                            message: "The request took too long to process",
                        });
                    }
                    reject(new Error("Request timeout"));
                }, timeoutMs);
            }),
        ]) as Promise<T | void>;
    };
}

/**
 * Middleware to validate request size before processing
 */
export function validateRequestLimits(
    req: NextApiRequest,
    res: NextApiResponse
): boolean {
    const sizeCheck = validateRequestSize(req);
    if (!sizeCheck.valid) {
        res.status(413).json({
            error: "Request too large",
            message: sizeCheck.error,
        });
        return false;
    }
    return true;
}
