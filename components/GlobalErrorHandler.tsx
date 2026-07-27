"use client";
import { apiFetch } from "@/utils/apiFetch";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Error deduplication and rate limiting
 */
interface ErrorReportCache {
    hash: string;
    timestamp: number;
    count: number;
}

// Track reported errors to prevent duplicates
const errorReportCache = new Map<string, ErrorReportCache>();
const pendingReports = new Set<string>(); // Track errors that have pending API calls
const REPORT_DEBOUNCE_MS = 10000; // Don't report same error within 10 seconds (increased from 5)
const MAX_REPORTS_PER_ERROR = 5; // Max reports per error per session (reduced from 10)
const CACHE_CLEANUP_INTERVAL = 60000; // Clean up cache every minute
const MAX_DEBOUNCE_TIMEOUT_MS = 2000; // Max 2 second debounce for API call

/**
 * Generate a hash for error deduplication
 */
function generateErrorHash(
    errorMessage: string,
    errorStack?: string,
    page?: string
): string {
    // Use first 100 chars of stack or message for hash
    const stackSnippet = errorStack
        ? errorStack.substring(0, 100)
        : errorMessage.substring(0, 100);
    const pageSnippet = page ? page.split("?")[0] : ""; // Remove query params
    return `${errorMessage.substring(0, 50)}|${stackSnippet}|${pageSnippet}`;
}

/**
 * Check if error should be reported (deduplication and rate limiting)
 * Returns true if error should be reported, false otherwise
 */
function shouldReportError(
    errorMessage: string,
    errorStack?: string,
    page?: string
): boolean {
    const hash = generateErrorHash(errorMessage, errorStack, page);
    const now = Date.now();

    // Clean up old entries periodically (do this first to free memory)
    if (errorReportCache.size > 100) {
        for (const [key, value] of Array.from(errorReportCache.entries())) {
            if (now - value.timestamp > CACHE_CLEANUP_INTERVAL) {
                errorReportCache.delete(key);
            }
        }
    }

    const cached = errorReportCache.get(hash);

    // Check if there's already a pending report for this error
    if (pendingReports.has(hash)) {
        return false;
    }

    if (cached) {
        // Check if we've exceeded max reports for this error
        if (cached.count >= MAX_REPORTS_PER_ERROR) {
            return false;
        }

        // Check if we're within debounce window
        const timeSinceLastReport = now - cached.timestamp;
        if (timeSinceLastReport < REPORT_DEBOUNCE_MS) {
            return false;
        }

        // Update cache atomically - mark as reported immediately to prevent race conditions
        cached.timestamp = now;
        cached.count += 1;
        pendingReports.add(hash); // Mark as pending
        return true;
    } else {
        // New error, add to cache and allow reporting
        errorReportCache.set(hash, {
            hash,
            timestamp: now,
            count: 1,
        });
        pendingReports.add(hash); // Mark as pending
        return true;
    }
}

/**
 * Global error handler component that sets up window error handlers
 * This should be mounted once at the root of the application
 */
