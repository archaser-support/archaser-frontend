import { Metadata } from "next";

import initTranslations from "@/app/i18n";
import InternalPageWrapper from "@/components/InternalPageWrapper";
import TranslationsProvider from "@/components/TranslationsProvider";

import AccountList from "./AccountList";

const i18nNamespaces = ["accounts", "common"];

export const metadata: Metadata = {
    title: "Accounts - ARchaser",
    description: "Manage customer accounts and their configurations",
};

interface PageParams {
    params: Promise<{
        locale: string;
    }>;
}

export default async function Page({ params }: PageParams) {
    const { locale } = await params;
    const { resources } = await initTranslations(locale, i18nNamespaces);

    return (
        <TranslationsProvider
            namespaces={i18nNamespaces}
            locale={locale}
            resources={resources}
        >
            <InternalPageWrapper>
                <AccountList />
            </InternalPageWrapper>
        </TranslationsProvider>
    );
}
