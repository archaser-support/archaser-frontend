"use client";

import { Receipt as ReceiptIcon } from "@mui/icons-material";
import {
    Box,
    CircularProgress,
    Typography,
    Card,
    Tabs,
    Tab,
    Paper,
} from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { useParams, useSearchParams } from "next/navigation";
import React, { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { getPortalCardSx, PORTAL_CARD_CLASS } from "@/app/theme/portalCard";
import { portalInvoiceListRadius } from "@/shared/components/portal/portalInvoiceListStyles";
import { PortalInvoice } from "@/types/PortalInvoice";
import { apiFetch } from "@/utils/apiFetch";

import PortalPageLayout from "../../components/PortalPageLayout";

import InvoiceGrid from "./components/InvoiceGrid";

const invoiceTabsPaperSx = {
    borderRadius: (theme: Theme) => theme.shape.borderRadius,
    border: "none",
    boxShadow: "none",
    backgroundImage: "none",
    "--Paper-shadow": "none",
    backgroundColor: "transparent",
};

const tabEdgeRadius = portalInvoiceListRadius;

const getInvoiceListTabsSx = (direction: "rtl" | "ltr") => ({
    direction,
    p: 0.5,
    "& .MuiTabs-indicator": {
        display: "none",
    },
    "& .MuiTab-root": {
        textTransform: "none",
        fontWeight: 600,
        fontSize: "1rem",
        py: 2,
        boxShadow: "none",
        color: "text.secondary",
        borderRadius: 0,
        backgroundColor: (theme: Theme) => theme.palette.grey[100],
    },
    "& .MuiTab-root:first-of-type": {
        borderStartStartRadius: tabEdgeRadius,
        borderEndStartRadius: tabEdgeRadius,
    },
    "& .MuiTab-root:last-of-type": {
        borderStartEndRadius: tabEdgeRadius,
        borderEndEndRadius: tabEdgeRadius,
    },
    "& .MuiTab-root.Mui-selected": {
        color: "primary.contrastText",
        backgroundColor: (theme: Theme) => theme.palette.primary.main,
        boxShadow: "none",
        borderRadius: 0,
    },
    "& .MuiTab-root.Mui-selected:first-of-type": {
        borderStartStartRadius: tabEdgeRadius,
        borderEndStartRadius: tabEdgeRadius,
    },
    "& .MuiTab-root.Mui-selected:last-of-type": {
        borderStartEndRadius: tabEdgeRadius,
        borderEndEndRadius: tabEdgeRadius,
    },
});

type CustomerData = {
    invoices: PortalInvoice[];
    logo: string | null;
    customerName: string;
    language: string;
};

export default function Page() {
    const params = useParams();
    const searchParams = useSearchParams();
    const { t, i18n } = useTranslation(["invoices", "portal", "common"]);
    const [customerData, setCustomerData] = useState<CustomerData | null>(null);
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

    // Initialize activeTab based on status query param
    // Default to 0 (Overdue) if not specified or invalid
    const initialStatus = searchParams?.get("status");
    const [activeTab, setActiveTab] = useState<number>(() => {
        if (initialStatus === "due") return 1;
        return 0;
    });

    const locale = params?.locale as string;
    const customerUUID = params?.customerUUID as string;

    // Separate invoices by status - use useMemo to compute after customerData is available
    const overdueInvoices = useMemo(() => {
        return (
            customerData?.invoices.filter(
                (invoice) => invoice.status === "Overdue"
            ) || []
        );
    }, [customerData]);

    const dueInvoices = useMemo(() => {
        return (
            customerData?.invoices.filter(
                (invoice) => invoice.status === "Due"
            ) || []
        );
    }, [customerData]);

    useEffect(() => {
        const fetchCustomerData = async () => {
            try {
                setLoading(true);
                const url = `/api/customers/${customerUUID}/invoices`;

                const response = await apiFetch(url);

                if (!response.ok) {
                    throw new Error(
                        `Failed to fetch customer data: ${response.status} ${response.statusText}`
                    );
                }

                const data = await response.json();

                setCustomerData(data);

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

                // Auto-select the correct default tab after data loads:
                // If no explicit ?status= param was given, default to Overdue tab
                // only if there are overdue invoices. Otherwise switch to Due tab.
                if (!initialStatus) {
                    const hasOverdue = (data.invoices as PortalInvoice[]).some(
                        (inv) => inv.status === "Overdue"
                    );
                    const hasDue = (data.invoices as PortalInvoice[]).some(
                        (inv) => inv.status === "Due"
                    );
                    if (!hasOverdue && hasDue) {
                        setActiveTab(1);
                    }
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
                </Box>
            </PortalPageLayout>
        );
    }

    if (error) {
        return (
            <PortalPageLayout
                title={t("fields.invoice_list")}
                subtitle={t("fields.error_loading_data", { ns: "portal" })}
            >
                <div />
            </PortalPageLayout>
        );
    }

    if (!customerData || !customerData.invoices.length) {
        const handleTabChange = (
            _event: React.SyntheticEvent,
            newValue: number
        ) => {
            setActiveTab(newValue);
        };

        return (
            <PortalPageLayout title={t("fields.invoice_list")} subtitle="">
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                    }}
                >
                    {/* Always show both tabs */}
                    <Paper elevation={0} sx={invoiceTabsPaperSx}>
                        <Tabs
                            value={activeTab}
                            onChange={handleTabChange}
                            variant="fullWidth"
                            sx={getInvoiceListTabsSx(
                                i18n.language === "he" ? "rtl" : "ltr"
                            )}
                        >
                            <Tab
                                label={`${t("values.invoice_status_overdue")} (0)`}
                            />
                            <Tab
                                label={`${t("values.invoice_status_due")} (0)`}
                            />
                        </Tabs>
                    </Paper>

                    <Box
                        sx={{
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        }}
                    >
                        <Box
                            sx={{
                                width: "100%",
                                p: { xs: 2, sm: 4 },
                                textAlign: "center",
                                maxWidth: { xs: "90%", sm: 400 },
                                mx: "auto",
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                                boxSizing: "border-box",
                            }}
                        >
                            <Card
                                className={PORTAL_CARD_CLASS}
                                elevation={0}
                                sx={(theme) => ({
                                    ...getPortalCardSx(theme),
                                    background: `linear-gradient(135deg, ${theme.palette.grey[50]} 0%, ${theme.palette.grey[200]} 100%)`,
                                    p: { xs: 3, sm: 4 },
                                    direction:
                                        i18n.language === "he" ? "rtl" : "ltr",
                                    width: "100%",
                                    boxSizing: "border-box",
                                })}
                            >
                                <ReceiptIcon
                                    sx={{
                                        fontSize: 48,
                                        color: (theme) =>
                                            theme.palette.text.secondary,
                                        mb: 2,
                                        opacity: 0.6,
                                    }}
                                />
                                <Typography
                                    variant="h6"
                                    sx={{
                                        color: (theme) =>
                                            theme.palette.text.secondary,
                                        fontWeight: 600,
                                        mb: 1,
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                        textAlign: "center",
                                    }}
                                >
                                    {t("fields.no_invoices_found")}
                                </Typography>
                            </Card>
                        </Box>
                    </Box>
                </Box>
            </PortalPageLayout>
        );
    }

    const handleTabChange = (
        _event: React.SyntheticEvent,
        newValue: number
    ) => {
        setActiveTab(newValue);
    };

    // Determine which invoices to show based on active tab
    const getCurrentInvoices = () => {
        // Tab 0 = overdue, Tab 1 = due
        return activeTab === 0 ? overdueInvoices : dueInvoices;
    };

    return (
        <PortalPageLayout title={t("fields.invoice_list")} subtitle="">
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                    direction: i18n.language === "he" ? "rtl" : "ltr",
                }}
            >
                {/* Always show both tabs */}
                <Paper elevation={0} sx={invoiceTabsPaperSx}>
                    <Tabs
                        value={activeTab}
                        onChange={handleTabChange}
                        variant="fullWidth"
                        sx={getInvoiceListTabsSx(
                            i18n.language === "he" ? "rtl" : "ltr"
                        )}
                    >
                        <Tab
                            label={`${t("values.invoice_status_overdue")} (${overdueInvoices.length})`}
                        />
                        <Tab
                            label={`${t("values.invoice_status_due")} (${dueInvoices.length})`}
                        />
                    </Tabs>
                </Paper>

                <Box
                    sx={{
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                    }}
                >
                    <InvoiceGrid
                        invoices={getCurrentInvoices()}
                        locale={locale}
                    />
                </Box>
            </Box>
        </PortalPageLayout>
    );
}
