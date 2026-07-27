"use client";

import { Box, Button, Typography, useTheme } from "@mui/material";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import AppDialog from "@/shared/layout-components/modal/AppDialog";

const SELF_CLOSING_TAGS = new Set([
    "br",
    "hr",
    "img",
    "input",
    "meta",
    "link",
    "area",
    "base",
    "col",
    "embed",
    "source",
    "track",
    "wbr",
]);

/**
 * Pretty-print HTML with indentation for readability when the dialog opens.
 */
function formatHtml(html: string): string {
    const trimmed = html.trim();
    if (!trimmed) return trimmed;
    const parts = trimmed
        .replace(/\s*\n\s*/g, " ")
        .replace(/\s+/g, " ")
        .split(/(<[^>]+>)/g)
        .filter(Boolean);
    let depth = 0;
    const indent = () => "  ".repeat(depth);
    const lines: string[] = [];
    for (const part of parts) {
        const closeMatch = part.match(/^<\/(\w+)\s*>$/);
        const openMatch = part.match(/^<(\w+)[\s>]/);
        const selfMatch = part.match(/^<(\w+)[^>]*\/\s*>$/);
        if (closeMatch) {
            depth = Math.max(0, depth - 1);
            lines.push(indent() + part.trim());
        } else if (selfMatch || part.match(/^<\?/)) {
            lines.push(indent() + part.trim());
        } else if (openMatch) {
            const tag = openMatch[1].toLowerCase();
            lines.push(indent() + part.trim());
            if (!SELF_CLOSING_TAGS.has(tag) && !part.endsWith("/>")) {
                depth++;
            }
        } else {
            const text = part.trim();
            if (text) lines.push(indent() + text);
        }
    }
    return lines.join("\n");
}

export interface UseEmailHtmlDialogOptions {
    value: string;
    onChange: (html: string) => void;
}

export interface UseEmailHtmlDialogReturn {
    open: boolean;
    htmlContent: string;
    openDialog: () => void;
    closeDialog: () => void;
    handleHtmlChange: (html: string) => void;
    handleSaveHtml: () => void;
}

/**
 * Shared state and handlers for the email HTML edit dialog.
 * Use with EmailHtmlEditDialog to avoid duplicating dialog logic in each editor.
 */
export function useEmailHtmlDialog({
    value,
    onChange,
}: UseEmailHtmlDialogOptions): UseEmailHtmlDialogReturn {
    const [open, setOpen] = useState(false);
    const [htmlContent, setHtmlContent] = useState("");

    const openDialog = useCallback(() => {
        setHtmlContent(formatHtml(value || ""));
        setOpen(true);
    }, [value]);

    const closeDialog = useCallback(() => setOpen(false), []);

    const handleHtmlChange = useCallback((newHtml: string) => {
        setHtmlContent(newHtml);
    }, []);

    const handleSaveHtml = useCallback(() => {
        onChange(htmlContent);
        setOpen(false);
    }, [htmlContent, onChange]);

    return {
        open,
        htmlContent,
        openDialog,
        closeDialog,
        handleHtmlChange,
        handleSaveHtml,
    };
}

export interface EmailHtmlEditDialogProps {
    open: boolean;
    onClose: () => void;
    /** Current HTML content (controlled). */
    value: string;
    /** Called when the user edits the textarea. */
    onChange: (html: string) => void;
    /** Called when the user clicks Save. */
    onSave: () => void;
    title: React.ReactNode;
    /** Description text shown above the textarea (e.g. template variables note). */
    description?: React.ReactNode;
    isRTL?: boolean;
    ariaLabelledBy: string;
    ariaDescribedBy: string;
    cancelLabel?: React.ReactNode;
    saveLabel?: React.ReactNode;
}

/**
 * Modal for editing email HTML source. Uses AppDialog with slide, drag, and align.
 * Does not close on backdrop click so the user can click outside without losing work.
 * Supports RTL (direction, textAlign) and uses common translations for default button labels.
 */
