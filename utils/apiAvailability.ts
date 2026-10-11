/**
 * Detect API outage for the Amplify UI maintenance overlay.
 * Health must hit the Nest/API host — never Amplify same-origin `/health`.
 */

const listeners = new Set<(down: boolean) => void>();

let unavailable = false;
let checkInFlight: Promise<void> | null = null;

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

/**
 * Absolute Nest `/health` URL for the browser.
 * Reads NEXT_PUBLIC_* directly so Amplify does not depend on isAmplifySsrBuild().
 */
export function resolveHealthUrl(): string {
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
    // Local / EC2 hybrid: same-origin nginx → Nest
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
    const url = `${resolveHealthUrl()}?_=${Date.now()}`;
    try {
        const response = await fetch(url, {
            method: "GET",
            cache: "no-store",
            credentials: "omit",
            mode: "cors",
            signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
            return "up";
        }
        // Nest down → nginx 503; wrong host (Amplify /health 404) → also treat as down
        // so the overlay is not stuck waiting for a gateway-only status.
        return "down";
    } catch {
        // CORS or network failure to a dead/unreachable API host
        return "down";
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

export function markApiAvailable(): void {
    if (!unavailable || typeof window === "undefined") {
        return;
    }
    emit(false);
    window.location.reload();
}
