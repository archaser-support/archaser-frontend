import {
    Email as EmailIcon,
    Sms as SmsIcon,
    WhatsApp as WhatsAppIcon,
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    Visibility as VisibilityIcon,
    TrendingUp as TrendingUpIcon,
    TrendingDown as TrendingDownIcon,
    Schedule as ScheduleIcon,
} from "@mui/icons-material";
import { Box, Grid, Card, CardContent, Typography, Tooltip } from "@mui/material";
import React from "react";

interface SummaryProps {
    summary: {
        totalEmailActivities: number;
        totalEmailContacts?: number;
        sent: number;
        delivered: number;
        bounced: number;
        failed?: number;
        opened: number;
        clicked: number;
        deliveryRate: number;
        openRate: number;
        clickRate: number;
        bounceRate: number;
    };
    channel?: "Email" | "SMS" | "WhatsApp";
}

const EmailCampaignSummary: React.FC<SummaryProps> = ({ summary, channel = "Email" }) => {
    const getStatusColor = (rate: number) => {
        if (rate >= 80) return "success";
        if (rate >= 60) return "warning";
        return "error";
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
            case "Automated":
                return "primary";
            case "Promise_to_pay":
                return "success";
            case "Dispute":
                return "error";
            case "Agent":
                return "warning";
            case "Legal":
                return "info";
            default:
                return "default";
        }
    };

    const getTrendIcon = (rate: number) => {
        if (rate >= 80) return <TrendingUpIcon color="success" />;
        if (rate >= 60) return <TrendingUpIcon color="warning" />;
        return <TrendingDownIcon color="error" />;
    };

    // Get the appropriate icon based on channel
    const getChannelIcon = (color: "primary" | "secondary" | "warning" | "info" | "success" | "error") => {
        switch (channel) {
            case "SMS":
                return <SmsIcon color={color} />;
            case "WhatsApp":
                return <WhatsAppIcon color={color} />;
            default:
                return <EmailIcon color={color} />;
        }
    };

    // Get channel-specific labels
    const channelLabels = {
        Email: {
            activities: "Total Email Activities",
            activitiesSubtitle: "Email campaigns",
            activitiesTooltip: "The total number of email campaigns executed. Each campaign is created with its contacts automatically when scheduled. Each campaign may have been sent to multiple recipients.",
            contacts: "Total Email Contacts",
            contactsSubtitle: "Individual recipients",
            contactsTooltip: "The total number of individual email recipients across all campaigns. This represents the actual reach of your email campaigns. Activities and contacts are created together when campaigns are scheduled.",
            scheduled: "Scheduled for Sending",
            scheduledSubtitle: "Emails scheduled for sending",
            scheduledTooltip: "The number of individual emails that were scheduled for sending and sent to the email server but delivery confirmation is pending. These emails are in transit or awaiting delivery confirmation from the recipient's email server.",
            delivered: "Delivered",
            deliveredTooltip: "The number of individual emails that were successfully delivered to recipients' inboxes. This counts each successful delivery, not campaigns.",
        },
        SMS: {
            activities: "Total SMS Activities",
            activitiesSubtitle: "SMS campaigns",
            activitiesTooltip: "The total number of SMS campaigns executed. Each campaign is created with its contacts automatically when scheduled.",
            contacts: "Total SMS Contacts",
            contactsSubtitle: "Individual recipients",
            contactsTooltip: "The total number of individual SMS recipients across all campaigns. This represents the actual reach of your SMS campaigns.",
            scheduled: "Scheduled for Sending",
            scheduledSubtitle: "SMS scheduled for sending",
            scheduledTooltip: "The number of SMS messages that were scheduled for sending but delivery confirmation is pending.",
            delivered: "Delivered",
            deliveredTooltip: "The number of SMS messages that were successfully delivered to recipients.",
        },
        WhatsApp: {
            activities: "Total WhatsApp Activities",
            activitiesSubtitle: "WhatsApp campaigns",
            activitiesTooltip: "The total number of WhatsApp campaigns executed. Each campaign is created with its contacts automatically when scheduled.",
            contacts: "Total WhatsApp Contacts",
            contactsSubtitle: "Individual recipients",
            contactsTooltip: "The total number of individual WhatsApp recipients across all campaigns. This represents the actual reach of your WhatsApp campaigns.",
            scheduled: "Scheduled for Sending",
            scheduledSubtitle: "Messages scheduled for sending",
            scheduledTooltip: "The number of WhatsApp messages that were scheduled for sending but delivery confirmation is pending.",
            delivered: "Delivered",
            deliveredTooltip: "The number of WhatsApp messages that were successfully delivered to recipients.",
        },
    };

    const labels = channelLabels[channel] || channelLabels.Email;
    const isEmailChannel = channel === "Email";

    // Build summary cards based on channel
    const summaryCards = [
        {
            title: labels.activities,
            value: summary.totalEmailActivities.toLocaleString(),
            icon: getChannelIcon("primary"),
            color: "primary",
            subtitle: labels.activitiesSubtitle,
            tooltip: labels.activitiesTooltip,
        },
        ...(summary.totalEmailContacts !== undefined ? [{
            title: labels.contacts,
            value: summary.totalEmailContacts.toLocaleString(),
            icon: getChannelIcon("secondary"),
            color: "secondary",
            subtitle: labels.contactsSubtitle,
            tooltip: labels.contactsTooltip,
        }] : []),
        {
            title: labels.scheduled,
            value: summary.sent.toLocaleString(),
            icon: <ScheduleIcon color="warning" />,
            color: "warning",
            subtitle: labels.scheduledSubtitle,
            tooltip: labels.scheduledTooltip,
        },
        {
            title: labels.delivered,
            value: summary.delivered.toLocaleString(),
            icon: <CheckCircleIcon color="success" />,
            color: "success",
            subtitle: `${summary.deliveryRate.toFixed(1)}% delivery rate`,
            trend: getTrendIcon(summary.deliveryRate),
            tooltip: labels.deliveredTooltip,
        },
        // Failed - shown for all channels
        {
            title: "Failed",
            value: (summary.failed ?? 0).toLocaleString(),
            icon: <ErrorIcon color="error" />,
            color: "error",
            subtitle: `${(((summary.failed ?? 0) / (summary.totalEmailContacts || 1)) * 100).toFixed(1)}% failure rate`,
            tooltip: `The number of ${channel === "Email" ? "emails" : channel === "SMS" ? "SMS messages" : "WhatsApp messages"} that failed to send due to technical issues or invalid recipient information.`,
        },
        // Email-only metrics: Bounced, Opened, Clicked
        ...(isEmailChannel ? [
            {
                title: "Bounced",
                value: summary.bounced.toLocaleString(),
                icon: <ErrorIcon color="warning" />,
                color: "warning",
                subtitle: `${summary.bounceRate.toFixed(1)}% bounce rate`,
                tooltip: "The number of individual emails that failed to reach recipients due to invalid email addresses, server issues, or recipient mailbox restrictions.",
            },
            {
                title: "Opened",
                value: summary.opened.toLocaleString(),
                icon: <VisibilityIcon color="info" />,
                color: "info",
                subtitle: `${summary.openRate.toFixed(1)}% open rate`,
                trend: getTrendIcon(summary.openRate),
                tooltip: "The number of individual recipients who opened the emails they received. This measures actual engagement at the recipient level.",
            },
            {
                title: "Clicked",
                value: summary.clicked.toLocaleString(),
                icon: <CheckCircleIcon color="secondary" />,
                color: "secondary",
                subtitle: `${summary.clickRate.toFixed(1)}% click rate`,
                trend: getTrendIcon(summary.clickRate),
                tooltip: "The number of individual recipients who clicked on links within the emails they received. This indicates deeper engagement and interest.",
            },
        ] : []),
    ];

    return (
        <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: "bold" }}>
                Campaign Summary
            </Typography>

            <Grid container spacing={2}>
                {summaryCards.map((card, index) => (
                    <Grid size={{ xs: 12, sm: 6, md: 3, lg: 2, xl: 1.7 }} key={index}>
                        <Card
                            sx={{
                                height: "100%",
                                "&:hover": {
                                    boxShadow: 2,
                                    transform: "translateY(-1px)",
                                    transition: "all 0.2s ease-in-out",
                                },
                            }}
                        >
                            <CardContent sx={{ p: 2 }}>
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        mb: 0.5,
                                    }}
                                >
                                    {card.icon}
                                    <Tooltip
                                        title={card.tooltip}
                                        placement="bottom-start"
                                        arrow
                                        enterDelay={500}
                                        leaveDelay={200}
                                    >
                                        <Typography
                                            variant="subtitle1"
                                            sx={{
                                                ml: 1,
                                                fontWeight: "bold",
                                                fontSize: "0.875rem",
                                                cursor: 'help',
                                                '&:hover': {
                                                    textDecoration: 'underline',
                                                    textDecorationStyle: 'dotted'
                                                }
                                            }}
                                        >
                                            {card.title}
                                        </Typography>
                                    </Tooltip>
                                    {card.trend && (
                                        <Box sx={{ ml: "auto" }}>
                                            {card.trend}
                                        </Box>
                                    )}
                                </Box>

                                <Typography
                                    variant="h5"
                                    sx={{
                                        fontWeight: "bold",
                                        color: `${card.color}.main`,
                                        mb: 0.5,
                                    }}
                                >
                                    {card.value}
                                </Typography>

                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: "text.secondary",
                                        fontSize: "0.75rem",
                                        display: "flex",
                                        alignItems: "center",
                                    }}
                                >
                                    {card.subtitle}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

        </Box>
    );
};

export default EmailCampaignSummary;
