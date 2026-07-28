/**
 * Nest JWT client helpers for Stage 1A auth ownership / Amplify UI-only.
 * Used when NEXT_PUBLIC_USE_NEST_AUTH=true or NEXT_PUBLIC_AMPLIFY_UI=true.
 */

import { isNestUiMode } from "@/utils/amplifyMode";

const NEST_TOKEN_KEY = "archaser_nest_access_token";
let handlingExpiredSession = false;

export function isNestAuthEnabled(): boolean {
    return isNestUiMode();
}

export function getNestApiBaseUrl(): string {
    const configured = process.env.NEXT_PUBLIC_NEST_API_BASE_URL;
    if (configured?.trim()) {
        return configured.replace(/\/$/, "");
    }
    // Local default — production should set NEXT_PUBLIC_NEST_API_BASE_URL
    // (absolute Nest URL or same-origin proxy prefix such as /nest).
    return "http://localhost:3002";
}

export function getNestAccessToken(): string | null {
    if (typeof window === "undefined") {
        return null;
    }
    return (
        sessionStorage.getItem(NEST_TOKEN_KEY) ||
        localStorage.getItem(NEST_TOKEN_KEY)
    );
}

export function setNestAccessToken(token: string): void {
    if (typeof window === "undefined") {
        return;
    }
    sessionStorage.setItem(NEST_TOKEN_KEY, token);
    localStorage.setItem(NEST_TOKEN_KEY, token);
}

export function clearNestAccessToken(): void {
    if (typeof window === "undefined") {
        return;
    }
    sessionStorage.removeItem(NEST_TOKEN_KEY);
    localStorage.removeItem(NEST_TOKEN_KEY);
}

function resolveLoginPathname(pathname: string): string {
    const localeMatch = pathname.match(/^\/([a-z]{2})(?:\/|$)/i);
    const locale = localeMatch?.[1] || "en";
    return `/${locale}/login`;
}

/**
 * Global expired-session handler for Nest bearer auth.
 * Clears local bearer token, signs out NextAuth cookie session, then routes to login.
 */
export async function handleExpiredNestSession(): Promise<void> {
    if (typeof window === "undefined" || handlingExpiredSession) {
        return;
    }
    handlingExpiredSession = true;
    clearNestAccessToken();
    try {
        const { signOut } = await import("next-auth/react");
        await signOut({ redirect: false });
    } catch {
        // NextAuth may be unavailable depending on deploy mode.
    } finally {
        const target = resolveLoginPathname(window.location.pathname || "/");
        if (window.location.pathname !== target) {
            window.location.assign(target);
        }
        handlingExpiredSession = false;
    }
}

/** Re-apply token after login clears storage. */
export function restoreNestAccessToken(token: string | null | undefined): void {
    if (token) {
        setNestAccessToken(token);
    }
}

export type NestLoginResponse = {
    access_token: string;
    token_type: string;
};

export async function nestCredentialsLogin(
    username: string,
    password: string
): Promise<NestLoginResponse> {
    const response = await fetch(`${getNestApiBaseUrl()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
        let message = "Invalid credentials";
        try {
            const body = await response.json();
            if (typeof body?.message === "string") {
                message = body.message;
            } else if (Array.isArray(body?.message)) {
                message = body.message.join(", ");
            }
        } catch {
            // keep default
        }
        throw new Error(message);
    }

    return response.json();
}

export type NestAccountBySubdomain = {
    accountId: number;
    name: string;
    ssoEnabled: boolean;
    ssoProviders: string[];
};

export async function nestAccountBySubdomain(
    subdomain: string
): Promise<NestAccountBySubdomain | null> {
    const response = await fetch(
        `${getNestApiBaseUrl()}/auth/account-by-subdomain?subdomain=${encodeURIComponent(subdomain)}`
    );
    if (response.status === 404) {
        return null;
    }
    if (!response.ok) {
        throw new Error("Failed to look up organization");
    }
    return response.json();
}

export function getNestGoogleStartUrl(): string {
    return `${getNestApiBaseUrl()}/auth/google`;
}

export function getNestAzureStartUrl(): string {
    return `${getNestApiBaseUrl()}/auth/azure-ad`;
}

/** Fetch Nest with Bearer token from storage (auth-related Nest calls). */
export async function nestFetch(
    path: string,
    init: RequestInit = {}
): Promise<Response> {
    const token = getNestAccessToken();
    const headers = new Headers(init.headers || {});
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }
    if (!headers.has("Content-Type") && init.body) {
        headers.set("Content-Type", "application/json");
    }
    const url = path.startsWith("http")
        ? path
        : `${getNestApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
    const response = await fetch(url, { ...init, headers });
    if (response.status === 401) {
        await handleExpiredNestSession();
    }
    return response;
}

export type NestMeProfile = {
    sub: string;
    username: string;
    email?: string | null;
    account_id?: number | null;
    role?: string | null;
    name?: string | null;
    language?: string | null;
    timezone?: string | null;
    locale?: string | null;
    account_name?: string | null;
    primary_color?: string | null;
    secondary_color?: string | null;
    sidebar_collapsed?: boolean | null;
};

export async function nestFetchMe(): Promise<NestMeProfile> {
    const response = await nestFetch("/auth/me");
    if (!response.ok) {
        throw new Error("Failed to load Nest profile");
    }
    return response.json();
}

export async function nestForgetPassword(
    email: string,
    language?: string
): Promise<{ message: string }> {
    const response = await fetch(`${getNestApiBaseUrl()}/auth/forget-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, language }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message =
            typeof data?.message === "string"
                ? data.message
                : Array.isArray(data?.message)
                  ? data.message.join(", ")
                  : "Failed to process forget password request";
        const error = new Error(message) as Error & { status?: number };
        error.status = response.status;
        throw error;
    }
    return data;
}

export async function nestResetPassword(
    token: string,
    password: string
): Promise<{ message: string }> {
    const response = await fetch(`${getNestApiBaseUrl()}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message =
            typeof data?.message === "string"
                ? data.message
                : Array.isArray(data?.message)
                  ? data.message.join(", ")
                  : "Failed to reset password";
        throw new Error(message);
    }
    return data;
}

/** Persist Nest profile fields used by post-login redirects (Amplify UI-only). */
export function persistNestLoginProfile(profile: NestMeProfile): void {
    if (typeof window === "undefined") {
        return;
    }
    const timestamp = Date.now().toString();
    localStorage.setItem("freshLogin", "true");
    localStorage.setItem("loginTimestamp", timestamp);
    localStorage.setItem("loginUserId", profile.sub || "");
    localStorage.setItem("loginUserRole", profile.role || "");
    localStorage.setItem(
        "loginAccountId",
        profile.account_id != null ? String(profile.account_id) : ""
    );
    localStorage.setItem("nestUserProfile", JSON.stringify(profile));
}

export function readPersistedNestProfile(): NestMeProfile | null {
    if (typeof window === "undefined") {
        return null;
    }
    const raw = localStorage.getItem("nestUserProfile");
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw) as NestMeProfile;
    } catch {
        return null;
    }
}
