// translate all labels in this file and related files
"use client";
import { apiFetch } from "@/utils/apiFetch";
import { Warning as WarningIcon } from "@mui/icons-material";
import {
    Box,
    Button,
    CircularProgress,
    Divider,
    Typography,
    useTheme,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Fragment, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import PageHeader from "@/components/PageHeader";
import { useSessionState } from "@/hooks/useSessionState";
import BusinessUnitDashboardFilter from "@/shared/components/BusinessUnitDashboardFilter";
import { DashboardBusinessUnitProvider } from "@/shared/dashboard/DashboardBusinessUnitContext";
import { parseDashboardBusinessUnitIdFromUrl } from "@/shared/dashboard/dashboardBusinessUnitParams";
import Seo from "@/shared/layout-components/seo/seo";

import DashboardTabFilter from "./(cards)/DashboardTabFilter";
import DashboardViewByFilter from "./(cards)/DashboardViewByFilter";
import DashboardGrid from "./DashboardGrid";

const DashboardContainer = () => {
    const { session, status, isSessionReady, sessionError, refreshSession } =
        useSessionState();
    const { t, i18n } = useTranslation(["dashboard", "common"]);
    const [userName, setUserName] = useState<string | undefined>(undefined);

    const [timeOfDay, setTimeOfDay] = useState<string>("");
    const [activeTab, setActiveTab] = useState<number>(0);
    const [viewMode, setViewMode] = useState<"child" | "parent">("child");
    const [selectedBusinessUnitId, setSelectedBusinessUnitId] = useState<
        number | null
    >(null);
    const [pageLoaded, setPageLoaded] = useState<boolean>(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const theme = useTheme();
    const headerRef = useRef<HTMLDivElement>(null);

    // Set time-based greeting
    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) {
            setTimeOfDay("morning");
        } else if (hour < 17) {
            setTimeOfDay("afternoon");
        } else {
            setTimeOfDay("evening");
        }
    }, []);

    // Handle tab and viewMode parameters from URL
    useEffect(() => {
        const tabParam = searchParams?.get("tab");
        if (tabParam === "due") {
            setActiveTab(1); // Set to due tab (index 1)
        } else if (tabParam === "overdue") {
            setActiveTab(0); // Set to overdue tab (index 0)
        }

        const viewModeParam = searchParams?.get("viewMode");
        if (viewModeParam === "parent" || viewModeParam === "child") {
            setViewMode(viewModeParam);
        }

        setSelectedBusinessUnitId(
            parseDashboardBusinessUnitIdFromUrl(
                searchParams?.get("businessUnitId")
            )
        );
    }, [searchParams]);

    const buildDashboardUrlParams = (
        tab: number,
        nextViewMode: "child" | "parent",
        businessUnitId: number | null
    ) => {
        const params = new URLSearchParams({
            tab: tab === 0 ? "overdue" : "due",
            viewMode: nextViewMode,
        });
        if (businessUnitId != null) {
            params.set("businessUnitId", String(businessUnitId));
        }
        return params;
    };

    const {
        data: dashboardData,
        isLoading,
        error,
        refetch,
    } = useQuery({
        // Include ViewAs user ID in cache key to ensure ViewAs functionality works correctly
        // When ViewAs is active, this ensures we get fresh data for the ViewAs user, not cached data from the logged-in user
        queryKey: [
            "dashboardData",
            viewMode,
            session?.user?.view_as_user_id,
            selectedBusinessUnitId,
        ],
        queryFn: async () => {
            const params = new URLSearchParams({ viewMode });
            if (selectedBusinessUnitId != null) {
                params.set("businessUnitId", String(selectedBusinessUnitId));
            }
            // Add bypassCache from URL if present
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('bypassCache')) {
                params.set('bypassCache', urlParams.get('bypassCache') || 'true');
            }
            if (urlParams.has('invalidateCache')) {
                params.set('invalidateCache', urlParams.get('invalidateCache') || 'true');
            }
            const response = await apiFetch(`/api/system/dashboard?${params.toString()}`
            );

            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error("business_unit_access_denied");
                }
                throw new Error("Failed to fetch dashboard data");
            }

            const data = await response.json();

            return data;
        },
        enabled: isSessionReady && status === "authenticated",
    });

    // Mark page as loaded after data is fetched and component is mounted
    useEffect(() => {
        if (isSessionReady && !isLoading && dashboardData) {
            // Use a small delay to ensure page is fully rendered
            const timer = setTimeout(() => {
                setPageLoaded(true);
            }, 100);
            return () => clearTimeout(timer);
        } else if (isLoading) {
            // Reset pageLoaded when loading new data
            setPageLoaded(false);
        }
    }, [isSessionReady, isLoading, dashboardData]);

    // Generate dynamic welcome message
    const getWelcomeMessage = () => {
        const currentUserName = isSessionReady
            ? session?.user?.name || t("fields.guest")
            : t("fields.guest");
        const timeGreeting =
            timeOfDay === "morning"
                ? t("messages.messages_good_morning")
                : timeOfDay === "afternoon"
                    ? t("messages.messages_good_afternoon")
                    : t("messages.messages_good_evening");
        return `${timeGreeting}, ${currentUserName}`;
    };

    const getLocaleFromPath = () => {
        const currentPath = window.location.pathname;
        return currentPath.split("/")[1];
    };

    const handleTabChangeFromPicklist = (newValue: 0 | 1) => {
        setActiveTab(newValue);
        const locale = getLocaleFromPath();
        const params = buildDashboardUrlParams(
            newValue,
            viewMode,
            selectedBusinessUnitId
        );
        router.replace(`/${locale}/app/dashboard?${params.toString()}`);
    };

    const handleViewModeChangeFromPicklist = (
        newViewMode: "child" | "parent"
    ) => {
        setViewMode(newViewMode);
        const locale = getLocaleFromPath();
        const params = buildDashboardUrlParams(
            activeTab,
            newViewMode,
            selectedBusinessUnitId
        );
        router.replace(`/${locale}/app/dashboard?${params.toString()}`);
    };

    const handleBusinessUnitChange = (businessUnitId: number | null) => {
        setSelectedBusinessUnitId(businessUnitId);
        const locale = getLocaleFromPath();
        const params = buildDashboardUrlParams(
            activeTab,
            viewMode,
            businessUnitId
        );
        router.replace(`/${locale}/app/dashboard?${params.toString()}`);
    };

    // Show loading state when session is loading
    if (status === "loading" || !isSessionReady) {
        return (
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: { xs: "300px", sm: "400px" },
                    px: { xs: 2, sm: 3 },
                }}
            >
                <CircularProgress color="primary" size={48} />
            </Box>
        );
    }

    // Show error state for session issues
    if (sessionError) {
        return (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: { xs: "300px", sm: "400px" },
                    px: { xs: 2, sm: 3 },
                    color: "error.main",
                }}
            >
                <Box
                    sx={{
                        width: { xs: 40, sm: 48 },
                        height: { xs: 40, sm: 48 },
                        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: `0 6px 20px ${theme.palette.primary.main}66`,
                        mb: 2,
                        "& .MuiSvgIcon-root": {
                            color: theme.palette.primary.contrastText,
                            fontSize: { xs: "1.5rem", sm: "2rem" },
                        },
                    }}
                >
                    <WarningIcon />
                </Box>
                <Typography
                    variant="h6"
                    sx={{
                        fontWeight: 600,
                        mb: 1,
                        fontSize: { xs: "1.1rem", sm: "1.25rem" },
                        textAlign: "center",
                    }}
                >
                    {t("messages.session_error")}
                </Typography>
                <Typography
                    variant="body2"
                    sx={{
                        mb: 3,
                        textAlign: "center",
                        fontSize: { xs: "0.875rem", sm: "1rem" },
                        px: { xs: 1, sm: 0 },
                    }}
                >
                    {sessionError}
                </Typography>
                <Button
                    variant="contained"
                    onClick={refreshSession}
                    sx={{
                        mt: 2,
                        px: { xs: 3, sm: 4 },
                        py: { xs: 1, sm: 1.5 },
                    }}
                >
                    {t("actions.back", { ns: "common" })}
                </Button>
            </Box>
        );
    }

    // Show loading state while data is loading
    if (isSessionReady && isLoading) {
        return (
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: { xs: "300px", sm: "400px" },
                    px: { xs: 2, sm: 3 },
                }}
            >
                <CircularProgress color="primary" size={48} />
            </Box>
        );
    }

    if (error) {
        return (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: { xs: "300px", sm: "400px" },
                    px: { xs: 2, sm: 3 },
                    color: "error.main",
                }}
            >
                <Box
                    sx={{
                        width: { xs: 40, sm: 48 },
                        height: { xs: 40, sm: 48 },
                        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: `0 6px 20px ${theme.palette.primary.main}66`,
                        mb: 2,
                        "& .MuiSvgIcon-root": {
                            color: theme.palette.primary.contrastText,
                            fontSize: { xs: "1.5rem", sm: "2rem" },
                        },
                    }}
                >
                    <WarningIcon />
                </Box>
                <Typography
                    variant="h6"
                    sx={{
                        fontWeight: 600,
                        mb: 1,
                        fontSize: { xs: "1.1rem", sm: "1.25rem" },
                        textAlign: "center",
                    }}
                >
                    {t("messages.error")}
                </Typography>
                <Typography
                    variant="body2"
                    sx={{
                        mb: 3,
                        textAlign: "center",
                        fontSize: { xs: "0.875rem", sm: "1rem" },
                        px: { xs: 1, sm: 0 },
                    }}
                >
                    {t(
                        error.message === "business_unit_access_denied"
                            ? "messages.business_unit_access_denied"
                            : "messages.error_loading_dashboard"
                    )}
                </Typography>
                <Button
                    variant="contained"
                    onClick={() => router.refresh()}
                    sx={{
                        mt: 2,
                        px: { xs: 3, sm: 4 },
                        py: { xs: 1, sm: 1.5 },
                    }}
                >
                    {t("actions.back", { ns: "common" })}
                </Button>
            </Box>
        );
    }

    // Don't render anything if not authenticated
    if (status === "unauthenticated") {
        return null;
    }

    return (
        <Fragment>
            <Seo title={t("fields.title")} />

            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    minHeight: "100vh",
                    m: 0,
                    p: 0,
                    mt: { xs: -1, sm: -1.5 },
                    mx: { xs: -1, sm: -1.5 },
                    width: { xs: "calc(100% + 16px)", sm: "calc(100% + 24px)" },
                    maxWidth: { xs: "calc(100% + 16px)", sm: "calc(100% + 24px)" },
                }}
            >
                {/* Sticky Header */}
                <Box
                    ref={headerRef}
                    sx={{
                        position: "sticky",
                        top: { xs: "-8px", sm: "-12px" },
                        left: 0,
                        right: 0,
                        zIndex: 30,
                        bgcolor: "background.paper",
                        flexShrink: 0,
                        px: { xs: 1, sm: 1.5 },
                        pt: { xs: 2, sm: 2.5 },
                        pb: 0,
                        m: 0,
                        mt: 0,
                        backgroundColor: "background.paper",
                        width: "100%",
                        maxWidth: "100%",
                        overflow: "visible",
                    }}
                >
                    <PageHeader
                        title={getWelcomeMessage()}
                        description={t("fields.subtitle")}
                        sticky={false}
                    />
                </Box>

                {/* Content Area */}
                <Box
                    sx={{
                        flex: 1,
                        width: "100%",
                        position: "relative",
                        px: { xs: 1, sm: 1.5 },
                    }}
                >
                    <Box
                        className="endless-scroll-toolbar"
                        sx={{
                            pt: theme.spacing(1.5),
                            pb: theme.spacing(0.625),
                            px: 0,
                            marginBottom: theme.spacing(2),
                            backgroundColor: "transparent",
                            display: "flex",
                            flexDirection: "row",
                            gap: theme.spacing(1),
                            alignItems: "flex-end",
                            minHeight: "56px",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            flexWrap: "nowrap",
                            overflow: "visible",
                            justifyContent: "flex-start",
                            boxSizing: "border-box",
                        }}
                    >
                        <DashboardTabFilter
                            value={activeTab as 0 | 1}
                            onChange={handleTabChangeFromPicklist}
                        />
                        <Divider
                            orientation="vertical"
                            flexItem
                            sx={{
                                borderColor: theme.palette.divider,
                                height: 24,
                                alignSelf: "center",
                            }}
                        />
                        <DashboardViewByFilter
                            value={viewMode}
                            onChange={handleViewModeChangeFromPicklist}
                        />
                        <BusinessUnitDashboardFilter
                            value={selectedBusinessUnitId}
                            onChange={handleBusinessUnitChange}
                        />
                    </Box>

                    <DashboardBusinessUnitProvider
                        value={selectedBusinessUnitId}
                    >
                        <DashboardGrid
                            data={dashboardData}
                            activeTab={activeTab}
                            viewMode={viewMode}
                            pageLoaded={pageLoaded}
                        />
                    </DashboardBusinessUnitProvider>
                </Box>
            </Box>
        </Fragment>
    );
};

export default DashboardContainer;
