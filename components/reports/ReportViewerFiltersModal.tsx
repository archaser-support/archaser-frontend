"use client";

import FilterListIcon from "@mui/icons-material/FilterList";
import { Box, Button, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import FilterBuilder from "@/components/reports/FilterBuilder";
import AppDialog from "@/shared/layout-components/modal/AppDialog";
import ModalScrollBox from "@/shared/layout-components/modal/ModalScrollBox";
import {
    areReportFiltersEqual,
    cloneReportFilters,
    type ReportFilterRow,
    type ReportMetadataTable,
    validateReportFilters,
} from "@/utils/reportTableUtils";

const SCROLL_CONTAINER_ID = "report-viewer-filters-modal-scroll";
const SCROLLBAR_STYLE_ID = "report-viewer-filters-scrollbar-override";

export interface ReportViewerFiltersModalProps {
    open: boolean;
    onClose: () => void;
    savedFilters: ReportFilterRow[];
    initialFilters: ReportFilterRow[];
    selectedTables: string[];
    tables: ReportMetadataTable[];
    onApply: (filters: ReportFilterRow[] | null) => void;
}

const ReportViewerFiltersModal: React.FC<ReportViewerFiltersModalProps> = ({
    open,
    onClose,
    savedFilters,
    initialFilters,
    selectedTables,
    tables,
    onApply,
}) => {
    const { t, i18n } = useTranslation(["reports", "common"]);
    const theme = useTheme();
    const isRTL = i18n.language === "he";

    const [modalFilters, setModalFilters] = useState<ReportFilterRow[]>([]);
    const [validationErrors, setValidationErrors] = useState<
        Record<number, string>
    >({});
    const savedFiltersRef = useRef<ReportFilterRow[]>([]);

    useEffect(() => {
        if (!open) {
            return;
        }
        savedFiltersRef.current = cloneReportFilters(savedFilters);
        setModalFilters(cloneReportFilters(initialFilters));
        setValidationErrors({});
    }, [open, savedFilters, initialFilters]);

    useEffect(() => {
        if (!open || typeof document === "undefined") {
            return;
        }
        const trackBg = alpha(theme.palette.primary.main, 0.1);
        const thumbBg = alpha(theme.palette.primary.main, 0.6);
        const thumbHover = theme.palette.primary.main;
        let el = document.getElementById(
            SCROLLBAR_STYLE_ID
        ) as HTMLStyleElement | null;
        if (!el) {
            el = document.createElement("style");
            el.id = SCROLLBAR_STYLE_ID;
            document.body.appendChild(el);
        }
        el.textContent = `
#${SCROLL_CONTAINER_ID} { scrollbar-width: thin; scrollbar-color: ${thumbBg} ${trackBg}; }
#${SCROLL_CONTAINER_ID}::-webkit-scrollbar { display: block !important; width: 12px !important; -webkit-appearance: none !important; }
#${SCROLL_CONTAINER_ID}::-webkit-scrollbar-track { background-color: ${trackBg} !important; border-radius: 6px !important; }
#${SCROLL_CONTAINER_ID}::-webkit-scrollbar-thumb { background-color: ${thumbBg} !important; border-radius: 6px !important; }
#${SCROLL_CONTAINER_ID}::-webkit-scrollbar-thumb:hover { background-color: ${thumbHover} !important; }
`;
        return () => {
            const styleEl = document.getElementById(SCROLLBAR_STYLE_ID);
            if (styleEl) {
                styleEl.remove();
            }
        };
    }, [open, theme.palette.primary.main]);

    const handleResetToSaved = useCallback(() => {
        setModalFilters(cloneReportFilters(savedFiltersRef.current));
        setValidationErrors({});
    }, []);

    const handleApply = useCallback(() => {
        const errors = validateReportFilters(
            modalFilters,
            (key, opts) =>
                t(key, {
                    defaultValue:
                        typeof opts === "string"
                            ? opts
                            : opts?.defaultValue,
                }),
            { skipTableFieldCheck: true }
        );
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            return;
        }
        if (areReportFiltersEqual(modalFilters, savedFiltersRef.current)) {
            onApply(null);
        } else {
            onApply(cloneReportFilters(modalFilters));
        }
        onClose();
    }, [modalFilters, onApply, onClose, t]);

    return (
        <AppDialog
            open={open}
            onClose={onClose}
            drag
            align
            slide
            resize
            isRTL={isRTL}
            scrollContainerId={SCROLL_CONTAINER_ID}
            resizeOptions={{
                initialWidth: 420,
                heightFraction: 0.65,
                minWidth: 360,
                maxWidth: 600,
                minHeight: 320,
            }}
            title={t("sections.tab_filters", { defaultValue: "Filters" })}
            titleIcon={<FilterListIcon aria-hidden="true" />}
            ariaLabelledBy="report-viewer-filters-dialog-title"
            ariaDescribedBy="report-viewer-filters-dialog-description"
            paperSx={{
                sx: {
                    "& > .MuiDialogTitle-root": {
                        flexShrink: 0,
                    },
                    "& > .MuiDialogContent-root": {
                        flex: "1 1 auto",
                        minHeight: 0,
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                    },
                    "& > .MuiDialogActions-root": {
                        flexShrink: 0,
                        backgroundColor: theme.palette.background.paper,
                        borderTop: "none",
                        paddingTop: theme.spacing(2),
                    },
                },
            }}
            actions={
                <>
                    <Button
                        onClick={onClose}
                        variant="outlined"
                        size="small"
                        className="cancel-button"
                        fullWidth={false}
                        sx={{
                            mr: isRTL ? 0 : theme.spacing(1),
                            ml: isRTL ? theme.spacing(1) : 0,
                        }}
                    >
                        {t("actions.cancel", { ns: "common" })}
                    </Button>
                    <Button
                        onClick={handleResetToSaved}
                        variant="outlined"
                        size="small"
                        className="cancel-button"
                        fullWidth={false}
                        sx={{
                            mr: isRTL ? 0 : theme.spacing(1),
                            ml: isRTL ? theme.spacing(1) : 0,
                        }}
                    >
                        {t("actions.reset_filters", {
                            defaultValue: "Reset Filters",
                        })}
                    </Button>
                    <Button
                        onClick={handleApply}
                        variant="contained"
                        size="small"
                        className="save-button"
                        fullWidth={false}
                        sx={{
                            direction: isRTL ? "rtl" : "ltr",
                        }}
                    >
                        {t("actions.apply", { defaultValue: "Apply" })}
                    </Button>
                </>
            }
        >
            <Box
                id="report-viewer-filters-dialog-description"
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    flex: "1 1 auto",
                    minHeight: 0,
                    overflow: "hidden",
                    direction: isRTL ? "rtl" : "ltr",
                }}
            >
                <ModalScrollBox id={SCROLL_CONTAINER_ID} isRTL={isRTL}>
                    <FilterBuilder
                        mode="viewer"
                        selectedTables={selectedTables}
                        tables={tables.map((table) => ({
                            name: table.name,
                            label: table.label,
                            fields: (table.fields || []).map((field) => ({
                                name: field.name,
                                type: field.type || "string",
                                label: field.label || field.name,
                                options: field.options,
                                translationKey: field.translationKey,
                                translationNamespace:
                                    field.translationNamespace,
                            })),
                        }))}
                        filters={modalFilters as Array<{
                            table: string;
                            field: string;
                            operator: string;
                            value: unknown;
                        }>}
                        onFiltersChange={(next) =>
                            setModalFilters(next)
                        }
                        validationErrors={validationErrors}
                    />
                </ModalScrollBox>
            </Box>
        </AppDialog>
    );
};

export default ReportViewerFiltersModal;
