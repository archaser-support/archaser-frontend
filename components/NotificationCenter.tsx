"use client";
import { apiFetch } from "@/utils/apiFetch";

import {
    Bolt as BoltIcon,
    Close as CloseIcon,
    Delete as DeleteIcon,
    Description as DescriptionIcon,
    DoneAll as DoneAllIcon,
    Gavel as GavelIcon,
    Notifications as NotificationsIcon,
    Payment as PaymentIcon,
    Person as PersonIcon,
    Schedule as ScheduleIcon,
    Settings as SettingsIcon,
    Timeline as TimelineIcon,
} from "@mui/icons-material";
import {
    Badge,
    Box,
    Button,
    CircularProgress,
    IconButton,
    List,
    ListItem,
    ListItemIcon,
    Paper,
    Popover,
    Slide,
    Tooltip,
    Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import moment from "moment";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ToolbarDropdownFilter } from "@/shared/components/ToolbarDropdownFilter";
import { markNotificationRead } from "@/shared/services/notificationService";
import { isWebSocketEnabled, resolveNotificationsSseUrl } from "@/utils/amplifyMode";
import { getNestAccessToken } from "@/utils/nestAuth";
import { getLocalizedNotificationText } from "@/utils/notificationDisplayText";

interface Notification {
    id: string;
    type:
    | "control-center"
    | "dispute"
    | "invoice"
    | "activity"
    | "assignment"
    | "overdue"
    | "payment"
    | "system"
    | "Primary"
    | "Secondary";
    title: string;
    message: string;
    priority: "low" | "medium" | "high" | "urgent";
    timestamp: Date;
    actionUrl?: string;
    metadata?: Record<string, any>;
    read?: boolean;
}

interface NotificationStats {
    total: number;
    unread: number;
    byType: {
        controlCenter: number;
        disputes: number;
        invoices: number;
        activities: number;
        assignments: number;
        overdue: number;
        payments: number;
        system: number;
    };
    byPriority: {
        low: number;
        medium: number;
        high: number;
        urgent: number;
    };
}