const EmailHtmlEditDialog: React.FC<EmailHtmlEditDialogProps> = ({
    open,
    onClose,
    value,
    onChange,
    onSave,
    title,
    description,
    isRTL = false,
    ariaLabelledBy,
    ariaDescribedBy,
    cancelLabel,
    saveLabel,
}) => {
    const theme = useTheme();
    const { t } = useTranslation("common");
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    const resolvedCancelLabel = cancelLabel ?? t("actions.cancel");
    const resolvedSaveLabel = saveLabel ?? t("actions.save");

    // Focus the textarea when the dialog opens so it's immediately editable
    useEffect(() => {
        if (!open) return;
        const id = requestAnimationFrame(() => {
            textareaRef.current?.focus();
        });
        return () => cancelAnimationFrame(id);
    }, [open]);

    const handleClose = useCallback(
        (_: unknown, reason?: string) => {
            if (reason === "backdropClick") return;
            onClose();
        },
        [onClose]
    );

    return (
        <AppDialog
            open={open}
            onClose={handleClose as () => void}
            drag
            align
            slide
            resize
            isRTL={isRTL}
            resizeOptions={{
                initialWidth: 900,
                heightFraction: 0.75,
                minWidth: 500,
                maxWidth: 1200,
                minHeight: 400,
                maxHeight: 0.95,
            }}
            paperSx={{
                sx: {
                    "& > .MuiDialogContent-root": {
                        display: "flex",
                        flexDirection: "column",
                        flex: "1 1 auto",
                        minHeight: 0,
                        overflow: "hidden",
                    },
                },
            }}
            title={title}
            titleIcon={null}
            ariaLabelledBy={ariaLabelledBy}
            ariaDescribedBy={ariaDescribedBy}
            disableAutoFocus
            actions={
                <>
                    <Button
                        onClick={onClose}
                        variant="outlined"
                        size="small"
                        className="cancel-button"
                        sx={{
                            mr: isRTL ? 0 : theme.spacing(1),
                            ml: isRTL ? theme.spacing(1) : 0,
                        }}
                    >
                        {resolvedCancelLabel}
                    </Button>
                    <Button
                        onClick={onSave}
                        variant="contained"
                        size="small"
                        className="save-button"
                        sx={{
                            direction: isRTL ? "rtl" : "ltr",
                            "& .MuiButton-endIcon": {
                                marginLeft: isRTL ? 0 : theme.spacing(1),
                                marginRight: isRTL ? theme.spacing(1) : 0,
                            },
                            "& .MuiButton-startIcon": {
                                marginRight: isRTL ? 0 : theme.spacing(1),
                                marginLeft: isRTL ? theme.spacing(1) : 0,
                            },
                        }}
                    >
                        {resolvedSaveLabel}
                    </Button>
                </>
            }
        >
            <Box
                id={ariaDescribedBy}
                component="div"
                sx={{
                    direction: isRTL ? "rtl" : "ltr",
                    textAlign: isRTL ? "right" : "left",
                    display: "flex",
                    flexDirection: "column",
                    flex: "1 1 auto",
                    minHeight: 0,
                    overflow: "hidden",
                }}
            >
                {description != null && (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                            mb: 2,
                            flexShrink: 0,
                            direction: isRTL ? "rtl" : "ltr",
                            textAlign: isRTL ? "right" : "left",
                        }}
                    >
                        {description}
                    </Typography>
                )}
                <Box
                    sx={{
                        flex: "1 1 auto",
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    <Box
                        component="textarea"
                        ref={(el) => {
                            textareaRef.current = el as HTMLTextAreaElement | null;
                        }}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        aria-label={t("actions.edit") + " HTML"}
                        dir="ltr"
                        sx={{
                            width: "100%",
                            flex: 1,
                            minHeight: 0,
                            fontFamily: "monospace",
                            fontSize: "14px",
                            p: 2,
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 1,
                            resize: "none",
                            direction: "ltr",
                            textAlign: "left",
                        }}
                    />
                </Box>
            </Box>
        </AppDialog>
    );
};

export default EmailHtmlEditDialog;
