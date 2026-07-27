"use client";

import { LockOpen, Security } from "@mui/icons-material";
import { Alert, Box, CardContent, CircularProgress, Container, Fade, TextField, Typography, useMediaQuery, useTheme } from "@mui/material";
import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import {
    AuthButton,
    AuthContainer,
    AuthHeaderSection,
    AuthIconContainer,
    AuthPaper,
} from "@/app/[locale]/(auth)/components/AuthStyledComponents";
import { sendVerificationCodeAction, verifyCodeAction } from "@/app/actions/portalVerification";
import BackgroundPattern from "@/components/BackgroundPattern";

interface VerificationViewProps {
    customerUUID: string;
    initialMaskedEmail?: string | null;
    contactId?: number;
    autoSend?: boolean;
    isBypassed?: boolean;
}

export default function VerificationView({ customerUUID, initialMaskedEmail, contactId, autoSend, isBypassed }: VerificationViewProps) {
    const { t, i18n } = useTranslation("portal");
    const isHebrew = i18n.language === "he";
    const router = useRouter();
    const params = useParams();
    const locale = params?.locale as string || "en";
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));

    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<"initial" | "sent" | "verified">(isBypassed ? "verified" : "initial");
    const [code, setCode] = useState("");
    const [error, setError] = useState<string | null>(initialMaskedEmail ? null : t("messages.verification_error_no_email"));
    const [emailMasked, setEmailMasked] = useState<string | null>(initialMaskedEmail || null);

    const autoSendTriggered = React.useRef(false);

    React.useEffect(() => {
        // Reset one-time auto-send guard when target contact/customer changes.
        autoSendTriggered.current = false;
    }, [customerUUID, contactId]);

    React.useEffect(() => {
        if (isBypassed) {
            // Short delay to show the verified state (optional) or instant redirect
            const timer = setTimeout(() => {
                router.push(`/${locale}/portal/${customerUUID}`);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [isBypassed, locale, customerUUID, router]);

    const handleSendCode = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await sendVerificationCodeAction(customerUUID, contactId);
            if (result.success) {
                setStep("sent");
                if (result.emailObfuscated) {
                    setEmailMasked(result.emailObfuscated);
                }
            } else {
                setError(result.error || t("messages.verification_error_send_failed"));
            }
        } catch (err) {
            setError(t("messages.verification_error_generic"));
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        if (autoSend && !autoSendTriggered.current && step === "initial") {
            if (typeof window !== "undefined") {
                const autoSendKey = `portal_verify_autosend_once_${customerUUID}_${contactId ?? "default"}`;
                const lastAutoSendAt = Number(
                    sessionStorage.getItem(autoSendKey) || "0"
                );
                const now = Date.now();

                // Prevent duplicate auto-send on remount/strict-mode within 60s.
                if (lastAutoSendAt > 0 && now - lastAutoSendAt < 60000) {
                    autoSendTriggered.current = true;
                    setStep("sent");
                    return;
                }

                sessionStorage.setItem(autoSendKey, String(now));
            }
            autoSendTriggered.current = true;
            handleSendCode();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoSend, step]);

    const handleVerify = async () => {
        if (!code || code.length !== 6) {
            setError(t("messages.verification_error_invalid_length"));
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await verifyCodeAction(customerUUID, code);
            if (result.success) {
                setStep("verified");
                // Refresh to update cookie state in middleware/layout
                router.refresh();
                // Navigate to portal home
                router.push(`/${locale}/portal/${customerUUID}`);
            } else {
                setError(t("messages.verification_error_invalid_code"));
            }
        } catch (err) {
            setError(t("messages.verification_error_generic"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <BackgroundPattern>
            <AuthContainer>
                <Container maxWidth="xs" sx={{ display: "flex", justifyContent: "center" }}>
                    <Fade in timeout={800}>
                        <AuthPaper elevation={24}>
                            <AuthHeaderSection>
                                <AuthIconContainer>
                                    {step === "verified" ? (
                                        <LockOpen sx={{ fontSize: isMobile ? 30 : 40 }} />
                                    ) : (
                                        <Security sx={{ fontSize: isMobile ? 30 : 40 }} />
                                    )}
                                </AuthIconContainer>
                                <Typography
                                    variant={isMobile ? "h5" : "h4"}
                                    component="h1"
                                    sx={{
                                        fontWeight: theme.typography.fontWeightBold,
                                        mb: 1,
                                        textShadow: `0 2px 4px ${theme.palette.common.black}10`,
                                        position: "relative",
                                        zIndex: 1,
                                        color: theme.palette.primary.contrastText,
                                    }}
                                >
                                    {step === "verified" ? t("sections.verified") : t("sections.verification_required")}
                                </Typography>
                                <Typography
                                    variant="body1"
                                    sx={{
                                        opacity: 0.9,
                                        position: "relative",
                                        zIndex: 1,
                                        fontSize: isMobile ? "0.875rem" : "1rem",
                                        color: theme.palette.primary.contrastText,
                                    }}
                                >
                                    {step === "verified"
                                        ? t("messages.redirecting")
                                        : t("messages.verify_desc")}
                                </Typography>
                            </AuthHeaderSection>

                            <CardContent sx={{ p: isMobile ? 3 : 4 }}>
                                {error && (
                                    <Alert
                                        severity="error"
                                        onClose={() => setError(null)}
                                        sx={{ mb: 3 }}
                                    >
                                        {error}
                                    </Alert>
                                )}

                                {step === "initial" && (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        <Typography variant="body1" align="center">
                                            {t("messages.verification_initial_prompt")}
                                            <br />
                                            {emailMasked && (
                                                <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block', mt: 1, fontWeight: 'bold' }}>
                                                    {emailMasked}
                                                </Typography>
                                            )}
                                        </Typography>

                                        <AuthButton
                                            variant="contained"
                                            onClick={handleSendCode}
                                            disabled={loading}
                                            fullWidth
                                        >
                                            {t("actions.verification_send_code")}
                                        </AuthButton>
                                    </Box>
                                )}

                                {step === "sent" && (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                        <Box>
                                            <Typography variant="body1" align="center" gutterBottom>
                                                {t("messages.verification_code_sent")}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" align="center">
                                                {emailMasked}
                                            </Typography>
                                        </Box>

                                        <TextField
                                            label={t("fields.verification_code")}
                                            value={code}
                                            onChange={(e) => setCode(e.target.value)}
                                            fullWidth
                                            autoFocus
                                            dir={isHebrew ? "rtl" : "ltr"}
                                            {...(isHebrew && { "data-hebrew": true })}
                                            slotProps={{
                                                htmlInput: {
                                                    maxLength: 6,
                                                    style: {
                                                        textAlign: isHebrew ? "right" : "center",
                                                        letterSpacing: "0.5em",
                                                        fontSize: "1.2rem",
                                                    },
                                                },
                                            }}
                                            sx={{
                                                "& .MuiOutlinedInput-input": {
                                                    direction: isHebrew ? "rtl" : "ltr",
                                                    textAlign: isHebrew ? "right" : "center",
                                                },
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    handleVerify();
                                                }
                                            }}
                                        />

                                        <AuthButton
                                            variant="contained"
                                            onClick={handleVerify}
                                            disabled={loading || code.length !== 6}
                                            fullWidth
                                        >
                                            {t("actions.verification_verify")}
                                        </AuthButton>

                                        <AuthButton
                                            variant="text"
                                            onClick={handleSendCode}
                                            disabled={loading}
                                            fullWidth
                                            sx={{
                                                marginTop: -2,
                                                background: 'transparent',
                                                boxShadow: 'none',
                                                color: 'primary.main',
                                                '&:hover': {
                                                    background: 'rgba(0,0,0,0.05)',
                                                    boxShadow: 'none',
                                                    transform: 'none'
                                                }
                                            }}
                                        >
                                            {t("actions.verification_resend")}
                                        </AuthButton>
                                    </Box>
                                )}

                                {step === "verified" && (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                                        <CircularProgress color="primary" />
                                        <Typography sx={{ mt: 2 }}>{t("messages.redirecting_to_portal")}</Typography>
                                    </Box>
                                )}
                            </CardContent>
                        </AuthPaper>
                    </Fade>
                </Container>
            </AuthContainer>
        </BackgroundPattern>
    );
}
