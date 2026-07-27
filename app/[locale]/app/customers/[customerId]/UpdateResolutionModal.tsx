"use client";
import { apiFetch } from "@/utils/apiFetch";

import {
    Gavel as GavelIcon,
    Help as HelpIcon,
    Cancel as CancelIcon,
    Error as ErrorIcon,
} from "@mui/icons-material";
import {
    Button,
    TextField,
    Box,
    Typography,
    Tooltip,
    Autocomplete,
    useTheme,
} from "@mui/material";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import AppDialog from "@/shared/layout-components/modal/AppDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";

// =========================
// ✅ Type Declarations
// =========================

interface ResolutionOption {
    value: string;
    label: string;
}

interface Props {
    customerId: number;
    disputeId?: number | null;
    isModalOpen: boolean;
    setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    disputeResolution: string | null;
    setDisputeResolution: (val: string) => void;
    resolutionOptions: ResolutionOption[];
    title?: string;
}

// =========================
// ✅ Helper Functions
// =========================

// Map display values to enum values
const mapDisplayValueToEnum = (displayValue: string): string => {
    const mapping: Record<string, string> = {
        "Accepted - Settled partly": "Accepted_Settled_partly",
        "Accepted -  Settled in full": "Accepted_Settled_in_full",
        "Admin Fixed – Balance Unchanged": "Admin_Fixed_Balance_Unchanged",
        Denied: "Denied",
        Cancelled: "Cancelled",
        Accepted: "Accepted",
    };

    // If the value is already a correct enum value, return it as is
    if (Object.values(mapping).includes(displayValue)) {
        return displayValue;
    }

    // Handle legacy enum values with multiple underscores (for backward compatibility during migration)
    const legacyMapping: Record<string, string> = {
        Accepted___Settled_partly: "Accepted_Settled_partly",
        Accepted____Settled_in_full: "Accepted_Settled_in_full",
        Admin_Fixed___Balance_Unchanged: "Admin_Fixed_Balance_Unchanged",
    };

    // Check if it's a legacy enum value with multiple underscores
    if (legacyMapping[displayValue]) {
        return legacyMapping[displayValue];
    }

    // Otherwise, try to map from display value to enum value
    return mapping[displayValue] || displayValue;
};

// Map enum values to display values
const mapEnumToDisplayValue = (enumValue: string): string => {
    const mapping: Record<string, string> = {
        Accepted_Settled_partly: "Accepted - Settled partly",
        Accepted_Settled_in_full: "Accepted -  Settled in full",
        Admin_Fixed_Balance_Unchanged: "Admin Fixed – Balance Unchanged",
        Denied: "Denied",
        Cancelled: "Cancelled",
        Accepted: "Accepted",
        // Legacy support for multiple underscores (during migration period)
        Accepted___Settled_partly: "Accepted - Settled partly",
        Accepted____Settled_in_full: "Accepted -  Settled in full",
        Admin_Fixed___Balance_Unchanged: "Admin Fixed – Balance Unchanged",
    };
    return mapping[enumValue] || enumValue;
};

// =========================
// ✅ Component
// =========================

