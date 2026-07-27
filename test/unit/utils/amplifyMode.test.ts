import { describe, expect, it, afterEach } from "vitest";

import {
    isAmplifySsrBuild,
    isNestUiMode,
    isWebSocketEnabled,
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

    afterEach(() => {
        for (const key of keys) {
            delete process.env[key];
        }
    });

    it("detects Amplify SSR build flags", () => {
        expect(isAmplifySsrBuild()).toBe(false);
        process.env.AMPLIFY_SSR = "true";
        expect(isAmplifySsrBuild()).toBe(true);
    });

    it("disables websockets by default on Amplify", () => {
        process.env.NEXT_PUBLIC_AMPLIFY_UI = "true";
        expect(isWebSocketEnabled()).toBe(false);
        process.env.NEXT_PUBLIC_ENABLE_WS = "true";
        expect(isWebSocketEnabled()).toBe(true);
    });

    it("resolves Nest product API base URL in Nest UI mode", () => {
        process.env.NEXT_PUBLIC_USE_NEST_AUTH = "true";
        process.env.NEXT_PUBLIC_NEST_API_BASE_URL = "https://staging.example.com";
        expect(resolveProductApiBaseUrl()).toBe(
            "https://staging.example.com/api"
        );
        expect(shouldAttachNestBearer()).toBe(true);
        expect(isNestUiMode()).toBe(true);
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
