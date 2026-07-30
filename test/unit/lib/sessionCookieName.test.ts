/// <reference types="vitest/globals" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The session cookie is written by `authOptions` and read back by middleware,
 * `getServerSession` and the `authUtils` token helpers. When those disagree the
 * browser keeps a cookie nobody looks for: login succeeds and the app redirects
 * straight back to /login. These tests pin the writer to the readers.
 */
async function loadWithEnv(env: Record<string, string | undefined>) {
    vi.resetModules();
    for (const [key, value] of Object.entries(env)) {
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
    const [{ authOptions }, authUtils] = await Promise.all([
        import("@/lib/authOptions"),
        import("@/utils/authUtils"),
    ]);
    return {
        configuredName: authOptions.cookies?.sessionToken?.name,
        secureOption: authOptions.cookies?.sessionToken?.options?.secure,
        readerName: authUtils.getCookieName(authUtils.authCookiesAreSecure()),
    };
}

describe("session cookie name", () => {
    const original = { ...process.env };

    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        process.env = { ...original };
    });

    it("names the cookie it writes so readers can find it", async () => {
        const { configuredName } = await loadWithEnv({
            NODE_ENV: "production",
            NEXT_PUBLIC_BASE_URL: "https://archaser.com",
            SERVICE_NAME: "archaser-production",
            NEXTAUTH_SECRET: "secret",
        });

        expect(configuredName).toBeTruthy();
    });

    it("agrees with the readers on an environment-suffixed deployment", async () => {
        const { configuredName, readerName, secureOption } = await loadWithEnv({
            NODE_ENV: "production",
            NEXT_PUBLIC_BASE_URL: "https://staging.archaser.com",
            NEXTAUTH_URL: "https://staging.archaser.com",
            SERVICE_NAME: "archaser-staging",
            NEXTAUTH_SECRET: "secret",
        });

        expect(configuredName).toBe("__Secure-next-auth.session-token.staging");
        expect(readerName).toBe(configuredName);
        expect(secureOption).toBe(true);
    });

    it("agrees with the readers in production", async () => {
        const { configuredName, readerName } = await loadWithEnv({
            NODE_ENV: "production",
            NEXT_PUBLIC_BASE_URL: "https://archaser.com",
            NEXTAUTH_URL: "https://archaser.com",
            SERVICE_NAME: "archaser-production",
            NEXTAUTH_SECRET: "secret",
        });

        // Unsuffixed and `__Secure-` prefixed, matching the cookie already in
        // production browsers — renaming it here would sign everyone out.
        expect(configuredName).toBe("__Secure-next-auth.session-token");
        expect(readerName).toBe(configuredName);
    });

    it("agrees with the readers over plain http in development", async () => {
        const { configuredName, readerName, secureOption } = await loadWithEnv({
            NODE_ENV: "development",
            NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
            NEXTAUTH_URL: "http://localhost:3000",
            SERVICE_NAME: undefined,
            NEXTAUTH_SECRET: "secret",
        });

        expect(configuredName).toBe("next-auth.session-token");
        expect(readerName).toBe(configuredName);
        expect(secureOption).toBe(false);
    });
});
