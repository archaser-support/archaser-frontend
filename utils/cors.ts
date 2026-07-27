/**
 * CORS Utility for Next.js API Routes
 *
 * Provides CORS header management with origin whitelist validation
 */

import { NextApiRequest, NextApiResponse } from "next";

/**
 * Get allowed origins from environment variable
 */
function getAllowedOrigins(): string[] {
    const originsEnv = process.env.CORS_ALLOWED_ORIGINS;
    const isDevelopment = process.env.NODE_ENV === "development";

    if (originsEnv) {
        return originsEnv.split(",").map((origin) => origin.trim());
    }

    // Default origins
    const defaultOrigins = isDevelopment
        ? ["http://localhost:3000", "http://localhost:3001"]
        : [];

    return defaultOrigins;
}

/**
 * Check if origin is allowed
 */
export function isOriginAllowed(origin: string | undefined): boolean {
    if (!origin) {
        return false;
    }

    const allowedOrigins = getAllowedOrigins();
    return allowedOrigins.includes(origin);
}

/**
 * Get CORS headers for a request
 */
export function getCorsHeaders(
    req: NextApiRequest,
    additionalHeaders: Record<string, string> = {}
): Record<string, string> {
    const origin = req.headers.origin;
    const isAllowed = isOriginAllowed(origin);

    const headers: Record<string, string> = {
        ...additionalHeaders,
    };

    if (isAllowed && origin) {
        headers["Access-Control-Allow-Origin"] = origin;
        headers["Access-Control-Allow-Credentials"] = "true";
    } else {
        // In development, allow localhost
        if (process.env.NODE_ENV === "development") {
            headers["Access-Control-Allow-Origin"] = origin || "*";
        }
    }

    return headers;
}

/**
 * Handle CORS preflight request
 */
export function handleCorsPreflight(
    req: NextApiRequest,
    res: NextApiResponse
): boolean {
    if (req.method === "OPTIONS") {
        const origin = req.headers.origin;
        const isAllowed = isOriginAllowed(origin);

        if (isAllowed && origin) {
            res.setHeader("Access-Control-Allow-Origin", origin);
            res.setHeader("Access-Control-Allow-Credentials", "true");
        } else if (process.env.NODE_ENV === "development") {
            res.setHeader("Access-Control-Allow-Origin", origin || "*");
        }

        res.setHeader(
            "Access-Control-Allow-Methods",
            "GET, POST, PUT, DELETE, OPTIONS"
        );
        res.setHeader(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization, X-CSRF-Token, X-Requested-With"
        );
        res.setHeader("Access-Control-Max-Age", "86400"); // 24 hours

        res.status(200).end();
        return true; // Request handled
    }

    return false; // Not a preflight request
}

/**
 * Apply CORS headers to response
 */
export function applyCorsHeaders(
    req: NextApiRequest,
    res: NextApiResponse,
    additionalHeaders: Record<string, string> = {}
): void {
    const corsHeaders = getCorsHeaders(req, additionalHeaders);
    Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
    });
}
