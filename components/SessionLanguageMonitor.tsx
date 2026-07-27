"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

import i18nConfig from "@/i18nConfig";

function localeFromPathname(pathname: string | null): string | null {
    if (!pathname) {
        return null;
    }
    const segment = pathname.split("/")[1];
    return i18nConfig.locales.includes(segment) ? segment : null;
}

export default function SessionLanguageMonitor() {
    const { data: session, status } = useSession();
    const pathname = usePathname();

    // Skip all logic for portal routes - portal uses URL as source of truth
    const isPortalRoute = pathname?.includes("/portal/");

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
    }, [status]);

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

        if (status !== "authenticated" || !session?.user?.language) {
            clearTimeout(timeoutId);
            return;
        }

        const pathLocale = localeFromPathname(pathname);
        const expectedLocale = session.user.language === "Hebrew" ? "he" : "en";

        // Only redirect if UserDetails is NOT handling the language change
        const isLanguageChangeInProgress =
            sessionStorage.getItem("languageChangeInProgress") === "true";

        // If language change is in progress, check if we're now on the correct locale
        if (isLanguageChangeInProgress) {
            // If we're on the correct locale, clear the flag (language change completed successfully)
            if (pathLocale === expectedLocale) {
                sessionStorage.removeItem("languageChangeInProgress");
            }
            // Don't redirect if language change is in progress - let it complete
            clearTimeout(timeoutId);
            return;
        }

        const needsLocaleRedirect =
            pathLocale === null || pathLocale !== expectedLocale;

        // Redirect when locale is missing from the URL or does not match session language
        if (needsLocaleRedirect) {
            // Small delay to avoid race conditions with session updates
            const redirectTimeout = setTimeout(() => {
                // Double-check the flag before redirecting (it might have been set during the delay)
                const stillInProgress =
                    sessionStorage.getItem("languageChangeInProgress") ===
                    "true";
                if (!stillInProgress && pathname) {
                    const newPath =
                        pathLocale === null
                            ? `/${expectedLocale}${pathname.startsWith("/") ? pathname : `/${pathname}`}`
                            : pathname.replace(
                                  /^\/[a-z]{2}/,
                                  `/${expectedLocale}`
                              );
                    window.location.href = newPath;
                }
            }, 100);

            return () => {
                clearTimeout(timeoutId);
                clearTimeout(redirectTimeout);
            };
        }

        clearTimeout(timeoutId);
    }, [session?.user?.language, status, pathname, isPortalRoute]);

    return null;
}
