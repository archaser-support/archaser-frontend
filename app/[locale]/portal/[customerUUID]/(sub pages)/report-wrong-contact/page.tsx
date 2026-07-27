"use client";
import { apiFetch } from "@/utils/apiFetch";

import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import PortalPageLayout from "../../components/PortalPageLayout";

import WrongContactContainer from "./WrongContactContainer";

type CustomerData = {
    id: number;
    Account?: {
        name: string;
        logo: string | null;
    } | null;
};

export default function Page() {
    const params = useParams();
    const { t, i18n } = useTranslation(["portal", "common"]);
    const [customer, setCustomer] = useState<CustomerData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [logoData, setLogoData] = useState<{
        logo: string | null;
        customerName: string | null;
    } | null>(null);
    const [initialCustomerData, setInitialCustomerData] = useState<{
        logo: string | null;
        customerName: string | null;
    } | null>(null);

    const locale = params?.locale as string;
    const customerUUID = params?.customerUUID as string;

    // Check if current language is Hebrew for RTL support
    const isRTL = i18n.language === "he";

    useEffect(() => {
        const fetchCustomerData = async () => {
            try {
                setLoading(true);
                const response = await apiFetch(`/api/customers/${customerUUID}/wrong-contact`
                );

                if (!response.ok) {
                    throw new Error("Failed to fetch customer data");
                }

                const data = await response.json();
                setCustomer(data);

                // Pass raw logo data to PortalHeader - let it handle processing
                setLogoData({
                    logo: data.Account?.logo, // Raw logo data from API
                    customerName: data.Account?.name || null,
                });

                // Set initial customer data immediately for loading states
                if (!initialCustomerData) {
                    setInitialCustomerData({
                        logo: data.Account?.logo, // Raw logo data from API
                        customerName: data.Account?.name || null,
                    });
                }
            } catch (err) {
                console.error("Error fetching customer data:", err);
                setError(
                    err instanceof Error ? err.message : "An error occurred"
                );
            } finally {
                setLoading(false);
            }
        };

        if (customerUUID) {
            fetchCustomerData();
        }
    }, [customerUUID, initialCustomerData]);

    // No language sync needed - TranslationsProvider initializes i18n with URL locale
    // URL is the source of truth, i18n is initialized correctly on server

    if (loading) {
        return (
            <div dir={isRTL ? "rtl" : "ltr"}>
                <PortalPageLayout
                    title={t("sections.contact_report_wrong_contact_title")}
                    subtitle=""
                >
                    <div />
                </PortalPageLayout>
            </div>
        );
    }

    if (error) {
        return (
            <div dir={isRTL ? "rtl" : "ltr"}>
                <PortalPageLayout
                    title={t("sections.contact_report_wrong_contact_title")}
                    subtitle={t("fields.error_loading_data")}
                >
                    <div />
                </PortalPageLayout>
            </div>
        );
    }

    if (!customer) {
        return (
            <div dir={isRTL ? "rtl" : "ltr"}>
                <PortalPageLayout
                    title={t("fields.general_title")}
                    subtitle={t("fields.customer_not_found")}
                >
                    <div />
                </PortalPageLayout>
            </div>
        );
    }

    return (
        <div dir={isRTL ? "rtl" : "ltr"}>
            <PortalPageLayout
                title={t("sections.contact_report_wrong_contact_title")}
                subtitle={t("fields.contact_report_wrong_contact_subtitle")}
            >
                <WrongContactContainer
                    customerId={customer.id.toString()}
                    customerUUID={customerUUID}
                />
            </PortalPageLayout>
        </div>
    );
}
