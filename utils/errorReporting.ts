import { createHash } from "crypto";

import { EmailService } from "@/server/EmailService";
import { LogService } from "@/server/services/LogService";
import { LogLevel } from "@/types/enums";
import { detectServerEnvironment } from "@/utils/domainUtils";

interface ErrorContext {
    // User information
    userId?: string;
    userEmail?: string;
    userName?: string;
    userRole?: string;
    accountId?: number;
    accountName?: string;

    // View-as mode
    viewAsUserId?: string;
    viewAsUserAccountId?: number;
    viewAsUserRole?: string;

    // Error details
    errorMessage: string;
    errorStack?: string;
    errorName?: string;
    errorDigest?: string; // Next.js error digest for Server Components errors

    // Location information
    page?: string; // Frontend: page URL
    route?: string; // Backend: API route
    component?: string; // Frontend: component name
    referrer?: string; // Previous page URL

    // Request information (backend)
    method?: string;
    query?: any;
    body?: any;
    requestHeaders?: Record<string, string>; // Sanitized request headers
    requestId?: string; // Request correlation ID

    // Browser information (frontend)
    userAgent?: string;
    browserInfo?: string;
    screenResolution?: string; // Screen resolution
    viewportSize?: string; // Viewport size

    // Session information
    sessionExists?: boolean; // Whether session exists
    sessionAccountId?: number; // Account ID from session (if available)
    sessionUserId?: string; // User ID from session (if available)

    // System information
    buildId?: string; // Next.js build ID
    deploymentVersion?: string; // Deployment version if available
    nodeVersion?: string; // Node.js version
    databaseConnected?: boolean; // Database connection status

    // Additional context
    additionalContext?: Record<string, any>;

    // Error source
    source: "frontend" | "backend";
}

interface ErrorSignature {
    signature: string;
    lastSent: number;
    count: number;
}

// In-memory cooldown map
const cooldownMap: Map<string, ErrorSignature> = new Map();

// Configuration
const cooldownMinutes = parseInt(
    process.env.ERROR_REPORT_COOLDOWN_MINUTES || "15",
    10
);
const emailRecipients = (
    process.env.ERROR_REPORT_EMAIL_RECIPIENTS ||
    "support@archaser,ofir@cloudial.io"
)
    .split(",")
    .map((email) => email.trim());
const enabled = process.env.ERROR_REPORT_ENABLED !== "false";

/**
 * Generate error signature for deduplication
 */
function generateErrorSignature(context: ErrorContext): string {
    // Normalize stack trace - remove file paths and line numbers
    const normalizedStack = context.errorStack
        ? context.errorStack
            .split("\n")
            .slice(0, 3) // First 3 lines
            .map((line) =>
                line
                    .replace(/\(.*?\)/g, "") // Remove file paths
                    .replace(/:\d+:\d+/g, "") // Remove line numbers
                    .trim()
            )
            .join(" ")
        : "";

    // Create signature from key components
    const signatureParts = [
        context.errorMessage,
        normalizedStack,
        context.route || context.page || "",
        context.accountId?.toString() || "",
    ];

    const signatureString = signatureParts.join("|");

    // Hash the signature for efficient storage
    return createHash("sha256")
        .update(signatureString)
        .digest("hex")
        .substring(0, 16); // Use first 16 chars for shorter keys
}

/**
 * Check if error should be reported (cooldown check)
 */
function shouldReportError(signature: string): boolean {
    if (!enabled) {
        return false;
    }

    const existing = cooldownMap.get(signature);
    if (!existing) {
        return true;
    }

    const cooldownMs = cooldownMinutes * 60 * 1000;
    const timeSinceLastSent = Date.now() - existing.lastSent;

    if (timeSinceLastSent >= cooldownMs) {
        // Cooldown expired, allow reporting
        return true;
    }

    // Still in cooldown, but increment count
    existing.count += 1;
    return false;
}

/**
 * Record error signature and timestamp
 */
function recordErrorSignature(signature: string): void {
    const existing = cooldownMap.get(signature);
    if (existing) {
        existing.lastSent = Date.now();
        existing.count += 1;
    } else {
        cooldownMap.set(signature, {
            signature,
            lastSent: Date.now(),
            count: 1,
        });
    }

    // Clean up old entries (older than 24 hours) to prevent memory leak
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    for (const [key, value] of Array.from(cooldownMap.entries())) {
        if (value.lastSent < oneDayAgo) {
            cooldownMap.delete(key);
        }
    }
}

