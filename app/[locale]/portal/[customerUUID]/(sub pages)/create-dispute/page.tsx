"use client";
import { apiFetch } from "@/utils/apiFetch";

import { Box, CircularProgress, Typography } from "@mui/material";
import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { PortalInvoice } from "@/types/PortalInvoice";

import PortalPageLayout from "../../components/PortalPageLayout";

import InvoiceSelector from "./InvoiceSelector";

type Reason = {
    id: number;
    name: string;
    editable: boolean | null;
};

type CustomerDetails = {
    customer_id: number;
    invoices: PortalInvoice[];
    reasons: Reason[];
    customerName: string | null;
    logo: string | null;
    sub_domain: string | null;
    hasDisputedInvoices: boolean;
    language: string;
};

export default function Page() {
    const params = useParams();
    const { t, i18n } = useTranslation(["portal", "disputes", "common"]);
    const [customerDetails, setCustomerDetails] =
        useState<CustomerDetails | null>(null);
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

    const fetchDisputeData = async () => {
        try {
            setLoading(true);
            // Use URL locale as source of truth
            const portalLanguage = locale || "en";

            const response = await apiFetch(`/api/customers/${customerUUID}/create-dispute?language=${portalLanguage}`
            );

            if (!response.ok) {
                throw new Error("Failed to fetch dispute data");
            }

            const data = await response.json();
            setCustomerDetails(data);

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
        } catch (err) {
            console.error("Error fetching dispute data:", err);
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (customerUUID) {
            fetchDisputeData();
        }
    }, [customerUUID, refreshTrigger, locale]);

    // Function to trigger refresh of invoice data
    const handleRefreshInvoices = () => {
        setRefreshTrigger((prev) => prev + 1);
    };

    // No language sync needed - TranslationsProvider initializes i18n with URL locale
    // URL is the source of truth, i18n is initialized correctly on server

    if (loading) {
        return (
            <PortalPageLayout title="" subtitle="">
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: "60vh",
                        gap: 2,
                    }}
                >
                    <CircularProgress
                        size={60}
                        sx={{
                            color: (theme) => theme.palette.primary.main,
                        }}
                    />
                    <Typography variant="body1" color="text.secondary" />
                </Box>
            </PortalPageLayout>
        );
    }

    if (error) {
        return (
            <PortalPageLayout
                title={t("fields.dispute_creation_create_dispute_title")}
                subtitle={t("fields.error_loading_data")}
            >
                <div />
            </PortalPageLayout>
        );
    }

    if (!customerDetails) {
        return (
            <PortalPageLayout
                title={t("fields.dispute_creation.create_dispute_title")}
                subtitle={t("fields.customer_not_found")}
            >
                <div />
            </PortalPageLayout>
        );
    }

    // Hide subtitle if there are no available invoices
    const hasAvailableInvoices = customerDetails.invoices.length > 0;
    const subtitle = hasAvailableInvoices
        ? t("fields.dispute_creation_create_dispute_subtitle", { ns: "portal" })
        : "";

    return (
        <PortalPageLayout
            title={t("actions.dispute_creation_create_dispute_title")}
            subtitle={subtitle}
        >
            <InvoiceSelector
                customer_id={customerDetails.customer_id}
                customerUUID={customerUUID}
                invoices={customerDetails.invoices}
                reasons={customerDetails.reasons}
                sub_domain={customerDetails.sub_domain}
                isStandalone={true}
                hasDisputedInvoices={customerDetails.hasDisputedInvoices}
                onRefreshInvoices={handleRefreshInvoices}
            />
        </PortalPageLayout>
    );
}
