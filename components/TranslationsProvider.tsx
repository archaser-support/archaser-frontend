"use client";

import { I18nextProvider } from "react-i18next";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterMoment } from "@mui/x-date-pickers/AdapterMoment";
import { ReactNode, useMemo, useEffect } from "react";
import moment from "moment";
import "moment/locale/he";
import "moment/locale/en-gb";
import { Resource, createInstance } from "i18next";
import { useSession } from "next-auth/react";
import { initReactI18next } from "react-i18next/initReactI18next";

import { getMomentAdapterLocale } from "@/utils/datetimeOperations";

export default function TranslationsProvider({
    children,
    locale: translationLocale,
    namespaces,
    resources,
    isPortal = false, // New prop to indicate if this is the portal
}: {
    children: ReactNode;
    locale: string; // This is the language for translations
    namespaces: string[];
    resources: Resource;
    isPortal?: boolean; // Flag to disable session language override
}) {
    const { data: session } = useSession();

    // Determine the effective language for i18n
    // For portal, always use translationLocale (URL locale) and ignore session - URL is source of truth
    const effectiveLanguage = useMemo(() => {
        if (isPortal) {
            // Portal: URL locale is the ONLY source of truth - never change based on session
            return translationLocale;
        }
        // Non-portal: can use session language if available
        if (session?.user?.language) {
            const sessionLang =
                session.user.language === "Hebrew" ? "he" : "en";
            return sessionLang;
        }
        return translationLocale;
    }, [isPortal, translationLocale, session?.user?.language]);

    const i18n = useMemo(() => {
        const instance = createInstance();

        instance.use(initReactI18next);

        // Initialize with resources - for portal, this is set once based on URL and never changes
        instance.init({
            lng: effectiveLanguage,
            resources: resources || {},
            ns: namespaces,
            defaultNS: namespaces[0] || "common",
            fallbackLng: effectiveLanguage,
            nsSeparator: false, // Disable namespace prefixing
            keySeparator: ".",
            initImmediate: false,
            interpolation: {
                escapeValue: false,
            },
        });

        return instance;
    }, [effectiveLanguage, namespaces, resources]);

    // Only update i18n language for non-portal pages when session loads
    // Portal pages: language is set from URL and NEVER changes
    useEffect(() => {
        if (isPortal) {
            // Portal: never change language - URL is source of truth
            return;
        }
        // Non-portal: can update when session loads
        if (i18n && i18n.language !== effectiveLanguage) {
            i18n.changeLanguage(effectiveLanguage);
        }
    }, [effectiveLanguage, i18n, isPortal]);

    // Calendar language follows logged-in user's language when session exists; portal without session uses URL locale
    const momentLocale = useMemo(() => {
        if (isPortal && !session?.user?.language) {
            return translationLocale === "he" ? "he" : "en-gb";
        }
        return getMomentAdapterLocale(session ?? null);
    }, [isPortal, session, translationLocale]);

    useEffect(() => {
        moment.locale(momentLocale);
    }, [momentLocale]);

    return (
        <I18nextProvider i18n={i18n}>
            <LocalizationProvider
                dateAdapter={AdapterMoment}
                adapterLocale={momentLocale}
            >
                {children}
            </LocalizationProvider>
        </I18nextProvider>
    );
}
