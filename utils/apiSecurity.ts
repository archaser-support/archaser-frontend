/**
 * API Security Utilities
 *
 * Provides comprehensive security wrappers for API routes
 */

import { NextApiRequest, NextApiResponse } from "next";

import { rateLimit, RateLimitType } from "./apiRateLimiter";
import { validateRequestLimits, withTimeout } from "./requestLimits";
import {
    validateRequestBody,
    validateQueryParams,
    ValidationSchema,
} from "./inputValidator";
import { isSuspiciousPayload } from "./payloadScanner";

export interface SecurityOptions {
    rateLimitType?: RateLimitType;
    requireAuth?: boolean;
    validateBody?: ValidationSchema;
    validateQuery?: ValidationSchema;
    timeout?: number;
    maxBodySize?: number;
}

/**
 * Comprehensive security wrapper for API routes
 */
export function withSecurity(
    handler: (
        req: NextApiRequest,
        res: NextApiResponse
    ) => Promise<void | NextApiResponse>,
    options: SecurityOptions = {}
) {
    const {
        rateLimitType = "general",
        requireAuth = true,
        validateBody,
        validateQuery,
        timeout,
    } = options;

    // Apply timeout if specified
    let securedHandler = timeout ? withTimeout(handler, timeout) : handler;

    // Add request size validation
    const sizeValidatedHandler = async (
        req: NextApiRequest,
        res: NextApiResponse
    ) => {
        if (!validateRequestLimits(req, res)) {
            return;
        }

        // Global security scan for all inputs (query, body)
        if (isSuspiciousPayload(req.query) || (req.body && isSuspiciousPayload(req.body))) {
            const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            const logMsg = `[Security] Malicious payload detected at ${req.url} from IP: ${clientIp}`;
            console.warn(logMsg);

            // Import services dynamically to avoid circular dependencies
            const { securityAttacksTotal } = await import("@/lib/metrics");
            const { lokiTransportService } = await import("@/server/services/LokiTransportService");

            // Increment metric
            securityAttacksTotal.inc({ type: "payload_scan", source: req.url });

            // Send detailed log to Loki
            lokiTransportService.sendLog({
                level: "CRITICAL" as any,
                message: logMsg,
                source: "api-security",
                details: {
                    url: req.url,
                    method: req.method,
                    query: req.query,
                    // Don't log the whole body if it's too large, but maybe a snippet
                    body_snippet: JSON.stringify(req.body).substring(0, 500),
                    ip: clientIp,
                    user_agent: req.headers['user-agent']
                }
            }).catch(() => { });

            return res.status(403).json({ error: "Malicious payload detected" });
        }

        // Validate query parameters if schema provided
        if (validateQuery) {
            const queryValidation = validateQueryParams(req, validateQuery);
            if (!queryValidation.valid) {
                return res.status(400).json({
                    error: "Invalid query parameters",
                    errors: queryValidation.errors,
                });
            }
            // Attach validated data to request
            (req as any).validatedQuery = queryValidation.data;
        }

        // Validate request body if schema provided
        if (validateBody && req.method !== "GET" && req.method !== "HEAD") {
            const bodyValidation = validateRequestBody(req, validateBody);
            if (!bodyValidation.valid) {
                return res.status(400).json({
                    error: "Invalid request body",
                    errors: bodyValidation.errors,
                });
            }
            // Attach validated data to request
            (req as any).validatedBody = bodyValidation.data;
        }

        return securedHandler(req, res);
    };

    // Apply rate limiting
    return rateLimit(sizeValidatedHandler, rateLimitType);
}

/**
 * CSRF token validation
 *
 * Note: NextAuth v4 automatically handles CSRF protection for authentication endpoints.
 * For non-authentication API routes, we rely on:
 * 1. SameSite cookie policy (lax/strict)
 * 2. Origin validation via CORS
 * 3. Authentication token validation
 *
 * Additional CSRF protection can be added here if needed for specific endpoints.
 */
export function validateCSRFToken(req: NextApiRequest): boolean {
    // NextAuth automatically handles CSRF for session-based requests
    // For authenticated API routes, the session token itself provides CSRF protection
    // via SameSite cookie policy and token validation

    // Check for custom CSRF token if implemented (for non-NextAuth endpoints)
    const csrfToken = req.headers["x-csrf-token"];
    const cookieToken = req.cookies["csrf-token"];

    // If custom CSRF tokens are present, validate them
    if (csrfToken && cookieToken) {
        return csrfToken === cookieToken;
    }

    // For NextAuth-protected routes, CSRF is handled by the framework
    // Return true to allow the request (NextAuth will validate)
    return true;
}
