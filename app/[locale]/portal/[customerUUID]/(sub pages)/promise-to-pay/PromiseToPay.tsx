"use client";
import { apiFetch } from "@/utils/apiFetch";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useTranslation } from "react-i18next";

import { getPortalCardSx } from "@/app/theme/portalCard";
import { calculatePortalPromiseToPayDateRange } from "@/shared/services/promiseToPayService";
import { PortalUrls } from "@/utils/portalUrlUtils";

import { Alert, AlertTitle, Box, Button, Typography } from "@mui/material";
import {
    PORTAL_INVERSE_BUTTON_CLASS,
    PORTAL_OUTLINED_SECONDARY_CLASS,
} from "@/app/theme/portalButton";
import { alpha, useTheme } from "@mui/material/styles";

function hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
        : "107, 70, 193";
}

interface PromiseToPayProps {
    customerId: number;
    promise_to_pay: number;
    customerUUID: string;
    subDomain: string;
    collection?: {
        promise_to_pay_count: number;
        promise_to_pay_date: Date | null;
    } | null;
}

const PromiseToPayContainer: React.FC<PromiseToPayProps> = ({
    customerId,
    promise_to_pay,
    customerUUID,
    subDomain,
    collection,
}) => {
    const theme = useTheme();
    const [isLoading, setIsLoading] = useState(false);
    const { t, i18n } = useTranslation(["portal", "common"]);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const primaryColor = theme.palette.primary.main;
    const primaryRgb = hexToRgb(primaryColor);
    const datePickerStyles = useMemo(
        () => `
  .react-datepicker__day {
    color: ${primaryColor} !important;
    font-weight: 600 !important;
  }
  
  .react-datepicker__day:hover {
    background-color: ${primaryColor} !important;
    color: white !important;
  }
  
  .react-datepicker__day--selected {
    background-color: ${primaryColor} !important;
    color: white !important;
  }
  
  .react-datepicker__day--keyboard-selected {
    background-color: transparent !important;
    color: ${primaryColor} !important;
  }
  
  .react-datepicker__day--disabled {
    color: #CBD5E0 !important;
    background-color: transparent !important;
  }
  
  .react-datepicker__header {
    background-color: transparent !important;
    color: ${primaryColor} !important;
  }
  
  .react-datepicker__current-month {
    color: ${primaryColor} !important;
  }
  
  .react-datepicker__day-name {
    color: ${primaryColor} !important;
  }
  
  .react-datepicker__navigation {
    color: ${primaryColor} !important;
  }
  
  .react-datepicker__navigation:hover {
    background-color: rgba(${primaryRgb}, 0.1) !important;
  }
`,
        [primaryColor, primaryRgb]
    );
    const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    // Use shared utility function with actual collection data
    const dateRange = calculatePortalPromiseToPayDateRange(
        promise_to_pay,
        collection?.promise_to_pay_count ?? 0
    );

    // Ensure no date is pre-selected by explicitly setting to null on mount
    useEffect(() => {
        setSelectedDate(null);
    }, []);

    const handleSubmit = async () => {
        if (!selectedDate) return;

        setIsLoading(true);
        setError(null);

        // Format the date as YYYY-MM-DD to preserve the exact selected date
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
        const day = String(selectedDate.getDate()).padStart(2, "0");
        const formattedDate = `${year}-${month}-${day}`;

        try {
            // Get Captcha token
            const { getCaptchaToken } = await import("@/utils/captchaFrontendUtils");
            const captchaToken = await getCaptchaToken("promise_to_pay");

            const response = await apiFetch("/api/portal/update-promise-to-pay/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    customer_id: customerId,
                    promise_to_pay_date: formattedDate,
                    comment: "Promise to pay created via portal",
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    captchaToken,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || t("fields.promise_to_pay_submission_error")
                );
            }

            setIsSubmitSuccess(true);
        } catch (error) {
            console.error("Error updating promise to pay:", error);
            setError(
                error instanceof Error
                    ? error.message
                    : t("fields.promise_to_pay_submission_error")
            );
        } finally {
            setIsLoading(false);
        }
    };

    if (isSubmitSuccess) {
        return <ThankYouMessageContainer customerUUID={customerUUID} />;
    }

    return (
        <div
            style={{
                minHeight: "60vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
                width: "100%",
            }}
        >
            <style>{datePickerStyles}</style>
            <div
                style={{
                    width: "95%",
                    maxWidth: "600px",
                }}
            >
                {/* Error Message */}
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        <AlertTitle>
                            {t("messages.status_error", { ns: "portal" })}
                        </AlertTitle>
                        {error}
                    </Alert>
                )}

                {/* Date Selection Card */}
                <Box
                    sx={{
                        ...getPortalCardSx(theme),
                        p: 3,
                        width: "100%",
                    }}
                >
                    <p
                        style={{
                            marginBottom: "24px",
                            color: "#6B7280",
                            textAlign: "center",
                            lineHeight: 1.6,
                            fontSize: "14px",
                        }}
                    >
                        {t("fields.promise_to_pay_instruction_message", {
                            days: promise_to_pay,
                        })}
                    </p>

                    <div
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            marginBottom: "24px",
                            width: "100%",
                        }}
                    >
                        <DatePicker
                            selected={selectedDate}
                            onChange={(date) => setSelectedDate(date)}
                            minDate={dateRange.minDate}
                            maxDate={dateRange.maxDate}
                            inline
                            placeholderText={t(
                                "fields.promise_to_pay_select_payment_date"
                            )}
                            openToDate={dateRange.minDate}
                            highlightDates={[]}
                        />
                    </div>

                    {/* Action Buttons */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                            justifyContent: "center",
                        }}
                    >
                        <Button
                            onClick={() => {
                                const customerLanguage =
                                    i18n.language === "he"
                                        ? "Hebrew"
                                        : "English";
                                router.push(
                                    PortalUrls.home(
                                        customerUUID,
                                        customerLanguage
                                    )
                                );
                            }}
                            variant="outlined"
                            fullWidth
                            size="medium"
                            className={PORTAL_OUTLINED_SECONDARY_CLASS}
                        >
                            {t("fields.general_cancel")}
                        </Button>

                        <Button
                            onClick={handleSubmit}
                            disabled={!selectedDate || isLoading}
                            variant="contained"
                            fullWidth
                            size="medium"
                        >
                            {isLoading
                                ? t("fields.promise_to_pay_submitting")
                                : t("fields.promise_to_pay_submit")}
                        </Button>
                    </div>
                </Box>
            </div>
        </div>
    );
};

