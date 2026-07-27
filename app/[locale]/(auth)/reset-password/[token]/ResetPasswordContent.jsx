"use client";

import {
    Visibility,
    VisibilityOff,
    Lock,
    ArrowForward,
    LockReset,
} from "@mui/icons-material";
import {
    Box,
    CardContent,
    TextField,
    Typography,
    Alert,
    InputAdornment,
    IconButton,
    Container,
    useTheme,
    useMediaQuery,
    Fade,
    CircularProgress,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import BackgroundPattern from "@/components/BackgroundPattern";
import { isNestAuthEnabled, nestResetPassword } from "@/utils/nestAuth";

import {
    AuthPaper,
    AuthHeaderSection,
    AuthIconContainer,
    AuthButton,
    AuthLink,
    AuthContainer,
} from "../../components/AuthStyledComponents";

const FOCUS_DELAY = 100;

export default function ResetPasswordContent({ token }) {
    const { t, i18n } = useTranslation(["auth", "common"]);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const isHebrew = i18n.language === "he";
    const passwordInputRef = useRef(null);

    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [passwordError, setPasswordError] = useState("");
    const [confirmPasswordError, setConfirmPasswordError] = useState("");

    // Focus the password field when component mounts
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            passwordInputRef.current?.focus();
        }, FOCUS_DELAY);
        return () => {
            clearTimeout(timeoutId);
        };
    }, []);

    const validatePassword = (pwd) => {
        if (!pwd) {
            return t("messages.password_required", { ns: "auth" });
        }
        if (pwd.length < 8) {
            return t("validation.password_min_length", { ns: "auth" });
        }
        if (!/(?=.*[a-z])/.test(pwd)) {
            return t("validation.password_lowercase_required", { ns: "auth" });
        }
        if (!/(?=.*[A-Z])/.test(pwd)) {
            return t("validation.password_uppercase_required", { ns: "auth" });
        }
        if (!/(?=.*\d)/.test(pwd)) {
            return t("validation.password_number_required", { ns: "auth" });
        }
        return "";
    };

    const handlePasswordChange = (e) => {
        const newPassword = e.target.value;
        setPassword(newPassword);
        setPasswordError(validatePassword(newPassword));

        if (confirmPassword && newPassword !== confirmPassword) {
            setConfirmPasswordError(t("validation.passwords_not_match", { ns: "auth" }));
        } else {
            setConfirmPasswordError("");
        }
    };

    const handleConfirmPasswordChange = (e) => {
        const newConfirmPassword = e.target.value;
        setConfirmPassword(newConfirmPassword);

        if (newConfirmPassword !== password) {
            setConfirmPasswordError(t("validation.passwords_not_match", { ns: "auth" }));
        } else {
            setConfirmPasswordError("");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setMessage(null);

        const pwdError = validatePassword(password);
        if (pwdError) {
            setPasswordError(pwdError);
            return;
        }

        if (password !== confirmPassword) {
            setConfirmPasswordError(t("validation.passwords_not_match", { ns: "auth" }));
            return;
        }

        setIsLoading(true);

        try {
            if (isNestAuthEnabled()) {
                await nestResetPassword(token, password);
            } else {
                const response = await fetch("/api/auth/reset-password", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        token,
                        password,
                    }),
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(
                        data.error ||
                            data.message ||
                            t("messages.reset_password_failed", { ns: "auth" })
                    );
                }
            }

            setMessage(t("messages.reset_password_success", { ns: "auth" }));
            setTimeout(() => {
                router.push("/login");
            }, 2000);
        } catch (err) {
            setError(err.message || t("messages.reset_password_failed", { ns: "auth" }));
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
                                    {t("sections.reset_password_title", { ns: "auth" })}
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
                                    {t("sections.reset_password_description", { ns: "auth" })}
                                </Typography>
                            </AuthHeaderSection>

                            {/* Form Section */}
                            <CardContent
                                sx={{
                                    p: isMobile ? theme.spacing(3) : theme.spacing(4),
                                    direction: isHebrew ? "rtl" : "ltr",
                                }}
                            >
                                <Box
                                    component="form"
                                    onSubmit={handleSubmit}
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: theme.spacing(2.5),
                                        mt: theme.spacing(2),
                                    }}
                                >
                                    {error && (
                                        <Alert
                                            severity="error"
                                            sx={{
                                                mb: theme.spacing(1),
                                                direction: isHebrew ? "rtl" : "ltr",
                                            }}
                                        >
                                            {error}
                                        </Alert>
                                    )}

                                    {message && (
                                        <Alert
                                            severity="success"
                                            sx={{
                                                mb: theme.spacing(1),
                                                direction: isHebrew ? "rtl" : "ltr",
                                            }}
                                        >
                                            {message}
                                        </Alert>
                                    )}

                                    <TextField
                                        inputRef={passwordInputRef}
                                        fullWidth
                                        type={showPassword ? "text" : "password"}
                                        label={t("fields.password", { ns: "auth" })}
                                        value={password}
                                        onChange={handlePasswordChange}
                                        error={!!passwordError}
                                        helperText={passwordError}
                                        required
                                        sx={{
                                            direction: isHebrew ? "rtl" : "ltr",
                                        }}
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        onClick={() =>
                                                            setShowPassword(!showPassword)
                                                        }
                                                        edge="end"
                                                        aria-label="toggle password visibility"
                                                    >
                                                        {showPassword ? (
                                                            <VisibilityOff />
                                                        ) : (
                                                            <Visibility />
                                                        )}
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <Lock color="action" />
                                                </InputAdornment>
                                            ),
                                        }}
                                    />

                                    <TextField
                                        fullWidth
                                        type={showConfirmPassword ? "text" : "password"}
                                        label={t("fields.confirm_password", { ns: "auth" })}
                                        value={confirmPassword}
                                        onChange={handleConfirmPasswordChange}
                                        error={!!confirmPasswordError}
                                        helperText={confirmPasswordError}
                                        required
                                        sx={{
                                            direction: isHebrew ? "rtl" : "ltr",
                                        }}
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        onClick={() =>
                                                            setShowConfirmPassword(
                                                                !showConfirmPassword
                                                            )
                                                        }
                                                        edge="end"
                                                        aria-label="toggle confirm password visibility"
                                                    >
                                                        {showConfirmPassword ? (
                                                            <VisibilityOff />
                                                        ) : (
                                                            <Visibility />
                                                        )}
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <Lock color="action" />
                                                </InputAdornment>
                                            ),
                                        }}
                                    />

                                    <AuthButton
                                        type="submit"
                                        fullWidth
                                        variant="contained"
                                        disabled={isLoading}
                                        sx={{
                                            mt: theme.spacing(1),
                                            py: theme.spacing(1.5),
                                        }}
                                        endIcon={
                                            isLoading ? (
                                                <CircularProgress size={20} color="inherit" />
                                            ) : (
                                                <ArrowForward />
                                            )
                                        }
                                    >
                                        {isLoading
                                            ? t("messages.resetting_password", { ns: "auth" })
                                            : t("actions.reset_password", { ns: "auth" })}
                                    </AuthButton>

                                    <Box
                                        sx={{
                                            textAlign: "center",
                                            mt: theme.spacing(2),
                                        }}
                                    >
                                        <AuthLink href="/login">
                                            {t("actions.back_to_login", { ns: "auth" })}
                                        </AuthLink>
                                    </Box>
                                </Box>
                            </CardContent>
                        </AuthPaper>
                    </Fade>
                </Container>
            </AuthContainer>
        </BackgroundPattern>
    );
}

