import { getToken } from "next-auth/jwt";
import { i18nRouter } from "next-i18n-router";
import { NextRequest, NextResponse } from "next/server";

import i18nConfig from "./i18nConfig";
import { getDefaultLandingPage } from "./shared/utils/navigation";
import { isAmplifySsrBuild } from "./utils/amplifyMode";
import { isSuspiciousPayload } from "./utils/payloadScanner";
import { getSecurityHeaders } from "./utils/securityHeaders";
import { getCookieName } from "./utils/authUtils";

// Helper function to send logs to MongoDB from middleware (Edge Runtime)
async function sendMongoLog(request: NextRequest, level: string, message: string, details: any) {
    try {
        const url = new URL("/api/logs/create", request.nextUrl.origin);
        await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                level,
                message,
                source: "Middleware-Auth",
                details: {
                    ...details,
                    pathname: request.nextUrl.pathname,
                    host: request.headers.get("host"),
                    userAgent: request.headers.get("user-agent"),
                    url: request.url
                }
            }),
        });
    } catch (e) {
        // Silently fail to not block middleware
    }
}

export async function middleware(request: NextRequest) {
    const host = request.headers.get("host");
    const pathname = request.nextUrl.pathname;
    const amplifyUi = isAmplifySsrBuild();

    // Redirect www.archaser.com to archaser.com
    if (host === "www.archaser.com") {
        const url = request.nextUrl.clone();
        url.hostname = "archaser.com";
        url.protocol = "https"; // Ensure it's https
        return NextResponse.redirect(url, 301);
    }

    // Amplify UI-only: product APIs live on Nest. Keep NextAuth `/api/auth` for the
    // Nest-JWT→session bridge (prisma-free stub). Soft-disable `/api/ws`.
    if (amplifyUi && pathname.startsWith("/api/")) {
        if (pathname.startsWith("/api/auth")) {
            return NextResponse.next();
        }
        if (pathname.startsWith("/api/ws")) {
            return NextResponse.json(
                {
                    error: "WebSockets unavailable on Amplify UI until Nest owns realtime.",
                },
                { status: 404 }
            );
        }
        return NextResponse.json(
            {
                error: "API is served by Nest. Set NEXT_PUBLIC_API_BASE_URL to the Nest origin.",
            },
            { status: 404 }
        );
    }

    // Special handling for Prometheus metrics - always allow
    if (pathname === "/api/metrics" || pathname === "/api/metrics/") {
        return NextResponse.next();
    }

    // Define protected paths
    const protectedPaths = ["/app", "/api"];
    // const skipAuthPaths = ['/api/auth', '/api/portal', '/api/dispute/get'];
    // Public endpoints that skip authentication at middleware level
    // Note: These endpoints should still validate authentication internally if needed
    const skipAuthPaths = [
        "/api/auth", // NextAuth endpoints
        "/api/test-auth", // Test authentication endpoint (has IP whitelist and API key protection)
        "/api/portal", // Portal endpoints (public, but validate customer UUID)
        "/api/system/cron", // Cron job endpoint (validates secret header)
        "/api/email/ses-webhook", // AWS SES webhook (validates signature)
        "/api/email/track-open", // Email tracking pixel (public, no sensitive data)
        "/api/email/track-click", // Email tracking link (public, no sensitive data)
        "/api/sms/webhook", // SMS webhook (validates signature)
        "/api/sms/webhook/twilio", // Twilio webhook (validates signature)
        "/api/webhooks/aws-ses-delivery", // AWS webhook (validates signature)
        "/api/accounts/[accountId]/logo", // Public logo endpoint
        "/api/logs/create", // Logging endpoint (rate limited, validates auth internally for non-login events)
        "/api/activities/attachments/presigned-url", // S3 presigned URL generation (validates auth internally)
        "/api/country", // Public country list endpoint
        "/portal", // Portal routes
        "/api/metrics", // Prometheus metrics endpoint
    ];
    // Security check: Block suspicious payloads in query parameters and path
    // BUT: Skip security scanning for OAuth callbacks (they contain long, legitimate Base64 codes)
    const isOAuthCallback = pathname === "/api/auth/callback/azure-ad" ||
        pathname === "/api/auth/callback/google" ||
        pathname.startsWith("/api/auth/callback/");

    if (!isOAuthCallback) {
        const searchParams = Object.fromEntries(
            request.nextUrl.searchParams.entries()
        );
        const fullUrl = request.url;

        if (
            isSuspiciousPayload(searchParams) ||
            isSuspiciousPayload(pathname) ||
            isSuspiciousPayload(fullUrl)
        ) {
            // Log the blocked request with details for forensic analysis
            const clientIP =
                request.headers.get("x-forwarded-for") ||
                request.headers.get("x-real-ip") ||
                "unknown";
            const userAgent = request.headers.get("user-agent") || "unknown";

            console.error(
                `[SECURITY CRITICAL] BLOCKED MALICIOUS REQUEST`,
                JSON.stringify(
                    {
                        timestamp: new Date().toISOString(),
                        path: pathname,
                        method: request.method,
                        ip: clientIP,
                        userAgent: userAgent,
                        queryParams: searchParams,
                        fullUrl: fullUrl.substring(0, 500), // Truncate for safety
                    },
                    null,
                    2
                )
            );

            return new NextResponse(
                JSON.stringify({ error: "Malicious request detected and blocked" }),
                {
                    status: 403,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }
    }

    // Check if the request is for an API route
    const isApiRoute = pathname.startsWith("/api");

    // Retrieve the token (session) from the request early to handle root redirects
    const isSecure = process.env.NODE_ENV === "production" && !!process.env.NEXT_PUBLIC_BASE_URL?.startsWith("https://");

    const primaryCookieName = getCookieName(isSecure);
    const legacyCookieName = getCookieName(isSecure, "session-token", true);

    let token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
        cookieName: primaryCookieName,
    });

    if (!token) {
        token = await getToken({
            req: request,
            secret: process.env.NEXTAUTH_SECRET,
            cookieName: legacyCookieName,
        });
    }

    if (token) {
        // Token found
    } else {

        // Log to MongoDB if it's a protected path
        const isProtected = protectedPaths.some((path) => pathname.startsWith(path));
        const isSkipped = skipAuthPaths.some((path) => pathname.startsWith(path));

        if (isProtected && !isSkipped) {
            // Get all cookies for details
            const cookieHeader = request.headers.get("cookie") || "";
            const hasSessionCookie = cookieHeader.includes(primaryCookieName);
            const hasLegacyCookie = cookieHeader.includes(legacyCookieName);

            await sendMongoLog(request, "WARNING", `[Auth] Session missing on protected route: ${pathname}`, {
                primaryCookieName,
                legacyCookieName,
                hasSessionCookie,
                hasLegacyCookie,
                cookieCount: request.cookies.size
            });
        }
    }

    let response: NextResponse;

    if (!isApiRoute) {
        // Redirect root path to login or dashboard
        if (pathname === "/") {
            if (token) {
                // User is logged in, redirect to dashboard
                // Map language/locale to supported app locale
                let locale = i18nConfig.defaultLocale;

                // prioritizing explicit language setting
                if (token.language === 'hebrew') locale = 'he';
                else if (token.language === 'english') locale = 'en';
                else if (token.locale) {
                    // Handle potential region codes (e.g., he-IL -> he, en-US -> en)
                    const rawLocale = (token.locale as string).toLowerCase();
                    if (rawLocale.startsWith('he')) locale = 'he';
                    else if (rawLocale.startsWith('en')) locale = 'en';
                }

                // Final validation against config (fallback to default if not supported)
                if (!i18nConfig.locales.includes(locale)) {
                    locale = i18nConfig.defaultLocale;
                }

                const landingPath = getDefaultLandingPage(token.account_id);
                const landingUrl = new URL(`/${locale}${landingPath}`, request.url);
                return NextResponse.redirect(landingUrl);
            }
            const loginUrl = new URL("/login", request.url);
            return NextResponse.redirect(loginUrl);
        }

        // Normalize URL by removing trailing slash
        const url = request.nextUrl.clone();
        if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
            url.pathname = url.pathname.slice(0, -1);
            return NextResponse.redirect(url); // redirect cleanly
        }

        // Capture original pathname before i18n router processes it
        const originalPathname = pathname;

        // For portal routes, skip i18n router to prevent automatic redirects
        // Portal uses customer-specific language, not account-level locale
        // Pathname includes locale: /en/portal/... or /he/portal/...
        // So we need to check if it contains "/portal/" anywhere, not just starts with it
        const isPortalRoute = originalPathname.includes("/portal/");

        if (isPortalRoute) {
            // Pass the current pathname via request headers so Server Components
            // (e.g. portal layout) can reliably detect when we're already on /verify.
            const requestHeaders = new Headers(request.headers);
            requestHeaders.set("x-pathname", originalPathname);
            requestHeaders.set("x-search", request.nextUrl.search);

            const cid = request.nextUrl.searchParams.get("cid");
            if (cid) {
                requestHeaders.set("x-cid", cid);
            } else {
                requestHeaders.delete("x-cid");
            }

            response = NextResponse.next({
                request: {
                    headers: requestHeaders,
                },
            });
            // Add headers to prevent any client-side i18n redirects
            response.headers.set("x-i18n-skip", "true");
            response.headers.set(
                "Cache-Control",
                "no-store, no-cache, must-revalidate"
            );
        } else {
            // Non-portal routes use i18n router (which may redirect based on locale)
            response = i18nRouter(request, i18nConfig);
        }

        // Add pathname header for portal subdomain routing
        if (originalPathname.startsWith("/portal/")) {
            response.headers.set("x-pathname", originalPathname);
        }

        // Also add pathname header for all routes to help with debugging
        response.headers.set("x-pathname", originalPathname);
    } else {
        response = NextResponse.next();
    }

    // Check if the current path is protected
    let requiresAuth = true;

    // Special handling for portal customer API endpoints (public, no auth required)
    // These endpoints are accessed via customer UUID and are public
    const portalCustomerApiPattern =
        /^\/api\/customers\/[^/]+\/(portal-data|bank-details|view-disputes|invoices|wrong-contact|create-dispute|agent-portal)$/;
    const isPortalCustomerApi = portalCustomerApiPattern.test(pathname);

    // Check if the current path should skip authentication
    const shouldSkipAuth = skipAuthPaths.some((path) => {
        // Special handling for /api/auth - exclude all auth-related paths
        if (path === "/api/auth") {
            return pathname.startsWith("/api/auth");
        }
        // Special handling for /api/test-auth - exclude all test auth paths
        if (path === "/api/test-auth") {
            return pathname.startsWith("/api/test-auth");
        }
        // Special handling for /api/portal - exclude all sub-paths
        if (path === "/api/portal") {
            return pathname.startsWith(path);
        }
        // Convert Next.js dynamic route pattern to regex
        const regexPattern = path.replace(/\[.*?\]/g, "[^/]+");
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(pathname);
    });

    if (shouldSkipAuth || isPortalCustomerApi) {
        requiresAuth = false;
    } else {
        // Check if it's a portal route (should not require auth)
        if (pathname.startsWith("/portal/")) {
            requiresAuth = false;
        } else {
            requiresAuth = protectedPaths.some((path) =>
                pathname.includes(path)
            );
        }
    }

    if (requiresAuth) {
        if (!token) {
            if (pathname.startsWith("/api")) {
                return NextResponse.json(
                    { error: "Unauthorized" },
                    { status: 401 }
                );
            } else {
                const signInUrl = new URL("/login", request.url);
                return NextResponse.redirect(signInUrl);
            }
        }
    }
    response.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    response.headers.set("Surrogate-Control", "no-store");

    // Apply security headers
    const securityHeaders = getSecurityHeaders({
        isDevelopment: process.env.NODE_ENV === "development",
    });
    Object.entries(securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
    });

    return response;
}

// Apply middleware to protect both pages and API routes
export const config = {
    matcher: [
        "/((?!api|_next/static|_next/image|assets|favicon.ico|grafana).*)", // Protect all non-static routes, exclude assets
        "/api/(.*)", // Protect all API routes under /api
    ],
};
