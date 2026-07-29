"use client";
import { apiFetch } from "@/utils/apiFetch";

import { Box, CircularProgress, Typography } from "@mui/material";
import { dispute_status } from "@/types/db";
import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { PortalInvoice } from "@/types/PortalInvoice";

import PortalPageLayout from "../../components/PortalPageLayout";

import DisputeList from "./components/DisputeList";

type DisputeData = {
    id: number;
    status: dispute_status;
    reason: string | null;
    comment: string | null;
    created_at: Date;
    modified_at: Date;
    assignedUser: {
        initials: string;
        name: string;
    } | null;
    contact: {
        name: string;
        email: string;
        mobile: string;
    } | null;
    resolutionComment: string | null;
    invoices: PortalInvoice[];
};

type DisputeDetails = {
    customerName: string | null;
    logo: string | null;
    country: string | null;
    state: string | null;
    customerCurrency: string | null;
    disputes: DisputeData[];
};

export default function Page() {
    const params = useParams();
    const { t, i18n } = useTranslation(["disputes", "portal", "common"]);
    const [disputeDetails, setDisputeDetails] = useState<DisputeDetails | null>(
        null
    );
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

    useEffect(() => {
        const fetchDisputeDetails = async () => {
            try {
                setLoading(true);
                // Pass the locale as language parameter
                const languageParam =
                    locale === "he"
                        ? "he"
                        : locale === "en"
                          ? "en"
                          : locale || "en";
                const response = await apiFetch(`/api/customers/${customerUUID}/view-disputes?language=${languageParam}`
                );

                if (!response.ok) {
                    throw new Error("Failed to fetch dispute details");
                }

                const data = await response.json();
                setDisputeDetails(data);

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
                console.error("Error fetching dispute details:", err);
                setError(
                    err instanceof Error ? err.message : "An error occurred"
                );
            } finally {
                setLoading(false);
            }
        };

        if (customerUUID) {
            fetchDisputeDetails();
        }
    }, [customerUUID, locale, initialCustomerData]);

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
                title={t("sections.dispute_list_title", { ns: "portal" })}
                subtitle={t("fields.error_loading_data", { ns: "portal" })}
            >
                <div />
            </PortalPageLayout>
        );
    }

    if (!disputeDetails) {
        return (
            <PortalPageLayout
                title={t("sections.dispute_list_title", { ns: "portal" })}
                subtitle={t("fields.customer_not_found", { ns: "portal" })}
            >
                <div />
            </PortalPageLayout>
        );
    }

    return (
        <PortalPageLayout
            title={t("sections.title")}
            subtitle={t("fields.dispute_list_subtitle", { ns: "portal" })}
        >
            <DisputeList
                disputes={disputeDetails.disputes}
                locale={locale}
                customerCurrency={disputeDetails.customerCurrency}
            />
        </PortalPageLayout>
    );
}
