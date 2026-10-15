/**
 * Deploy maintenance overlay signal — public S3/CloudFront JSON written by
 * GitHub Actions (backend Deploy to EC2 job), not Nest /health.
 *
 * Shape: { deploying, env, updatedAt, workflowRunId?, workflowRunUrl? }
 * Overlay only when deploying===true and updatedAt within MAX_AGE_MS.
 */

const listeners = new Set<(deploying: boolean) => void>();

/** Ignore stuck "deploying: true" older than this. */
export const DEPLOY_STATUS_MAX_AGE_MS = 60 * 60 * 1000;

let overlayActive = false;

export type DeployStatusEnv = "staging" | "production";

export type DeployStatusPayload = {
    deploying: boolean;
    env?: string;
    updatedAt?: string;
    workflowRunId?: string;
    workflowRunUrl?: string;
};

/**
 * True when the UI should poll deploy status (Amplify/staging/portal).
 * Localhost without NEXT_PUBLIC_DEPLOY_STATUS_BASE_URL skips (preview query still works).
 */
export function isDeployStatusPollingEnabled(): boolean {
    return Boolean(resolveDeployStatusBaseUrl());
}

export function resolveDeployStatusBaseUrl(): string | null {
    const raw = process.env.NEXT_PUBLIC_DEPLOY_STATUS_BASE_URL?.trim();
    if (!raw) {
        return null;
    }
    return raw.replace(/\/$/, "");
}

/** Map UI host → status file env name. */
export function resolveDeployStatusEnv(): DeployStatusEnv {
    if (typeof window === "undefined") {
        return "production";
    }
    const host = window.location.hostname.toLowerCase();
    const label = host.split(".")[0] ?? "";
    if (
        label === "staging" ||
        label === "dev" ||
        label === "preprod" ||
        host.startsWith("staging.") ||
        host.includes("localhost") ||
        host === "127.0.0.1"
    ) {
        return "staging";
    }
    return "production";
}

export function resolveDeployStatusUrl(): string | null {
    const base = resolveDeployStatusBaseUrl();
    if (!base) {
        return null;
    }
    return `${base}/${resolveDeployStatusEnv()}.json`;
}

export function subscribeDeployStatus(
    listener: (deploying: boolean) => void
): () => void {
    listeners.add(listener);
    listener(overlayActive);
    return () => {
        listeners.delete(listener);
    };
}

function emit(deploying: boolean): void {
    if (overlayActive === deploying) {
        return;
    }
    overlayActive = deploying;
    for (const listener of listeners) {
        listener(deploying);
    }
}

export function isDeployOverlayActive(): boolean {
    return overlayActive;
}

/** Clear overlay and reload after a real deploy window ends. */
export function clearDeployOverlayAndReload(): void {
    if (typeof window === "undefined") {
        return;
    }
    if (!overlayActive) {
        return;
    }
    emit(false);
    window.location.reload();
}

function isFreshDeploying(payload: DeployStatusPayload): boolean {
    if (!payload.deploying) {
        return false;
    }
    if (!payload.updatedAt) {
        return false;
    }
    const updatedMs = Date.parse(payload.updatedAt);
    if (Number.isNaN(updatedMs)) {
        return false;
    }
    return Date.now() - updatedMs <= DEPLOY_STATUS_MAX_AGE_MS;
}

/**
 * Fetch status JSON. Returns whether a live deploy is signaled.
 * Network/parse failures → not deploying (do not flash overlay).
 */
export async function probeDeployStatus(): Promise<boolean> {
    const statusUrl = resolveDeployStatusUrl();
    if (!statusUrl || typeof window === "undefined") {
        return false;
    }

    const url = `${statusUrl}${statusUrl.includes("?") ? "&" : "?"}_=${Date.now()}`;
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
        if (!response.ok) {
            return false;
        }
        const payload = (await response.json()) as DeployStatusPayload;
        return isFreshDeploying(payload);
    } catch {
        return false;
    } finally {
        window.clearTimeout(timer);
    }
}

/**
 * Poll once and sync overlay state.
 * Transition deploying → idle triggers full reload.
 */
export async function syncDeployOverlayFromStatus(): Promise<void> {
    if (typeof window === "undefined") {
        return;
    }
    const deploying = await probeDeployStatus();
    if (deploying) {
        emit(true);
        return;
    }
    if (overlayActive) {
        clearDeployOverlayAndReload();
    }
}
