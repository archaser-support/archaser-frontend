"use client";

import NotificationsActiveOutlined from "@mui/icons-material/NotificationsActiveOutlined";
import {
    Alert,
    AlertTitle,
    Box,
    Button,
    Chip,
    Paper,
    Typography,
    useTheme,
} from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

import { CreditDashboardTitleInfoIcon } from "./creditDashboardTitleTooltip";

/** Scroll viewport for inline card: ~3 compact alert rows + gaps (px). */
const INLINE_ALERTS_LIST_MAX_HEIGHT_PX = 220;

const ALERT_SURFACE = {
    warning: {
        background: "#FFF4E5",
        border: "rgba(102, 60, 0, 0.28)",
        title: "#663C00",
        body: "rgba(102, 60, 0, 0.88)",
        icon: "#663C00",
    },
    error: {
        background: "#FDEDED",
        border: "rgba(95, 33, 32, 0.28)",
        title: "#5F2120",
        body: "rgba(95, 33, 32, 0.88)",
        icon: "#5F2120",
    },
    info: {
        background: "#E5F6FD",
        border: "rgba(1, 67, 97, 0.28)",
        title: "#014361",
        body: "rgba(1, 67, 97, 0.88)",
        icon: "#014361",
    },
} as const;

export type CreditCoverageAlertRow = {
    id: string;
    severity: keyof typeof ALERT_SURFACE;
    title: React.ReactNode;
    message: React.ReactNode;
    secondary?: string;
    reportHref: string;
};

export type CreditCoverageAlertsCardProps = {
    alerts: CreditCoverageAlertRow[];
    headerTitle: string;
    /** Localized tooltip for the header info icon */
    headerTooltip: string;
    headerSubtitle: string;
    badgeLabel: string;
    viewAllLabel: string;
    isRtl: boolean;
    onViewAllHref: string;
    onNavigateReport: (path: string) => void;
    /** When true, card fills parent height (e.g. beside trend chart); scroll area grows. */
    inline?: boolean;
};

