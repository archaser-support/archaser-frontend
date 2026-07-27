"use client";

import {
    AutoAwesome as AutoAwesomeIcon,
    Email as EmailIcon,
    Handshake as HandshakeIcon,
    Gavel as GavelIcon,
} from "@mui/icons-material";
import { Box, Tabs, Tab, useTheme } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import api from "@/app/api";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import AutomatedTemplateList from "./AutomatedTemplateList";
import DisputeTemplateList from "./DisputeTemplateList";
import InternalEmailTemplateList from "./InternalEmailTemplateList";
import PromiseToPayTemplateList from "./PromiseToPayTemplateList";

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
            id={`template-settings-tabpanel-${index}`}
            aria-labelledby={`template-settings-tab-${index}`}
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
        id: `template-settings-tab-${index}`,
        "aria-controls": `template-settings-tabpanel-${index}`,
    };
}

export default function TemplateSettings() {
    const { t, i18n } = useTranslation(["settings", "common"]);
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const theme = useTheme();
    const [value, setValue] = useState(0);

    // Handle sub-tab parameter from URL
    useEffect(() => {
        if (searchParams) {
            const subTabParam = searchParams.get("templateType");
            if (subTabParam) {
                const subTabIndexMap: Record<string, number> = {
                    automated: 0,
                    dispute: 1,
                    promiseToPay: 2,
                    internalEmail: 3,
                };
                const subTabIndex = subTabIndexMap[subTabParam];
                if (subTabIndex !== undefined) {
                    setValue(subTabIndex);
                }
            }
        }
    }, [searchParams]);

    const handleChange = (event: React.SyntheticEvent, newValue: number) => {
        setValue(newValue);

        // Update URL with the selected sub-tab
        const subTabNames = [
            "automated",
            "dispute",
            "promiseToPay",
            "internalEmail",
        ];
        const selectedSubTab = subTabNames[newValue];
        if (selectedSubTab) {
            const currentPath = pathname || "/app/settings";
            // Preserve existing search params and update templateType
            const params = new URLSearchParams(searchParams?.toString() || "");
            params.set("templateType", selectedSubTab);
            // Ensure tab param is set to templates if not already
            if (!params.has("tab")) {
                params.set("tab", "templates");
            }
            // Use replace instead of push to avoid adding to history and prevent full page refresh
            router.replace(`${currentPath}?${params.toString()}`, {
                scroll: false,
            });
        }
    };

    const accountId = session?.user?.account_id || 0;

    // Fetch user permissions
    const { data: userPermissionsData } = useQuery<{ permissions: string[] }>({
        queryKey: [
            "user-permissions",
            session?.user?.id,
            session?.user?.role,
            session?.user?.account_id,
        ],
        queryFn: async () => {
            const response = await api.get("/api/permissions/me");
            return response.data;
        },
        enabled: !!session?.user,
        staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    });

    const userPermissions = userPermissionsData?.permissions || [];
    const hasViewTemplatesPermission =
        userPermissions.includes("view_templates");

    return (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            {/* Tabs Section */}
            <Box
                sx={{
                    borderBottom: 1,
                    borderColor: "divider",
                    bgcolor: "background.paper",
                    borderRadius: "8px 8px 0 0",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                    mb: 2,
                }}
            >
                <Tabs
                    value={value}
                    onChange={handleChange}
                    aria-label="template settings tabs"
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                        px: 2,
                        minHeight: "unset",
                        "& .MuiTabs-indicator": {
                            height: 2,
                            borderRadius: "3px 3px 0 0",
                            backgroundColor: "primary.main",
                        },
                        "& .MuiTab-root": {
                            textTransform: "none",
                            fontWeight: 500,
                            minWidth: 120,
                            py: 1,
                            px: { xs: 1.5, sm: 2 },
                            minHeight: "unset",
                            height: theme.spacing(5),
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
                    {hasViewTemplatesPermission && (
                        <Tab
                            label={t("fields.tab_automated").toUpperCase()}
                            {...a11yProps(0)}
                            icon={
                                <AutoAwesomeIcon
                                    sx={{
                                        mb: 0.5,
                                        mr: i18n.language === "he" ? 0 : 1,
                                        ml: i18n.language === "he" ? 1 : 0,
                                    }}
                                />
                            }
                            iconPosition="start"
                        />
                    )}
                    {hasViewTemplatesPermission && (
                        <Tab
                            label={t(
                                "fields.tab_dispute_template_settings"
                            ).toUpperCase()}
                            {...a11yProps(1)}
                            icon={
                                <GavelIcon
                                    sx={{
                                        mb: 0.5,
                                        mr: i18n.language === "he" ? 0 : 1,
                                        ml: i18n.language === "he" ? 1 : 0,
                                    }}
                                />
                            }
                            iconPosition="start"
                        />
                    )}
                    {hasViewTemplatesPermission && (
                        <Tab
                            label={t(
                                "fields.tab_promise_to_pay_templates"
                            ).toUpperCase()}
                            {...a11yProps(2)}
                            icon={
                                <HandshakeIcon
                                    sx={{
                                        mb: 0.5,
                                        mr: i18n.language === "he" ? 0 : 1,
                                        ml: i18n.language === "he" ? 1 : 0,
                                    }}
                                />
                            }
                            iconPosition="start"
                        />
                    )}
                    {hasViewTemplatesPermission && (
                        <Tab
                            label={t("fields.tab_internal_email").toUpperCase()}
                            {...a11yProps(3)}
                            icon={
                                <EmailIcon
                                    sx={{
                                        mb: 0.5,
                                        mr: i18n.language === "he" ? 0 : 1,
                                        ml: i18n.language === "he" ? 1 : 0,
                                    }}
                                />
                            }
                            iconPosition="start"
                        />
                    )}
                </Tabs>
            </Box>

            {/* Tab Content */}
            {hasViewTemplatesPermission && (
                <Box sx={{ flex: 1, minHeight: 0, position: "relative" }}>
                    <TabPanel value={value} index={0}>
                        <AutomatedTemplateList accountId={accountId} />
                    </TabPanel>
                    <TabPanel value={value} index={1}>
                        <DisputeTemplateList accountId={accountId} />
                    </TabPanel>
                    <TabPanel value={value} index={2}>
                        <PromiseToPayTemplateList accountId={accountId} />
                    </TabPanel>
                    <TabPanel value={value} index={3}>
                        <InternalEmailTemplateList accountId={accountId} />
                    </TabPanel>
                </Box>
            )}
        </Box>
    );
}
