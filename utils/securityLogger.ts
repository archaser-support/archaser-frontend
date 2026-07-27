/**
 * Security Logger Utility
 *
 * Logs security events and attack attempts for forensic analysis.
 */

interface SecurityEvent {
    type:
    | "MALICIOUS_PAYLOAD"
    | "RCE_ATTEMPT"
    | "SQL_INJECTION"
    | "XSS_ATTEMPT"
    | "PATH_TRAVERSAL"
    | "SUSPICIOUS_ACTIVITY";
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    message: string;
    details: {
        path?: string;
        method?: string;
        payload?: string;
        ip?: string;
        userAgent?: string;
        timestamp: string;
        matchedPattern?: string;
    };
}

/**
 * Log a security event to console (and optionally to external logging service)
 */
export function logSecurityEvent(event: SecurityEvent): void {
    const logEntry = {
        ...event,
        details: {
            ...event.details,
            timestamp: event.details.timestamp || new Date().toISOString(),
        },
    };

    // Always log to console with clear formatting
    console.error(
        `[SECURITY ${event.severity}] ${event.type}: ${event.message}`,
        JSON.stringify(logEntry.details, null, 2)
    );

    // In production, you might want to send this to an external SIEM
    // or security monitoring service
    if (process.env.NODE_ENV === "production") {
        // TODO: Send to external logging service (e.g., Loki, Datadog, etc.)
        // This is a placeholder for future integration
    }
}

/**
 * Log a blocked malicious request
 */
export function logBlockedRequest(
    path: string,
    method: string,
    payload: string,
    ip?: string,
    userAgent?: string,
    matchedPattern?: string
): void {
    // Truncate payload for logging (avoid log injection)
    const truncatedPayload =
        payload.length > 500 ? payload.substring(0, 500) + "..." : payload;

    logSecurityEvent({
        type: "MALICIOUS_PAYLOAD",
        severity: "CRITICAL",
        message: `Blocked malicious request to ${path}`,
        details: {
            path,
            method,
            payload: truncatedPayload,
            ip,
            userAgent,
            timestamp: new Date().toISOString(),
            matchedPattern,
        },
    });
}

/**
 * Log an RCE attempt (based on production log patterns)
 */
export function logRCEAttempt(
    command: string,
    source: string,
    ip?: string
): void {
    logSecurityEvent({
        type: "RCE_ATTEMPT",
        severity: "CRITICAL",
        message: `RCE attempt detected: ${command}`,
        details: {
            payload: command,
            path: source,
            ip,
            timestamp: new Date().toISOString(),
        },
    });
}