const ThankYouMessageContainer = ({
    customerUUID,
}: {
    customerUUID: string;
}) => {
    const { t, i18n } = useTranslation(["portal", "common"]);
    const router = useRouter();
    const theme = useTheme();

    return (
        <Box
            sx={{
                minHeight: "60vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
            }}
        >
            <Box
                sx={{
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                    color: theme.palette.primary.contrastText,
                    padding: "32px",
                    textAlign: "center",
                    boxShadow: `0 10px 25px ${alpha(theme.palette.primary.main, 0.3)}`,
                    borderRadius: "12px",
                    maxWidth: "500px",
                    width: "95%",
                }}
            >
                <Typography
                    component="h1"
                    sx={{
                        fontWeight: 700,
                        fontSize: "24px",
                        marginBottom: "16px",
                    }}
                >
                    {t("fields.promise_to_pay_success_title")}
                </Typography>

                <Typography
                    sx={{
                        opacity: 0.9,
                        fontSize: "16px",
                        marginBottom: "24px",
                        lineHeight: 1.6,
                    }}
                >
                    {t("fields.promise_to_pay_success_subtitle")}
                </Typography>

                <Button
                    onClick={() => {
                        const customerLanguage =
                            i18n.language === "he" ? "Hebrew" : "English";
                        router.push(
                            PortalUrls.home(customerUUID, customerLanguage)
                        );
                    }}
                    variant="contained"
                    className={PORTAL_INVERSE_BUTTON_CLASS}
                    sx={{
                        "&:hover": {
                            background: "rgba(255,255,255,0.98)",
                            color: theme.palette.primary.dark,
                        },
                    }}
                >
                    {t("fields.promise_to_pay_go_to_homepage")}
                </Button>
            </Box>
        </Box>
    );
};

export default PromiseToPayContainer;
