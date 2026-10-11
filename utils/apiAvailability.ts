import { resolveNestOrigin } from "@/utils/amplifyMode";

const listeners = new Set<(down: boolean) => void>();

let unavailable = false;
let checkInFlight: Promise<void> | null = null;

export function resolveHealthUrl(): string {
    const origin = resolveNestOrigin().replace(/\/$/, "");
    return origin ? `${origin}/health` : "/health";
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
    try {
        const response = await fetch(resolveHealthUrl(), {
            method: "GET",
            cache: "no-store",
            credentials: "omit",
            signal: AbortSignal.timeout(4000),
        });
        if (response.ok) {
            return "up";
        }
        if (
            response.status === 502 ||
            response.status === 503 ||
            response.status === 504
        ) {
            return "down";
        }
        return "unknown";
    } catch {
        return "down";
    }
}

async function confirmOutage(status?: number): Promise<void> {
    if (checkInFlight) {
        return checkInFlight;
    }
    checkInFlight = (async () => {
        const probe = await probeApiHealth();
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
            return;
        }
        const gatewayStatus =
            status === 502 || status === 503 || status === 504;
        if (probe === "down" || (probe === "unknown" && gatewayStatus)) {
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
    status?: number
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
    void confirmOutage(status);
}

export function markApiAvailable(): void {
    if (!unavailable || typeof window === "undefined") {
        return;
    }
    emit(false);
    window.location.reload();
}
