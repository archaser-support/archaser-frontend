"use client";
import {
    ExpandMore,
    ExpandLess,
    Person,
    Email,
    Phone,
    Comment,
    Assignment,
    Schedule,
    Update,
} from "@mui/icons-material";
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    Chip,
    Avatar,
    useTheme,
} from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
    getPortalCardExpandToggleSx,
    getPortalCardSx,
    PORTAL_CARD_CLASS,
} from "@/app/theme/portalCard";
import { PORTAL_CARD_TOGGLE_CLASS } from "@/app/theme/portalButton";

import RTLGridLayout, { RTLGridItem } from "@/components/RTLGridLayout";
import { useMobileDetection } from "@/shared/hooks/useMobileDetection";
import { PortalInvoice } from "@/types/PortalInvoice";
import { formatDateForDisplay } from "@/utils/datetimeOperations";

import DisputeInvoiceTable from "./DisputeInvoiceTable";

// Constants for dispute reasons
const DISPUTE_REASONS = {
    NOT_RIGHT_CONTACT_PERSON: "Not the right contact person in the company",
} as const;

type DisputeAccordionProps = {
    disputes: {
        id: number;
        status: string;
        reason: string | null;
        comment: string | null;
        created_at: Date;
        modified_at: Date;
        assignedUser: { initials: string; name: string } | null;
        contact: { name: string; email: string; mobile: string } | null;
        resolutionComment: string | null;
        invoices: PortalInvoice[];
    }[];
    locale: string;
    customerCurrency: string | null;
};

