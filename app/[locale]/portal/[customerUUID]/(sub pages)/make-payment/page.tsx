"use client";
import { apiFetch } from "@/utils/apiFetch";

import { Box, Typography, CircularProgress } from "@mui/material";
import { useEffect, useState, use } from "react";
import { useTranslation } from "react-i18next";

import PortalPageLayout from "../../components/PortalPageLayout";

import BankDetails from "./BankDetails";

type PageProps = {
    params: Promise<{
        locale: string;
        customerUUID: string;
    }>;
};

interface CustomerData {
    Account?: {
        name: string;
        logo: string | null;
    };
    CustomerBanks: any[];
}

export default function Page({ params }: PageProps) {
    const { locale, customerUUID } = use(params);
    const { t, i18n } = useTranslation(["bank_accounts", "portal", "common"]);
    const [customer, setCustomer] = useState<CustomerData | null>(null);
    const [loading, setLoading] = useState(true);
    const [logoData, setLogoData] = useState<{
        logo: string | null;
        customerName: string | null;
    } | null>(null);
    const [initialCustomerData, setInitialCustomerData] = useState<{
        logo: string | null;
        customerName: string | null;
    } | null>(null);

    // No language sync needed - TranslationsProvider initializes i18n with URL locale
    // URL is the source of truth, i18n is initialized correctly on server

    // Fetch customer data
    useEffect(() => {
        const fetchCustomerData = async () => {
            try {
                const response = await apiFetch(`/api/customers/${customerUUID}/bank-details`
                );
                if (response.ok) {
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
                } else {
                    setCustomer(null);
                }
            } catch (error) {
                console.error("Error fetching customer data:", error);
                setCustomer(null);
            } finally {
                setLoading(false);
            }
        };

        fetchCustomerData();
    }, [customerUUID]);

    // Loading state with spinner
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

    // Customer not found state
    if (!customer) {
        return (
            <PortalPageLayout
                title={t("fields.banking_bank_title", { ns: "portal" })}
                subtitle={t("fields.customer_not_found", { ns: "portal" })}
            >
                <div />
            </PortalPageLayout>
        );
    }

    return (
        <PortalPageLayout
            title={t("fields.banking_bank_title", { ns: "portal" })}
            subtitle={t("fields.banking_subtitle", { ns: "portal" })}
        >
            <Box
                sx={{
                    width: "100%",
                    animation: "fadeInUp 0.6s ease-out",
                    "@keyframes fadeInUp": {
                        from: { opacity: 0, transform: "translateY(20px)" },
                        to: { opacity: 1, transform: "translateY(0)" },
                    },
                }}
            >
                <BankDetails banks={customer.CustomerBanks} />
            </Box>
        </PortalPageLayout>
    );
}
