/**
 * Pure helpers for SessionLanguageMonitor.
 * Keep redirect decisions here so they stay unit-testable without mounting React.
 */

const LOCALES = ["en", "he"] as const;

export function localeFromPathname(pathname: string | null): string | null {
    if (!pathname) {
        return null;
    }
    const segment = pathname.split("/")[1];
    return (LOCALES as readonly string[]).includes(segment) ? segment : null;
}

/** Auth screens own their own post-login navigation; do not locale-bounce them. */
export function isAuthRoute(pathname: string | null): boolean {
    if (!pathname) {
        return false;
    }
    return (
        pathname.includes("/login") ||
        pathname.includes("/forget-password") ||
        pathname.includes("/reset-password")
    );
}

export function expectedLocaleFromSessionLanguage(
    language: string | undefined | null
): "he" | "en" {
    return language === "Hebrew" ? "he" : "en";
}

export function buildLocaleRedirectPath(
    pathname: string,
    pathLocale: string | null,
    expectedLocale: string
): string {
    if (pathLocale === null) {
        return `/${expectedLocale}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
    }
    return pathname.replace(/^\/[a-z]{2}/, `/${expectedLocale}`);
}

export function shouldRedirectForSessionLocale(args: {
    pathname: string | null;
    status: string;
    sessionLanguage: string | undefined | null;
    languageChangeInProgress: boolean;
    isPortalRoute: boolean;
}): { redirect: false } | { redirect: true; newPath: string } {
    const {
        pathname,
        status,
        sessionLanguage,
        languageChangeInProgress,
        isPortalRoute,
    } = args;

    if (isPortalRoute || isAuthRoute(pathname)) {
        return { redirect: false };
    }

    if (status !== "authenticated" || !sessionLanguage) {
        return { redirect: false };
    }

    if (languageChangeInProgress) {
        return { redirect: false };
    }

    if (!pathname) {
        return { redirect: false };
    }

    const pathLocale = localeFromPathname(pathname);
    const expectedLocale = expectedLocaleFromSessionLanguage(sessionLanguage);
    const needsLocaleRedirect =
        pathLocale === null || pathLocale !== expectedLocale;

    if (!needsLocaleRedirect) {
        return { redirect: false };
    }

    return {
        redirect: true,
        newPath: buildLocaleRedirectPath(pathname, pathLocale, expectedLocale),
    };
}
