"use client";

import { createLogRecord } from "@/shared/utility/LogCreator";
import { useAppHomePath } from "@/hooks/useAppHomePath";
import { Box, Button, Typography } from "@mui/material";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface AccessDeniedProps {
    title?: string;
    description?: string;
    errorCode?:
    | "ACCESS_DENIED_OWNER"
    | "ACCESS_DENIED_BUSINESS_UNIT"
    | "ACCESS_DENIED_ACCOUNT"
    | string;
    onBack?: () => void;
    backUrl?: string;
    backLabel?: string;
}

// Fallback translations in case i18n provider is not available
const fallbackTranslations: Record<string, Record<string, string>> = {
    en: {
        "messages.access_denied_title": "Access Denied",
        "messages.access_denied_subtitle":
            "You don't have permission to view this resource.",
        "messages.access_denied_quote":
            "Even the best collection strategies need proper authorization. This resource is locked away in a secure vault, and only those with the right keys can access it!",
        "messages.access_denied_owner":
            "This resource is assigned to another agent.",
        "messages.access_denied_business_unit":
            "This resource belongs to a different business unit.",
        "messages.access_denied_account":
            "This resource belongs to a different account.",
        "messages.contact_admin":
            "Please contact your administrator if you believe this is an error.",
        "actions.go_back": "Go Back",
        "actions.go_home": "Go Home",
    },
    he: {
        "messages.access_denied_title": "גישה נדחתה",
        "messages.access_denied_subtitle": "אין לך הרשאה לצפות במשאב זה.",
        "messages.access_denied_quote":
            "אפילו אסטרטגיות הגבייה הטובות ביותר צריכות הרשאה מתאימה. המשאב הזה נעול בכספת מאובטחת, ורק למי שיש את המפתחות הנכונים יש גישה אליו!",
        "messages.access_denied_owner": "משאב זה מוקצה לסוכן אחר.",
        "messages.access_denied_business_unit":
            "משאב זה שייך ליחידה עסקית אחרת.",
        "messages.access_denied_account": "משאב זה שייך לחשבון אחר.",
        "messages.contact_admin":
            "אנא פנה למנהל המערכת שלך אם אתה מאמין שזו שגיאה.",
        "actions.go_back": "חזור",
        "actions.go_home": "עבור לדף הבית",
    },
};

