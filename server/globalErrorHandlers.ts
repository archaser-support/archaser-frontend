/**
 * Global Error Handlers
 *
 * This module sets up global error handlers to prevent server crashes
 * from unhandled exceptions and promise rejections.
 *
 * IMPORTANT: Import this file as early as possible in your application entry point.
 */

// Known attack patterns from production logs
const ATTACK_ERROR_PATTERNS = [
    "ENOENT",           // File not found (attacks trying to access non-existent files)
    "ETXTBSY",          // Text file busy (attacks trying to modify binaries)
    "not found",        // Command not found (powershell.exe, svchost.exe, curl, wget)
    "spawn",            // Spawn errors from child_process
    "exec",             // Exec errors from child_process
    "child_process",    // Direct child_process errors
    "powershell",       // Windows attack attempts
    "svchost",          // Malware attempts
    "cmd.exe",          // Windows command attempts
    "/bin/sh",          // Shell execution attempts
    "curl",             // Download attempts
    "wget",             // Download attempts
    "base64",           // Encoded payload attempts
];

/**
 * Check if an error message matches known attack patterns
 */
function isAttackRelatedError(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    return ATTACK_ERROR_PATTERNS.some(pattern =>
        lowerMessage.includes(pattern.toLowerCase())
    );
}

// Track if handlers are already registered to avoid duplicates
let handlersRegistered = false;

/**
 * Initialize global error handlers
 */
export function initializeGlobalErrorHandlers(): void {
    if (handlersRegistered) {
        return;
    }

    // Handle uncaught exceptions - CRITICAL: Don't let the server crash
    process.on("uncaughtException", (error: Error, origin: string) => {
        const errorMessage = error?.message || String(error);
        const isAttack = isAttackRelatedError(errorMessage);

        if (isAttack) {
            // Log as security event but DON'T crash
            console.error(
                `[SECURITY] Attack-related exception caught and suppressed:`,
                {
                    timestamp: new Date().toISOString(),
                    error: errorMessage,
                    origin,
                    action: "SUPPRESSED - Server continues running"
                }
            );
            // DO NOT re-throw or exit - the attack failed, server continues
            return;
        }

        // For non-attack errors, log but still try to keep running
        console.error(
            `[CRITICAL] Uncaught Exception at ${origin}:`,
            errorMessage
        );
        console.error("Stack trace:", error.stack);

        // Don't exit - PM2 will restart if truly necessary
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
        const errorMessage = reason?.message || String(reason);
        const isAttack = isAttackRelatedError(errorMessage);

        if (isAttack) {
            // Log as security event but DON'T crash
            console.error(
                `[SECURITY] Attack-related rejection caught and suppressed:`,
                {
                    timestamp: new Date().toISOString(),
                    error: errorMessage,
                    action: "SUPPRESSED - Server continues running"
                }
            );
            // DO NOT re-throw - the attack failed, server continues
            return;
        }

        console.error("[CRITICAL] Unhandled Promise Rejection:", errorMessage);
        // Don't exit - let the server continue running
    });

    // Handle warnings
    process.on("warning", (warning: Error) => {
        // Node 24+ DEP0169: url.parse() in Next.js / openid-client (next-auth). Harmless;
        // stderr still reaches the Next dev overlay unless disabled at process start.
        if (
            warning.name === "DeprecationWarning" &&
            (warning.message.includes("`url.parse()` behavior is not standardized") ||
                ("code" in warning && warning.code === "DEP0169"))
        ) {
            return;
        }

        // Suppress warnings related to attack attempts
        if (isAttackRelatedError(warning.message)) {
            console.warn("[SECURITY] Attack-related warning suppressed:", warning.message);
            return;
        }
        console.warn("[WARNING]", warning.name, warning.message);
    });

    // Handle SIGTERM gracefully (for PM2 restarts)
    process.on("SIGTERM", () => {
        console.log("[INFO] Received SIGTERM, shutting down gracefully...");
        setTimeout(() => {
            process.exit(0);
        }, 5000);
    });

    // Handle SIGINT gracefully (Ctrl+C)
    process.on("SIGINT", () => {
        console.log("[INFO] Received SIGINT, shutting down gracefully...");
        setTimeout(() => {
            process.exit(0);
        }, 2000);
    });

    handlersRegistered = true;
    console.log("[INFO] Global error handlers initialized - Attack suppression enabled");
}

// Auto-initialize when this module is imported
if (typeof process !== "undefined" && typeof process.on === "function") {
    initializeGlobalErrorHandlers();
}
