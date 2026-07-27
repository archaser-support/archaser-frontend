"use client";
import { apiFetch } from "@/utils/apiFetch";

import { Box } from "@mui/material";
import { useParams } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

import { PORTAL_SCOPE_CLASS } from "@/app/theme/portalButton";

import PortalFooter from "../components/PortalFooter";
import PortalHeader from "../components/PortalHeader";

const RootLayout = ({ children }: { children: ReactNode }) => {
    const params = useParams();
    const customerUUID = params?.customerUUID as string;
    const [logo, setLogo] = useState<string | null>(null);
    const [customerName, setAccountName] = useState<string | null>(null);

    // Fetch customer data once for the header (shared across all pages)
    useEffect(() => {
        const fetchCustomerData = async () => {
            if (!customerUUID) return;

            try {
                // Use the invoices endpoint which returns customer data
                const response = await apiFetch(`/api/customers/${customerUUID}/invoices`
                );
                if (response.ok) {
                    const data = await response.json();
                    setLogo(data.logo || null);
                    setAccountName(data.customerName || null);
                }
            } catch (error) {
                console.error(
                    "Error fetching customer data for header:",
                    error
                );
            }
        };

        fetchCustomerData();
    }, [customerUUID]);

    // No language sync needed here - TranslationsProvider initializes i18n with URL locale
    // and never changes it for portal pages. URL is the source of truth.
    return (
        <Box
            className={PORTAL_SCOPE_CLASS}
            sx={{
                minHeight: "100vh",
                backgroundColor: (theme) => theme.palette.grey[50],
                display: "flex",
                flexDirection: "column",
            }}
        >
            {/* Shared Header - persists across page navigations */}
            <PortalHeader
                logo={logo}
                customerName={customerName}
                customerUUID={customerUUID}
            />

            {/* Page Content */}
            <Box
                sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                }}
            >
                {children}
            </Box>

            {/* Shared Footer - persists across page navigations */}
            <PortalFooter />
        </Box>
    );
};

export default RootLayout;
