import { describe, expect, it, afterEach, beforeEach } from "vitest";

import {
    isAmplifySsrBuild,
    isNestUiMode,
    isWebSocketEnabled,
    resolveNotificationsSseUrl,
    resolveProductApiBaseUrl,
    shouldAttachNestBearer,
} from "@/utils/amplifyMode";
import {
    getAxiosBaseUrl,
    resolveAuthorizationHeader,
} from "@/utils/apiClientConfig";

describe("amplifyMode", () => {
    const keys = [
        "AMPLIFY_SSR",
        "NEXT_PUBLIC_AMPLIFY_UI",
        "NEXT_PUBLIC_USE_NEST_AUTH",
        "NEXT_PUBLIC_ENABLE_WS",
        "NEXT_PUBLIC_API_BASE_URL",
        "NEXT_PUBLIC_NEST_API_BASE_URL",
    ] as const;

    // A developer shell that exported AMPLIFY_SSR (e.g. after a local Amplify
    // build) must not change what these assertions see.
    const clearKeys = () => {
        for (const key of keys) {
            delete process.env[key];
        }
    };

    beforeEach(clearKeys);
    afterEach(clearKeys);

    it("detects Amplify SSR build flags", () => {
        expect(isAmplifySsrBuild()).toBe(false);
        process.env.AMPLIFY_SSR = "true";
        expect(isAmplifySsrBuild()).toBe(true);
    });

    it("enables websockets on Amplify when Nest base URL is set", () => {
        process.env.NEXT_PUBLIC_AMPLIFY_UI = "true";
        expect(isWebSocketEnabled()).toBe(false);
        process.env.NEXT_PUBLIC_NEST_API_BASE_URL =
            "https://staging.example.com";
        expect(isWebSocketEnabled()).toBe(true);
        process.env.NEXT_PUBLIC_ENABLE_WS = "false";
        expect(isWebSocketEnabled()).toBe(false);
    });

    it("honors explicit NEXT_PUBLIC_ENABLE_WS=true on Amplify", () => {
        process.env.NEXT_PUBLIC_AMPLIFY_UI = "true";
        process.env.NEXT_PUBLIC_ENABLE_WS = "true";
        expect(isWebSocketEnabled()).toBe(true);
    });

    it("builds Nest SSE URL with access_token for Amplify", () => {
        process.env.NEXT_PUBLIC_NEST_API_BASE_URL =
            "https://staging.example.com/";
        process.env.NEXT_PUBLIC_USE_NEST_AUTH = "true";
        expect(resolveNotificationsSseUrl("tok-abc")).toBe(
            "https://staging.example.com/api/ws/notifications?access_token=tok-abc"
        );
    });

    it("is always Nest UI mode (frontend is UI-only)", () => {
        expect(isNestUiMode()).toBe(true);
        expect(shouldAttachNestBearer()).toBe(true);
    });

    it("resolves Nest product API base URL from Nest origin", () => {
        process.env.NEXT_PUBLIC_NEST_API_BASE_URL = "https://staging.example.com";
        expect(resolveProductApiBaseUrl()).toBe(
            "https://staging.example.com/api"
        );
    });
});

describe("apiClientConfig", () => {
    afterEach(() => {
        delete process.env.NEXT_PUBLIC_USE_NEST_AUTH;
        delete process.env.NEXT_PUBLIC_NEST_API_BASE_URL;
        delete process.env.NEXT_PUBLIC_API_BASE_URL;
        delete process.env.AMPLIFY_SSR;
        delete process.env.NEXT_PUBLIC_AMPLIFY_UI;
    });

    it("attaches Bearer from Nest access token", () => {
        expect(
            resolveAuthorizationHeader({
                nestAccessToken: "tok-123",
                attachNestBearer: true,
            })
        ).toBe("Bearer tok-123");
    });

    it("preserves existing Authorization header", () => {
        expect(
            resolveAuthorizationHeader({
                existingAuthorization: "Bearer keep",
                nestAccessToken: "tok-123",
                attachNestBearer: true,
            })
        ).toBe("Bearer keep");
    });

    it("uses Nest origin for axios base URL when Nest UI mode is on", () => {
        process.env.NEXT_PUBLIC_USE_NEST_AUTH = "true";
        process.env.NEXT_PUBLIC_NEST_API_BASE_URL =
            "https://api.example.com/";
        expect(getAxiosBaseUrl()).toBe("https://api.example.com/api");
    });
});
