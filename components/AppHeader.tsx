import {
    AccountCircle,
    KeyboardArrowDown as ChevronDown,
    Menu as MenuIcon,
    Sync,
} from "@mui/icons-material";
import {
    AppBar,
    Avatar,
    Box,
    Button,
    IconButton,
    Slide,
    Toolbar,
    Tooltip,
    Typography,
    alpha,
    useTheme,
} from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api, { apiFetch } from "@/app/api";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
    generatePastelAvatarUrl,
    getPastelColorForUser,
} from "@/utils/avatarUtils";
import { formatDateForDisplay } from "@/utils/datetimeOperations";

import GlobalSearch from "./GlobalSearch";
import NotificationCenter from "./NotificationCenter";
import ProfileMenu from "./ProfileMenu";
import ViewAsMenu from "./ViewAsMenu";

interface AppHeaderProps {
    onDrawerToggle: () => void;
    session: any;
    effectiveUser: any;
    currentViewAsUser: any;
    currentViewAsUserName: string;
    controlCenterIssueCount: number;
    collectionAgents: any[];
    loading: boolean;
    handleViewAsChange: (_userId: string) => void;
    handleClearViewAs: () => void;
    handleLogout: () => void;
    isHebrewUser?: boolean;
    sidebarOpen?: boolean;
}

