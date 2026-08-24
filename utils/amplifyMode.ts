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

/**
 * Nest mounts every product controller under `/api` (only `/auth` sits at the
 * root), so a base URL without that suffix would 404 on every request.
 */
function withApiSuffix(baseUrl: string): string {
    const trimmed = baseUrl.replace(/\/$/, "");
    return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

/**
 * Product API base URL for axios / apiFetch.
 *
 * Local Next and EC2 nginx: always same-origin `/api`. Next (or nginx) owns
 * path peels — reports → :3006, sms → :3004, connectors → :3005, everything
 * else → main Nest. Do not point the browser at an absolute Nest URL here.
 *
 * Amplify: there is no same-origin `/api` proxy, so the browser calls Nest
 * directly via `NEXT_PUBLIC_API_BASE_URL` or `NEXT_PUBLIC_NEST_API_BASE_URL`.
 */
export function resolveProductApiBaseUrl(): string {
    if (!isAmplifySsrBuild()) {
        return "/api";
    }
    const explicit = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
    if (explicit) {
        return withApiSuffix(explicit);
    }
    const nest = process.env.NEXT_PUBLIC_NEST_API_BASE_URL?.trim();
    if (nest) {
        return withApiSuffix(nest);
    }
    throw new Error(
        "Amplify UI requires NEXT_PUBLIC_API_BASE_URL or NEXT_PUBLIC_NEST_API_BASE_URL"
    );
}

/**
 * Origin for clients whose paths already include `/api/...` (OpenAPI client).
 * Local Next: empty so `/api/reports` stays same-origin and Next peels it.
 * Amplify: Nest origin without `/api` (nginx peels on that host).
 */
export function resolveProductApiOrigin(): string {
    const productBase = resolveProductApiBaseUrl().replace(/\/$/, "");
    if (productBase === "/api" || productBase.endsWith("/api")) {
        return productBase.slice(0, -"/api".length);
    }
    return productBase;
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
