/**
 * ActivityTimeline Component
 *
 * This component implements an infinite-scrolling timeline of activities with the following features:
 * 1. Scroll Containment:
 *    - Uses a nested container structure to properly contain scroll events
 *    - Parent container: box-body with flex layout and 100% height
 *    - Scroll container: timeline-container with overflow-y: auto
 *
 * 2. Scroll Event Handling:
 *    - Uses onWheel event instead of onScroll for better control
 *    - Prevents page scroll when timeline is scrollable
 *    - Allows page scroll when timeline reaches its boundaries
 *    - Implements infinite scroll with 80% threshold
 *
 * 3. Container Structure:
 *    CardContainer
 *    └── CardHeader
 *    └── box-body (flex container)
 *        └── timeline-container (scroll container)
 *            └── TimeLine component
 *
 * 4. Scroll Prevention Logic:
 *    - Prevents page scroll when:
 *      * Scrolling up and not at top
 *      * Scrolling down and not at bottom
 *    - Allows page scroll when:
 *      * At top and scrolling up
 *      * At bottom and scrolling down
 *
 * @component
 * @param {CustomerProp} props - Component props
 * @returns {JSX.Element} Rendered component
 */

"use client";
import { apiFetch } from "@/utils/apiFetch";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import ArticleIcon from "@mui/icons-material/Article";
import AttachFile from "@mui/icons-material/AttachFile";
import CallMadeIcon from "@mui/icons-material/CallMade";
import CallReceivedIcon from "@mui/icons-material/CallReceived";
import CommentIcon from "@mui/icons-material/Comment";
import EmailIcon from "@mui/icons-material/Email";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import GavelIcon from "@mui/icons-material/Gavel";
import InfoIcon from "@mui/icons-material/Info";
import PaymentIcon from "@mui/icons-material/Payment";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PhoneIcon from "@mui/icons-material/Phone";
import PublicIcon from "@mui/icons-material/Public";
import ScheduleIcon from "@mui/icons-material/Schedule";
import SmsIcon from "@mui/icons-material/Sms";
import {
    Box,
    Chip,
    Collapse,
    Divider,
    Fade,
    IconButton,
    Paper,
    Stack,
    Tooltip,
    Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import moment from "moment";
import { Session } from "next-auth";
import { useSession } from "next-auth/react";
import React, {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useTranslation } from "react-i18next";

// framer-motion removed; using MUI Collapse and CSS transitions instead
import { ToolbarDropdownFilter } from "@/shared/components/ToolbarDropdownFilter";
import ActivityAttachmentViewer from "@/shared/layout-components/activity/ActivityAttachmentViewer";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { fetchCustomerTimeLineData } from "@/shared/services/customerService";
import {
    resolveI18nPlaceholders,
    translateStoredI18nKey,
} from "@/shared/utils/resolveI18nPlaceholders";
import { Customer } from "@/types/Customer";
import { ActivityStatus } from "@/types/enums";
// Local Components and Types
import { GRID_CONSTANTS } from "@/shared/layout-components/grid/constants";
import { calculateLoadMoreTrigger } from "@/shared/layout-components/grid/utils/scrollUtils";
import { TimelineResponse } from "@/types/timeline";
import {
    formatDateForDisplay,
    getUserDateLocale,
    getUserTimezone,
    toUserTimezone,
} from "@/utils/datetimeOperations";
import { sanitizeActivityTitle } from "@/utils/htmlSanitizer";
// Define ActivityContact interface locally instead of importing from Prisma
interface ActivityContact {
    id: number;
    activity_id: number;
    contact_id: number;
    created_at: Date;
    modified_at: Date;
    status?: string;
    communication_channel?: string; // Added for specific channel tracking
    channel_selection_reason?: string; // Added for fallback tracking
    // Add other properties as needed
}

// Types
type IFilterType =
    | "All"
    | "Email"
    | "SMS"
    | "Call"
    | "Internal"
    | "Dispute"
    | "Promise_to_pay";

interface CustomerProp {
    customer: Customer | null;
    refreshTrigger?: number;
    onSendEmailClick?: () => void;
    hasSendEmailPermission?: boolean;
    onLogActivityClick?: () => void;
    hasCreateLogActivityPermission?: boolean;
    showLogActivity?: boolean;
}


interface TimelineItem {
    id?: string;
    schedule_time: Date;
    actual_delivery_time: Date;
    type?: string;
    title?: string;
    details: TimelineDetail[];
    showScheduleIcon?: boolean;
    activity_type?: string;
    created_at?: string;
    status?: string; // Activity status (SCHEDULED, SENT, CANCELLED, etc.)
    contact?: {
        name?: string;
        phone?: string;
    };
    ActivityContacts?: Array<
        ActivityContact & {
            Contact: {
                name: string | null;
                email: string | null;
                mobile: string | null;
                status: string;
            };
        }
    >;
    isPortal?: boolean;
}

interface TimelineDetail {
    id: string;
    title?: string;
    title_params?: Record<string, unknown> | string | null;
    description: string;
    time?: Date;
    badgeType?: string;
    badgeText?: string;
    subject?: string;
    showScheduleIcon?: boolean;
    schedule_calculation?: string; // Add schedule calculation field
    status?: string; // Activity status (SCHEDULED, SENT, CANCELLED, etc.)
    ActivityContacts?: Array<
        ActivityContact & {
            Contact: {
                name: string | null;
                email: string | null;
                mobile: string | null;
                status: string;
            };
        }
    >;
    isPortal?: boolean;
    systemGenerated?: boolean;
    createdBy?: {
        id: string;
        name: string;
        firstName?: string;
        lastName?: string;
    };
    attachments?: Array<{
        id: string;
        file_name: string;
        file_path: string;
        file_size: number;
        file_type: string;
        file_category: "Text" | "Image" | "Audio";
        uploaded_by: string;
        created_at: string;
    }>;
}

interface TimelineDateProps {
    schedule_time: Date;
    showDate?: boolean;
    session: Session | null;
}

interface TimelineTimeProps {
    time: Date;
    badgeText?: string;
    session: Session | null;
}

interface TimelineDescriptionProps {
    details: TimelineDetail[];
    t: (_key: string, _params?: Record<string, unknown>) => string;
    triggerRefresh: () => void;
    expandedDetails: Set<string>;
    onToggleDetail: (detailId: string) => void;
}

interface CollapsibleDetailProps {
    detail: TimelineDetail;
    t: (_key: string, _params?: Record<string, unknown>) => string;
    triggerRefresh: () => void;
    isExpanded: boolean;
    onToggle: (detailId: string) => void;
}

// Constants
const filterTypes: IFilterType[] = [
    "All",
    "Email",
    "SMS",
    "Call",
    "Internal",
    "Dispute",
    "Promise_to_pay",
];
const showHtmlContentForBadges: string[] = [
    "Email",
    "Dispute",
    "Promise_to_pay",
];

// Function to format activity title with contact and call information.
// Nest returns raw {{activities.fields.*}} keys; resolve them client-side.
const parseTitleParams = (
    raw?: Record<string, unknown> | string | null
): Record<string, unknown> | undefined => {
    if (!raw) return undefined;
    if (typeof raw === "string") {
        try {
            return JSON.parse(raw) as Record<string, unknown>;
        } catch {
            return undefined;
        }
    }
    return raw;
};

const formatActivityTitle = (
    detail: TimelineDetail,
    t: (_key: string, _params?: Record<string, unknown>) => string
): string => {
    if (!detail.title) {
        return "";
    }
    return translateStoredI18nKey(
        String(detail.title),
        t,
        parseTitleParams(detail.title_params)
    );
};

// Function to detect if an activity is failed
const isActivityFailed = (detail: TimelineDetail): boolean => {
    // Check if any activity contact has failed status
    if (detail.ActivityContacts && detail.ActivityContacts.length > 0) {
        return detail.ActivityContacts.some(
            (contact) =>
                contact.status === "Failed" || contact.status === "Bounced"
        );
    }

    // Check if the title indicates a failed activity
    if (detail.title) {
        const title = detail.title.toLowerCase();
        return (
            title.includes("failed") || title.includes("automated_step_failed")
        );
    }

    return false;
};

// Function to determine if schedule icon should be shown
// Only show for activities that are still scheduled (not sent, canceled, delivered, etc.)
// Uses activity status, not ActivityContact status
const shouldShowScheduleIcon = (detail: TimelineDetail): boolean => {
    // Must have schedule_calculation to show icon
    if (!detail.schedule_calculation) {
        return false;
    }

    // Check activity status (not ActivityContact status)
    const activityStatus = detail.status || "";
    const activityStatusUpper = activityStatus.toUpperCase();

    // Check if activity is still scheduled
    const isScheduled =
        activityStatus === ActivityStatus.SCHEDULED ||
        activityStatusUpper === "SCHEDULED" ||
        activityStatus === "Scheduled";

    // Check if activity is in a non-scheduled state
    const isNonScheduled =
        activityStatusUpper === "CANCELLED" ||
        activityStatus === "Cancelled" ||
        activityStatus === ActivityStatus.CANCELLED ||
        activityStatusUpper === "SENT" ||
        activityStatus === "Sent" ||
        activityStatus === ActivityStatus.SENT ||
        activityStatusUpper === "DELIVERED" ||
        activityStatus === "Delivered" ||
        activityStatus === ActivityStatus.DELIVERED ||
        activityStatusUpper === "FAILED" ||
        activityStatus === "Failed" ||
        activityStatus === ActivityStatus.FAILED ||
        activityStatusUpper === "BOUNCED" ||
        activityStatus === "Bounced" ||
        activityStatus === ActivityStatus.BOUNCED ||
        activityStatusUpper === "COMPLETED" ||
        activityStatus === "Completed" ||
        activityStatus === ActivityStatus.COMPLETED;

    // Only show icon if activity is scheduled and not in a non-scheduled state
    return isScheduled && !isNonScheduled;
};

const getBadgeIcon = (type?: string) => {
    if (!type) return null;

    const iconMap: Record<string, React.ReactElement> = {
        SMS: <SmsIcon fontSize="small" />,
        Email: <EmailIcon fontSize="small" />,
        Call: <PhoneIcon fontSize="small" />,
        "Outgoing Call": <CallMadeIcon fontSize="small" />,
        "Incoming Call": <CallReceivedIcon fontSize="small" />,
        Internal: <ArticleIcon fontSize="small" />,
        Dispute: <GavelIcon fontSize="small" />,
        Promise_to_pay: <PaymentIcon fontSize="small" />,
        "Schedule follow-up call": <ScheduleIcon fontSize="small" />,
        "Add new contact": <PersonAddIcon fontSize="small" />,
        General: <CommentIcon fontSize="small" />,
        "Move to legal": <AccountBalanceIcon fontSize="small" />,
    };

    return iconMap[type] || null;
};

// Components
const TimelineDate = memo(
    ({
        schedule_time,
        showDate = true,
        session,
    }: TimelineDateProps): React.ReactElement => {
        const theme = useTheme();

        // Get the language code from session.user.language (UI language), not from locale
        const userLanguage = session?.user?.language;
        const languageCode = userLanguage === "Hebrew" ? "he" : "en";

        if (
            !schedule_time ||
            !(schedule_time instanceof Date) ||
            isNaN(schedule_time.getTime())
        ) {
            return <Box sx={{ width: "3rem", flexShrink: 0 }} />;
        }

        const userTime = toUserTimezone(schedule_time, session);
        const now = moment();

        const isWithinLast7Days = now.diff(userTime, "days") <= 7;

        if (!showDate) {
            return <Box sx={{ width: "3rem", flexShrink: 0 }} />;
        }

        if (isWithinLast7Days) {
            const weekDay = userTime.locale(languageCode).format("ddd");
            const date = userTime.format("D");

            return (
                <Box sx={{ width: "3rem", flexShrink: 0, textAlign: "center" }}>
                    <Typography
                        variant="h6"
                        sx={{
                            color: "primary.main",
                            fontSize: "1.25rem",
                            fontWeight: 600,
                            lineHeight: 1,
                        }}
                    >
                        {date}
                    </Typography>
                    <Typography
                        variant="caption"
                        sx={{
                            color: alpha(theme.palette.primary.main, 0.7),
                            fontSize: "0.75rem",
                            lineHeight: 1,
                        }}
                    >
                        {weekDay}
                    </Typography>
                </Box>
            );
        }

        const day = userTime.format("D");
        const month = userTime.locale(languageCode).format("MMM");
        const year = userTime.format("YYYY");

        return (
            <Box sx={{ width: "3rem", flexShrink: 0, textAlign: "center" }}>
                <Typography
                    variant="h6"
                    sx={{
                        color: "primary.main",
                        fontSize: "1.25rem",
                        fontWeight: 600,
                        lineHeight: 1,
                    }}
                >
                    {day}
                </Typography>
                <Typography
                    variant="caption"
                    sx={{
                        color: alpha(theme.palette.primary.main, 0.7),
                        fontSize: "0.75rem",
                        lineHeight: 1,
                        display: "block",
                    }}
                >
                    {month}
                </Typography>
                <Typography
                    variant="caption"
                    sx={{
                        color: alpha(theme.palette.primary.main, 0.7),
                        fontSize: "0.75rem",
                        lineHeight: 1,
                    }}
                >
                    {year}
                </Typography>
            </Box>
        );
    }
);

TimelineDate.displayName = "TimelineDate";

const TimelineTime = memo(({ time, badgeText, session }: TimelineTimeProps) => {
    const theme = useTheme();
    const formattedTime = formatDateForDisplay(
        time,
        "time",
        getUserDateLocale(session),
        getUserTimezone(session)
    );

    const icon = badgeText ? getBadgeIcon(badgeText) : null;

    return (
        <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{
                color: "text.secondary",
                fontSize: "0.75rem",
                lineHeight: 1,
            }}
        >
            <Typography variant="caption">{formattedTime}</Typography>
            {icon && (
                <Box
                    sx={{
                        p: 1,
                        borderRadius: "50%",
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                    }}
                >
                    {React.cloneElement(icon, {
                        sx: {
                            color: "primary.main",
                            fontSize: "1.25rem",
                        },
                    })}
                </Box>
            )}
        </Stack>
    );
});

