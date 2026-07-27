import {
    Cancel as CancelIcon,
    CheckCircle as CheckCircleIcon,
    FilePresent as FilePresentIcon,
    FileUpload as FileUploadIcon,
} from "@mui/icons-material";
import {
    alpha,
    Box,
    Button,
    LinearProgress,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useTranslation } from "react-i18next";

import EndlessScrollDataGrid from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import { ExportFormat } from "@/shared/utility/exportToExcel";
import { translateImportMessage } from "@/shared/utils/translateImportMessage";

interface MappedDataGridProps {
    rows: Record<string, any>[];
    columns: string[];
    isLoading: boolean;
    isSubmitted: boolean;
    onSubmit: () => void;
    importStatus: "idle" | "loading" | "success" | "partial" | "error";
    fieldLabels?: Record<string, string>;
    isParsing?: boolean;
    currentRecordCount?: number;
    totalRecords?: number;
    importProgress?: number;
    validationErrors?: string[]; // Add validation errors prop
}

const MappedDataGrid: React.FC<MappedDataGridProps> = ({
    rows,
    columns,
    isLoading,
    isSubmitted,
    onSubmit,
    fieldLabels = {},
    currentRecordCount,
    totalRecords,
    importProgress,
    validationErrors = [],
}) => {
    const { t, i18n } = useTranslation(["import", "common"]);
    const theme = useTheme();
    const progressBarRef = useRef<HTMLDivElement>(null);

    // Search state
    const [searchValue, setSearchValue] = useState<string>("");

    // Search handler
    const handleSearchChange = useCallback((value: string) => {
        setSearchValue(value);
    }, []);

    // Scroll to progress bar when import starts
    useEffect(() => {
        if (isLoading && progressBarRef.current) {
            progressBarRef.current.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        }
    }, [isLoading]);

    // Always show message column if there are rows or if submitted
    const shouldShowMessageColumn = useMemo(() => {
        return rows.length > 0 || isSubmitted || validationErrors.length > 0;
    }, [isSubmitted, rows, validationErrors]);

    // Reusable style objects
    const cellStyles = useMemo(
        () => ({
            width: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: { xs: "0.7rem", sm: "0.75rem", md: "0.8rem" },
        }),
        []
    );


    const gridColumns: GridColDef[] = useMemo(() => {
        const messageColumn: GridColDef[] = shouldShowMessageColumn
            ? [
                {
                    field: "message",
                    headerName: t("fields.results_message", { ns: "import" }),
                    flex: 2,
                    minWidth: 150,
                    maxWidth: 300,
                    renderCell: (params: GridRenderCellParams<any>) => {
                        // Get message from row - try params.value first, then params.row.message
                        // params.value should contain row.message when field="message"
                        const rowMessage =
                            params.value || params.row?.message;
                        const rowStatus = params.row?.status;

                        // Get message - prioritize row message, fallback to validation errors or default
                        let message =
                            rowMessage && rowMessage.trim() !== ""
                                ? rowMessage
                                : validationErrors.length > 0
                                    ? validationErrors.join(", ")
                                    : null;

                        // If still no message and row has failed status, show a default error message
                        if (!message && rowStatus === "Validation Failed") {
                            message =
                                t("fields.results_failed", {
                                    ns: "import",
                                }) || "Validation Failed";
                        }

                        // Final fallback
                        if (!message || message.trim() === "") {
                            message = "-";
                        }

                        // Translate message if it contains translation key patterns
                        message = translateImportMessage(message, t);

                        // Determine if this is a success or failure based on status and message content
                        const hasErrors =
                            rowStatus === "Validation Failed" ||
                            rowStatus === "Failed" ||
                            (message &&
                                message !== "-" &&
                                (message.includes("required") ||
                                    message.includes("Invalid") ||
                                    message.includes("must be") ||
                                    message.includes("error") ||
                                    message.includes("failed") ||
                                    message.includes("cannot be zero") ||
                                    message.includes("does not match") ||
                                    message.includes("Cannot derive") ||
                                    message.includes("don't have access") ||
                                    message.includes("business unit")));

                        // Determine success status - must check status first, then message content
                        const isSuccess =
                            !hasErrors &&
                            (message ===
                                "All fields validated successfully - Ready for import" ||
                                message === "Success" ||
                                (message !== "-" &&
                                    !message.includes("required") &&
                                    !message.includes("Invalid") &&
                                    !message.includes("must be") &&
                                    !message.includes("error") &&
                                    !message.includes("failed") &&
                                    !message.includes("don't have access") &&
                                    !message.includes("business unit") &&
                                    validationErrors.length === 0));

                        return (
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: { xs: 0.5, sm: 1 },
                                    width: "100%",
                                    direction:
                                        i18n.language === "he"
                                            ? "rtl"
                                            : "ltr",
                                }}
                            >
                                {isSuccess ? (
                                    <CheckCircleIcon
                                        sx={{
                                            fontSize: {
                                                xs: "0.875rem",
                                                sm: "1rem",
                                            },
                                            color: "success.main",
                                            flexShrink: 0,
                                        }}
                                    />
                                ) : (
                                    <CancelIcon
                                        sx={{
                                            fontSize: {
                                                xs: "0.875rem",
                                                sm: "1rem",
                                            },
                                            color: "error.main",
                                            flexShrink: 0,
                                        }}
                                    />
                                )}
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{
                                        fontSize: {
                                            xs: "0.75rem",
                                            sm: "0.8rem",
                                            md: "0.875rem",
                                        },
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                        textAlign:
                                            i18n.language === "he"
                                                ? "right"
                                                : "left",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        flex: 1,
                                    }}
                                >
                                    {message}
                                </Typography>
                            </Box>
                        );
                    },
                },
            ]
            : [];

        return [
            ...messageColumn,
            // Then show all other data columns
            ...columns.map((field) => ({
                field,
                headerName: fieldLabels[field] || field.replace(/_/g, " "),
                flex: 1,
                minWidth: 120,
                maxWidth: 250,
                renderCell: (params: GridRenderCellParams<any>) => (
                    <Box sx={cellStyles}>
                        {params.value !== null && params.value !== undefined
                            ? String(params.value)
                            : "-"}
                    </Box>
                ),
            })),
        ];
    }, [
        columns,
        fieldLabels,
        shouldShowMessageColumn,
        cellStyles,
        t,
        validationErrors,
        i18n.language,
    ]);

    // Memoized button logic
    const buttonLogic = useMemo(() => {
        const hasValidationErrors = validationErrors.length > 0;
        const allRowsHaveErrors = rows.every(
            (row) =>
                row.message &&
                (row.message.includes("required") ||
                    row.message.includes("Invalid") ||
                    row.message.includes("must be") ||
                    row.message.includes("error"))
        );
        const shouldDisable = isLoading || allRowsHaveErrors;

        const getTooltipText = () => {
            if (isLoading) return t("tooltips.importing", { ns: "import" });
            if (allRowsHaveErrors)
                return t("tooltips.all_records_have_errors", { ns: "import" });
            return "";
        };

        return {
            hasValidationErrors,
            allRowsHaveErrors,
            shouldDisable,
            getTooltipText,
        };
    }, [validationErrors, rows, isLoading, t]);

    // Export handler - returns all mapped data for export
    const handleExport = useCallback(
        async (
            selectedColumns: string[],
            fileName: string,
            format: ExportFormat
        ): Promise<any[]> => {
            // Return all rows - the export utility will handle column filtering
            return Promise.resolve(rows);
        },
        [rows]
    );

    // Memoized import button for toolbar
    const importButton = useMemo(() => {
        const { shouldDisable, getTooltipText } = buttonLogic;

        const button = (
            <Button
                size="small"
                variant="outlined"
                startIcon={<FileUploadIcon />}
                onClick={onSubmit}
                disabled={shouldDisable}
                sx={{
                    minWidth: "auto",
                    px: theme.spacing(1.5),
                    py: 0, // Remove vertical padding to match export button
                    fontSize: { xs: "0.75rem", sm: "0.8rem", md: "0.875rem" },
                    boxSizing: "border-box",
                    height: "32px",
                    borderRadius: theme.shape.borderRadius,
                    border: `1px solid ${theme.palette.divider} !important`,
                    color: `${theme.palette.primary.main} !important`,
                    backgroundColor: `${theme.palette.background.paper} !important`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    direction: i18n.language === "he" ? "rtl" : "ltr",
                    // RTL spacing: mr for English, ml for Hebrew
                    "& .MuiButton-startIcon": {
                        marginRight:
                            i18n.language === "he" ? 0 : theme.spacing(0.5),
                        marginLeft:
                            i18n.language === "he" ? theme.spacing(0.5) : 0,
                    },
                    "&:hover": {
                        borderColor: `${theme.palette.primary.main} !important`,
                        color: `${theme.palette.primary.main} !important`,
                        backgroundColor: `${alpha(theme.palette.primary.main, 0.04)} !important`,
                    },
                    "&:disabled": {
                        border: `1px solid ${theme.palette.divider} !important`,
                        color: `${theme.palette.action.disabled} !important`,
                        backgroundColor: `${theme.palette.action.disabledBackground} !important`,
                    },
                }}
            >
                {t("actions.import_records", { ns: "import" })}
            </Button>
        );

        const isHebrewUser = i18n.language === "he";
        return shouldDisable ? (
            <Tooltip
                title={getTooltipText()}
                arrow
                enterDelay={300}
                leaveDelay={100}
                placement="bottom"
                PopperProps={{
                    sx: {
                        "& .MuiTooltip-tooltip": {
                            direction: isHebrewUser ? "rtl" : "ltr",
                        },
                        "& .MuiTooltip-arrow": {
                            ...(isHebrewUser && { transform: "scaleX(-1)" }),
                        },
                    },
                }}
            >
                <span>{button}</span>
            </Tooltip>
        ) : (
            button
        );
    }, [buttonLogic, onSubmit, t, theme, i18n.language]);

    return (
        <Box
            sx={{
                width: "100%",
                maxWidth: "100%",
                overflow: "hidden",
            }}
        >
            {/* Header */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 2,
                }}
            >
                <FilePresentIcon
                    sx={{
                        color: "primary.main",
                        fontSize: { xs: 18, sm: 20 },
                    }}
                />
                <Typography
                    sx={{
                        fontWeight: "500 !important",
                        fontSize: { xs: "1rem", sm: "1.25rem" },
                        color: "text.primary",
                        lineHeight: 1.2,
                        fontFamily: "inherit",
                        display: "block",
                        "&.MuiTypography-root": {
                            fontWeight: "500 !important",
                        },
                    }}
                >
                    {t("fields.field_mapping_record_preview", { ns: "import" })}
                </Typography>
            </Box>

            {/* Progress Bar - prominently displayed above the table when importing */}
            {isLoading && (
                <Box
                    ref={progressBarRef}
                    sx={{
                        width: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        mb: 3,
                        p: 3,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.primary.main, 0.04),
                        border: "2px solid",
                        borderColor: "primary.main",
                        boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}`,
                        position: "relative",
                        zIndex: 10,
                    }}
                >
                    <Typography
                        variant="subtitle1"
                        sx={{
                            mb: 2,
                            fontWeight: 600,
                            color: "primary.main",
                            fontSize: {
                                xs: "0.875rem",
                                sm: "0.95rem",
                                md: "1rem",
                            },
                            textAlign: "center",
                        }}
                    >
                        {currentRecordCount !== undefined &&
                            totalRecords !== undefined
                            ? t("fields.file_handling_import_progress", {
                                ns: "import",
                                current: currentRecordCount,
                                total: totalRecords,
                            })
                            : t("fields.file_handling_importing", {
                                ns: "import",
                            })}
                    </Typography>
                    <LinearProgress
                        variant={
                            importProgress !== undefined
                                ? "determinate"
                                : "indeterminate"
                        }
                        value={importProgress || 0}
                        sx={{
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: alpha(
                                theme.palette.primary.main,
                                0.1
                            ),
                            width: "100%",
                            maxWidth: {
                                xs: "100%",
                                sm: "80%",
                                md: "70%",
                            },
                            "& .MuiLinearProgress-bar": {
                                backgroundColor: "primary.main",
                                borderRadius: 4,
                            },
                        }}
                    />
                    {importProgress !== undefined && (
                        <Typography
                            variant="caption"
                            sx={{
                                mt: 1,
                                fontWeight: 500,
                                color: "primary.main",
                                fontSize: {
                                    xs: "0.75rem",
                                    sm: "0.8rem",
                                    md: "0.85rem",
                                },
                            }}
                        >
                            {Math.round(importProgress)}%
                        </Typography>
                    )}
                </Box>
            )}

            {/* Data Grid */}
            <Box
                sx={{
                    width: "100%",
                    maxWidth: "100%",
                    overflow: "hidden",
                }}
            >
                <EndlessScrollDataGrid
                    rows={rows.map((row, index) => ({ id: index, ...row }))}
                    columns={gridColumns}
                    totalRecords={rows.length}
                    isLoading={isLoading}
                    onLoadMore={() => { }} // No pagination needed for import preview
                    hasMore={false} // No pagination needed for import preview
                    noRowsMessage={t("fields.field_mapping_no_data_preview", {
                        ns: "import",
                    })}
                    noRowsDescription={t(
                        "fields.field_mapping_upload_file_to_preview",
                        { ns: "import" }
                    )}
                    visibleRows={10}
                    resizableColumns={true}
                    language={i18n.language}
                    searchValue={searchValue}
                    onSearchChange={handleSearchChange}
                    searchPlaceholder={t("fields.search_placeholder", {
                        ns: "common",
                    })}
                    searchDirection={i18n.language === "he" ? "rtl" : "ltr"}
                    searchDebounceMs={300}
                    customButtons={importButton}
                    onExport={handleExport}
                    exportContextInfo={{
                        pageName: t("fields.field_mapping_record_preview", {
                            ns: "import",
                        }),
                        customPrefix: "import-contact-preview",
                    }}
                />
            </Box>
        </Box>
    );
};

export default MappedDataGrid;
