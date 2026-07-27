"use client";

import { Box, Typography } from "@mui/material";
import { ReactNode, useEffect } from "react";
import { useTranslation } from "react-i18next";

interface PortalPageLayoutProps {
    title?: string;
    subtitle?: string;
    children: ReactNode;
    maxWidth?: string;
}

export default function PortalPageLayout({
    title,
    subtitle,
    children,
    maxWidth = "1024px",
}: PortalPageLayoutProps) {
    const { i18n } = useTranslation(["invoices", "portal", "common"]);
    const isRTL = i18n.language === "he";
    const direction = isRTL ? "rtl" : "ltr";

    useEffect(() => {
        const trimmedTitle = title?.trim();
        if (!trimmedTitle) {
            return;
        }

        document.title = `${trimmedTitle} | ARchaser`;
    }, [title]);

    return (
        <Box
            sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-start",
                padding: { xs: "16px", sm: "24px" },
                width: "100%",
                direction: direction,
            }}
        >
            <Box
                sx={{
                    width: "100%",
                    maxWidth: maxWidth,
                    display: "flex",
                    flexDirection: "column",
                    direction: direction,
                }}
            >
                {/* Standardized Page Title Section */}
                {(title || subtitle) && (
                    <Box
                        sx={{
                            textAlign: "center",
                            marginBottom: { xs: "24px", sm: "32px" },
                            width: "100%",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "8px",
                            direction: direction,
                        }}
                    >
                        {title && (
                            <Typography
                                variant="portalPageTitle"
                                sx={(theme) => ({
                                    fontSize: {
                                        xs: "1.5rem",
                                        sm: "2rem",
                                        md: "2.25rem",
                                    },
                                    marginBottom: subtitle ? "8px" : "0",
                                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                                    backgroundClip: "text",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                    fontWeight: 700,
                                    textShadow: `0 2px 4px ${theme.palette.primary.main}1a`,
                                    direction: direction,
                                    textAlign: "center",
                                })}
                            >
                                {title}
                            </Typography>
                        )}
                        {subtitle && (
                            <Typography
                                variant="portalPageSubtitle"
                                sx={{
                                    fontSize: {
                                        xs: "1rem",
                                        sm: "1.125rem",
                                        md: "1.25rem",
                                    },
                                    marginBottom: "0",
                                    direction: direction,
                                    textAlign: "center",
                                }}
                            >
                                {subtitle}
                            </Typography>
                        )}
                    </Box>
                )}

                {/* Page Content */}
                <Box
                    sx={{
                        width: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "stretch",
                        direction: direction,
                    }}
                >
                    {children}
                </Box>
            </Box>
        </Box>
    );
}