const AppHeader: React.FC<AppHeaderProps> = ({
    onDrawerToggle,
    session,
    effectiveUser,
    currentViewAsUser,
    currentViewAsUserName,
    collectionAgents,
    loading,
    handleViewAsChange,
    handleClearViewAs,
    handleLogout,
    isHebrewUser = false,
    sidebarOpen = true,
}) => {
    const theme = useTheme();
    const { t: tCommon } = useTranslation(["common"]);

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [viewAsAnchorEl, setViewAsAnchorEl] = useState<null | HTMLElement>(
        null
    );
    const queryClient = useQueryClient();
    const [mounted, setMounted] = useState(false);

    // Prevent hydration mismatch by only calculating current time after mount
    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch user permissions for View As button visibility
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
        refetchOnWindowFocus: false,
    });

    const userPermissions = userPermissionsData?.permissions || [];
    const hasUseViewAsPermission = userPermissions.includes("use_view_as");
    const hasViewSettingsPermission = userPermissions.includes("view_settings");

    // Fetch customer data using React Query for proper cache management
    const { data: customerData, isLoading: lastSyncLoading } = useQuery({
        queryKey: ["customer", session?.user?.account_id],
        queryFn: async () => {
            if (!session?.user?.account_id) {
                throw new Error("No customer ID available");
            }
            const response = await apiFetch(`/api/entities/accounts/${session.user.account_id}`
            );
            if (!response.ok) {
                throw new Error("Failed to fetch customer data");
            }
            const data = await response.json();
            return data;
        },
        enabled: !!session?.user?.account_id,
        staleTime: 30000, // Consider data stale after 30 seconds
        refetchOnWindowFocus: true, // Refetch when window regains focus
    });

    const lastSyncDate = customerData?.last_sync_date
        ? customerData.last_sync_date instanceof Date
            ? customerData.last_sync_date
            : new Date(customerData.last_sync_date)
        : null;

    // Function to manually refresh customer data
    const refreshLastSync = async () => {
        try {
            // Invalidate the customer query to refetch the data
            queryClient.invalidateQueries({
                queryKey: ["customer", session?.user?.account_id],
            });
        } catch {
            // Silently handle errors
        }
    };

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        if (anchorEl) {
            handleMenuClose();
            return;
        }
        try {
            window.dispatchEvent(new Event("closeAllHeaderOverlays"));
        } catch {
            // Silently handle errors
        }
        try {
            (event.currentTarget as HTMLElement)?.blur();
        } catch {
            // Silently handle errors
        }
        setViewAsAnchorEl(null);
        setTimeout(() => {
            setAnchorEl(toolbarRef.current || event.currentTarget);
        }, 200);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleViewAsMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        if (viewAsAnchorEl) {
            handleViewAsMenuClose();
            return;
        }
        try {
            window.dispatchEvent(new Event("closeAllHeaderOverlays"));
        } catch {
            // Silently handle errors
        }
        try {
            (event.currentTarget as HTMLElement)?.blur();
        } catch {
            // Silently handle errors
        }
        setAnchorEl(null);
        setTimeout(() => {
            setViewAsAnchorEl(toolbarRef.current || event.currentTarget);
        }, 200);
    };

    const handleViewAsMenuClose = () => {
        setViewAsAnchorEl(null);
    };

    const viewAsHeaderRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        const handler = () => {
            setAnchorEl(null);
            setViewAsAnchorEl(null);
        };
        window.addEventListener("closeAllHeaderOverlays", handler);
        return () =>
            window.removeEventListener("closeAllHeaderOverlays", handler);
    }, []);

    const formatLastSyncDate = (date: Date | null | string) => {
        if (!date) {
            return tCommon("messages.never_synced", "Never synced");
        }

        // Ensure we have a proper Date object
        const dateObj = date instanceof Date ? date : new Date(date);

        // Check if the date is valid
        if (isNaN(dateObj.getTime())) {
            return tCommon("messages.never_synced", "Never synced");
        }

        // Only calculate current time after component is mounted to prevent hydration mismatch
        // During SSR, return a stable placeholder that won't cause hydration issues
        if (!mounted) {
            // Return a stable format during SSR - will be recalculated after mount
            return tCommon("messages.last_synced", "Last synced");
        }

        const now = new Date();
        const diffInMinutes = Math.floor(
            (now.getTime() - dateObj.getTime()) / (1000 * 60)
        );

        if (diffInMinutes < 1) {
            return `${tCommon("messages.last_synced", "Last synced")} ${tCommon("messages.just_now", "just now")}`;
        } else if (diffInMinutes < 60) {
            return `${tCommon("messages.last_synced", "Last synced")} ${tCommon("messages.minutes_ago", "{{count}}m ago", { count: diffInMinutes })}`;
        } else if (diffInMinutes < 1440) {
            const hours = Math.floor(diffInMinutes / 60);
            return `${tCommon("messages.last_synced", "Last synced")} ${tCommon("messages.hours_ago", "{{count}}h ago", { count: hours })}`;
        } else if (diffInMinutes < 10080) {
            // Less than a week
            const days = Math.floor(diffInMinutes / 1440);
            return `${tCommon("messages.last_synced", "Last synced")} ${tCommon("messages.days_ago", "{{count}}d ago", { count: days })}`;
        } else {
            return tCommon(
                "messages.sync_status_very_old_sync",
                "Data outdated"
            );
        }
    };

    const getSyncStatusColor = (date: Date | null | string) => {
        if (!date) {
            return "rgba(255, 193, 7, 0.8)"; // Amber for never synced
        }

        // Ensure we have a proper Date object
        const dateObj = date instanceof Date ? date : new Date(date);

        // Check if the date is valid
        if (isNaN(dateObj.getTime())) {
            return "rgba(255, 193, 7, 0.8)"; // Amber for invalid date
        }

        const now = new Date();
        const diffInMinutes = Math.floor(
            (now.getTime() - dateObj.getTime()) / (1000 * 60)
        );

        if (diffInMinutes < 60) {
            return "rgba(76, 175, 80, 0.8)"; // Green for fresh data (< 1 hour)
        } else if (diffInMinutes < 1440) {
            return "rgba(255, 152, 0, 0.8)"; // Orange for somewhat stale (< 1 day)
        } else if (diffInMinutes < 10080) {
            return "rgba(255, 87, 34, 0.8)"; // Deep orange for old data (< 1 week)
        } else {
            return "rgba(244, 67, 54, 0.8)"; // Red for very old data (> 1 week)
        }
    };

    const getCurrentAccountName = () => {
        // Show view-as user's customer name when in view-as mode
        if (
            session?.user?.view_as_user_id &&
            session?.user?.view_as_user_account_name
        ) {
            return session.user.view_as_user_account_name;
        }

        // Use fetched customer data name if available
        if (customerData?.name) {
            return customerData.name;
        }

        // Otherwise, use the session user's customer name
        return (
            session?.user?.account_name ||
            (session?.user?.account_id
                ? `Account ${session.user.account_id}`
                : "Default Account")
        );
    };

    const getAvatarUrl = (
        size: number = 32,
        forViewAsUser: boolean = false
    ) => {
        // If in view-as mode and we want the view-as user's avatar
        if (
            forViewAsUser &&
            session?.user?.view_as_user_id &&
            currentViewAsUser
        ) {
            const viewAsUserName =
                currentViewAsUser.first_name && currentViewAsUser.last_name
                    ? `${currentViewAsUser.first_name} ${currentViewAsUser.last_name}`
                    : currentViewAsUser.name ||
                    currentViewAsUser.email ||
                    "User";
            return (
                currentViewAsUser.image ??
                generatePastelAvatarUrl(
                    viewAsUserName,
                    session.user.view_as_user_id,
                    size
                )
            );
        }

        // Default: show session user's avatar
        const userId = session?.user?.id || "default";
        return (
            session?.user?.image ??
            generatePastelAvatarUrl(session?.user?.name || "User", userId, size)
        );
    };

    const handleAvatarError = (
        e: React.SyntheticEvent<HTMLImageElement, Event>,
        forViewAsUser: boolean = false
    ) => {
        const target = e.target as HTMLImageElement;
        if (!target.src.includes("ui-avatars.com")) {
            if (
                forViewAsUser &&
                currentViewAsUser &&
                session?.user?.view_as_user_id
            ) {
                const viewAsUserName =
                    currentViewAsUser.first_name && currentViewAsUser.last_name
                        ? `${currentViewAsUser.first_name} ${currentViewAsUser.last_name}`
                        : currentViewAsUser.name ||
                        currentViewAsUser.email ||
                        "User";
                target.src = generatePastelAvatarUrl(
                    viewAsUserName,
                    session.user.view_as_user_id,
                    target.width || 32
                );
            } else {
                const userId = session?.user?.id || "default";
                target.src = generatePastelAvatarUrl(
                    session?.user?.name || "User",
                    userId,
                    target.width || 32
                );
            }
        }
    };

    const toolbarRef = React.useRef<HTMLDivElement | null>(null);

    const TransitionDown = React.useMemo(() => {
        const TransitionComponent = React.forwardRef<HTMLDivElement, any>(
            (props: any, ref: React.Ref<HTMLDivElement>) => {
                return (
                    <Slide
                        ref={ref}
                        {...props}
                        direction="down"
                        timeout={{ enter: 1600, exit: 1400 }}
                        easing={{
                            enter: "cubic-bezier(0.4, 0, 0.2, 1)",
                            exit: "cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                    />
                );
            }
        );
        TransitionComponent.displayName = "TransitionDown";
        return TransitionComponent;
    }, []);

    return (
        <AppBar
            position="fixed"
            sx={{
                top: session?.user?.view_as_user_id ? "40px" : 0,
                transition: "top 0.3s ease-in-out",
                zIndex: theme.zIndex.drawer - 1,
                backgroundColor: alpha(theme.palette.primary.main, 0.95),
                backgroundImage: isHebrewUser
                    ? `linear-gradient(225deg, ${alpha(theme.palette.primary.main, 0.95)} 0%, ${alpha(theme.palette.primary.main, 0.95)} 65%, ${alpha(theme.palette.secondary.main, 0.95)} 100%)`
                    : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.95)} 0%, ${alpha(theme.palette.primary.main, 0.95)} 65%, ${alpha(theme.palette.secondary.main, 0.95)} 100%)`,
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                boxShadow:
                    "0 4px 20px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)",
                border: "none",
                borderRadius: 0,
                "&::before": {
                    content: '""',
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "1px",
                    background: isHebrewUser
                        ? `linear-gradient(270deg, transparent 0%, ${alpha(theme.palette.common.white, 0.2)} 50%, transparent 100%)`
                        : `linear-gradient(90deg, transparent 0%, ${alpha(theme.palette.common.white, 0.2)} 50%, transparent 100%)`,
                },
            }}
        >
            <Toolbar
                ref={toolbarRef}
                sx={{
                    minHeight: { xs: "56px !important", md: "64px !important" },
                    px: { xs: 1.5, sm: 2, md: 3 },
                    gap: { xs: 1, md: 2 },
                    position: "relative",
                }}
            >
                {/* Left Section - Navigation Controls */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        flexShrink: 0,
                        zIndex: 1,
                        ml: {
                            sm: isHebrewUser
                                ? 0
                                : sidebarOpen
                                    ? "210px"
                                    : "61px",
                        },
                        mr: {
                            sm: isHebrewUser
                                ? sidebarOpen
                                    ? "210px"
                                    : "61px"
                                : 0,
                        },
                        transition:
                            "margin-left 0.3s ease-in-out, margin-right 0.3s ease-in-out",
                    }}
                >
                    <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        edge="start"
                        onClick={onDrawerToggle}
                        sx={{
                            display: { sm: "none" },
                            backgroundColor: alpha(
                                theme.palette.common.white,
                                0.1
                            ),
                            backdropFilter: "blur(10px)",
                            border: `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                            "&:hover": {
                                backgroundColor: alpha(
                                    theme.palette.common.white,
                                    0.2
                                ),
                                transform: "translateY(-1px)",
                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                            },
                        }}
                    >
                        <MenuIcon />
                    </IconButton>
                    {/* Account Badge - Borderless Design */}
                    <Box
                        sx={{
                            display: { xs: "none", sm: "flex" },
                            alignItems: "center",
                            gap: 1,
                            px: 1.5,
                            py: 0.75,
                            height: "32px",
                            background: `linear-gradient(135deg, ${alpha(theme.palette.common.white, 0.15)} 0%, ${alpha(theme.palette.common.white, 0.08)} 100%)`,
                            backdropFilter: "blur(12px)",
                            borderRadius: theme.spacing(3),
                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                            cursor: "pointer",
                            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                            "&:hover": {
                                background: `linear-gradient(135deg, ${alpha(theme.palette.common.white, 0.2)} 0%, ${alpha(theme.palette.common.white, 0.12)} 100%)`,
                                transform: "translateY(-1px)",
                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                            },
                        }}
                    >
                        <Box
                            sx={{
                                width: 20,
                                height: 20,
                                borderRadius: "50%",
                                background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: `0 2px 6px ${alpha(theme.palette.primary.main, 0.4)}`,
                                flexShrink: 0,
                            }}
                        >
                            <Box
                                sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    backgroundColor: "white",
                                    opacity: 0.95,
                                }}
                            />
                        </Box>
                        <Typography
                            variant="caption"
                            sx={{
                                color: alpha(theme.palette.common.white, 0.95),
                                fontWeight: 600,
                                fontSize: "0.75rem",
                                maxWidth: { sm: "120px", md: "160px" },
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                letterSpacing: "0.02em",
                            }}
                        >
                            {getCurrentAccountName()}
                        </Typography>
                    </Box>
                </Box>

                {/* Center Section - Global Search */}
                <Box
                    sx={{
                        position: "absolute",
                        left: "50%",
                        transform: "translateX(-50%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        width: {
                            xs: "calc(100% - 200px)",
                            sm: "calc(100% - 300px)",
                            md: "500px",
                        },
                        maxWidth: "500px",
                    }}
                >
                    <GlobalSearch isHebrewUser={isHebrewUser} />
                </Box>

                {/* Right Section - User Controls */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: isHebrewUser
                            ? "flex-start"
                            : "flex-end",
                        gap: { xs: 0.75, sm: 1 },
                        flexShrink: 0,
                        ml: isHebrewUser ? 0 : "auto",
                        mr: isHebrewUser ? "auto" : 0,
                        direction: isHebrewUser ? "rtl" : "ltr",
                    }}
                >
                    {/* Last Sync Status - Compact Indicator */}
                    {!lastSyncLoading && (
                        <Tooltip
                            title={`${lastSyncDate ? formatDateForDisplay(lastSyncDate, "datetime", session?.user?.locale, session?.user?.timezone) : tCommon("messages.sync_status_never_synced", "Never synced")} — ${tCommon("messages.sync_status_erp_scheduled_only", "Reflects scheduled ERP billing sync only; file import and manual sync are excluded")}. ${tCommon("messages.sync_status_click_to_refresh")}`}
                            arrow
                        >
                            <Box
                                onClick={refreshLastSync}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.75,
                                    px: 1.25,
                                    py: 0.5,
                                    backgroundColor: alpha(
                                        theme.palette.common.white,
                                        0.1
                                    ),
                                    backdropFilter: "blur(10px)",
                                    borderRadius: theme.spacing(3),
                                    border: `1px solid ${alpha(getSyncStatusColor(lastSyncDate), 0.3)}`,
                                    transition:
                                        "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                    cursor: "pointer",
                                    "&:hover": {
                                        backgroundColor: alpha(
                                            theme.palette.common.white,
                                            0.15
                                        ),
                                        transform: "translateY(-1px)",
                                        boxShadow:
                                            "0 4px 12px rgba(0, 0, 0, 0.15)",
                                    },
                                }}
                            >
                                <Sync
                                    sx={{
                                        fontSize: 14,
                                        color: getSyncStatusColor(lastSyncDate),
                                        animation: lastSyncDate
                                            ? "none"
                                            : "pulse 2s infinite",
                                    }}
                                />
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: alpha(
                                            theme.palette.common.white,
                                            0.9
                                        ),
                                        fontWeight: 500,
                                        fontSize: "0.6875rem",
                                        whiteSpace: "nowrap",
                                        display: { xs: "none", md: "block" },
                                    }}
                                >
                                    {formatLastSyncDate(lastSyncDate)}
                                </Typography>
                            </Box>
                        </Tooltip>
                    )}

                    {/* View As Selector - Only show if user has use_view_as permission */}
                    {/* Check actual session role, not effective user role, so it shows even when viewing as another user */}
                    {/* Exclude account_id 10013 (system admin) */}
                    {hasUseViewAsPermission &&
                        session?.user?.account_id !== 10013 && (
                            <Button
                                variant="text"
                                size="small"
                                onClick={handleViewAsMenuOpen}
                                startIcon={
                                    <AccountCircle
                                        sx={{ fontSize: 18, color: "white" }}
                                    />
                                }
                                endIcon={
                                    <ChevronDown
                                        sx={{ fontSize: 16, color: "white" }}
                                    />
                                }
                                sx={{
                                    color: "white",
                                    backgroundColor: alpha(
                                        theme.palette.common.white,
                                        0.1
                                    ),
                                    backdropFilter: "blur(10px)",
                                    border: `1px solid ${alpha(theme.palette.common.white, 0.15)}`,
                                    borderRadius: theme.spacing(3),
                                    fontWeight: 600,
                                    textTransform: "none",
                                    fontSize: "0.8125rem",
                                    px: 1.5,
                                    py: 0.5,
                                    height: "28px",
                                    direction: isHebrewUser ? "rtl" : "ltr",
                                    transition:
                                        "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                    "& .MuiButton-startIcon": {
                                        marginRight: isHebrewUser ? 0 : "6px",
                                        marginLeft: isHebrewUser ? "6px" : 0,
                                    },
                                    "& .MuiButton-endIcon": {
                                        marginLeft: isHebrewUser ? 0 : "6px",
                                        marginRight: isHebrewUser ? "6px" : 0,
                                    },
                                    "&:hover": {
                                        backgroundColor: alpha(
                                            theme.palette.common.white,
                                            0.15
                                        ),
                                        borderColor: alpha(
                                            theme.palette.common.white,
                                            0.25
                                        ),
                                        transform: "translateY(-1px)",
                                        boxShadow:
                                            "0 4px 12px rgba(0, 0, 0, 0.15)",
                                    },
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    sx={{
                                        display: { xs: "none", lg: "block" },
                                        fontWeight: 600,
                                        color: "white",
                                    }}
                                >
                                    {currentViewAsUserName ||
                                        tCommon("actions.view_as")}
                                </Typography>
                            </Button>
                        )}

                    {/* Enhanced Notification Center */}
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            position: "relative",
                        }}
                    >
                        <NotificationCenter
                            anchorElOverride={toolbarRef.current}
                        />
                    </Box>

                    {/* User Profile Avatar */}
                    <IconButton
                        onClick={(e) => {
                            handleMenuOpen(e);
                        }}
                        sx={{
                            p: 0.5,
                            color: "white",
                            backgroundColor: "transparent",
                            transition: "opacity 0.2s ease",
                            "&:hover": {
                                backgroundColor: "transparent",
                                opacity: 0.85,
                            },
                        }}
                    >
                        <Avatar
                            sx={{
                                width: 32,
                                height: 32,
                                border: session?.user?.view_as_user_id
                                    ? `2px solid ${alpha(theme.palette.error.light, 0.6)}`
                                    : `2px solid ${alpha(theme.palette.common.white, 0.3)}`,
                                bgcolor:
                                    session?.user?.view_as_user_id &&
                                        currentViewAsUser
                                        ? getPastelColorForUser(
                                            session.user.view_as_user_id
                                        )
                                        : session?.user?.id
                                            ? getPastelColorForUser(
                                                session.user.id
                                            )
                                            : undefined,
                                color: "#333",
                            }}
                        >
                            <img
                                src={getAvatarUrl(
                                    32,
                                    !!session?.user?.view_as_user_id
                                )}
                                alt="User Avatar"
                                onError={(e) =>
                                    handleAvatarError(
                                        e,
                                        !!session?.user?.view_as_user_id
                                    )
                                }
                            />
                        </Avatar>
                    </IconButton>
                </Box>

                {/* View As Menu */}
                <ViewAsMenu
                    anchorEl={viewAsAnchorEl}
                    open={Boolean(viewAsAnchorEl)}
                    onClose={handleViewAsMenuClose}
                    isHebrewUser={isHebrewUser}
                    isViewAsActive={!!session?.user?.view_as_user_id}
                    collectionAgents={collectionAgents}
                    loading={loading}
                    onSelectUser={(id: string) => handleViewAsChange(id)}
                    TransitionComponent={TransitionDown as any}
                    headerRef={viewAsHeaderRef}
                />

                {/* User Profile Menu */}
                <ProfileMenu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleMenuClose}
                    isHebrewUser={isHebrewUser}
                    TransitionComponent={TransitionDown as any}
                    session={session}
                    currentViewAsUser={currentViewAsUser}
                    effectiveUser={effectiveUser}
                    hasViewSettingsPermission={hasViewSettingsPermission}
                    onLogout={handleLogout}
                />
            </Toolbar>
        </AppBar>
    );
};

export default AppHeader;
