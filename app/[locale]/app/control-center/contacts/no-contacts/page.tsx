import initTranslations from "@/app/i18n";
import TranslationsProvider from "@/components/TranslationsProvider";
import ControlCenterPageShell from "../../ControlCenterPageShell";

import CustomersWithoutContactList from "./CustomersWithoutContactList";
import NoContactsHeader from "./NoContactsHeader";

const i18nNamespaces = ["control_center", "customers", "common", "contacts"];

export const metadata = {
    title: "Customers Without Contact",
};

export default async function NoContactsPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    const { resources } = await initTranslations(locale, i18nNamespaces);

    return (
        <TranslationsProvider
            namespaces={i18nNamespaces}
            locale={locale}
            resources={resources}
        >
            <ControlCenterPageShell>
                <NoContactsHeader locale={locale} />

                <CustomersWithoutContactList />
            </ControlCenterPageShell>
        </TranslationsProvider>
    );
}
