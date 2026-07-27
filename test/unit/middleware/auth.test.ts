import { NextRequest, NextResponse } from "next/server";
import { vi, beforeEach, describe, it, expect } from "vitest";

// Mock next-auth/jwt
const mockGetToken = vi.fn();
vi.mock("next-auth/jwt", () => ({
    getToken: (args: any) => mockGetToken(args),
}));

// Mock next-i18n-router
vi.mock("next-i18n-router", () => ({
    i18nRouter: vi.fn((request: NextRequest) => {
        return NextResponse.next();
    }),
}));

// Mock i18nConfig
vi.mock("@/i18nConfig", () => ({
    default: {
        locales: ["en", "he"],
        defaultLocale: "en",
    },
}));

describe("Middleware Authentication", () => {
    let middleware: (request: NextRequest) => Promise<NextResponse>;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Ensure development mode by default
        process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000";

        // Import middleware after mocks are set up
        const middlewareModule = await import("@/middleware");
        middleware = middlewareModule.middleware;
    });

    describe("Protected Paths", () => {
        it("should require authentication for /app paths", async () => {
            const mockToken = {
                id: "user-123",
                account_id: 1,
            };

            mockGetToken.mockResolvedValue(mockToken);

            const request = new NextRequest("http://localhost:3000/app/dashboard");
            const response = await middleware(request);

            expect(mockGetToken).toHaveBeenCalledWith(expect.objectContaining({
                req: request,
                secret: process.env.NEXTAUTH_SECRET,
                cookieName:
                    process.env.NODE_ENV === "production"
                        ? "__Secure-next-auth.session-token.v1"
                        : "next-auth.session-token.v1",
            }));
            expect(response.status).not.toBe(401);
        });

        it("should require authentication for /api paths", async () => {
            const mockToken = {
                id: "user-123",
                account_id: 1,
            };

            mockGetToken.mockResolvedValue(mockToken);

            const request = new NextRequest("http://localhost:3000/api/users");
            const response = await middleware(request);

            expect(mockGetToken).toHaveBeenCalled();
            expect(response.status).not.toBe(401);
        });

        it("should return 401 for unauthenticated API requests", async () => {
            mockGetToken.mockResolvedValue(null);

            const request = new NextRequest("http://localhost:3000/api/users");
            const response = await middleware(request);

            expect(response.status).toBe(401);
            const json = await response.json();
            expect(json.error).toBe("Unauthorized");
        });

        it("should redirect to login for unauthenticated page requests", async () => {
            mockGetToken.mockResolvedValue(null);

            const request = new NextRequest("http://localhost:3000/app/dashboard");
            const response = await middleware(request);

            expect(response.status).toBe(307);
            expect(response.headers.get("location")).toContain("/login");
        });
    });

    describe("Public Paths", () => {
        it("should allow access to /api/auth paths without authentication", async () => {
            mockGetToken.mockResolvedValue(null);

            const request = new NextRequest("http://localhost:3000/api/auth/signin");
            const response = await middleware(request);

            // getToken is called early in middleware now
            expect(mockGetToken).toHaveBeenCalled();
            expect(response.status).not.toBe(401);
        });

        it("should allow access to /api/portal paths without authentication", async () => {
            mockGetToken.mockResolvedValue(null);

            const request = new NextRequest("http://localhost:3000/api/portal/test");
            const response = await middleware(request);

            expect(mockGetToken).toHaveBeenCalled();
            expect(response.status).not.toBe(401);
        });

        it("should allow access to /api/system/cron paths without authentication", async () => {
            mockGetToken.mockResolvedValue(null);

            const request = new NextRequest("http://localhost:3000/api/system/cron");
            const response = await middleware(request);

            expect(mockGetToken).toHaveBeenCalled();
            expect(response.status).not.toBe(401);
        });

        it("should allow access to /api/logs/create paths without authentication", async () => {
            mockGetToken.mockResolvedValue(null);

            const request = new NextRequest("http://localhost:3000/api/logs/create");
            const response = await middleware(request);

            expect(mockGetToken).toHaveBeenCalled();
            expect(response.status).not.toBe(401);
        });

        it("should allow access to /portal paths without authentication", async () => {
            mockGetToken.mockResolvedValue(null);

            const request = new NextRequest("http://localhost:3000/portal/test");
            const response = await middleware(request);

            expect(mockGetToken).toHaveBeenCalled();
            expect(response.status).not.toBe(401);
        });
    });

    describe("Cookie Name Configuration", () => {
        it("should use production cookie name in production", async () => {
            const originalEnv = process.env.NODE_ENV;
            const originalBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

            process.env.NODE_ENV = "production";
            process.env.NEXT_PUBLIC_BASE_URL = "https://example.com";

            const mockToken = {
                id: "user-123",
                account_id: 1,
            };

            mockGetToken.mockResolvedValue(mockToken);

            const request = new NextRequest("http://localhost:3000/app/dashboard");
            await middleware(request);

            expect(mockGetToken).toHaveBeenCalledWith(
                expect.objectContaining({
                    cookieName: "__Secure-next-auth.session-token.v1",
                })
            );

            process.env.NODE_ENV = originalEnv;
            process.env.NEXT_PUBLIC_BASE_URL = originalBaseUrl;
        });

        it("should use development cookie name in development", async () => {
            const originalEnv = process.env.NODE_ENV;
            const originalBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

            process.env.NODE_ENV = "development";
            process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000";

            const mockToken = {
                id: "user-123",
                account_id: 1,
            };

            mockGetToken.mockResolvedValue(mockToken);

            const request = new NextRequest("http://localhost:3000/app/dashboard");
            await middleware(request);

            expect(mockGetToken).toHaveBeenCalledWith(
                expect.objectContaining({
                    cookieName: "next-auth.session-token.v1",
                })
            );

            process.env.NODE_ENV = originalEnv;
            process.env.NEXT_PUBLIC_BASE_URL = originalBaseUrl;
        });
    });

    describe("Cache Control Headers", () => {
        it("should set no-cache headers on responses", async () => {
            const mockToken = {
                id: "user-123",
                account_id: 1,
            };

            mockGetToken.mockResolvedValue(mockToken);

            const request = new NextRequest("http://localhost:3000/app/dashboard");
            const response = await middleware(request);

            expect(response.headers.get("Cache-Control")).toBe(
                "no-store, no-cache, must-revalidate, proxy-revalidate"
            );
            expect(response.headers.get("Pragma")).toBe("no-cache");
        });
    });

    describe("Root Path Redirect", () => {
        it("should redirect root path to login", async () => {
            mockGetToken.mockResolvedValue(null);

            const request = new NextRequest("http://localhost:3000/");
            const response = await middleware(request);

            expect(response.status).toBe(307);
            expect(response.headers.get("location")).toContain("/login");
        });

        it("should redirect authenticated non-admin root path to dashboard", async () => {
            mockGetToken.mockResolvedValue({
                id: "user-123",
                account_id: 20001,
                language: "english",
            });

            const request = new NextRequest("http://localhost:3000/");
            const response = await middleware(request);

            expect(response.status).toBe(307);
            expect(response.headers.get("location")).toContain("/en/app/dashboard");
        });

        it("should redirect authenticated admin root path to accounts", async () => {
            mockGetToken.mockResolvedValue({
                id: "admin-123",
                account_id: 10013,
                language: "english",
            });

            const request = new NextRequest("http://localhost:3000/");
            const response = await middleware(request);

            expect(response.status).toBe(307);
            expect(response.headers.get("location")).toContain(
                "/en/app/admin/accounts"
            );
        });
    });

    describe("Account Isolation in Middleware", () => {
        it("should allow authenticated users to access protected paths", async () => {
            const mockToken = {
                id: "user-123",
                account_id: 1,
            };

            mockGetToken.mockResolvedValue(mockToken);

            const request = new NextRequest("http://localhost:3000/app/dashboard");
            const response = await middleware(request);

            expect(response.status).not.toBe(401);
            expect(response.status).not.toBe(403);
        });

        it("should require authentication for account-specific API routes", async () => {
            mockGetToken.mockResolvedValue(null);

            const request = new NextRequest("http://localhost:3000/api/accounts/1");
            const response = await middleware(request);

            // Middleware should require auth, but account validation happens in handler
            expect(response.status).toBe(401);
        });

        it("should pass through authenticated requests to handlers for account validation", async () => {
            const mockToken = {
                id: "user-123",
                account_id: 1,
            };

            mockGetToken.mockResolvedValue(mockToken);

            const request = new NextRequest("http://localhost:3000/api/accounts/1");
            const response = await middleware(request);

            // Middleware allows through, handler will validate account access
            expect(response.status).not.toBe(401);
        });

        it("should allow system admin (account_id 10013) to access protected paths", async () => {
            const mockToken = {
                id: "admin-123",
                account_id: 10013,
            };

            mockGetToken.mockResolvedValue(mockToken);

            const request = new NextRequest("http://localhost:3000/app/admin");
            const response = await middleware(request);

            expect(response.status).not.toBe(401);
        });
    });
});

