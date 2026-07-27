"use client";
import { apiFetch } from "@/utils/apiFetch";

import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { Box, Button, Typography } from "@mui/material";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

interface ErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
    // Use translations from common.json - error page is inside [locale] route
    // so TranslationsProvider is always available
    const { t, i18n } = useTranslation("common");

    // Get locale for RTL direction
    const locale = i18n.language || "en";

    useEffect(() => {
        // Report error to our error reporting system
        const reportError = async () => {
            try {
                const errorData = {
                    errorMessage: error.message,
                    errorStack: error.stack,
                    errorName: error.name,
                    page:
                        typeof window !== "undefined"
                            ? window.location.href
                            : "",
                    component: "Locale Layout",
                    userAgent:
                        typeof window !== "undefined"
                            ? window.navigator.userAgent
                            : "",
                    additionalContext: {
                        digest: error.digest,
                        isLocaleLayoutError: true,
                        componentStack: error.stack,
                    },
                };

                await apiFetch("/api/errors/report", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(errorData),
                }).catch((fetchError) => {
                    console.error("Failed to report error to API:", fetchError);
                });
            } catch (reportError) {
                console.error("Failed to report error:", reportError);
            }
        };

        reportError();
    }, [error]);

    const handleGoHome = () => {
        const pathLocale =
            typeof window !== "undefined"
                ? window.location.pathname.match(/^\/([a-z]{2})\//)?.[1] || "en"
                : "en";
        window.location.href = `/${pathLocale}/app/dashboard`;
    };

    // Render immediately with inline styles to prevent flash
    useEffect(() => {
        // Component mounted
    }, []);

    return (
        <Box
            component="div"
            data-error-boundary="locale-error"
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "100vh",
                padding: 3,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                overflow: "hidden",
                zIndex: 9999,
                // Prevent flash of unstyled content
                visibility: "visible",
                opacity: 1,
                "&::before": {
                    content: '""',
                    position: "absolute",
                    top: "-50%",
                    left: "-50%",
                    width: "200%",
                    height: "200%",
                    background:
                        "radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)",
                    backgroundSize: "50px 50px",
                    animation: "float 20s infinite linear",
                    opacity: 0.3,
                },
                "@keyframes float": {
                    "0%": {
                        transform: "translate(0, 0) rotate(0deg)",
                    },
                    "100%": {
                        transform: "translate(-50px, -50px) rotate(360deg)",
                    },
                },
            }}
        >
            <Box
                sx={{
                    background: "white",
                    borderRadius: 4,
                    padding: { xs: 3, sm: 4, md: 6 },
                    maxWidth: 600,
                    width: "100%",
                    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
                    textAlign: "center",
                    position: "relative",
                    zIndex: 1,
                    animation: "fadeInUp 0.5s ease-out",
                    "@keyframes fadeInUp": {
                        from: {
                            opacity: 0,
                            transform: "translateY(30px)",
                        },
                        to: {
                            opacity: 1,
                            transform: "translateY(0)",
                        },
                    },
                    direction: locale === "he" ? "rtl" : "ltr",
                }}
            >
                <ErrorOutlineIcon
                    sx={{
                        fontSize: { xs: 80, sm: 100, md: 120 },
                        color: "primary.main",
                        mb: 2,
                    }}
                />
                <Typography
                    variant="h4"
                    sx={{
                        fontWeight: 700,
                        mb: 2,
                        background:
                            "linear-gradient(135deg, #6B46C1 0%, #8B5CF6 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                        fontSize: { xs: "24px", sm: "28px", md: "32px" },
                    }}
                >
                    {t("messages.error_page_title")}
                </Typography>
                <Typography
                    variant="body1"
                    sx={{
                        color: "text.secondary",
                        mb: 3,
                        fontSize: { xs: "14px", sm: "16px", md: "18px" },
                        lineHeight: 1.6,
                    }}
                >
                    {t("messages.error_page_subtitle")}
                </Typography>
                <Box
                    sx={{
                        mb: 3,
                        p: 2,
                        borderRadius: 2,
                        background:
                            "linear-gradient(135deg, rgba(107, 70, 193, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)",
                        borderLeft: locale === "he" ? "none" : "4px solid",
                        borderRight: locale === "he" ? "4px solid" : "none",
                        borderColor: "primary.main",
                    }}
                >
                    <Typography
                        variant="body2"
                        sx={{
                            fontStyle: "italic",
                            color: "text.primary",
                            fontSize: { xs: "13px", sm: "14px", md: "16px" },
                        }}
                    >
                        "{t("messages.error_page_quote")}"
                    </Typography>
                </Box>
                <Box
                    sx={{
                        display: "flex",
                        gap: 2,
                        justifyContent: "center",
                        flexWrap: "wrap",
                    }}
                >
                    <Button variant="contained" onClick={reset}>
                        {t("actions.try_again")}
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={() => {
                            if (typeof window !== "undefined") {
                                window.location.reload();
                            }
                        }}
                    >
                        {t("actions.reload_page")}
                    </Button>
                    <Button variant="outlined" onClick={handleGoHome}>
                        {t("actions.go_home")}
                    </Button>
                </Box>
            </Box>
        </Box>
    );
}