TimelineTime.displayName = "TimelineTime";

const ReceipientList: React.FC<{
    activityContacts: Array<
        ActivityContact & {
            Contact: {
                name: string | null;
                email: string | null;
                mobile: string | null;
                status: string;
            };
        }
    >;
    activityType?: string; // Add activity type to determine what to show
    withoutPaper?: boolean; // If true, render without outer Paper wrapper
}> = ({ activityContacts, activityType, withoutPaper = false }) => {
    const theme = useTheme();
    const { t, i18n } = useTranslation(["activities", "customers", "common"]);

    if (!activityContacts || !activityContacts.length) return null;

    const getStatusColor = (status: string) => {
        switch (status) {
            case ActivityStatus.DELIVERED:
                return theme.palette.chartPalette.main; // Successful delivery
            case ActivityStatus.SENT:
                return theme.palette.chartPalette.main; // Sent but not delivered
            case ActivityStatus.SCHEDULED:
                return theme.palette.chartPalette.light; // Scheduled for future
            case ActivityStatus.FAILED:
                return theme.palette.chartPalette.dark; // Failed delivery
            case ActivityStatus.BOUNCED:
                return theme.palette.chartPalette.dark; // Bounced email
            case ActivityStatus.CANCELLED:
                return theme.palette.text.secondary; // Muted - cancelled activity
            case ActivityStatus.PAUSED:
                return theme.palette.chartPalette.main; // Paused activity
            case ActivityStatus.DISPUTE:
                return theme.palette.chartPalette.dark; // Dispute activity
            case ActivityStatus.COMPLETED:
                return theme.palette.chartPalette.main; // Completed activity
            default:
                return theme.palette.text.secondary; // Default secondary text
        }
    };

    const getStatusLabel = (status: string) => {
        // Handle both enum values and string values from backend
        switch (status) {
            case ActivityStatus.DELIVERED:
            case "Delivered":
                return t("values.status_delivered", { ns: "activities" });
            case ActivityStatus.SENT:
            case "Sent":
                return t("values.status_sent", { ns: "activities" });
            case ActivityStatus.SCHEDULED:
            case "Scheduled":
                return t("values.status_scheduled", { ns: "activities" });
            case ActivityStatus.FAILED:
            case "Failed":
                return t("values.status_failed", { ns: "activities" });
            case ActivityStatus.BOUNCED:
            case "Bounced":
                return t("values.status_bounced", { ns: "activities" });
            case ActivityStatus.CANCELLED:
            case "Cancelled":
                return t("actions.status_cancelled", { ns: "activities" });
            case ActivityStatus.PAUSED:
            case "Paused":
                return t("values.status_paused", { ns: "activities" });
            case ActivityStatus.DISPUTE:
            case "Dispute":
                return t("values.status_dispute", { ns: "activities" });
            case ActivityStatus.COMPLETED:
            case "Completed":
                return t("values.status_completed", { ns: "activities" });
            default:
                // If status is already translated or unknown, return as-is
                return (
                    status || t("values.status_unknown", { ns: "activities" })
                );
        }
    };

    // Helper function to get relevant contact info based on activity type
    const getContactInfo = (
        contact: any,
        communicationChannel?: string,
        channelSelectionReason?: string
    ) => {
        const contactName = contact?.name || "Unknown Contact";

        // Determine which contact method to show based on activity type or communication channel
        const isEmailActivity =
            activityType === "Email" || communicationChannel === "Email";
        const isSMSActivity =
            activityType === "SMS" || communicationChannel === "SMS";

        let contactInfo = "";
        let fallbackMessage = "";

        if (isEmailActivity && contact?.email) {
            contactInfo = `${contactName} (${contact.email})`;
        } else if (isSMSActivity && contact?.mobile) {
            contactInfo = `${contactName} (${contact.mobile})`;
        } else if (contact?.email) {
            // Fallback to email if available
            contactInfo = `${contactName} (${contact.email})`;
        } else if (contact?.mobile) {
            // Fallback to mobile if available
            contactInfo = `${contactName} (${contact.mobile})`;
        } else {
            contactInfo = contactName;
        }

        // Add fallback message if channel selection reason indicates a fallback
        if (channelSelectionReason) {
            // The channel selection reason is already translated by the backend
            fallbackMessage = ` - ${channelSelectionReason}`;
        }

        const result = contactInfo + fallbackMessage;
        return result;
    };

    const content = (
        <>
            <Typography
                variant="subtitle2"
                sx={{
                    mb: 1, // Reduced margin
                    color: "text.secondary",
                }}
            >
                {t("fields.recipients", { ns: "activities" })} (
                {activityContacts.length})
            </Typography>
            <Stack spacing={0.25}>
                {" "}
                {/* Reduced spacing */}
                {activityContacts.map((activityContact) => {
                    const statusColor = getStatusColor(
                        activityContact.status || "Unknown"
                    );
                    const statusLabel = getStatusLabel(
                        activityContact.status || "Unknown"
                    );
                    const contactInfo = getContactInfo(
                        activityContact.Contact,
                        activityContact.communication_channel,
                        activityContact.channel_selection_reason
                    );

                    return (
                        <Box
                            key={activityContact.id}
                            sx={{
                                py: 0.5, // Reduced vertical padding
                                px: 1, // Keep horizontal padding for readability
                            }}
                        >
                            <Stack
                                direction="row"
                                alignItems="center"
                                spacing={0}
                                sx={{
                                    direction: i18n.language === "he" ? "rtl" : "ltr",
                                }}
                            >
                                {/* Bullet - appears on left for LTR, right for RTL */}
                                <Tooltip
                                    title={`Delivery Status: ${statusLabel}`}
                                    TransitionComponent={Fade}
                                    placement="bottom"
                                >
                                    <Box
                                        sx={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: "50%",
                                            bgcolor: statusColor,
                                            flexShrink: 0,
                                            // RTL-aware spacing: margin on right for LTR, left for RTL
                                            mr: i18n.language === "he" ? 0 : 1,
                                            ml: i18n.language === "he" ? 1 : 0,
                                        }}
                                    />
                                </Tooltip>

                                {/* Name and Chip */}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Stack
                                        direction="row"
                                        alignItems="center"
                                        spacing={1}
                                    >
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                fontWeight: 500,
                                                color: "text.primary",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {contactInfo}
                                        </Typography>
                                        <Chip
                                            label={statusLabel}
                                            size="small"
                                            sx={{
                                                bgcolor: alpha(
                                                    statusColor,
                                                    0.1
                                                ),
                                                color: statusColor,
                                                fontSize: "0.75rem",
                                                height: "20px",
                                            }}
                                        />
                                    </Stack>
                                </Box>
                            </Stack>
                        </Box>
                    );
                })}
            </Stack>
        </>
    );

    if (withoutPaper) {
        return (
            <Box
                sx={{
                    mb: 2,
                    direction: i18n.language === "he" ? "rtl" : "ltr",
                }}
            >
                {content}
            </Box>
        );
    }

    return (
        <Paper
            elevation={0}
            sx={{
                p: 2, // Reduced padding
                mt: 1,
                border: 1,
                borderColor: "divider",
                borderRadius: theme.appButton.borderRadius,
                boxShadow: "none",
            }}
        >
            {content}
        </Paper>
    );
};

