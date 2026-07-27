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

/** Nest owns product APIs + auth (Amplify UI or Nest auth flag). */
export function isNestUiMode(): boolean {
    return (
        isAmplifySsrBuild() ||
        process.env.NEXT_PUBLIC_USE_NEST_AUTH === "true"
    );
}

/**
 * Realtime EventSource (/api/ws) — off by default on Amplify until Nest owns WS.
 * Set NEXT_PUBLIC_ENABLE_WS=true to opt in (EC2 hybrid).
 */
export function isWebSocketEnabled(): boolean {
    if (isAmplifySsrBuild() && process.env.NEXT_PUBLIC_ENABLE_WS !== "true") {
        return false;
    }
    return process.env.NEXT_PUBLIC_ENABLE_WS !== "false";
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

export function shouldAttachNestBearer(): boolean {
    return isNestUiMode();
}
