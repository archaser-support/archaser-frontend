import initTranslations from "@/app/i18n";
import TranslationsProvider from "@/components/TranslationsProvider";
import { getServerSessionSafe } from "@/utils/serverSession";

import AppShell from "./AppShell";

const localeI18nNamespaces = ["common", "auth"] as const;

const appI18nNamespaces = [
    ...localeI18nNamespaces,
    "dashboard",
    "customers",
    "accounts",
    "invoices",
    "disputes",
    "promise_to_pay",
    "agents",
    "activities",
    "notifications",
    "settings",
    "users",
    "bank_accounts",
    "legal",
    "sms",
    "import",
    "control_center",
    "activity_sequences",
    "activity_templates",
    "contacts",
    "business_unit",
    "security_roles",
    "reports",
    "generic_fields",
];

function resolveEffectiveLanguage(
    locale: string,
    userLanguage: string | null | undefined
): string {
    if (userLanguage === "Hebrew") return "he";
    if (userLanguage === "English") return "en";
    return locale;
}

export default async function AppLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    const session = await getServerSessionSafe();
    const effectiveLanguage = resolveEffectiveLanguage(
        locale,
        session?.user?.language
    );

    const { resources } = await initTranslations(
        effectiveLanguage,
        [...appI18nNamespaces]
    );

    return (
        <TranslationsProvider
            namespaces={[...appI18nNamespaces]}
            locale={effectiveLanguage}
            resources={resources}
        >
            <AppShell>{children}</AppShell>
        </TranslationsProvider>
    );
}
