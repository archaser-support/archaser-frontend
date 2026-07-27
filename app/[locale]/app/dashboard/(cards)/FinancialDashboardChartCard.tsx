"use client";

import { Box, Card, CardContent, Typography, useTheme } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import React from "react";
import { useTranslation } from "react-i18next";

import type { MetricStatCardIconAccent } from "@/app/theme";

type FinancialDashboardChartCardProps = {
    icon: React.ReactNode;
    iconAccent?: MetricStatCardIconAccent;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
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
    subtitle,
    children,
    clickable = false,
    onClick,
    hoverable = true,
    minHeight,
    cardContentSx,
    bodySx,
}: FinancialDashboardChartCardProps) {
    const theme = useTheme();
    const { i18n } = useTranslation(["common"]);
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
                    <Typography
                        variant="body2"
                        component="span"
                        sx={{
                            ...c.headerTitle(theme, isRtl),
                            ml: 0,
                            mr: 0,
                            mb: subtitle ? theme.spacing(0.5) : theme.spacing(1),
                            display: "block",
                        }}
                    >
                        {title}
                    </Typography>
                    {subtitle ? (
                        <Typography
                            variant="body2"
                            sx={{
                                ...c.headerCaption(theme, isRtl),
                                display: "block",
                                whiteSpace: "pre-line",
                            }}
                        >
                            {subtitle}
                        </Typography>
                    ) : null}
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
