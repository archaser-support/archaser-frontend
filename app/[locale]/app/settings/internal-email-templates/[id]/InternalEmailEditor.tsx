"use client";

import AppDialog from "@/shared/layout-components/modal/AppDialog";
import ModalScrollBox from "@/shared/layout-components/modal/ModalScrollBox";
import EmailHtmlEditDialog, { useEmailHtmlDialog } from "@/shared/layout-components/modal/EmailHtmlEditDialog";
import {
    Code,
    DataObject,
    FormatAlignCenter,
    FormatAlignLeft,
    FormatAlignRight,
    FormatBold,
    FormatItalic,
    FormatListBulleted,
    FormatListNumbered,
    FormatQuote,
    FormatUnderlined,
    MoreVert,
    Preview,
    Redo,
    SmartButton,
    Undo,
} from "@mui/icons-material";
import {
    Box,
    Button,
    Divider,
    IconButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Paper,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import React, { useCallback, useRef, useState } from "react";
import ContentEditable from "react-contenteditable";
import { useTranslation } from "react-i18next";

interface InternalEmailEditorProps {
    value: string;
    onChange: (value: string) => void;
    error?: string;
    disabled?: boolean;
}

interface EmailVariable {
    key: string;
    label: string;
    description: string;
    example: string;
}

const INTERNAL_EMAIL_VARIABLES: EmailVariable[] = [
    {
        key: "{{assignee_name}}",
        label: "Assignee Name",
        description: "Name of the person assigned to handle the case",
        example: "John Smith",
    },
    {
        key: "{{customer_name}}",
        label: "Customer Name",
        description: "Name of the customer",
        example: "ABC Company",
    },
    {
        key: "{{invoice_numbers}}",
        label: "Invoice Numbers",
        description: "Comma-separated list of invoice numbers",
        example: "INV-001, INV-002",
    },
    {
        key: "{{dispute_id}}",
        label: "Dispute ID",
        description: "Unique identifier for the dispute",
        example: "DISP-2024-001",
    },
    {
        key: "{{disputed_amount}}",
        label: "Disputed Amount",
        description: "Amount being disputed",
        example: "$1,000.00",
    },
    {
        key: "{{dispute_reason}}",
        label: "Dispute Reason",
        description: "Reason provided for the dispute",
        example: "Service not received",
    },
    {
        key: "{{date_of_dispute}}",
        label: "Date of Dispute",
        description: "Date when the dispute was filed",
        example: "2024-01-15",
    },
    {
        key: "{{user_comment}}",
        label: "User Comment",
        description: "Comment from the user who filed the dispute",
        example: "I never received the service",
    },
    {
        key: "{{dispute_link}}",
        label: "Dispute Link",
        description: "Direct link to view the dispute details",
        example: "https://app.example.com/dispute/123",
    },
];

const InternalEmailEditor: React.FC<InternalEmailEditorProps> = ({
    value,
    onChange,
    error,
    disabled = false,
}) => {
    const theme = useTheme();
    const { t, i18n } = useTranslation(["settings", "common", "disputes"]);
    const isHebrew = i18n.language === "he";
    const [showVariablesDialog, setShowVariablesDialog] = useState(false);
    const [showButtonsDialog, setShowButtonsDialog] = useState(false);
    const htmlDialog = useEmailHtmlDialog({ value, onChange });
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const [undoStack, setUndoStack] = useState<string[]>([]);
    const [redoStack, setRedoStack] = useState<string[]>([]);
    const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(
        null
    );

    const editorRef = useRef<HTMLElement>(null);
    const lastValueRef = useRef<string>("");
    const cursorPositionRef = useRef<number>(0);

    // Initialize undo/redo stacks
    React.useEffect(() => {
        if (value !== lastValueRef.current) {
            setUndoStack((prev) => [...prev, lastValueRef.current]);
            setRedoStack([]);
            lastValueRef.current = value;
            setCanUndo(undoStack.length > 0);
            setCanRedo(false);
        }
    }, [value]);

    // Rich text formatting functions
    const formatText = useCallback(
        (command: string, value?: string) => {
            document.execCommand(command, false, value);
            if (editorRef.current) {
                editorRef.current.focus();
            }
            // Update the value after formatting
            setTimeout(() => {
                if (editorRef.current) {
                    onChange(editorRef.current.innerHTML);
                }
            }, 100);
        },
        [onChange]
    );

    // Undo/Redo functions
    const handleUndo = useCallback(() => {
        if (undoStack.length > 0) {
            const previousValue = undoStack[undoStack.length - 1];
            setRedoStack((prev) => [...prev, value]);
            setUndoStack((prev) => prev.slice(0, -1));
            onChange(previousValue);
            setCanUndo(undoStack.length > 1);
            setCanRedo(true);
        }
    }, [undoStack, value, onChange]);

    const handleRedo = useCallback(() => {
        if (redoStack.length > 0) {
            const nextValue = redoStack[redoStack.length - 1];
            setUndoStack((prev) => [...prev, value]);
            setRedoStack((prev) => prev.slice(0, -1));
            onChange(nextValue);
            setCanUndo(true);
            setCanRedo(redoStack.length > 1);
        }
    }, [redoStack, value, onChange]);

    // Insert variable
    const insertVariable = useCallback(
        (variable: EmailVariable) => {
            if (editorRef.current) {
                editorRef.current.focus();

                // Ensure editor has content for cursor positioning
                if (
                    !editorRef.current.innerHTML ||
                    editorRef.current.innerHTML === "<br>" ||
                    editorRef.current.innerHTML === "<p><br></p>"
                ) {
                    editorRef.current.innerHTML = "<p><br></p>";
                }

                // Get current selection
                const selection = window.getSelection();
                let validRange = null;

                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    if (
                        editorRef.current.contains(
                            range.commonAncestorContainer
                        )
                    ) {
                        validRange = range;
                    }
                }

                if (!validRange) {
                    // Create a new range at the end of the editor
                    validRange = document.createRange();
                    validRange.selectNodeContents(editorRef.current);
                    validRange.collapse(false);
                }

                // Insert the variable
                validRange.deleteContents();
                const textNode = document.createTextNode(variable.key);
                validRange.insertNode(textNode);

                // Move cursor after the inserted variable
                validRange.setStartAfter(textNode);
                validRange.setEndAfter(textNode);

                // Update selection
                selection?.removeAllRanges();
                selection?.addRange(validRange);

                // Update the value immediately
                onChange(editorRef.current.innerHTML);
            }
            setShowVariablesDialog(false);
        },
        [onChange]
    );

    // Insert button
    const insertButton = useCallback(
        (buttonConfig: { text: string; url: string; style?: string }) => {
            if (editorRef.current) {
                editorRef.current.focus();

                // Ensure editor has content for cursor positioning
                if (
                    !editorRef.current.innerHTML ||
                    editorRef.current.innerHTML === "<br>" ||
                    editorRef.current.innerHTML === "<p><br></p>"
                ) {
                    editorRef.current.innerHTML = "<p><br></p>";
                }

                // Get current selection
                const selection = window.getSelection();
                let validRange = null;

                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    if (
                        editorRef.current.contains(
                            range.commonAncestorContainer
                        )
                    ) {
                        validRange = range;
                    }
                }

                if (!validRange) {
                    // Create a new range at the end of the editor
                    validRange = document.createRange();
                    validRange.selectNodeContents(editorRef.current);
                    validRange.collapse(false);
                }

                // Create button HTML
                const defaultStyle =
                    "background-color: #4a90e2; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 5px; display: inline-block; font-weight: bold;";
                const buttonStyle = buttonConfig.style || defaultStyle;
                const buttonHtml = `<a href="${buttonConfig.url}" style="${buttonStyle}" data-template-url="${buttonConfig.url}">${buttonConfig.text}</a>`;

                // Insert the button
                validRange.deleteContents();
                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = buttonHtml;
                const buttonElement = tempDiv.firstChild;

                if (buttonElement) {
                    validRange.insertNode(buttonElement);
                    validRange.setStartAfter(buttonElement);
                    validRange.setEndAfter(buttonElement);
                    selection?.removeAllRanges();
                    selection?.addRange(validRange);
                    onChange(editorRef.current.innerHTML);
                }
            }
            setShowButtonsDialog(false);
        },
        [onChange]
    );

    // Handle content change
    const handleContentChange = useCallback(
        (evt: any) => {
            const newValue = evt.target.value;
            onChange(newValue);
        },
        [onChange]
    );

    // Capture cursor position
    const captureCursorPosition = useCallback(() => {
        if (editorRef.current) {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                if (editorRef.current.contains(range.commonAncestorContainer)) {
                    // Calculate cursor position within the editor
                    const preCaretRange = range.cloneRange();
                    preCaretRange.selectNodeContents(editorRef.current);
                    preCaretRange.setEnd(range.endContainer, range.endOffset);
                    cursorPositionRef.current = preCaretRange.toString().length;
                }
            }
        }
    }, []);

    const buttonTemplates = [
        {
            name: "View Dispute",
            text: "View Dispute Details",
            url: "{{dispute_link}}",
            style: "background-color: #4a90e2; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 5px; display: inline-block; font-weight: bold;",
        },
    ];

    return (
        <Box>
            {/* Toolbar */}
            <Paper
                elevation={1}
                sx={{
                    p: 1,
                    mb: 2,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 0.5,
                    alignItems: "center",
                    bgcolor: "grey.50",
                    flexShrink: 0,
                }}
            >
                {/* Main Buttons: Text Formatting */}
                <Box sx={{ display: "flex", gap: 0.5, mr: 1 }}>
                    <Tooltip title={t("tooltips.bold", { ns: "activities", defaultValue: "Bold" })}>
                        <IconButton
                            size="small"
                            color="primary"
                            onClick={() => formatText("bold")}
                            disabled={disabled}
                        >
                            <FormatBold fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t("tooltips.italic", { ns: "activities", defaultValue: "Italic" })}>
                        <IconButton
                            size="small"
                            color="primary"
                            onClick={() => formatText("italic")}
                            disabled={disabled}
                        >
                            <FormatItalic fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t("tooltips.underline", { ns: "activities", defaultValue: "Underline" })}>
                        <IconButton
                            size="small"
                            color="primary"
                            onClick={() => formatText("underline")}
                            disabled={disabled}
                        >
                            <FormatUnderlined fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>

                <Divider orientation="vertical" flexItem />

                {/* Main Buttons: Email-specific tools */}
                <Box sx={{ display: "flex", gap: 0.5, mr: 1 }}>
                    <Tooltip title={t("tooltips.insert_variables", { ns: "activities", defaultValue: "Insert Variables" })}>
                        <IconButton
                            size="small"
                            color="primary"
                            onClick={() => {
                                // Capture cursor position before opening dialog
                                if (editorRef.current) {
                                    editorRef.current.focus();
                                    // Capture cursor position
                                    captureCursorPosition();
                                    // Small delay to ensure focus is set
                                    setTimeout(() => {
                                        setShowVariablesDialog(true);
                                    }, 10);
                                } else {
                                    setShowVariablesDialog(true);
                                }
                            }}
                            disabled={disabled}
                        >
                            <Code fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t("tooltips.insert_buttons", { ns: "activities", defaultValue: "Insert Buttons" })}>
                        <IconButton
                            size="small"
                            color="primary"
                            onClick={() => setShowButtonsDialog(true)}
                            disabled={disabled}
                        >
                            <SmartButton fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>

                <Divider orientation="vertical" flexItem />

                {/* Main Buttons: Actions */}
                <Box sx={{ display: "flex", gap: 0.5, mr: 1 }}>
                    <Tooltip title={t("tooltips.undo", { ns: "activities", defaultValue: "Undo" })}>
                        <span>
                            <IconButton
                                size="small"
                                color="primary"
                                onClick={handleUndo}
                                disabled={!canUndo || disabled}
                            >
                                <Undo fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title={t("tooltips.redo", { ns: "activities", defaultValue: "Redo" })}>
                        <span>
                            <IconButton
                                size="small"
                                color="primary"
                                onClick={handleRedo}
                                disabled={!canRedo || disabled}
                            >
                                <Redo fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Box>

                <Divider orientation="vertical" flexItem />

                {/* More Menu Button */}
                <Tooltip title={t("tooltips.more_options", { ns: "activities", defaultValue: "More Options" })}>
                    <IconButton
                        size="small"
                        onClick={(e) => setMoreMenuAnchor(e.currentTarget)}
                        disabled={disabled}
                    >
                        <MoreVert fontSize="small" />
                    </IconButton>
                </Tooltip>

                {/* More Menu */}
                <Menu
                    anchorEl={moreMenuAnchor}
                    open={Boolean(moreMenuAnchor)}
                    onClose={() => setMoreMenuAnchor(null)}
                    anchorOrigin={{
                        vertical: "bottom",
                        horizontal: isHebrew ? "right" : "left",
                    }}
                    transformOrigin={{
                        vertical: "top",
                        horizontal: isHebrew ? "right" : "left",
                    }}
                    PaperProps={{
                        sx: {
                            direction: isHebrew ? "rtl" : "ltr",
                        },
                    }}
                >
                    {/* Alignment */}
                    <MenuItem
                        onClick={() => {
                            formatText("justifyLeft");
                            setMoreMenuAnchor(null);
                        }}
                        sx={{
                            direction: isHebrew ? "rtl" : "ltr",
                        }}
                    >
                        <ListItemIcon
                            sx={{
                                minWidth: isHebrew ? "36px" : "40px",
                                marginRight: isHebrew ? 1 : 0,
                                marginLeft: isHebrew ? 0 : 1,
                            }}
                        >
                            <FormatAlignLeft fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                            sx={{
                                direction: isHebrew ? "rtl" : "ltr",
                                textAlign: isHebrew ? "right" : "left",
                            }}
                        >
                            {t("fields.align_left", { ns: "activities", defaultValue: "Align Left" })}
                        </ListItemText>
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            formatText("justifyCenter");
                            setMoreMenuAnchor(null);
                        }}
                        sx={{
                            direction: isHebrew ? "rtl" : "ltr",
                        }}
                    >
                        <ListItemIcon
                            sx={{
                                minWidth: isHebrew ? "36px" : "40px",
                                marginRight: isHebrew ? 1 : 0,
                                marginLeft: isHebrew ? 0 : 1,
                            }}
                        >
                            <FormatAlignCenter fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                            sx={{
                                direction: isHebrew ? "rtl" : "ltr",
                                textAlign: isHebrew ? "right" : "left",
                            }}
                        >
                            {t("fields.align_center", { ns: "activities", defaultValue: "Align Center" })}
                        </ListItemText>
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            formatText("justifyRight");
                            setMoreMenuAnchor(null);
                        }}
                        sx={{
                            direction: isHebrew ? "rtl" : "ltr",
                        }}
                    >
                        <ListItemIcon
                            sx={{
                                minWidth: isHebrew ? "36px" : "40px",
                                marginRight: isHebrew ? 1 : 0,
                                marginLeft: isHebrew ? 0 : 1,
                            }}
                        >
                            <FormatAlignRight fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                            sx={{
                                direction: isHebrew ? "rtl" : "ltr",
                                textAlign: isHebrew ? "right" : "left",
                            }}
                        >
                            {t("fields.align_right", { ns: "activities", defaultValue: "Align Right" })}
                        </ListItemText>
                    </MenuItem>

                    <Divider />

                    {/* Lists */}
                    <MenuItem
                        onClick={() => {
                            formatText("insertUnorderedList");
                            setMoreMenuAnchor(null);
                        }}
                        sx={{
                            direction: isHebrew ? "rtl" : "ltr",
                        }}
                    >
                        <ListItemIcon
                            sx={{
                                minWidth: isHebrew ? "36px" : "40px",
                                marginRight: isHebrew ? 1 : 0,
                                marginLeft: isHebrew ? 0 : 1,
                            }}
                        >
                            <FormatListBulleted fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                            sx={{
                                direction: isHebrew ? "rtl" : "ltr",
                                textAlign: isHebrew ? "right" : "left",
                            }}
                        >
                            {t("fields.bullet_list", { ns: "activities", defaultValue: "Bullet List" })}
                        </ListItemText>
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            formatText("insertOrderedList");
                            setMoreMenuAnchor(null);
                        }}
                        sx={{
                            direction: isHebrew ? "rtl" : "ltr",
                        }}
                    >
                        <ListItemIcon
                            sx={{
                                minWidth: isHebrew ? "36px" : "40px",
                                marginRight: isHebrew ? 1 : 0,
                                marginLeft: isHebrew ? 0 : 1,
                            }}
                        >
                            <FormatListNumbered fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                            sx={{
                                direction: isHebrew ? "rtl" : "ltr",
                                textAlign: isHebrew ? "right" : "left",
                            }}
                        >
                            {t("fields.numbered_list", { ns: "activities", defaultValue: "Numbered List" })}
                        </ListItemText>
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            formatText("formatBlock", "<blockquote>");
                            setMoreMenuAnchor(null);
                        }}
                        sx={{
                            direction: isHebrew ? "rtl" : "ltr",
                        }}
                    >
                        <ListItemIcon
                            sx={{
                                minWidth: isHebrew ? "36px" : "40px",
                                marginRight: isHebrew ? 1 : 0,
                                marginLeft: isHebrew ? 0 : 1,
                            }}
                        >
                            <FormatQuote fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                            sx={{
                                direction: isHebrew ? "rtl" : "ltr",
                                textAlign: isHebrew ? "right" : "left",
                            }}
                        >
                            {t("fields.quote", { ns: "activities", defaultValue: "Quote" })}
                        </ListItemText>
                    </MenuItem>

                    <Divider />

                    {/* View HTML */}
                    <MenuItem
                        onClick={() => {
                            htmlDialog.openDialog();
                            setMoreMenuAnchor(null);
                        }}
                        sx={{
                            direction: isHebrew ? "rtl" : "ltr",
                        }}
                    >
                        <ListItemIcon
                            sx={{
                                minWidth: isHebrew ? "36px" : "40px",
                                marginRight: isHebrew ? 1 : 0,
                                marginLeft: isHebrew ? 0 : 1,
                            }}
                        >
                            <Preview fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                            sx={{
                                direction: isHebrew ? "rtl" : "ltr",
                                textAlign: isHebrew ? "right" : "left",
                            }}
                        >
                            {t("fields.view_html", { ns: "activities", defaultValue: "View HTML" })}
                        </ListItemText>
                    </MenuItem>
                </Menu>
            </Paper>

            {/* Editor */}
            <Box sx={{ position: "relative" }}>
                <ContentEditable
                    innerRef={editorRef}
                    html={value || ""}
                    onChange={handleContentChange}
                    onClick={captureCursorPosition}
                    onKeyUp={captureCursorPosition}
                    onBlur={() => {
                        if (editorRef.current && !disabled) {
                            onChange(editorRef.current.innerHTML);
                        }
                    }}
                    onFocus={() => {
                        if (editorRef.current && !value && !disabled) {
                            editorRef.current.innerHTML = "<p><br></p>";
                        }
                    }}
                    className="outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded border border-gray-300 p-4 min-h-[300px] bg-white"
                    style={{
                        fontFamily: "Arial, sans-serif",
                        lineHeight: "1.6",
                        fontSize: "14px",
                        cursor: disabled ? "not-allowed" : "text",
                        opacity: disabled ? 0.6 : 1,
                        pointerEvents: disabled ? "none" : "auto",
                    }}
                    tagName="div"
                    contentEditable={!disabled}
                />
                {!value && (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                            position: "absolute",
                            top: "16px",
                            left: i18n.language === "he" ? "auto" : "16px",
                            right: i18n.language === "he" ? "16px" : "auto",
                            pointerEvents: "none",
                            userSelect: "none",
                            textAlign:
                                i18n.language === "he" ? "right" : "left",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        }}
                    >
                        {t("tooltips.internal_emails_placeholder", {
                            ns: "disputes",
                        })}
                    </Typography>
                )}
                {error && (
                    <Typography
                        variant="caption"
                        color="error"
                        sx={{ mt: 1, display: "block" }}
                    >
                        {error}
                    </Typography>
                )}
            </Box>

            {/* Variables Dialog */}
            <AppDialog
                open={showVariablesDialog}
                onClose={() => setShowVariablesDialog(false)}
                drag
                align
                slide
                isRTL={isHebrew}
                scrollContainerId="internal-variables-modal-scroll"
                paperWidth="800px"
                paperMaxHeight="80vh"
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
                            p: 0,
                        },
                        "& > .MuiDialogActions-root": {
                            flexShrink: 0,
                        },
                    },
                }}
                title={t("actions.internal_emails_insert_variables", {
                    ns: "disputes",
                    defaultValue: "Insert Variables"
                })}
                titleIcon={<DataObject aria-hidden="true" />}
                ariaLabelledBy="internal-variables-dialog-title"
                ariaDescribedBy="internal-variables-dialog-description"
                actions={
                    <Button
                        onClick={() => setShowVariablesDialog(false)}
                        variant="outlined"
                        size="small"
                        className="cancel-button"
                        sx={{
                            mr: isHebrew ? 0 : theme.spacing(1),
                            ml: isHebrew ? theme.spacing(1) : 0,
                        }}
                    >
                        {t("actions.close", { ns: "common" })}
                    </Button>
                }
            >
                <form
                    style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0, overflow: "hidden" }}
                    onSubmit={(e) => e.preventDefault()}
                >
                    <ModalScrollBox id="internal-variables-modal-scroll" isRTL={isHebrew}>
                        <Box
                            id="internal-variables-dialog-description"
                            component="div"
                            sx={{ pt: 3, px: 3, pb: 3, direction: isHebrew ? "rtl" : "ltr" }}
                        >
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="body2" color="text.secondary" sx={{ textAlign: isHebrew ? "right" : "left" }}>
                                    {t(
                                        "tooltips.internal_emails_variables_dialog_description",
                                        { ns: "disputes" }
                                    )}
                                </Typography>
                            </Box>
                            <Box
                                sx={{
                                    display: "grid",
                                    gap: 2,
                                    gridTemplateColumns:
                                        "repeat(auto-fit, minmax(300px, 1fr))",
                                }}
                            >
                                {INTERNAL_EMAIL_VARIABLES.map((variable) => (
                                    <Paper
                                        key={variable.key}
                                        sx={{
                                            p: 2,
                                            cursor: "pointer",
                                            textAlign: isHebrew ? "right" : "left",
                                            "&:hover": { bgcolor: "action.hover" },
                                        }}
                                        onClick={() => insertVariable(variable)}
                                    >
                                        <Typography
                                            variant="subtitle2"
                                            sx={{
                                                fontFamily: "monospace",
                                                color: "primary.main",
                                            }}
                                        >
                                            {variable.key}
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            sx={{ fontWeight: 500, mt: 0.5 }}
                                        >
                                            {variable.label}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                        >
                                            {variable.description}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                display: "block",
                                                mt: 0.5,
                                                fontStyle: "italic",
                                            }}
                                        >
                                            {t("messages.example", {
                                                ns: "common",
                                                defaultValue: "Example",
                                            })}
                                            : {variable.example}
                                        </Typography>
                                    </Paper>
                                ))}
                            </Box>
                        </Box>
                    </ModalScrollBox>
                </form>
            </AppDialog>

            {/* Buttons Dialog */}
            <AppDialog
                open={showButtonsDialog}
                onClose={() => setShowButtonsDialog(false)}
                drag
                align
                slide
                isRTL={isHebrew}
                scrollContainerId="internal-buttons-modal-scroll"
                paperWidth="600px"
                paperMaxHeight="80vh"
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
                            p: 0,
                        },
                        "& > .MuiDialogActions-root": {
                            flexShrink: 0,
                        },
                    },
                }}
                title={t("actions.internal_emails_insert_email_buttons", {
                    ns: "disputes",
                    defaultValue: "Insert Buttons"
                })}
                titleIcon={<SmartButton aria-hidden="true" />}
                ariaLabelledBy="internal-buttons-dialog-title"
                ariaDescribedBy="internal-buttons-dialog-description"
                actions={
                    <Button
                        onClick={() => setShowButtonsDialog(false)}
                        variant="outlined"
                        size="small"
                        className="cancel-button"
                        sx={{
                            mr: isHebrew ? 0 : theme.spacing(1),
                            ml: isHebrew ? theme.spacing(1) : 0,
                        }}
                    >
                        {t("actions.close", { ns: "common" })}
                    </Button>
                }
            >
                <form
                    style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0, overflow: "hidden" }}
                    onSubmit={(e) => e.preventDefault()}
                >
                    <ModalScrollBox id="internal-buttons-modal-scroll" isRTL={isHebrew}>
                        <Box
                            id="internal-buttons-dialog-description"
                            component="div"
                            sx={{ pt: 3, px: 3, pb: 3, direction: isHebrew ? "rtl" : "ltr" }}
                        >
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="body2" color="text.secondary" sx={{ textAlign: isHebrew ? "right" : "left" }}>
                                    {t(
                                        "tooltips.internal_emails_buttons_dialog_description",
                                        { ns: "disputes" }
                                    )}
                                </Typography>
                            </Box>
                            <Box
                                sx={{
                                    display: "grid",
                                    gap: 2,
                                    gridTemplateColumns:
                                        "repeat(auto-fit, minmax(250px, 1fr))",
                                }}
                            >
                                {buttonTemplates.map((button, index) => (
                                    <Paper
                                        key={index}
                                        sx={{
                                            p: 2,
                                            cursor: "pointer",
                                            textAlign: isHebrew ? "right" : "left",
                                            "&:hover": { bgcolor: "action.hover" },
                                        }}
                                        onClick={() => insertButton(button)}
                                    >
                                        <Typography
                                            variant="subtitle2"
                                            sx={{ fontWeight: 500, mb: 1 }}
                                        >
                                            {button.name}
                                        </Typography>
                                        <Box
                                            component="span"
                                            sx={{
                                                display: "inline-block",
                                                pointerEvents: "none",
                                                backgroundColor: button.style.includes(
                                                    "#27ae60"
                                                )
                                                    ? "#27ae60"
                                                    : button.style.includes("#4a90e2")
                                                        ? "#4a90e2"
                                                        : button.style.includes("#f39c12")
                                                            ? "#f39c12"
                                                            : "#9b59b6",
                                                color: "#ffffff",
                                                textDecoration: "none",
                                                padding: "8px 16px",
                                                borderRadius: "4px",
                                                fontWeight: "bold",
                                                fontSize: "14px",
                                            }}
                                        >
                                            {button.text}
                                        </Box>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ display: "block", mt: 1 }}
                                        >
                                            URL: {button.url}
                                        </Typography>
                                    </Paper>
                                ))}
                            </Box>
                        </Box>
                    </ModalScrollBox>
                </form>
            </AppDialog>

            <EmailHtmlEditDialog
                open={htmlDialog.open}
                onClose={htmlDialog.closeDialog}
                value={htmlDialog.htmlContent}
                onChange={htmlDialog.handleHtmlChange}
                onSave={htmlDialog.handleSaveHtml}
                title={t("actions.internal_emails_edit_html", { ns: "disputes" })}
                description={t("tooltips.internal_emails_html_dialog_description", {
                    ns: "disputes",
                })}
                isRTL={isHebrew}
                ariaLabelledBy="internal-html-dialog-title"
                ariaDescribedBy="internal-html-dialog-description"
            />
        </Box>
    );
};

export default InternalEmailEditor;
