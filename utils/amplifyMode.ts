/**
 * Amplify UI-only / Nest-backed mode helpers.
 * AMPLIFY_SSR is set by `build:amplify` / amplify.yml (build-time).
 * NEXT_PUBLIC_AMPLIFY_UI is set in Amplify console for runtime client checks.
 */

export function isAmplifySsrBuild(): boolean {
    return (
        process.env.AMPLIFY_SSR === "true" ||
        process.env.NEXT_PUBLIC_AMPLIFY_UI === "true"
    );
}

/** Nest owns product APIs + auth. The frontend is UI-only. */
export function isNestUiMode(): boolean {
    return true;
}

/**
 * Realtime SSE (/api/ws) — Nest-owned.
 * Off only when NEXT_PUBLIC_ENABLE_WS=false.
 * On Amplify, also requires Nest base URL (cross-origin EventSource).
 */
export function isWebSocketEnabled(): boolean {
    if (process.env.NEXT_PUBLIC_ENABLE_WS === "false") {
        return false;
    }
    if (process.env.NEXT_PUBLIC_ENABLE_WS === "true") {
        return true;
    }
    if (isAmplifySsrBuild()) {
        return Boolean(process.env.NEXT_PUBLIC_NEST_API_BASE_URL?.trim());
    }
    return true;
}

/** Product API base URL for axios (Nest `/api` on Amplify / Nest UI mode). */
export function resolveProductApiBaseUrl(): string {
    const explicit = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
    if (explicit) {
        return explicit.replace(/\/$/, "");
    }
    if (isNestUiMode()) {
        const nest = process.env.NEXT_PUBLIC_NEST_API_BASE_URL?.trim();
        if (nest) {
            const origin = nest.replace(/\/$/, "");
            return origin.endsWith("/api") ? origin : `${origin}/api`;
        }
    }
    return "/api";
}

/**
 * Absolute Nest origin for auth + SSE (no trailing slash).
 * Empty when same-origin nginx proxies Nest (EC2 hybrid).
 */
export function resolveNestOrigin(): string {
    const nest = process.env.NEXT_PUBLIC_NEST_API_BASE_URL?.trim();
    if (nest) {
        return nest.replace(/\/$/, "");
    }
    if (isAmplifySsrBuild()) {
        return "";
    }
    return "";
}

/**
 * SSE URL for notification stream.
 * Amplify/cross-origin: Nest absolute URL + access_token query (EventSource cannot set Authorization).
 * Same-origin (EC2 nginx → Nest): relative path; cookie or query both work.
 */
export function resolveNotificationsSseUrl(accessToken?: string | null): string {
    const path = "/api/ws/notifications";
    const origin = resolveNestOrigin();
    const base = origin || "";
    if (accessToken && (origin || isNestUiMode())) {
        const url = `${base}${path}?access_token=${encodeURIComponent(accessToken)}`;
        return origin ? url : `${path}?access_token=${encodeURIComponent(accessToken)}`;
    }
    return origin ? `${origin}${path}` : path;
}

export function shouldAttachNestBearer(): boolean {
    return isNestUiMode();
}
