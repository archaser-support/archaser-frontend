"use client";

import { FileDownload as FileDownloadIcon } from "@mui/icons-material";
import {
    Box,
    Button,
    Checkbox,
    CircularProgress,
    FormControl,
    FormControlLabel,
    Radio,
    RadioGroup,
    TextField,
    Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import AppDialog from "@/shared/layout-components/modal/AppDialog";
import { ExportFormat } from "../../utility/exportToExcel";

interface ExportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: (
        selectedColumns: string[],
        fileName: string,
        format: ExportFormat
    ) => Promise<any>;
    columns: any[];
    columnVisibilityModel: Record<string, boolean>;
    isLoading?: boolean;
    contextInfo?: {
        pageName?: string;
        customerName?: string;
        customerNumber?: string;
        customPrefix?: string;
    };
}

const ExportDialog: React.FC<ExportDialogProps> = ({
    isOpen,
    onClose,
    onExport,
    columns,
    columnVisibilityModel,
    isLoading = false,
    contextInfo,
}) => {
    const { t, i18n } = useTranslation(["common"]);
    const theme = useTheme();
    const isRTL = i18n.language === "he";

    const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
    const [fileName, setFileName] = useState<string>("");
    const [isExporting, setIsExporting] = useState(false);
    const [exportFormat, setExportFormat] = useState<ExportFormat>("excel");

    // Get exportable columns (exclude hidden columns)
    const exportableColumns = useMemo(() => {
        return columns.filter(
            (column) =>
                column.field &&
                columnVisibilityModel[column.field] !== false &&
                column.field !== "actions" && // Exclude actions column
                column.field !== "checkbox" // Exclude checkbox column
        );
    }, [columns, columnVisibilityModel]);

    // Initialize selected columns based on visible columns
    useEffect(() => {
        if (isOpen && exportableColumns.length > 0) {
            const visibleColumns = exportableColumns.map((col) => col.field);
            setSelectedColumns(visibleColumns);
        }
    }, [isOpen, exportableColumns]);

    // Set default file name
    useEffect(() => {
        if (isOpen) {
            const timestamp = new Date().toISOString().split("T")[0];
            const time = new Date()
                .toLocaleTimeString("en-US", {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                })
                .replace(":", "");

            let fileName = "";

            // Build sophisticated filename based on context
            if (contextInfo?.customPrefix) {
                fileName = contextInfo.customPrefix;
            } else if (contextInfo?.pageName) {
                fileName = contextInfo.pageName
                    .replace(/[^a-zA-Z0-9\s]/g, "") // Remove special characters
                    .replace(/\s+/g, "_") // Replace spaces with underscores
                    .substring(0, 50); // Limit length
            } else {
                fileName = "export";
            }

            // Add customer information if available
            if (contextInfo?.customerName) {
                const cleanCustomerName = contextInfo.customerName
                    .replace(/[^a-zA-Z0-9\s]/g, "") // Remove special characters
                    .replace(/\s+/g, "_") // Replace spaces with underscores
                    .substring(0, 30); // Limit length
                fileName += `_${cleanCustomerName}`;
            }

            // Add customer number if available and no customer name
            if (contextInfo?.customerNumber && !contextInfo?.customerName) {
                fileName += `_${contextInfo.customerNumber}`;
            }

            // Add timestamp
            fileName += `_${timestamp}_${time}`;

            setFileName(fileName);
        }
    }, [isOpen, contextInfo]);

    const handleColumnToggle = (columnField: string) => {
        setSelectedColumns((prev) =>
            prev.includes(columnField)
                ? prev.filter((field) => field !== columnField)
                : [...prev, columnField]
        );
    };

    const handleSelectAll = () => {
        const allFields = exportableColumns.map((col) => col.field);
        const isAllSelected = selectedColumns.length === allFields.length;

        if (isAllSelected) {
            setSelectedColumns([]);
        } else {
            setSelectedColumns(allFields);
        }
    };

    const handleExport = async () => {
        if (selectedColumns.length === 0) return;

        setIsExporting(true);
        try {
            await onExport(selectedColumns, fileName, exportFormat);
            onClose();
        } catch (error) {
            console.error("Export failed:", error);
        } finally {
            setIsExporting(false);
        }
    };

    const handleClose = () => {
        if (!isExporting) {
            onClose();
        }
    };

    const isAllSelected = selectedColumns.length === exportableColumns.length;
    const isIndeterminate =
        selectedColumns.length > 0 &&
        selectedColumns.length < exportableColumns.length;


    return (
        <AppDialog
            open={isOpen}
            onClose={handleClose}
            drag
            align
            slide
            isRTL={isRTL}
            paperWidth="500px"
            paperMaxHeight="90vh"
            title={t("sections.export_dialog_title")}
            titleIcon={<FileDownloadIcon aria-hidden="true" />}
            ariaLabelledBy="export-dialog-title"
            ariaDescribedBy="export-dialog-description"
            keepMounted
            disableEnforceFocus={false}
            disableAutoFocus={false}
            disablePortal={false}
            actions={
                <>
                    <Button
                        onClick={handleClose}
                        variant="outlined"
                        size="small"
                        className="cancel-button"
                        fullWidth={false}
                        sx={{
                            mr: i18n.language === "he" ? 0 : theme.spacing(1),
                            ml: i18n.language === "he" ? theme.spacing(1) : 0,
                        }}
                    >
                        {t("actions.cancel")}
                    </Button>
                    <Button
                        onClick={handleExport}
                        disabled={isExporting || selectedColumns.length === 0}
                        variant="contained"
                        size="small"
                        className="save-button"
                        fullWidth={false}
                        endIcon={
                            isExporting ? (
                                <CircularProgress
                                    size={16}
                                    sx={{ color: "inherit" }}
                                />
                            ) : undefined
                        }
                        sx={{
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            "& .MuiButton-endIcon": {
                                marginLeft:
                                    i18n.language === "he" ? 0 : theme.spacing(1),
                                marginRight:
                                    i18n.language === "he" ? theme.spacing(1) : 0,
                            },
                        }}
                    >
                        {t("actions.export")}
                    </Button>
                </>
            }
        >
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: theme.spacing(1), // Reduced gap
                    maxWidth: "500px",
                    mx: "auto",
                    direction: i18n.language === "he" ? "rtl" : "ltr",
                }}
            >
                {/* Export Settings Section */}
                <Box>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: theme.spacing(1),
                            mb: theme.spacing(0.5),
                            color: theme.palette.primary.main,
                            direction:
                                i18n.language === "he" ? "rtl" : "ltr",
                        }}
                    >
                        <Typography
                            variant="subtitle2"
                            sx={{
                                textAlign:
                                    i18n.language === "he"
                                        ? "right"
                                        : "left",
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            {t("sections.export_settings")}
                        </Typography>
                    </Box>
                    <Box
                        sx={{
                            bgcolor: theme.palette.background.default,
                            borderRadius: theme.shape.borderRadius,
                            p: {
                                xs: theme.spacing(0.75),
                                sm: theme.spacing(1),
                            },
                            display: "flex",
                            flexDirection: "column",
                            gap: theme.spacing(1), // Reduced gap
                        }}
                    >
                        {/* File Name */}
                        <TextField
                            fullWidth
                            value={fileName}
                            onChange={(e) => setFileName(e.target.value)}
                            placeholder={t("fields.file_name")}
                            disabled={isExporting}
                            size="small"
                            sx={{
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                                "& .MuiOutlinedInput-input": {
                                    direction:
                                        i18n.language === "he"
                                            ? "rtl"
                                            : "ltr",
                                    textAlign:
                                        i18n.language === "he"
                                            ? "right"
                                            : "left",
                                },
                                "& .MuiInputLabel-root": {
                                    textAlign:
                                        i18n.language === "he"
                                            ? "right"
                                            : "left",
                                    direction:
                                        i18n.language === "he"
                                            ? "rtl"
                                            : "ltr",
                                },
                                "& .MuiOutlinedInput-root": {
                                    alignItems: "center",
                                },
                            }}
                        />

                        {/* Format Selection */}
                        <FormControl
                            component="fieldset"
                            disabled={isExporting}
                            fullWidth
                        >
                            <RadioGroup
                                value={exportFormat}
                                onChange={(e) =>
                                    setExportFormat(
                                        e.target.value as ExportFormat
                                    )
                                }
                                sx={{
                                    direction:
                                        i18n.language === "he"
                                            ? "rtl"
                                            : "ltr",
                                    display: "flex",
                                    flexDirection: "row",
                                    gap: theme.spacing(2), // Reduced gap
                                }}
                            >
                                <FormControlLabel
                                    value="excel"
                                    control={<Radio size="small" />}
                                    label={t("values.format_excel")}
                                    sx={{
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                        "& .MuiFormControlLabel-label": {
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                        },
                                    }}
                                />
                                <FormControlLabel
                                    value="csv"
                                    control={<Radio size="small" />}
                                    label={t("values.format_csv")}
                                    sx={{
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                        "& .MuiFormControlLabel-label": {
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                        },
                                    }}
                                />
                                <FormControlLabel
                                    value="pdf"
                                    control={<Radio size="small" />}
                                    label={t("values.format_pdf")}
                                    sx={{
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                        "& .MuiFormControlLabel-label": {
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                        },
                                    }}
                                />
                            </RadioGroup>
                        </FormControl>
                    </Box>
                </Box>
                {/* Column Selection Section */}
                <Box>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            mb: theme.spacing(0.5),
                            color: theme.palette.primary.main,
                            direction:
                                i18n.language === "he" ? "rtl" : "ltr",
                        }}
                    >
                        <Typography
                            variant="subtitle2"
                            sx={{
                                textAlign:
                                    i18n.language === "he"
                                        ? "right"
                                        : "left",
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            {t("fields.select_columns")}
                        </Typography>
                        <Button
                            size="small"
                            onClick={handleSelectAll}
                            disabled={isExporting}
                            sx={{
                                minWidth: "auto",
                                px: 2,
                                fontSize: "0.75rem",
                            }}
                        >
                            {isAllSelected
                                ? t("actions.deselect_all")
                                : t("actions.select_all")}
                        </Button>
                    </Box>
                    <Box
                        sx={{
                            borderRadius: theme.shape.borderRadius,
                            p: {
                                xs: theme.spacing(0.75),
                                sm: theme.spacing(1),
                            },
                        }}
                    >
                        <Box
                            id="export-dialog-column-list"
                            sx={{
                                maxHeight: 250,
                                overflowY: "scroll",
                                overflowX: "hidden",
                                pr: 1,
                                pb: 2, // Add bottom padding so last items are visible
                                minHeight: 0,
                                scrollbarWidth: "thin",
                                scrollbarColor: `${alpha(theme.palette.primary.main, 0.6)} transparent`,
                                "&::-webkit-scrollbar": {
                                    width: "12px",
                                },
                                "&::-webkit-scrollbar-track": {
                                    backgroundColor: "transparent",
                                    borderRadius: "6px",
                                },
                                "&::-webkit-scrollbar-thumb": {
                                    backgroundColor: alpha(
                                        theme.palette.primary.main,
                                        0.6
                                    ),
                                    borderRadius: "6px",
                                    "&:hover": {
                                        backgroundColor:
                                            theme.palette.primary.main,
                                    },
                                },
                            }}
                        >
                            {exportableColumns.map((column) => {
                                const isSelected = selectedColumns.includes(
                                    column.field
                                );
                                const isRTL = i18n.language === "he";
                                const textAlign = isRTL ? "right" : "left";
                                const direction = isRTL ? "rtl" : "ltr";

                                return (
                                    <Box
                                        key={column.field}
                                        onClick={() =>
                                            !isExporting &&
                                            handleColumnToggle(column.field)
                                        }
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            py: 1,
                                            px: 1.5,
                                            borderRadius: 1,
                                            cursor: isExporting
                                                ? "not-allowed"
                                                : "pointer",
                                            bgcolor: "transparent",
                                            "&:hover": {
                                                bgcolor: alpha(
                                                    theme.palette.primary
                                                        .main,
                                                    0.08
                                                ),
                                            },
                                            ...(isRTL
                                                ? {
                                                    borderRight:
                                                        isSelected
                                                            ? `3px solid ${theme.palette.primary.main}`
                                                            : "3px solid transparent",
                                                }
                                                : {
                                                    borderLeft: isSelected
                                                        ? `3px solid ${theme.palette.primary.main}`
                                                        : "3px solid transparent",
                                                }),
                                            direction,
                                            mb: 0.5,
                                        }}
                                    >
                                        <Checkbox
                                            checked={isSelected}
                                            onChange={() =>
                                                handleColumnToggle(
                                                    column.field
                                                )
                                            }
                                            disabled={isExporting}
                                            size="small"
                                            sx={{
                                                padding: "2px 8px",
                                                pointerEvents: "none", // Let the Box handle clicks
                                            }}
                                        />
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                flex: 1,
                                                fontSize: "0.875rem",
                                                textAlign,
                                                direction,
                                                color: "text.primary",
                                            }}
                                        >
                                            {column.headerName ||
                                                column.field}
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>
                </Box>
            </Box>
        </AppDialog>
    );
};

export default ExportDialog;
