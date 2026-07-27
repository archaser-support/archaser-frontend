"use client";

import { Box, Paper, Typography } from "@mui/material";
import React from "react";

export type CustomerHeaderNotificationBannerProps = {
    variant: "warning" | "error";
    icon: React.ReactNode;
    message: React.ReactNode;
    /** Optional trailing action (e.g. Add Contact button). */
    action?: React.ReactNode;
    borderRadius: string;
};

export default function CustomerHeaderNotificationBanner(
    props: CustomerHeaderNotificationBannerProps
) {
    const { variant, icon, message, action, borderRadius } = props;

    const background =
        variant === "warning"
            ? "linear-gradient(to right, #fff3e0, #ffe0b2)"
            : "linear-gradient(to right, #ffebee, #ffcdd2)";

    const borderColor = variant === "warning" ? "warning.main" : "error.main";

    return (
        <Box
            sx={{
                width: "100%",
                minWidth: 0,
                maxWidth: "100%",
                boxSizing: "border-box",
                overflow: "hidden",
            }}
        >
            <Paper
                elevation={0}
                sx={{
                    p: 0.75,
                    borderRadius,
                    background,
                    border: "1px solid",
                    borderColor,
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    mb: 0.5,
                    boxShadow: "none",
                    width: "100%",
                    minWidth: 0,
                    maxWidth: "100%",
                    boxSizing: "border-box",
                    overflow: "hidden",
                    position: "relative",
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 32,
                        height: 32,
                        borderRadius: "8px",
                        flexShrink: 0,
                    }}
                >
                    {icon}
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                        variant="body2"
                        sx={{
                            color: "text.primary",
                            fontWeight: 500,
                            lineHeight: 1.5,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }}
                    >
                        {message}
                    </Typography>
                </Box>

                {action}
            </Paper>
        </Box>
    );
}

