import { apiFetch } from "@/utils/apiFetch";
import AppDialog from "@/shared/layout-components/modal/AppDialog";
import { AttachFile } from "@mui/icons-material";
import {
    Button,
    CircularProgress,
    IconButton,
    Tooltip
} from "@mui/material";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import ModalScrollBox from "@/shared/layout-components/modal/ModalScrollBox";

import ActivityFileUploader from "./ActivityFileUploader";

const ADD_ATTACHMENT_SCROLL_ID = "add-attachment-dialog-scroll";

interface AddAttachmentToActivityProps {
    activityId: string;
    onAttachmentAdded?: () => void;
    disabled?: boolean;
}

const AddAttachmentToActivity: React.FC<AddAttachmentToActivityProps> = ({
    activityId,
    onAttachmentAdded,
    disabled = false,
}) => {
    const { t, i18n } = useTranslation(["activities", "common"]);
    const { error: showError, success: showSuccess } = useToast();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileSelected = (file: File) => {
        setSelectedFiles((prev) => [...prev, file]);
    };

    const handleFileRemoved = (file: File) => {
        setSelectedFiles((prev) => prev.filter((f) => f !== file));
    };

    const handleUpload = async () => {
        if (selectedFiles.length === 0) return;

        setIsUploading(true);

        try {
            const formData = new FormData();
            formData.append("activityId", activityId);

            selectedFiles.forEach((file) => {
                formData.append("files", file);
            });

            const response = await apiFetch("/api/activity-attachments",
                {
                    method: "POST",
                    body: formData,
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                const errorMessage =
                    errorData.error || "Failed to add attachments";
                const errorDetails = errorData.details || "";

                // Create a more user-friendly error message
                let fullErrorMessage = errorMessage;
                if (errorDetails) {
                    fullErrorMessage += `\n\nDetails: ${errorDetails}`;
                }

                showError(fullErrorMessage);
                return;
            }

            const result = await response.json();
            showSuccess(result.message);

            // Clear selected files
            setSelectedFiles([]);

            // Close dialog after a short delay
            setTimeout(() => {
                setDialogOpen(false);
                if (onAttachmentAdded) {
                    onAttachmentAdded();
                }
            }, 1500);
        } catch (error) {
            console.error("Error adding attachments:", error);
            showError(
                error instanceof Error
                    ? error.message
                    : "Failed to add attachments"
            );
        } finally {
            setIsUploading(false);
        }
    };

    const handleClose = () => {
        if (!isUploading) {
            setDialogOpen(false);
            setSelectedFiles([]);
        }
    };

    return (
        <>
            <Tooltip title={t("actions.add_attachment", { ns: "common" })}>
                <IconButton
                    size="small"
                    onClick={() => setDialogOpen(true)}
                    disabled={disabled}
                    aria-label={t("actions.add_attachment", { ns: "common" })}
                    sx={{
                        color: "primary.main",
                        "&:hover": {
                            bgcolor: "primary.main",
                            color: "primary.contrastText",
                        },
                    }}
                >
                    <AttachFile fontSize="small" />
                </IconButton>
            </Tooltip>

            <AppDialog
                open={dialogOpen}
                onClose={handleClose}
                drag
                align
                slide
                isRTL={i18n.language === "he"}
                title={t("actions.add_attachment_to_activity", { ns: "common" })}
                titleIcon={null}
                ariaLabelledBy="add-attachment-dialog-title"
                ariaDescribedBy={ADD_ATTACHMENT_SCROLL_ID}
                scrollContainerId={ADD_ATTACHMENT_SCROLL_ID}
                paperWidth="360px"
                paperMaxHeight="90vh"
                actions={
                    <>
                        <Button
                            onClick={handleClose}
                            disabled={isUploading}
                            variant="outlined"
                            sx={{
                                mr: i18n.language === "he" ? 0 : 1,
                                ml: i18n.language === "he" ? 1 : 0,
                            }}
                        >
                            {t("actions.cancel", { ns: "common" })}
                        </Button>
                        {selectedFiles.length > 0 && (
                            <Button
                                onClick={handleUpload}
                                variant="contained"
                                disabled={isUploading}
                                startIcon={
                                    isUploading ? (
                                        <CircularProgress size={16} />
                                    ) : undefined
                                }
                                sx={{
                                    "& .MuiButton-startIcon": {
                                        marginRight: i18n.language === "he" ? 0 : "8px",
                                        marginLeft: i18n.language === "he" ? "8px" : 0,
                                    },
                                }}
                            >
                                {isUploading
                                    ? t("messages.file_attachments_uploading_files", { ns: "common" })
                                    : t("actions.upload_files", { ns: "common" })}
                            </Button>
                        )}
                    </>
                }
            >
                <ModalScrollBox
                    id={ADD_ATTACHMENT_SCROLL_ID}
                    isRTL={i18n.language === "he"}
                    sx={{ mt: 1 }}
                >
                    <ActivityFileUploader
                        onFileSelected={handleFileSelected}
                        onFileRemoved={handleFileRemoved}
                        selectedFiles={selectedFiles}
                        isUploading={isUploading}
                        maxFileSize={5 * 1024 * 1024} // 5MB
                        maxFiles={5}
                    />
                </ModalScrollBox>
            </AppDialog>
        </>
    );
};

export default AddAttachmentToActivity;