const CollapsibleDetail = memo(
    ({
        detail,
        t,
        triggerRefresh,
        isExpanded,
        onToggle,
    }: CollapsibleDetailProps) => {
        const theme = useTheme();
        const { data: session } = useSession();
        const { i18n } = useTranslation(["customers", "common"]);
        const { error: showError, success: showSuccess } = useToast();

        const handleToggle = useCallback(() => {
            onToggle(detail.id);
        }, [onToggle, detail.id]);

        const icon = detail.badgeText ? getBadgeIcon(detail.badgeText) : null;

        const formattedTime = useMemo(() => {
            if (!detail.time) return "";

            try {
                // Handle Date objects - the service now provides proper Date objects
                const time =
                    detail.time instanceof Date
                        ? detail.time
                        : new Date(detail.time);
                if (isNaN(time.getTime())) {
                    return "";
                }

                return formatDateForDisplay(
                    time,
                    "datetime",
                    getUserDateLocale(session),
                    getUserTimezone(session)
                );
            } catch {
                return "";
            }
        }, [detail.time, session]);

        const translatedContent = useMemo(() => {
            if (!detail.description) return "";
            return resolveI18nPlaceholders(
                detail.description,
                t,
                parseTitleParams(detail.title_params)
            );
        }, [detail.description, detail.title_params, t]);

        const hasContent = translatedContent && translatedContent.trim();
        // Use explicit px — numeric sx borderRadius is multiplied by theme.shape.borderRadius (4),
        // so `12` becomes 48px on Box; collapsed Paper was height-clamped and looked smaller.
        const cardRadiusPx = `${theme.appButton.borderRadius}px`;
        const timelinePillRadiusPx = `${theme.appButton.sizeMedium.borderRadius}px`;
        const showAsGroup = Boolean(isExpanded && hasContent);

        return (
            <Box sx={{ mb: 1.5 }}>
                <Box
                    sx={{
                        ...(showAsGroup && {
                            border: 1,
                            borderColor: "divider",
                            borderRadius: `${cardRadiusPx} !important`,
                            overflow: "hidden",
                            bgcolor: "background.paper",
                            "& .MuiPaper-root": {
                                borderRadius: "0 !important",
                            },
                        }),
                    }}
                >
                    <Paper
                    elevation={0}
                    square={showAsGroup}
                    component={hasContent ? "button" : "div"}
                    onClick={hasContent ? handleToggle : undefined}
                    sx={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between", // Use consistent justification
                        textAlign: i18n.language === "he" ? "right" : "left",
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                        // Override parent RTL inheritance
                        "& *": {
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        },
                        py: 0.5,
                        px: i18n.language === "he" ? 0 : 3, // Keep minimal padding for Hebrew, normal for English
                        // Add right margin for Hebrew title
                        ...(i18n.language === "he" && {
                            "& .MuiTypography-root": {
                                marginRight: "12px", // Add margin between title and right border for Hebrew
                            },
                        }),
                        border: showAsGroup ? 0 : 1,
                        borderColor: "divider",
                        borderRadius: showAsGroup
                            ? 0
                            : `${timelinePillRadiusPx} !important`,
                        bgcolor: "background.paper",
                        minHeight: 32,
                        transition: "background-color 0.2s",
                        boxShadow: "none",
                        position: "relative",
                        zIndex: 0,
                        cursor: hasContent ? "pointer" : "default",
                        "&:hover": hasContent
                            ? {
                                  bgcolor: alpha(
                                      theme.palette.primary.main,
                                      0.1
                                  ),
                              }
                            : {},
                    }}
                >
                    <Stack
                        direction="row"
                        alignItems="center"
                        spacing={2}
                        sx={{
                            width: "100%",
                            minWidth: 0,
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        }}
                    >
                        {/* Title */}
                        <Typography
                            variant={
                                i18n.language === "he"
                                    ? "hebrewBodyText"
                                    : "body1"
                            }
                            sx={{
                                fontWeight: 500,
                                color: "text.primary",
                                "&:hover": { color: alpha(theme.palette.primary.main, 0.8) },
                                transition: "color 0.2s",
                                flex: 1,
                                minWidth: 0,
                                // Override theme for English only
                                ...(i18n.language !== "he" && {
                                    textAlign: "left",
                                    direction: "ltr",
                                }),

                            }}
                        >
                            {formatActivityTitle(detail, t).includes("<b>") ? (
                                <span
                                    dangerouslySetInnerHTML={{
                                        __html: sanitizeActivityTitle(
                                            formatActivityTitle(detail, t)
                                        )
                                    }}
                                />
                            ) : (
                                formatActivityTitle(detail, t)
                            )}
                        </Typography>

                        {/* Icons - order will be reversed for Hebrew due to RTL direction */}
                        <Stack
                            direction="row"
                            alignItems="center"
                            spacing={0}
                            sx={{
                                flexShrink: 0,
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            {/* Time display - first for Hebrew, second for English */}
                            {formattedTime && (
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: "text.secondary",
                                        // Use conditional margins for proper RTL spacing
                                        mr: i18n.language === "he" ? 1 : 0, // Right margin for Hebrew
                                        ml: i18n.language === "he" ? 0 : 1, // Left margin for English
                                    }}
                                >
                                    {formattedTime}
                                </Typography>
                            )}

                            {/* Activity type icon - second for Hebrew, first for English */}
                            {icon && (
                                <Tooltip
                                    title={(() => {
                                        const badgeText = detail.badgeText;
                                        if (!badgeText) return "";

                                        // Map badgeText values to translation keys
                                        const translationMap: Record<
                                            string,
                                            string
                                        > = {
                                            Dispute: "fields.dispute",
                                            Promise_to_pay:
                                                "fields.promise_to_pay",
                                            Email: "values.filter_types_email",
                                            SMS: "values.filter_types_sms",
                                            Call: "values.filter_types_call",
                                            Internal:
                                                "values.filter_types_internal",
                                            "Outgoing Call":
                                                "fields.log_activity_outgoing_call",
                                            "Incoming Call":
                                                "fields.log_activity_incoming_call",
                                            "Schedule follow-up call":
                                                "values.outcomes_schedule_follow_up",
                                            "Add new contact":
                                                "values.outcomes_add_new_contact",
                                            General: "values.outcomes_general",
                                            "Move to legal":
                                                "values.outcomes_move_to_legal",
                                        };

                                        const translationKey =
                                            translationMap[badgeText];
                                        if (translationKey) {
                                            return t(translationKey, {
                                                ns: "activities",
                                            });
                                        }

                                        // Fallback to original badgeText if no translation found
                                        return badgeText;
                                    })()}
                                    TransitionComponent={Fade}
                                    placement="bottom"
                                    arrow
                                >
                                    <Box
                                        sx={{
                                            color: isActivityFailed(detail)
                                                ? "error.main"
                                                : (detail.status === 'CANCELLED' || detail.status === 'Cancelled')
                                                    ? "text.disabled"
                                                    : "primary.main",
                                            cursor: "help",
                                            // Use conditional margins for proper RTL spacing
                                            mr: i18n.language === "he" ? 1 : 0, // Right margin for Hebrew
                                            ml: i18n.language === "he" ? 0 : 1, // Left margin for English
                                        }}
                                    >
                                        {React.cloneElement(icon, {
                                            sx: {
                                                fontSize: "1.25rem",
                                                color: "primary.main",
                                            },
                                        })}
                                    </Box>
                                </Tooltip>
                            )}

                            {/* Attachments icon */}
                            {detail.attachments &&
                                detail.attachments.length > 0 && (
                                    <Tooltip
                                        title={
                                            detail.attachments.length > 1
                                                ? `${detail.attachments.length} ${t("fields.attachments", { ns: "common" })}`
                                                : `1 ${t("fields.attachment", { ns: "common" })}`
                                        }
                                        TransitionComponent={Fade}
                                        placement="bottom"
                                        arrow
                                    >
                                        <Box
                                            sx={{
                                                color: "primary.main",
                                                cursor: "help",
                                            }}
                                        >
                                            <AttachFile
                                                sx={{ fontSize: "1.25rem" }}
                                            />
                                        </Box>
                                    </Tooltip>
                                )}



                            {/* Portal icon */}
                            {detail.isPortal && (
                                <Tooltip
                                    title={t("fields.created_from_portal", {
                                        ns: "activities",
                                    })}
                                    TransitionComponent={Fade}
                                    placement="bottom"
                                    arrow
                                >
                                    <Box
                                        sx={{
                                            color: "primary.main",
                                            cursor: "help",
                                        }}
                                    >
                                        <PublicIcon
                                            sx={{ fontSize: "1.25rem" }}
                                        />
                                    </Box>
                                </Tooltip>
                            )}

                            {/* Dropdown icon - only show if there's content to expand, otherwise show placeholder for consistent spacing */}
                            {translatedContent && translatedContent.trim() ? (
                                <Box
                                    sx={{
                                        transform: `rotate(${isExpanded ? 180 : 0}deg)`,
                                        transition: "transform 0.2s",
                                        marginRight:
                                            i18n.language === "he"
                                                ? "8px"
                                                : "0px",
                                        marginLeft:
                                            i18n.language === "he"
                                                ? "0px"
                                                : "8px",
                                    }}
                                >
                                    <ExpandMoreIcon
                                        sx={{ color: "primary.main" }}
                                    />
                                </Box>
                            ) : (
                                <div
                                    style={{
                                        // Use conditional margins for proper RTL spacing - same as icon
                                        marginRight:
                                            i18n.language === "he"
                                                ? "8px"
                                                : "0px",
                                        marginLeft:
                                            i18n.language === "he"
                                                ? "0px"
                                                : "8px",
                                        width: "24px", // Same width as the icon
                                        height: "24px", // Same height as the icon
                                    }}
                                />
                            )}
                        </Stack>
                    </Stack>
                    </Paper>
                    <Collapse in={isExpanded} timeout={200} unmountOnExit>
                        <Paper
                            elevation={0}
                            square={showAsGroup}
                            sx={{
                                py: 3,
                                // RTL-aware padding (see frontend-rtl): padding on both sides so content/buttons don't overlap border. English (LTR): pl + pr. Hebrew (RTL): pr + pl (same values).
                                pl: theme.spacing(3),
                                pr: theme.spacing(3),
                                border: "none",
                                borderRadius: 0,
                                boxShadow: "none",
                                direction: i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            <Box sx={{ maxWidth: "100%" }}>
                                {/* Only show recipients for communication activities (Email, SMS) - merged into same container */}
                                {(detail.badgeText === "Email" ||
                                    detail.badgeText === "SMS") && (
                                        <>
                                            <ReceipientList
                                                activityContacts={detail.ActivityContacts || []}
                                                activityType={detail.badgeText}
                                                withoutPaper={true}
                                            />
                                            <Divider
                                                sx={{
                                                    my: 2,
                                                    // Extend divider to full width by negating Paper padding
                                                    // For Hebrew: negative margin-right to extend to right border
                                                    // For English: negative margin-left to extend to left border
                                                    mr: i18n.language === "he" ? -3 : 0,
                                                    ml: i18n.language === "he" ? 0 : -3,
                                                }}
                                            />
                                        </>
                                    )}

                                {/* Email/Activity content */}
                                {showHtmlContentForBadges?.includes(
                                    detail?.badgeText || ""
                                ) ? (
                                    <Box
                                        sx={{
                                            "& .prose": {
                                                maxWidth: "none",
                                            },
                                            direction: i18n.language === "he" ? "rtl" : "ltr",
                                            textAlign: i18n.language === "he" ? "right" : "left",
                                        }}
                                        className="activity-timeline-content"
                                    >
                                        <Typography
                                            component="div"
                                            sx={{
                                                direction: i18n.language === "he" ? "rtl" : "ltr",
                                                textAlign: i18n.language === "he" ? "right" : "left",
                                            }}
                                            dangerouslySetInnerHTML={{
                                                __html: sanitizeActivityTitle(
                                                    translatedContent
                                                ),
                                            }}
                                        />
                                    </Box>
                                ) : detail?.badgeText === "Internal" ? (
                                    <Box
                                        className="activity-timeline-content"
                                        sx={{
                                            direction: i18n.language === "he" ? "rtl" : "ltr",
                                            textAlign: i18n.language === "he" ? "right" : "left",
                                        }}
                                    >
                                        <Typography
                                            component="span"
                                            sx={{
                                                fontSize: "0.875rem",
                                                color: "text.secondary",
                                                wordBreak: "break-word",
                                                direction: i18n.language === "he" ? "rtl" : "ltr",
                                                textAlign: i18n.language === "he" ? "right" : "left",
                                            }}
                                            dangerouslySetInnerHTML={{
                                                __html: sanitizeActivityTitle(
                                                    translatedContent
                                                ),
                                            }}
                                        />
                                    </Box>
                                ) : (
                                    <Box
                                        className="activity-timeline-content"
                                        sx={{
                                            direction: i18n.language === "he" ? "rtl" : "ltr",
                                            textAlign: i18n.language === "he" ? "right" : "left",
                                        }}
                                    >
                                        <Typography
                                            component="div"
                                            sx={{
                                                direction: i18n.language === "he" ? "rtl" : "ltr",
                                                textAlign: i18n.language === "he" ? "right" : "left",
                                            }}
                                            dangerouslySetInnerHTML={{
                                                __html: sanitizeActivityTitle(
                                                    translatedContent
                                                ),
                                            }}
                                        />
                                    </Box>
                                )}

                                {/* File Attachments */}
                                <ActivityAttachmentViewer
                                        key={`attachments-${detail.id}-${detail.attachments?.length || 0}`}
                                        attachments={detail.attachments || []}
                                        canDelete={!detail.systemGenerated}
                                        canAdd={!detail.systemGenerated}
                                        activityId={detail.id}
                                        onDeleteAttachment={async (
                                            attachmentId
                                        ) => {
                                        try {
                                            const response = await apiFetch(`/api/activity-attachments/${attachmentId}`,
                                                {
                                                    method: "DELETE",
                                                }
                                            );
                                            if (!response.ok) {
                                                const errorData =
                                                    await response.json();
                                                const errorMessage =
                                                    errorData.error ||
                                                    "Failed to delete attachment";
                                                const errorDetails =
                                                    errorData.details || "";

                                                let fullErrorMessage =
                                                    errorMessage;
                                                if (errorDetails) {
                                                    fullErrorMessage += `\n\nDetails: ${errorDetails}`;
                                                }

                                                showError(fullErrorMessage);
                                                return;
                                            }

                                            const result =
                                                await response.json();
                                            showSuccess(
                                                result.message ||
                                                "Attachment deleted successfully"
                                            );
                                            // Trigger refresh by updating the query key
                                            triggerRefresh();
                                        } catch (error) {
                                            showError(
                                                error instanceof Error
                                                    ? error.message
                                                    : "Failed to delete attachment"
                                            );
                                        }
                                    }}
                                    onAttachmentAdded={async () => {
                                        // Trigger refresh by updating the query key
                                        triggerRefresh();
                                    }}
                                />
                            </Box>
                        </Paper>
                    </Collapse>
                </Box>
            </Box>
        );
    }
);

CollapsibleDetail.displayName = "CollapsibleDetail";

const TimelineDescription = memo(
    ({
        details,
        t,
        triggerRefresh,
        expandedDetails,
        onToggleDetail,
    }: TimelineDescriptionProps) => {
        return (
            <Stack spacing={1.5} sx={{ width: "100%" }}>
                {details.map((detail) => {
                    const uniqueKey = `detail-${detail.id}-${detail.attachments?.length || 0}`;
                    return (
                        <CollapsibleDetail
                            key={uniqueKey}
                            detail={detail}
                            t={t}
                            triggerRefresh={triggerRefresh}
                            isExpanded={expandedDetails.has(detail.id)}
                            onToggle={onToggleDetail}
                        />
                    );
                })}
            </Stack>
        );
    }
);

TimelineDescription.displayName = "TimelineDescription";

// Helper function to get effective time for sorting (actual_delivery_time || schedule_time || created_at)
// This ensures proper chronological order even when activities are fast-forwarded for testing
const getEffectiveTime = (item: TimelineItem): Date => {
    if (item.actual_delivery_time && !isNaN(item.actual_delivery_time.getTime())) {
        return item.actual_delivery_time;
    }
    if (item.schedule_time && !isNaN(item.schedule_time.getTime())) {
        return item.schedule_time;
    }
    if (item.created_at) {
        const createdDate =
            typeof item.created_at === "string"
                ? new Date(item.created_at)
                : item.created_at;
        if (!isNaN(createdDate.getTime())) {
            return createdDate;
        }
    }
    // Fallback to schedule_time even if invalid (shouldn't happen)
    return item.schedule_time || new Date();
};

const Timeline = memo(
    ({
        data,
        session,
        t,
        i18n,
        triggerRefresh,
        expandedDetails,
        onToggleDetail,
    }: {
        data: TimelineItem[];
        session: Session | null;
        t: (_key: string, _params?: Record<string, unknown>) => string;
        i18n: any;
        triggerRefresh: () => void;
        expandedDetails: Set<string>;
        onToggleDetail: (detailId: string) => void;
    }): React.ReactElement => {
        const theme = useTheme();
        const sorted = useMemo(() => {
            if (!Array.isArray(data)) {
                return [];
            }
            return [...data].sort(
                (a, b) => getEffectiveTime(b).getTime() - getEffectiveTime(a).getTime()
            );
        }, [data]);

        const groupedByDate = useMemo(() => {
            if (!Array.isArray(sorted)) {
                return {};
            }
            const groups: { [date: string]: TimelineItem[] } = {};
            sorted.forEach((item) => {
                if (!item) {
                    return;
                }
                // Use effective time for grouping (actual_delivery_time || schedule_time || created_at)
                const effectiveTime = getEffectiveTime(item);
                const dateKey = moment(effectiveTime).format("YYYY-MM-DD");
                if (!groups[dateKey]) groups[dateKey] = [];
                groups[dateKey].push(item);
            });

            return groups;
        }, [sorted]);

        const dateKeys = Object.keys(groupedByDate).sort(
            (a, b) => moment(b).valueOf() - moment(a).valueOf()
        );

        if (!Array.isArray(data) || data.length === 0) {
            return (
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        p: 4,
                        width: "100%",
                        minHeight: 300,
                        bgcolor: "action.hover",
                        borderRadius: theme.appButton.borderRadius,
                    }}
                >
                    <Typography
                        variant={
                            i18n.language === "he" ? "hebrewBodyText" : "body1"
                        }
                        sx={{
                            color: "text.secondary",
                            // Override theme for English only
                            ...(i18n.language !== "he" && {
                                textAlign: "left",
                                direction: "ltr",
                            }),
                        }}
                    >
                        {t("fields.no_activities_description", {
                            ns: "activities",
                        })}
                    </Typography>
                </Box>
            );
        }

        return (
            <Box
                component="ul"
                sx={{
                    listStyle: "none",
                    m: 0, // Remove margin to align with header
                    p: 0,
                    pb: 0, // Explicitly remove bottom padding
                }}
            >
                {dateKeys.map((dateKey) => {
                    const group = groupedByDate[dateKey];
                    if (!Array.isArray(group) || group.length === 0) {
                        return null;
                    }

                    return (
                        <Box
                            key={dateKey}
                            component="li"
                            sx={{
                                display: "flex",
                                alignItems: "stretch",
                                gap: 1, // Reduced gap to better align with header
                                mb: 2,
                            }}
                        >
                            <Box
                                sx={{
                                    width: "3rem",
                                    flexShrink: 0,
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                }}
                            >
                                <TimelineDate
                                    schedule_time={
                                        group[0]?.schedule_time instanceof Date
                                            ? group[0].schedule_time
                                            : new Date(group[0]?.schedule_time)
                                    }
                                    session={session}
                                    showDate={true}
                                />
                                {group.length > 1 && (
                                    <Box
                                        sx={{
                                            flex: 1,
                                            width: "2px",
                                            bgcolor: alpha(
                                                theme.palette.primary.main,
                                                0.1
                                            ),
                                            margin: "0 auto",
                                        }}
                                    />
                                )}
                            </Box>
                            <Box
                                sx={{
                                    flex: 1,
                                    minWidth: 0,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 3,
                                }}
                            >
                                {group.map((item, idx) => {
                                    if (!item || !item.schedule_time) {
                                        return null;
                                    }
                                    const userScheduleTime = toUserTimezone(
                                        item.schedule_time,
                                        session
                                    );
                                    const now = moment();

                                    return (
                                        <TimelineDescription
                                            key={`timeline-card-${item.id}-${idx}`}
                                            details={
                                                Array.isArray(item.details)
                                                    ? item.details
                                                    : []
                                            }
                                            t={t}
                                            triggerRefresh={triggerRefresh}
                                            expandedDetails={expandedDetails}
                                            onToggleDetail={onToggleDetail}
                                        />
                                    );
                                })}
                            </Box>
                        </Box>
                    );
                })}
            </Box>
        );
    }
);

