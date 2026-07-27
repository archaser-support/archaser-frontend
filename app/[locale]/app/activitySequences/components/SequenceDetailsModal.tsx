"use client";

import { Info as InfoIcon } from "@mui/icons-material";
import {
    Box,
    Button,
    CircularProgress,
    FormControlLabel,
    Switch,
    TextField,
    Typography,
    useTheme,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import api from "@/app/api";
import AppDialog from "@/shared/layout-components/modal/AppDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { CategoryType, SequenceContainer } from "@/types/SequenceContainer";

interface SequenceDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    sequence: SequenceContainer | null;
    category: CategoryType;
    onSave?: () => void;
    allSequences?: SequenceContainer[]; // All sequences to check for existing defaults
}

export default function SequenceDetailsModal({
    isOpen,
    onClose,
    sequence: propSequence,
    category,
    onSave,
    allSequences = [],
}: SequenceDetailsModalProps) {
    const { t, i18n } = useTranslation(["common", "activity_sequences"]);
    const { showToast } = useToast();
    const theme = useTheme();
    const isRTL = i18n.language === "he";

    const [, setIsEditing] = useState(true);
    const [editName, setEditName] = useState(propSequence?.name || "");
    const [editActive, setEditActive] = useState(propSequence?.active || false);
    const [editIsDefault, setEditIsDefault] = useState(
        propSequence?.is_default || false
    );
    const [isSaving, setIsSaving] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    // Initialize form data when sequence prop changes
    useEffect(() => {
        if (propSequence) {
            setEditName(propSequence.name);
            setEditActive(propSequence.active);
            setEditIsDefault(propSequence.is_default);
        }
    }, [propSequence]);

    // Initialize form data when modal opens
    useEffect(() => {
        if (isOpen && propSequence) {
            setEditName(propSequence.name || "");
            setEditActive(propSequence.active || false);
            setEditIsDefault(propSequence.is_default || false);
            setValidationError(null); // Clear any previous validation errors
        }
    }, [isOpen, propSequence]);

    const handleClose = useCallback(() => {
        setIsEditing(true);
        setValidationError(null);
        onClose();
    }, [onClose]);

    const handleSaveEdit = useCallback(async () => {
        if (!propSequence || !editName.trim()) {
            showToast(
                t(
                    "validation.activity_sequences_sequence_container_name_required",
                    { ns: "activity_sequences" }
                ),
                "error"
            );
            return;
        }

        setIsSaving(true);
        try {
            // If setting this sequence as default, first unset any existing default
            if (editIsDefault && !propSequence.is_default) {
                const currentDefault = allSequences.find(
                    (s) => s.is_default && s.id !== propSequence.id
                );
                if (currentDefault) {
                    await api.put(`/sequenceContainers/${currentDefault.id}`, {
                        name: currentDefault.name,
                        active: currentDefault.active,
                        is_default: false,
                    });
                }
            }

            // Update the current sequence
            await api.put(`/sequenceContainers/${propSequence.id}`, {
                name: editName.trim(),
                active: editActive,
                is_default: editIsDefault,
            });

            showToast(
                t(
                    "messages.activity_sequences_sequence_container_update_success",
                    { ns: "activity_sequences" }
                ),
                "success"
            );

            // Refresh parent data
            if (onSave) {
                onSave();
            }

            // Close modal after successful save
            handleClose();
        } catch (error: any) {
            showToast(
                error.response?.data?.error ||
                t(
                    "messages.activity_sequences_sequence_container_error_updating_sequence",
                    { ns: "activity_sequences" }
                ),
                "error"
            );
        } finally {
            setIsSaving(false);
        }
    }, [
        propSequence,
        editName,
        editIsDefault,
        editActive,
        allSequences,
        showToast,
        t,
        onSave,
        handleClose,
    ]);

    return (
        <AppDialog
            open={isOpen}
            onClose={handleClose}
            drag
            align
            slide
            isRTL={isRTL}
            paperWidth="360px"
            paperMaxHeight="70vh"
            title={t(
                "fields.activity_sequences_sequence_container_sequence_details",
                { ns: "activity_sequences" }
            )}
            titleIcon={<InfoIcon aria-hidden="true" />}
            ariaLabelledBy="sequence-details-modal-title"
            ariaDescribedBy="sequence-details-dialog-description"
            keepMounted
            actions={
                <>
                    <Button
                        onClick={handleClose}
                        variant="outlined"
                        size="small"
                        className="cancel-button"
                        disabled={isSaving}
                        sx={{
                            mr: i18n.language === "he" ? 0 : theme.spacing(1),
                            ml: i18n.language === "he" ? theme.spacing(1) : 0,
                        }}
                    >
                        {t("actions.cancel", { ns: "common" })}
                    </Button>
                    <Button
                        variant="contained"
                        size="small"
                        onClick={
                            !editName.trim() || isSaving
                                ? undefined
                                : handleSaveEdit
                        }
                        fullWidth={false}
                        className="save-button"
                        endIcon={
                            isSaving ? (
                                <CircularProgress
                                    size={16}
                                    sx={{ color: "inherit" }}
                                />
                            ) : undefined
                        }
                        disabled={!editName.trim() || isSaving}
                        sx={{
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            "& .MuiButton-endIcon": {
                                marginLeft:
                                    i18n.language === "he" ? 0 : theme.spacing(1),
                                marginRight:
                                    i18n.language === "he"
                                        ? theme.spacing(1)
                                        : 0,
                            },
                        }}
                    >
                        {t("actions.save", { ns: "common" })}
                    </Button>
                </>
            }
        >
            {propSequence ? (
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: theme.spacing(1.5),
                            maxWidth: "500px",
                            mx: "auto",
                        }}
                    >
                        {/* Basic Information Section */}
                        <Box sx={{ mt: theme.spacing(2) }}>
                            <Box
                                sx={{
                                    display: "grid",
                                    gap: 2,
                                    bgcolor: "background.default",
                                    borderRadius: 1,
                                    "@media (min-width: 600px)": {
                                        gridTemplateColumns: "1fr",
                                        padding: "8px",
                                    },
                                    "@media (max-width: 599px)": {
                                        gridTemplateColumns: "1fr",
                                        padding: "6px",
                                    },
                                }}
                            >
                                {/* Name Field */}
                                <TextField
                                    label={t(
                                        "fields.activity_sequences_sequence_container_name",
                                        { ns: "activity_sequences" }
                                    )}
                                    value={editName}
                                    onChange={(e) =>
                                        setEditName(e.target.value)
                                    }
                                    fullWidth
                                    required
                                    dir={i18n.language === "he" ? "rtl" : "ltr"}
                                    {...(i18n.language === "he" && {
                                        "data-hebrew": true,
                                    })}
                                />

                                {/* Switches */}
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 2,
                                    }}
                                >
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "flex-start",
                                            gap: 2,
                                        }}
                                    >
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={editActive}
                                                    onChange={(e) => {
                                                        // If trying to set inactive but is default, prevent it
                                                        if (
                                                            !e.target.checked &&
                                                            editIsDefault
                                                        ) {
                                                            const errorMessage =
                                                                t(
                                                                    "messages.activity_sequences_sequence_container_cannot_deactivate_default",
                                                                    {
                                                                        ns: "activity_sequences",
                                                                    }
                                                                ) ||
                                                                "Cannot deactivate default sequence";
                                                            setValidationError(
                                                                errorMessage
                                                            );
                                                            return;
                                                        }
                                                        setEditActive(
                                                            e.target.checked
                                                        );
                                                        setValidationError(
                                                            null
                                                        );
                                                    }}
                                                    color="primary"
                                                    disabled={
                                                        editIsDefault &&
                                                        !editActive
                                                    }
                                                />
                                            }
                                            label={
                                                <Typography>
                                                    {editActive
                                                        ? t(
                                                            "values.status_active",
                                                            { ns: "common" }
                                                        )
                                                        : t(
                                                            "values.status_inactive",
                                                            { ns: "common" }
                                                        )}
                                                </Typography>
                                            }
                                            sx={{
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                                textAlign:
                                                    i18n.language === "he"
                                                        ? "right"
                                                        : "left",
                                            }}
                                        />
                                        {validationError && (
                                            <Typography
                                                variant="caption"
                                                color="error"
                                                sx={{
                                                    mt: 1, // Align with switch
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                }}
                                            >
                                                {validationError}
                                            </Typography>
                                        )}
                                    </Box>
                                    {category === "Automated" && (
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={editIsDefault}
                                                    onChange={(e) =>
                                                        setEditIsDefault(
                                                            e.target.checked
                                                        )
                                                    }
                                                    color="primary"
                                                    disabled={
                                                        propSequence?.is_default ||
                                                        false
                                                    } // Read-only if already default
                                                    {...(i18n.language ===
                                                        "he" && {
                                                        "data-rtl": true,
                                                    })}
                                                />
                                            }
                                            label={
                                                <Typography>
                                                    {editIsDefault
                                                        ? t(
                                                            "values.activity_sequences_sequence_container_default",
                                                            {
                                                                ns: "activity_sequences",
                                                            }
                                                        )
                                                        : t(
                                                            "values.activity_sequences_sequence_container_not_default",
                                                            {
                                                                ns: "activity_sequences",
                                                            }
                                                        )}
                                                </Typography>
                                            }
                                            sx={{
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                                textAlign:
                                                    i18n.language === "he"
                                                        ? "right"
                                                        : "left",
                                                opacity:
                                                    propSequence?.is_default
                                                        ? 0.6
                                                        : 1, // Visual indication of read-only
                                            }}
                                        />
                                    )}
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                ) : null}
        </AppDialog>
    );
}
