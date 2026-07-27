"use client";

import { Box, Button, Paper, Typography, useTheme } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

interface PageHeaderProps {
    title: string | React.ReactNode;
    description?: string;
    children?: React.ReactNode;
    sticky?: boolean; // New prop to enable/disable sticky behavior
    stickyTop?: number; // Optional top offset (useful if there's a top nav bar)
    /** Omit horizontal padding so title aligns with sibling content columns */
    flushHorizontal?: boolean;
    /** Pill back button (e.g. drill-down detail pages) */
    onBack?: () => void;
    backLabel?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
    title,
    description,
    children,
    sticky = true, // Default to sticky for all pages
    stickyTop = 0, // Default to 0, can be adjusted if needed
    flushHorizontal = false,
    onBack,
    backLabel,
}) => {
    const theme = useTheme();
    const { t, i18n } = useTranslation(["common"]);

    return (
        <Paper
            sx={{
                p: flushHorizontal
                    ? `${theme.spacing(2)} 0`
                    : theme.spacing(2),
                mb: theme.spacing(2),
                bgcolor: "transparent",
                backgroundImage: "none",
                borderRadius: theme.shape.borderRadius,
                position: sticky ? "sticky" : "relative",
                top: sticky ? stickyTop : "auto",
                zIndex: sticky ? 10 : "auto",
                boxShadow: "none",
                animation: "slideUpHeader 0.6s ease-out forwards",
                opacity: 0,
                transform: `translateY(${theme.spacing(2.5)})`,
                "@keyframes slideUpHeader": {
                    "0%": {
                        opacity: 0,
                        transform: `translateY(${theme.spacing(2.5)})`,
                    },
                    "100%": {
                        opacity: 1,
                        transform: "translateY(0)",
                    },
                },
            }}
            elevation={0}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: { xs: "flex-start", sm: "center" },
                    flexDirection: { xs: "column", sm: "row" },
                    gap: theme.spacing(1.5),
                    direction: i18n.language === "he" ? "rtl" : "ltr",
                }}
            >
                    {onBack ? (
                        <Button
                            variant="contained"
                            size="small"
                            className="save-button"
                            onClick={onBack}
                            sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", sm: "center" } }}
                        >
                            {backLabel ?? t("actions.back", { ns: "common" })}
                        </Button>
                    ) : null}
                    <Box
                        sx={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            minWidth: 0,
                        }}
                    >
                        {typeof title === "string" ? (
                            <Typography
                                variant={
                                    i18n.language === "he"
                                        ? "hebrewTitle"
                                        : "listPageHeaderTitle"
                                }
                                sx={{
                                    color: theme.palette.text.primary,
                                    mb: description ? "2px" : 0,
                                    ...(i18n.language !== "he" && {
                                        textAlign: "left",
                                        direction: "ltr",
                                    }),
                                }}
                            >
                                {title}
                            </Typography>
                        ) : (
                            title
                        )}

                        {description && (
                            <Typography
                                variant={
                                    i18n.language === "he"
                                        ? "hebrewSubtitle"
                                        : "listPageHeaderDescription"
                                }
                                sx={{
                                    color: theme.palette.text.secondary,
                                    ...(i18n.language !== "he" && {
                                        textAlign: "left",
                                        direction: "ltr",
                                    }),
                                }}
                            >
                                {description}
                            </Typography>
                        )}
                    </Box>
                    {children}
            </Box>
        </Paper>
    );
};

export default PageHeader;
