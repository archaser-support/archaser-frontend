import initTranslations from "@/app/i18n";
import TranslationsProvider from "@/components/TranslationsProvider";
import { getPrismaSafe } from "@/utils/prismaSafe";
import { getServerSessionSafe } from "@/utils/serverSession";

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
    const { t, resources } = await initTranslations(locale, i18nNamespaces);
    const session = await getServerSessionSafe();

    const prisma = await getPrismaSafe();
    const account = prisma
        ? await prisma.account.findUnique({
              where: {
                  id: session?.user.account_id || undefined,
              },
          })
        : null;

    return (
        <TranslationsProvider
            namespaces={i18nNamespaces}
            locale={locale}
            resources={resources}
        >
            <ControlCenterPageShell>
                <InvalidContactsHeader locale={locale} />

                <CustomerWithInvalidContactList
                    clientType={
                        account?.client_type
                            ? (account.client_type as
                                  | "All"
                                  | "Person"
                                  | "Company")
                            : "All"
                    }
                />
            </ControlCenterPageShell>
        </TranslationsProvider>
    );
}
