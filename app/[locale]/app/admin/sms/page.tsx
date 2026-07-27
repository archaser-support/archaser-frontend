"use client";
import {
    Business as BusinessIcon,
    Public as PublicIcon,
} from "@mui/icons-material";
import {
    Box,
    Typography,
    Paper,
    Tabs,
    Tab,
 CircularProgress } from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import InternalPageWrapper from "@/components/InternalPageWrapper";
import PageHeader from "@/components/PageHeader";
import Seo from "@/shared/layout-components/seo/seo";

import SMSCountryMappings from "./components/SMSCountryMappings";
import SMSVendors from "./components/SMSVendors";

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`sms-management-tabpanel-${index}`}
            aria-labelledby={`sms-management-tab-${index}`}
            style={{
                ...(value !== index && {
                    position: 'absolute',
                    left: '-9999px',
                    top: '-9999px',
                    visibility: 'hidden'
                })
            }}
            {...other}
        >
            {value === index && (
                <Box sx={{ height: "100%", width: "100%", py: 2 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

function a11yProps(index: number) {
    return {
        id: `sms-management-tab-${index}`,
        "aria-controls": `sms-management-tabpanel-${index}`,
    };
}

const SMSManagementPage = () => {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { t } = useTranslation(["sms", "common"]);
    const [value, setValue] = useState(0);

    // Handle tab parameter from URL
    useEffect(() => {
        if (searchParams) {
            const tabParam = searchParams.get("tab");
            if (tabParam) {
                const tabIndexMap: Record<string, number> = {
                    vendors: 0,
                    "country-mappings": 1,
                };
                const tabIndex = tabIndexMap[tabParam];
                if (tabIndex !== undefined) {
                    setValue(tabIndex);
                }
            }
        }
    }, [searchParams]);

    const handleChange = (event: React.SyntheticEvent, newValue: number) => {
        setValue(newValue);

        const tabNames = ["vendors", "country-mappings"];
        const selectedTab = tabNames[newValue];
        if (selectedTab) {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set("tab", selectedTab);
            router.push(currentUrl.toString(), { scroll: false });
        }
    };

    // Show loading state when session is loading
    if (status === "loading") {
        return (
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "400px",
                }}
            >
                <CircularProgress size={40} />
            </Box>
        );
    }

    // Redirect if not admin
    if (status === "unauthenticated" || !session?.user) {
        router.push("/login");
        return null;
    }

    const isAdmin =
        session.user.role === "Admin" || session.user.account_id === 10013;
    if (!isAdmin) {
        router.push("/app/dashboard");
        return null;
    }

    return (
        <>
            <Seo title="SMS Management" />
            <InternalPageWrapper>
                <Box sx={{ bgcolor: "background.default", borderRadius: 2 }}>
                    {/* Header Section with Title and Subtitle */}
                    <PageHeader
                        title={t("fields.title")}
                        description={t("fields.description")}
                    />

                    {/* Tabs Section */}
                    <Box
                        sx={{
                            mb: 2,
                        }}
                    >
                        <Tabs
                            value={value}
                            onChange={handleChange}
                            aria-label="SMS management tabs"
                            variant="scrollable"
                            scrollButtons="auto"
                            sx={{
                                minHeight: "unset",
                                "& .MuiTabs-indicator": {
                                    height: 2,
                                    borderRadius: "3px 3px 0 0",
                                    backgroundColor: "primary.main",
                                },
                                "& .MuiTab-root": {
                                    textTransform: "none",
                                    fontSize: "0.875rem",
                                    fontWeight: 500,
                                    minWidth: 120,
                                    py: 1,
                                    px: { xs: 1.5, sm: 2 },
                                    minHeight: "unset",
                                    height: "40px",
                                    color: "text.secondary",
                                    transition: "all 0.2s ease-in-out",
                                    "&:hover": {
                                        color: "primary.main",
                                        backgroundColor: "action.hover",
                                    },
                                    "&.Mui-selected": {
                                        color: "primary.main",
                                        fontWeight: 600,
                                    },
                                    "& .MuiSvgIcon-root": {
                                        fontSize: "1.1rem",
                                        mb: 0.25,
                                    },
                                },
                            }}
                        >
                            <Tab
                                label={t("fields.vendors_title").toUpperCase()}
                                {...a11yProps(0)}
                                icon={<BusinessIcon sx={{ mb: 0.5 }} />}
                                iconPosition="start"
                            />
                            <Tab
                                label={t("fields.country_mappings_title").toUpperCase()}
                                {...a11yProps(1)}
                                icon={<PublicIcon sx={{ mb: 0.5 }} />}
                                iconPosition="start"
                            />
                        </Tabs>
                    </Box>

                    {/* Tab Content */}
                    <Box sx={{ flex: 1, minHeight: 0, position: "relative" }}>
                        <TabPanel value={value} index={0}>
                            <SMSVendors />
                        </TabPanel>
                        <TabPanel value={value} index={1}>
                            <SMSCountryMappings />
                        </TabPanel>
                    </Box>
                </Box>
            </InternalPageWrapper>
        </>
    );
};

export default SMSManagementPage;
