"use client";
import { apiFetch } from "@/utils/apiFetch";

import { Help as HelpIcon, Person as PersonIcon } from "@mui/icons-material";
import {
    Autocomplete,
    Box,
    Button,
    TextField,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import AppDialog from "@/shared/layout-components/modal/AppDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";


// Define the props interface
interface AssignUserModelProps {
    disputeId: string | number | null;
    refreshTimeline: () => void;
    isModalOpen: boolean;
    setIsModalOpen: (_open: boolean) => void;
    selectedUser?: string | number | null;
    users: { label: string; value: string | number }[];
    customerId: string | number;
}

export default function AssignUserModel({
    disputeId,
    refreshTimeline,
    isModalOpen,
    setIsModalOpen,
    selectedUser,
    users,
    customerId,
}: AssignUserModelProps) {
    const { t, i18n } = useTranslation(["disputes", "common"]);
    const theme = useTheme();
    const { showToast } = useToast();
    const isRTL = i18n.language === "he";

    const [userComment, setUserComment] = useState("");
    const [assignedUser, setAssignedUser] = useState<{
        label: string;
        value: string | number;
    } | null>(
        selectedUser
            ? users.find((opt) => opt.value === selectedUser) || null
            : null
    );
    const [validationErrors, setValidationErrors] = useState<
        Record<string, string>
    >({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasSubmitted, setHasSubmitted] = useState(false);

    // Reset form when modal opens/closes or selectedUser changes
    useEffect(() => {
        if (isModalOpen) {
            setAssignedUser(
                selectedUser
                    ? users.find((opt) => opt.value === selectedUser) || null
                    : null
            );
            setUserComment("");
            setValidationErrors({});
            setHasSubmitted(false); // Reset submission flag when modal opens
        }
    }, [isModalOpen, selectedUser, users]);

    const handleClose = () => {
        if (!isSubmitting) {
            setIsModalOpen(false);
        }
    };

    const handleSaveComment = async () => {
        // Prevent duplicate submissions
        if (isSubmitting || hasSubmitted) {
            return;
        }

        setIsSubmitting(true);
        setValidationErrors({});
        const errors: Record<string, string> = {};

        if (!assignedUser) {
            errors.assignedUser = t(
                "messages.assign_user_user_selection_required"
            );
        }

        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            setIsSubmitting(false);
            return;
        }

        try {
            const response = await apiFetch(`/api/entities/customers/${customerId}/disputes/${disputeId}/assign-user`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        assigned_user_id: assignedUser?.value,
                        user_comment: userComment,
                    }),
                }
            );
            const data = await response.json();

            if (response.ok) {
                setHasSubmitted(true); // Mark as submitted successfully
                setUserComment("");
                refreshTimeline();
                setIsModalOpen(false);
                setAssignedUser(null);
            } else {
                throw new Error(
                    data.error || t("messages.assign_user_failed_to_assign_user")
                );
            }
        } catch (error: any) {
            console.error(
                t("messages.assign_user_failed_to_assign_user"),
                error
            );
            showToast(error.message, "error");
            setHasSubmitted(false); // Reset on error so user can retry
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AppDialog
            open={isModalOpen}
            onClose={handleClose}
            drag
            align
            slide
            isRTL={isRTL}
            paperWidth="350px"
            paperMaxHeight="90vh"
            title={t("actions.assignment_assign_user")}
            titleIcon={<PersonIcon aria-hidden="true" />}
            ariaLabelledBy="assign-user-dialog-title"
            ariaDescribedBy="assign-user-dialog-description"
            scrollContainerId="assign-user-dialog-description"
            keepMounted
            disableEnforceFocus={false}
            disableAutoFocus={false}
            actions={
                <>
                    <Button
                        onClick={handleClose}
                        disabled={isSubmitting}
                        variant="outlined"
                        size="small"
                        className="cancel-button"
                        sx={{
                            mr: i18n.language === "he" ? 0 : theme.spacing(1),
                            ml: i18n.language === "he" ? theme.spacing(1) : 0,
                        }}
                    >
                        {t("actions.cancel", { ns: "common" })}
                    </Button>
                    <Button
                        onClick={handleSaveComment}
                        disabled={isSubmitting}
                        variant="contained"
                        size="small"
                        className="save-button"
                        sx={{
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        }}
                    >
                        {t("actions.save", { ns: "common" })}
                    </Button>
                </>
            }
        >
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: { xs: 2, sm: 2.5 },
                    maxWidth: "100%",
                    mx: "auto",
                }}
            >
                {/* User Assignment Section */}
                <Box sx={{ mt: 2 }}>
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
                            {t(
                                "sections.assign_user_sections_user_assignment"
                            )}
                        </Typography>
                        <Tooltip
                            title={t(
                                "tooltips.assign_user_tooltips_user_assignment"
                            )}
                            placement="bottom"
                            arrow
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
                            />
                        </Tooltip>
                    </Box>

                    <Box className="endless-scroll-toolbar" sx={{ width: "100%" }}>
                    <Autocomplete<{ label: string; value: string | number }>
                        value={assignedUser}
                        onChange={(event, newValue) => {
                            setAssignedUser(newValue);
                            if (validationErrors.assignedUser) {
                                setValidationErrors((prev) => {
                                    const newErrors = { ...prev };
                                    delete newErrors.assignedUser;
                                    return newErrors;
                                });
                            }
                        }}
                        options={users}
                        getOptionLabel={(option) => option.label}
                        isOptionEqualToValue={(option, value) => option.value === value?.value}
                        disabled={isSubmitting}
                        dir={i18n.language === "he" ? "rtl" : "ltr"}
                        {...(i18n.language === "he" && {
                            "data-hebrew": true,
                            "data-rtl": true,
                        })}
                        sx={{
                            width: "100%",
                        }}
                        renderInput={(params: any) => (
                            <TextField
                                {...params}
                                label={t("fields.assign_user_select_user")}
                                required
                                error={!!validationErrors.assignedUser}
                                helperText={validationErrors.assignedUser}
                                dir={i18n.language === "he" ? "rtl" : "ltr"}
                                {...(i18n.language === "he" && {
                                    "data-hebrew": true,
                                    "data-rtl": true,
                                })}
                            />
                        )}
                        renderOption={(props: any, option: { label: string; value: string | number }) => {
                            const { key, ...otherProps } = props;
                            return (
                                <li
                                    key={key}
                                    {...otherProps}
                                    style={{
                                        direction: i18n.language === "he" ? "rtl" : "ltr",
                                        textAlign: i18n.language === "he" ? "right" : "left",
                                        display: "flex",
                                        alignItems: "center",
                                        minHeight: "48px",
                                        padding: "8px 16px",
                                    }}
                                >
                                    <Typography
                                        sx={{
                                            direction: i18n.language === "he" ? "rtl" : "ltr",
                                            textAlign: i18n.language === "he" ? "right" : "left",
                                            width: "100%",
                                        }}
                                    >
                                        {option.label}
                                    </Typography>
                                </li>
                            );
                        }}
                        noOptionsText={t("messages.no_options", { ns: "common" })}
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
                            {t("sections.assign_user_sections_comment")}
                        </Typography>
                        <Tooltip
                            title={t(
                                "tooltips.assign_user_tooltips_comment"
                            )}
                            placement="bottom"
                            arrow
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
                            />
                        </Tooltip>
                    </Box>

                    <TextField
                        multiline
                        rows={3}
                        label={t("fields.assign_user_comment")}
                        value={userComment}
                        onChange={(e) => setUserComment(e.target.value)}
                        placeholder={t(
                            "fields.assign_user_enter_user_comment"
                        )}
                        error={!!validationErrors.userComment}
                        helperText={validationErrors.userComment}
                        fullWidth
                        disabled={isSubmitting}
                        {...(i18n.language === "he" && { "data-hebrew": true, multiline: true })}
                    />
                </Box>
            </Box>
        </AppDialog>
    );
}
