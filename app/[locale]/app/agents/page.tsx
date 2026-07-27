import initTranslations from "@/app/i18n";
import InternalPageWrapper from "@/components/InternalPageWrapper";
import TranslationsProvider from "@/components/TranslationsProvider";

import ReactQueryProvider from "../ReactQueryProvider";
import AgentList from "./AgentList";

const i18nNamespaces = ["agents", "common", "activities", "customers", "business_unit"];

export const metadata = {
    title: "Agents",
};

interface PageProps {
    params: Promise<{
        locale: string;
    }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
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
            <ReactQueryProvider>
                <InternalPageWrapper>
                    <AgentList
                        title={t("sections.title")}
                        description={t("sections.description")}
                    />
                </InternalPageWrapper>
            </ReactQueryProvider>
        </TranslationsProvider>
    );
}
