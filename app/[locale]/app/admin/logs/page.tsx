import initTranslations from "@/app/i18n";
import TranslationsProvider from "@/components/TranslationsProvider";

import LogList from "./LogList";

const i18nNamespaces = ["log", "common"];

export const metadata = {
    title: "System Logs - ARchaser",
};

interface PageProps {
    params: Promise<{
        locale: string;
    }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function Page({ params }: PageProps) {
    const { locale } = await params;
    const { t: _t, resources } = await initTranslations(locale, i18nNamespaces);

    return (
        <TranslationsProvider
            namespaces={i18nNamespaces}
            locale={locale}
            resources={resources}
        >
            <div className="p-4">
                <LogList />
            </div>
        </TranslationsProvider>
    );
}
