"use client";
import { apiFetch } from "@/utils/apiFetch";

import {
    Box,
    Button,
    Card,
    CardContent,
    Grid,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import {
    PORTAL_NEUTRAL_OUTLINED_CLASS,
} from "@/app/theme/portalButton";
import { getPortalCardSx, PORTAL_CARD_CLASS } from "@/app/theme/portalCard";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import AppUrls from "@/utils/appUrls";
import { PortalUrls } from "@/utils/portalUrlUtils";

interface WrongContactContainerProps {
    customerId: string;
    customerUUID: string;
}

interface WrongContactFormData {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    notes: string;
}

interface FormErrors {
    first_name?: string;
    last_name?: string;
    email?: string;
    notes?: string;
}

type FormType = "wrongContact" | "notRightContact";

const DISPUTE_REASONS = {
    wrongContact: "Not the right contact person in the company",
    notRightContact: "I am not working there anymore",
} as const;

export default function WrongContactContainer({
    customerId,
    customerUUID,
}: WrongContactContainerProps) {
    const { t, i18n } = useTranslation(["portal", "common", "contacts"]);
    const { showToast } = useToast();
    const theme = useTheme();
    const [activeForm, setActiveForm] = useState<FormType | null>(null);

    // Check if current language is Hebrew for RTL support
    const isRTL = i18n.language === "he";
    const direction = isRTL ? "rtl" : "ltr";
    const textAlign = isRTL ? "right" : "left";
    const [formData, setFormData] = useState<WrongContactFormData>({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        notes: "",
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [confirmation, setConfirmation] = useState<FormType | null>(null);
    const [errors, setErrors] = useState<FormErrors>({});
    const router = useRouter();

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};

        if (!formData.first_name.trim()) {
            newErrors.first_name = t("validation.required", { ns: "common" });
        }

        if (!formData.last_name.trim()) {
            newErrors.last_name = t("validation.required", { ns: "common" });
        }

        if (!formData.email.trim()) {
            newErrors.email = t("validation.required", { ns: "common" });
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = t("validation.invalid_email_format", {
                ns: "contacts",
            });
        }

        if (!formData.notes.trim()) {
            newErrors.notes = t("validation.required", { ns: "common" });
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent, formType: FormType) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);

        try {
            const payload: any = {
                customer_id: customerId,
                dispute_type: "contact",
                contact_first_name: formData.first_name,
                contact_last_name: formData.last_name,
                contact_email: formData.email,
                contact_comment: formData.notes,
            };

            // Only include phone for wrongContact form
            if (formType === "wrongContact") {
                payload.contact_mobile = formData.phone;
            }

            // Get Captcha token
            const { getCaptchaToken } = await import("@/utils/captchaFrontendUtils");
            const captchaToken = await getCaptchaToken("report_wrong_contact");

            payload.captchaToken = captchaToken;

            const response = await apiFetch("/api/portal/create-dispute", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({
                    error: "Failed to submit wrong contact report",
                }));
                throw new Error(
                    errorData.error || "Failed to submit wrong contact report"
                );
            }

            showToast(
                t("messages.contact_wrong_contact_report_submitted"),
                "success"
            );
            setActiveForm(null);
            setConfirmation(formType);
        } catch (error: any) {
            console.error("Error submitting wrong contact report:", error);

            // Map API error messages to translation keys
            let errorMessage = t("messages.failed_to_submit_wrong_contact");
            const apiErrorMessage = error.message || "";

            if (apiErrorMessage.includes("No active collection period")) {
                errorMessage = t("messages.no_active_collection_period");
            } else if (apiErrorMessage.includes("Failed to create dispute")) {
                errorMessage = t("messages.failed_to_create_dispute");
            } else if (apiErrorMessage.includes("Missing required fields")) {
                errorMessage = t("messages.missing_required_fields");
            } else if (apiErrorMessage.includes("Customer not found")) {
                errorMessage = t("messages.customer_not_found_error");
            }

            showToast(errorMessage, "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            first_name: "",
            last_name: "",
            email: "",
            phone: "",
            notes: "",
        });
        setErrors({});
        setActiveForm(null);
        setConfirmation(null);
    };

    const handleInputChange = (
        field: keyof WrongContactFormData,
        value: string
    ) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        // Clear error when user starts typing
        setErrors((prev) => {
            if (prev[field as keyof FormErrors]) {
                return { ...prev, [field]: undefined };
            }
            return prev;
        });
    };

    // Confirmation component with improved design
    const ConfirmationMessage = () => (
        <Box
            sx={{
                width: "100%",
                maxWidth: 700,
                mx: "auto",
                direction: direction,
            }}
        >
            {/* Main Content Card */}
            <Card
                className={PORTAL_CARD_CLASS}
                elevation={0}
                sx={{
                    ...getPortalCardSx(theme),
                    overflow: "hidden",
                    position: "relative",
                }}
            >
                <CardContent
                    sx={{
                        p: theme.spacing(4, 6),
                        direction: direction,
                        textAlign: textAlign,
                    }}
                >
                    {/* Success Title */}
                    <Typography
                        variant="h4"
                        sx={{
                            mb: theme.spacing(3),
                            color: theme.palette.text.primary,
                            fontWeight: 700,
                            textAlign: textAlign,
                        }}
                    >
                        {t("messages.contact_wrong_contact_report_submitted")}
                    </Typography>

                    {/* What Happens Next Section */}
                    <Box
                        sx={{
                            backgroundColor: theme.palette.action.hover,
                            borderRadius: theme.portalCard.borderRadius(theme),
                            p: theme.spacing(3),
                            mb: theme.spacing(4),
                            border: theme.portalCard.border(theme),
                            direction: direction,
                        }}
                    >
                        <Typography
                            variant="h6"
                            sx={{
                                mb: theme.spacing(2),
                                color: theme.palette.text.primary,
                                fontWeight: 600,
                                textAlign: textAlign,
                                direction: direction,
                            }}
                        >
                            {t("messages.contact_what_happens_next")}
                        </Typography>
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: theme.spacing(2),
                                alignItems: "flex-start",
                                direction: direction,
                            }}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: theme.spacing(2),
                                    flexDirection: "row",
                                    direction: direction,
                                    width: "100%",
                                    justifyContent: "flex-start",
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: "50%",
                                        backgroundColor:
                                            theme.palette.primary.main,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: theme.palette.primary
                                            .contrastText,
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                        flexShrink: 0,
                                    }}
                                >
                                    1
                                </Box>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{
                                        textAlign: textAlign,
                                        direction: direction,
                                        flex: 1,
                                    }}
                                >
                                    {t("messages.contact_step_review_report")}
                                </Typography>
                            </Box>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: theme.spacing(2),
                                    flexDirection: "row",
                                    direction: direction,
                                    width: "100%",
                                    justifyContent: "flex-start",
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: "50%",
                                        backgroundColor:
                                            theme.palette.primary.main,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: theme.palette.primary
                                            .contrastText,
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                        flexShrink: 0,
                                    }}
                                >
                                    2
                                </Box>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{
                                        textAlign: textAlign,
                                        direction: direction,
                                        flex: 1,
                                    }}
                                >
                                    {t("messages.contact_step_update_records")}
                                </Typography>
                            </Box>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: theme.spacing(2),
                                    flexDirection: "row",
                                    direction: direction,
                                    width: "100%",
                                    justifyContent: "flex-start",
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: "50%",
                                        backgroundColor:
                                            theme.palette.primary.main,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: theme.palette.primary
                                            .contrastText,
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                        flexShrink: 0,
                                    }}
                                >
                                    3
                                </Box>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{
                                        textAlign: textAlign,
                                        direction: direction,
                                        flex: 1,
                                    }}
                                >
                                    {t(
                                        "messages.contact_step_contact_if_needed"
                                    )}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>

                    {/* Action Buttons */}
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: { xs: "column", sm: "row" },
                            gap: theme.spacing(2),
                            justifyContent: "center",
                            direction: direction,
                        }}
                    >
                        <Button
                            variant="outlined"
                            onClick={() => resetForm()}
                            size="medium"
                            className={PORTAL_NEUTRAL_OUTLINED_CLASS}
                            sx={theme.portalButton.formActionCancelMargin(isRTL)}
                        >
                            {t("actions.report_another_issue")}
                        </Button>
                        <Button
                            variant="contained"
                            onClick={() =>
                                router.push(
                                    AppUrls.Customer_PORTAL_HOME(customerUUID)
                                )
                            }
                            size="medium"
                        >
                            {t("actions.back_to_home")}
                        </Button>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "60vh",
                px: { xs: 2, sm: 3 },
                pt: { xs: 3, sm: 4 },
                direction: isRTL ? "rtl" : "ltr",
            }}
        >
            {!activeForm && !confirmation && (
                <Box sx={{ width: "100%", maxWidth: 800 }}>
                    <Card
                        className={PORTAL_CARD_CLASS}
                        elevation={0}
                        sx={{
                            ...getPortalCardSx(theme),
                            overflow: "hidden",
                        }}
                    >
                        <CardContent
                            sx={{
                                p: theme.spacing(3, 4),
                                direction: direction,
                                textAlign: textAlign,
                            }}
                        >
                            <Typography
                                variant="body1"
                                sx={{
                                    mb: theme.spacing(4),
                                    color: theme.palette.text.secondary,
                                    lineHeight: 1.6,
                                }}
                            >
                                {t("fields.contact_wrong_contact_description")}
                            </Typography>

                            <Box
                                component="form"
                                onSubmit={(e) =>
                                    handleSubmit(e, "wrongContact")
                                }
                                noValidate
                                sx={{ direction: direction }}
                            >
                                <Grid
                                    container
                                    spacing={3}
                                    sx={{ direction: direction }}
                                >
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <TextField
                                            id="first_name"
                                            label={t(
                                                "fields.contact_first_name"
                                            )}
                                            required
                                            value={formData.first_name}
                                            onChange={(e) =>
                                                handleInputChange(
                                                    "first_name",
                                                    e.target.value
                                                )
                                            }
                                            error={!!errors.first_name}
                                            helperText={errors.first_name}
                                            variant="outlined"
                                            size="small"
                                            fullWidth
                                            {...(isRTL && {
                                                "data-hebrew": true,
                                            })}
                                            inputProps={{
                                                dir: direction,
                                            }}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <TextField
                                            id="last_name"
                                            label={t(
                                                "fields.contact_last_name"
                                            )}
                                            required
                                            value={formData.last_name}
                                            onChange={(e) =>
                                                handleInputChange(
                                                    "last_name",
                                                    e.target.value
                                                )
                                            }
                                            error={!!errors.last_name}
                                            helperText={errors.last_name}
                                            variant="outlined"
                                            size="small"
                                            fullWidth
                                            {...(isRTL && {
                                                "data-hebrew": true,
                                            })}
                                            inputProps={{
                                                dir: direction,
                                            }}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <TextField
                                            id="email"
                                            label={t("fields.contact_email")}
                                            type="email"
                                            required
                                            value={formData.email}
                                            onChange={(e) =>
                                                handleInputChange(
                                                    "email",
                                                    e.target.value
                                                )
                                            }
                                            error={!!errors.email}
                                            helperText={errors.email}
                                            variant="outlined"
                                            size="small"
                                            fullWidth
                                            {...(isRTL && {
                                                "data-hebrew": true,
                                            })}
                                            inputProps={{
                                                dir: direction,
                                            }}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <TextField
                                            id="phone"
                                            label={t("fields.contact_phone")}
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) =>
                                                handleInputChange(
                                                    "phone",
                                                    e.target.value
                                                )
                                            }
                                            variant="outlined"
                                            size="small"
                                            fullWidth
                                            {...(isRTL && {
                                                "data-hebrew": true,
                                            })}
                                            inputProps={{
                                                dir: direction,
                                            }}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12 }}>
                                        <TextField
                                            id="notes"
                                            label={t("fields.contact_notes")}
                                            multiline
                                            rows={3}
                                            required
                                            value={formData.notes}
                                            onChange={(e) =>
                                                handleInputChange(
                                                    "notes",
                                                    e.target.value
                                                )
                                            }
                                            error={!!errors.notes}
                                            helperText={errors.notes}
                                            variant="outlined"
                                            size="small"
                                            fullWidth
                                            {...(isRTL && {
                                                "data-hebrew": true,
                                            })}
                                            inputProps={{
                                                dir: direction,
                                            }}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12 }}>
                                        <Stack
                                            direction="row"
                                            spacing={0}
                                            justifyContent="flex-end"
                                            sx={{
                                                mt: theme.spacing(2),
                                                direction: direction,
                                                gap: theme.spacing(1),
                                            }}
                                        >
                                            <Button
                                                variant="outlined"
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
                                                size="medium"
                                                sx={theme.portalButton.formActionCancelMargin(
                                                    isRTL
                                                )}
                                            >
                                                {t("actions.cancel", {
                                                    ns: "common",
                                                })}
                                            </Button>
                                            <Button
                                                type="submit"
                                                variant="contained"
                                                disabled={isSubmitting}
                                                size="medium"
                                            >
                                                {isSubmitting
                                                    ? t("actions.submitting", {
                                                        ns: "common",
                                                    })
                                                    : t("actions.submit", {
                                                        ns: "common",
                                                    })}
                                            </Button>
                                        </Stack>
                                    </Grid>
                                </Grid>
                            </Box>
                        </CardContent>
                    </Card>
                </Box>
            )}

            {confirmation && <ConfirmationMessage />}
        </Box>
    );
}
