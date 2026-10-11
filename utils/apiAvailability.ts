/**
 * Detect API outage for the Amplify UI maintenance overlay.
 * Health must hit the Nest/API host — never Amplify same-origin `/health`.
 */

const listeners = new Set<(down: boolean) => void>();

let unavailable = false;
let checkInFlight: Promise<void> | null = null;

/** Known UI host → Nest origin when env is missing from the client bundle. */
const UI_HOST_TO_NEST_ORIGIN: Record<string, string> = {
    "staging.archaser.com": "https://api.staging.archaser.com",
    "www.staging.archaser.com": "https://api.staging.archaser.com",
    "portal.archaser.com": "https://api.portal.archaser.com",
    "www.portal.archaser.com": "https://api.portal.archaser.com",
};

function originFromEnvUrl(raw: string | undefined | null): string {
    const value = raw?.trim();
    if (!value) {
        return "";
    }
    try {
        const withProtocol = /^https?:\/\//i.test(value)
            ? value
            : `https://${value}`;
        return new URL(withProtocol).origin;
    } catch {
        return "";
    }
}

function nestOriginFromUiHost(): string {
    if (typeof window === "undefined") {
        return "";
    }
    return UI_HOST_TO_NEST_ORIGIN[window.location.hostname] ?? "";
}

/**
 * Absolute Nest `/health` URL for the browser.
 * Prefer NEXT_PUBLIC_* env; fall back to known UI→API host map.
 * Returns null when we must not probe (Amplify without a Nest origin).
 */
export function resolveHealthUrl(): string | null {
    const fromNest = originFromEnvUrl(
        process.env.NEXT_PUBLIC_NEST_API_BASE_URL
    );
    if (fromNest) {
        return `${fromNest}/health`;
    }
    const fromApi = originFromEnvUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
    if (fromApi) {
        return `${fromApi}/health`;
    }
    const fromHost = nestOriginFromUiHost();
    if (fromHost) {
        return `${fromHost}/health`;
    }
    // Amplify UI must never probe its own origin — /health 404 is not Nest down.
    if (process.env.NEXT_PUBLIC_AMPLIFY_UI === "true") {
        return null;
    }
    if (typeof window !== "undefined") {
        return `${window.location.origin}/health`;
    }
    return "/health";
}

export function subscribeApiAvailability(
    listener: (down: boolean) => void
): () => void {
    listeners.add(listener);
    listener(unavailable);
    return () => {
        listeners.delete(listener);
    };
}

function emit(down: boolean): void {
    unavailable = down;
    for (const listener of listeners) {
        listener(down);
    }
}

export type HealthProbe = "up" | "down" | "unknown";

export async function probeApiHealth(): Promise<HealthProbe> {
    const healthPath = resolveHealthUrl();
    if (!healthPath) {
        return "unknown";
    }

    // Guard: never treat Amplify same-origin as Nest outage.
    if (typeof window !== "undefined") {
        try {
            const healthOrigin = new URL(healthPath, window.location.origin)
                .origin;
            if (
                healthOrigin === window.location.origin &&
                process.env.NEXT_PUBLIC_AMPLIFY_UI === "true"
            ) {
                return "unknown";
            }
        } catch {
            return "unknown";
        }
    }

    if (typeof window === "undefined") {
        return "unknown";
    }

    const url = `${healthPath}${healthPath.includes("?") ? "&" : "?"}_=${Date.now()}`;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5000);
    try {
        const response = await fetch(url, {
            method: "GET",
            cache: "no-store",
            credentials: "omit",
            mode: "cors",
            signal: controller.signal,
        });
        if (response.ok) {
            return "up";
        }
        // Nest down → nginx 503 (or other non-OK from the API host)
        return "down";
    } catch {
        return "down";
    } finally {
        window.clearTimeout(timer);
    }
}

async function confirmOutage(): Promise<void> {
    if (checkInFlight) {
        return checkInFlight;
    }
    checkInFlight = (async () => {
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
            return;
        }
        const probe = await probeApiHealth();
        if (probe === "down") {
            emit(true);
        }
    })().finally(() => {
        checkInFlight = null;
    });
    return checkInFlight;
}

/** Gateway or network failure from a product API call. Confirmed with /health. */
export function noteUpstreamUnavailable(
    requestUrl?: string,
    _status?: number
): void {
    if (typeof window === "undefined" || unavailable) {
        return;
    }
    if (requestUrl && requestUrl.includes("/health")) {
        return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return;
    }
    void confirmOutage();
}

/** Direct mark from a proactive /health probe (e.g. on app mount). */
export function noteConfirmedOutage(): void {
    if (typeof window === "undefined" || unavailable) {
        return;
    }
    emit(true);
}

/** Clear overlay and reload once Nest /health is healthy again. */
export function markApiAvailable(): void {
    if (typeof window === "undefined") {
        return;
    }
    if (!unavailable) {
        return;
    }
    emit(false);
    window.location.reload();
}

export function isApiMarkedUnavailable(): boolean {
    return unavailable;
}
