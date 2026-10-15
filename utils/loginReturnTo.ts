export const LOGIN_RETURN_TO_KEY = "archaser_login_return_to";

const APP_PATH = /^\/(?:en|he)\/app(?:\/|$)|^\/app(?:\/|$)/;

/** Keep only in-app paths so login cannot redirect off-site. */
export function sanitizeReturnTo(
    value: string | null | undefined
): string | null {
    if (!value) {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
        return null;
    }
    if (trimmed.includes("\\") || trimmed.includes("://")) {
        return null;
    }
    const pathOnly = trimmed.split(/[?#]/)[0] ?? "";
    if (!APP_PATH.test(pathOnly) || pathOnly.includes("/login")) {
        return null;
    }
    return trimmed;
}

export function loginUrlWithReturnTo(
    locale: string,
    currentPath: string
): string {
    const safeLocale = locale === "he" ? "he" : "en";
    const safe = sanitizeReturnTo(currentPath);
    if (!safe) {
        return `/${safeLocale}/login`;
    }
    return `/${safeLocale}/login?returnTo=${encodeURIComponent(safe)}`;
}

export function rememberLoginReturnTo(value: string | null | undefined): void {
    if (typeof window === "undefined") {
        return;
    }
    const safe = sanitizeReturnTo(value);
    if (safe) {
        sessionStorage.setItem(LOGIN_RETURN_TO_KEY, safe);
        return;
    }
    sessionStorage.removeItem(LOGIN_RETURN_TO_KEY);
}

export function readLoginReturnTo(
    queryValue: string | null | undefined
): string | null {
    const fromQuery = sanitizeReturnTo(queryValue);
    if (fromQuery) {
        return fromQuery;
    }
    if (typeof window === "undefined") {
        return null;
    }
    return sanitizeReturnTo(sessionStorage.getItem(LOGIN_RETURN_TO_KEY));
}

export function resolvePostLoginPath(
    returnTo: string | null | undefined,
    fallback: string
): string {
    return sanitizeReturnTo(returnTo) ?? fallback;
}
