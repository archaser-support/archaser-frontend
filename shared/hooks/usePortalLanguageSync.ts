"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

/**
 * Hook to synchronize portal language with URL locale
 * This ensures language persists when navigating between portal pages
 *
 * @param customerUUID - The UUID of the customer (for session storage key)
 */
export const usePortalLanguageSync = (customerUUID: string) => {
    const { i18n } = useTranslation(["portal", "common"]);
    const params = useParams();
    const locale = params?.locale as string | undefined;
    const isInitialMount = useRef(true);

    useEffect(() => {
        if (typeof window === "undefined") return; // Skip on server-side
        if (!customerUUID) return; // Skip if no customerUUID

        const urlLocale =
            window.location.pathname.match(/^\/([a-z]{2})\//)?.[1];
        const manualSwitch = sessionStorage.getItem(
            `portal_manual_switch_${customerUUID}`
        );
        const sessionPreference = sessionStorage.getItem(
            `portal_language_preference_${customerUUID}`
        );
        const currentLanguage = i18n.language;

        // On initial mount or when locale/customerUUID changes, sync with URL
        if (isInitialMount.current || urlLocale || locale) {
            if (manualSwitch === "true" && sessionPreference) {
                // User manually switched language - respect their choice for this session
                if (currentLanguage !== sessionPreference) {
                    i18n.changeLanguage(sessionPreference);
                }
            } else {
                // Use URL locale (either from pathname or params)
                const targetLocale = urlLocale || locale;
                if (targetLocale && currentLanguage !== targetLocale) {
                    i18n.changeLanguage(targetLocale);
                }
            }
            isInitialMount.current = false;
            return;
        }

        // After initial mount, only sync if URL locale changes
        const targetLocale = urlLocale || locale;
        if (
            targetLocale &&
            currentLanguage !== targetLocale &&
            manualSwitch !== "true"
        ) {
            i18n.changeLanguage(targetLocale);
        }
    }, [customerUUID, locale]); // Don't include i18n.language to prevent loops - we only sync FROM URL TO i18n

    return { currentLanguage: i18n.language };
};
