"use client";

import { I18nextProvider } from "react-i18next";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterMoment } from "@mui/x-date-pickers/AdapterMoment";
import { ReactNode, useEffect, useMemo, useRef } from "react";
import moment from "moment";
import "moment/locale/he";
import "moment/locale/en-gb";
import { Resource, createInstance, type i18n as I18nInstance } from "i18next";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { initReactI18next } from "react-i18next/initReactI18next";

import { getMomentAdapterLocale } from "@/utils/datetimeOperations";

export default function TranslationsProvider({
    children,
    locale: translationLocale,
    namespaces,
    resources,
    isPortal = false,
    lockLocaleToProp = false,
}: {
    children: ReactNode;
    locale: string;
    namespaces: string[];
    resources: Resource;
    isPortal?: boolean;
    /** When true, never follow session language (auth + portal). */
    lockLocaleToProp?: boolean;
}) {
    const { data: session } = useSession();
    const pathname = usePathname();
    const isAuthRoute =
        pathname?.includes("/login") ||
        pathname?.includes("/forget-password") ||
        pathname?.includes("/reset-password");

    const lockLocale = isPortal || isAuthRoute || lockLocaleToProp;

    const effectiveLanguage = useMemo(() => {
        if (lockLocale) {
            return translationLocale;
        }
        if (session?.user?.language) {
            return session.user.language.toLowerCase() === "hebrew"
                ? "he"
                : "en";
        }
        return translationLocale;
    }, [lockLocale, translationLocale, session?.user?.language]);

    // One i18n instance for the life of this provider. Recreating it (e.g. when
    // RSC refresh passes a new `resources` object after signIn) remounts every
    // consumer — on /login that flashes a blank form before dashboard redirect.
    const i18nRef = useRef<I18nInstance | null>(null);
    if (!i18nRef.current) {
        const instance = createInstance();
        instance.use(initReactI18next);
        instance.init({
            lng: translationLocale,
            resources: resources || {},
            ns: namespaces,
            defaultNS: namespaces[0] || "common",
            fallbackLng: translationLocale,
            nsSeparator: false,
            keySeparator: ".",
            initImmediate: false,
            interpolation: {
                escapeValue: false,
            },
        });
        i18nRef.current = instance;
    }
    const i18n = i18nRef.current;

    useEffect(() => {
        if (i18n.language !== effectiveLanguage) {
            void i18n.changeLanguage(effectiveLanguage);
        }
    }, [effectiveLanguage, i18n]);

    const momentLocale = useMemo(() => {
        if (lockLocale) {
            return translationLocale === "he" ? "he" : "en-gb";
        }
        return getMomentAdapterLocale(session ?? null);
    }, [lockLocale, session, translationLocale]);

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
