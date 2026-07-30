import { getToken } from "next-auth/jwt";
import { i18nRouter } from "next-i18n-router";
import { NextRequest, NextResponse } from "next/server";

import i18nConfig from "./i18nConfig";
import { getDefaultLandingPage } from "./shared/utils/navigation";
import { isSuspiciousPayload } from "./utils/payloadScanner";
import { getSecurityHeaders } from "./utils/securityHeaders";
import {
    authCookiesAreSecure,
    getCookieName,
    sessionSecret,
} from "./utils/authUtils";

export async function middleware(request: NextRequest) {
    const host = request.headers.get("host");
    const pathname = request.nextUrl.pathname;

    // Redirect www.archaser.com to archaser.com
    if (host === "www.archaser.com") {
        const url = request.nextUrl.clone();
        url.hostname = "archaser.com";
        url.protocol = "https"; // Ensure it's https
        return NextResponse.redirect(url, 301);
    }

    // Product APIs + SSE live on Nest. `/api/auth` stays local for the
    // Nest-JWT→session bridge. Relative `/api/ws` only lands here when the
    // client is misconfigured — it should use the absolute Nest SSE URL.
    if (pathname.startsWith("/api/")) {
        if (pathname.startsWith("/api/auth")) {
            return NextResponse.next();
        }
        // Local dev may proxy product APIs to Nest via `next.config.js`
        // rewrites; middleware runs first, so let those through.
        if (
            process.env.NODE_ENV === "development" &&
            process.env.USE_NEST_API_REWRITE === "true"
        ) {
            return NextResponse.next();
        }
        if (pathname.startsWith("/api/ws")) {
            const nest =
                process.env.NEXT_PUBLIC_NEST_API_BASE_URL?.replace(/\/$/, "") ||
                "";
            if (nest && process.env.NEXT_PUBLIC_ENABLE_WS !== "false") {
                const target = new URL(
                    `${pathname}${request.nextUrl.search}`,
                    nest
                );
                return NextResponse.redirect(target);
            }
            return NextResponse.json(
                {
                    error: "Realtime is served by Nest. Set NEXT_PUBLIC_NEST_API_BASE_URL and NEXT_PUBLIC_ENABLE_WS=true.",
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

    // Only page routes reach this point; `/api/*` returned above.
    const protectedPaths = ["/app"];
    const skipAuthPaths = ["/portal"];

    {
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

    // Retrieve the token (session) from the request early to handle root redirects.
    // Name and secret come from the same helpers `authOptions` writes with.
    const token = await getToken({
        req: request,
        secret: sessionSecret(),
        cookieName: getCookieName(authCookiesAreSecure()),
    });

    let response: NextResponse;

    {
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
    }

    // Portal pages are public (customer UUID scoped); everything under /app needs a session.
    const isPublicPage =
        skipAuthPaths.some((path) => pathname.startsWith(path)) ||
        pathname.includes("/portal/");
    const requiresAuth =
        !isPublicPage && protectedPaths.some((path) => pathname.includes(path));

    if (requiresAuth && !token) {
        const signInUrl = new URL("/login", request.url);
        return NextResponse.redirect(signInUrl);
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
