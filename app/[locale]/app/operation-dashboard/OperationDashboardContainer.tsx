"use client";
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
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import PageHeader from "@/components/PageHeader";
import { useSessionState } from "@/hooks/useSessionState";
import BusinessUnitDashboardFilter from "@/shared/components/BusinessUnitDashboardFilter";
import { DashboardBusinessUnitProvider } from "@/shared/dashboard/DashboardBusinessUnitContext";
import { parseDashboardBusinessUnitIdFromUrl } from "@/shared/dashboard/dashboardBusinessUnitParams";
import Seo from "@/shared/layout-components/seo/seo";
import { fetchOperationDashboardData } from "@/shared/services/operationDashboardService";
import { OperationDashboardResponse } from "@/types/OperationDashboard";

import DateRangePicker from "./(cards)/DateRangePicker";
import UserFilter from "./(cards)/UserFilter";
import OperationDashboardGrid from "./OperationDashboardGrid";

const OperationDashboardContainer = () => {
    const { session, status, isSessionReady, sessionError, refreshSession } =
        useSessionState();
    const { t, i18n } = useTranslation(["dashboard", "common"]);
    const theme = useTheme();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [pageLoaded, setPageLoaded] = useState<boolean>(false);
    const headerRef = useRef<HTMLDivElement>(null);

    // Date range state - initialize from URL params (when returning from details page) or default to today
    const [startDate, setStartDate] = useState<Date>(() => {
        const urlStartDate = searchParams?.get("startDate");
        if (urlStartDate) {
            return new Date(urlStartDate);
        }
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        startOfToday.setHours(0, 0, 0, 0);
        return startOfToday;
    });
    const [endDate, setEndDate] = useState<Date>(() => {
        const urlEndDate = searchParams?.get("endDate");
        if (urlEndDate) {
            return new Date(urlEndDate);
        }
        const now = new Date();
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endOfToday.setHours(23, 59, 59, 999);
        return endOfToday;
    });

    // Initialize selectedUserId from URL params (when returning from details page) or session
    const [selectedUserId, setSelectedUserId] = useState<string | null>(() => {
        const urlSelectedUserId = searchParams?.get("selectedUserId");
        if (urlSelectedUserId) {
            return urlSelectedUserId;
        }
        return session?.user?.view_as_user_id || null;
    });

    const [selectedBusinessUnitId, setSelectedBusinessUnitId] = useState<
        number | null
    >(() =>
        parseDashboardBusinessUnitIdFromUrl(
            searchParams?.get("businessUnitId")
        )
    );

    // Update selectedUserId when view_as_user_id changes (but not if URL param exists)
    useEffect(() => {
        const urlSelectedUserId = searchParams?.get("selectedUserId");
        if (urlSelectedUserId) {
            // URL param takes precedence
            setSelectedUserId(urlSelectedUserId);
        } else if (session?.user?.view_as_user_id) {
            setSelectedUserId(session.user.view_as_user_id);
        } else {
            setSelectedUserId(null);
        }
    }, [session?.user?.view_as_user_id, searchParams]);

    useEffect(() => {
        setSelectedBusinessUnitId(
            parseDashboardBusinessUnitIdFromUrl(
                searchParams?.get("businessUnitId")
            )
        );
    }, [searchParams]);

    // Update date filters when URL params change (when returning from details page)
    useEffect(() => {
        const urlStartDate = searchParams?.get("startDate");
        const urlEndDate = searchParams?.get("endDate");

        if (urlStartDate) {
            const parsedStartDate = new Date(urlStartDate);
            if (!isNaN(parsedStartDate.getTime())) {
                const currentStartTime = startDate.getTime();
                const parsedStartTime = parsedStartDate.getTime();
                // Only update if different (avoid unnecessary updates)
                if (Math.abs(currentStartTime - parsedStartTime) > 1000) {
                    // 1 second tolerance
                    setStartDate(parsedStartDate);
                }
            }
        }

        if (urlEndDate) {
            const parsedEndDate = new Date(urlEndDate);
            if (!isNaN(parsedEndDate.getTime())) {
                const currentEndTime = endDate.getTime();
                const parsedEndTime = parsedEndDate.getTime();
                // Only update if different (avoid unnecessary updates)
                if (Math.abs(currentEndTime - parsedEndTime) > 1000) {
                    // 1 second tolerance
                    setEndDate(parsedEndDate);
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]); // Only depend on searchParams to avoid circular updates

    // Update URL when selectedUserId or date range changes (to preserve it when navigating back)
    // This ensures the filter state is preserved in the URL
    useEffect(() => {
        const params = new URLSearchParams(searchParams?.toString() || "");
        let urlChanged = false;

        // Update selectedUserId in URL
        const urlSelectedUserId = searchParams?.get("selectedUserId");
        const currentSelectedUserId = selectedUserId || null;
        if (urlSelectedUserId !== currentSelectedUserId) {
            if (currentSelectedUserId) {
                params.set("selectedUserId", currentSelectedUserId);
            } else {
                params.delete("selectedUserId");
            }
            urlChanged = true;
        }

        // Update startDate in URL
        const urlStartDate = searchParams?.get("startDate");
        const currentStartDate = startDate.toISOString();
        if (urlStartDate !== currentStartDate) {
            params.set("startDate", currentStartDate);
            urlChanged = true;
        }

        // Update endDate in URL
        const urlEndDate = searchParams?.get("endDate");
        const currentEndDate = endDate.toISOString();
        if (urlEndDate !== currentEndDate) {
            params.set("endDate", currentEndDate);
            urlChanged = true;
        }

        const urlBusinessUnitId = searchParams?.get("businessUnitId");
        const currentBusinessUnitId =
            selectedBusinessUnitId != null
                ? String(selectedBusinessUnitId)
                : null;
        if (urlBusinessUnitId !== currentBusinessUnitId) {
            if (selectedBusinessUnitId != null) {
                params.set("businessUnitId", String(selectedBusinessUnitId));
            } else {
                params.delete("businessUnitId");
            }
            urlChanged = true;
        }

        // Only update URL if something actually changed
        if (urlChanged) {
            const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
            router.replace(newUrl, { scroll: false });
        }
    }, [selectedUserId, startDate, endDate, selectedBusinessUnitId, router]);

    const handleBusinessUnitChange = (businessUnitId: number | null) => {
        setSelectedBusinessUnitId(businessUnitId);
    };

    const {
        data: dashboardData,
        isLoading,
        error,
        refetch,
    } = useQuery<OperationDashboardResponse>({
        queryKey: [
            "operationDashboardData",
            {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                selectedUserId: selectedUserId,
                businessUnitId: selectedBusinessUnitId,
            },
            session?.user?.view_as_user_id,
        ],
        queryFn: async () => {
            const data = await fetchOperationDashboardData({
                queryKey: [
                    "operationDashboardData",
                    {
                        startDate: startDate.toISOString(),
                        endDate: endDate.toISOString(),
                        selectedUserId: selectedUserId,
                        businessUnitId: selectedBusinessUnitId,
                    },
                ],
            } as any);
            return data;
        },
        enabled:
            isSessionReady &&
            status === "authenticated" &&
            !!startDate &&
            !!endDate,
        staleTime: 0, // Always fetch fresh data
        refetchOnMount: true, // Refetch when component mounts
    });

    // Force initial fetch when dates are ready
    useEffect(() => {
        if (isSessionReady && status === "authenticated" && startDate && endDate) {
            refetch();
        }
    }, [isSessionReady, status]); // Only run when session becomes ready

    // Log errors separately
    React.useEffect(() => {
        if (error) {
            console.error("[OPERATION DASHBOARD] Error fetching data:", error);
        }
    }, [error]);

    // Mark page as loaded after data is fetched
    useEffect(() => {
        if (isSessionReady && !isLoading && dashboardData) {
            const timer = setTimeout(() => {
                setPageLoaded(true);
            }, 100);
            return () => clearTimeout(timer);
        } else if (isLoading) {
            setPageLoaded(false);
        }
    }, [isSessionReady, isLoading, dashboardData]);

    // Show loading state while session is initializing
    if (!isSessionReady) {
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
                    {t("messages.session_error", { ns: "common" })}
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
                    {t("messages.error", { ns: "common" })}
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
                        error instanceof Error &&
                            error.message === "business_unit_access_denied"
                            ? "messages.business_unit_access_denied"
                            : "messages.error_loading_dashboard",
                        { ns: "dashboard" }
                    )}
                </Typography>
                <Button
                    variant="contained"
                    onClick={() => refetch()}
                    sx={{
                        mt: 2,
                        px: { xs: 3, sm: 4 },
                        py: { xs: 1, sm: 1.5 },
                    }}
                >
                    {t("actions.try_again", { ns: "common" })}
                </Button>
            </Box>
        );
    }

    return (
        <>
            <Seo
                title={t("fields.operation_dashboard_title", {
                    ns: "dashboard",
                })}
            />
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
                        title={t("fields.operation_dashboard_title", {
                            ns: "dashboard",
                        })}
                        description={t(
                            "fields.operation_dashboard_description",
                            { ns: "dashboard" }
                        )}
                        sticky={false}
                        flushHorizontal
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
                        sx={{
                            pb: 2,
                        }}
                    >
                        <Box
                            sx={{
                                pt: theme.spacing(1.5),
                                pb: theme.spacing(0.625),
                                px: 0,
                                marginBottom: theme.spacing(1),
                                backgroundColor: "transparent",
                                display: "flex",
                                flexDirection: "row",
                                gap: theme.spacing(1),
                                alignItems: "center",
                                minHeight: "56px",
                                direction: i18n.language === "he" ? "rtl" : "ltr",
                                flexWrap: "nowrap",
                                overflow: "visible",
                                justifyContent: "flex-start",
                                boxSizing: "border-box",
                            }}
                        >
                            <UserFilter
                                selectedUserId={selectedUserId}
                                onUserChange={setSelectedUserId}
                                businessUnitId={selectedBusinessUnitId}
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
                            <BusinessUnitDashboardFilter
                                value={selectedBusinessUnitId}
                                onChange={handleBusinessUnitChange}
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
                            <DateRangePicker
                                startDate={startDate}
                                endDate={endDate}
                                onStartDateChange={setStartDate}
                                onEndDateChange={setEndDate}
                            />
                        </Box>
                        <DashboardBusinessUnitProvider
                            value={selectedBusinessUnitId}
                        >
                            <OperationDashboardGrid
                                data={dashboardData}
                                pageLoaded={pageLoaded}
                                startDate={startDate}
                                endDate={endDate}
                                selectedUserId={selectedUserId}
                            />
                        </DashboardBusinessUnitProvider>
                    </Box>
                </Box>
            </Box>
        </>
    );
};

export default OperationDashboardContainer;
