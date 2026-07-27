"use client";
import { apiFetch } from "@/utils/apiFetch";

import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { PortalInvoice } from "@/types/PortalInvoice";

import PortalPageLayout from "../../components/PortalPageLayout";

import InvoiceList from "./InvoiceList";

type Reason = {
    id: number;
    name: string;
    editable: boolean | null;
};

type CustomerDetails = {
    customer_id: number;
    invoices: PortalInvoice[];
    reasons: Reason[];
    isOpenDispute: boolean;
} | null;

export default function Page() {
    const params = useParams();
    const { t, i18n } = useTranslation(["portal", "common"]);
    const [customerDetails, setCustomerDetails] =
        useState<CustomerDetails>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
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

    const fetchLogoData = async () => {
        try {
            const response = await apiFetch(`/api/customers/${customerUUID}/portal-data`
            );

            if (response.ok) {
                const data = await response.json();

                // Pass raw logo data to PortalHeader - let it handle processing
                setLogoData({
                    logo: data.logo, // Raw logo data from API
                    customerName: data.customerName,
                });

                // Set initial customer data immediately for loading states
                if (!initialCustomerData) {
                    setInitialCustomerData({
                        logo: data.logo, // Raw logo data from API
                        customerName: data.customerName,
                    });
                }
            }
        } catch (err) {
            console.error("Error fetching logo data:", err);
        }
    };

    const fetchDisputeData = async () => {
        try {
            setLoading(true);
            const response = await apiFetch(`/api/customers/${customerUUID}/agent-portal`
            );

            if (!response.ok) {
                throw new Error("Failed to fetch agent portal data");
            }

            const data = await response.json();
            setCustomerDetails(data);
        } catch (err) {
            console.error("Error fetching agent portal data:", err);
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (customerUUID) {
            fetchLogoData();
            fetchDisputeData();
        }
    }, [customerUUID, refreshTrigger]);

    // Function to trigger refresh of invoice data
    const handleRefreshInvoices = () => {
        setRefreshTrigger((prev) => prev + 1);
    };

    // No language sync needed - TranslationsProvider initializes i18n with URL locale
    // URL is the source of truth, i18n is initialized correctly on server

    if (loading) {
        return (
            <PortalPageLayout
                title={t("fields.agent_portal.title")}
                subtitle=""
            >
                <div />
            </PortalPageLayout>
        );
    }

    if (error) {
        return (
            <PortalPageLayout
                title={t("fields.agent_portal.title")}
                subtitle={t("fields.error_loading_data")}
            >
                <div />
            </PortalPageLayout>
        );
    }

    if (!customerDetails) {
        return (
            <PortalPageLayout
                title={t("fields.agent_portal.title")}
                subtitle={t("fields.customer_not_found")}
            >
                <div />
            </PortalPageLayout>
        );
    }

    return (
        <PortalPageLayout
            title={t("fields.agent_portal.title")}
            subtitle={t("fields.agent_portal.subtitle")}
        >
            <InvoiceList
                customer_id={customerDetails.customer_id}
                invoices={customerDetails.invoices}
                reasons={customerDetails.reasons}
                onRefreshInvoices={handleRefreshInvoices}
            />
        </PortalPageLayout>
    );
}
