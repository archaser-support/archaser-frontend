"use client";
import { apiFetch } from "@/utils/apiFetch";

import {
    DragHandle,
    Lock as LockIcon,
    Visibility,
    VisibilityOff,
} from "@mui/icons-material";
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    InputAdornment,
    TextField,
    Slide,
    useTheme,
} from "@mui/material";
import { signOut } from "next-auth/react";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppDialog } from "@/shared/hooks/useAppDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";

interface PasswordChangeData {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

interface ChangePasswordModalProps {
    open: boolean;
    onClose: () => void;
    userId: string;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
    open,
    onClose,
    userId,
}) => {
    const { t, i18n } = useTranslation(["users", "common"]);
    const theme = useTheme();
    const { success, error: showError } = useToast();
    const isRTL = i18n.language === "he";

    const [passwordData, setPasswordData] = useState<PasswordChangeData>({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });
    const [passwordErrors, setPasswordErrors] = useState<
        Record<string, string>
    >({});
    const [newPasswordErrors, setNewPasswordErrors] = useState<string[]>([]);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false,
    });

    const {
        position,
        isDragging,
        dialogRef,
        handleDragStart,
        resetPosition,
    } = useAppDialog();

    const validatePassword = useCallback(
        (password: string): string[] => {
            const errors: string[] = [];
            if (password.length < 8) {
                errors.push(t("messages.password_min_length", { ns: "users" }));
            }
            if (!/(?=.*[a-z])/.test(password)) {
                errors.push(
                    t("messages.password_lowercase_required", { ns: "users" })
                );
            }
            if (!/(?=.*[A-Z])/.test(password)) {
                errors.push(
                    t("messages.password_uppercase_required", { ns: "users" })
                );
            }
            if (!/(?=.*\d)/.test(password)) {
                errors.push(
                    t("messages.password_number_required", { ns: "users" })
                );
            }
            if (!/(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/.test(password)) {
                errors.push(
                    t("messages.password_special_char_required", {
                        ns: "users",
                    })
                );
            }
            return errors;
        },
        [t]
    );

    const handlePasswordChange = useCallback(
        (field: keyof PasswordChangeData, value: string) => {
            setPasswordData((prev) => ({ ...prev, [field]: value }));

            if (passwordErrors[field]) {
                setPasswordErrors((prev) => ({ ...prev, [field]: "" }));
            }

            if (field === "newPassword") {
                if (!value || value.trim() === "") {
                    setPasswordErrors((prev) => ({ ...prev, newPassword: "" }));
                    setNewPasswordErrors([]);
                } else {
                    const errors = validatePassword(value);
                    if (errors.length > 0) {
                        setPasswordErrors((prev) => ({
                            ...prev,
                            newPassword: errors.join(", "),
                        }));
                        setNewPasswordErrors(errors);
                    } else {
                        setPasswordErrors((prev) => ({
                            ...prev,
                            newPassword: "",
                        }));
                        setNewPasswordErrors([]);
                    }
                }
            }

            if (
                field === "confirmPassword" &&
                passwordData.newPassword &&
                value
            ) {
                if (value !== passwordData.newPassword) {
                    setPasswordErrors((prev) => ({
                        ...prev,
                        confirmPassword: t(
                            "messages.password_confirm_mismatch",
                            { ns: "users" }
                        ),
                    }));
                } else {
                    setPasswordErrors((prev) => ({
                        ...prev,
                        confirmPassword: "",
                    }));
                }
            }
        },
        [passwordErrors, passwordData.newPassword, validatePassword, t]
    );

    const handleChangePassword = useCallback(async () => {
        const errors: Record<string, string> = {};

        if (!passwordData.currentPassword) {
            errors.currentPassword = t(
                "messages.password_current_required",
                { ns: "users" }
            );
        }

        if (!passwordData.newPassword) {
            errors.newPassword = t("messages.password_new_required", {
                ns: "users",
            });
            setNewPasswordErrors([]);
        } else {
            const passwordValidationErrors = validatePassword(
                passwordData.newPassword
            );
            if (passwordValidationErrors.length > 0) {
                errors.newPassword = passwordValidationErrors.join(", ");
                setNewPasswordErrors(passwordValidationErrors);
            } else {
                setNewPasswordErrors([]);
            }
        }

        if (!passwordData.confirmPassword) {
            errors.confirmPassword = t(
                "messages.password_confirm_required",
                { ns: "users" }
            );
        } else if (
            passwordData.confirmPassword !== passwordData.newPassword
        ) {
            errors.confirmPassword = t(
                "messages.password_confirm_mismatch",
                { ns: "users" }
            );
        }

        if (Object.keys(errors).length > 0) {
            setPasswordErrors(errors);
            return;
        }

        setIsChangingPassword(true);
        try {
            const response = await apiFetch(`/api/entities/users/${userId}/change-password`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        currentPassword: passwordData.currentPassword,
                        newPassword: passwordData.newPassword,
                    }),
                }
            );

            const responseData = await response.json();

            if (!response.ok) {
                if (responseData.error === "Current password is incorrect") {
                    setPasswordErrors((prev) => ({
                        ...prev,
                        currentPassword: t(
                            "messages.password_incorrect_current",
                            { ns: "users" }
                        ),
                    }));
                } else {
                    showError(
                        responseData.error ||
                        t("messages.password_change_failed", {
                            ns: "users",
                        })
                    );
                }
                return;
            }

            success(t("messages.password_change_success", { ns: "users" }));
            onClose();
            setPasswordData({
                currentPassword: "",
                newPassword: "",
                confirmPassword: "",
            });
            setPasswordErrors({});
            setNewPasswordErrors([]);
            resetPosition();

            setTimeout(() => {
                signOut({ callbackUrl: "/login" });
            }, 1500);
        } catch (error: any) {
            showError(
                error.message ||
                t("messages.password_change_failed", { ns: "users" })
            );
        } finally {
            setIsChangingPassword(false);
        }
    }, [
        passwordData,
        userId,
        validatePassword,
        t,
        showError,
        success,
        onClose,
        resetPosition,
    ]);

    const handleClose = useCallback(() => {
        onClose();
        setNewPasswordErrors([]);
        setPasswordData({
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        });
        setPasswordErrors({});
        resetPosition();
    }, [onClose, resetPosition]);

    const togglePasswordVisibility = useCallback(
        (field: keyof typeof showPasswords) => {
            setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
        },
        []
    );

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            TransitionComponent={Slide as any}
            TransitionProps={
                {
                    direction: isRTL ? "right" : "left",
                    onExited: () => {
                        resetPosition();
                        const activeElement =
                            document.activeElement as HTMLElement;
                        if (activeElement?.blur) {
                            activeElement.blur();
                        }
                    },
                } as any
            }
            transitionDuration={{ enter: 300, exit: 200 }}
            maxWidth={false}
            fullWidth={false}
            keepMounted
            disableEnforceFocus={false}
            disableAutoFocus={false}
            container={() => document.body}
            PaperProps={{
                elevation: 24,
                role: "dialog",
                "aria-modal": "true",
                "aria-labelledby": "password-dialog-title",
                ref: dialogRef,
                dir: isRTL ? "rtl" : "ltr",
                sx: {
                    position: "fixed",
                    right:
                        position.x === 0 ? (isRTL ? "auto" : 0) : "auto",
                    left:
                        position.x === 0
                            ? isRTL
                                ? 0
                                : "auto"
                            : `${position.x}px`,
                    top: position.y === 0 ? "auto" : `${position.y}px`,
                    bottom: position.y === 0 ? 0 : "auto",
                    margin: 0,
                    maxWidth: "270px !important",
                    width: "270px !important",
                    maxHeight: "90vh",
                    height: "90vh",
                    borderRadius: `${theme.appButton.borderRadius}px`,
                    border: "none",
                    outline: "none",
                    zIndex: 99999,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    direction: isRTL ? "rtl" : "ltr",
                    transition: isDragging
                        ? "none"
                        : "left 0.1s ease-out, top 0.1s ease-out",
                    "& > .MuiDialogTitle-root": {
                        flexShrink: 0,
                        paddingBottom: "0 !important",
                        borderBottom: "none !important",
                    },
                    "& > .MuiDialogContent-root": {
                        flex: "1 1 auto",
                        minHeight: 0,
                        overflow: "auto",
                    },
                    "& > .MuiDialogActions-root": {
                        flexShrink: 0,
                    },
                },
            }}
            sx={{
                "& .MuiBackdrop-root": {
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    zIndex: 99998,
                },
            }}
        >
            <DialogTitle
                id="password-dialog-title"
                component="h2"
                aria-label={t("actions.password_change_password", {
                    ns: "users",
                })}
                onMouseDown={handleDragStart}
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: theme.spacing(1),
                    color: "white",
                    textAlign: isRTL ? "right" : "left",
                    direction: isRTL ? "rtl" : "ltr",
                    cursor: isDragging ? "grabbing" : "grab",
                    userSelect: "none",
                    position: "relative",
                    borderBottom: "none",
                    boxShadow: "none",
                    "& .MuiTypography-root": {
                        fontWeight: 400,
                    },
                    "& .MuiSvgIcon-root": {
                        fontSize: { xs: "1.5rem", sm: "1.75rem" },
                        color: "white",
                        transition: "transform 0.3s ease",
                    },
                    "&:hover .MuiSvgIcon-root": {
                        transform: "scale(1.1)",
                    },
                }}
            >
                <DragHandle
                    sx={{
                        position: "absolute",
                        left: isRTL ? "auto" : 4,
                        right: isRTL ? 4 : "auto",
                        top: 4,
                        fontSize: "1.5rem",
                        opacity: 0.7,
                        cursor: isDragging ? "grabbing" : "grab",
                        "&:hover": {
                            opacity: 1,
                        },
                    }}
                />
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: theme.spacing(1),
                        flex: 1,
                        pb: "10px",
                    }}
                >
                    <LockIcon aria-hidden="true" />
                    {t("actions.password_change_password", { ns: "users" })}
                </Box>
            </DialogTitle>

            <DialogContent
                id="password-dialog-description"
                aria-labelledby="password-dialog-title"
                sx={{
                    "&:first-of-type": {
                        paddingTop: theme.spacing(2),
                    },
                    pl: "40px",
                    direction: isRTL ? "rtl" : "ltr",
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: { xs: 1, sm: 1.5 },
                        maxWidth: "270px",
                        mx: "auto",
                        direction: isRTL ? "rtl" : "ltr",
                    }}
                >
                    <TextField
                        fullWidth
                        label={t("actions.password_current_password", {
                            ns: "users",
                        })}
                        type={showPasswords.current ? "text" : "password"}
                        value={passwordData.currentPassword}
                        onChange={(e) =>
                            handlePasswordChange(
                                "currentPassword",
                                e.target.value
                            )
                        }
                        error={!!passwordErrors.currentPassword}
                        helperText={passwordErrors.currentPassword}
                        variant="outlined"
                        {...(i18n.language === "he" && {
                            "data-hebrew": true,
                        })}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        onClick={() =>
                                            togglePasswordVisibility(
                                                "current"
                                            )
                                        }
                                        edge="end"
                                    >
                                        {showPasswords.current ? (
                                            <VisibilityOff />
                                        ) : (
                                            <Visibility />
                                        )}
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />

                    <TextField
                        fullWidth
                        label={t("actions.password_new_password", {
                            ns: "users",
                        })}
                        type={showPasswords.new ? "text" : "password"}
                        value={passwordData.newPassword}
                        onChange={(e) =>
                            handlePasswordChange("newPassword", e.target.value)
                        }
                        error={!!passwordErrors.newPassword}
                        helperText={
                            newPasswordErrors.length > 0 ? (
                                <Box
                                    component="div"
                                    sx={{
                                        mt: 0.5,
                                        fontSize: "0.75rem",
                                        lineHeight: 1.8,
                                    }}
                                >
                                    {newPasswordErrors.map((err, index) => (
                                        <Box
                                            key={index}
                                            component="div"
                                            sx={{
                                                display: "flex",
                                                alignItems: "flex-start",
                                                mb: 0.5,
                                            }}
                                        >
                                            <Box
                                                component="span"
                                                sx={{
                                                    mr: 1,
                                                    color: "error.main",
                                                    fontSize: "0.875rem",
                                                    lineHeight: 1.5,
                                                }}
                                            >
                                                •
                                            </Box>
                                            <Box
                                                component="span"
                                                sx={{
                                                    flex: 1,
                                                    color: "error.main",
                                                }}
                                            >
                                                {err}
                                            </Box>
                                        </Box>
                                    ))}
                                </Box>
                            ) : (
                                passwordErrors.newPassword ||
                                (passwordData.newPassword &&
                                    passwordData.newPassword.length > 0
                                    ? t("actions.password_requirements", {
                                        ns: "users",
                                    })
                                    : "")
                            )
                        }
                        variant="outlined"
                        {...(i18n.language === "he" && {
                            "data-hebrew": true,
                        })}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        onClick={() =>
                                            togglePasswordVisibility("new")
                                        }
                                        edge="end"
                                    >
                                        {showPasswords.new ? (
                                            <VisibilityOff />
                                        ) : (
                                            <Visibility />
                                        )}
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />

                    <TextField
                        fullWidth
                        label={t("actions.password_confirm_password", {
                            ns: "users",
                        })}
                        type={showPasswords.confirm ? "text" : "password"}
                        value={passwordData.confirmPassword}
                        onChange={(e) =>
                            handlePasswordChange(
                                "confirmPassword",
                                e.target.value
                            )
                        }
                        error={!!passwordErrors.confirmPassword}
                        helperText={passwordErrors.confirmPassword}
                        variant="outlined"
                        {...(i18n.language === "he" && {
                            "data-hebrew": true,
                        })}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        onClick={() =>
                                            togglePasswordVisibility(
                                                "confirm"
                                            )
                                        }
                                        edge="end"
                                    >
                                        {showPasswords.confirm ? (
                                            <VisibilityOff />
                                        ) : (
                                            <Visibility />
                                        )}
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />
                </Box>
            </DialogContent>

            <DialogActions
                sx={{
                    px: theme.spacing(3),
                    pb: theme.spacing(2),
                    pt: 0,
                    gap: theme.spacing(1),
                    direction: isRTL ? "rtl" : "ltr",
                    flexWrap: { xs: "wrap", sm: "nowrap" },
                }}
            >
                <Button
                    onClick={handleClose}
                    disabled={isChangingPassword}
                    variant="outlined"
                    size="small"
                    className="cancel-button"
                    fullWidth={false}
                    sx={{
                        mr: isRTL ? 0 : theme.spacing(1),
                        ml: isRTL ? theme.spacing(1) : 0,
                    }}
                >
                    {t("actions.cancel", { ns: "common" })}
                </Button>
                <Button
                    onClick={handleChangePassword}
                    variant="contained"
                    size="small"
                    className="save-button"
                    fullWidth={false}
                    disabled={isChangingPassword}
                    sx={{
                        direction: isRTL ? "rtl" : "ltr",
                        "& .MuiButton-endIcon": {
                            marginLeft: isRTL ? 0 : theme.spacing(1),
                            marginRight: isRTL ? theme.spacing(1) : 0,
                        },
                    }}
                >
                    {isChangingPassword
                        ? t("messages.password_changing", { ns: "users" })
                        : t("actions.password_change_password", {
                            ns: "users",
                        })}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ChangePasswordModal;
