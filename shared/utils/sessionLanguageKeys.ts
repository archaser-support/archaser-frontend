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
