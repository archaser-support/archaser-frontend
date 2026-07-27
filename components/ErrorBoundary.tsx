"use client";
import { apiFetch } from "@/utils/apiFetch";

import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { Box, Button, Typography } from "@mui/material";
import {
    Component,
    ErrorInfo,
    ReactNode,
} from "react";
import { useTranslation } from "react-i18next";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}


// Functional component for error display that can use hooks
function ErrorDisplay({
    onReset,
    onReload,
}: {
    onReset: () => void;
    onReload: () => void;
}) {
    // Use translations from common.json - ErrorBoundary is now inside TranslationsProvider
    // so i18n is always available
    const { t } = useTranslation("common");

    // Render immediately with inline styles to prevent flash
    return (
        <Box
            component="div"
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
                        borderLeft: "4px solid",
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
                    <Button variant="contained" onClick={onReset}>
                        {t("actions.try_again")}
                    </Button>
                    <Button variant="outlined" onClick={onReload}>
                        {t("actions.reload_page")}
                    </Button>
                </Box>
            </Box>
        </Box>
    );
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return {
            hasError: true,
            error,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log error details
        console.error("ErrorBoundary caught an error:", error, errorInfo);

        this.setState({
            error,
            errorInfo,
        });

        // Call custom error handler if provided
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }

        // Report error to backend
        this.reportError(error, errorInfo);
    }

    private async reportError(error: Error, errorInfo: ErrorInfo) {
        try {
            // Get current page URL
            const page =
                typeof window !== "undefined" ? window.location.href : "";

            // Get component stack
            const componentStack = errorInfo.componentStack || "";

            // Extract component name from component stack if possible
            const componentMatch = componentStack.match(/^\s*in\s+(\w+)/);
            const component = componentMatch ? componentMatch[1] : "Unknown";

            // Prepare error data
            const errorData = {
                errorMessage: error.message,
                errorStack: error.stack || "",
                errorName: error.name,
                errorDigest: (error as any)?.digest,
                page,
                component,
                componentStack,
                referrer:
                    typeof window !== "undefined"
                        ? document.referrer || undefined
                        : undefined,
                userAgent:
                    typeof window !== "undefined"
                        ? window.navigator.userAgent
                        : "",
                browserInfo: this.getBrowserInfo(),
                screenResolution:
                    typeof window !== "undefined"
                        ? `${window.screen.width}x${window.screen.height}`
                        : undefined,
                viewportSize:
                    typeof window !== "undefined"
                        ? `${window.innerWidth}x${window.innerHeight}`
                        : undefined,
                additionalContext: {
                    errorInfo: errorInfo.toString(),
                },
            };

            // Send to API endpoint
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
    }

    private getBrowserInfo(): string {
        if (typeof window === "undefined") {
            return "Server-side";
        }

        const nav = window.navigator;
        const info = [
            `Browser: ${this.getBrowserName()}`,
            `Version: ${nav.appVersion}`,
            `Platform: ${nav.platform}`,
            `Language: ${nav.language}`,
            `Screen: ${window.screen.width}x${window.screen.height}`,
        ];

        return info.join(", ");
    }

    private getBrowserName(): string {
        if (typeof window === "undefined") {
            return "Unknown";
        }

        const userAgent = window.navigator.userAgent;
        if (userAgent.indexOf("Chrome") > -1) return "Chrome";
        if (userAgent.indexOf("Firefox") > -1) return "Firefox";
        if (userAgent.indexOf("Safari") > -1) return "Safari";
        if (userAgent.indexOf("Edge") > -1) return "Edge";
        if (userAgent.indexOf("Opera") > -1) return "Opera";
        return "Unknown";
    }

    private handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    private handleReload = () => {
        if (typeof window !== "undefined") {
            window.location.reload();
        }
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <ErrorDisplay
                    onReset={this.handleReset}
                    onReload={this.handleReload}
                />
            );
        }

        return this.props.children;
    }
}
