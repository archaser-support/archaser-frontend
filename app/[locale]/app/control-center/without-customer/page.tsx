import initTranslations from "@/app/i18n";
import TranslationsProvider from "@/components/TranslationsProvider";
import ControlCenterPageShell from "../ControlCenterPageShell";
import InvoicesWithoutCustomerList from "./InvoicesWithoutCustomerList";
import WithoutCustomerHeader from "./WithoutCustomerHeader";

const i18nNamespaces = ["control_center", "invoices", "customers", "common"];

export const metadata = {
    title: "Invoices Without Customer",
};

export default async function InvoicesWithoutCustomerPage({
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
                <WithoutCustomerHeader />

                <InvoicesWithoutCustomerList />
            </ControlCenterPageShell>
        </TranslationsProvider>
    );
}
