import AppDialog from "@/shared/layout-components/modal/AppDialog";
import {
    Audiotrack,
    Delete,
    Description,
    Download,
    Image as ImageIcon,
    Visibility
} from "@mui/icons-material";
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    IconButton,
    Typography
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useFileUpload } from "@/hooks/useFileUpload";
import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";

import AddAttachmentToActivity from "./AddAttachmentToActivity";

interface ActivityAttachment {
    id: string;
    file_name: string;
    file_path: string;
    file_size: number;
    file_type: string;
    file_category: "Text" | "Image" | "Audio";
    uploaded_by: string;
    created_at: string;
}

interface ActivityAttachmentViewerProps {
    attachments: ActivityAttachment[];
    onDeleteAttachment?: (attachmentId: string) => void;
    canDelete?: boolean;
    canAdd?: boolean;
    activityId?: string;
    onAttachmentAdded?: () => void;
}

const ActivityAttachmentViewer: React.FC<ActivityAttachmentViewerProps> = ({
    attachments,
    onDeleteAttachment,
    canDelete = false,
    canAdd = false,
    activityId,
    onAttachmentAdded,
}) => {
    const { t, i18n } = useTranslation(["activities", "common"]);
    const { getFileUrl, isS3File } = useFileUpload();
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [attachmentToDelete, setAttachmentToDelete] =
        useState<ActivityAttachment | null>(null);
    const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
    const [previewAttachment, setPreviewAttachment] =
        useState<ActivityAttachment | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
    const [urlErrors, setUrlErrors] = useState<Record<string, boolean>>({});

    // Generate file URLs when attachments change
    useEffect(() => {
        const generateUrls = async () => {
            const urls: Record<string, string> = {};
            const errors: Record<string, boolean> = {};

            for (const attachment of attachments) {
                if (isS3File(attachment.file_path)) {
                    try {
                        urls[attachment.id] = await getFileUrl(attachment.file_path);
                        errors[attachment.id] = false;
                    } catch (error) {
                        console.error(`Failed to get URL for attachment ${attachment.id}:`, error);
                        urls[attachment.id] = attachment.file_path; // Fallback to original path
                        errors[attachment.id] = true;
                    }
                } else {
                    // For local files, convert public/uploads/... to /uploads/... for web access
                    const localUrl = attachment.file_path.startsWith('public/')
                        ? attachment.file_path.replace('public/', '/')
                        : attachment.file_path;
                    urls[attachment.id] = localUrl;
                    errors[attachment.id] = false;
                }
            }
            setFileUrls(urls);
            setUrlErrors(errors);
        };

        if (attachments.length > 0) {
            generateUrls();
        }
    }, [attachments, getFileUrl, isS3File]);

    const handleDeleteClick = (attachment: ActivityAttachment) => {
        setAttachmentToDelete(attachment);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!attachmentToDelete || !onDeleteAttachment) {
            setDeleteDialogOpen(false);
            setAttachmentToDelete(null);
            return;
        }

        setIsDeleting(true);
        try {
            // Deleting attachment
            await onDeleteAttachment(attachmentToDelete.id);
            // Attachment deleted successfully
            setDeleteDialogOpen(false);
            setAttachmentToDelete(null);
        } catch (error) {
            // Error deleting attachment
            // Keep dialog open on error so user can try again
        } finally {
            setIsDeleting(false);
        }
    };

    const handlePreviewClick = (attachment: ActivityAttachment) => {
        setPreviewAttachment(attachment);
        setPreviewDialogOpen(true);
    };

    const getFileIcon = (attachment: ActivityAttachment) => {
        switch (attachment.file_category) {
            case "Image":
                return <ImageIcon fontSize="small" />;
            case "Audio":
                return <Audiotrack fontSize="small" />;
            default:
                return <Description fontSize="small" />;
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    };

    const cleanFileName = (fileName: string) => {
        // Remove UUID patterns from file name
        // UUID pattern: 8-4-4-4-12 characters (hex)
        const uuidPattern =
            /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
        let cleaned = fileName.replace(uuidPattern, "");

        // Clean up extra dashes and hyphens
        cleaned = cleaned.replace(/^-+/, ""); // Remove leading dashes
        cleaned = cleaned.replace(/-+$/, ""); // Remove trailing dashes
        cleaned = cleaned.replace(/-+/g, "-"); // Replace multiple dashes with single dash

        return cleaned.trim();
    };

    const theme = useTheme();
    const getFileCategoryChipStyle = (category: string) => {
        const palette = theme.palette.chartPalette;
        switch (category) {
            case "Image":
                return {
                    backgroundColor: palette.main,
                    color: "white",
                };
            case "Audio":
                return {
                    backgroundColor: palette.light,
                    color: "white",
                };
            default:
                return {
                    backgroundColor: palette.dark,
                    color: "white",
                };
        }
    };

    const renderPreview = (attachment: ActivityAttachment) => {
        let fileUrl = fileUrls[attachment.id] || attachment.file_path;

        // Ensure local files have the correct URL format for web access
        if (!isS3File(attachment.file_path) && fileUrl.startsWith('public/')) {
            fileUrl = fileUrl.replace('public/', '/');
        }

        if (attachment.file_category === "Image") {
            return (
                <Box sx={{ textAlign: "center" }}>
                    <img
                        src={fileUrl}
                        alt={attachment.file_name}
                        style={{
                            maxWidth: "100%",
                            maxHeight: "400px",
                            objectFit: "contain",
                        }}
                    />
                </Box>
            );
        } else if (attachment.file_category === "Audio") {
            return (
                <Box
                    sx={{
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 2,
                        p: 2,
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 2,
                            p: 2,
                            bgcolor: "grey.50",
                            borderRadius: 1,
                            border: "1px solid",
                            borderColor: "grey.200",
                            minWidth: "300px",
                        }}
                    >
                        <Audiotrack
                            sx={{
                                fontSize: 32,
                                color: "primary.main",
                            }}
                        />
                        <Box sx={{ textAlign: "left" }}>
                            <Typography
                                variant="h6"
                                sx={{
                                    fontWeight: 500,
                                    mb: 0.5,
                                    color: "text.primary",
                                }}
                            >
                                {cleanFileName(attachment.file_name)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {formatFileSize(attachment.file_size)}
                            </Typography>
                        </Box>
                    </Box>
                    <Box
                        sx={{
                            width: "100%",
                            maxWidth: "400px",
                        }}
                    >
                        <audio
                            controls
                            style={{
                                width: "100%",
                                height: "40px",
                            }}
                            preload="metadata"
                            controlsList="nodownload"
                        >
                            <source
                                src={fileUrl}
                                type={attachment.file_type}
                            />
                            Your browser does not support the audio element.
                        </audio>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                        Click play to listen to the audio file
                    </Typography>
                </Box>
            );
        } else {
            return (
                <Box sx={{ textAlign: "center" }}>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                    >
                        {t("messages.file_attachments_preview_not_available", { ns: "common" })}
                    </Typography>
                </Box>
            );
        }
    };

    // Don't render anything if this is an automated activity and there are no attachments
    if (!canAdd && attachments.length === 0) {
        return null;
    }

    return (
        <>
            <Box sx={{ mt: 1 }}>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        mb: 1,
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {(attachments.length > 0 || canAdd) && (
                            <Typography
                                variant="caption"
                                color="text.secondary"
                            >
                                {t("sections.file_attachments", { ns: "activities" })} (
                                {attachments.length})
                            </Typography>
                        )}
                        {canAdd && activityId && (
                            <AddAttachmentToActivity
                                activityId={activityId}
                                onAttachmentAdded={onAttachmentAdded}
                            />
                        )}
                        {isDeleting && (
                            <CircularProgress
                                size={12}
                                color="primary"
                            />
                        )}
                        {Object.keys(fileUrls).length < attachments.length && attachments.length > 0 && (
                            <CircularProgress
                                size={12}
                                color="primary"
                            />
                        )}
                    </Box>
                </Box>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {attachments.map((attachment) => (
                        <Box
                            key={attachment.id}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                p: 1,
                                border: 1,
                                borderColor: "grey.200",
                                borderRadius: 1,
                                backgroundColor: "background.paper",
                                "&:hover": {
                                    backgroundColor: "grey.50",
                                },
                            }}
                        >
                            {getFileIcon(attachment)}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography
                                    variant="body2"
                                    sx={{ fontWeight: 500, mb: 0.5 }}
                                >
                                    {cleanFileName(attachment.file_name)}
                                </Typography>
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                    }}
                                >
                                    <Chip
                                        label={attachment.file_category}
                                        size="small"
                                        variant="filled"
                                        sx={{
                                            fontSize: "0.6rem",
                                            height: 20,
                                            ...getFileCategoryChipStyle(
                                                attachment.file_category
                                            ),
                                        }}
                                    />
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                    >
                                        {formatFileSize(attachment.file_size)}
                                    </Typography>
                                </Box>
                            </Box>
                            <Box sx={{ display: "flex", gap: 0.5 }}>
                                <IconButton
                                    size="small"
                                    onClick={() =>
                                        handlePreviewClick(attachment)
                                    }
                                    title={t(
                                        "actions.preview",
                                        { ns: "common" }
                                    )}
                                >
                                    <Visibility fontSize="small" />
                                </IconButton>
                                <IconButton
                                    size="small"
                                    onClick={async (e) => {
                                        e.preventDefault();
                                        if (urlErrors[attachment.id]) {
                                            return;
                                        }

                                        // Use the download API endpoint directly to ensure proper download behavior
                                        const downloadUrl = `/api/activity-attachments/${attachment.id}`;

                                        try {
                                            const response = await fetch(downloadUrl, {
                                                method: 'GET',
                                                headers: {
                                                    'Cache-Control': 'no-cache',
                                                },
                                            });

                                            if (!response.ok) {
                                                throw new Error(`HTTP error! status: ${response.status}`);
                                            }

                                            const blob = await response.blob();
                                            const url = window.URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = cleanFileName(attachment.file_name);
                                            a.style.display = 'none';
                                            document.body.appendChild(a);
                                            a.click();
                                            window.URL.revokeObjectURL(url);
                                            document.body.removeChild(a);
                                        } catch (error) {
                                            console.error('Download failed:', error);
                                            // Fallback: try direct link with download attribute
                                            const a = document.createElement('a');
                                            a.href = downloadUrl;
                                            a.download = cleanFileName(attachment.file_name);
                                            a.style.display = 'none';
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                        }
                                    }}
                                    title={t(
                                        "actions.download",
                                        { ns: "common" }
                                    )}
                                    disabled={urlErrors[attachment.id]}
                                >
                                    <Download fontSize="small" />
                                </IconButton>
                                {isS3File(attachment.file_path) && urlErrors[attachment.id] && (
                                    <IconButton
                                        size="small"
                                        onClick={async () => {
                                            try {
                                                const newUrl = await getFileUrl(attachment.file_path);
                                                setFileUrls(prev => ({ ...prev, [attachment.id]: newUrl }));
                                                setUrlErrors(prev => ({ ...prev, [attachment.id]: false }));
                                            } catch (error) {
                                                console.error('Retry failed:', error);
                                            }
                                        }}
                                        title="Retry S3 URL generation"
                                        sx={{ color: 'error.main' }}
                                    >
                                        <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>
                                            ↻
                                        </Typography>
                                    </IconButton>
                                )}
                                {canDelete && (
                                    <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() =>
                                            handleDeleteClick(attachment)
                                        }
                                        title={t(
                                            "actions.delete",
                                            { ns: "common" }
                                        )}
                                    >
                                        <Delete fontSize="small" />
                                    </IconButton>
                                )}
                            </Box>
                        </Box>
                    ))}
                </Box>
            </Box>

            {/* Delete Confirmation Dialog */}
            <DeleteDialog
                isOpen={deleteDialogOpen}
                onClose={() => {
                    if (!isDeleting) {
                        setDeleteDialogOpen(false);
                        setAttachmentToDelete(null);
                    }
                }}
                onConfirm={handleDeleteConfirm}
                title={t("actions.delete_attachment", { ns: "common" })}
                description={
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            textAlign: "center",
                        }}
                    >
                        {attachmentToDelete && (
                            <Box sx={{ mb: 2, width: "100%" }}>
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1.5,
                                        p: 2,
                                        bgcolor: "grey.50",
                                        borderRadius: 1,
                                        border: "1px solid",
                                        borderColor: "grey.200",
                                    }}
                                >
                                    {getFileIcon(attachmentToDelete)}
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography
                                            variant="body1"
                                            sx={{ fontWeight: 500, mb: 0.5 }}
                                        >
                                            {cleanFileName(
                                                attachmentToDelete.file_name
                                            )}
                                        </Typography>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                            }}
                                        >
                                            <Chip
                                                label={
                                                    attachmentToDelete.file_category
                                                }
                                                size="small"
                                                variant="filled"
                                                sx={{
                                                    fontSize: "0.6rem",
                                                    height: 20,
                                                    ...getFileCategoryChipStyle(
                                                        attachmentToDelete.file_category
                                                    ),
                                                }}
                                            />
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                            >
                                                {formatFileSize(
                                                    attachmentToDelete.file_size
                                                )}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>
                            </Box>
                        )}
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ lineHeight: 1.6 }}
                        >
                            {t("messages.delete_attachment_confirmation", {
                                ns: "common",
                                defaultValue:
                                    "Are you sure you want to delete this attachment? This action cannot be undone.",
                            })}
                        </Typography>
                    </Box>
                }
                confirmLabel={t("actions.delete", { ns: "common" })}
                cancelLabel={t("actions.cancel", { ns: "common" })}
                isLoading={isDeleting}
                type="delete"
                maxWidth="sm"
            />

            {/* Preview Dialog */}
            <AppDialog
                open={previewDialogOpen}
                onClose={() => setPreviewDialogOpen(false)}
                drag={false}
                align={false}
                slide={false}
                isRTL={i18n.language === "he"}
                title={
                    previewAttachment
                        ? cleanFileName(previewAttachment.file_name)
                        : ""
                }
                titleIcon={null}
                ariaLabelledBy="attachment-preview-dialog-title"
                ariaDescribedBy="attachment-preview-dialog-description"
                maxWidth="md"
                fullWidth
                actions={
                    <>
                        <Button
                            onClick={async () => {
                                if (!previewAttachment) return;

                                const downloadUrl = `/api/activity-attachments/${previewAttachment.id}`;

                                try {
                                    const response = await fetch(downloadUrl, {
                                        method: 'GET',
                                        headers: {
                                            'Cache-Control': 'no-cache',
                                        },
                                    });

                                    if (!response.ok) {
                                        throw new Error(`HTTP error! status: ${response.status}`);
                                    }

                                    const blob = await response.blob();
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = cleanFileName(previewAttachment.file_name);
                                    a.style.display = 'none';
                                    document.body.appendChild(a);
                                    a.click();
                                    window.URL.revokeObjectURL(url);
                                    document.body.removeChild(a);
                                } catch (error) {
                                    const a = document.createElement('a');
                                    a.href = downloadUrl;
                                    a.download = cleanFileName(previewAttachment.file_name);
                                    a.style.display = 'none';
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                }
                            }}
                            startIcon={<Download />}
                            variant="outlined"
                        >
                            {t("actions.download", { ns: "common" })}
                        </Button>
                        <Button
                            onClick={() => setPreviewDialogOpen(false)}
                            variant="contained"
                        >
                            {t("actions.close", { ns: "common" })}
                        </Button>
                    </>
                }
            >
                <Box
                    id="attachment-preview-dialog-description"
                    component="div"
                    sx={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        minHeight: "200px",
                    }}
                >
                    {previewAttachment && renderPreview(previewAttachment)}
                </Box>
            </AppDialog>
        </>
    );
};

export default ActivityAttachmentViewer;
