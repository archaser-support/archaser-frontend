import {
    CloudUpload,
    Description,
    InfoOutlined,
} from "@mui/icons-material";
import {
    Box,
    Typography,
    Button,
    LinearProgress,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import React, { ChangeEvent, useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";

interface FileUploaderProps {
    onFileSelected: (file: File) => void;
    onClear: () => void;
    selectedFile: File | null;
    isParsing: boolean;
    fileInputRef?: React.RefObject<HTMLInputElement>;
    uploadTitle?: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({
    onFileSelected,
    onClear,
    selectedFile,
    isParsing,
    fileInputRef,
    uploadTitle,
}) => {
    const { t, i18n } = useTranslation(["import", "common"]);
    const theme = useTheme();
    const internalFileInputRef = useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    // Use the provided ref or fall back to internal ref
    const inputRef = fileInputRef || internalFileInputRef;

    // RTL/LTR style helpers
    const isRTL = i18n.language === "he";
    const rtlStyles = useMemo(() => ({
        direction: (isRTL ? "rtl" : "ltr") as "rtl" | "ltr",
        textAlign: (isRTL ? "right" : "left") as "right" | "left",
        justifyContent: (isRTL ? "flex-end" : "flex-start") as "flex-end" | "flex-start",
        flexDirection: (isRTL ? "row-reverse" : "row") as "row-reverse" | "row",
    }), [isRTL]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
        const file = e.target.files?.[0];
        if (file) onFileSelected(file);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            // Check if file type is supported
            const supportedTypes = ['.csv', '.xlsx', '.xls'];
            const fileExtension = `.${  file.name.split('.').pop()?.toLowerCase()}`;

            if (supportedTypes.includes(fileExtension)) {
                onFileSelected(file);
            }
        }
    };

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleChange}
                style={{ display: "none" }}
            />

            {/* Title Section */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    mb: theme.spacing(2),
                    mt: theme.spacing(6),
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: theme.spacing(1),
                    }}
                >
                    <InfoOutlined
                        sx={{
                            color: "primary.main",
                            fontSize: { xs: 18, sm: 20 },
                        }}
                    />
                    <Typography
                        sx={{
                            fontWeight: 500,
                            fontSize: { xs: "1rem", sm: "1.25rem" },
                            color: "text.primary",
                            lineHeight: 1.2,
                        }}
                    >
                        {uploadTitle || t("fields.file_handling_upload_file", { ns: "import" })}
                    </Typography>
                </Box>

                {selectedFile && (
                    <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        onClick={onClear}
                    >
                        {t("actions.remove", { ns: "common" })}
                    </Button>
                )}
            </Box>

            {/* Compact Content */}
            <Box>
                {!selectedFile ? (
                    // Upload area with dashed border - drag and drop design
                    <Box
                        onClick={() => inputRef.current?.click()}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            minHeight: "120px",
                            border: "2px dashed",
                            borderColor: isDragOver ? "primary.main" : "primary.light",
                            borderRadius: theme.shape.borderRadius,
                            p: theme.spacing(2),
                            width: "100%",
                            overflow: "hidden",
                            boxSizing: "border-box",
                            backgroundColor: isDragOver ? "primary.50" : "transparent",
                            "&:hover": {
                                borderColor: "primary.main",
                                backgroundColor: "primary.50",
                            },
                        }}
                    >
                        <CloudUpload
                            sx={{
                                fontSize: 48,
                                color: "primary.main",
                                transform: isDragOver ? "rotate(10deg) scale(1.1)" : "rotate(0deg) scale(1)",
                                transition: "transform 0.2s ease-in-out",
                                mb: theme.spacing(1),
                            }}
                        />

                        <Box sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            textAlign: "center"
                        }}>
                            <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
                                {t("fields.file_handling_choose_file", { ns: "import" })}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t("fields.file_handling_upload_instruction", { ns: "import" })}
                            </Typography>
                        </Box>
                    </Box>
                ) : (
                    // File selected state - compact layout
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: { xs: "column", sm: "row" },
                            justifyContent: "space-between",
                            alignItems: { xs: "stretch", sm: "center" },
                            gap: { xs: 1, sm: 0 },
                            border: "1px solid",
                            borderColor: "grey.300",
                            borderRadius: theme.shape.borderRadius,
                            p: theme.spacing(2),
                        }}
                    >
                        {/* File info */}
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: { xs: 1, sm: 1.5 },
                            }}
                        >
                            <Box
                                sx={{
                                    width: { xs: "40px", sm: "44px" },
                                    height: { xs: "40px", sm: "44px" },
                                    borderRadius: "4px",
                                    background: theme.palette.primary.main,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Description
                                    sx={{
                                        fontSize: { xs: 20, sm: 22 },
                                        color: "#ffffff",
                                    }}
                                />
                            </Box>

                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                }}
                            >
                                <Typography
                                    variant="subtitle2"
                                    sx={{
                                        fontWeight: 600,
                                        fontSize: {
                                            xs: "0.8rem",
                                            sm: "0.85rem",
                                        },
                                        wordBreak: "break-word",
                                    }}
                                >
                                    {selectedFile.name}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{
                                        fontSize: {
                                            xs: "0.65rem",
                                            sm: "0.7rem",
                                        },
                                    }}
                                >
                                    {(selectedFile.size / 1024 / 1024).toFixed(
                                        2
                                    )}{" "}
                                    MB
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                )}

                {/* Parsing progress - compact */}
                {isParsing && (
                    <Box sx={{ mt: 1.5 }}>
                        <LinearProgress
                            color="primary"
                            sx={{
                                height: 4,
                                borderRadius: theme.shape.borderRadius,
                            }}
                        />
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ mt: 0.5, display: "block" }}
                        >
                            {t("fields.file_handling_parsing_csv", { ns: "import" })}
                        </Typography>
                    </Box>
                )}
            </Box>
        </>
    );
};

export default FileUploader;
