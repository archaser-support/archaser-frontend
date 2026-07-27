"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback } from "react";

interface ErrorReportData {
    errorMessage: string;
    errorStack?: string;
    errorName?: string;
    component?: string;
    additionalContext?: Record<string, any>;
}

export const useErrorReporting = () => {
    const { data: session } = useSession();
    const pathname = usePathname();

    const reportError = useCallback(
        async (
            error: Error | string,
            additionalContext?: Record<string, any>
        ) => {
            try {
                // Normalize error input
                const errorObj =
                    typeof error === "string" ? new Error(error) : error;

                // IGNORABLE ERRORS
                // 1. ResizeObserver loop errors - harmless browser layout warning
                if (
                    errorObj.message.includes(
                        "ResizeObserver loop completed with undelivered notifications"
                    ) ||
                    errorObj.message.includes("ResizeObserver loop limit exceeded")
                ) {
                    return;
                }

                // 2. Chrome Extension errors - not related to our app
                if (
                    errorObj.stack?.includes("chrome-extension://") ||
                    errorObj.message.includes("chrome-extension://")
                ) {
                    return;
                }

                // Extract component name from stack if available
                let component = "Unknown";
                if (errorObj.stack) {
                    const stackLines = errorObj.stack.split("\n");
                    const componentMatch = stackLines.find((line) =>
                        line.includes("at ")
                    );
                    if (componentMatch) {
                        const match = componentMatch.match(/at\s+(\w+)/);
                        if (match) {
                            component = match[1];
                        }
                    }
                }

                // Prepare error data
                const errorData: ErrorReportData = {
                    errorMessage: errorObj.message,
                    errorStack: errorObj.stack,
                    errorName: errorObj.name,
                    component,
                    additionalContext: {
                        ...additionalContext,
                        pathname,
                        page:
                            typeof window !== "undefined"
                                ? window.location.href
                                : pathname || "",
                    },
                };

                // Send to API endpoint
                await fetch("/api/errors/report", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(errorData),
                }).catch((fetchError) => {
                    console.error("Failed to report error to API:", fetchError);
                });
            } catch (reportError) {
                console.error("Failed to report error:", reportError);
            }
        },
        [pathname]
    );

    return {
        reportError,
        session, // Expose session for manual access if needed
    };
};
