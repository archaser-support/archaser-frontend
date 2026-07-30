import initTranslations from "@/app/i18n";
import TranslationsProvider from "@/components/TranslationsProvider";
import ControlCenterPageShell from "../../ControlCenterPageShell";
import CustomerWithInvalidContactList from "./CustomerWithInvalidContactList";
import InvalidContactsHeader from "./InvalidContactsHeader";

const i18nNamespaces = ["control_center", "contacts", "customers", "common"];

export const metadata = {
    title: "Customers With Invalid Contact",
};

export default async function InvalidContactsPage({
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
                <InvalidContactsHeader locale={locale} />

                <CustomerWithInvalidContactList />
            </ControlCenterPageShell>
        </TranslationsProvider>
    );
}
