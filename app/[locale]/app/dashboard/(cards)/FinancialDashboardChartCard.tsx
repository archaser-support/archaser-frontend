"use client";

import { Box, Card, CardContent, Typography, useTheme } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import React from "react";
import { useTranslation } from "react-i18next";

import { CreditDashboardTitleInfoIcon } from "@/app/[locale]/app/credit-dashboard/creditDashboardTitleTooltip";
import type { MetricStatCardIconAccent } from "@/app/theme";

type FinancialDashboardChartCardProps = {
    icon: React.ReactNode;
    iconAccent?: MetricStatCardIconAccent;
    title: React.ReactNode;
    /**
     * Long help copy shown on the title info icon (credit-dashboard pattern).
     * Prefer this over a visible subtitle for chart descriptions.
     */
    titleTooltip?: React.ReactNode;
    children: React.ReactNode;
    /** Enables pointer cursor and `onClick` when set. */
    clickable?: boolean;
    onClick?: () => void;
    /** Lift + icon animation on hover (default true). Does not imply click. */
    hoverable?: boolean;
    minHeight?: number | string;
    cardContentSx?: SxProps<Theme>;
    bodySx?: SxProps<Theme>;
};

/** Chart/sidebar card shell aligned with Operation Dashboard (`creditDashboardChartCard`). */
export function FinancialDashboardChartCard({
    icon,
    iconAccent = "default",
    title,
    titleTooltip,
    children,
    clickable = false,
    onClick,
    hoverable = true,
    minHeight,
    cardContentSx,
    bodySx,
}: FinancialDashboardChartCardProps) {
    const theme = useTheme();
    const { t, i18n } = useTranslation(["dashboard", "common"]);
    const c = theme.creditDashboardChartCard;
    const isRtl = i18n.language === "he";

    return (
        <Card
            elevation={0}
            onClick={clickable && onClick ? onClick : undefined}
            sx={{
                ...c.card(theme, {
                    clickable: Boolean(clickable && onClick),
                    hoverable,
                }),
                height: "100%",
                ...(minHeight != null ? { minHeight } : {}),
            }}
        >
            <CardContent
                sx={{
                    ...c.cardContent(theme, { withChartBody: true }),
                    flex: 1,
                    minHeight: 0,
                    pb: 1,
                    direction: isRtl ? "rtl" : "ltr",
                    display: "flex",
                    flexDirection: "column",
                    ...cardContentSx,
                }}
            >
                <Box
                    className="card-icon"
                    aria-hidden
                    sx={c.headerIconLeading(theme, isRtl, iconAccent)}
                >
                    {icon}
                </Box>
                <Box sx={c.headerColumn(theme, isRtl)}>
                    {titleTooltip != null && titleTooltip !== "" ? (
                        <Box
                            sx={{
                                ...c.headerTitleRow(theme, isRtl),
                                mb: theme.spacing(1),
                            }}
                        >
                            <Typography
                                variant="body2"
                                component="span"
                                sx={{
                                    ...c.headerTitleInRow(theme, isRtl),
                                    ml: 0,
                                    mr: 0,
                                    mb: 0,
                                    minWidth: 0,
                                }}
                            >
                                {title}
                            </Typography>
                            <CreditDashboardTitleInfoIcon
                                isRtl={isRtl}
                                title={titleTooltip}
                                ariaLabel={t(
                                    "credit_insurance_dashboard.chart_title_help_aria",
                                    { ns: "dashboard" }
                                )}
                            />
                        </Box>
                    ) : (
                        <Typography
                            variant="body2"
                            component="span"
                            sx={{
                                ...c.headerTitle(theme, isRtl),
                                ml: 0,
                                mr: 0,
                                mb: theme.spacing(1),
                                display: "block",
                            }}
                        >
                            {title}
                        </Typography>
                    )}
                </Box>
                <Box
                    sx={{
                        flex: 1,
                        minHeight: 0,
                        pt: theme.spacing(1),
                        ...bodySx,
                    }}
                >
                    {children}
                </Box>
            </CardContent>
        </Card>
    );
}
