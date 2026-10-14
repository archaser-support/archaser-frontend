/**
 * Detect API outage for the Amplify UI maintenance overlay.
 * Health must hit the Nest/API host — never Amplify same-origin `/health`.
 *
 * Transient blips (one failed probe or a brief 502/503 under load) must not
 * flash the overlay + reload. Require consecutive failed /health probes, and
 * only hard-reload after a sustained outage (typical real deploy).
 */

const listeners = new Set<(down: boolean) => void>();

/** Failed /health probes in a row before showing the overlay. */
const FAILURES_BEFORE_OVERLAY = 2;
/** Only full-page reload when Nest was down at least this long. */
const RELOAD_AFTER_MS = 15_000;

let unavailable = false;
let consecutiveFailures = 0;
let unavailableSince: number | null = null;
let checkInFlight: Promise<void> | null = null;

/** Known UI host → Nest origin when env is missing from the client bundle. */
const UI_HOST_TO_NEST_ORIGIN: Record<string, string> = {
    "staging.archaser.com": "https://api.staging.archaser.com",
    "www.staging.archaser.com": "https://api.staging.archaser.com",
    "portal.archaser.com": "https://api.portal.archaser.com",
    "www.portal.archaser.com": "https://api.portal.archaser.com",
};

/**
 * Temporary: skip /health polling and the deploy maintenance overlay on staging.
 * Production keeps the overlay. Remove this gate when staging is stable enough.
 */
export function isDeploymentMaintenanceEnabled(): boolean {
    if (typeof window === "undefined") {
        return true;
    }
    const host = window.location.hostname.toLowerCase();
    if (
        host === "staging.archaser.com" ||
        host === "www.staging.archaser.com" ||
        host.startsWith("staging.")
    ) {
        return false;
    }
    return true;
}

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

function recordHealthDown(): void {
    consecutiveFailures += 1;
    if (consecutiveFailures < FAILURES_BEFORE_OVERLAY || unavailable) {
        return;
    }
    unavailableSince = Date.now();
    emit(true);
}

function recordHealthUp(): void {
    consecutiveFailures = 0;
    if (!unavailable) {
        return;
    }
    const downForMs = unavailableSince
        ? Date.now() - unavailableSince
        : 0;
    unavailableSince = null;
    emit(false);
    // Brief false-positive overlays: hide without reload. Sustained outage
    // (real deploy): reload so failed in-flight UI state is recovered.
    if (downForMs >= RELOAD_AFTER_MS) {
        window.location.reload();
    }
}

export type HealthProbe = "up" | "down" | "unknown";

export async function probeApiHealth(): Promise<HealthProbe> {
    if (!isDeploymentMaintenanceEnabled()) {
        return "unknown";
    }
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
            recordHealthDown();
        } else if (probe === "up") {
            recordHealthUp();
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
    if (!isDeploymentMaintenanceEnabled()) {
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

/** Proactive /health probe reported down (e.g. app mount / poll). */
export function noteConfirmedOutage(): void {
    if (typeof window === "undefined" || unavailable) {
        return;
    }
    if (!isDeploymentMaintenanceEnabled()) {
        return;
    }
    recordHealthDown();
}

/** Clear overlay once Nest /health is healthy again (reload only if sustained). */
export function markApiAvailable(): void {
    if (typeof window === "undefined") {
        return;
    }
    recordHealthUp();
}

export function isApiMarkedUnavailable(): boolean {
    return unavailable;
}