export default function AccessDenied({
    title,
    description,
    errorCode,
    onBack,
    backUrl,
    backLabel,
}: AccessDeniedProps) {
    const router = useRouter();
    const { data: session } = useSession();
    const pathname = usePathname();
    const { homePath, isLoading: isHomePathLoading } = useAppHomePath();
    const [hasLogged, setHasLogged] = useState(false);

    // Initialize locale synchronously from URL to avoid flash
    const getInitialLocale = () => {
        if (typeof window !== "undefined") {
            const pathLocale =
                window.location.pathname.match(/^\/([a-z]{2})\//)?.[1];
            if (pathLocale && (pathLocale === "en" || pathLocale === "he")) {
                return pathLocale;
            }
        }
        return "en";
    };

    const [currentLocale, setCurrentLocale] = useState(getInitialLocale);

    // Try to use i18n if available
    let i18nT: ((key: string, options?: any) => string) | null = null;
    let i18nInstance: any = null;

    try {
        const translation = useTranslation(["common", "auth"]);
        i18nT = translation.t;
        i18nInstance = translation.i18n;
    } catch {
        // i18n not available, will use fallback
    }

    useEffect(() => {
        if (i18nInstance?.language) {
            setCurrentLocale(i18nInstance.language);
        }
    }, [i18nInstance]);

    // Create translation function with fallback
    const t = (key: string, options?: any) => {
        if (i18nT) {
            const translated = i18nT(key, options);
            if (translated !== key) {
                return translated;
            }
        }
        return (
            fallbackTranslations[currentLocale]?.[key] ||
            fallbackTranslations.en[key] ||
            key
        );
    };

    // Determine title and description
    const displayTitle = title || t("messages.access_denied_title");
    let displayDescription = description;

    if (!displayDescription) {
        if (errorCode === "ACCESS_DENIED_OWNER") {
            displayDescription = t("messages.access_denied_owner", {
                ns: "auth",
            });
        } else if (errorCode === "ACCESS_DENIED_BUSINESS_UNIT") {
            displayDescription = t("messages.access_denied_business_unit", {
                ns: "auth",
            });
        } else if (errorCode === "ACCESS_DENIED_ACCOUNT") {
            displayDescription = t("messages.access_denied_account", {
                ns: "auth",
            });
        } else {
            displayDescription = t("messages.access_denied_subtitle");
        }
    }

    // Log access denied event to MongoDB
    useEffect(() => {
        if (hasLogged) return; // Prevent duplicate logs

        const logAccessDenied = async () => {
            try {
                const logDetails: any = {
                    errorCode: errorCode || "ACCESS_DENIED",
                    page:
                        typeof window !== "undefined"
                            ? window.location.href
                            : pathname || "unknown",
                    pathname: pathname || "unknown",
                    userAgent:
                        typeof window !== "undefined"
                            ? window.navigator.userAgent
                            : undefined,
                    referrer:
                        typeof window !== "undefined"
                            ? document.referrer
                            : undefined,
                    title: displayTitle,
                    description: displayDescription,
                    timestamp: new Date().toISOString(),
                };

                // Add user information if available
                if (session?.user) {
                    logDetails.userId = session.user.id;
                    logDetails.accountId = session.user.account_id;
                    logDetails.userEmail = session.user.email;
                    logDetails.userRole = session.user.role;
                }

                await createLogRecord(
                    "WARNING", // LogLevel.WARNING
                    `Access denied: User attempted to access restricted resource`,
                    "AccessControl",
                    logDetails
                );

                setHasLogged(true);
            } catch (error) {
                // Silently fail - logging shouldn't break the UI
                console.error("Failed to log access denied event:", error);
            }
        };

        logAccessDenied();
    }, [
        hasLogged,
        errorCode,
        pathname,
        session,
        displayTitle,
        displayDescription,
    ]);

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else if (backUrl) {
            router.push(backUrl);
        } else {
            router.back();
        }
    };

    const handleGoHome = () => {
        if (!homePath) {
            return;
        }
        const pathLocale =
            typeof window !== "undefined"
                ? window.location.pathname.match(/^\/([a-z]{2})\//)?.[1] || "en"
                : "en";
        router.push(`/${pathLocale}${homePath}`);
    };

    return (
        <Box
            component="div"
            data-access-denied="true"
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
                    direction: currentLocale === "he" ? "rtl" : "ltr",
                }}
            >
                <Box
                    sx={{
                        mb: 2,
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                    }}
                >
                    <Image
                        src="/assets/images/brand-logos/customer_not_found.png"
                        alt="Customer not found"
                        width={200}
                        height={200}
                        style={{
                            maxWidth: "100%",
                            height: "auto",
                        }}
                    />
                </Box>
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
                    {displayTitle}
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
                    {displayDescription}
                </Typography>
                <Box
                    sx={{
                        mb: 3,
                        p: 2,
                        borderRadius: 2,
                        background:
                            "linear-gradient(135deg, rgba(107, 70, 193, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)",
                        borderLeft:
                            currentLocale === "he" ? "none" : "4px solid",
                        borderRight:
                            currentLocale === "he" ? "4px solid" : "none",
                        borderColor: "primary.main",
                    }}
                >
                    <Typography
                        variant="body2"
                        sx={{
                            fontStyle: "italic",
                            color: "text.primary",
                            fontSize: { xs: "13px", sm: "14px", md: "16px" },
                            mb: 1,
                        }}
                    >
                        "{t("messages.access_denied_quote")}"
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{
                            color: "text.secondary",
                            fontSize: { xs: "12px", sm: "13px", md: "14px" },
                            mt: 1,
                        }}
                    >
                        {t("messages.contact_admin", { ns: "auth" })}
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
                    <Button variant="contained" onClick={handleBack}>
                        {backLabel || t("actions.go_back")}
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={handleGoHome}
                        disabled={isHomePathLoading || !homePath}
                    >
                        {t("actions.go_home")}
                    </Button>
                </Box>
            </Box>
        </Box>
    );
}
