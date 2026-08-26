"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

import {
    expectedLocaleFromSessionLanguage,
    localeFromPathname,
    shouldRedirectForSessionLocale,
} from "@/shared/utils/sessionLanguageMonitor";

export default function SessionLanguageMonitor() {
    const { data: session, status } = useSession();
    const pathname = usePathname();

    // Skip all logic for portal routes - portal uses URL as source of truth
    const isPortalRoute = pathname?.includes("/portal/") ?? false;

    // Add timeout to force session resolution
    useEffect(() => {
        if (isPortalRoute) return;
        const timeoutId = setTimeout(() => {
            if (status === "loading") {
                // Force a page reload to break the loading state
                window.location.reload();
            }
        }, 60000); // 60 second timeout

        return () => {
            clearTimeout(timeoutId);
        };
    }, [status, isPortalRoute]);

    useEffect(() => {
        // Skip all logic for portal routes - portal uses URL as source of truth
        if (isPortalRoute) {
            return;
        }

        // Add timeout to prevent hanging
        const timeoutId = setTimeout(() => {
            if (status === "loading") {
                // Timeout handling
            }
        }, 60000); // 60 second timeout

        const languageChangeInProgress =
            typeof window !== "undefined" &&
            sessionStorage.getItem("languageChangeInProgress") === "true";

        // While UserDetails owns the locale hard-nav, never issue a competing redirect.
        // Clear the flag only after path locale matches the (already updated) session.
        if (languageChangeInProgress) {
            if (session?.user?.language) {
                const pathLocale = localeFromPathname(pathname);
                const expectedLocale = expectedLocaleFromSessionLanguage(
                    session.user.language
                );
                if (pathLocale === expectedLocale) {
                    sessionStorage.removeItem("languageChangeInProgress");
                }
            }
            clearTimeout(timeoutId);
            return;
        }

        const decision = shouldRedirectForSessionLocale({
            pathname,
            status,
            sessionLanguage: session?.user?.language,
            languageChangeInProgress: false,
            isPortalRoute,
        });

        if (!decision.redirect) {
            clearTimeout(timeoutId);
            return;
        }

        // Small delay to avoid race conditions with session updates
        const redirectTimeout = setTimeout(() => {
            // Double-check the flag before redirecting (it might have been set during the delay)
            const stillInProgress =
                sessionStorage.getItem("languageChangeInProgress") === "true";
            if (!stillInProgress) {
                window.location.href = decision.newPath;
            }
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            clearTimeout(redirectTimeout);
        };
    }, [session?.user?.language, status, pathname, isPortalRoute]);

    return null;
}
