import { Typography } from "@mui/material";
import { redirect } from "next/navigation";
import VerificationView from "./components/VerificationView";
import initTranslations from "@/app/i18n";
import TranslationsProvider from "@/components/TranslationsProvider";
import { getMaskedContactEmailAction } from "@/app/actions/portalVerification";
import { cookies } from "next/headers";
import { fetchNestPortalData } from "@/utils/nestPortal";
import { getServerSessionSafe } from "@/utils/serverSession";

interface PageProps {
    params: Promise<{ locale: string; customerUUID: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const i18nNamespaces = ["portal", "common"];

export const dynamic = "force-dynamic";

type VerifyCustomer = {
    id: number;
    language: string;
    Person: { first_name: string | null; last_name: string | null } | null;
    Company: { name: string } | null;
    Account: {
        logo: string | null;
        name: string | null;
        portal_verification_enabled: boolean | null;
    } | null;
};

export default async function VerifyPage({ params, searchParams }: PageProps) {
    const { locale, customerUUID } = await params;
    const { cid, autoSend } = await searchParams;

    const cidValue = Array.isArray(cid) ? cid[0] : cid;
    const parsedContactId = cidValue ? Number.parseInt(cidValue, 10) : Number.NaN;
    const contactId = Number.isFinite(parsedContactId) && parsedContactId > 0
        ? parsedContactId
        : undefined;
    const autoSendValue = Array.isArray(autoSend) ? autoSend[0] : autoSend;
    // If cid is present, auto-send only when explicitly requested.
    // If cid is missing, auto-send to the default contact so user isn't stuck on verify.
    const shouldAutoSend = contactId
        ? autoSendValue === "true"
        : true;

    // Initialize translations
    const { t, resources } = await initTranslations(locale, i18nNamespaces);

    let customer: VerifyCustomer | null = null;
    try {
        const portalData = await fetchNestPortalData(customerUUID);
        if (portalData) {
            customer = {
                id: Number(portalData.customerId ?? portalData.id),
                language: String(portalData.language ?? "English"),
                Person: (portalData.Person as VerifyCustomer["Person"]) ?? null,
                Company:
                    (portalData.Company as VerifyCustomer["Company"]) ?? null,
                Account:
                    (portalData.Account as VerifyCustomer["Account"]) ?? null,
            };
        }
    } catch {
        customer = null;
    }

    if (!customer) {
        return (
            <TranslationsProvider namespaces={i18nNamespaces} locale={locale} resources={resources}>
                <Typography>{t("messages.customer_not_found_error")}</Typography>
            </TranslationsProvider>
        );
    }

    // If portal verification is disabled for this account, skip the verify page
    // and send the user directly to the portal home.
    const verificationEnabled =
        customer.Account?.portal_verification_enabled ?? true;
    if (!verificationEnabled) {
        redirect(`/${locale}/portal/${customerUUID}`);
    }

    // Resolve Customer Name
    let customerName = "Valued Customer";
    if (customer.Company?.name) {
        customerName = customer.Company.name;
    } else if (customer.Person?.first_name) {
        customerName = `${customer.Person.first_name} ${customer.Person.last_name || ''}`.trim();
    } else if (customer.Account?.name) {
        customerName = customer.Account.name; // Fallback
    }

    const logo = customer.Account?.logo || null;

    // Fetch initial masked email to display (using contactId if available)
    let maskedEmail: string | null = null;
    try {
        maskedEmail = await getMaskedContactEmailAction(customerUUID, contactId);
    } catch {
        maskedEmail = null;
    }

    let session: Awaited<ReturnType<typeof getServerSessionSafe>> | null = null;
    try {
        session = await getServerSessionSafe();
    } catch {
        session = null;
    }

    const cookieStore = await cookies();
    const isPortalVerified = Boolean(
        cookieStore.get(`portal_verified_${customerUUID}`)
    );

    // If already verified in this browser session, don't show verify again.
    if (isPortalVerified) {
        redirect(`/${locale}/portal/${customerUUID}`);
    }

    return (
        <TranslationsProvider
            namespaces={i18nNamespaces}
            locale={locale}
            resources={resources}
        >
            <VerificationView
                customerUUID={customerUUID}
                initialMaskedEmail={maskedEmail}
                contactId={contactId}
                autoSend={shouldAutoSend}
                isBypassed={!!session}
            />
        </TranslationsProvider>
    );
}