export default function DisputeAccordion({
    disputes,
    locale,
    customerCurrency,
}: DisputeAccordionProps) {
    const [openIndex, setOpenIndex] = useState<number | null>(0);
    const { t, i18n } = useTranslation(["disputes", "portal", "common"]);
    const isMobile = useMobileDetection(768);

    // Helper function to format dates
    const formatDateValue = (
        dateValue: Date | string | null | undefined
    ): string => {
        if (!dateValue) return "-";

        try {
            let dateToFormat: string;
            if (dateValue instanceof Date) {
                dateToFormat = dateValue.toISOString();
            } else if (typeof dateValue === "string") {
                dateToFormat = dateValue;
            } else {
                console.error("Unknown date format:", dateValue);
                return "-";
            }

            return formatDateForDisplay(dateToFormat, "date", locale);
        } catch (error) {
            console.error("Error formatting date:", error);
            return "-";
        }
    };

    const getStatusColor = (status: string, theme: any) => {
        switch (status) {
            case "New":
                return {
                    bg: theme.palette.warning.light,
                    text: theme.palette.warning.dark,
                    border: theme.palette.warning.main,
                };
            case "Under_Review":
                return {
                    bg: theme.palette.info.light,
                    text: theme.palette.info.dark,
                    border: theme.palette.info.main,
                };
            case "Awaiting_Update":
                return {
                    bg: theme.palette.secondary.light,
                    text: theme.palette.secondary.dark,
                    border: theme.palette.secondary.main,
                };
            case "Resolved":
                return {
                    bg: theme.palette.success.light,
                    text: theme.palette.success.dark,
                    border: theme.palette.success.main,
                };
            case "Cancelled":
                return {
                    bg: theme.palette.error.light,
                    text: theme.palette.error.dark,
                    border: theme.palette.error.main,
                };
            default:
                return {
                    bg: theme.palette.grey[100],
                    text: theme.palette.grey[600],
                    border: theme.palette.grey[300],
                };
        }
    };

    // Empty state
    if (disputes.length === 0) {
        return (
            <Box
                sx={{
                    width: "100%",
                    p: { xs: 2, sm: 4 },
                    textAlign: "center",
                    maxWidth: { xs: "90%", sm: 400 },
                    mx: "auto",
                    direction: i18n.language === "he" ? "rtl" : "ltr",
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
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                        width: "100%",
                        boxSizing: "border-box",
                    })}
                >
                    <Assignment
                        sx={(theme) => ({
                            fontSize: 48,
                            color: theme.palette.text.secondary,
                            mb: 2,
                            opacity: 0.6,
                        })}
                    />
                    <Typography
                        variant="h6"
                        sx={(theme) => ({
                            color: theme.palette.text.primary,
                            fontWeight: 600,
                            mb: 1,
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            textAlign: "center",
                        })}
                    >
                        {t("messages.no_disputes_found")}
                    </Typography>
                </Card>
            </Box>
        );
    }

    // Debug container styles
    const containerStyles = {
        p: { xs: 1, sm: 2 },
        width: "100%",
        maxWidth: "100%",
        direction: i18n.language === "he" ? "rtl" : "ltr",
        textAlign: i18n.language === "he" ? "right" : "left",
    };

    return (
        <Box sx={containerStyles}>
            {disputes.map((dispute, idx) => {
                const isOpen = openIndex === idx;

                return (
                    <Card
                        key={dispute.id}
                        className={PORTAL_CARD_CLASS}
                        elevation={0}
                        sx={(theme) => {
                            const statusColors = getStatusColor(
                                dispute.status,
                                theme
                            );
                            return {
                                ...getPortalCardSx(theme),
                                background: `linear-gradient(135deg, ${theme.palette.grey[50]} 0%, ${theme.palette.grey[200]} 100%)`,
                                color: theme.palette.text.primary,
                                mb: 2,
                                overflow: "hidden",
                                position: "relative",
                                transition: "all 0.2s ease-in-out",
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                                "&:hover": {
                                    transform: "translateY(-1px)",
                                    boxShadow: "none",
                                },
                            };
                        }}
                    >
                        <CardContent
                            sx={{
                                position: "relative",
                                zIndex: 1,
                                px: 2,
                                py: 2,
                                pb: isOpen ? 0 : 2,
                                "&:last-child": { pb: isOpen ? 0 : 2 },
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            {/* Header Section - Clickable */}
                            <Button
                                fullWidth
                                disableRipple
                                disableFocusRipple
                                disableTouchRipple
                                className={PORTAL_CARD_TOGGLE_CLASS}
                                onClick={() =>
                                    setOpenIndex(isOpen ? null : idx)
                                }
                                sx={(theme) => ({
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    alignSelf: "stretch",
                                    minHeight: 40,
                                    px: 0,
                                    py: 0,
                                    textTransform: "none",
                                    color: theme.palette.text.primary,
                                    backgroundColor: "transparent",
                                    borderRadius: 0,
                                    "&:hover": {
                                        backgroundColor: "transparent",
                                    },
                                    "&:active": {
                                        backgroundColor: "transparent",
                                    },
                                })}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        flexDirection: "row", // Keep icon on the left always
                                        width: "100%",
                                    }}
                                >
                                    {/* Left side: Status and Dispute Info */}
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            flex: 1,
                                            gap: 2,
                                            flexDirection:
                                                i18n.language === "he"
                                                    ? "row-reverse"
                                                    : "row",
                                            justifyContent:
                                                i18n.language === "he"
                                                    ? "flex-end"
                                                    : "flex-start",
                                        }}
                                    >
                                        {/* Dispute Label and Value */}
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 0.5,
                                                order:
                                                    i18n.language === "he"
                                                        ? 2
                                                        : 1,
                                            }}
                                        >
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    color: "#64748b",
                                                    fontSize: "0.7rem",
                                                    fontWeight: 500,
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.5px",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                }}
                                            >
                                                {t("fields.dispute", {
                                                    ns: "portal",
                                                })}
                                                :
                                            </Typography>
                                            <Typography
                                                variant="h6"
                                                sx={{
                                                    fontWeight: 700,
                                                    color: "#1a202c",
                                                    fontSize: isMobile
                                                        ? "1rem"
                                                        : "1.125rem",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                }}
                                            >
                                                #{dispute.id}
                                            </Typography>
                                        </Box>

                                        {/* Status */}
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                                order:
                                                    i18n.language === "he"
                                                        ? 1
                                                        : 2,
                                            }}
                                        >
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    color: "#64748b",
                                                    fontSize: "0.7rem",
                                                    fontWeight: 500,
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.5px",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                }}
                                            >
                                                {t("fields.reasons_status")}:
                                            </Typography>
                                            <Chip
                                                label={t(
                                                    `values.dispute_status_${(dispute.status || "").toLowerCase()}`,
                                                    {
                                                        defaultValue:
                                                            dispute.status ||
                                                            "Unknown",
                                                    }
                                                )}
                                                sx={(theme) => {
                                                    const statusColors =
                                                        getStatusColor(
                                                            dispute.status,
                                                            theme
                                                        );
                                                    return {
                                                        backgroundColor:
                                                            statusColors.bg,
                                                        color: statusColors.text,
                                                        border: `1px solid ${statusColors.border}`,
                                                        fontWeight: 600,
                                                        fontSize: "0.75rem",
                                                        height: "24px",
                                                        "& .MuiChip-label": {
                                                            padding: "0 8px",
                                                        },
                                                    };
                                                }}
                                            />
                                        </Box>
                                    </Box>

                                    {/* Right side: Expand/Collapse Icon */}
                                    <Box
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenIndex(isOpen ? -1 : idx);
                                        }}
                                        sx={(theme) =>
                                            getPortalCardExpandToggleSx(theme)
                                        }
                                        aria-hidden
                                    >
                                        {isOpen ? (
                                            <ExpandLess fontSize="small" />
                                        ) : (
                                            <ExpandMore fontSize="small" />
                                        )}
                                    </Box>
                                </Box>
                            </Button>

                            {/* Details */}
                            {isOpen && (
                                <Box
                                    sx={{
                                        mt: 2,
                                        pt: 0,
                                        px: 0,
                                        pb: 2,
                                        animation: "slideDown 0.3s ease-in-out",
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                        "@keyframes slideDown": {
                                            from: {
                                                opacity: 0,
                                                transform: "translateY(-10px)",
                                            },
                                            to: {
                                                opacity: 1,
                                                transform: "translateY(0)",
                                            },
                                        },
                                    }}
                                >
                                    {/* Date Information */}
                                    <Box
                                        sx={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 1,
                                            mb: 2,
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                        }}
                                    >
                                        {/* Dispute Reason Card */}
                                        {dispute.reason && (
                                            <Box
                                                sx={{
                                                    mb: 1,
                                                    p: 1.5,
                                                    backgroundColor:
                                                        "rgba(255,255,255,0.6)",
                                                    borderRadius: "8px",
                                                    border: "1px solid rgba(0,0,0,0.05)",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems:
                                                            "flex-start",
                                                        justifyContent:
                                                            "space-between",
                                                        flexDirection: "row", // Keep icon on the left always
                                                        gap: 1,
                                                    }}
                                                >
                                                    {/* Left side: Icon and Label */}
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            alignItems:
                                                                "flex-start",
                                                            flex: 1,
                                                            gap: 1,
                                                            flexDirection:
                                                                i18n.language ===
                                                                "he"
                                                                    ? "row-reverse"
                                                                    : "row",
                                                            justifyContent:
                                                                i18n.language ===
                                                                "he"
                                                                    ? "flex-end"
                                                                    : "flex-start",
                                                        }}
                                                    >
                                                        <Box
                                                            sx={{
                                                                display: "flex",
                                                                alignItems:
                                                                    "center",
                                                                gap: 1,
                                                                flexDirection:
                                                                    "row",
                                                                direction:
                                                                    i18n.language ===
                                                                    "he"
                                                                        ? "rtl"
                                                                        : "ltr",
                                                            }}
                                                        >
                                                            <Comment
                                                                sx={{
                                                                    fontSize: 20,
                                                                    color: "#64748b",
                                                                }}
                                                            />
                                                            <Typography
                                                                variant="body2"
                                                                sx={{
                                                                    color: "#64748b",
                                                                    fontSize:
                                                                        "0.7rem",
                                                                    fontWeight: 500,
                                                                    textTransform:
                                                                        "uppercase",
                                                                    letterSpacing:
                                                                        "0.5px",
                                                                    direction:
                                                                        i18n.language ===
                                                                        "he"
                                                                            ? "rtl"
                                                                            : "ltr",
                                                                    textAlign:
                                                                        i18n.language ===
                                                                        "he"
                                                                            ? "right"
                                                                            : "left",
                                                                }}
                                                            >
                                                                {t(
                                                                    "fields.details_dispute_reason"
                                                                )}
                                                                :
                                                            </Typography>
                                                        </Box>
                                                    </Box>

                                                    {/* Right side: Value */}
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            minWidth: 0,
                                                            flex: 1,
                                                            justifyContent:
                                                                "flex-end",
                                                        }}
                                                    >
                                                        <Typography
                                                            variant="body2"
                                                            sx={{
                                                                color: "#1a202c",
                                                                fontWeight: 600,
                                                                fontSize:
                                                                    "0.8rem",
                                                                direction:
                                                                    i18n.language ===
                                                                    "he"
                                                                        ? "rtl"
                                                                        : "ltr",
                                                                textAlign:
                                                                    "right",
                                                                maxWidth:
                                                                    "100%",
                                                            }}
                                                        >
                                                            {dispute.reason ===
                                                            DISPUTE_REASONS.NOT_RIGHT_CONTACT_PERSON
                                                                ? t(
                                                                      "portal.dispute_list.dispute_reasons.NOT_RIGHT_CONTACT_PERSON"
                                                                  )
                                                                : dispute.reason}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </Box>
                                        )}

                                        <Box
                                            sx={{
                                                mb: 1,
                                                p: 1.5,
                                                backgroundColor:
                                                    "rgba(255,255,255,0.6)",
                                                borderRadius: "8px",
                                                border: "1px solid rgba(0,0,0,0.05)",
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent:
                                                        "space-between",
                                                    flexDirection: "row", // Keep icon on the left always
                                                    gap: 1,
                                                }}
                                            >
                                                {/* Left side: Icon and Label */}
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        flex: 1,
                                                        gap: 1,
                                                        flexDirection:
                                                            i18n.language ===
                                                            "he"
                                                                ? "row-reverse"
                                                                : "row",
                                                        justifyContent:
                                                            i18n.language ===
                                                            "he"
                                                                ? "flex-end"
                                                                : "flex-start",
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            gap: 1,
                                                            flexDirection:
                                                                "row",
                                                            direction:
                                                                i18n.language ===
                                                                "he"
                                                                    ? "rtl"
                                                                    : "ltr",
                                                        }}
                                                    >
                                                        <Schedule
                                                            sx={{
                                                                fontSize: 20,
                                                                color: "#64748b",
                                                            }}
                                                        />
                                                        <Typography
                                                            variant="body2"
                                                            sx={{
                                                                color: "#64748b",
                                                                fontSize:
                                                                    "0.7rem",
                                                                fontWeight: 500,
                                                                textTransform:
                                                                    "uppercase",
                                                                letterSpacing:
                                                                    "0.5px",
                                                                direction:
                                                                    i18n.language ===
                                                                    "he"
                                                                        ? "rtl"
                                                                        : "ltr",
                                                                textAlign:
                                                                    i18n.language ===
                                                                    "he"
                                                                        ? "right"
                                                                        : "left",
                                                            }}
                                                        >
                                                            {t(
                                                                "fields.created"
                                                            )}
                                                            :
                                                        </Typography>
                                                    </Box>
                                                </Box>

                                                {/* Right side: Value */}
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        minWidth: 0,
                                                        flex: 1,
                                                        justifyContent:
                                                            "flex-end",
                                                    }}
                                                >
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            color: "#1a202c",
                                                            fontWeight: 600,
                                                            fontSize: "0.8rem",
                                                            direction:
                                                                i18n.language ===
                                                                "he"
                                                                    ? "rtl"
                                                                    : "ltr",
                                                            textAlign: "right",
                                                            maxWidth: "100%",
                                                        }}
                                                    >
                                                        {formatDateValue(
                                                            dispute.created_at
                                                        )}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Box>

                                        <Box
                                            sx={{
                                                mb: 1,
                                                p: 1.5,
                                                backgroundColor:
                                                    "rgba(255,255,255,0.6)",
                                                borderRadius: "8px",
                                                border: "1px solid rgba(0,0,0,0.05)",
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent:
                                                        "space-between",
                                                    flexDirection: "row", // Keep icon on the left always
                                                    gap: 1,
                                                }}
                                            >
                                                {/* Left side: Icon and Label */}
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        flex: 1,
                                                        gap: 1,
                                                        flexDirection:
                                                            i18n.language ===
                                                            "he"
                                                                ? "row-reverse"
                                                                : "row",
                                                        justifyContent:
                                                            i18n.language ===
                                                            "he"
                                                                ? "flex-end"
                                                                : "flex-start",
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            gap: 1,
                                                            flexDirection:
                                                                "row",
                                                            direction:
                                                                i18n.language ===
                                                                "he"
                                                                    ? "rtl"
                                                                    : "ltr",
                                                        }}
                                                    >
                                                        <Update
                                                            sx={{
                                                                fontSize: 20,
                                                                color: "#64748b",
                                                            }}
                                                        />
                                                        <Typography
                                                            variant="body2"
                                                            sx={{
                                                                color: "#64748b",
                                                                fontSize:
                                                                    "0.7rem",
                                                                fontWeight: 500,
                                                                textTransform:
                                                                    "uppercase",
                                                                letterSpacing:
                                                                    "0.5px",
                                                                direction:
                                                                    i18n.language ===
                                                                    "he"
                                                                        ? "rtl"
                                                                        : "ltr",
                                                                textAlign:
                                                                    i18n.language ===
                                                                    "he"
                                                                        ? "right"
                                                                        : "left",
                                                            }}
                                                        >
                                                            {t(
                                                                "fields.last_modified"
                                                            )}
                                                            :
                                                        </Typography>
                                                    </Box>
                                                </Box>

                                                {/* Right side: Value */}
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        minWidth: 0,
                                                        flex: 1,
                                                        justifyContent:
                                                            "flex-end",
                                                    }}
                                                >
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            color: "#1a202c",
                                                            fontWeight: 600,
                                                            fontSize: "0.8rem",
                                                            direction:
                                                                i18n.language ===
                                                                "he"
                                                                    ? "rtl"
                                                                    : "ltr",
                                                            textAlign: "right",
                                                            maxWidth: "100%",
                                                        }}
                                                    >
                                                        {formatDateValue(
                                                            dispute.modified_at
                                                        )}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Box>
                                    </Box>

                                    {/* Contact Information */}
                                    {dispute.contact && (
                                        <Box
                                            sx={{
                                                mb: 1,
                                                p: 1.5,
                                                backgroundColor:
                                                    "rgba(255,255,255,0.6)",
                                                borderRadius: "8px",
                                                border: "1px solid rgba(0,0,0,0.05)",
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 1,
                                                    mb: 1,
                                                    flexDirection:
                                                        i18n.language === "he"
                                                            ? "row"
                                                            : "row-reverse",
                                                    justifyContent:
                                                        i18n.language === "he"
                                                            ? "flex-start"
                                                            : "flex-end",
                                                }}
                                            >
                                                <Person
                                                    sx={{
                                                        fontSize: 20,
                                                        color: "#64748b",
                                                    }}
                                                />
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        color: "#64748b",
                                                        fontSize: "0.7rem",
                                                        fontWeight: 500,
                                                        textTransform:
                                                            "uppercase",
                                                        letterSpacing: "0.5px",
                                                        direction:
                                                            i18n.language ===
                                                            "he"
                                                                ? "rtl"
                                                                : "ltr",
                                                        textAlign:
                                                            i18n.language ===
                                                            "he"
                                                                ? "right"
                                                                : "left",
                                                    }}
                                                >
                                                    {t("fields.contact")}
                                                </Typography>
                                            </Box>
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    color: "#1a202c",
                                                    fontWeight: 600,
                                                    fontSize: "0.9rem",
                                                    mb: 1,
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                }}
                                            >
                                                {dispute.contact.name}
                                            </Typography>
                                            {dispute.contact.mobile && (
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems:
                                                            "flex-start",
                                                        justifyContent:
                                                            "space-between",
                                                        flexDirection: "row",
                                                        gap: 1,
                                                        mb: 0.5,
                                                    }}
                                                >
                                                    {/* Left side: Icon */}
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            alignItems:
                                                                "flex-start",
                                                            flex: 1,
                                                            gap: 1,
                                                            flexDirection:
                                                                i18n.language ===
                                                                "he"
                                                                    ? "row-reverse"
                                                                    : "row",
                                                            justifyContent:
                                                                i18n.language ===
                                                                "he"
                                                                    ? "flex-end"
                                                                    : "flex-start",
                                                        }}
                                                    >
                                                        <Box
                                                            sx={{
                                                                display: "flex",
                                                                alignItems:
                                                                    "center",
                                                                gap: 1,
                                                                flexDirection:
                                                                    "row",
                                                                direction:
                                                                    i18n.language ===
                                                                    "he"
                                                                        ? "rtl"
                                                                        : "ltr",
                                                            }}
                                                        >
                                                            <Phone
                                                                sx={{
                                                                    fontSize: 16,
                                                                    color: "#64748b",
                                                                }}
                                                            />
                                                            <Typography
                                                                variant="body2"
                                                                sx={{
                                                                    color: "#64748b",
                                                                    fontSize:
                                                                        "0.7rem",
                                                                    fontWeight: 500,
                                                                    textTransform:
                                                                        "uppercase",
                                                                    letterSpacing:
                                                                        "0.5px",
                                                                    direction:
                                                                        i18n.language ===
                                                                        "he"
                                                                            ? "rtl"
                                                                            : "ltr",
                                                                    textAlign:
                                                                        i18n.language ===
                                                                        "he"
                                                                            ? "right"
                                                                            : "left",
                                                                }}
                                                            >
                                                                {t(
                                                                    "fields.contact_phone"
                                                                )}
                                                                :
                                                            </Typography>
                                                        </Box>
                                                    </Box>

                                                    {/* Right side: Value */}
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            minWidth: 0,
                                                            flex: 1,
                                                            justifyContent:
                                                                "flex-end",
                                                        }}
                                                    >
                                                        <Typography
                                                            variant="body2"
                                                            sx={{
                                                                color: "#1a202c",
                                                                fontWeight: 600,
                                                                fontSize:
                                                                    "0.8rem",
                                                                direction:
                                                                    i18n.language ===
                                                                    "he"
                                                                        ? "rtl"
                                                                        : "ltr",
                                                                textAlign:
                                                                    "right",
                                                                maxWidth:
                                                                    "100%",
                                                            }}
                                                        >
                                                            {
                                                                dispute.contact
                                                                    .mobile
                                                            }
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            )}
                                            {dispute.contact.email && (
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems:
                                                            "flex-start",
                                                        justifyContent:
                                                            "space-between",
                                                        flexDirection: "row",
                                                        gap: 1,
                                                    }}
                                                >
                                                    {/* Left side: Icon */}
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            alignItems:
                                                                "flex-start",
                                                            flex: 1,
                                                            gap: 1,
                                                            flexDirection:
                                                                i18n.language ===
                                                                "he"
                                                                    ? "row-reverse"
                                                                    : "row",
                                                            justifyContent:
                                                                i18n.language ===
                                                                "he"
                                                                    ? "flex-end"
                                                                    : "flex-start",
                                                        }}
                                                    >
                                                        <Box
                                                            sx={{
                                                                display: "flex",
                                                                alignItems:
                                                                    "center",
                                                                gap: 1,
                                                                flexDirection:
                                                                    "row",
                                                                direction:
                                                                    i18n.language ===
                                                                    "he"
                                                                        ? "rtl"
                                                                        : "ltr",
                                                            }}
                                                        >
                                                            <Email
                                                                sx={{
                                                                    fontSize: 16,
                                                                    color: "#64748b",
                                                                }}
                                                            />
                                                            <Typography
                                                                variant="body2"
                                                                sx={{
                                                                    color: "#64748b",
                                                                    fontSize:
                                                                        "0.7rem",
                                                                    fontWeight: 500,
                                                                    textTransform:
                                                                        "uppercase",
                                                                    letterSpacing:
                                                                        "0.5px",
                                                                    direction:
                                                                        i18n.language ===
                                                                        "he"
                                                                            ? "rtl"
                                                                            : "ltr",
                                                                    textAlign:
                                                                        i18n.language ===
                                                                        "he"
                                                                            ? "right"
                                                                            : "left",
                                                                }}
                                                            >
                                                                {t(
                                                                    "fields.contact_email",
                                                                    {
                                                                        ns: "portal",
                                                                    }
                                                                )}
                                                                :
                                                            </Typography>
                                                        </Box>
                                                    </Box>

                                                    {/* Right side: Value */}
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            minWidth: 0,
                                                            flex: 1,
                                                            justifyContent:
                                                                "flex-end",
                                                        }}
                                                    >
                                                        <Typography
                                                            variant="body2"
                                                            sx={{
                                                                color: "#1a202c",
                                                                fontWeight: 600,
                                                                fontSize:
                                                                    "0.8rem",
                                                                direction:
                                                                    i18n.language ===
                                                                    "he"
                                                                        ? "rtl"
                                                                        : "ltr",
                                                                textAlign:
                                                                    "right",
                                                                maxWidth:
                                                                    "100%",
                                                            }}
                                                        >
                                                            {
                                                                dispute.contact
                                                                    .email
                                                            }
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            )}
                                        </Box>
                                    )}

                                    {/* Comments */}
                                    {dispute.comment && (
                                        <Box
                                            sx={{
                                                mb: 2,
                                                p: 1.5,
                                                backgroundColor:
                                                    "rgba(255,255,255,0.6)",
                                                borderRadius: "8px",
                                                border: "1px solid rgba(0,0,0,0.05)",
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 1,
                                                    mb: 1,
                                                    flexDirection:
                                                        i18n.language === "he"
                                                            ? "row-reverse"
                                                            : "row",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                    justifyContent:
                                                        i18n.language === "he"
                                                            ? "flex-end"
                                                            : "flex-start",
                                                }}
                                            >
                                                <Comment
                                                    sx={{
                                                        fontSize: 20,
                                                        color: "#64748b",
                                                    }}
                                                />
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        color: "#64748b",
                                                        fontSize: "0.7rem",
                                                        fontWeight: 500,
                                                        textTransform:
                                                            "uppercase",
                                                        letterSpacing: "0.5px",
                                                        direction:
                                                            i18n.language ===
                                                            "he"
                                                                ? "rtl"
                                                                : "ltr",
                                                        textAlign:
                                                            i18n.language ===
                                                            "he"
                                                                ? "right"
                                                                : "left",
                                                    }}
                                                >
                                                    {t(
                                                        "fields.customer_comment"
                                                    )}
                                                </Typography>
                                            </Box>
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    color: "#1a202c",
                                                    fontSize: "0.85rem",
                                                    lineHeight: 1.5,
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                    maxWidth: "100%",
                                                }}
                                            >
                                                {dispute.comment}
                                            </Typography>
                                        </Box>
                                    )}

                                    {dispute.resolutionComment && (
                                        <Box
                                            sx={{
                                                mb:
                                                    dispute.reason !==
                                                    DISPUTE_REASONS.NOT_RIGHT_CONTACT_PERSON
                                                        ? 2
                                                        : 0,
                                                p: 1.5,
                                                backgroundColor:
                                                    "rgba(255,255,255,0.6)",
                                                borderRadius: "8px",
                                                border: "1px solid rgba(0,0,0,0.05)",
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 1,
                                                    mb: 1,
                                                    flexDirection:
                                                        i18n.language === "he"
                                                            ? "row"
                                                            : "row-reverse",
                                                    justifyContent:
                                                        i18n.language === "he"
                                                            ? "flex-start"
                                                            : "flex-end",
                                                }}
                                            >
                                                <Comment
                                                    sx={{
                                                        fontSize: 20,
                                                        color: "#64748b",
                                                    }}
                                                />
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        color: "#64748b",
                                                        fontSize: "0.7rem",
                                                        fontWeight: 500,
                                                        textTransform:
                                                            "uppercase",
                                                        letterSpacing: "0.5px",
                                                        direction:
                                                            i18n.language ===
                                                            "he"
                                                                ? "rtl"
                                                                : "ltr",
                                                        textAlign:
                                                            i18n.language ===
                                                            "he"
                                                                ? "right"
                                                                : "left",
                                                    }}
                                                >
                                                    {t(
                                                        "portal.general.resolution_comment"
                                                    )}
                                                </Typography>
                                            </Box>
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    color: "#1a202c",
                                                    fontSize: "0.85rem",
                                                    lineHeight: 1.5,
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                    maxWidth: "100%",
                                                }}
                                            >
                                                {dispute.resolutionComment}
                                            </Typography>
                                        </Box>
                                    )}

                                    {/* Only show invoices section if reason is not "Not the right contact person in the company" */}
                                    {dispute.reason !==
                                        DISPUTE_REASONS.NOT_RIGHT_CONTACT_PERSON && (
                                        <>
                                            <DisputeInvoiceTable
                                                invoices={dispute.invoices}
                                                locale={locale}
                                                customerCurrency={
                                                    customerCurrency
                                                }
                                            />
                                        </>
                                    )}
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
        </Box>
    );
}