/**
 * Generate HTML email content for error report
 */
function generateErrorEmailHTML(context: ErrorContext): string {
    const environment = detectServerEnvironment();
    const envDisplay =
        environment === "localhost"
            ? "Local Development"
            : environment === "preprod"
                ? "Pre-Production"
                : "Production";

    const timestamp = new Date().toISOString();
    const errorSignature = generateErrorSignature(context);
    const existing = cooldownMap.get(errorSignature);
    const occurrenceCount = existing?.count || 1;

    // Format stack trace for HTML
    const formattedStack = context.errorStack
        ? context.errorStack
            .split("\n")
            .map((line) => line.replace(/</g, "&lt;").replace(/>/g, "&gt;"))
            .join("<br>")
        : "No stack trace available";

    // Format additional context
    const formattedContext = context.additionalContext
        ? JSON.stringify(context.additionalContext, null, 2)
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
        : "None";

    // Format query/body for backend errors
    const formattedQuery = context.query
        ? JSON.stringify(context.query, null, 2)
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
        : "None";

    const formattedBody = context.body
        ? JSON.stringify(context.body, null, 2)
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
        : "None";

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #dc3545;
            color: white;
            padding: 20px;
            border-radius: 5px 5px 0 0;
        }
        .content {
            background-color: #f8f9fa;
            padding: 20px;
            border: 1px solid #dee2e6;
        }
        .section {
            margin-bottom: 20px;
            background-color: white;
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid #007bff;
        }
        .section-title {
            font-weight: bold;
            color: #007bff;
            margin-bottom: 10px;
            font-size: 16px;
        }
        .field {
            margin-bottom: 10px;
        }
        .field-label {
            font-weight: bold;
            color: #666;
            display: inline-block;
            min-width: 150px;
        }
        .field-value {
            color: #333;
        }
        .code-block {
            background-color: #f4f4f4;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 10px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
        }
        .badge-error {
            background-color: #dc3545;
            color: white;
        }
        .badge-frontend {
            background-color: #28a745;
            color: white;
        }
        .badge-backend {
            background-color: #ffc107;
            color: #333;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚨 System Error Report</h1>
        <p>An error has been detected in the ARchaser system</p>
    </div>
    
    <div class="content">
        <div class="section">
            <div class="section-title">Error Information</div>
            <div class="field">
                <span class="field-label">Error Type:</span>
                <span class="field-value">${context.errorName || "Error"}</span>
            </div>
            <div class="field">
                <span class="field-label">Error Message:</span>
                <span class="field-value">${context.errorMessage}</span>
            </div>
            <div class="field">
                <span class="field-label">Source:</span>
                <span class="field-value">
                    <span class="badge badge-${context.source}">${context.source.toUpperCase()}</span>
                </span>
            </div>
            <div class="field">
                <span class="field-label">Occurrences:</span>
                <span class="field-value">${occurrenceCount} time(s)</span>
            </div>
            ${context.errorDigest
            ? `
            <div class="field">
                <span class="field-label">Error Digest:</span>
                <span class="field-value" style="font-family: monospace; font-size: 12px;">${context.errorDigest}</span>
            </div>
            `
            : ""
        }
            <div class="field">
                <span class="field-label">Stack Trace:</span>
                <div class="code-block">${formattedStack}</div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">User Information</div>
            <div class="field">
                <span class="field-label">User ID:</span>
                <span class="field-value">${context.userId || "N/A"}</span>
            </div>
            <div class="field">
                <span class="field-label">User Email:</span>
                <span class="field-value">${context.userEmail || "N/A"}</span>
            </div>
            <div class="field">
                <span class="field-label">User Name:</span>
                <span class="field-value">${context.userName || "N/A"}</span>
            </div>
            <div class="field">
                <span class="field-label">User Role:</span>
                <span class="field-value">${context.userRole || "N/A"}</span>
            </div>
            <div class="field">
                <span class="field-label">Account ID:</span>
                <span class="field-value">${context.accountId || "N/A"}</span>
            </div>
            <div class="field">
                <span class="field-label">Account Name:</span>
                <span class="field-value">${context.accountName || "N/A"}</span>
            </div>
            ${context.viewAsUserId
            ? `
            <div class="field">
                <span class="field-label">View-As Mode:</span>
                <span class="field-value">Active</span>
            </div>
            <div class="field">
                <span class="field-label">View-As User ID:</span>
                <span class="field-value">${context.viewAsUserId}</span>
            </div>
            <div class="field">
                <span class="field-label">View-As Account ID:</span>
                <span class="field-value">${context.viewAsUserAccountId || "N/A"}</span>
            </div>
            <div class="field">
                <span class="field-label">View-As Role:</span>
                <span class="field-value">${context.viewAsUserRole || "N/A"}</span>
            </div>
            `
            : ""
        }
        </div>

        <div class="section">
            <div class="section-title">Location Information</div>
            ${context.source === "frontend"
            ? `
            <div class="field">
                <span class="field-label">Page URL:</span>
                <span class="field-value">${context.page || "N/A"}</span>
            </div>
            <div class="field">
                <span class="field-label">Component:</span>
                <span class="field-value">${context.component || "N/A"}</span>
            </div>
            ${context.referrer
                ? `
            <div class="field">
                <span class="field-label">Referrer:</span>
                <span class="field-value">${context.referrer}</span>
            </div>
            `
                : ""
            }
            <div class="field">
                <span class="field-label">User Agent:</span>
                <span class="field-value">${context.userAgent || "N/A"}</span>
            </div>
            <div class="field">
                <span class="field-label">Browser Info:</span>
                <span class="field-value">${context.browserInfo || "N/A"}</span>
            </div>
            ${context.screenResolution
                ? `
            <div class="field">
                <span class="field-label">Screen Resolution:</span>
                <span class="field-value">${context.screenResolution}</span>
            </div>
            `
                : ""
            }
            ${context.viewportSize
                ? `
            <div class="field">
                <span class="field-label">Viewport Size:</span>
                <span class="field-value">${context.viewportSize}</span>
            </div>
            `
                : ""
            }
            `
            : `
            <div class="field">
                <span class="field-label">API Route:</span>
                <span class="field-value">${context.route || "N/A"}</span>
            </div>
            <div class="field">
                <span class="field-label">HTTP Method:</span>
                <span class="field-value">${context.method || "N/A"}</span>
            </div>
            ${context.requestId
                ? `
            <div class="field">
                <span class="field-label">Request ID:</span>
                <span class="field-value" style="font-family: monospace; font-size: 11px;">${context.requestId}</span>
            </div>
            `
                : ""
            }
            <div class="field">
                <span class="field-label">Query Parameters:</span>
                <div class="code-block">${formattedQuery}</div>
            </div>
            <div class="field">
                <span class="field-label">Request Body:</span>
                <div class="code-block">${formattedBody}</div>
            </div>
            ${context.requestHeaders &&
                Object.keys(context.requestHeaders).length > 0
                ? `
            <div class="field">
                <span class="field-label">Request Headers:</span>
                <div class="code-block">${JSON.stringify(
                    context.requestHeaders,
                    null,
                    2
                )
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")}</div>
            </div>
            `
                : ""
            }
            `
        }
        </div>

        <div class="section">
            <div class="section-title">System Information</div>
            <div class="field">
                <span class="field-label">Environment:</span>
                <span class="field-value">${envDisplay}</span>
            </div>
            <div class="field">
                <span class="field-label">Timestamp:</span>
                <span class="field-value">${timestamp}</span>
            </div>
            <div class="field">
                <span class="field-label">Error Signature:</span>
                <span class="field-value" style="font-family: monospace; font-size: 11px;">${errorSignature}</span>
            </div>
            ${context.buildId
            ? `
            <div class="field">
                <span class="field-label">Build ID:</span>
                <span class="field-value" style="font-family: monospace; font-size: 11px;">${context.buildId}</span>
            </div>
            `
            : ""
        }
            ${context.deploymentVersion
            ? `
            <div class="field">
                <span class="field-label">Deployment Version:</span>
                <span class="field-value">${context.deploymentVersion}</span>
            </div>
            `
            : ""
        }
            ${context.nodeVersion
            ? `
            <div class="field">
                <span class="field-label">Node.js Version:</span>
                <span class="field-value">${context.nodeVersion}</span>
            </div>
            `
            : ""
        }
            ${context.databaseConnected !== undefined
            ? `
            <div class="field">
                <span class="field-label">Database Connected:</span>
                <span class="field-value">${context.databaseConnected ? "Yes" : "No"}</span>
            </div>
            `
            : ""
        }
        </div>

        ${context.sessionExists !== undefined ||
            context.sessionAccountId !== undefined ||
            context.sessionUserId !== undefined
            ? `
        <div class="section">
            <div class="section-title">Session State</div>
            ${context.sessionExists !== undefined
                ? `
            <div class="field">
                <span class="field-label">Session Exists:</span>
                <span class="field-value">${context.sessionExists ? "Yes" : "No"}</span>
            </div>
            `
                : ""
            }
            ${context.sessionUserId
                ? `
            <div class="field">
                <span class="field-label">Session User ID:</span>
                <span class="field-value">${context.sessionUserId}</span>
            </div>
            `
                : ""
            }
            ${context.sessionAccountId
                ? `
            <div class="field">
                <span class="field-label">Session Account ID:</span>
                <span class="field-value">${context.sessionAccountId}</span>
            </div>
            `
                : ""
            }
        </div>
        `
            : ""
        }

        ${context.additionalContext &&
            Object.keys(context.additionalContext).length > 0
            ? `
        <div class="section">
            <div class="section-title">Additional Context</div>
            <div class="code-block">${formattedContext}</div>
        </div>
        `
            : ""
        }
    </div>
</body>
</html>
    `.trim();
}

/**
 * Log error to database via LogService
 */
async function logError(context: ErrorContext): Promise<void> {
    try {
        const logService = LogService.getInstance();
        const logMessage = `Error: ${context.errorMessage}`;
        const source =
            context.source === "frontend"
                ? `Frontend${context.component ? `:${context.component}` : ""}`
                : `Backend${context.route ? `:${context.route}` : ""}`;

        const details: any = {
            errorName: context.errorName,
            errorMessage: context.errorMessage,
            errorStack: context.errorStack,
            page: context.page,
            route: context.route,
            component: context.component,
            method: context.method,
            userAgent: context.userAgent,
            browserInfo: context.browserInfo,
            ...context.additionalContext,
        };

        if (context.source === "backend") {
            details.query = context.query;
            // Don't log full body to avoid sensitive data, just indicate if present
            details.hasBody = !!context.body;
        }

        await logService.logMessage(
            LogLevel.ERROR,
            logMessage,
            source,
            details,
            context.accountId,
            context.userId,
            undefined, // jobId
            undefined, // correlationId
            undefined // existingLogId
        );
    } catch (error) {
        console.error("Failed to log error to database:", error);
        // Don't throw - logging failures shouldn't break error reporting
    }
}

/**
 * Send error report email using EmailService
 */
async function sendErrorEmail(context: ErrorContext): Promise<void> {
    if (!enabled) {
        return;
    }

    // Skip sending error emails for frontend errors in local environment
    if (context.source === "frontend") {
        const environment = detectServerEnvironment();
        if (environment === "localhost") {
            return;
        }
    }

    try {
        const location = context.route || context.page || "Unknown";
        const errorType = context.errorName || "Error";
        // Note: EmailService automatically adds environment prefix to subject
        const subject = `[ARCHASER ERROR] ${errorType} - ${location}`;

        const htmlContent = generateErrorEmailHTML(context);

        // Create EmailService instance
        const emailService = new EmailService();
        emailService.setSenderName("ARchaser System");

        // Send email to all recipients
        const emailPromises = emailRecipients.map((recipient) =>
            emailService
                .sendEmail(recipient, subject, htmlContent)
                .catch((error) => {
                    console.error(
                        `Failed to send error report email to ${recipient}:`,
                        error
                    );
                })
        );

        await Promise.allSettled(emailPromises);
    } catch (error) {
        console.error("Failed to send error report email:", error);
        // Don't throw - email failure shouldn't break error reporting
    }
}

/**
 * Report an error (main entry point)
 */
export async function reportError(context: ErrorContext): Promise<void> {
    try {
        // Generate error signature
        const signature = generateErrorSignature(context);

        // Check cooldown
        if (!shouldReportError(signature)) {
            // Still log to database even if email is on cooldown
            await logError(context);
            return;
        }

        // Record signature
        recordErrorSignature(signature);

        // Log to database
        await logError(context);

        // Send email
        await sendErrorEmail(context);
    } catch (error) {
        console.error("Error in reportError:", error);
        // Don't throw - error reporting failures shouldn't break the app
    }
}
