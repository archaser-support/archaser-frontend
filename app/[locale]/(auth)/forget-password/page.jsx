"use client";

import { Email, LockReset } from "@mui/icons-material";
import {
    Box,
    CardContent,
    TextField,
    Typography,
    Alert,
    InputAdornment,
    Container,
    useTheme,
    useMediaQuery,
    Fade,
    Stack,
    Divider,
} from "@mui/material";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import BackgroundPattern from "@/components/BackgroundPattern";
import { isNestAuthEnabled, nestForgetPassword } from "@/utils/nestAuth";

import {
    AuthPaper,
    AuthHeaderSection,
    AuthIconContainer,
    AuthButton,
    AuthLink,
    AuthContainer,
} from "../components/AuthStyledComponents";

const FOCUS_DELAY = 100;

function ForgetPasswordContent() {
    const { t, i18n } = useTranslation(["auth", "common"]);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const isHebrew = i18n.language === "he";
    const emailInputRef = useRef(null);

    const [email, setEmail] = useState("");
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [emailError, setEmailError] = useState("");

    // Focus the email field when component mounts
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            emailInputRef.current?.focus();
        }, FOCUS_DELAY);
        return () => {
            clearTimeout(timeoutId);
        };
    }, []);

    const validateEmail = (email) => {
        if (!email.trim()) {
            return t("messages.email_required");
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return t("messages.invalid_email");
        }
        return "";
    };

    const handleEmailChange = (e) => {
        const value = e.target.value;
        setEmail(value);
        setEmailError(validateEmail(value));
    };

    const handleForgetPassword = async (e) => {
        e.preventDefault();
        setError(null);
        setMessage(null);
        setIsLoading(true);

        // Validate email
        const emailValidation = validateEmail(email);
        setEmailError(emailValidation);

        if (emailValidation) {
            setIsLoading(false);
            return;
        }

        try {
            if (isNestAuthEnabled()) {
                await nestForgetPassword(email, i18n.language);
                setMessage(t("messages.forgot_password_email_sent"));
            } else {
                const response = await fetch("/api/auth/forget-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email }),
                });
                const data = await response.json();
                if (response.ok) {
                    setMessage(t("messages.forgot_password_email_sent"));
                } else if (response.status === 404) {
                    setError(
                        t("messages.forgot_password_user_not_found") ||
                            "User not found"
                    );
                } else {
                    setError(
                        data.message ||
                            t("messages.forgot_password_reset_failed")
                    );
                }
            }
        } catch (err) {
            const status =
                err && typeof err === "object" && "status" in err
                    ? err.status
                    : undefined;
            if (status === 404) {
                setError(
                    t("messages.forgot_password_user_not_found") ||
                        "User not found"
                );
            } else {
                setError(
                    (err && err.message) ||
                        t("messages.forgot_password_reset_error") ||
                        "An unexpected error occurred. Please try again."
                );
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <BackgroundPattern>
            <AuthContainer>
                <Container
                    maxWidth="xs"
                    sx={{
                        display: "flex",
                        justifyContent: "center",
                        direction: isHebrew ? "rtl" : "ltr",
                    }}
                >
                    <Fade in timeout={800}>
                        <AuthPaper elevation={24} dir={isHebrew ? "rtl" : "ltr"}>
                            {/* Header Section */}
                            <AuthHeaderSection>
                                <AuthIconContainer>
                                    <LockReset
                                        sx={{ 
                                            fontSize: isMobile ? 30 : 40,
                                            transform: isHebrew ? "scaleX(-1)" : "none",
                                        }}
                                    />
                                </AuthIconContainer>
                                <Typography
                                    variant={isHebrew ? (isMobile ? "hebrewSubtitle" : "hebrewTitle") : (isMobile ? "h5" : "h4")}
                                    component="h1"
                                    sx={{
                                        fontWeight: theme.typography.fontWeightBold,
                                        mb: theme.spacing(1),
                                        textShadow: `0 2px 4px ${theme.palette.common.black}10`,
                                        position: "relative",
                                        zIndex: 1,
                                        color: theme.palette.primary.contrastText,
                                        textAlign: "center",
                                    }}
                                >
                                    {t("sections.forgot_password_title")}
                                </Typography>
                                <Typography
                                    variant={isHebrew ? "hebrewBodyText" : "body1"}
                                    sx={{
                                        opacity: 0.9,
                                        fontWeight: theme.typography.fontWeightRegular,
                                        position: "relative",
                                        zIndex: 1,
                                        fontSize: isMobile
                                            ? theme.typography.body2.fontSize
                                            : theme.typography.body1.fontSize,
                                        color: theme.palette.primary.contrastText,
                                        textAlign: "center",
                                    }}
                                >
                                    {t("sections.forgot_password_description")}
                                </Typography>
                            </AuthHeaderSection>

                            {/* Form Section */}
                            <CardContent sx={{
                                p: isMobile ? theme.spacing(3) : theme.spacing(4),
                                direction: isHebrew ? "rtl" : "ltr",
                            }}>
                                <Stack spacing={theme.spacing(3)}>
                                    {message && (
                                        <Alert
                                            severity="success"
                                            dir={isHebrew ? "rtl" : "ltr"}
                                            sx={{
                                                borderRadius:
                                                    theme.shape.borderRadius,
                                                direction: isHebrew ? "rtl" : "ltr",
                                                textAlign: isHebrew ? "right" : "left",
                                                "& .MuiAlert-icon": {
                                                    fontSize: 20,
                                                },
                                            }}
                                        >
                                            {message}
                                        </Alert>
                                    )}
                                    {error && (
                                        <Alert
                                            severity="error"
                                            dir={isHebrew ? "rtl" : "ltr"}
                                            sx={{
                                                borderRadius:
                                                    theme.shape.borderRadius,
                                                direction: isHebrew ? "rtl" : "ltr",
                                                textAlign: isHebrew ? "right" : "left",
                                                "& .MuiAlert-icon": {
                                                    fontSize: 20,
                                                },
                                            }}
                                        >
                                            {error}
                                        </Alert>
                                    )}

                                    <Box
                                        component="form"
                                        onSubmit={handleForgetPassword}
                                        sx={{
                                            direction: isHebrew ? "rtl" : "ltr",
                                        }}
                                    >
                                        <Stack spacing={theme.spacing(3)}>
                                            <TextField
                                                inputRef={emailInputRef}
                                                fullWidth
                                                label={t(
                                                    "fields.email"
                                                )}
                                                type="email"
                                                value={email}
                                                onChange={handleEmailChange}
                                                onBlur={() =>
                                                    setEmailError(
                                                        validateEmail(email)
                                                    )
                                                }
                                                dir={isHebrew ? "rtl" : "ltr"}
                                                {...(isHebrew && { "data-hebrew": true })}
                                                sx={{
                                                    '& .MuiInputBase-root': {
                                                        direction: isHebrew ? "rtl" : "ltr",
                                                    },
                                                    '& .MuiFormHelperText-root': {
                                                        textAlign: isHebrew ? "right" : "left",
                                                    },
                                                    '& .MuiInputLabel-root': {
                                                        transform: isHebrew 
                                                            ? 'translate(0px, -9px) scale(0.75) !important'
                                                            : 'translate(14px, -9px) scale(0.75) !important',
                                                        '&.MuiInputLabel-shrink': {
                                                            transform: isHebrew 
                                                                ? 'translate(0px, -9px) scale(0.75) !important'
                                                                : 'translate(14px, -9px) scale(0.75) !important',
                                                        },
                                                    },
                                                }}
                                                InputLabelProps={{ shrink: true }}
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <Email color="primary" />
                                                        </InputAdornment>
                                                    ),
                                                }}
                                                error={!!emailError}
                                                helperText={emailError}
                                                variant="outlined"
                                                size="medium"
                                            />

                                            <AuthButton
                                                type="submit"
                                                fullWidth
                                                variant="contained"
                                                disabled={isLoading}
                                                sx={{
                                                    direction: isHebrew ? "rtl" : "ltr",
                                                    background: isLoading
                                                        ? `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`
                                                        : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                                                    boxShadow: isLoading
                                                        ? `0 2px 8px ${theme.palette.primary.main}30`
                                                        : `0 4px 12px ${theme.palette.primary.main}40`,
                                                    cursor: isLoading ? "not-allowed" : "pointer",
                                                    "&:hover": {
                                                        background: isLoading
                                                            ? `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`
                                                            : `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`,
                                                        transform: isLoading ? "none" : "translateY(-2px)",
                                                        boxShadow: isLoading
                                                            ? `0 2px 8px ${theme.palette.primary.main}30`
                                                            : `0 8px 25px ${theme.palette.primary.main}60`,
                                                    },
                                                    "&:active": {
                                                        transform: isLoading ? "none" : "translateY(0)",
                                                        boxShadow: isLoading
                                                            ? `0 2px 8px ${theme.palette.primary.main}30`
                                                            : `0 4px 12px ${theme.palette.primary.main}40`,
                                                    },
                                                    "&:disabled": {
                                                        background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`,
                                                        transform: "none",
                                                        boxShadow: `0 2px 8px ${theme.palette.primary.main}30`,
                                                        opacity: 0.8,
                                                    },
                                                }}

                                            >
                                                {isLoading
                                                    ? t(
                                                        "messages.sending_reset_link"
                                                    )
                                                    : t(
                                                        "actions.send_reset_link"
                                                    )}
                                            </AuthButton>

                                            <Divider sx={{ my: theme.spacing(1) }} />

                                            <Box sx={{ 
                                                textAlign: "center",
                                                direction: isHebrew ? "rtl" : "ltr",
                                            }}>
                                                <Typography
                                                    variant={isHebrew ? "hebrewBodyText" : "body2"}
                                                    color="text.secondary"
                                                    sx={{
                                                        direction: isHebrew ? "rtl" : "ltr",
                                                    }}
                                                >
                                                    {t(
                                                        "sections.remember_password"
                                                    )}{" "}
                                                    <AuthLink href="/login">
                                                        {t(
                                                            "actions.login"
                                                        )}
                                                    </AuthLink>
                                                </Typography>
                                            </Box>
                                        </Stack>
                                    </Box>
                                </Stack>
                            </CardContent>
                        </AuthPaper>
                    </Fade>
                </Container>
            </AuthContainer>
        </BackgroundPattern>
    );
}

export default function ForgetPasswordPage() {
    // Forgot password page uses translations from the layout's TranslationsProvider
    // No need to initialize translations here as they're already provided by the root layout

    return <ForgetPasswordContent />;
}
