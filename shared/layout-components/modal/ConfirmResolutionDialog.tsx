"use client";

import { CheckCircle as CheckCircleIcon } from "@mui/icons-material";
import {
    Box,
    Button,
    CircularProgress,
    Typography,
    useTheme,
} from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

import AppDialog from "@/shared/layout-components/modal/AppDialog";


interface ConfirmResolutionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string | React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    isLoading?: boolean;
    errorMessage?: string;
    maxWidth?: "xs" | "sm" | "md" | "lg" | "xl";
    locale?: string;
}

const getDialogWidth = (maxWidth: string) => {
    switch (maxWidth) {
        case "xs":
            return "360px";
        case "sm":
            return "420px";
        case "md":
            return "500px";
        case "lg":
            return "600px";
        case "xl":
            return "800px";
        default:
            return "420px";
    }
};

const ConfirmResolutionDialog: React.FC<ConfirmResolutionDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel,
    cancelLabel,
    isLoading = false,
    errorMessage,
    maxWidth = "sm",
    locale,
}) => {
    const theme = useTheme();
    const { t, i18n } = useTranslation(["common"]);
    const currentLocale = locale || i18n.language;
    const isRTL = currentLocale === "he";



    return (
        <AppDialog
            open={isOpen}
            onClose={onClose}
            drag
            align
            slide
            isRTL={isRTL}
            paperWidth={getDialogWidth(maxWidth)}
            paperMaxHeight="90vh"
            title={title}
            titleIcon={<CheckCircleIcon aria-hidden="true" />}
            ariaLabelledBy="confirm-resolution-dialog-title"
            ariaDescribedBy="confirm-resolution-dialog-description"
            scrollContainerId="confirm-resolution-dialog-description"
            actions={
                <>
                    <Button
                        onClick={onClose}
                        variant="outlined"
                        size="small"
                        className="cancel-button"
                        fullWidth={false}
                        disabled={isLoading}
                        sx={{
                            mr: isRTL ? 0 : theme.spacing(1),
                            ml: isRTL ? theme.spacing(1) : 0,
                        }}
                    >
                        {cancelLabel || t("actions.cancel", { ns: "common" })}
                    </Button>
                    <Button
                        onClick={onConfirm}
                        disabled={isLoading}
                        variant="contained"
                        size="small"
                        className="save-button"
                        fullWidth={false}
                        endIcon={
                            isLoading ? (
                                <CircularProgress
                                    size={16}
                                    sx={{ color: "inherit" }}
                                />
                            ) : undefined
                        }
                        sx={{
                            direction: isRTL ? "rtl" : "ltr",
                            "& .MuiButton-endIcon": {
                                marginLeft: isRTL ? 0 : theme.spacing(1),
                                marginRight: isRTL ? theme.spacing(1) : 0,
                            },
                        }}
                    >
                        {confirmLabel || t("actions.save", { ns: "common" })}
                    </Button>
                </>
            }
        >
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: theme.spacing(1.5),
                    maxWidth: "500px",
                    mx: "auto",
                    direction: currentLocale === "he" ? "rtl" : "ltr",
                }}
            >
                <Box
                    sx={{
                        bgcolor: theme.palette.background.default,
                        borderRadius: theme.shape.borderRadius,
                        p: {
                            xs: theme.spacing(0.75),
                            sm: theme.spacing(1),
                        },
                        direction: currentLocale === "he" ? "rtl" : "ltr",
                    }}
                >
                    {typeof description === "string" ? (
                        <Typography
                            variant="body1"
                            sx={{
                                textAlign:
                                    currentLocale === "he" ? "right" : "left",
                                color: "text.primary",
                                direction:
                                    currentLocale === "he" ? "rtl" : "ltr",
                            }}
                        >
                            {description}
                        </Typography>
                    ) : (
                        <Box>{description}</Box>
                    )}
                    {errorMessage && (
                        <Typography
                            variant="body2"
                            sx={{
                                textAlign:
                                    currentLocale === "he" ? "right" : "left",
                                color: "error.main",
                                mt: theme.spacing(1),
                                direction:
                                    currentLocale === "he" ? "rtl" : "ltr",
                            }}
                        >
                            {errorMessage}
                        </Typography>
                    )}
                </Box>
            </Box>
        </AppDialog>
    );
};

export default ConfirmResolutionDialog;
