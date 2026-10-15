/**
 * Legacy hooks from the /health-based maintenance overlay.
 *
 * Overlay is now driven only by the S3 deploy-status flag
 * (`utils/deployStatus.ts`). These exports remain as no-ops so any
 * leftover call sites do not flash a false “being updated” page.
 */

/** @deprecated Overlay no longer uses /health. No-op. */
export function noteUpstreamUnavailable(
    _requestUrl?: string,
    _status?: number
): void {
    // Intentionally empty — product 502/503 must not open the deploy overlay.
}

/** @deprecated Overlay no longer uses /health. No-op. */
export function noteConfirmedOutage(): void {
    // Intentionally empty.
}

/** @deprecated Overlay no longer uses /health. No-op. */
export function markApiAvailable(): void {
    // Intentionally empty.
}

/** @deprecated Prefer isDeployOverlayActive from deployStatus. */
export function isApiMarkedUnavailable(): boolean {
    return false;
}

/** @deprecated Staging gate removed; polling is gated by NEXT_PUBLIC_DEPLOY_STATUS_BASE_URL. */
export function isDeploymentMaintenanceEnabled(): boolean {
    return true;
}
