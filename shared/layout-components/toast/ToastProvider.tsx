"use client";

import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import ErrorIcon from "@mui/icons-material/Error";
import InfoIcon from "@mui/icons-material/Info";
import WarningIcon from "@mui/icons-material/Warning";
import {
    Snackbar,
    Alert,
    AlertColor,
    IconButton,
    Typography,
    useTheme,
    alpha,
} from "@mui/material";
import React, {
    createContext,
    useContext,
    useCallback,
    ReactNode,
    useState,
} from "react";
import { useTranslation } from "react-i18next";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastContextType {
    showToast: (message: string, type?: ToastType, duration?: number | null) => void;
    success: (key: string, options?: { duration?: number | null }) => void;
    error: (key: string, options?: { duration?: number | null }) => void;
    info: (key: string, options?: { duration?: number | null }) => void;
    warning: (key: string, options?: { duration?: number | null }) => void;
}

interface ToastProviderProps {
    children: ReactNode;
}

const DEFAULT_DURATION = 3000;
const DEFAULT_TYPE: ToastType = "info";

const defaultDurations = {
    success: 3000,
    error: 4000,
    info: 3000,
    warning: 4000,
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const getToastIcon = (severity: AlertColor) => {
    const icons = {
        success: (
            <CheckCircleIcon
                sx={{ fontSize: 16, color: "rgba(74, 85, 104, 0.7)" }}
            />
        ),
        error: (
            <ErrorIcon sx={{ fontSize: 16, color: "rgba(74, 85, 104, 0.7)" }} />
        ),
        warning: (
            <WarningIcon
                sx={{ fontSize: 16, color: "rgba(74, 85, 104, 0.7)" }}
            />
        ),
        info: (
            <InfoIcon sx={{ fontSize: 16, color: "rgba(74, 85, 104, 0.7)" }} />
        ),
    };
    return icons[severity] || null;
};

const getToastStyles = (
    severity: AlertColor,
    isRTL: boolean,
    secondaryColor: string
) => ({
    width: "100%",
    minWidth: "280px",
    maxWidth: "380px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
    borderRadius: "6px",
    padding: "12px 16px",
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    backdropFilter: "blur(12px)",
    color:
        severity === "error"
            ? "rgba(220, 38, 38, 0.9)"
            : secondaryColor,
    display: "flex",
    alignItems: "center",
    border: "1px solid rgba(0, 0, 0, 0.03)",
    direction: isRTL ? "rtl" : "ltr",
    textAlign: isRTL ? "right" : "left",
    animation: isRTL ? "toastFadeInRTL 0.8s ease-out" : "toastFadeIn 0.8s ease-out",
    // Fix message and action spacing for RTL
    "& .MuiAlert-message": {
        marginRight: isRTL ? "0 !important" : "8px !important",
        marginLeft: isRTL ? "0 !important" : "0 !important",
        order: 1, // Message appears first
        flex: 1,
    },
    "& .MuiAlert-action": {
        marginLeft: isRTL ? "0 !important" : "8px !important",
        marginRight: isRTL ? "8px !important" : "0 !important",
        order: 2, // Action appears second
    },
    "@keyframes toastFadeIn": {
        "0%": {
            opacity: 0,
            transform: "translateX(100%) scale(0.9)",
        },
        "100%": {
            opacity: 1,
            transform: "translateX(0) scale(1)",
        },
    },
    "@keyframes toastFadeInRTL": {
        "0%": {
            opacity: 0,
            transform: "translateX(-100%) scale(0.9)",
        },
        "100%": {
            opacity: 1,
            transform: "translateX(0) scale(1)",
        },
    },
});

const closeButtonStyles = {
    padding: "2px",
    color: "rgba(107, 114, 128, 0.6)",
    opacity: 0.6,
    "&:hover": {
        backgroundColor: "rgba(0, 0, 0, 0.03)",
        opacity: 0.8,
        color: "rgba(55, 65, 81, 0.7)",
    },
    transition: "all 0.2s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "4px",
};

const getMessageStyles = (severity: AlertColor, secondaryColor: string) => ({
    fontWeight: 400,
    color:
        severity === "error"
            ? "rgba(220, 38, 38, 0.9)"
            : secondaryColor,
    fontSize: "0.875rem",
    lineHeight: "1.4",
    display: "flex",
    alignItems: "center",
});

const snackbarStyles = {
    "& .MuiSnackbar-root": {
        top: "120px !important",
        right: "16px !important",
        left: "16px !important",
    },
    "& .MuiSnackbarContent-root": {
        minWidth: "auto",
        maxWidth: "none",
        transition: "none !important",
        transform: "none !important",
    },
};

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
    const theme = useTheme();
    const { i18n } = useTranslation(["common"]);

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [severity, setSeverity] = useState<AlertColor>(DEFAULT_TYPE);
    const [duration, setDuration] = useState<number | null>(DEFAULT_DURATION);

    const handleClose = useCallback(
        (event?: React.SyntheticEvent | Event, reason?: string) => {
            if (reason === "clickaway") return;
            setOpen(false);
        },
        []
    );

    const showToast = useCallback(
        (
            message: string,
            type: ToastType = DEFAULT_TYPE,
            duration?: number | null
        ) => {
            setMessage(message);
            setSeverity(type as AlertColor);
            // Preserve null to allow persistent toasts, use default only if undefined
            setDuration(duration === undefined ? DEFAULT_DURATION : duration);
            setOpen(true);
        },
        [i18n.language]
    );

    const success = useCallback(
        (key: string, options?: { duration?: number | null }) => {
            showToast(
                key,
                "success",
                options?.duration ?? defaultDurations.success
            );
        },
        [showToast]
    );

    const error = useCallback(
        (key: string, options?: { duration?: number | null }) => {
            showToast(
                key,
                "error",
                options?.duration ?? defaultDurations.error
            );
        },
        [showToast]
    );

    const info = useCallback(
        (key: string, options?: { duration?: number | null }) => {
            showToast(key, "info", options?.duration ?? defaultDurations.info);
        },
        [showToast]
    );

    const warning = useCallback(
        (key: string, options?: { duration?: number | null }) => {
            showToast(
                key,
                "warning",
                options?.duration ?? defaultDurations.warning
            );
        },
        [showToast]
    );

    return (
        <ToastContext.Provider
            value={{ showToast, success, error, info, warning }}
        >
            {children}
            <Snackbar
                open={open}
                autoHideDuration={duration === null ? null : duration}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: "top",
                    horizontal: i18n.language === "he" ? "left" : "right"
                }}
                sx={{
                    // Override all positioning
                    position: "fixed !important",
                    top: "80px !important",
                    right: i18n.language === "he" ? "auto !important" : "16px !important",
                    left: i18n.language === "he" ? "16px !important" : "auto !important",
                    zIndex: "99999 !important",
                    // Use theme colors
                    backgroundColor: "transparent !important",
                    minWidth: "300px !important",
                    minHeight: "60px !important",
                    // Override any MUI defaults
                    "& .MuiSnackbar-root": {
                        position: "fixed !important",
                        top: "80px !important",
                        right: i18n.language === "he" ? "auto !important" : "16px !important",
                        left: i18n.language === "he" ? "16px !important" : "auto !important",
                        backgroundColor: "transparent !important",
                        minWidth: "300px !important",
                        minHeight: "60px !important",
                        zIndex: "99999 !important",
                    },
                    "& .MuiSnackbarContent-root": {
                        backgroundColor: "transparent !important",
                        minWidth: "300px !important",
                        minHeight: "60px !important",
                    },
                    // Apply theme-based styling to the Alert (background from theme for brightness)
                    "& .MuiAlert-root": {
                        border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)} !important`,
                        borderRadius: "8px !important",
                        boxShadow: `0 4px 12px ${alpha(theme.palette.secondary.main, 0.15)} !important`,
                        // Force RTL layout for Hebrew
                        direction: i18n.language === "he" ? "rtl !important" : "ltr !important",
                        "& .MuiAlert-icon": {
                            marginRight: i18n.language === "he" ? "8px !important" : "8px !important",
                            marginLeft: i18n.language === "he" ? "0 !important" : "0 !important",
                            order: i18n.language === "he" ? 2 : 1,
                        },
                        "& .MuiAlert-message": {
                            marginRight: i18n.language === "he" ? "0 !important" : "0 !important",
                            marginLeft: i18n.language === "he" ? "0 !important" : "0 !important",
                            order: i18n.language === "he" ? 1 : 2,
                            flex: 1,
                        },
                    }
                }}
                ClickAwayListenerProps={{ mouseEvent: false }}
            >
                <Alert
                    onClose={handleClose}
                    severity={severity}
                    icon={false}
                    sx={{
                        ...getToastStyles(
                            severity,
                            i18n.language === "he",
                            alpha(theme.palette.secondary.main, 0.9)
                        ),
                        // Override Alert component structure for Hebrew
                        "& .MuiAlert-message": {
                            marginRight: i18n.language === "he" ? "0 !important" : "8px !important",
                            marginLeft: i18n.language === "he" ? "0 !important" : "0 !important",
                            order: i18n.language === "he" ? 1 : 1,
                            flex: 1,
                        },
                        "& .MuiAlert-action": {
                            marginLeft: i18n.language === "he" ? "0 !important" : "8px !important",
                            marginRight: i18n.language === "he" ? "8px !important" : "0 !important",
                            order: 2,
                        },
                    }}
                    action={
                        <IconButton
                            size="small"
                            aria-label="close"
                            color="inherit"
                            onClick={handleClose}
                            sx={closeButtonStyles}
                        >
                            <CloseIcon sx={{ fontSize: "16px" }} />
                        </IconButton>
                    }
                >
                    <Typography
                        variant="body2"
                        sx={getMessageStyles(
                            severity,
                            alpha(theme.palette.secondary.main, 0.85)
                        )}
                    >
                        {message}
                    </Typography>
                </Alert>
            </Snackbar>
        </ToastContext.Provider>
    );
};

export const useToast = (): ToastContextType => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
};
