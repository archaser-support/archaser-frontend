import { Metadata } from "next";
import { ReactNode } from "react";

import { AgentPortalProvider } from "@/app/context/AgentPortalContext";
import initTranslations from "@/app/i18n";
import TranslationsProvider from "@/components/TranslationsProvider";

const i18nNamespaces = [
    "customers",
    "common",
    "dashboard",
    "activity_sequences",
    "contacts",
    "bank_accounts",
    "invoices",
    "activities",
    "disputes",
    "reports",
    "generic_fields",
    "settings",
];

interface LayoutProps {
    children: ReactNode;
    params: Promise<{
        customerId: string;
        locale: string;
    }>;
}

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "Customer",
    };
}

const Layout = async ({ children, params }: LayoutProps) => {
    const { customerId: _customerId, locale } = await params;

    const { t, resources } = await initTranslations(locale, i18nNamespaces);

    // if (!customer) {
    //   return (
    //     <TranslationsProvider
    //       namespaces={i18nNamespaces}
    //       locale={locale}
    //       resources={resources}>
    //       <div className="container p-4 mx-auto text-center text-gray-200">
    //         <h2 className="text-3xl font-bold">{t('customer_not_found')}</h2>
    //       </div>
    //     </TranslationsProvider>
    //   );
    // }

    return (
        <TranslationsProvider
            namespaces={i18nNamespaces}
            locale={locale}
            resources={resources}
        >
            <AgentPortalProvider>{children}</AgentPortalProvider>
        </TranslationsProvider>
    );
};

export default Layout;
