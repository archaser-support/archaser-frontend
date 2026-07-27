import initTranslations from "@/app/i18n";
import TranslationsProvider from "@/components/TranslationsProvider";

import ResetPasswordContent from "./ResetPasswordContent";

const i18nNamespaces = ["auth", "common"];

export default async function ResetPasswordPage({ params }) {
    const { token } = await params;
    // Force English locale for reset password page
    const { resources } = await initTranslations("en", i18nNamespaces);

    return (
        <TranslationsProvider
            namespaces={i18nNamespaces}
            locale="en"
            resources={resources}
        >
            <ResetPasswordContent token={token} />
        </TranslationsProvider>
    );
}
