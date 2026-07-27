/**
 * Security Headers Utility
 *
 * Provides functions to generate security headers for responses
 */

export interface SecurityHeadersConfig {
    cspReportUri?: string;
    isDevelopment?: boolean;
    isHttps?: boolean;
}

/**
 * Generate Content Security Policy header
 */
function generateCSP(config: SecurityHeadersConfig = {}): string {
    const isDev =
        config.isDevelopment ?? process.env.NODE_ENV === "development";
    const isHttps = config.isHttps ?? false;
    const reportUri = config.cspReportUri || process.env.CSP_REPORT_URI;

    // Define allowed domains
    const googleRecaptcha = "https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/";
    const clarity = "https://www.clarity.ms https://*.clarity.ms https://*.bing.com";

    // Base CSP directives
    const csp: Record<string, string[]> = {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-eval'", "'unsafe-inline'", googleRecaptcha, clarity],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "img-src": ["'self'", "data:", "https:", "blob:", "https://*.clarity.ms"],
        "connect-src": ["'self'", "https:", "wss:", "ws:", "https://*.clarity.ms"],
        "frame-src": ["'self'", "https://www.google.com/recaptcha/"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'none'"],
    };

    // In development, allow more permissive policies for hot reloading
    if (isDev) {
        csp["connect-src"].push("http://localhost:*", "ws://localhost:*", "wss://localhost:*");
    }

    // Only upgrade insecure requests if we are on HTTPS
    if (isHttps) {
        csp["upgrade-insecure-requests"] = [];
    }

    // Add report-uri if configured
    if (reportUri) {
        csp["report-uri"] = [reportUri];
    }

    // Build the CSP string
    return Object.entries(csp)
        .map(([directive, values]) => {
            if (values.length === 0) return directive;
            return `${directive} ${values.join(" ")}`;
        })
        .join("; ");
}

/**
 * Get all security headers as a record
 */
export function getSecurityHeaders(
    config: SecurityHeadersConfig = {}
): Record<string, string> {
    const isProduction = process.env.NODE_ENV === "production";
    const isHttps =
        config.isHttps ??
        process.env.NEXT_PUBLIC_BASE_URL?.startsWith("https://") ??
        false;

    const headers: Record<string, string> = {
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Content-Security-Policy": generateCSP({ ...config, isHttps }),
    };

    // Only add HSTS in production with HTTPS
    if (isProduction && isHttps) {
        headers["Strict-Transport-Security"] =
            "max-age=31536000; includeSubDomains; preload";
    }

    return headers;
}

/**
 * Apply security headers to a NextResponse
 */
export function applySecurityHeaders(
    response: Response,
    config: SecurityHeadersConfig = {}
): Response {
    const headers = getSecurityHeaders(config);

    Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
    });

    return response;
}
