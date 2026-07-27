import { Box, Typography } from "@mui/material";
import type { Metadata } from "next";

import initTranslations from "@/app/i18n";
import { PORTAL_SCOPE_CLASS } from "@/app/theme/portalButton";
import TranslationsProvider from "@/components/TranslationsProvider";
import { fetchNestPortalData } from "@/utils/nestPortal";
import { getServerSessionSafe } from "@/utils/serverSession";

import PortalFooter from "./components/PortalFooter";
import PortalHeader from "./components/PortalHeader";
import PortalHome from "./PortalHome";

const i18nNamespaces: string[] = ["portal", "invoices", "common"];

// Disable caching for this page to ensure fresh data
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
    params: Promise<{ locale: string; customerUUID: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export type ICustomerDetails = {
    customerId: number;
    customerUUID: string;
    customerName: string;
    accountName: string;
    totalOverdue: number;
    logo: string | null;
    customerType: string;
    currency?: string;
    dispute: Record<string, unknown> | null;
    promise_to_pay: number;
    CustomerCollectionPeriod: {
        id: number;
        total_outstanding_amount: number | null;
        currency: string | null;
        customer_outstanding_amount1: number | null;
        customer_currency1: string | null;
        customer_outstanding_amount2: number | null;
        customer_currency2: string | null;
        promise_to_pay_count: number;
        promise_to_pay_date: Date | null;
        period_start_date: Date;
        period_end_date: Date | null;
    };
    // Add due amount fields
    total_due_amount?: number | null;
    customer_due_amount1?: number | null;
    customer_due_currency1?: string | null;
    customer_due_amount2?: number | null;
    customer_due_currency2?: string | null;
    // Add overdue fields from customer table
    total_invoices_overdue?: number | null;
    number_of_overdue_invoices?: number | null;
    isPromiseToPayAllowed?: boolean;
    nextPaymentDate?: string; // ISO string of the raw date
    isPromiseToPayMaxedOut?: boolean;
    disputeCount?: number;
    sub_domain?: string | null;
    language: string;
    portal_verification_enabled?: boolean;
};

async function getCustomerDetails(
    customerUUID: string
): Promise<ICustomerDetails | null> {
    const data = await fetchNestPortalData(customerUUID);
    if (!data) {
        return null;
    }
    const period = data.CustomerCollectionPeriod as
        | ICustomerDetails["CustomerCollectionPeriod"]
        | undefined;
    return {
        ...(data as unknown as ICustomerDetails),
        CustomerCollectionPeriod: period
            ? {
                  ...period,
                  promise_to_pay_date: period.promise_to_pay_date
                      ? new Date(period.promise_to_pay_date as unknown as string)
                      : null,
                  period_start_date: new Date(
                      period.period_start_date as unknown as string
                  ),
                  period_end_date: period.period_end_date
                      ? new Date(period.period_end_date as unknown as string)
                      : null,
              }
            : (data.CustomerCollectionPeriod as ICustomerDetails["CustomerCollectionPeriod"]),
    };
}

function resolvePortalLocale(
    locale: string,
    customerLanguage?: string
): string {
    return (
        locale ||
        (customerLanguage === "Hebrew"
            ? "he"
            : customerLanguage === "English"
              ? "en"
              : "en")
    );
}

export async function generateMetadata({
    params,
}: Pick<PageProps, "params">): Promise<Metadata> {
    const { locale, customerUUID } = await params;
    const customerDetails = await getCustomerDetails(customerUUID);
    const effectiveLanguage = resolvePortalLocale(
        locale,
        customerDetails?.language
    );
    const { t } = await initTranslations(effectiveLanguage, i18nNamespaces);

    if (!customerDetails) {
        return { title: t("fields.general_title") };
    }

    return {
        title: `${t("fields.general_account_summary_for")} ${customerDetails.customerName}`.trim(),
    };
}

import { redirect } from "next/navigation";
import { cookies } from "next/headers";

async function getDefaultContactIdForCustomer(
    _customerUUID: string
): Promise<number | undefined> {
    void _customerUUID;
    return undefined;
}

export default async function Page({ params, searchParams }: PageProps) {
    const { locale, customerUUID } = await params;
    const { cid } = await searchParams;
    const customerDetails = await getCustomerDetails(customerUUID);
    const session = await getServerSessionSafe();
    const cookieStore = await cookies();
    const isPortalVerified = Boolean(
        cookieStore.get(`portal_verified_${customerUUID}`)
    );
    const cidValue = Array.isArray(cid) ? cid[0] : cid;
    const resolvedCid =
        cidValue && `${cidValue}`.trim().length > 0
            ? `${cidValue}`.trim()
            : undefined;

    // If verification is enabled and user is not authenticated, always route through /verify.
    // Resolve cid from URL first; otherwise fallback to the customer's default active contact.
    if (
        !session &&
        !isPortalVerified &&
        (customerDetails?.portal_verification_enabled ?? true)
    ) {
        const fallbackCid = await getDefaultContactIdForCustomer(customerUUID);
        const cidToUse = resolvedCid ?? (fallbackCid ? `${fallbackCid}` : undefined);

        if (cidToUse) {
            redirect(
                `/${locale}/portal/${customerUUID}/verify?cid=${encodeURIComponent(cidToUse)}&autoSend=true`
            );
        }

        redirect(`/${locale}/portal/${customerUUID}/verify`);
    }

    // Check for portal verification - RELY ON PORTAL LAYOUT
    // Skip verification if user is logged in (session exists)
    // const session = await getServerSession(authOptions);

    // if (!session && customerDetails && (customerDetails.portal_verification_enabled ?? true)) {
    //     const cookieStore = await cookies();
    //     const verificationCookie = cookieStore.get(`portal_verified_${customerUUID}`);

    //     if (!verificationCookie) {
    //         redirect(`/${locale}/portal/${customerUUID}/verify`);
    //     }
    // }

    // Use URL locale as primary source (respects the link they clicked from email)
    // Fall back to customer's language preference if URL locale is missing
    // This ensures portal opens in customer's preferred language initially
    const effectiveLanguage =
        locale ||
        (customerDetails?.language === "Hebrew"
            ? "he"
            : customerDetails?.language === "English"
                ? "en"
                : "en");

    const { t, resources } = await initTranslations(
        effectiveLanguage,
        i18nNamespaces
    );

    if (!customerDetails) {
        return (
            <TranslationsProvider
                namespaces={i18nNamespaces}
                locale={effectiveLanguage}
                resources={resources}
            >
                <Box sx={{ padding: "16px" }}>
                    <Typography
                        variant="h2"
                        sx={{
                            marginBottom: "8px",
                            fontSize: "1.875rem",
                            fontWeight: 700,
                        }}
                    >
                        {t("fields.title")}
                    </Typography>
                    <Typography variant="body1">
                        {t("messages.general_no_data_found")}
                    </Typography>
                </Box>
            </TranslationsProvider>
        );
    }

    return (
        <Box
            className={PORTAL_SCOPE_CLASS}
            sx={{
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
            }}
        >
            {/* Header with menu - shows Account name */}
            <PortalHeader
                logo={customerDetails.logo}
                customerName={customerDetails.accountName}
                customerUUID={customerUUID}
            />

            <Box
                sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                }}
            >
                <PortalHome customerDetails={customerDetails} />
            </Box>
            <Box sx={{ mt: { xs: 0, sm: 2 } }}>
                <PortalFooter />
            </Box>
        </Box>
    );
}