export default function GlobalErrorHandler() {
    const pathname = usePathname();
    const reportTimeoutRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
        new Map()
    );

    useEffect(() => {
        // Handler for unhandled errors
        const handleError = (
            event: ErrorEvent | Event,
            source?: string,
            lineno?: number,
            colno?: number,
            error?: Error
        ) => {
            const errorObj = error || (event as ErrorEvent).error;
            const message =
                errorObj?.message ||
                (event as ErrorEvent).message ||
                "Unknown error";
            const stack = errorObj?.stack || "";
            const page =
                typeof window !== "undefined"
                    ? window.location.href
                    : pathname || "";

            // Ignore ResizeObserver loop errors - harmless browser layout warning
            if (
                message.includes(
                    "ResizeObserver loop completed with undelivered notifications"
                ) ||
                message.includes("ResizeObserver loop limit exceeded")
            ) {
                return;
            }

            // Check if we should report this error (deduplication)
            if (!shouldReportError(message, stack, page)) {
                return;
            }

            // Clear any existing timeout for this error
            const errorHash = generateErrorHash(message, stack, page);
            const existingTimeout = reportTimeoutRef.current.get(errorHash);
            if (existingTimeout) {
                clearTimeout(existingTimeout);
                reportTimeoutRef.current.delete(errorHash);
                pendingReports.delete(errorHash); // Remove from pending if we're canceling
            }

            // Debounce the actual API call (but with a shorter timeout to prevent queue buildup)
            const timeoutId = setTimeout(() => {
                // Remove from pending set when timeout executes
                pendingReports.delete(errorHash);

                // Double-check cache before actually reporting (in case multiple timeouts queued)
                const hash = generateErrorHash(message, stack, page);
                const cached = errorReportCache.get(hash);
                if (cached && cached.count <= MAX_REPORTS_PER_ERROR) {
                    reportErrorToAPI({
                        errorMessage: message,
                        errorStack: stack,
                        errorName: errorObj?.name || "Error",
                        errorDigest: (errorObj as any)?.digest,
                        page,
                        referrer:
                            typeof window !== "undefined"
                                ? document.referrer || undefined
                                : undefined,
                        userAgent:
                            typeof window !== "undefined"
                                ? window.navigator.userAgent
                                : "",
                        browserInfo: getBrowserInfo(),
                        screenResolution:
                            typeof window !== "undefined"
                                ? `${window.screen.width}x${window.screen.height}`
                                : undefined,
                        viewportSize:
                            typeof window !== "undefined"
                                ? `${window.innerWidth}x${window.innerHeight}`
                                : undefined,
                        additionalContext: {
                            source: source || "unknown",
                            lineno,
                            colno,
                            type: event.type,
                        },
                    });
                }
                reportTimeoutRef.current.delete(errorHash);
            }, MAX_DEBOUNCE_TIMEOUT_MS); // 2 second debounce for API call

            reportTimeoutRef.current.set(errorHash, timeoutId);
        };

        // Handler for unhandled promise rejections
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            const reason = event.reason;
            const errorMessage =
                reason instanceof Error
                    ? reason.message
                    : typeof reason === "string"
                      ? reason
                      : JSON.stringify(reason);
            const errorStack = reason instanceof Error ? reason.stack : "";
            const errorName =
                reason instanceof Error
                    ? reason.name
                    : "UnhandledPromiseRejection";

            const fullErrorMessage = `Unhandled Promise Rejection: ${errorMessage}`;
            const page =
                typeof window !== "undefined"
                    ? window.location.href
                    : pathname || "";

            // Ignore ResizeObserver loop errors - harmless browser layout warning
            if (
                errorMessage.includes(
                    "ResizeObserver loop completed with undelivered notifications"
                ) ||
                errorMessage.includes("ResizeObserver loop limit exceeded")
            ) {
                return;
            }

            // Check if we should report this error (deduplication)
            if (!shouldReportError(fullErrorMessage, errorStack, page)) {
                return;
            }

            // Clear any existing timeout for this error
            const errorHash = generateErrorHash(
                fullErrorMessage,
                errorStack,
                page
            );
            const existingTimeout = reportTimeoutRef.current.get(errorHash);
            if (existingTimeout) {
                clearTimeout(existingTimeout);
                reportTimeoutRef.current.delete(errorHash);
                pendingReports.delete(errorHash); // Remove from pending if we're canceling
            }

            // Debounce the actual API call (but with a shorter timeout to prevent queue buildup)
            const timeoutId = setTimeout(() => {
                // Remove from pending set when timeout executes
                pendingReports.delete(errorHash);

                // Double-check cache before actually reporting (in case multiple timeouts queued)
                const hash = generateErrorHash(
                    fullErrorMessage,
                    errorStack,
                    page
                );
                const cached = errorReportCache.get(hash);
                if (cached && cached.count <= MAX_REPORTS_PER_ERROR) {
                    reportErrorToAPI({
                        errorMessage: fullErrorMessage,
                        errorStack,
                        errorName,
                        errorDigest: (reason as any)?.digest,
                        page,
                        referrer:
                            typeof window !== "undefined"
                                ? document.referrer || undefined
                                : undefined,
                        userAgent:
                            typeof window !== "undefined"
                                ? window.navigator.userAgent
                                : "",
                        browserInfo: getBrowserInfo(),
                        screenResolution:
                            typeof window !== "undefined"
                                ? `${window.screen.width}x${window.screen.height}`
                                : undefined,
                        viewportSize:
                            typeof window !== "undefined"
                                ? `${window.innerWidth}x${window.innerHeight}`
                                : undefined,
                        additionalContext: {
                            reason:
                                typeof reason === "object"
                                    ? reason
                                    : { message: errorMessage },
                        },
                    });
                }
                reportTimeoutRef.current.delete(errorHash);
            }, MAX_DEBOUNCE_TIMEOUT_MS); // 2 second debounce for API call

            reportTimeoutRef.current.set(errorHash, timeoutId);
        };

        // Set up global error handlers
        window.addEventListener("error", handleError as EventListener);
        window.addEventListener("unhandledrejection", handleUnhandledRejection);

        // Cleanup
        return () => {
            window.removeEventListener("error", handleError as EventListener);
            window.removeEventListener(
                "unhandledrejection",
                handleUnhandledRejection
            );
            // Clear all pending timeouts
            reportTimeoutRef.current.forEach((timeout) => {
                clearTimeout(timeout);
            });
            reportTimeoutRef.current.clear();
        };
    }, [pathname]);

    return null; // This component doesn't render anything
}

/**
 * Report error to API endpoint
 */
async function reportErrorToAPI(errorData: {
    errorMessage: string;
    errorStack?: string;
    errorName?: string;
    errorDigest?: string;
    page?: string;
    referrer?: string;
    userAgent?: string;
    browserInfo?: string;
    screenResolution?: string;
    viewportSize?: string;
    additionalContext?: Record<string, any>;
}) {
    try {
        await apiFetch("/api/errors/report", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(errorData),
        }).catch((fetchError) => {
            console.error("Failed to report error to API:", fetchError);
        });
    } catch (error) {
        console.error("Failed to report error:", error);
    }
}

/**
 * Get browser information string
 */
function getBrowserInfo(): string {
    if (typeof window === "undefined") {
        return "Server-side";
    }

    const nav = window.navigator;
    const info = [
        `Browser: ${getBrowserName()}`,
        `Version: ${nav.appVersion}`,
        `Platform: ${nav.platform}`,
        `Language: ${nav.language}`,
        `Screen: ${window.screen.width}x${window.screen.height}`,
    ];

    return info.join(", ");
}

/**
 * Get browser name from user agent
 */
function getBrowserName(): string {
    if (typeof window === "undefined") {
        return "Unknown";
    }

    const userAgent = window.navigator.userAgent;
    if (userAgent.indexOf("Chrome") > -1) return "Chrome";
    if (userAgent.indexOf("Firefox") > -1) return "Firefox";
    if (userAgent.indexOf("Safari") > -1) return "Safari";
    if (userAgent.indexOf("Edge") > -1) return "Edge";
    if (userAgent.indexOf("Opera") > -1) return "Opera";
    return "Unknown";
}
