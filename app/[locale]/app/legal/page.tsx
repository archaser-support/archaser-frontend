import initTranslations from "@/app/i18n";
import TranslationsProvider from "@/components/TranslationsProvider";

import LegalList from "./LegalList";

const i18nNamespaces = ["legal", "common", "activities", "customers"];

export const metadata = {
    title: "Legal Cases",
};

interface PageProps {
    params: Promise<{ locale: string }>;
}

export default async function Page({ params }: PageProps) {
    const { locale } = await params;
    const { t, resources } = await initTranslations(locale, i18nNamespaces);

    return (
        <TranslationsProvider
            namespaces={i18nNamespaces}
            locale={locale}
            resources={resources}
        >
            <LegalList
                title={t("sections.title")}
                description={t("sections.description")}
            />
        </TranslationsProvider>
    );
}
