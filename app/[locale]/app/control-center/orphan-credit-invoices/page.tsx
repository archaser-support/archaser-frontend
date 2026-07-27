import initTranslations from "@/app/i18n";
import TranslationsProvider from "@/components/TranslationsProvider";
import { getPrismaSafe } from "@/utils/prismaSafe";
import { getServerSessionSafe } from "@/utils/serverSession";

import ControlCenterPageShell from "../ControlCenterPageShell";
import OrphanCreditInvoicesHeader from "./OrphanCreditInvoicesHeader";
import OrphanCreditInvoicesList from "./OrphanCreditInvoicesList";

const i18nNamespaces = ["control_center", "invoices", "customers", "common"];

export const metadata = {
    title: "Orphan Credit Invoices",
};

export default async function OrphanCreditInvoicesPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    const { t: _t, resources } = await initTranslations(locale, i18nNamespaces);
    const session = await getServerSessionSafe();

    const prisma = await getPrismaSafe();
    if (prisma) {
        await prisma.customer.findUnique({
            where: {
                id: session?.user.account_id || undefined,
            },
        });
    }

    return (
        <TranslationsProvider
            namespaces={i18nNamespaces}
            locale={locale}
            resources={resources}
        >
            <ControlCenterPageShell>
                <OrphanCreditInvoicesHeader locale={locale} />

                <OrphanCreditInvoicesList />
            </ControlCenterPageShell>
        </TranslationsProvider>
    );
}
