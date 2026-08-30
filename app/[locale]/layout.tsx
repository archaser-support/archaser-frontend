import "@/app/globals.scss";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { Metadata } from "next";

import initTranslations from "@/app/i18n";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import EnvironmentIndicator from "@/components/EnvironmentIndicator";
import TranslationsProvider from "@/components/TranslationsProvider";

import Provider, { SessionProviderWrapper } from "./Provider";

const inter = Inter({
    subsets: ["latin"],
    display: "swap",
    preload: true,
});

// Baseline namespaces for all locale routes (app-specific namespaces load in app/layout)
const i18nNamespaces = ["common", "auth"];

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    return {
        title: {
            default: "ARchaser",
            template: "%s | ARchaser",
        },
        description: "Archaser Application",
    };
}

export default async function RootLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const resolvedParams = await params;

    // Pathname is only used to lock portal/auth to the URL locale. Do NOT
    // read the session here — after signIn, an RSC refresh that pulls session
    // language remounts /login (empty form flash) before client navigation.
    // Session language for /app is applied in app/layout.tsx instead.
    const headersList = await headers();
    const pathname =
        headersList.get("x-pathname") ||
        headersList.get("next-url") ||
        "";
    const isPortalContext = pathname.includes("/portal/");
    const isAuthContext =
        pathname.includes("/login") ||
        pathname.includes("/forget-password") ||
        pathname.includes("/reset-password");

    const effectiveLanguage = resolvedParams.locale;

    const { resources } = await initTranslations(
        effectiveLanguage,
        i18nNamespaces
    );

    return (
        <html
            lang={effectiveLanguage}
            dir={effectiveLanguage === "he" ? "rtl" : "ltr"}
            suppressHydrationWarning
        >
            <head>
                <link
                    href="https://fonts.googleapis.com/icon?family=Material+Icons"
                    rel="stylesheet"
                />
            </head>
            <body className={inter.className} suppressHydrationWarning>
                <SessionProviderWrapper>
                    <TranslationsProvider
                        namespaces={i18nNamespaces}
                        locale={effectiveLanguage}
                        resources={resources}
                        isPortal={isPortalContext}
                        lockLocaleToProp={isAuthContext || isPortalContext}
                    >
                        <ErrorBoundary>
                            <Provider>
                                <EnvironmentIndicator />
                                {children}
                            </Provider>
                        </ErrorBoundary>
                    </TranslationsProvider>
                </SessionProviderWrapper>
            </body>
        </html>
    );
}
