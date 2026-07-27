import { NextApiRequest, NextApiResponse } from "next";

import { prisma } from "@/lib/prisma";
import { AccessControlService } from "@/server/services/AccessControlService";
import { reportError as reportErrorUtil } from "@/utils/errorReporting";

type ApiHandler = (
    req: NextApiRequest,
    res: NextApiResponse
) => Promise<void | NextApiResponse>;

/**
 * Wrapper function for API route handlers that automatically captures and reports errors
 *
 * @param handler - The API route handler function
 * @param options - Optional configuration
 * @returns Wrapped handler with error reporting
 *
 * @example
 * ```typescript
 * export default errorHandler(async (req, res) => {
 *   // Your handler code
 * });
 * ```
 */
export function errorHandler(
    handler: ApiHandler,
    options?: {
        /**
         * Whether to skip error reporting for this handler
         * Useful for handlers that handle their own errors
         */
        skipErrorReporting?: boolean;
        /**
         * Custom error handler function
         * If provided, this will be called instead of the default error reporting
         */
        customErrorHandler?: (
            error: Error,
            req: NextApiRequest,
            res: NextApiResponse
        ) => Promise<void>;
    }
) {
    return async (req: NextApiRequest, res: NextApiResponse) => {
        try {
            await handler(req, res);
        } catch (error: any) {
            // If custom error handler is provided, use it
            if (options?.customErrorHandler) {
                await options.customErrorHandler(error, req, res);
                return;
            }

            // Skip error reporting if requested
            if (options?.skipErrorReporting) {
                throw error;
            }

            // Skip reporting for authentication/authorization errors (expected errors)
            const shouldSkipReporting =
                error.message === "Unauthorized" ||
                error.message?.includes("Unauthorized") ||
                error.statusCode === 401 ||
                error.statusCode === 403;

            // Report error (unless it's an auth error)
            if (!shouldSkipReporting) {
                await reportError(error, req, res);
            }

            // Send error response if not already sent
            if (!res.headersSent) {
                const statusCode = error.statusCode || 500;
                const errorMessage = error.message || "Internal server error";

                return res.status(statusCode).json({
                    error: errorMessage,
                    ...(process.env.NODE_ENV === "development" && {
                        stack: error.stack,
                    }),
                });
            }
        }
    };
}

/**
 * Report error to error reporting utility
 */
async function reportError(
    error: Error,
    req: NextApiRequest,
    _res: NextApiResponse
): Promise<void> {
    try {
        // Get user context
        let userId: string | undefined;
        let userEmail: string | undefined;
        let userName: string | undefined;
        let userRole: string | undefined;
        let accountId: number | undefined;
        let accountName: string | undefined;
        let viewAsUserId: string | undefined;
        let viewAsUserAccountId: number | undefined;
        let viewAsUserRole: string | undefined;

        try {
            const accessControl = AccessControlService.getInstance();
            const userInfo = await accessControl.getUserInfo(req);

            userId = userInfo.userId;
            accountId = userInfo.viewAsUserAccountId || userInfo.accountId;

            // Try to get user details from database
            if (userId) {
                try {
                    const user = await prisma.user.findUnique({
                        where: { id: userId },
                        select: {
                            email: true,
                            name: true,
                            role: true,
                        },
                    });

                    if (user) {
                        userEmail = user.email ?? undefined;
                        userName = user.name ?? undefined;
                        userRole = user.role ?? undefined;
                    }
                } catch (userError) {
                    // Non-critical - continue without user details
                    console.warn("Failed to fetch user details:", userError);
                }
            }

            // View-as mode
            viewAsUserId = userInfo.viewAsUserId;
            viewAsUserAccountId = userInfo.viewAsUserAccountId;
            viewAsUserRole = userInfo.viewAsUserRole;
        } catch (authError) {
            // Authentication error is not critical for error reporting
            // Continue without user context
            console.warn(
                "Failed to get user context for error report:",
                authError
            );
        }

        // Get account name if we have accountId
        if (accountId && !accountName) {
            try {
                const account = await prisma.account.findUnique({
                    where: { id: accountId },
                    select: { name: true },
                });
                if (account) {
                    accountName = account.name ?? undefined;
                }
            } catch (accountError) {
                // Non-critical - continue without account name
                console.warn("Failed to fetch account name:", accountError);
            }
        }

        // Extract route information
        const route =
            req.url || req.query.path
                ? Array.isArray(req.query.path)
                    ? `/api/${req.query.path.join("/")}`
                    : `/api/${req.query.path || ""}`
                : req.url || "Unknown";

        // Prepare request body (sanitize sensitive data)
        let requestBody: any = undefined;
        if (req.body) {
            try {
                // Create a copy and remove sensitive fields
                requestBody = JSON.parse(JSON.stringify(req.body));
                const sensitiveFields = [
                    "password",
                    "token",
                    "secret",
                    "apiKey",
                    "authorization",
                ];
                sensitiveFields.forEach((field) => {
                    if (requestBody[field]) {
                        requestBody[field] = "[REDACTED]";
                    }
                });
            } catch {
                // If body parsing fails, just indicate body was present
                requestBody = { _note: "Body present but could not be parsed" };
            }
        }

        // Prepare error context
        const errorContext = {
            userId,
            userEmail,
            userName,
            userRole,
            accountId: viewAsUserAccountId || accountId,
            accountName,
            viewAsUserId,
            viewAsUserAccountId,
            viewAsUserRole,
            errorMessage: error.message || "Unknown error",
            errorStack: error.stack,
            errorName: error.name || "Error",
            route,
            method: req.method,
            query: req.query,
            body: requestBody,
            source: "backend" as const,
            additionalContext: {
                url: req.url,
                headers: {
                    "user-agent": req.headers["user-agent"],
                    "content-type": req.headers["content-type"],
                },
            },
        };

        // Report error
        await reportErrorUtil(errorContext);
    } catch (reportError) {
        // Don't throw - error reporting failures shouldn't break the app
        console.error("Failed to report error:", reportError);
    }
}
