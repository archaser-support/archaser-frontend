"use client";
import { apiFetch } from "@/utils/apiFetch";
import { CircularProgress, Box, Typography } from "@mui/material";
import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { CustomerForPromiseToPay } from "@/shared/services/promiseToPayService";

import PortalPageLayout from "../../components/PortalPageLayout";

import PromiseToPayContainer from "./PromiseToPay";

type CustomerData = CustomerForPromiseToPay & {
    id: number;
    Account?: {
        promise_to_pay: number;
        name: string | null;
        logo: string | null;
        sub_domain: string | null;
    } | null;
    CustomerCollectionPeriod?: {
        promise_to_pay_count: number;
        promise_to_pay_date: Date | null;
    } | null;
};

async function getCustomerData(
    customerUUID: string
): Promise<CustomerData | null> {
    const response = await apiFetch(`/api/customers/${customerUUID}/portal-data`);
    if (!response.ok) {
        throw new Error(
            `Failed to fetch customer data: ${response.statusText}`
        );
    }
    return await response.json();
}

export default function PromiseToPayPage() {
    const params = useParams();
    const { t, i18n } = useTranslation(["portal", "common"]);
    const [customer, setCustomer] = React.useState<CustomerData | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [logoData, setLogoData] = useState<{
        logo: string | null;
        accountName: string | null;
    } | null>(null);
    const [initialCustomerData, setInitialCustomerData] = useState<{
        logo: string | null;
        accountName: string | null;
    } | null>(null);

    const locale = params?.locale as string;
    const customerUUID = params?.customerUUID as string;

    // Check if current language is Hebrew for RTL support
    const isRTL = i18n.language === "he";

    useEffect(() => {
        const fetchCustomerData = async () => {
            try {
                const customerData = await getCustomerData(customerUUID);
                setCustomer(customerData);

                // Pass raw logo data to PortalHeader - let it handle processing
                setLogoData({
                    logo: customerData?.Account?.logo || null, // Raw logo data from API
                    accountName: customerData?.Account?.name || null,
                });

                // Set initial customer data immediately for loading states
                if (!initialCustomerData) {
                    setInitialCustomerData({
                        logo: customerData?.Account?.logo || null, // Raw logo data from API
                        accountName: customerData?.Account?.name || null,
                    });
                }
            } catch (error) {
                console.error("Error fetching customer data:", error);
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
            </div>
        );
    }

    if (!customer) {
        return (
            <div dir={isRTL ? "rtl" : "ltr"}>
                <PortalPageLayout
                    title={t("fields.promise_to_pay_title")}
                    subtitle={t("fields.general_customer_not_found")}
                >
                    <div />
                </PortalPageLayout>
            </div>
        );
    }

    return (
        <div dir={isRTL ? "rtl" : "ltr"}>
            <PortalPageLayout
                title={t("fields.promise_to_pay_title")}
                subtitle={t("fields.promise_to_pay_subtitle")}
                maxWidth="95%"
            >
                <PromiseToPayContainer
                    customerId={customer.id}
                    promise_to_pay={customer.Account?.promise_to_pay || 0}
                    customerUUID={customerUUID}
                    subDomain={customer.Account?.sub_domain || ""}
                    collection={customer.CustomerCollectionPeriod}
                />
            </PortalPageLayout>
        </div>
    );
}
