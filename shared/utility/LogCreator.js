import React from "react";

// Helper function to serialize BigInt values
function serializeBigInt(obj) {
    return JSON.parse(
        JSON.stringify(obj, (key, value) =>
            typeof value === "bigint" ? value.toString() : value
        )
    );
}

export async function createLogRecord(
    level = "ERROR", // Default value for level is "ERROR"
    message,
    source,
    details
) {
    // Validate inputs
    if (!message || !source) {
        return null;
    }

    // Ensure level is valid
    const validLevels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"];
    const normalizedLevel = validLevels.includes(level.toUpperCase())
        ? level.toUpperCase()
        : "ERROR";

    try {
        // Dynamic import keeps this utility usable from client bundles without circular deps.
        const { apiFetch } = await import("@/utils/apiFetch");
        const response = await apiFetch("/api/logs/create", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                level: normalizedLevel,
                message: message.toString(),
                source: source.toString(),
                details: details
                    ? serializeBigInt(
                          typeof details === "object" ? details : { details }
                      )
                    : null,
            }),
        });

        if (!response.ok) {
            try {
                const errorData = await response.json();
                // errorMessage = errorData.error || errorMessage;
            } catch (_parseError) {
                // Ignore parse errors
            }

            // Don't throw error, just log it and return null
            return null;
        }

        try {
            const result = await response.json();
            return result;
        } catch (_parseError) {
            // Even if we can't parse the response, the log was likely created
            return { success: true };
        }
    } catch (_error) {
        // Handle network errors and other issues gracefully
        
        return null;
    }
}

// Add a synchronous fallback function for critical errors
export function createLogRecordSync(level, message, source, details) {
    const timestamp = new Date().toISOString();
    // Fallback logging for critical errors only
    if (level === "CRITICAL" || level === "ERROR") {
        console.error(
            `[${timestamp}] [${level || "ERROR"}] ${message} (${source})`,
            details
        );
    }
}