export function CreditCoverageAlertsCard({
    alerts,
    headerTitle,
    headerTooltip,
    headerSubtitle,
    badgeLabel,
    viewAllLabel,
    isRtl,
    onViewAllHref,
    onNavigateReport,
    inline = false,
}: CreditCoverageAlertsCardProps) {
    const theme = useTheme();
    const { t } = useTranslation(["dashboard"]);
    const c = theme.creditDashboardChartCard;
    const isLight = theme.palette.mode === "light";
    const labelColor = isLight ? "#7C8DA1" : theme.palette.text.secondary;

    if (alerts.length === 0) {
        return null;
    }

    return (
        <Paper
            elevation={0}
            variant="outlined"
            sx={{
                width: "100%",
                borderRadius: theme.spacing(1.75),
                borderWidth: "0.5px",
                borderColor: "divider",
                boxShadow: "none",
                mb: inline ? 0 : 1.5,
                minHeight: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                ...(inline
                    ? {
                        width: "100%",
                        height: "100%",
                        flex: 1,
                    }
                    : null),
            }}
        >
            <Box
                sx={{
                    px: { xs: 1.25, sm: 1.5 },
                    pt: { xs: 1, sm: 1.25 },
                    pb: { xs: 0.75, sm: 1 },
                    direction: isRtl ? "rtl" : "ltr",
                    flexShrink: 0,
                }}
            >
                <Box
                    sx={{
                        display: "grid",
                        width: "100%",
                        minWidth: 0,
                        gridTemplateColumns: "minmax(0, 1fr) auto",
                        gridTemplateRows: "auto auto",
                        columnGap: theme.spacing(0.5),
                        rowGap: 0.25,
                        alignItems: "start",
                    }}
                >
                    <Box
                        sx={{
                            ...c.headerTitleRow(theme, isRtl),
                            gridColumn: 1,
                            gridRow: 1,
                            minWidth: 0,
                            alignSelf: "center",
                            pr: theme.spacing(0.5),
                        }}
                    >
                        <Typography
                            variant="h6"
                            component="span"
                            sx={{
                                ...c.headerTitleInRow(theme, isRtl),
                                fontSize: "1.25rem",
                                lineHeight: 1.3,
                                fontWeight: 700,
                                letterSpacing: "0.5px",
                                m: 0,
                                minWidth: 0,
                            }}
                        >
                            {headerTitle}
                        </Typography>
                        <CreditDashboardTitleInfoIcon
                            isRtl={isRtl}
                            title={headerTooltip}
                            ariaLabel={t(
                                "credit_insurance_dashboard.chart_title_help_aria",
                                { ns: "dashboard" }
                            )}
                        />
                    </Box>
                    <Typography
                        variant="caption"
                        sx={{
                            ...c.headerCaption(theme, isRtl),
                            gridColumn: 1,
                            gridRow: 2,
                            color: labelColor,
                            mb: 0,
                            display: "block",
                            minWidth: 0,
                            lineHeight: 1.2,
                            fontSize: "0.7rem",
                        }}
                    >
                        {headerSubtitle}
                    </Typography>
                    <Box
                        sx={{
                            gridColumn: 2,
                            gridRow: "1 / 3",
                            alignSelf: "start",
                            justifySelf: "end",
                        }}
                    >
                        <Chip
                            label={badgeLabel}
                            color="error"
                            size="small"
                            sx={{
                                fontWeight: 700,
                                flexShrink: 0,
                                borderRadius: 9999,
                                height: "auto",
                                minHeight: 22,
                                py: 0.25,
                                px: 0.25,
                                fontSize: "0.7rem",
                                "& .MuiChip-label": {
                                    px: 1,
                                    py: 0,
                                    lineHeight: 1.2,
                                },
                            }}
                        />
                    </Box>
                </Box>
            </Box>

            <Box
                sx={{
                    px: { xs: 1.25, sm: 1.5 },
                    pt: 1,
                    pb: 0.75,
                    maxHeight: inline
                        ? INLINE_ALERTS_LIST_MAX_HEIGHT_PX
                        : 200,
                    overflowY: "auto",
                    flex: "0 1 auto",
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: theme.spacing(1.25),
                }}
            >
                {alerts.map((row) => {
                    const palette = ALERT_SURFACE[row.severity];
                    const iconColor =
                        row.severity === "error"
                            ? theme.palette.error.main
                            : row.severity === "warning"
                                ? theme.palette.warning.main
                                : theme.palette.info.main;
                    return (
                        <Alert
                            key={row.id}
                            severity={row.severity}
                            variant="outlined"
                            sx={{
                                alignItems: "flex-start",
                                borderRadius: theme.spacing(1.75),
                                borderWidth: "0.5px",
                                py: theme.spacing(1),
                                px: theme.spacing(1.25),
                                pr: theme.spacing(1.25),
                                backgroundColor: palette.background,
                                borderColor: palette.border,
                                color: palette.title,
                                "& .MuiAlert-icon": {
                                    color: `${iconColor} !important`,
                                    py: 0,
                                    mr: theme.spacing(1.25),
                                    alignItems: "flex-start",
                                    opacity: 1,
                                    "& .MuiSvgIcon-root": {
                                        fontSize: "1.35rem",
                                    },
                                },
                                "& .MuiAlert-message": { width: "100%", py: 0 },
                                "&:hover": {
                                    boxShadow: 1,
                                },
                                transition: (theme) =>
                                    theme.transitions.create(["box-shadow"], {
                                        duration: theme.transitions.duration.short,
                                    }),
                            }}
                        >
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <AlertTitle
                                    sx={{
                                        mb: theme.spacing(1),
                                        fontWeight: 700,
                                        fontSize: "0.8125rem",
                                        lineHeight: 1.25,
                                        color: palette.title,
                                    }}
                                >
                                    {row.title}
                                </AlertTitle>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        fontWeight: 500,
                                        lineHeight: 1.3,
                                        fontSize: "0.75rem",
                                        color: palette.body,
                                    }}
                                >
                                    {row.message}
                                </Typography>
                                {row.secondary ? (
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            display: "block",
                                            mt: 0.125,
                                            color: "text.secondary",
                                            fontSize: "0.65rem",
                                            lineHeight: 1.25,
                                        }}
                                    >
                                        {row.secondary}
                                    </Typography>
                                ) : null}
                            </Box>
                        </Alert>
                    );
                })}
            </Box>

            {inline ? (
                <Box
                    aria-hidden
                    sx={{ flex: 1, minHeight: 0, minWidth: 0 }}
                />
            ) : null}

            <Box
                sx={{
                    px: { xs: 1.25, sm: 1.5 },
                    py: 0.75,
                    flexShrink: 0,
                }}
            >
                <Button
                    fullWidth
                    variant="text"
                    color="inherit"
                    size="small"
                    startIcon={<NotificationsActiveOutlined />}
                    onClick={() => onNavigateReport(onViewAllHref)}
                    sx={{
                        justifyContent: "center",
                        fontWeight: 600,
                        py: 0.5,
                        fontSize: "0.8rem",
                        "& .MuiButton-startIcon": { mr: 0.75 },
                        "&:hover": { backgroundColor: "action.selected" },
                    }}
                >
                    {viewAllLabel}
                </Button>
            </Box>
        </Paper>
    );
}
