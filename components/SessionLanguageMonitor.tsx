"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

import {
    LANGUAGE_CHANGE_STORAGE_KEY,
    LOGIN_HANDOFF_STORAGE_KEY,
    PENDING_LOGIN_REDIRECT_KEY,
} from "@/shared/utils/sessionLanguageKeys";
import {
    expectedLocaleFromSessionLanguage,
    isAuthRoute,
    localeFromPathname,
    shouldRedirectForSessionLocale,
} from "@/shared/utils/sessionLanguageMonitor";

export default function SessionLanguageMonitor() {
    const { data: session, status } = useSession();
    const pathname = usePathname();

    const isPortalRoute = pathname?.includes("/portal/") ?? false;
    const onAuthRoute = isAuthRoute(pathname);

    // Never run locale redirects on login / password screens — login owns navigation.
    useEffect(() => {
        if (isPortalRoute || onAuthRoute) {
            return;
        }

        const timeoutId = setTimeout(() => {
            if (status === "loading") {
                window.location.reload();
            }
        }, 60000);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [status, isPortalRoute, onAuthRoute]);

    useEffect(() => {
        if (isPortalRoute || onAuthRoute) {
            return;
        }

        const languageChangeInProgress =
            typeof window !== "undefined" &&
            sessionStorage.getItem(LANGUAGE_CHANGE_STORAGE_KEY) === "true";

        const loginHandoffInProgress =
            typeof window !== "undefined" &&
            sessionStorage.getItem(LOGIN_HANDOFF_STORAGE_KEY) === "true";

        // Login hard-nav landed on /app — keep handoff briefly so early Nest
        // 401s during boot cannot signOut before the JWT is usable.
        if (loginHandoffInProgress && pathname?.includes("/app")) {
            sessionStorage.removeItem(PENDING_LOGIN_REDIRECT_KEY);
            const clearHandoff = window.setTimeout(() => {
                sessionStorage.removeItem(LOGIN_HANDOFF_STORAGE_KEY);
            }, 8000);
            return () => {
                window.clearTimeout(clearHandoff);
            };
        }

        if (languageChangeInProgress) {
            if (session?.user?.language) {
                const pathLocale = localeFromPathname(pathname);
                const expectedLocale = expectedLocaleFromSessionLanguage(
                    session.user.language
                );
                if (pathLocale === expectedLocale) {
                    sessionStorage.removeItem(LANGUAGE_CHANGE_STORAGE_KEY);
                }
            }
            return;
        }

        const decision = shouldRedirectForSessionLocale({
            pathname,
            status,
            sessionLanguage: session?.user?.language,
            languageChangeInProgress: false,
            loginHandoffInProgress: false,
            isPortalRoute,
        });

        if (!decision.redirect) {
            return;
        }

        const redirectTimeout = setTimeout(() => {
            const stillLanguageChange =
                sessionStorage.getItem(LANGUAGE_CHANGE_STORAGE_KEY) === "true";
            const stillLoginHandoff =
                sessionStorage.getItem(LOGIN_HANDOFF_STORAGE_KEY) === "true";
            if (!stillLanguageChange && !stillLoginHandoff) {
                window.location.href = decision.newPath;
            }
        }, 100);

        return () => {
            clearTimeout(redirectTimeout);
        };
    }, [
        session?.user?.language,
        status,
        pathname,
        isPortalRoute,
        onAuthRoute,
    ]);

    return null;
}
