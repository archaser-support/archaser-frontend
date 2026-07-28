import { describe, expect, it, afterEach, vi } from "vitest";

import {
    apiFetch,
    normalizeProductApiPath,
    resolveProductRequestUrl,
} from "@/utils/apiFetch";
import { resolveProductApiBaseUrl } from "@/utils/amplifyMode";

describe("apiFetch URL helpers", () => {
    afterEach(() => {
        delete process.env.NEXT_PUBLIC_USE_NEST_AUTH;
        delete process.env.NEXT_PUBLIC_NEST_API_BASE_URL;
        delete process.env.NEXT_PUBLIC_API_BASE_URL;
        delete process.env.AMPLIFY_SSR;
        delete process.env.NEXT_PUBLIC_AMPLIFY_UI;
    });

    it("normalizes /api prefix for axios baseURL", () => {
        expect(normalizeProductApiPath("/api/entities/customers")).toBe(
            "/entities/customers"
        );
        expect(normalizeProductApiPath("/entities/customers")).toBe(
            "/entities/customers"
        );
    });

    it("resolves Nest absolute product URLs", () => {
        process.env.NEXT_PUBLIC_USE_NEST_AUTH = "true";
        process.env.NEXT_PUBLIC_NEST_API_BASE_URL =
            "https://api.example.com";
        expect(resolveProductApiBaseUrl()).toBe("https://api.example.com/api");
        expect(resolveProductRequestUrl("/api/operations/notifications")).toBe(
            "https://api.example.com/api/operations/notifications"
        );
    });

    it("clears session and redirects to login on 401 in Nest mode", async () => {
        process.env.NEXT_PUBLIC_USE_NEST_AUTH = "true";
        process.env.NEXT_PUBLIC_NEST_API_BASE_URL = "https://api.example.com";

        vi.spyOn(globalThis, "fetch").mockResolvedValue(
                new Response(JSON.stringify({ error: "Unauthorized" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" },
                })
            );

        const signOut = vi.fn().mockResolvedValue(undefined);
        vi.doMock("next-auth/react", () => ({ signOut }));

        const assignMock = vi.fn();
        Object.defineProperty(window, "location", {
            value: {
                pathname: "/en/app/dashboard",
                assign: assignMock,
            },
            configurable: true,
        });

        await apiFetch("/api/operations/notifications");

        expect(signOut).toHaveBeenCalledWith({ redirect: false });
        expect(assignMock).toHaveBeenCalledWith("/en/login");
    });
});

describe("getServerSessionSafe Amplify bridge", () => {
    afterEach(() => {
        vi.resetModules();
        vi.unmock("next-auth");
        delete process.env.AMPLIFY_SSR;
        delete process.env.NEXT_PUBLIC_AMPLIFY_UI;
    });

    it("still calls getServerSession when Amplify SSR is on", async () => {
        process.env.AMPLIFY_SSR = "true";
        const getServerSession = vi.fn().mockResolvedValue({
            user: { id: "u1", account_id: 1 },
        });
        vi.doMock("next-auth", () => ({ getServerSession }));
        vi.doMock("@/server/auth/authOptions", () => ({
            authOptions: { providers: [] },
        }));

        const { getServerSessionSafe } = await import("@/utils/serverSession");
        const session = await getServerSessionSafe();
        expect(getServerSession).toHaveBeenCalled();
        expect(session?.user?.id).toBe("u1");
    });
});
