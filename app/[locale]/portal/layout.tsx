import { Box } from "@mui/material";
import Script from "next/script";

import initTranslations from "@/app/i18n";
import PortalThemeRegistry from "@/app/PortalThemeRegistry";
import { PORTAL_SCOPE_CLASS } from "@/app/theme/portalButton";
import TranslationsProvider from "@/components/TranslationsProvider";

const portalI18nNamespaces = ["portal", "invoices"];

export default async function PortalLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const resolvedParams = await params;
    const effectiveLanguage = resolvedParams.locale;

    const { resources } = await initTranslations(
        effectiveLanguage,
        portalI18nNamespaces
    );

    return (
        <TranslationsProvider
            namespaces={portalI18nNamespaces}
            locale={effectiveLanguage}
            resources={resources}
            isPortal
        >
            <PortalThemeRegistry>
            {/* 
                Note: This is Microsoft Clarity analytics script (trusted third-party service)
                The script is hardcoded and not user-generated, so it's safe
            */}
            <Script
                id="clarity-script"
                strategy="afterInteractive"
                dangerouslySetInnerHTML={{
                    __html: `
                        (function(c,l,a,r,i){
                            try {
                                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                                var t=l.createElement(r);
                                t.async=1;
                                t.src="https://www.clarity.ms/tag/"+i;
                                t.onerror=function(){};

                                var y=l.getElementsByTagName(r)[0];
                                var parent=(y && y.parentNode) || l.head || l.body;
                                if (parent) {
                                    parent.appendChild(t);
                                }
                            } catch (e) {
                                // Fail-open: analytics must never break portal rendering
                            }
                        })(window, document, "clarity", "script", "spvfyr7csc");
                    `,
                }}
            />
            {process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && (
                <Script
                    src={`https://www.google.com/recaptcha/api.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}`}
                    strategy="afterInteractive"
                />
            )}
            <Box className={PORTAL_SCOPE_CLASS} sx={{ minHeight: "100vh" }}>
                {children}
            </Box>
        </PortalThemeRegistry>
        </TranslationsProvider>
    );
}
