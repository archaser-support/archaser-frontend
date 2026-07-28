"use client";

import CloseIcon from "@mui/icons-material/Close";
import SnoozeIcon from "@mui/icons-material/Snooze";
import {
    Box,
    Button,
    IconButton,
    Link as MuiLink,
    Snackbar,
    Typography,
} from "@mui/material";
import Slide from "@mui/material/Slide";
import { alpha, useTheme } from "@mui/material/styles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/app/api";

import ModalScrollBox from "@/shared/layout-components/modal/ModalScrollBox";
import { resolveI18nPlaceholders } from "@/shared/utils/resolveI18nPlaceholders";

import type { FollowUpReminderItem } from "../hooks/useFollowUpReminders";
import { useFollowUpReminders } from "../hooks/useFollowUpReminders";

const REMINDER_SCROLL_ID = "follow-up-reminder-scroll";

const ACTIVITY_CONTENT_LABEL_VALUE_RE =
    /<span[^>]*class="[^"]*activity-label-primary[^"]*"[^>]*>\s*([^<]+):\s*<\/span>\s*<span[^>]*class="[^"]*activity-value[^"]*"[^>]*>\s*([^<]*)\s*<\/span>/gi;

/**
 * Resolve {{namespace.key}} placeholders in a string.
 */
function resolveContentKeys(
    raw: string,
    t: (key: string, opts?: { ns?: string }) => string
): string {
    return resolveI18nPlaceholders(raw, t as any);
}

/**
 * Extract only contact name and comment from activity content (HTML with label/value spans).
 */
function extractContactAndComment(
    rawContent: string,
    t: (key: string, opts?: { ns?: string }) => string
): { contactName: string | null; comment: string | null } {
    if (!rawContent || typeof rawContent !== "string")
        return { contactName: null, comment: null };
    const resolved = resolveContentKeys(rawContent, t);
    const contactLabel = t("fields.log_activity_contact", { ns: "activities" }).trim();
    const commentLabel = t("fields.log_activity_comment", { ns: "activities" }).trim();
    let contactName: string | null = null;
    let comment: string | null = null;
    let match: RegExpExecArray | null;
    const re = new RegExp(ACTIVITY_CONTENT_LABEL_VALUE_RE.source, "gi");
    while ((match = re.exec(resolved)) !== null) {
        const label = match[1].trim();
        const value = (match[2] || "").trim();
        if (!value) continue;
        if (label === contactLabel) contactName = value;
        else if (label === commentLabel) comment = value;
    }
    return { contactName, comment };
}

const SLIDE_TRANSITION = { enter: 350, exit: 280 };

function FollowUpReminderContent({
    currentReminder,
    open,
    onExited,
    onDismiss,
    onSnooze,
    onMarkComplete,
    onGoToCustomer,
    onMarkCompleteImmediate,
}: {
    currentReminder: FollowUpReminderItem;
    open: boolean;
    onExited?: () => void;
    onDismiss: (item: FollowUpReminderItem) => void;
    onSnooze: (item: FollowUpReminderItem) => void;
    onMarkComplete: (item: FollowUpReminderItem) => void;
    onGoToCustomer: (item: FollowUpReminderItem) => void;
    onMarkCompleteImmediate: (item: FollowUpReminderItem) => Promise<void>;
}) {
    const { t, i18n } = useTranslation("agents");
    const { data: session } = useSession();
    const theme = useTheme();
    const isRTL = i18n.language === "he";

    const followUpTime = new Date(currentReminder.followUpTime);
    const now = Date.now();
    const minutesAgo = Math.max(
        0,
        Math.floor((now - followUpTime.getTime()) / 60000)
    );
    const timeAgoStr =
        minutesAgo < 60
            ? t("messages.follow_up_reminder_min_ago", { count: minutesAgo })
            : minutesAgo < 1440
                ? t("messages.follow_up_reminder_hours_ago", {
                    count: Math.floor(minutesAgo / 60),
                })
                : t("messages.follow_up_reminder_days_ago", {
                    count: Math.floor(minutesAgo / 1440),
                });
    const customerName =
        currentReminder.customerName || t("fields.customer");
    const agentName = currentReminder.agentName || null;
    const agentId = currentReminder.agentId || null;
    const currentUserId = session?.user?.id || null;
    const showAgentName =
        agentName && agentId && currentUserId && agentId !== currentUserId;

    const params = useParams();
    const locale = (params?.locale as string) || "en";
    const handleClose = () => onDismiss(currentReminder);
    const handleSnooze = () => onSnooze(currentReminder);
    const handleMarkComplete = () => onMarkComplete(currentReminder);
    const handleOpenCustomer = async () => {
        // Ensure backend completion fanout runs before redirecting
        await onMarkCompleteImmediate(currentReminder);
        onGoToCustomer(currentReminder);
    };
    const handleOpenCustomerOnly = () => {
        // Link click should only navigate without completing
        onGoToCustomer(currentReminder);
    };

    const customerUrl = `/${locale}/app/customers/${currentReminder.customerId}?activeTab=outstanding-activities-tab`;

    useEffect(() => {
        if (typeof document === "undefined") return;
        const trackBg = alpha(theme.palette.primary.main, 0.1);
        const thumbBg = alpha(theme.palette.primary.main, 0.6);
        const thumbHover = theme.palette.primary.main;
        const id = "follow-up-reminder-scrollbar-override";
        let el = document.getElementById(id) as HTMLStyleElement | null;
        if (!el) {
            el = document.createElement("style");
            el.id = id;
            document.body.appendChild(el);
        }
        el.textContent = `
#${REMINDER_SCROLL_ID} { scrollbar-width: thin; scrollbar-color: ${thumbBg} ${trackBg}; }
#${REMINDER_SCROLL_ID}::-webkit-scrollbar { display: block !important; width: 12px !important; -webkit-appearance: none !important; }
#${REMINDER_SCROLL_ID}::-webkit-scrollbar-track { background-color: ${trackBg} !important; border-radius: 6px !important; }
#${REMINDER_SCROLL_ID}::-webkit-scrollbar-thumb { background-color: ${thumbBg} !important; border-radius: 6px !important; }
#${REMINDER_SCROLL_ID}::-webkit-scrollbar-thumb:hover { background-color: ${thumbHover} !important; }
`;
        return () => {
            const styleEl = document.getElementById(id);
            if (styleEl) styleEl.remove();
        };
    }, [theme.palette.primary.main]);

    return (
        <Snackbar
            open={open}
            anchorOrigin={{
                vertical: "bottom",
                horizontal: isRTL ? "left" : "right",
            }}
            TransitionComponent={Slide as any}
            TransitionProps={
                {
                    direction: "up",
                    timeout: SLIDE_TRANSITION,
                    onExited,
                } as any
            }
            autoHideDuration={null}
            role="alert"
            aria-live="polite"
            dir={isRTL ? "rtl" : "ltr"}
            sx={{
                "& .MuiSnackbar-content": {
                    direction: isRTL ? "rtl" : "ltr",
                    textAlign: isRTL ? "right" : "left",
                },
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    direction: isRTL ? "rtl" : "ltr",
                    textAlign: isRTL ? "right" : "left",
                    bgcolor: "background.paper",
                    color: "text.primary",
                    width: 400,
                    maxHeight: 330,
                    overflow: "hidden",
                    borderRadius: 1,
                    boxShadow: theme.shadows[6],
                }}
            >
                <Box
                    sx={{
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1,
                        direction: isRTL ? "rtl" : "ltr",
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                        px: 2,
                        py: 0.5,
                        borderTopLeftRadius: theme.shape.borderRadius,
                        borderTopRightRadius: theme.shape.borderRadius,
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                            direction: isRTL ? "rtl" : "ltr",
                        }}
                    >
                        <IconButton
                            size="small"
                            aria-label={t("fields.snooze_5_min")}
                            onClick={handleSnooze}
                            sx={{
                                "& .MuiButton-endIcon": {
                                    marginLeft: isRTL ? 0 : theme.spacing(0.5),
                                    marginRight: isRTL ? theme.spacing(0.5) : 0,
                                },
                                "& .MuiButton-startIcon": {
                                    marginRight: isRTL ? 0 : theme.spacing(0.5),
                                    marginLeft: isRTL ? theme.spacing(0.5) : 0,
                                },
                            }}
                        >
                            <SnoozeIcon fontSize="small" />
                        </IconButton>
                        <Typography
                            variant="subtitle2"
                            sx={{
                                direction: isRTL ? "rtl" : "ltr",
                                textAlign: isRTL ? "right" : "left",
                                fontWeight: theme.typography.fontWeightMedium,
                            }}
                        >
                            {showAgentName
                                ? t("messages.follow_up_reminder_for_agent", {
                                      defaultValue:
                                          "Follow-up reminder for {{agentName}}",
                                      agentName,
                                  })
                                : t("messages.follow_up_reminder_title")}
                        </Typography>
                    </Box>
                    <IconButton
                        size="small"
                        aria-label="Close"
                        onClick={handleClose}
                        sx={{
                            "& .MuiButton-endIcon": {
                                marginLeft: isRTL ? 0 : theme.spacing(0.5),
                                marginRight: isRTL ? theme.spacing(0.5) : 0,
                            },
                        }}
                    >
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Box>
                <ModalScrollBox
                    id={REMINDER_SCROLL_ID}
                    isRTL={isRTL}
                    sx={{ maxHeight: 160 }}
                >
                    <Box sx={{ px: 2, py: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
                        <Typography
                            component="span"
                            variant="body2"
                            sx={{
                                direction: isRTL ? "rtl" : "ltr",
                                textAlign: isRTL ? "right" : "left",
                            }}
                        >
                            {currentReminder.isOverdue ? (
                                <>
                                    {t("messages.follow_up_reminder_overdue_before")}
                                    <Box
                                        component="span"
                                        sx={{ fontWeight: theme.typography.fontWeightBold }}
                                    >
                                        {timeAgoStr}
                                    </Box>
                                    {t("messages.follow_up_reminder_overdue_after")}
                                </>
                            ) : (
                                t("messages.follow_up_reminder_in_10_min_prefix")
                            )}
                            <MuiLink
                                component={Link}
                                href={customerUrl}
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleOpenCustomerOnly();
                                }}
                                sx={{
                                    color: theme.palette.primary.main,
                                    fontWeight: theme.typography.fontWeightMedium,
                                    textDecoration: "none",
                                    "&:hover": {
                                        textDecoration: "underline",
                                    },
                                }}
                            >
                                {customerName}
                            </MuiLink>
                        </Typography>
                        {currentReminder.activityContent && (() => {
                            const { contactName, comment } = extractContactAndComment(
                                currentReminder.activityContent,
                                t
                            );
                            const hasAny =
                                contactName != null ||
                                (comment != null && comment.length > 0);
                            if (!hasAny) return null;
                            return (
                                <Box
                                    sx={{
                                        direction: isRTL ? "rtl" : "ltr",
                                        textAlign: isRTL ? "right" : "left",
                                        pt: 0.5,
                                    }}
                                >
                                        <Typography
                                            variant="caption"
                                            component="span"
                                            sx={{
                                                color: "text.secondary",
                                                lineHeight: 1.4,
                                                display: "block",
                                            }}
                                        >
                                        {contactName != null && (
                                            <Box component="span" sx={{ display: "block" }}>
                                                <Box
                                                    component="span"
                                                    sx={{ fontWeight: theme.typography.fontWeightBold }}
                                                >
                                                    {t("fields.log_activity_contact", {
                                                        ns: "activities",
                                                    })}
                                                    :
                                                </Box>{" "}
                                                {contactName}
                                            </Box>
                                        )}
                                        {comment != null && comment.length > 0 && (
                                            <Box
                                                component="span"
                                                sx={{
                                                    display: "block",
                                                    mt: contactName != null ? 0.25 : 0,
                                                    whiteSpace: "pre-wrap",
                                                }}
                                            >
                                                <Box
                                                    component="span"
                                                    sx={{ fontWeight: theme.typography.fontWeightBold }}
                                                >
                                                    {t("fields.log_activity_comment", {
                                                        ns: "activities",
                                                    })}
                                                    :
                                                </Box>{" "}
                                                {comment}
                                            </Box>
                                        )}
                                    </Typography>
                                </Box>
                            );
                        })()}
                    </Box>
                </ModalScrollBox>
                <Box
                    sx={{
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        direction: isRTL ? "rtl" : "ltr",
                        px: 2,
                        py: 1.5,
                        "& > * + *": {
                            marginLeft: isRTL ? 0 : theme.spacing(1),
                            marginRight: isRTL ? theme.spacing(1) : 0,
                        },
                    }}
                >
                    <Button
                        variant="contained"
                        size="small"
                        onClick={handleOpenCustomer}
                        sx={{
                            bgcolor: "success.main",
                            color: "white",
                            textTransform: "none",
                            fontWeight: 600,
                            boxShadow:
                                "0 2px 8px rgba(25, 118, 210, 0.2)",
                            "&:hover": {
                                bgcolor: "success.dark",
                                boxShadow:
                                    "0 4px 12px rgba(25, 118, 210, 0.3)",
                                transform: "translateY(-1px)",
                            },
                            "&:active": {
                                transform: "translateY(0)",
                            },
                            transition: "all 0.2s ease-in-out",
                        }}
                    >
                        {t("fields.mark_follow_up_complete")}
                    </Button>
                    <Button
                        variant="contained"
                        size="small"
                        onClick={handleSnooze}
                        sx={{
                            bgcolor: "primary.main",
                            color: "white",
                            textTransform: "none",
                            fontWeight: 600,
                            boxShadow:
                                "0 2px 8px rgba(25, 118, 210, 0.3)",
                            "&:hover": {
                                bgcolor: "primary.dark",
                                boxShadow:
                                    "0 4px 12px rgba(25, 118, 210, 0.4)",
                                transform: "translateY(-1px)",
                            },
                            "&:active": {
                                transform: "translateY(0)",
                            },
                            transition: "all 0.2s ease-in-out",
                        }}
                    >
                        {t("fields.snooze_5_min")}
                    </Button>
                </Box>
            </Box>
        </Snackbar>
    );
}

type ClosingAction = "dismiss" | "snooze" | "markComplete";

export default function FollowUpReminder() {
    const { data: session, status } = useSession();
    const effectiveRole = session?.user?.view_as_user_id
        ? session?.user?.view_as_user_role
        : session?.user?.role;
    const effectiveAccountId = session?.user?.view_as_user_id
        ? session?.user?.view_as_user_account_id
        : session?.user?.account_id;
    const { data: userPermissionsData } = useQuery<{ permissions: string[] }>({
        queryKey: [
            "user-permissions",
            session?.user?.id,
            effectiveRole,
            effectiveAccountId,
        ],
        queryFn: async () => {
            const response = await api.get("/api/permissions/me");
            return response.data;
        },
        enabled:
            !!session?.user &&
            status === "authenticated" &&
            effectiveRole != null &&
            effectiveAccountId != null,
        staleTime: 0,
    });
    const hasViewFollowUpRemindersPermission =
        userPermissionsData?.permissions?.includes(
            "view_follow_up_reminders"
        ) ?? false;

    const {
        currentReminder,
        dismiss,
        snooze,
        markComplete,
        goToCustomer,
    } = useFollowUpReminders({ enabled: hasViewFollowUpRemindersPermission });
    const queryClient = useQueryClient();
    const pathname = usePathname();
    const [closingReminder, setClosingReminder] =
        useState<FollowUpReminderItem | null>(null);
    const closingItemRef = useRef<FollowUpReminderItem | null>(null);
    const closingActionRef = useRef<ClosingAction | null>(null);

    const displayReminder = closingReminder ?? currentReminder;
    const snackbarOpen = !closingReminder && !!currentReminder;

    const handleDismiss = React.useCallback(
        (item: FollowUpReminderItem) => {
            closingItemRef.current = item;
            closingActionRef.current = "dismiss";
            setClosingReminder(item);
        },
        []
    );
    const handleSnooze = React.useCallback(
        (item: FollowUpReminderItem) => {
            closingItemRef.current = item;
            closingActionRef.current = "snooze";
            setClosingReminder(item);
        },
        []
    );
    const handleMarkComplete = React.useCallback(
        (item: FollowUpReminderItem) => {
            closingItemRef.current = item;
            closingActionRef.current = "markComplete";
            setClosingReminder(item);
        },
        []
    );
    const handleExited = React.useCallback(() => {
        const item = closingItemRef.current;
        const action = closingActionRef.current;
        closingItemRef.current = null;
        closingActionRef.current = null;
        setClosingReminder(null);
        if (item && action) {
            if (action === "dismiss") dismiss(item);
            else if (action === "snooze") snooze(item);
            else if (action === "markComplete") {
                markComplete(item);
                if (pathname?.includes("/agents")) {
                    void queryClient.invalidateQueries({
                        queryKey: ["agents-follow-up-virtual"],
                    });
                    void queryClient.invalidateQueries({
                        queryKey: ["agentsWithFollowUpCall"],
                    });
                }
            }
        }
    }, [dismiss, snooze, markComplete, pathname, queryClient]);

    if (!hasViewFollowUpRemindersPermission) return null;
    if (!displayReminder) return null;
    return (
        <FollowUpReminderContent
            currentReminder={displayReminder}
            open={snackbarOpen}
            onExited={handleExited}
            onDismiss={handleDismiss}
            onSnooze={handleSnooze}
            onMarkComplete={handleMarkComplete}
            onGoToCustomer={goToCustomer}
            onMarkCompleteImmediate={markComplete}
        />
    );
}
