import "@/app/globals.scss";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { Metadata } from "next";

import initTranslations from "@/app/i18n";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import EnvironmentIndicator from "@/components/EnvironmentIndicator";
import TranslationsProvider from "@/components/TranslationsProvider";
import { getServerSessionSafe } from "@/utils/serverSession";

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

    // Check if we're in portal context by examining the pathname
    const headersList = await headers();
    const pathname =
        headersList.get("x-pathname") ||
        headersList.get("next-url") ||
        "";
    const isPortalContext = pathname.includes("/portal/");

    let effectiveLanguage = resolvedParams.locale;

    // Only check user session for non-portal contexts
    if (!isPortalContext) {
        const session = await getServerSessionSafe();
        const userLanguage = session?.user?.language;
        effectiveLanguage =
            userLanguage === "Hebrew"
                ? "he"
                : userLanguage === "English"
                    ? "en"
                    : resolvedParams.locale;
    }

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
