import {
    AttachFile,
    Delete,
    FilePresent,
    Image as ImageIcon,
    Audiotrack,
    Description,
    CloudUpload,
    Add,
    CheckCircle,
} from "@mui/icons-material";
import {
    Box,
    Typography,
    Button,
    IconButton,
    Alert,
    LinearProgress,
    Paper,
    Chip,
    Fade,
    alpha,
    CircularProgress,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import React, { ChangeEvent, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useToast } from "@/shared/layout-components/toast/ToastProvider";

interface ActivityFileUploaderProps {
    onFileSelected: (file: File) => void;
    onFileRemoved: (file: File) => void;
    selectedFiles: File[];
    isUploading?: boolean;
    maxFileSize?: number; // in bytes
    maxFiles?: number;
}

const ActivityFileUploader: React.FC<ActivityFileUploaderProps> = ({
    onFileSelected,
    onFileRemoved,
    selectedFiles,
    isUploading = false,
    maxFileSize = 5 * 1024 * 1024, // 5MB default
    maxFiles = 5,
}) => {
    const { t, i18n } = useTranslation(["activities", "common"]);
    const theme = useTheme();
    const isRTL = i18n.language === "he";
    const { error: showError, warning: showWarning } = useToast();
    const [dragOver, setDragOver] = useState(false);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        files.forEach((file) => {
            if (validateFile(file)) {
                onFileSelected(file);
            }
        });
        // Reset input value to allow selecting the same file again
        e.target.value = "";
    };

    const validateFile = (file: File): boolean => {
        // Check if file is empty
        if (file.size === 0) {
            showError(t("validation.file_empty_error", { ns: "common" }));
            return false;
        }

        // Check file size
        if (file.size > maxFileSize) {
            showError(
                t("validation.file_size_limit", {
                    ns: "common",
                    size: (maxFileSize / 1024 / 1024).toFixed(1),
                })
            );
            return false;
        }

        // Check file type
        const allowedTypes = [
            // Text files
            "text/plain",
            "text/csv",
            "text/html",
            "text/css",
            "text/javascript",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            // Image files
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/gif",
            "image/webp",
            "image/svg+xml",
            // Audio files
            "audio/mpeg",
            "audio/mp3",
            "audio/wav",
            "audio/ogg",
            "audio/aac",
            "audio/m4a",
        ];

        if (!allowedTypes.includes(file.type)) {
            showError(t("validation.file_type_error", { ns: "common" }));
            return false;
        }

        // Check number of files
        if (selectedFiles.length >= maxFiles) {
            showWarning(
                t("validation.max_files_error", {
                    ns: "common",
                    count: maxFiles,
                })
            );
            return false;
        }

        return true;
    };

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
    }, []);

    const handleDragLeave = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
        },
        []
    );

    const handleDrop = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);

            const files = Array.from(e.dataTransfer.files);
            files.forEach((file) => {
                if (validateFile(file)) {
                    onFileSelected(file);
                }
            });
        },
        [onFileSelected, validateFile]
    );

    const getFileIcon = (file: File) => {
        if (file.type.startsWith("image/")) {
            return <ImageIcon fontSize="small" color="primary" />;
        } else if (file.type.startsWith("audio/")) {
            return <Audiotrack fontSize="small" color="secondary" />;
        } else {
            return <Description fontSize="small" color="action" />;
        }
    };

    const getFileTypeColor = (file: File) => {
        if (file.type.startsWith("image/")) {
            return "primary";
        } else if (file.type.startsWith("audio/")) {
            return "secondary";
        } else {
            return "default";
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`;
    };

    return (
        <Box sx={{ width: "100%" }}>
            {/* File Upload Area */}
            {selectedFiles.length < maxFiles && (
                <Box
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    sx={{
                        border: "1px dashed",
                        borderColor: dragOver
                            ? theme.palette.primary.main
                            : theme.palette.divider,
                        borderRadius: theme.shape.borderRadius,
                        p: theme.spacing(1.5),
                        textAlign: "center",
                        backgroundColor: dragOver
                            ? alpha(theme.palette.primary.main, 0.04)
                            : alpha(theme.palette.grey[50], 0.5),
                        cursor: "pointer",
                        transition: theme.transitions.create(["all"], {
                            duration: theme.transitions.duration.shortest,
                        }),
                        mb: theme.spacing(1),
                        "&:hover": {
                            borderColor: theme.palette.primary.main,
                            backgroundColor: alpha(
                                theme.palette.primary.main,
                                0.02
                            ),
                        },
                    }}
                    onClick={() =>
                        document.getElementById("activity-file-input")?.click()
                    }
                >
                    <input
                        id="activity-file-input"
                        type="file"
                        multiple
                        accept=".txt,.csv,.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.svg,.mp3,.wav,.ogg,.aac,.m4a"
                        onChange={handleFileChange}
                        style={{ display: "none" }}
                    />

                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: theme.spacing(0.5),
                        }}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: theme.spacing(1),
                            }}
                        >
                            <CloudUpload
                                sx={{
                                    fontSize: 20,
                                    color: theme.palette.primary.main,
                                }}
                            />
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ fontWeight: 500 }}
                            >
                                {dragOver
                                    ? t(
                                        "messages.file_attachments_drag_drop_files",
                                        { ns: "common" }
                                    )
                                    : t(
                                        "actions.upload_files",
                                        { ns: "common" }
                                    )}
                            </Typography>
                        </Box>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                                fontSize: "0.75rem",
                                opacity: 0.8,
                                textAlign: "center",
                            }}
                        >
                            PDF, DOC, XLS, Images, Audio • Max{" "}
                            {(maxFileSize / 1024 / 1024).toFixed(1)}MB
                        </Typography>
                    </Box>
                </Box>
            )}

            {/* Upload Progress */}
            {isUploading && (
                <Fade in={isUploading}>
                    <Paper
                        sx={{
                            p: theme.spacing(2),
                            mb: theme.spacing(2),
                            direction: isRTL ? "rtl" : "ltr",
                            textAlign: isRTL ? "right" : "left",
                            backgroundColor: alpha(
                                theme.palette.primary.main,
                                0.05
                            ),
                            border: 1,
                            borderColor: alpha(theme.palette.primary.main, 0.2),
                        }}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                flexDirection: isRTL ? "row-reverse" : "row",
                                gap: theme.spacing(1),
                                mb: theme.spacing(1),
                            }}
                        >
                            <CircularProgress size={16} color="primary" />
                            <Typography
                                variant="body2"
                                color="primary"
                                sx={{
                                    flex: 1,
                                    minWidth: 0,
                                    fontWeight: 500,
                                    direction: isRTL ? "rtl" : "ltr",
                                    textAlign: isRTL ? "right" : "left",
                                }}
                            >
                                {t("messages.file_attachments_uploading_files", { ns: "common" })}
                            </Typography>
                        </Box>
                        <Box sx={{ direction: isRTL ? "rtl" : "ltr" }}>
                            <LinearProgress
                                sx={{
                                    height: 6,
                                    borderRadius: 3,
                                    ...(isRTL && { transform: "scaleX(-1)" }),
                                    backgroundColor: alpha(
                                        theme.palette.primary.main,
                                        0.1
                                    ),
                                    "& .MuiLinearProgress-bar": {
                                        borderRadius: 3,
                                    },
                                }}
                            />
                        </Box>
                    </Paper>
                </Fade>
            )}

            {/* Selected Files */}
            {selectedFiles.length > 0 && (
                <Box sx={{ mb: theme.spacing(1) }}>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            mb: theme.spacing(1),
                        }}
                    >
                        <Typography
                            variant="body2"
                            sx={{ fontWeight: 600, color: "text.primary" }}
                        >
                            {t("sections.file_attachments", { ns: "activities" })} (
                            {selectedFiles.length}/{maxFiles})
                        </Typography>
                    </Box>

                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: theme.spacing(0.5),
                        }}
                    >
                        {selectedFiles.map((file, index) => (
                            <Box
                                key={`${file.name}-${index}`}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: theme.spacing(1),
                                    p: theme.spacing(1),
                                    borderRadius: theme.shape.borderRadius,
                                    backgroundColor: alpha(
                                        theme.palette.grey[50],
                                        0.5
                                    ),
                                    border: 1,
                                    borderColor: theme.palette.divider,
                                }}
                            >
                                {getFileIcon(file)}

                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            fontWeight: 500,
                                            color: "text.primary",
                                            fontSize: "0.875rem",
                                        }}
                                        noWrap
                                    >
                                        {file.name}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{ fontSize: "0.75rem" }}
                                    >
                                        {formatFileSize(file.size)}
                                    </Typography>
                                </Box>

                                <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => onFileRemoved(file)}
                                    disabled={isUploading}
                                    sx={{ p: 0.5 }}
                                >
                                    <Delete fontSize="small" />
                                </IconButton>
                            </Box>
                        ))}
                    </Box>
                </Box>
            )}
        </Box>
    );
};

export default ActivityFileUploader;
