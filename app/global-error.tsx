"use client";
import { apiFetch } from "@/utils/apiFetch";

import { Box, Button } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import theme from "@/app/theme";

interface GlobalErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

// Fallback translations in case i18n provider is not available
// global-error.tsx is at the root level and might not have access to TranslationsProvider
const fallbackTranslations: Record<string, Record<string, string>> = {
    en: {
        "messages.error_page_title": "Oops! Something Went Off the Books",
        "messages.error_page_subtitle":
            "Something unexpected happened while we were trying to show you this page. Don't worry, our team has been notified and we're working to resolve it!",
        "messages.error_page_quote":
            "Even the best collection strategies need a moment to recalibrate. We're collecting this error too, and we'll have it resolved faster than you can say 'accounts receivable'!",
        "actions.try_again": "Try Again",
        "actions.go_home": "Go Home",
    },
    he: {
        "messages.error_page_title": "אופס! משהו השתבש בספרים",
        "messages.error_page_subtitle":
            "משהו בלתי צפוי קרה בזמן שניסינו להציג לך את הדף הזה. אל דאגה, הצוות שלנו קיבל הודעה ואנחנו עובדים על פתרון!",
        "messages.error_page_quote":
            "אפילו אסטרטגיות הגבייה הטובות ביותר צריכות רגע להתאמה מחדש. אנחנו אוספים גם את השגיאה הזו, ונפתור אותה מהר יותר ממה שאתה יכול לומר 'חשבונות לקבל'!",
        "actions.try_again": "נסה שוב",
        "actions.go_home": "עבור לדף הבית",
    },
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
    // Extract locale from URL pathname
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

    const [locale, setLocale] = useState(getInitialLocale);

    // Try to use i18n if available (global-error might be outside TranslationsProvider)
    let i18nT: ((key: string) => string) | null = null;
    let i18nInstance: any = null;

    try {
        const translation = useTranslation("common");
        i18nT = translation.t;
        i18nInstance = translation.i18n;
    } catch {
        // i18n not available, will use fallback
    }

    useEffect(() => {
        if (i18nInstance?.language) {
            setLocale(i18nInstance.language);
        } else if (typeof window !== "undefined") {
            const pathLocale =
                window.location.pathname.match(/^\/([a-z]{2})\//)?.[1];
            if (pathLocale && (pathLocale === "en" || pathLocale === "he")) {
                setLocale(pathLocale);
            }
        }
    }, [i18nInstance]);

    // Create translation function that prioritizes common.json, falls back to hardcoded
    const t = (key: string) => {
        // First, try to get translation from common.json via i18n
        if (i18nT) {
            const i18nResult = i18nT(key);
            if (i18nResult && i18nResult !== key) {
                return i18nResult;
            }
        }
        // Fallback to hardcoded translations if i18n fails
        return (
            fallbackTranslations[locale]?.[key] ||
            fallbackTranslations.en[key] ||
            key
        );
    };
    useEffect(() => {
        // Report Server Components error to our error reporting system
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
                    component: "Server Component",
                    userAgent:
                        typeof window !== "undefined"
                            ? window.navigator.userAgent
                            : "",
                    additionalContext: {
                        digest: error.digest,
                        isServerComponentError: true,
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

    return (
        <html lang={locale}>
            <head>
                <style>{`
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    html, body {
                        margin: 0;
                        padding: 0;
                        width: 100%;
                        height: 100%;
                    }
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
                        background-attachment: fixed;
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 20px;
                        overflow-x: hidden;
                    }
                    .error-container {
                        background: white;
                        border-radius: 24px;
                        padding: 48px;
                        max-width: 600px;
                        width: 100%;
                        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                        text-align: center;
                        animation: fadeIn 0.5s ease-in;
                    }
                    @keyframes fadeIn {
                        from {
                            opacity: 0;
                            transform: translateY(20px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                    .error-title {
                        font-size: 32px;
                        font-weight: 700;
                        color: #2D3748;
                        margin-bottom: 16px;
                        background: linear-gradient(135deg, #6B46C1 0%, #8B5CF6 100%);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        background-clip: text;
                    }
                    .error-subtitle {
                        font-size: 18px;
                        color: #718096;
                        margin-bottom: 32px;
                        line-height: 1.6;
                    }
                    .error-funny {
                        font-size: 16px;
                        color: #4A5568;
                        margin-bottom: 32px;
                        font-style: italic;
                        padding: 16px;
                        background: linear-gradient(135deg, rgba(107, 70, 193, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%);
                        border-radius: 12px;
                        border-left: 4px solid #6B46C1;
                    }
                    .error-actions {
                        display: flex;
                        gap: 12px;
                        justify-content: center;
                        flex-wrap: wrap;
                    }
                `}</style>
            </head>
            <body>
                <ThemeProvider theme={theme}>
                    <div
                        className="error-container"
                        dir={locale === "he" ? "rtl" : "ltr"}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#6B46C1"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{
                                width: "120px",
                                height: "120px",
                                marginBottom: "24px",
                            }}
                            aria-hidden="true"
                        >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <circle cx="12" cy="16" r="1.5" fill="#6B46C1" stroke="none" />
                        </svg>
                        <h1 className="error-title">
                            {t("messages.error_page_title")}
                        </h1>
                        <p className="error-subtitle">
                            {t("messages.error_page_subtitle")}
                        </p>
                        <div className="error-funny">
                            "{t("messages.error_page_quote")}"
                        </div>
                        <Box className="error-actions">
                            <Button variant="contained" onClick={reset}>
                                {t("actions.try_again")}
                            </Button>
                            <Button
                                variant="outlined"
                                onClick={() => {
                                    const pathLocale =
                                        typeof window !== "undefined"
                                            ? window.location.pathname.match(
                                                  /^\/([a-z]{2})\//
                                              )?.[1] || "en"
                                            : "en";
                                    window.location.href = `/${pathLocale}/app/dashboard`;
                                }}
                            >
                                {t("actions.go_home")}
                            </Button>
                        </Box>
                    </div>
                </ThemeProvider>
            </body>
        </html>
    );
}
