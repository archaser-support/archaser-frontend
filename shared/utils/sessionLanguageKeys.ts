/**
 * Storage keys shared by login handoff and language-change flows.
 * Keep in a tiny module so webpack always resolves the named exports.
 */

/** Set by login before hard-nav; blocks locale bounce on first /app paint. */
export const LOGIN_HANDOFF_STORAGE_KEY = "loginHandoffInProgress";

/** Set by UserDetails before session update + locale hard-nav. */
export const LANGUAGE_CHANGE_STORAGE_KEY = "languageChangeInProgress";

/** Survives remount/reload mid-login so we resume straight to the app. */
export const PENDING_LOGIN_REDIRECT_KEY = "pendingLoginRedirect";

/** Set before hard-nav to login so /app does not paint 401 load errors. */
export const LOGOUT_IN_PROGRESS_STORAGE_KEY = "logoutInProgress";

export function isLogoutInProgress(): boolean {
    if (typeof window === "undefined") {
        return false;
    }
    try {
        return sessionStorage.getItem(LOGOUT_IN_PROGRESS_STORAGE_KEY) === "true";
    } catch {
        return false;
    }
}

export function markLogoutInProgress(): void {
    if (typeof window === "undefined") {
        return;
    }
    try {
        sessionStorage.setItem(LOGOUT_IN_PROGRESS_STORAGE_KEY, "true");
    } catch {
        // storage may be unavailable
    }
}

export function clearLogoutInProgress(): void {
    if (typeof window === "undefined") {
        return;
    }
    try {
        sessionStorage.removeItem(LOGOUT_IN_PROGRESS_STORAGE_KEY);
    } catch {
        // storage may be unavailable
    }
}