Timeline.displayName = "Timeline";

const ActivityTimeline: React.FC<CustomerProp> = ({
    customer,
    refreshTrigger,
    onSendEmailClick,
    hasSendEmailPermission = false,
    onLogActivityClick,
    hasCreateLogActivityPermission = false,
    showLogActivity = false,
}): React.ReactElement => {
    const { t: translationT, i18n } = useTranslation([
        "activities",
        "customers",
        "common",
    ]);
    const { data: session } = useSession();
    const theme = useTheme();
    const queryClient = useQueryClient();

    // Combined translation function that tries both namespaces
    const t = useCallback(
        (key: string, params?: Record<string, unknown>): string => {
            // First try translation namespace
            const translationResult = translationT(key, params as any) as string;
            if (translationResult !== key) {
                return translationResult;
            }

            // If not found, return the key
            return key;
        },
        [translationT]
    );

    const [filterType, setFilterType] = useState<IFilterType>("All");
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [lastId, setLastId] = useState<number | null>(null);
    const [accumulatedData, setAccumulatedData] = useState<TimelineItem[]>([]);
    const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
    const [expandedDetails, setExpandedDetails] = useState<Set<string>>(
        new Set()
    );

    const timelineContainerRef = useRef<HTMLDivElement>(null);
    const scrollTimeoutRef = useRef<NodeJS.Timeout>();
    const isMountedRef = useRef<boolean>(true);
    const lastLoadMoreCallRef = useRef<number>(0);
    const prevCustomerIdRef = useRef<number | undefined>(undefined);
    const prevFilterTypeRef = useRef<IFilterType | undefined>(undefined);
    const isInitialMountRef = useRef<boolean>(true);

    // Check if customer is in Automated category for smart polling
    const isAutomatedCategory = React.useMemo(() => {
        if (!customer?.id) return false;
        const collectionPeriod = customer?.CustomerCollectionPeriod?.find(
            (cp) => cp.period_end_date === null
        );
        return collectionPeriod?.current_category === "Automated";
    }, [customer?.id, customer?.CustomerCollectionPeriod]);

    // Function to trigger a refresh
    const triggerRefresh = useCallback(() => {
        // Reset state
        setAccumulatedData([]);
        setIsInitialLoadComplete(false);
        setLastId(null);
        setHasMore(true);

        // Invalidate queries to trigger refetch (only once)
        queryClient.invalidateQueries({
            queryKey: ["customerTimeLineData"],
            exact: false,
        });
    }, [queryClient]);

    // Function to toggle detail expansion
    const handleToggleDetail = useCallback((detailId: string) => {
        setExpandedDetails((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(detailId)) {
                newSet.delete(detailId);
            } else {
                newSet.add(detailId);
            }
            return newSet;
        });
    }, []);

    const queryKey = useMemo(() => {
        const key = [
            "customerTimeLineData",
            customer?.id || 0,
            (session?.user as any)?.timezone || "",
            filterType === "All" ? undefined : filterType,
            (session?.user as any)?.locale || "en",
            lastId, // Add lastId back to query key for pagination
        ];
        return key;
    }, [
        customer?.id,
        (session?.user as any)?.timezone,
        (session?.user as any)?.locale,
        filterType,
        lastId,
    ]);

    const { data, isLoading } = useQuery<TimelineResponse, Error>({
        queryKey,
        queryFn: async () => {
            return await fetchCustomerTimeLineData({
                customer_id: customer?.id || 0,
                lastId,
                filterType,
            });
        },
        enabled: !!customer?.id,
        retry: 3,
        refetchOnWindowFocus: true,
        staleTime: isAutomatedCategory ? 5 * 1000 : 5 * 60 * 1000, // 5s for automated so status updates (SENT/DELIVERED) show quickly, 5 min for others
        gcTime: 10 * 60 * 1000, // Cache for 10 minutes
        refetchOnMount: true,
        refetchOnReconnect: true,
        refetchInterval: (query) => {
            // Smart polling: only poll if we have data and customer is in automated category
            if (!query.state.data || !customer?.id || !isAutomatedCategory) {
                return false;
            }
            // Poll every 10s for automated so SCHEDULED -> SENT/DELIVERED updates appear soon after cron sends
            return 10 * 1000;
        },
        refetchIntervalInBackground: true,
        placeholderData: undefined,
    });

    // Memoized data processing function
    const processTimelineItem = useCallback((item: any): TimelineItem | null => {
        const scheduleTime =
            item.schedule_time instanceof Date
                ? item.schedule_time
                : new Date(item.schedule_time || Date.now());
        if (isNaN(scheduleTime.getTime())) {
            return null;
        }

        const actualDeliveryTime =
            item.actual_delivery_time instanceof Date
                ? item.actual_delivery_time
                : new Date(item.actual_delivery_time || scheduleTime);
        if (isNaN(actualDeliveryTime.getTime())) {
            return null;
        }

        return {
            id: item.id,
            schedule_time: scheduleTime,
            actual_delivery_time: actualDeliveryTime,
            type: item.type,
            title: item.title,
            status: item.status || null,
            details: (item.details || []).map((detail: TimelineDetail) => ({
                id: detail.id,
                title: detail.title,
                title_params: (detail as TimelineDetail).title_params ?? (item as any).title_params,
                description: detail.description,
                time: scheduleTime,
                badgeType: detail.badgeType,
                badgeText: detail.badgeText,
                subject: detail.subject,
                schedule_calculation: detail.schedule_calculation,
                status: item.status || detail.status || null,
                showScheduleIcon: shouldShowScheduleIcon({
                    ...detail,
                    status: item.status || detail.status || null,
                }),
                isPortal: detail.isPortal || false,
                systemGenerated: detail.systemGenerated || false,
                ActivityContacts: detail.ActivityContacts,
                attachments: detail.attachments,
            })),
            showScheduleIcon:
                item.details?.some(
                    (d: TimelineDetail) => !!d.schedule_calculation
                ) || false,
            activity_type: item.activity_type,
            created_at: item.created_at,
            contact: item.contact,
            isPortal: item.isPortal || false,
            ActivityContacts: item.ActivityContacts,
        };
    }, []);

    // Consolidated: Handle customer/filter changes and refresh trigger
    useEffect(() => {
        if (!customer?.id) {
            return;
        }

        // Skip reset on initial mount - only reset on actual changes
        if (isInitialMountRef.current) {
            isInitialMountRef.current = false;
            prevCustomerIdRef.current = customer.id;
            prevFilterTypeRef.current = filterType;

            // Handle refresh trigger on initial mount if needed
            if (refreshTrigger && refreshTrigger > 0) {
                queryClient.invalidateQueries({
                    queryKey: ["customerTimeLineData"],
                    exact: false,
                });
            }
            return;
        }

        // Only reset if customer ID or filter actually changed (not on initial mount)
        const customerChanged = prevCustomerIdRef.current !== customer.id;
        const filterChanged = prevFilterTypeRef.current !== filterType;

        // Update refs
        prevCustomerIdRef.current = customer.id;
        prevFilterTypeRef.current = filterType;

        // Only reset state if there was an actual change
        if (customerChanged || filterChanged) {
            setLastId(null);
            setHasMore(true);
            setIsLoadingMore(false);
            setAccumulatedData([]);
            setIsInitialLoadComplete(false);
        }

        // Handle refresh trigger
        if (refreshTrigger && refreshTrigger > 0) {
            queryClient.invalidateQueries({
                queryKey: ["customerTimeLineData"],
                exact: false,
            });
        }
    }, [customer?.id, filterType, refreshTrigger, queryClient]);

    // Process data and update accumulated data - optimized to prevent circular dependencies
    useEffect(() => {
        if (
            !data?.timeline ||
            !Array.isArray(data.timeline) ||
            !isMountedRef.current
        ) {
            return;
        }

        setAccumulatedData((prev) => {
            const newItems = data.timeline
                .map(processTimelineItem)
                .filter((item): item is TimelineItem => item !== null);

            if (!lastId) {
                // Initial load or refresh
                if (prev.length === 0) {
                    return newItems.sort(
                        (a, b) =>
                            getEffectiveTime(b).getTime() -
                            getEffectiveTime(a).getTime()
                    );
                }

                // If no new items on refresh, return previous data unchanged
                if (newItems.length === 0) {
                    return prev;
                }

                // Merge logic for refresh - preserve accordion state when prev has data
                const existingItemsMap = new Map(
                    prev.map((item) => [item.id, item])
                );

                const updatedItems = newItems.map((newItem) => {
                    const existingItem = existingItemsMap.get(newItem.id);
                    if (existingItem) {
                        return {
                            ...existingItem,
                            ...newItem,
                            details: newItem.details.map((newDetail) => {
                                const existingDetail =
                                    existingItem.details.find(
                                        (d) => d.id === newDetail.id
                                    );
                                if (existingDetail) {
                                    return {
                                        ...existingDetail,
                                        ...newDetail,
                                        attachments:
                                            newDetail.attachments || [],
                                    };
                                }
                                return newDetail;
                            }),
                        };
                    }
                    return newItem;
                });

                const newItemIds = new Set(newItems.map((item) => item.id));
                const itemsToAdd = prev.filter(
                    (item) => !newItemIds.has(item.id)
                );

                return [...updatedItems, ...itemsToAdd].sort(
                    (a, b) =>
                        getEffectiveTime(b).getTime() -
                        getEffectiveTime(a).getTime()
                );
            } else {
                // Pagination logic
                const newData = [...prev, ...newItems];
                return Array.from(
                    new Map(newData.map((item) => [item.id, item])).values()
                ).sort(
                    (a, b) =>
                        getEffectiveTime(b).getTime() -
                        getEffectiveTime(a).getTime()
                );
            }
        });

        if (!lastId) {
            setIsInitialLoadComplete(true);
        }
    }, [data?.timeline, lastId, processTimelineItem]);

    useEffect(() => {
        if (data?.totalRecords !== undefined) {
            // Only show load more if:
            // 1. We have total records count
            // 2. We have accumulated some data
            // 3. There are more records than what we've loaded
            // 4. The current data batch is not empty (indicating there might be more)
            const hasMoreRecords =
                data.totalRecords > 0 &&
                accumulatedData.length > 0 &&
                accumulatedData.length < data.totalRecords &&
                data.timeline &&
                data.timeline.length > 0;

            setHasMore(hasMoreRecords);
            setIsLoadingMore(false);
        }
    }, [
        data?.totalRecords,
        data?.timeline?.length,
        accumulatedData.length,
        lastId,
    ]);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        const container = timelineContainerRef.current;
        if (!container) return;

        const observer = new ResizeObserver(() => {
            if (container.scrollTop === 0) {
                container.scrollTop = 0;
            }
        });

        observer.observe(container);
        return () => {
            observer.disconnect();
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, []);

    // Enhanced scroll wheel functionality
    useEffect(() => {
        const container = timelineContainerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            const target = e.target as HTMLElement;
            const isOverTimeline = container.contains(target) || container === target;

            if (!isOverTimeline) {
                return; // Allow page scroll when not over timeline
            }

            const { scrollTop, scrollHeight, clientHeight } = container;
            const isScrollable = scrollHeight > clientHeight;

            // Prevent page scroll when mouse is over the timeline component
            e.preventDefault();
            e.stopPropagation();

            if (isScrollable) {
                const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
                const newScrollTop = Math.max(0, Math.min(maxScrollTop, scrollTop + e.deltaY));
                container.scrollTop = newScrollTop;
            }
        };

        // Add wheel event listener with passive: false to allow preventDefault
        // Use capture phase to catch events before they bubble
        container.addEventListener("wheel", handleWheel, { passive: false, capture: true });

        return () => {
            container.removeEventListener("wheel", handleWheel, { capture: true });
        };
    }, [accumulatedData.length]); // Re-run when data is loaded (container should be available)

    // Set container height to enable scrolling and fill to bottom of viewport
    useEffect(() => {
        const container = timelineContainerRef.current;
        if (!container) return;

        const setContainerHeight = () => {
            // Use viewport-based calculation to fill to bottom of page
            const vh = window.innerHeight;
            const containerRect = container.getBoundingClientRect();
            const containerTop = containerRect.top;

            // Calculate how much space is available from container top to viewport bottom
            // The containerTop already accounts for the header above it (since header is a sibling)
            // So we can directly use the space from container top to viewport bottom
            const finalHeight = vh - containerTop;

            // Set height using inline styles to override any sx styles
            // This ensures the container stretches to the bottom of the viewport
            // Only set height and maxHeight, don't set minHeight to avoid empty space
            container.style.height = `${finalHeight}px`;
            container.style.maxHeight = `${finalHeight}px`;
        };

        // Calculate height using requestAnimationFrame to ensure layout is complete
        const rafId = requestAnimationFrame(() => {
            setTimeout(setContainerHeight, 100);
        });

        // Also calculate on window resize
        window.addEventListener('resize', setContainerHeight);

        // Use ResizeObserver for container position changes
        const resizeObserver = new ResizeObserver(() => {
            setContainerHeight();
        });

        if (container.parentElement) {
            resizeObserver.observe(container.parentElement);
        }

        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('resize', setContainerHeight);
            resizeObserver.disconnect();
        };
    }, [accumulatedData.length, isLoading]);

    // Endless scroll load more function
    const handleLoadMore = useCallback(async () => {
        if (!isInitialLoadComplete) {
            return;
        }

        if (isLoading) {
            return;
        }

        if (isLoadingMore) {
            return;
        }

        if (!hasMore) {
            return;
        }

        // Debounce load more calls to prevent rapid successive calls
        const now = Date.now();
        const timeSinceLastCall = now - lastLoadMoreCallRef.current;

        if (timeSinceLastCall <= GRID_CONSTANTS.LOAD_MORE_DEBOUNCE) {
            return;
        }

        lastLoadMoreCallRef.current = now;
        setIsLoadingMore(true);

        const lastItem = accumulatedData[accumulatedData.length - 1];

        if (lastItem && lastItem.id) {
            const newLastId = parseInt(lastItem.id, 10);

            // Set the new lastId first (using activity ID, not timestamp)
            setLastId(newLastId);

            // Invalidate the query to force refetch with new lastId
            try {
                await queryClient.invalidateQueries({
                    queryKey: ["customerTimeLineData"],
                });
            } catch {
                // Error handling for query invalidation
            } finally {
                setIsLoadingMore(false);
            }
        } else {
            setIsLoadingMore(false);
        }
    }, [
        isInitialLoadComplete,
        isLoading,
        isLoadingMore,
        hasMore,
        accumulatedData,
        queryClient,
    ]);

    // Endless scroll handler (matching EndlessScrollDataGrid pattern)
    const handleScroll = useCallback(
        (e: React.UIEvent<HTMLDivElement>) => {
            // Prevent scroll propagation to parent elements
            e.stopPropagation();

            if (!isInitialLoadComplete) {
                return;
            }

            const target = e.target as HTMLDivElement;
            const scrollTop = target.scrollTop;
            const { scrollHeight, clientHeight } = target;

            // Clear existing timeout
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }

            // Set timeout for debounced load more check
            scrollTimeoutRef.current = setTimeout(() => {
                // Use the same calculation as EndlessScrollDataGrid
                const loadedContentHeight = scrollHeight;
                const shouldLoadMore = calculateLoadMoreTrigger(
                    loadedContentHeight,
                    scrollTop,
                    clientHeight,
                    GRID_CONSTANTS.LOAD_MORE_THRESHOLD
                );

                if (
                    shouldLoadMore &&
                    !isLoading &&
                    !isLoadingMore &&
                    hasMore &&
                    isInitialLoadComplete
                ) {
                    handleLoadMore();
                }
            }, GRID_CONSTANTS.SCROLL_DEBOUNCE_DELAY);
        },
        [
            isLoading,
            isLoadingMore,
            hasMore,
            isInitialLoadComplete,
            handleLoadMore,
        ]
    );

    // Memoized filter options to prevent unnecessary re-renders
    const filterOptions = useMemo(() => {
        interface FilterOption {
            label: string;
            value: IFilterType;
        }

        const filterOptionsList: FilterOption[] = filterTypes.map((type) => ({
            label: t(`values.filter_types_${type.toLowerCase()}`, {
                ns: "activities",
            }),
            value: type,
        }));

        const currentValue =
            filterOptionsList.find((option) => option.value === filterType) ||
            filterOptionsList[0];

        return (
            <ToolbarDropdownFilter<FilterOption>
                value={currentValue}
                onChange={(newValue: FilterOption | null) => {
                    if (newValue) {
                        setFilterType(newValue.value);
                    }
                }}
                options={filterOptionsList}
                getOptionLabel={(option: FilterOption) => option.label}
                isOptionEqualToValue={(
                    option: FilterOption,
                    value: FilterOption
                ) => option.value === value.value}
                placeholder={t("values.filter_types_all", { ns: "activities" })}
            />
        );
    }, [filterType, t]);

    if (isLoading && !lastId) {
        return (
            <Box
                sx={{
                    p: { xs: 1, sm: 0 },
                    pb: { xs: 2, sm: 3 },
                    height: "100vh", // Full viewport height
                    maxHeight: "100vh", // Full viewport height
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                }}
            >
                {/* Simplified Loading Container */}
                <Box
                    sx={{
                        bgcolor: "background.paper",
                        borderRadius: theme.spacing(1),
                        border: "none",
                        mb: { xs: 1, sm: 2 },
                        flex: 1,
                        minHeight: 0,
                        height: "calc(100vh - 50px)", // Full height minus padding
                        maxHeight: "calc(100vh - 50px)", // Full height minus padding
                        boxShadow: "none",
                        overflow: "visible",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    {/* Header */}
                    <Box
                        sx={{
                            ...(i18n.language === "he"
                                ? { pl: { xs: 1, sm: 1.5 }, pr: { xs: 1, sm: 1.5 } }
                                : { pl: { xs: 1, sm: 1.5 }, pr: { xs: 1, sm: 1.5 } }),
                            py: 0,
                            borderBottom: 1,
                            borderColor: "divider",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexShrink: 0,
                            height: "40px",
                            maxHeight: "40px",
                            overflow: "visible",
                            position: "relative",
                            zIndex: 2,
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        }}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                direction: i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            <InfoIcon
                                sx={{
                                    color: "primary.main",
                                    fontSize: { xs: 18, sm: 20 },
                                }}
                            />
                            <Typography
                                variant="h6"
                                sx={{
                                    fontWeight: 500,
                                    fontSize: { xs: "1rem", sm: "1.25rem" },
                                }}
                            >
                                {t("fields.timeline", { ns: "activities" })}
                            </Typography>
                        </Box>
                        <Box
                            className="endless-scroll-toolbar"
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                flexShrink: 0,
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            {/* Send Email Button - Only show if user has send_email permission */}
                            {hasSendEmailPermission && onSendEmailClick && (
                                <Tooltip
                                    title={t("actions.send_email", { ns: "activities" })}
                                    arrow
                                    enterDelay={300}
                                    leaveDelay={100}
                                    placement="bottom"
                                    PopperProps={{
                                        sx: {
                                            "& .MuiTooltip-tooltip": {
                                                direction: i18n.language === "he" ? "rtl" : "ltr",
                                            },
                                        },
                                    }}
                                >
                                    <IconButton
                                        color="primary"
                                        size="small"
                                        onClick={onSendEmailClick}
                                        className="toolbar-button"
                                    >
                                        <EmailIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            )}
                            {/* Phone/Log Activity Button - Only show if user has create_log_activity permission */}
                            {hasCreateLogActivityPermission && onLogActivityClick && (
                                <Tooltip
                                    title={showLogActivity ? `${t("actions.close", { ns: "common" })} ${t("fields.log_activity_log_activity", { ns: "activities" })}` : t("fields.log_activity_log_activity", { ns: "activities" })}
                                    arrow
                                    enterDelay={300}
                                    leaveDelay={100}
                                    placement="bottom"
                                    PopperProps={{
                                        sx: {
                                            "& .MuiTooltip-tooltip": {
                                                direction: i18n.language === "he" ? "rtl" : "ltr",
                                            },
                                        },
                                    }}
                                >
                                    <IconButton
                                        color="primary"
                                        size="small"
                                        onClick={onLogActivityClick}
                                        className="toolbar-button"
                                        sx={{
                                            "& .MuiSvgIcon-root": {
                                                transition: "transform 0.3s ease-in-out",
                                                transform: showLogActivity ? "rotate(45deg)" : "rotate(0deg)",
                                            },
                                        }}
                                    >
                                        <PhoneIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            )}
                            <Box sx={{ flexShrink: 0 }}>{filterOptions}</Box>
                        </Box>
                    </Box>

                    {/* Loading Content */}
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flex: 1,
                            p: { xs: 1.5, sm: 3 },
                        }}
                    >
                    </Box>
                </Box>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                pt: "12px",
                px: 0, // Remove horizontal padding to align with tabs
                pb: 0, // No bottom padding
                marginTop: "12px", // Reduced margin above timeline
                display: "flex",
                flexDirection: "column",
                overflow: "hidden", // Keep hidden to prevent page scroll
                flex: 1, // Fill available space
                minHeight: 0, // Allow flex to work properly - critical for flex children
            }}
        >
            {/* Simplified Activity Timeline Container */}
            <Box
                sx={{
                    bgcolor: "background.paper",
                    borderRadius: theme.spacing(1),
                    border: "none",
                    mb: 0,
                    flex: 1,
                    minHeight: 0,
                    boxShadow: "none",
                    overflow: "visible",
                    display: "flex",
                    flexDirection: "column",
                    boxSizing: "border-box",
                    position: "relative",
                }}
            >
                {/* Header — overflow visible so toolbar controls are not clipped by card radius */}
                <Box
                    data-header="true"
                    sx={{
                        ...(i18n.language === "he"
                            ? { pl: { xs: 1, sm: 1.5 }, pr: { xs: 1, sm: 1.5 } }
                            : { pl: { xs: 1, sm: 1.5 }, pr: { xs: 1, sm: 1.5 } }),
                        py: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexShrink: 0,
                        height: "40px",
                        maxHeight: "40px",
                        overflow: "visible",
                        position: "relative",
                        zIndex: 2,
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        }}
                    >
                        <InfoIcon
                            sx={{
                                color: "primary.main",
                                fontSize: { xs: 18, sm: 20 },
                            }}
                        />
                        <Typography
                            variant="h6"
                            sx={{
                                fontWeight: 500,
                                fontSize: { xs: "1rem", sm: "1.25rem" },
                            }}
                        >
                            {t("fields.timeline", { ns: "activities" })}
                        </Typography>
                    </Box>
                    <Box
                        className="endless-scroll-toolbar"
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            flexShrink: 0,
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        }}
                    >
                        {/* Send Email Button - Only show if user has send_email permission */}
                        {hasSendEmailPermission && onSendEmailClick && (
                            <Tooltip
                                title={t("actions.send_email", { ns: "activities" })}
                                arrow
                                enterDelay={300}
                                leaveDelay={100}
                                placement="bottom"
                                PopperProps={{
                                    sx: {
                                        "& .MuiTooltip-tooltip": {
                                            direction: i18n.language === "he" ? "rtl" : "ltr",
                                        },
                                    },
                                }}
                            >
                                <IconButton
                                    color="primary"
                                    size="small"
                                    onClick={onSendEmailClick}
                                    className="toolbar-button"
                                >
                                    <EmailIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                        {/* Phone/Log Activity Button - Only show if user has create_log_activity permission */}
                        {hasCreateLogActivityPermission && onLogActivityClick && (
                            <Tooltip
                                title={showLogActivity ? `${t("actions.close", { ns: "common" })} ${t("fields.log_activity_log_activity", { ns: "activities" })}` : t("fields.log_activity_log_activity", { ns: "activities" })}
                                arrow
                                enterDelay={300}
                                leaveDelay={100}
                                placement="bottom"
                                PopperProps={{
                                    sx: {
                                        "& .MuiTooltip-tooltip": {
                                            direction: i18n.language === "he" ? "rtl" : "ltr",
                                        },
                                    },
                                }}
                            >
                                <IconButton
                                    color="primary"
                                    size="small"
                                    onClick={onLogActivityClick}
                                    className="toolbar-button"
                                    sx={{
                                        "& .MuiSvgIcon-root": {
                                            transition: "transform 0.3s ease-in-out",
                                            transform: showLogActivity ? "rotate(45deg)" : "rotate(0deg)",
                                        },
                                    }}
                                >
                                    <PhoneIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                        <Box sx={{ flexShrink: 0 }}>{filterOptions}</Box>
                    </Box>
                </Box>

                {/* Content Area */}
                {accumulatedData.length === 0 && !isLoading ? (
                    // Empty State
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            p: 4,
                            flex: 1,
                        }}
                    >
                        <Box
                            sx={{
                                width: { xs: 32, sm: 40, md: 60 },
                                height: { xs: 32, sm: 40, md: 60 },
                                mb: 2,
                                color: "text.disabled",
                            }}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                        </Box>
                        <Typography
                            variant={
                                i18n.language === "he" ? "hebrewTitle" : "h6"
                            }
                            sx={{
                                mb: 1,
                                color: "text.primary",
                                // Override theme for English only
                                ...(i18n.language !== "he" && {
                                    textAlign: "left",
                                    direction: "ltr",
                                }),
                            }}
                        >
                            {t("fields.no_activities_yet", {
                                ns: "activities",
                            })}
                        </Typography>
                        <Typography
                            variant={
                                i18n.language === "he"
                                    ? "hebrewBodyText"
                                    : "body2"
                            }
                            sx={{
                                color: "text.secondary",
                                textAlign: "center",
                                maxWidth: "28rem",
                                // Override theme for English only
                                ...(i18n.language !== "he" && {
                                    textAlign: "center",
                                    direction: "ltr",
                                }),
                            }}
                        >
                            {filterType === "All"
                                ? t("fields.no_activities_description", {
                                    ns: "activities",
                                })
                                : t("fields.no_activities_filtered", {
                                    ns: "activities",
                                    filter: t(
                                        `values.filter_types_${filterType.toLowerCase()}`,
                                        { ns: "activities" }
                                    ),
                                })}
                        </Typography>
                    </Box>
                ) : (
                    // Timeline Content with Native Scrollbar
                    <Box
                        ref={timelineContainerRef}
                        onScroll={handleScroll}
                        sx={{
                            flex: 1,
                            overflowY: "auto",
                            overflowX: "hidden",
                            borderBottomLeftRadius: theme.spacing(1),
                            borderBottomRightRadius: theme.spacing(1),
                            overscrollBehavior: "contain",
                            touchAction: "pan-y",
                            scrollBehavior: "smooth",
                            // RTL-aware padding: In Hebrew, scrollbar is on left, so add left padding
                            // In English, scrollbar is on right, so add right padding
                            // scrollbarGutter: "stable" reserves space for scrollbar, but we need padding for content spacing
                            ...(i18n.language === "he"
                                ? {
                                    pl: { xs: 1, sm: 1.5 }, // Left padding to match original right padding (swapped for RTL)
                                    pr: 0, // No right padding in RTL
                                }
                                : {
                                    pl: 0, // No left padding in LTR
                                    pr: { xs: 1, sm: 1.5 }, // Right padding to match tabs padding
                                }),
                            pt: { xs: 1.5, sm: 3 }, // Keep top padding
                            pb: 0, // No bottom padding
                            minHeight: 0, // Critical: Allow flex to constrain height
                            // Height will be set by viewport calculation in useEffect
                            // Native scrollbar styling - match report list
                            scrollbarWidth: "thin !important" as any,
                            scrollbarColor: `${alpha(theme.palette.primary.main, 0.6)} ${alpha(theme.palette.primary.main, 0.1)} !important`,
                            scrollbarGutter: "stable !important" as any, // Reserve space for scrollbar
                            msOverflowStyle: "scroll !important" as any, // Always show in IE/Edge
                            "&::-webkit-scrollbar": {
                                display: "block !important",
                                width: "12px !important",
                                WebkitAppearance: "none !important" as any,
                            },
                            "&::-webkit-scrollbar-track": {
                                display: "block !important",
                                backgroundColor: `${alpha(theme.palette.primary.main, 0.1)} !important`,
                                borderRadius: "6px !important",
                                WebkitBoxShadow:
                                    "inset 0 0 6px rgba(0, 0, 0, 0.1) !important" as any,
                            },
                            "&::-webkit-scrollbar-thumb": {
                                display: "block !important",
                                backgroundColor: `${alpha(theme.palette.primary.main, 0.6)} !important`,
                                borderRadius: "6px !important",
                                WebkitBoxShadow:
                                    "inset 0 0 6px rgba(0, 0, 0, 0.3) !important" as any,
                                "&:hover": {
                                    backgroundColor: `${theme.palette.primary.main} !important`,
                                },
                            },
                        }}
                    >
                        <Timeline
                            data={accumulatedData}
                            session={session}
                            t={t}
                            i18n={i18n}
                            triggerRefresh={triggerRefresh}
                            expandedDetails={expandedDetails}
                            onToggleDetail={handleToggleDetail}
                        />

                        {/* Loading indicator for endless scroll */}
                        {isLoadingMore && (
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "center",
                                    my: 2,
                                }}
                            >
                            </Box>
                        )}

                        {/* End of timeline indicator - reached first record */}
                        {!hasMore && !isLoadingMore && accumulatedData.length > 0 && (
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    py: 3,
                                    px: 2,
                                }}
                            >
                                <Typography
                                    variant={
                                        i18n.language === "he"
                                            ? "hebrewBodyText"
                                            : "body2"
                                    }
                                    sx={{
                                        color: "text.secondary",
                                        textAlign: "center",
                                        fontStyle: "italic",
                                    }}
                                >
                                    {t("fields.reached_first_record", {
                                        ns: "activities",
                                        defaultValue: "You've reached the first record",
                                    })}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default React.memo(ActivityTimeline);