interface NotificationCenterProps {
    anchorElOverride?: HTMLElement | null;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
    anchorElOverride = null,
}) => {
    // Component initialization
    const { data: session, status: sessionStatus } = useSession();
    const { t, i18n } = useTranslation(["notifications", "common"]);
    const router = useRouter();
    const isRTL = i18n.language === "he";
    const headerSpacing = { gap: 0.5, px: 1, py: 0.25 } as const;
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [stats, setStats] = useState<NotificationStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<"all" | Notification["type"]>("all");
    const [priorityFilter, setPriorityFilter] = useState<
        "all" | Notification["priority"]
    >("all");
    const anchorRef = useRef<HTMLButtonElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);

    // Close when other header overlays request closing
    useEffect(() => {
        const handler = () => setIsOpen(false);
        window.addEventListener("closeAllHeaderOverlays", handler);
        return () =>
            window.removeEventListener("closeAllHeaderOverlays", handler);
    }, []);

    const TransitionDown = React.useMemo(
        () =>
            React.forwardRef((props: any, ref: React.Ref<unknown>) => {
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
            }),
        []
    );

    // Constants and mappings
    const typeIcons = {
        "control-center": BoltIcon,
        dispute: GavelIcon,
        invoice: DescriptionIcon,
        activity: TimelineIcon,
        assignment: PersonIcon,
        overdue: ScheduleIcon,
        payment: PaymentIcon,
        system: SettingsIcon,
        Primary: GavelIcon, // API type for disputes
        Secondary: SettingsIcon, // Default icon for Secondary notifications
    };

    const priorityColors = {
        low: "default",
        medium: "primary",
        high: "warning",
        urgent: "error",
    } as const;

    const priorityLabels = {
        low: t("values.priority_low", {
            ns: "notifications",
            defaultValue: "Low",
        }),
        medium: t("values.priority_medium", {
            ns: "notifications",
            defaultValue: "Medium",
        }),
        high: t("values.priority_high", {
            ns: "notifications",
            defaultValue: "High",
        }),
        urgent: t("values.priority_urgent", {
            ns: "notifications",
            defaultValue: "Urgent",
        }),
    };

    // ===== EFFECTS =====
    // Real-time updates via Server-Sent Events (disabled on Amplify until Nest owns WS)
    useEffect(() => {
        if (!isWebSocketEnabled()) {
            return;
        }

        // Only connect if we're in the browser, session is authenticated, and user ID exists
        if (
            typeof window === "undefined" ||
            sessionStatus !== "authenticated" ||
            !session?.user?.id
        ) {
            return;
        }

        let eventSource: EventSource | null = null;
        let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
        let reconnectAttempts = 0;
        const MAX_RECONNECT_ATTEMPTS = 5;
        const INITIAL_RECONNECT_DELAY = 5000; // 5 seconds

        const connectEventSource = () => {
            // Don't attempt to reconnect if we've exceeded max attempts
            if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                console.warn(
                    `[NotificationCenter] Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Stopping EventSource reconnection.`
                );
                return;
            }

            // Verify session is still valid before connecting
            if (!session?.user?.id) {
                console.warn(
                    "[NotificationCenter] Session invalid, skipping EventSource connection"
                );
                return;
            }

            if (eventSource) {
                eventSource.close();
            }

            try {
                const sseUrl = resolveNotificationsSseUrl(getNestAccessToken());
                eventSource = new EventSource(sseUrl, {
                    withCredentials: true,
                });

                eventSource.onopen = () => {
                    // Connection successful - reset reconnect attempts
                    reconnectAttempts = 0;
                    // Clear any pending reconnect timeout
                    if (reconnectTimeout) {
                        clearTimeout(reconnectTimeout);
                        reconnectTimeout = null;
                    }
                };

                eventSource.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);

                        if (message.type === "notification-update") {
                            // Check if this update is relevant for the current user
                            const isRelevantUpdate =
                                !message.userId ||
                                message.userId === session.user.id ||
                                message.userId === "";

                            if (isRelevantUpdate) {
                                // Nest SSE payloads often omit stats (`data: {}`).
                                // Only apply message.data when it includes byPriority;
                                // otherwise refetch so the UI never renders a partial shape.
                                const incoming = message.data;
                                if (
                                    incoming &&
                                    typeof incoming === "object" &&
                                    incoming.byPriority &&
                                    typeof incoming.byPriority.urgent ===
                                        "number"
                                ) {
                                    setStats(incoming);
                                } else {
                                    fetchStats();
                                }

                                // If the popover is open, also refresh the notifications list
                                if (isOpen) {
                                    fetchNotifications();
                                }
                            }
                        } else if (message.type === "error") {
                            // Handle error messages from the server
                            console.error(
                                "[NotificationCenter] Server error:",
                                message.message || "Unknown error"
                            );
                        }
                    } catch (error) {
                        console.error(
                            "Error parsing notification update:",
                            error
                        );
                    }
                };

                eventSource.onerror = (event) => {
                    // EventSource onerror receives an Event object, not an Error object
                    // readyState: 0 = CONNECTING, 1 = OPEN, 2 = CLOSED
                    const readyState = eventSource?.readyState ?? 2;
                    const CONNECTING = 0;
                    const OPEN = 1;
                    const CLOSED = 2;

                    // Only log errors if connection is actually closed (not just connecting)
                    if (readyState === CLOSED) {
                        reconnectAttempts++;
                        const errorInfo = {
                            readyState,
                            state: "CLOSED",
                            url: eventSource?.url,
                            type: event.type,
                            reconnectAttempt: reconnectAttempts,
                            maxAttempts: MAX_RECONNECT_ATTEMPTS,
                        };

                        // Only log if we haven't exceeded max attempts
                        if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
                            console.warn(
                                `[NotificationCenter] EventSource connection closed. Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}:`,
                                errorInfo
                            );
                        }

                        // Attempt to reconnect after delay if connection is closed and we haven't exceeded max attempts
                        if (
                            readyState === CLOSED &&
                            !reconnectTimeout &&
                            reconnectAttempts < MAX_RECONNECT_ATTEMPTS
                        ) {
                            // Exponential backoff: 5s, 10s, 20s, 40s, 80s
                            const delay =
                                INITIAL_RECONNECT_DELAY *
                                Math.pow(2, reconnectAttempts - 1);
                            reconnectTimeout = setTimeout(() => {
                                reconnectTimeout = null;
                                connectEventSource();
                            }, delay);
                        }
                    }
                };
            } catch (error) {
                console.error(
                    "[NotificationCenter] Error creating EventSource:",
                    error
                );
            }
        };

        // Initial connection
        connectEventSource();

        return () => {
            if (eventSource) {
                eventSource.close();
            }
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
        };
    }, [session?.user?.id, sessionStatus]);

    // Fetch initial stats when component mounts
    useEffect(() => {
        if (session?.user?.id) {
            fetchStats();
        }
    }, [session?.user?.id]);

    // Listen for custom notification clearing events
    useEffect(() => {
        const handleNotificationsCleared = () => {
            // Refresh stats when notifications are cleared
            fetchStats();
        };

        window.addEventListener(
            "notificationsCleared",
            handleNotificationsCleared
        );

        return () => {
            window.removeEventListener(
                "notificationsCleared",
                handleNotificationsCleared
            );
        };
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
            fetchStats();
        }
    }, [isOpen, filter, priorityFilter]);

    // ===== DATA FETCHING FUNCTIONS =====
    const fetchNotifications = async () => {
        if (!session?.user?.id) return;

        setLoading(true);
        try {
            const params = new URLSearchParams({
                limit: "50",
            });

            if (filter !== "all") {
                // Map frontend filter values to API types
                let apiType = filter;
                if (filter === "dispute") {
                    apiType = "Primary"; // Map 'dispute' filter to 'Primary' API type
                }
                params.append("type", apiType);
            }

            if (priorityFilter !== "all") {
                // Map frontend priority values to API case format
                let apiPriority: string = priorityFilter;
                if (priorityFilter === "high") {
                    apiPriority = "High";
                } else if (priorityFilter === "medium") {
                    apiPriority = "Medium";
                } else if (priorityFilter === "low") {
                    apiPriority = "Low";
                } else if (priorityFilter === "urgent") {
                    apiPriority = "Urgent";
                }
                params.append("priority", apiPriority);
            }

            const response = await apiFetch(`/api/operations/notifications?${params}`
            );
            if (response.ok) {
                const data = await response.json();
                const mappedNotifications = data.notifications.map(
                    (n: any) => ({
                        ...n,
                        timestamp: new Date(n.timestamp),
                    })
                );
                setNotifications(mappedNotifications);
            }
        } catch (error) {
            console.error("Error fetching notifications:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        if (!session?.user?.id) return;

        try {
            const response = await apiFetch("/api/operations/notifications?stats=true"
            );
            if (response.ok) {
                const data = await response.json();
                if (data?.byPriority) {
                    setStats(data);
                }
            }
        } catch (error) {
            console.error("Error fetching notification stats:", error);
        }
    };

    const deleteNotification = async (notificationId: string) => {
        try {
            const response = await apiFetch(`/api/operations/notifications/${notificationId}`,
                {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                }
            );

            if (response.ok) {
                setNotifications((prev) =>
                    prev.filter((n) => n.id !== notificationId)
                );
                fetchStats();
            } else {
                console.error(
                    "Failed to delete notification:",
                    response.status,
                    response.statusText
                );
            }
        } catch (error) {
            console.error("Error deleting notification:", error);
        }
    };

    const cleanupOldNotifications = async () => {
        try {
            const response = await apiFetch("/api/operations/notifications", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "deleteRead",
                    olderThanDays: 7,
                }),
            });

            if (response.ok) {
                fetchNotifications();
                fetchStats();
            } else {
                console.error(
                    "Failed to cleanup old notifications:",
                    response.status,
                    response.statusText
                );
            }
        } catch (error) {
            console.error("Error cleaning up old notifications:", error);
        }
    };

    const deleteAllNotifications = async () => {
        try {
            const response = await apiFetch("/api/operations/notifications", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "deleteAll",
                }),
            });

            if (response.ok) {
                setNotifications([]);
                fetchStats();
            } else {
                console.error(
                    "Failed to delete all notifications:",
                    response.status,
                    response.statusText
                );
            }
        } catch (error) {
            console.error("Error deleting all notifications:", error);
        }
    };

    // ===== EVENT HANDLERS =====
    const handleNotificationClick = (notification: Notification) => {
        // Mark read via Nest REST, then remove from the list (click-to-dismiss UX).
        if (!notification.read) {
            void markNotificationRead(notification.id);
        }
        deleteNotification(notification.id);

        if (notification.actionUrl) {
            // Handle old dispute URLs that might still exist in the database
            if (
                notification.type === "dispute" &&
                notification.actionUrl.includes("/disputes/")
            ) {
                // Handle both old /customers/ URLs for backwards compatibility
                const urlMatch = notification.actionUrl.match(
                    /\/(?:customers)\/(\d+)\/disputes\/(\d+)/
                );
                if (urlMatch) {
                    const [, customerId, disputeId] = urlMatch;
                    const newUrl = `/app/customers/${customerId}?activeTab=outstanding-activities-tab&openDispute=${disputeId}`;
                    router.push(newUrl);
                    return;
                }
            }

            // Internal vs external navigation
            const isInternal =
                notification.actionUrl.startsWith("/") &&
                !notification.actionUrl.startsWith("//");
            if (isInternal) {
                router.push(notification.actionUrl);
            } else {
                window.location.href = notification.actionUrl;
            }
        }
    };

    // ===== FILTERING LOGIC =====
    const filteredNotifications = notifications.filter((notification) => {
        // Map filter values to actual API types
        let actualFilter = filter;
        if (filter === "dispute") {
            actualFilter = "Primary"; // Map 'dispute' filter to 'Primary' API type
        }

        if (filter !== "all" && notification.type !== actualFilter)
            return false;

        if (
            priorityFilter !== "all" &&
            notification.priority?.toLowerCase() !==
            priorityFilter.toLowerCase()
        )
            return false;
        return true;
    });

    const notificationCount = stats?.total || 0;
    const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());

    // Update last update time when notification count changes
    useEffect(() => {
        setLastUpdateTime(Date.now());
    }, [notificationCount]);

    // ===== RENDER =====
    return (
        <Box sx={{ display: "inline-block", position: "relative" }}>
            {/* Notification Bell Button */}
            <IconButton
                ref={anchorRef}
                onClick={() => {
                    try {
                        anchorRef.current?.blur();
                    } catch { }
                    if (isOpen) {
                        setIsOpen(false);
                    } else {
                        window.dispatchEvent(
                            new Event("closeAllHeaderOverlays")
                        );
                        setTimeout(() => setIsOpen(true), 200);
                    }
                }}
                sx={{
                    color: "white",
                    backgroundColor: "transparent",
                    "&:hover": {
                        backgroundColor: "transparent",
                        opacity: 0.85,
                    },
                    width: 40,
                    height: 40,
                    transition: "opacity 0.2s ease",
                }}
            >
                <Badge
                    key={`notification-badge-${notificationCount}-${lastUpdateTime}`}
                    badgeContent={
                        notificationCount > 0 ? notificationCount : undefined
                    }
                    color="error"
                    max={99}
                    sx={{
                        transition: "all 0.3s ease",
                        "& .MuiBadge-badge": {
                            animation:
                                lastUpdateTime > Date.now() - 2000
                                    ? "pulse 0.5s ease-in-out"
                                    : "none",
                            backgroundColor: (theme) =>
                                theme.palette.error.main,
                        },
                        "@keyframes pulse": {
                            "0%": { transform: "scale(1)" },
                            "50%": { transform: "scale(1.2)" },
                            "100%": { transform: "scale(1)" },
                        },
                    }}
                >
                    <NotificationsIcon />
                </Badge>
            </IconButton>

            {/* Notification Popover */}
            <Popover
                sx={{
                    zIndex: (theme) => theme.zIndex.drawer - 2,
                    "& .MuiPopover-paper": { border: "none !important" },
                    "& .MuiPaper-root": { border: "none !important" },
                }}
                open={isOpen}
                anchorEl={anchorElOverride ?? anchorRef.current}
                onClose={() => setIsOpen(false)}
                TransitionComponent={TransitionDown as any}
                disableAutoFocus
                disableEnforceFocus
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: i18n.language === "he" ? "left" : "right",
                }}
                transformOrigin={{
                    vertical: "top",
                    horizontal: i18n.language === "he" ? "left" : "right",
                }}
                PaperProps={{
                    sx: {
                        width: 400,
                        maxWidth: "calc(100vw - 32px)",
                        maxHeight: 600,
                        mt: 1.5,
                        borderRadius: (theme) =>
                            typeof theme.shape.borderRadius === "number"
                                ? theme.shape.borderRadius
                                : 4,
                        overflow: "hidden",
                        backgroundColor: (theme) =>
                            theme.palette.background.paper,
                        backdropFilter: "blur(20px)",
                        border: "none",
                        zIndex: (theme) => theme.zIndex.drawer - 2,
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                    },
                }}
            >
                <Paper
                    elevation={0}
                    sx={{
                        p: 0,
                        backgroundColor: "transparent",
                        boxShadow: "none",
                        border: "none",
                    }}
                >
                    {/* Header */}
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            ...headerSpacing,
                            background: (theme) =>
                                `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                            color: (theme) => theme.palette.common.white,
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        }}
                        ref={headerRef}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: headerSpacing.gap,
                            }}
                        >
                            <NotificationsIcon
                                sx={{
                                    color: (theme) =>
                                        theme.palette.common.white,
                                }}
                            />
                            <Typography
                                variant="subtitle1"
                                sx={{ fontWeight: 700 }}
                            >
                                {t("fields.notifications", "Notifications")}
                            </Typography>
                        </Box>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: headerSpacing.gap,
                            }}
                        >
                            {notifications.length > 0 && (
                                <Button
                                    startIcon={
                                        <DoneAllIcon
                                            sx={{
                                                color: "inherit",
                                            }}
                                        />
                                    }
                                    onClick={deleteAllNotifications}
                                    size="small"
                                    variant="text"
                                    sx={{
                                        fontSize: "0.75rem",
                                        textTransform: "none",
                                        color: (theme) =>
                                            `${theme.palette.common.white} !important`,
                                        "&.MuiButton-text": {
                                            color: (theme) =>
                                                `${theme.palette.common.white} !important`,
                                        },
                                        "& .MuiButton-startIcon": {
                                            color: "inherit",
                                        },
                                        "&:hover": {
                                            color: (theme) =>
                                                `${theme.palette.common.white} !important`,
                                            backgroundColor: (theme) =>
                                                alpha(
                                                    theme.palette.common.white,
                                                    0.12
                                                ),
                                        },
                                    }}
                                >
                                    {t("actions.clear_all", "Clear all")}
                                </Button>
                            )}
                            <IconButton
                                onClick={() => setIsOpen(false)}
                                sx={{
                                    color: (theme) =>
                                        theme.palette.common.white,
                                }}
                            >
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    </Box>

                    {/* Stats Summary */}
                    {stats?.byPriority && (
                        <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                            <Box sx={{ flex: 1, textAlign: "center" }}>
                                <Typography
                                    variant="h6"
                                    sx={{ fontWeight: 600 }}
                                >
                                    {stats.total ?? 0}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    {t("fields.total", "Total")}
                                </Typography>
                            </Box>
                            <Box sx={{ flex: 1, textAlign: "center" }}>
                                <Typography
                                    variant="h6"
                                    sx={{
                                        fontWeight: 600,
                                        color: "error.main",
                                    }}
                                >
                                    {stats.byPriority.urgent ?? 0}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    {t("values.priority_urgent", "Urgent")}
                                </Typography>
                            </Box>
                            <Box sx={{ flex: 1, textAlign: "center" }}>
                                <Typography
                                    variant="h6"
                                    sx={{
                                        fontWeight: 600,
                                        color: "warning.main",
                                    }}
                                >
                                    {stats.byPriority.high ?? 0}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    {t("values.priority_high", "High")}
                                </Typography>
                            </Box>
                            <Box sx={{ flex: 1, textAlign: "center" }}>
                                <Typography
                                    variant="h6"
                                    sx={{
                                        fontWeight: 600,
                                        color: "primary.main",
                                    }}
                                >
                                    {stats.byPriority.medium ?? 0}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    {t("values.priority_medium", "Medium")}
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {/* Filters */}
                    <Box
                        sx={{
                            p: 1.5,
                            borderBottom: 1,
                            borderColor: "divider",
                            bgcolor: "grey.50",
                            display: "flex",
                            alignItems: "center",
                        }}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                flexWrap: "nowrap",
                                overflow: "hidden",
                                width: "100%",
                            }}
                        >
                            {/* Type filter — Box wrapper avoids global MuiFormControl marginBottom */}
                            <Box
                                sx={{
                                    flex: "1 1 0",
                                    minWidth: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    alignSelf: "stretch",
                                    m: 0,
                                }}
                            >
                                {(() => {
                                    const typeOptions = [
                                        {
                                            value: "all",
                                            label: t(
                                                "fields.filters_all_types",
                                                "All types"
                                            ),
                                        },
                                        {
                                            value: "control-center",
                                            label: t(
                                                "fields.filters_control_center",
                                                "Control Center"
                                            ),
                                        },
                                        {
                                            value: "dispute",
                                            label: t(
                                                "fields.filters_disputes",
                                                "Disputes"
                                            ),
                                        },
                                        {
                                            value: "invoice",
                                            label: t(
                                                "fields.filters_invoices",
                                                "Invoices"
                                            ),
                                        },
                                        {
                                            value: "activity",
                                            label: t(
                                                "fields.filters_activities",
                                                "Activities"
                                            ),
                                        },
                                        {
                                            value: "assignment",
                                            label: t(
                                                "fields.filters_assignments",
                                                "Assignments"
                                            ),
                                        },
                                        {
                                            value: "overdue",
                                            label: t(
                                                "fields.filters_overdue",
                                                "Overdue"
                                            ),
                                        },
                                        {
                                            value: "payment",
                                            label: t(
                                                "fields.filters_payments",
                                                "Payments"
                                            ),
                                        },
                                        {
                                            value: "system",
                                            label: t(
                                                "fields.filters_system",
                                                "System"
                                            ),
                                        },
                                    ];
                                    const current =
                                        typeOptions.find(
                                            (o) => o.value === filter
                                        ) || typeOptions[0];
                                    return (
                                        <ToolbarDropdownFilter
                                            value={current}
                                            onChange={(val: any) =>
                                                setFilter(val?.value ?? "all")
                                            }
                                            options={typeOptions}
                                            getOptionLabel={(o: any) => o.label}
                                            placeholder={t(
                                                "fields.filters_all_types",
                                                "All types"
                                            )}
                                            isOptionEqualToValue={(
                                                o: any,
                                                v: any
                                            ) => o.value === v.value}
                                            sx={{
                                                width: "100%",
                                                minWidth: 0,
                                                maxWidth: "100%",
                                            }}
                                        />
                                    );
                                })()}
                            </Box>
                            {/* Priority filter */}
                            <Box
                                sx={{
                                    flex: "1 1 0",
                                    minWidth: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    alignSelf: "stretch",
                                    m: 0,
                                }}
                            >
                                {(() => {
                                    const priorityOptions = [
                                        {
                                            value: "all",
                                            label: t(
                                                "fields.filters_all_priorities",
                                                "All priorities"
                                            ),
                                        },
                                        {
                                            value: "urgent",
                                            label: t(
                                                "values.priority_urgent",
                                                "Urgent"
                                            ),
                                        },
                                        {
                                            value: "high",
                                            label: t(
                                                "values.priority_high",
                                                "High"
                                            ),
                                        },
                                        {
                                            value: "medium",
                                            label: t(
                                                "values.priority_medium",
                                                "Medium"
                                            ),
                                        },
                                        {
                                            value: "low",
                                            label: t(
                                                "values.priority_low",
                                                "Low"
                                            ),
                                        },
                                    ];
                                    const current =
                                        priorityOptions.find(
                                            (o) => o.value === priorityFilter
                                        ) || priorityOptions[0];
                                    return (
                                        <ToolbarDropdownFilter
                                            value={current}
                                            onChange={(val: any) =>
                                                setPriorityFilter(
                                                    val?.value ?? "all"
                                                )
                                            }
                                            options={priorityOptions}
                                            getOptionLabel={(o: any) => o.label}
                                            placeholder={t(
                                                "fields.filters_all_priorities",
                                                "All priorities"
                                            )}
                                            isOptionEqualToValue={(
                                                o: any,
                                                v: any
                                            ) => o.value === v.value}
                                            sx={{
                                                width: "100%",
                                                minWidth: 0,
                                                maxWidth: "100%",
                                            }}
                                        />
                                    );
                                })()}
                            </Box>
                        </Box>
                    </Box>

                    {/* Notifications List */}
                    <Box sx={{ maxHeight: 400, overflow: "auto" }}>
                        {loading ? (
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "center",
                                    p: 3,
                                }}
                            >
                                <CircularProgress color="primary" size={24} />
                            </Box>
                        ) : filteredNotifications.length === 0 ? (
                            <Box sx={{ p: 3, textAlign: "center" }}>
                                <Typography color="text.secondary">
                                    {t(
                                        "messages.no_notifications",
                                        "No notifications to show"
                                    )}
                                </Typography>
                            </Box>
                        ) : (
                            <List sx={{ p: 0 }}>
                                {filteredNotifications.map((notification) => {
                                    const isFollowUpReminder =
                                        notification.metadata?.followUpReminder ===
                                        true;
                                    const displayType = isFollowUpReminder
                                        ? "overdue"
                                        : notification.type;
                                    const IconComponent = isFollowUpReminder
                                        ? ScheduleIcon
                                        : typeIcons[notification.type] ||
                                          SettingsIcon; // Fallback to SettingsIcon
                                    return (
                                        <ListItem
                                            key={notification.id}
                                            onClick={() =>
                                                handleNotificationClick(
                                                    notification
                                                )
                                            }
                                            alignItems="flex-start"
                                            sx={{
                                                cursor: "pointer",
                                                "&:hover": {
                                                    bgcolor: "action.hover",
                                                },
                                                borderBottom: 1,
                                                borderColor: "divider",
                                            }}
                                        >
                                            <ListItemIcon
                                                sx={{
                                                    minWidth: "32px !important",
                                                    display: "flex",
                                                    alignSelf: "flex-start",
                                                    alignItems: "flex-start",
                                                    justifyContent: isRTL
                                                        ? "flex-end"
                                                        : "flex-start",
                                                    pl: isRTL ? 1 : 0,
                                                    pr: isRTL ? 0 : 1,
                                                    pt: 1,
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        width: 32,
                                                        height: 32,
                                                        borderRadius: "50%",
                                                        backgroundColor: (
                                                            theme
                                                        ) => {
                                                            switch (
                                                            displayType
                                                            ) {
                                                                case "dispute":
                                                                case "Primary":
                                                                    return theme
                                                                        .palette
                                                                        .warning
                                                                        .light;
                                                                case "invoice":
                                                                    return theme
                                                                        .palette
                                                                        .primary
                                                                        .light;
                                                                case "activity":
                                                                    return theme
                                                                        .palette
                                                                        .secondary
                                                                        .light;
                                                                case "assignment":
                                                                    return theme
                                                                        .palette
                                                                        .success
                                                                        .light;
                                                                case "overdue":
                                                                    return theme
                                                                        .palette
                                                                        .error
                                                                        .light;
                                                                case "payment":
                                                                    return theme
                                                                        .palette
                                                                        .info
                                                                        .light;
                                                                case "system":
                                                                case "Secondary":
                                                                    return theme
                                                                        .palette
                                                                        .grey[200];
                                                                default:
                                                                    return theme
                                                                        .palette
                                                                        .grey[200];
                                                            }
                                                        },
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent:
                                                            "center",
                                                        border: "1px solid",
                                                        borderColor: (
                                                            theme
                                                        ) => {
                                                            switch (
                                                            displayType
                                                            ) {
                                                                case "dispute":
                                                                case "Primary":
                                                                    return theme
                                                                        .palette
                                                                        .warning
                                                                        .main;
                                                                case "invoice":
                                                                    return theme
                                                                        .palette
                                                                        .primary
                                                                        .main;
                                                                case "activity":
                                                                    return theme
                                                                        .palette
                                                                        .secondary
                                                                        .main;
                                                                case "assignment":
                                                                    return theme
                                                                        .palette
                                                                        .success
                                                                        .main;
                                                                case "overdue":
                                                                    return theme
                                                                        .palette
                                                                        .error
                                                                        .main;
                                                                case "payment":
                                                                    return theme
                                                                        .palette
                                                                        .info
                                                                        .main;
                                                                case "system":
                                                                case "Secondary":
                                                                    return theme
                                                                        .palette
                                                                        .grey[600];
                                                                default:
                                                                    return theme
                                                                        .palette
                                                                        .grey[600];
                                                            }
                                                        },
                                                    }}
                                                >
                                                    <IconComponent
                                                        fontSize="small"
                                                        sx={{
                                                            color: (theme) => {
                                                                switch (
                                                                displayType
                                                                ) {
                                                                    case "dispute":
                                                                    case "Primary":
                                                                        return theme
                                                                            .palette
                                                                            .warning
                                                                            .main;
                                                                    case "invoice":
                                                                        return theme
                                                                            .palette
                                                                            .primary
                                                                            .main;
                                                                    case "activity":
                                                                        return theme
                                                                            .palette
                                                                            .secondary
                                                                            .main;
                                                                    case "assignment":
                                                                        return theme
                                                                            .palette
                                                                            .success
                                                                            .main;
                                                                    case "overdue":
                                                                        return theme
                                                                            .palette
                                                                            .error
                                                                            .main;
                                                                    case "payment":
                                                                        return theme
                                                                            .palette
                                                                            .info
                                                                            .main;
                                                                    case "system":
                                                                    case "Secondary":
                                                                        return theme
                                                                            .palette
                                                                            .grey[600];
                                                                    default:
                                                                        return theme
                                                                            .palette
                                                                            .grey[600];
                                                                }
                                                            },
                                                            fontSize: "18px",
                                                        }}
                                                    />
                                                </Box>
                                            </ListItemIcon>
                                            <Box sx={{ flex: 1, py: 1 }}>
                                                {/* Primary content */}
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent:
                                                            "space-between",
                                                        mb: 0.5,
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            fontWeight: 400,
                                                            color: "text.primary",
                                                            fontSize:
                                                                "0.875rem",
                                                        }}
                                                    >
                                                        {getLocalizedNotificationText(
                                                            notification,
                                                            "title",
                                                            t,
                                                            {
                                                                language:
                                                                    i18n.language,
                                                                currentUserId:
                                                                    session
                                                                        ?.user
                                                                        ?.id,
                                                            }
                                                        )}
                                                    </Box>
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            gap: 1,
                                                        }}
                                                    >
                                                        {/* Priority indicator dot with tooltip */}
                                                        <Tooltip
                                                            title={`${t("fields.status", { ns: "notifications", defaultValue: "Status" })}: ${priorityLabels[notification.priority] || notification.priority || t("values.priority_medium", { ns: "notifications", defaultValue: "Medium" })}`}
                                                            arrow
                                                            placement="bottom"
                                                        >
                                                            <Box
                                                                sx={{
                                                                    width: 8,
                                                                    height: 8,
                                                                    borderRadius:
                                                                        "50%",
                                                                    backgroundColor:
                                                                        (
                                                                            theme
                                                                        ) => {
                                                                            switch (
                                                                            notification.priority
                                                                            ) {
                                                                                case "urgent":
                                                                                case "high":
                                                                                    return theme
                                                                                        .palette
                                                                                        .error
                                                                                        .main;
                                                                                case "medium":
                                                                                    return theme
                                                                                        .palette
                                                                                        .warning
                                                                                        .main;
                                                                                case "low":
                                                                                    return theme
                                                                                        .palette
                                                                                        .success
                                                                                        .main;
                                                                                default:
                                                                                    return theme
                                                                                        .palette
                                                                                        .warning
                                                                                        .main;
                                                                            }
                                                                        },
                                                                    flexShrink: 0,
                                                                    cursor: "help",
                                                                }}
                                                            />
                                                        </Tooltip>
                                                        <IconButton
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                deleteNotification(
                                                                    notification.id
                                                                );
                                                            }}
                                                            sx={{
                                                                p: 0.5,
                                                                color: (
                                                                    theme
                                                                ) =>
                                                                    theme
                                                                        .palette
                                                                        .primary
                                                                        .main,
                                                                "&:hover": {
                                                                    backgroundColor:
                                                                        (
                                                                            theme
                                                                        ) =>
                                                                            alpha(
                                                                                theme
                                                                                    .palette
                                                                                    .primary
                                                                                    .main,
                                                                                0.08
                                                                            ),
                                                                },
                                                            }}
                                                        >
                                                            <DeleteIcon
                                                                fontSize="small"
                                                                sx={{
                                                                    color: (
                                                                    theme
                                                                ) =>
                                                                    theme
                                                                        .palette
                                                                        .primary
                                                                        .main,
                                                                }}
                                                            />
                                                        </IconButton>
                                                    </Box>
                                                </Box>

                                                {/* Secondary content */}
                                                <Box
                                                    sx={{
                                                        mb: 0.5,
                                                        color: "text.secondary",
                                                        fontSize: "0.875rem",
                                                    }}
                                                >
                                                    {getLocalizedNotificationText(
                                                        notification,
                                                        "message",
                                                        t,
                                                        {
                                                            language:
                                                                i18n.language,
                                                            currentUserId:
                                                                session?.user
                                                                    ?.id,
                                                        }
                                                    )}
                                                </Box>

                                                {/* Footer content */}
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent:
                                                            "space-between",
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            color: "text.secondary",
                                                            fontSize: "0.75rem",
                                                            p: 0.5,
                                                        }}
                                                    >
                                                        {moment(
                                                            notification.timestamp
                                                        ).fromNow()}
                                                    </Box>
                                                </Box>
                                            </Box>
                                        </ListItem>
                                    );
                                })}
                            </List>
                        )}
                    </Box>

                    {/* Footer */}
                    {filteredNotifications.length > 0 && (
                        <Box
                            sx={{
                                p: 1.5,
                                borderTop: 1,
                                borderColor: "divider",
                                bgcolor: "grey.50",
                            }}
                        >
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ textAlign: "center", display: "block" }}
                            >
                                {t(
                                    "messages.showing",
                                    "Showing {{filtered}} of {{total}}",
                                    {
                                        filtered: filteredNotifications.length,
                                        total: notifications.length,
                                    }
                                )}
                            </Typography>
                        </Box>
                    )}
                </Paper>
            </Popover>
        </Box>
    );
};

export default NotificationCenter;