const UpdateResolutionModal: React.FC<Props> = ({
    customerId,
    disputeId,
    isModalOpen,
    setIsModalOpen,
    disputeResolution,
    setDisputeResolution,
    resolutionOptions,
    title = "Update Resolution",
}) => {
    const { t, i18n } = useTranslation(["disputes", "common"]);
    const { showToast } = useToast();
    const theme = useTheme();
    const isRTL = i18n.language === "he";

    const [resolutionComment, setResolutionComment] = useState<string>("");
    const [validationErrors, setValidationErrors] = useState<
        Record<string, string>
    >({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isCancelMode = title === "Cancel Dispute";
    const [resolution, setResolution] = useState<ResolutionOption | null>(
        isCancelMode
            ? resolutionOptions.find((opt) => opt.value === "Cancelled") || null
            : resolutionOptions.find(
                (opt) => opt.value === disputeResolution
            ) ||
            resolutionOptions[0] ||
            null
    );



    // Reset form when modal opens/closes
    useEffect(() => {
        if (isModalOpen) {
            if (isCancelMode) {
                const cancelOption =
                    resolutionOptions.find(
                        (opt) => opt.value === "Cancelled"
                    ) || null;
                setResolution(cancelOption);
            } else {
                // Since resolutionOptions already use enum values, we can directly find the option
                // If no current resolution, leave dropdown empty
                const selectedOption =
                    resolutionOptions.find(
                        (opt) => opt.value === disputeResolution
                    ) || null;
                setResolution(selectedOption);
            }
            setResolutionComment("");
            setValidationErrors({});
        }
    }, [isModalOpen, isCancelMode, disputeResolution, resolutionOptions]);

    const handleClose = () => {
        if (!isSubmitting) {
            setIsModalOpen(false);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === "Escape") {
            handleClose();
        }
    };

    const handleSubmit = async () => {
        // Prevent duplicate submissions
        if (isSubmitting) {
            return;
        }

        setIsSubmitting(true);
        setValidationErrors({});
        const errors: Record<string, string> = {};

        if (!resolution || !resolution.value) {
            errors.resolution = t("messages.resolution_resolution_required");
        }

        // Validate required parameters
        if (!customerId || customerId === 0) {
            errors.general = t("messages.resolution_customer_id_required");
        }

        if (disputeId === null || disputeId === undefined) {
            errors.general = t("messages.resolution_dispute_id_required");
        }

        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            setIsSubmitting(false);
            return;
        }

        // Ensure we have a valid resolution value
        const resolutionValue = mapDisplayValueToEnum(resolution?.value || "");

        if (!resolutionValue) {
            errors.resolution = t("messages.resolution_resolution_required");
            setValidationErrors(errors);
            setIsSubmitting(false);
            return;
        }

        try {
            let response: Response;
            const requestBody = isCancelMode
                ? {
                    dispute_status: "Cancelled",
                    dispute_comment: resolutionComment,
                    dispute_resolution: resolutionValue,
                }
                : {
                    dispute_resolution: resolutionValue,
                    comment: resolutionComment,
                };

            if (isCancelMode) {
                // Cancel dispute flow
                response = await apiFetch(`/api/entities/customers/${customerId}/disputes/${disputeId}/cancel-dispute`,
                    {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(requestBody),
                    }
                );
            } else {
                // Update resolution
                response = await apiFetch(`/api/entities/customers/${customerId}/disputes/${disputeId}/update-resolution`,
                    {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(requestBody),
                    }
                );
            }

            const data = await response.json();

            if (response.ok) {
                showToast(
                    isCancelMode
                        ? t(
                            "messages.resolution_dispute_cancelled_successfully"
                        )
                        : t("messages.resolution_updated_successfully"),
                    "success"
                );

                setResolution(null);
                setResolutionComment("");
                setDisputeResolution(resolutionValue);
                setIsModalOpen(false);
            } else {
                throw new Error(
                    data.error ||
                    t("messages.resolution_failed_to_update_resolution")
                );
            }
        } catch (error: any) {
            showToast(error.message, "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const getModalTitle = () => {
        if (isCancelMode) {
            return t("actions.resolution_cancel_dispute");
        }
        return t("actions.resolution_update_resolution");
    };

    const getSubmitLabel = () => {
        return t("actions.save", { ns: "common" });
    };

    return (
        <AppDialog
            open={isModalOpen}
            onClose={handleClose}
            onKeyDown={handleKeyDown}
            drag
            align
            slide
            isRTL={isRTL}
            paperWidth="350px"
            paperMaxHeight="90vh"
            title={getModalTitle()}
            titleIcon={
                isCancelMode ? (
                    <CancelIcon aria-hidden="true" />
                ) : (
                    <GavelIcon aria-hidden="true" />
                )
            }
            ariaLabelledBy="resolution-dialog-title"
            ariaDescribedBy="resolution-dialog-description"
            keepMounted
            disableRestoreFocus
            disableAutoFocus
            actions={
                <>
                    <Button
                        onClick={handleClose}
                        disabled={isSubmitting}
                        variant="outlined"
                        size="small"
                        className="cancel-button"
                        tabIndex={0}
                        sx={{
                            mr: i18n.language === "he" ? 0 : theme.spacing(1),
                            ml: i18n.language === "he" ? theme.spacing(1) : 0,
                        }}
                    >
                        {t("actions.cancel", { ns: "common" })}
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        variant="contained"
                        size="small"
                        color={isCancelMode ? "error" : "primary"}
                        className={isCancelMode ? undefined : "save-button"}
                        tabIndex={0}
                    >
                        {getSubmitLabel()}
                    </Button>
                </>
            }
        >
            <Box
                id="resolution-dialog-description"
                sx={{
                    paddingTop: theme.spacing(2),
                    direction: isRTL ? "rtl" : "ltr",
                }}
            >
                {/* Spacer for visual separation */}
                <Box sx={{ height: 8 }} />

                {/* General Error Display */}
                {validationErrors.general && (
                    <Box
                        sx={{
                            mb: 2,
                            p: 2,
                            bgcolor: "error.light",
                            color: "error.contrastText",
                            borderRadius: 1,
                            border: 1,
                            borderColor: "error.main",
                        }}
                    >
                        <Typography
                            variant="body2"
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                            }}
                        >
                            <ErrorIcon fontSize="small" />
                            {validationErrors.general}
                        </Typography>
                    </Box>
                )}

                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: { xs: 2, sm: 2.5 },
                        maxWidth: "100%",
                        mx: "auto",
                    }}
                >
                    {/* Resolution Selection Section */}
                    <Box>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                mb: 1,
                                color: "primary.main",
                            }}
                        >
                            <Typography variant="subtitle2" fontWeight={600}>
                                {t("sections.resolution_sections_resolution")}
                            </Typography>
                            <Tooltip
                                title={t(
                                    "tooltips.resolution_tooltips_resolution"
                                )}
                                placement="bottom"
                                arrow
                            >
                                <Box
                                    component="span"
                                    sx={{ display: "inline-flex" }}
                                >
                                    <HelpIcon
                                        sx={{
                                            fontSize: {
                                                xs: "0.875rem",
                                                sm: "1rem",
                                            },
                                            color: "primary.main",
                                            cursor: "help",
                                            opacity: 0.7,
                                            "&:hover": {
                                                opacity: 1,
                                            },
                                        }}
                                        tabIndex={-1}
                                        aria-hidden="true"
                                    />
                                </Box>
                            </Tooltip>
                        </Box>

                        <Box className="endless-scroll-toolbar" sx={{ width: "100%" }}>
                        <Autocomplete<ResolutionOption>
                            value={resolution}
                            onChange={(event, newValue) => {
                                setResolution(newValue);
                                if (validationErrors.resolution) {
                                    setValidationErrors((prev) => {
                                        const newErrors = { ...prev };
                                        delete newErrors.resolution;
                                        return newErrors;
                                    });
                                }
                            }}
                            options={resolutionOptions}
                            getOptionLabel={(option: ResolutionOption) =>
                                option.label
                            }
                            isOptionEqualToValue={(
                                option: ResolutionOption,
                                value: ResolutionOption
                            ) => option.value === value?.value}
                            disabled={isSubmitting}
                            size="small"
                            dir={i18n.language === "he" ? "rtl" : "ltr"}
                            {...(i18n.language === "he" && {
                                "data-hebrew": true,
                                "data-rtl": true,
                            })}
                            sx={{
                                width: "100%",
                                mb: validationErrors.resolution ? 0 : 1,
                            }}
                            renderInput={(params: any) => (
                                <TextField
                                    {...params}
                                    label={t("fields.resolution_resolution")}
                                    error={!!validationErrors.resolution}
                                    helperText={validationErrors.resolution}
                                    required
                                    size="small"
                                    fullWidth
                                    dir={i18n.language === "he" ? "rtl" : "ltr"}
                                    {...(i18n.language === "he" && {
                                        "data-hebrew": true,
                                        "data-rtl": true,
                                    })}
                                />
                            )}
                            renderOption={(
                                props: any,
                                option: ResolutionOption
                            ) => {
                                const { key, ...otherProps } = props;
                                return (
                                    <li
                                        key={key}
                                        {...otherProps}
                                        style={{
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                            display: "flex",
                                            alignItems: "center",
                                            minHeight: "48px",
                                            padding: "8px 16px",
                                        }}
                                    >
                                        <Typography
                                            sx={{
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                                textAlign:
                                                    i18n.language === "he"
                                                        ? "right"
                                                        : "left",
                                                width: "100%",
                                            }}
                                        >
                                            {option.label}
                                        </Typography>
                                    </li>
                                );
                            }}
                            noOptionsText={t(
                                "fields.resolution_no_resolution_options"
                            )}
                        />
                        </Box>
                    </Box>

                    {/* Comment Section */}
                    <Box>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                mb: 1,
                                color: "primary.main",
                            }}
                        >
                            <Typography variant="subtitle2" fontWeight={600}>
                                {t("sections.resolution_sections_comment")}
                            </Typography>
                            <Tooltip
                                title={t(
                                    "tooltips.resolution_tooltips_comment"
                                )}
                                placement="bottom"
                                arrow
                            >
                                <Box
                                    component="span"
                                    sx={{ display: "inline-flex" }}
                                >
                                    <HelpIcon
                                        sx={{
                                            fontSize: {
                                                xs: "0.875rem",
                                                sm: "1rem",
                                            },
                                            color: "primary.main",
                                            cursor: "help",
                                            opacity: 0.7,
                                            "&:hover": {
                                                opacity: 1,
                                            },
                                        }}
                                        tabIndex={-1}
                                        aria-hidden="true"
                                    />
                                </Box>
                            </Tooltip>
                        </Box>

                        <TextField
                            multiline
                            rows={3}
                            label={t("fields.resolution_resolution_comment")}
                            value={resolutionComment}
                            onChange={(e) =>
                                setResolutionComment(e.target.value)
                            }
                            size="small"
                            error={!!validationErrors.resolutionComment}
                            helperText={validationErrors.resolutionComment}
                            fullWidth
                            disabled={isSubmitting}
                            {...(i18n.language === "he" && {
                                "data-hebrew": true,
                                multiline: true,
                            })}
                        />
                    </Box>
                </Box>
            </Box>
        </AppDialog>
    );
};

export default UpdateResolutionModal;
