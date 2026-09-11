"use client";

import {
    CheckCircle as CheckCircleIcon,
    Delete as DeleteIcon,
    Info as InfoIcon,
    Warning as WarningIcon,
} from "@mui/icons-material";
import {
    Box,
    Button,
    CircularProgress,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

import AppDialog from "@/shared/layout-components/modal/AppDialog";
import { getRTLTooltipProps } from "@/utils/reportFieldUtils";

export type DialogType = "delete" | "warning" | "info" | "success";

interface DeleteDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string | React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    /** Optional middle action (e.g. Skip) between Cancel and Confirm. */
    secondaryLabel?: string;
    onSecondary?: () => void;
    isLoading?: boolean;
    /** When false, confirm button does not show a loading spinner (button still disabled when isLoading). Default true. */
    showConfirmSpinner?: boolean;
    confirmDisabled?: boolean;
    /** Shown on the confirm button when it is disabled (wrapped for disabled hover). */
    confirmDisabledTooltip?: string;
    type?: DialogType;
    errorMessage?: string;
    maxWidth?: "xs" | "sm" | "md" | "lg" | "xl";
    locale?: string;
}

const getDialogWidth = (maxWidth: string) => {
    switch (maxWidth) {
        case "xs":
            return "300px";
        case "sm":
            return "380px";
        case "md":
            return "420px";
        case "lg":
            return "500px";
        case "xl":
            return "600px";
        default:
            return "380px";
    }
};

const DeleteDialog: React.FC<DeleteDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel,
    cancelLabel,
    secondaryLabel,
    onSecondary,
    isLoading = false,
    showConfirmSpinner = true,
    confirmDisabled = false,
    confirmDisabledTooltip,
    type = "delete",
    errorMessage,
    maxWidth = "xs",
    locale,
}) => {
    const theme = useTheme();
    const { t, i18n } = useTranslation(["common"]);
    const currentLocale = locale || i18n.language;
    const isRTL = currentLocale === "he";

    const getIconAndColor = () => {
        switch (type) {
            case "delete":
                return {
                    icon: <DeleteIcon aria-hidden="true" />,
                    color: theme.palette.error.main,
                    hoverColor: theme.palette.error.dark,
                };
            case "warning":
                return {
                    icon: <WarningIcon aria-hidden="true" />,
                    color: theme.palette.warning.main,
                    hoverColor: theme.palette.warning.dark,
                };
            case "info":
                return {
                    icon: <InfoIcon aria-hidden="true" />,
                    color: theme.palette.info.main,
                    hoverColor: theme.palette.info.dark,
                };
            case "success":
                return {
                    icon: <CheckCircleIcon aria-hidden="true" />,
                    color: theme.palette.success.main,
                    hoverColor: theme.palette.success.dark,
                };
            default:
                return {
                    icon: <DeleteIcon aria-hidden="true" />,
                    color: theme.palette.error.main,
                    hoverColor: theme.palette.error.dark,
                };
        }
    };

    const { icon, color, hoverColor } = getIconAndColor();
    const confirmIsDisabled = isLoading || confirmDisabled;
    const showDisabledTooltip =
        Boolean(confirmDisabledTooltip) && confirmDisabled && !isLoading;

    const confirmButton = (
        <Button
            onClick={onConfirm}
            disabled={confirmIsDisabled}
            variant="contained"
            fullWidth={false}
            className="save-button"
            endIcon={
                showConfirmSpinner && isLoading ? (
                    <CircularProgress size={16} sx={{ color: "inherit" }} />
                ) : undefined
            }
            sx={{
                backgroundColor: color,
                "&:hover": {
                    backgroundColor: hoverColor,
                },
                direction: isRTL ? "rtl" : "ltr",
                "& .MuiButton-endIcon": {
                    marginLeft: isRTL ? 0 : theme.spacing(1),
                    marginRight: isRTL ? theme.spacing(1) : 0,
                },
            }}
        >
            {confirmLabel || t("common.actions.confirm")}
        </Button>
    );

    const confirmControl = showDisabledTooltip ? (
        <Tooltip title={confirmDisabledTooltip} {...getRTLTooltipProps(i18n)}>
            <span style={{ display: "inline-flex" }}>{confirmButton}</span>
        </Tooltip>
    ) : (
        confirmButton
    );

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
            titleIcon={icon}
            ariaLabelledBy="delete-dialog-title"
            ariaDescribedBy="delete-dialog-description"
            actions={
                secondaryLabel && onSecondary ? (
                    <Box
                        sx={{
                            display: "flex",
                            width: "100%",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 1,
                            direction: isRTL ? "rtl" : "ltr",
                        }}
                    >
                        <Button
                            onClick={onClose}
                            variant="outlined"
                            size="small"
                            className="cancel-button"
                            fullWidth={false}
                            disabled={isLoading}
                        >
                            {cancelLabel || t("common.actions.cancel")}
                        </Button>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                            }}
                        >
                            <Button
                                onClick={onSecondary}
                                variant="outlined"
                                size="small"
                                fullWidth={false}
                                disabled={isLoading}
                            >
                                {secondaryLabel}
                            </Button>
                            {confirmControl}
                        </Box>
                    </Box>
                ) : (
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
                            {cancelLabel || t("common.actions.cancel")}
                        </Button>
                        {confirmControl}
                    </>
                )
            }
        >
            <Box
                sx={{
                    py: 2,
                    px: 1,
                    direction: isRTL ? "rtl" : "ltr",
                }}
            >
                {typeof description === "string" ? (
                    <Typography
                        variant="body1"
                        sx={{
                            color: "text.primary",
                            mb: 2,
                            direction: isRTL ? "rtl" : "ltr",
                        }}
                    >
                        {description}
                    </Typography>
                ) : (
                    <Box sx={{ mb: 2 }}>{description}</Box>
                )}
                {errorMessage && (
                    <Typography
                        variant="body2"
                        sx={{
                            color: "error.main",
                            direction: isRTL ? "rtl" : "ltr",
                        }}
                    >
                        {errorMessage}
                    </Typography>
                )}
            </Box>
        </AppDialog>
    );
};

export default DeleteDialog;
