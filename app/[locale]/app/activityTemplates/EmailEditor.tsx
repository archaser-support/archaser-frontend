"use client";

import AppDialog from "@/shared/layout-components/modal/AppDialog";
import ModalScrollBox from "@/shared/layout-components/modal/ModalScrollBox";
import EmailHtmlEditDialog, { useEmailHtmlDialog } from "@/shared/layout-components/modal/EmailHtmlEditDialog";
import {
    Code,
    FormatAlignCenter,
    FormatAlignLeft,
    FormatAlignRight,
    FormatBold,
    FormatItalic,
    FormatListBulleted,
    FormatListNumbered,
    FormatQuote,
    FormatUnderlined,
    Info as InfoIcon,
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
import { alpha } from "@mui/material/styles";
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import ContentEditable from "react-contenteditable";
import { useTranslation } from "react-i18next";

export interface EmailEditorRef {
    insertVariableByKey: (key: string) => void;
}

interface EmailEditorProps {
    value: string;
    onChange: (value: string) => void;
    error?: string;
    height?: string | number;
    /** When provided, toolbar "Insert Variables" opens this callback instead of the internal dialog (e.g. shared form dialog). */
    onInsertVariableClick?: () => void;
}

interface EmailVariable {
    key: string;
    label: string;
    description: string;
    example: string;
}

const EMAIL_VARIABLES: EmailVariable[] = [
    {
        key: "{first_name}",
        label: "First Name",
        description: "Recipient's first name",
        example: "John",
    },
    {
        key: "{last_name}",
        label: "Last Name",
        description: "Recipient's last name",
        example: "Doe",
    },
    {
        key: "{customer_name}",
        label: "Customer Name",
        description: "Name of the customer",
        example: "ABC Company",
    },
    {
        key: "{account_name}",
        label: "Customer Name",
        description: "Your company name",
        example: "Your Company",
    },
    {
        key: "{link}",
        label: "Payment Link",
        description: "Payment settlement link",
        example: "https://pay.example.com/123",
    },
    {
        key: "{amount}",
        label: "Amount",
        description: "Outstanding amount",
        example: "$1,000.00",
    },
    {
        key: "{pay_now_link}",
        label: "Pay Now Link",
        description: "Direct link to make a payment",
        example: "https://portal.example.com/make-payment",
    },
    {
        key: "{settle_payment}",
        label: "Settle Payment Link",
        description: "Link to portal dashboard",
        example: "https://portal.example.com/",
    },
    {
        key: "{view_invoice_link}",
        label: "View Invoice Link",
        description: "Direct link to view invoices",
        example: "https://portal.example.com/view-invoices",
    },
    {
        key: "{due_date}",
        label: "Due Date",
        description: "Payment due date",
        example: "2024-01-15",
    },
    {
        key: "{invoice_number}",
        label: "Invoice Number",
        description: "Invoice reference number",
        example: "INV-2024-001",
    },
    {
        key: "{account_email}",
        label: "Account Email",
        description: "Account email",
        example: "support@example.com",
    },
];

const EmailEditor = forwardRef<EmailEditorRef, EmailEditorProps>(function EmailEditor(
    { value, onChange, error, height = "400px", onInsertVariableClick },
    ref
) {
    const theme = useTheme();
    const { t, i18n } = useTranslation(["activities", "common"]);
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
    const buttonInsertPositionRef = useRef<number>(0);
    const isUndoRedoRef = useRef<boolean>(false);

    // Apply scrollbar styles to ContentEditable and set height when height="100%"
    React.useEffect(() => {
        if (editorRef.current) {
            const element = editorRef.current as HTMLElement;
            // Add scrollbar styles via CSS classes or inline styles
            element.style.scrollbarWidth = "thin";
            element.style.scrollbarColor = `${alpha(theme.palette.primary.main, 0.6)} ${alpha(theme.palette.primary.main, 0.1)}`;

            // For webkit browsers, we need to add a style tag or use CSS
            const styleId = "email-editor-scrollbar-styles";
            if (!document.getElementById(styleId)) {
                const style = document.createElement("style");
                style.id = styleId;
                style.textContent = `
                    .email-editor-content::-webkit-scrollbar {
                        width: 12px;
                    }
                    .email-editor-content::-webkit-scrollbar-track {
                        background-color: ${alpha(theme.palette.primary.main, 0.1)};
                        border-radius: 6px;
                    }
                    .email-editor-content::-webkit-scrollbar-thumb {
                        background-color: ${alpha(theme.palette.primary.main, 0.6)};
                        border-radius: 6px;
                    }
                    .email-editor-content::-webkit-scrollbar-thumb:hover {
                        background-color: ${theme.palette.primary.main};
                    }
                `;
                document.head.appendChild(style);
            }
            element.classList.add("email-editor-content");

            // When height is 100%, calculate and set the actual height
            if (height === "100%" && element.parentElement) {
                let lastHeight = 0;
                let isUpdating = false;
                let updateTimeout: NodeJS.Timeout | null = null;

                const updateHeight = () => {
                    // Prevent recursive updates
                    if (isUpdating) {
                        return;
                    }

                    // Find the first parent with a constrained height
                    let parent = element.parentElement;
                    let availableHeight = 0;

                    // Traverse up to find a parent with actual height
                    while (parent && availableHeight <= 0) {
                        const parentRect = parent.getBoundingClientRect();
                        const parentComputed = window.getComputedStyle(parent);
                        const parentPaddingTop =
                            parseFloat(parentComputed.paddingTop) || 0;
                        const parentPaddingBottom =
                            parseFloat(parentComputed.paddingBottom) || 0;
                        const parentBorderTop =
                            parseFloat(parentComputed.borderTopWidth) || 0;
                        const parentBorderBottom =
                            parseFloat(parentComputed.borderBottomWidth) || 0;
                        const calculatedHeight =
                            parentRect.height -
                            parentPaddingTop -
                            parentPaddingBottom -
                            parentBorderTop -
                            parentBorderBottom;

                        // Use this parent if it has a reasonable height
                        if (calculatedHeight > 100) {
                            availableHeight = calculatedHeight;
                            break;
                        }

                        parent = parent.parentElement;
                    }

                    if (!parent || availableHeight <= 0) return;

                    // Only update if height actually changed (prevent infinite loop)
                    if (Math.abs(availableHeight - lastHeight) < 1) {
                        return;
                    }

                    if (availableHeight > 0) {
                        isUpdating = true;

                        // Remove any height constraints - let it grow with content (fit-content)
                        element.style.minHeight = "";

                        // Force a reflow
                        void element.offsetHeight;

                        lastHeight = availableHeight;

                        // Reset flag after a short delay
                        setTimeout(() => {
                            isUpdating = false;
                        }, 50);
                    }
                };

                // Debounced update function
                const debouncedUpdateHeight = () => {
                    if (updateTimeout) {
                        clearTimeout(updateTimeout);
                    }
                    updateTimeout = setTimeout(() => {
                        updateHeight();
                    }, 10);
                };

                // Set height initially with multiple delays to catch different render phases
                setTimeout(() => {
                    updateHeight();
                }, 0);

                setTimeout(() => {
                    updateHeight();
                }, 100);

                setTimeout(() => {
                    updateHeight();
                }, 500);

                // Use ResizeObserver to update height when parent resizes
                // ONLY observe the parent, NOT the element itself to prevent infinite loop
                const resizeObserver = new ResizeObserver((entries) => {
                    entries.forEach((entry) => {
                        const isElement = entry.target === element;

                        // Only update if parent resized, not if element resized
                        if (!isElement) {
                            debouncedUpdateHeight();
                        }
                    });
                });

                // Only observe the parent, NOT the element itself
                if (element.parentElement) {
                    resizeObserver.observe(element.parentElement);
                }

                return () => {
                    if (updateTimeout) {
                        clearTimeout(updateTimeout);
                    }
                    resizeObserver.disconnect();
                };
            }
        }
    }, [theme, height]);

    // Initialize undo/redo stacks
    React.useEffect(() => {
        if (value !== lastValueRef.current) {
            // Don't update stacks if we're in the middle of an undo/redo operation
            if (!isUndoRedoRef.current) {
                setUndoStack((prev) => [...prev, lastValueRef.current]);
                setRedoStack([]);
            }
            lastValueRef.current = value;
            setCanUndo(undoStack.length > 0);
            setCanRedo(redoStack.length > 0);
        }
    }, [value, undoStack.length, redoStack.length]);

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
            isUndoRedoRef.current = true;
            const previousValue = undoStack[undoStack.length - 1];
            setRedoStack((prev) => [...prev, value]);
            setUndoStack((prev) => prev.slice(0, -1));
            onChange(previousValue);
            setCanUndo(undoStack.length > 1);
            setCanRedo(true);
            // Reset flag after state updates
            setTimeout(() => {
                isUndoRedoRef.current = false;
            }, 0);
        }
    }, [undoStack, value, onChange]);

    const handleRedo = useCallback(() => {
        if (redoStack.length > 0) {
            isUndoRedoRef.current = true;
            const nextValue = redoStack[redoStack.length - 1];
            setUndoStack((prev) => [...prev, value]);
            setRedoStack((prev) => prev.slice(0, -1));
            onChange(nextValue);
            setCanUndo(true);
            setCanRedo(redoStack.length > 1);
            // Reset flag after state updates
            setTimeout(() => {
                isUndoRedoRef.current = false;
            }, 0);
        }
    }, [redoStack, value, onChange]);

    // Handle content change
    const handleContentChange = useCallback(
        (evt: any) => {
            const newValue = evt.target.value;
            // Only update if the value has actually changed to prevent content erasure
            if (newValue !== value) {
                onChange(newValue);
            }
        },
        [onChange, value]
    );

    // Logical offset: text characters + 1 per block boundary. Only direct children of editor count as blocks
    // so <div>line1</div><div><br></div> has one boundary between the two divs (not the inner <br>).
    const getTextOffsetFromRange = useCallback(
        (editor: HTMLElement, range: Range): number => {
            const endContainer = range.endContainer;
            const endOffset = range.endOffset;
            const cursorRange = document.createRange();
            cursorRange.setStart(endContainer, endOffset);
            cursorRange.collapse(true);
            const isBlockChild = (n: Node) =>
                n.parentNode === editor &&
                n.nodeType === Node.ELEMENT_NODE &&
                /^(DIV|P|BR)$/.test((n as Element).tagName);
            const walker = document.createTreeWalker(editor, NodeFilter.SHOW_ALL, null);
            let pos = 0;
            const firstChild = editor.firstChild;
            let node: Node | null;
            while ((node = walker.nextNode())) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const len = (node.textContent?.length ?? 0);
                    if (node === endContainer) {
                        return pos + endOffset;
                    }
                    const endOfNode = document.createRange();
                    endOfNode.setStart(node, len);
                    endOfNode.collapse(true);
                    if (cursorRange.compareBoundaryPoints(Range.START_TO_END, endOfNode) > 0) {
                        pos += len;
                    } else {
                        return pos;
                    }
                } else if (isBlockChild(node)) {
                    if (node !== firstChild) {
                        pos += 1;
                    }
                    const atStart = document.createRange();
                    atStart.setStart(node, 0);
                    atStart.collapse(true);
                    const cmp = cursorRange.compareBoundaryPoints(Range.START_TO_END, atStart);
                    if (cmp <= 0) {
                        return pos;
                    }
                    if (node.contains(endContainer)) {
                        return pos;
                    }
                    const afterNode = document.createRange();
                    afterNode.setStartAfter(node);
                    afterNode.collapse(true);
                    if (cursorRange.compareBoundaryPoints(Range.START_TO_END, afterNode) > 0) {
                        pos += 1;
                    }
                }
            }
            return pos;
        },
        []
    );

    // Capture cursor position (logical offset: text + block boundaries)
    const captureCursorPosition = useCallback(() => {
        if (editorRef.current) {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                if (editorRef.current.contains(range.commonAncestorContainer)) {
                    cursorPositionRef.current = getTextOffsetFromRange(
                        editorRef.current,
                        range
                    );
                }
            }
        }
    }, [getTextOffsetFromRange]);

    // Resolve logical offset to a Range for insertion (same counting as getTextOffsetFromRange).
    const getInsertionRange = useCallback(
        (editor: HTMLElement, logicalPos: number): Range => {
            const isBlockChild = (n: Node) =>
                n.parentNode === editor &&
                n.nodeType === Node.ELEMENT_NODE &&
                /^(DIV|P|BR)$/.test((n as Element).tagName);
            const walker = document.createTreeWalker(editor, NodeFilter.SHOW_ALL, null);
            let pos = 0;
            const firstChild = editor.firstChild;
            let node: Node | null;
            while ((node = walker.nextNode())) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const len = (node.textContent?.length ?? 0);
                    if (pos + len >= logicalPos) {
                        const range = document.createRange();
                        range.setStart(node, logicalPos - pos);
                        range.setEnd(node, logicalPos - pos);
                        return range;
                    }
                    pos += len;
                } else if (isBlockChild(node)) {
                    if (node !== firstChild) {
                        pos += 1;
                    }
                    if (logicalPos <= pos) {
                        const range = document.createRange();
                        range.setStart(node, 0);
                        range.setEnd(node, 0);
                        return range;
                    }
                }
            }
            const range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
            return range;
        },
        []
    );

    // Remove placeholder <br> when we inserted at start of empty block (<div><br></div>) to avoid extra line.
    const removePlaceholderBrAfterInsert = useCallback((insertedNode: Node) => {
        const parent = insertedNode.parentNode;
        if (!parent || parent.nodeType !== Node.ELEMENT_NODE) return;
        const el = parent as Element;
        if (!/^(DIV|P)$/.test(el.tagName)) return;
        const next = insertedNode.nextSibling;
        if (next?.nodeName === "BR" && parent.childNodes.length === 2) {
            next.remove();
        }
    }, []);

    // Insert variable at cursor (shared logic; does not close dialog). Uses DOM insertion so HTML is preserved.
    const doInsertVariable = useCallback(
        (variable: EmailVariable) => {
            if (!editorRef.current) return;
            const cursorPos = cursorPositionRef.current;
            const range = getInsertionRange(editorRef.current, cursorPos);
            const textNode = document.createTextNode(variable.key);
            range.insertNode(textNode);
            removePlaceholderBrAfterInsert(textNode);
            range.setStart(textNode, textNode.length);
            range.setEnd(textNode, textNode.length);
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
            onChange(editorRef.current.innerHTML);
        },
        [onChange, getInsertionRange, removePlaceholderBrAfterInsert]
    );

    const insertVariable = useCallback(
        (variable: EmailVariable) => {
            doInsertVariable(variable);
            setShowVariablesDialog(false);
            setTimeout(() => editorRef.current?.focus(), 50);
        },
        [doInsertVariable]
    );

    useImperativeHandle(
        ref,
        () => ({
            insertVariableByKey(key: string) {
                const variable = EMAIL_VARIABLES.find((v) => v.key === key);
                if (variable) doInsertVariable(variable);
            },
        }),
        [doInsertVariable]
    );

    // Insert button (using DOM manipulation with saved cursor position; same logical offset as variables)
    const insertButton = useCallback(
        (buttonConfig: { text: string; url: string; style?: string }) => {
            if (editorRef.current) {
                const defaultStyle =
                    "background-color: #4a90e2; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 5px; display: inline-block; font-weight: bold;";
                const buttonStyle = buttonConfig.style || defaultStyle;

                const stableStyle = `${buttonStyle}; line-height: 1; vertical-align: middle; box-sizing: border-box;`;
                const buttonHtml = `<a href="${buttonConfig.url}" style="${stableStyle}" data-template-url="${buttonConfig.url}">${buttonConfig.text}</a>`;

                const cursorPos = buttonInsertPositionRef.current;
                const range = getInsertionRange(editorRef.current, cursorPos);

                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = buttonHtml;
                const buttonElement = tempDiv.firstChild;

                if (buttonElement) {
                    range.insertNode(buttonElement);
                    removePlaceholderBrAfterInsert(buttonElement);
                    range.setStartAfter(buttonElement);
                    range.setEndAfter(buttonElement);
                    const selection = window.getSelection();
                    selection?.removeAllRanges();
                    selection?.addRange(range);
                    onChange(editorRef.current.innerHTML);
                    editorRef.current.focus();
                }
            }
            setShowButtonsDialog(false);
        },
        [onChange, getInsertionRange, removePlaceholderBrAfterInsert]
    );

    const buttonTemplates = [
        {
            textKey: "tooltips.insert_buttons_pay_now",
            url: "{pay_now_link}",
            style: "background-color: #27ae60; color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;",
        },
        {
            textKey: "tooltips.insert_buttons_settle_payment",
            url: "{settle_payment}",
            style: "background-color: #4a90e2; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 5px; display: inline-block; font-weight: bold;",
        },
        {
            textKey: "tooltips.insert_buttons_view_invoice",
            url: "{view_invoice_link}",
            style: "background-color: #9b59b6; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 4px; display: inline-block; font-weight: bold;",
        },
    ];

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                height: height === "100%" ? "100%" : "auto",
                flex: height === "100%" ? "1 1 auto" : "0 0 auto",
                minHeight: 0,
            }}
        >
            {/* Toolbar */}
            <Paper
                elevation={0}
                square
                sx={{
                    p: 1,
                    mb: 2,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 0.5,
                    alignItems: "center",
                    bgcolor: "grey.50",
                    flexShrink: 0,
                    border: "none",
                    boxShadow: "none",
                }}
            >
                {/* Main Buttons: Text Formatting */}
                <Box sx={{ display: "flex", gap: 0.5, mr: 1 }}>
                    <Tooltip title={t("tooltips.bold", { ns: "activities", defaultValue: "Bold" })}>
                        <IconButton
                            size="small"
                            color="primary"
                            onClick={() => formatText("bold")}
                        >
                            <FormatBold fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t("tooltips.italic", { ns: "activities", defaultValue: "Italic" })}>
                        <IconButton
                            size="small"
                            color="primary"
                            onClick={() => formatText("italic")}
                        >
                            <FormatItalic fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t("tooltips.underline", { ns: "activities", defaultValue: "Underline" })}>
                        <IconButton
                            size="small"
                            color="primary"
                            onClick={() => formatText("underline")}
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
                            onMouseDown={(e) => {
                                e.preventDefault();
                                if (editorRef.current) captureCursorPosition();
                            }}
                            onClick={() => {
                                if (onInsertVariableClick) {
                                    setTimeout(() => onInsertVariableClick(), 10);
                                } else {
                                    setTimeout(() => setShowVariablesDialog(true), 10);
                                }
                            }}
                        >
                            <Code fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t("tooltips.insert_buttons", { ns: "activities", defaultValue: "Insert Buttons" })}>
                        <IconButton
                            size="small"
                            color="primary"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                if (editorRef.current) {
                                    captureCursorPosition();
                                    buttonInsertPositionRef.current = cursorPositionRef.current;
                                }
                            }}
                            onClick={() => setShowButtonsDialog(true)}
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
                                disabled={!canUndo}
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
                                disabled={!canRedo}
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
            <Box
                sx={{
                    position: "relative",
                    width: "100%",
                    mb: 2,
                    flex: "1 1 auto",
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                    overflow: "hidden",
                }}
            >
                <ContentEditable
                    innerRef={editorRef}
                    html={value || ""}
                    onChange={handleContentChange}
                    onClick={captureCursorPosition}
                    onKeyUp={captureCursorPosition}
                    onBlur={() => {
                        if (editorRef.current) {
                            // Store cursor position as soon as editor loses focus (e.g. user clicked toolbar)
                            captureCursorPosition();
                            // Only update if the content has actually changed
                            const currentContent = editorRef.current.innerHTML;
                            if (currentContent !== value) {
                                onChange(currentContent);
                            }
                            // Reset border color on blur
                            if (!error) {
                                editorRef.current.style.borderColor = "#ccc";
                            }
                        }
                    }}
                    onFocus={() => {
                        // Set focus border color
                        if (editorRef.current && !error) {
                            editorRef.current.style.borderColor = "#6B46C1";
                        }
                    }}
                    className="outline-none rounded bg-white email-editor-content"
                    style={
                        {
                            fontFamily: "Arial, sans-serif",
                            lineHeight: "1.6",
                            fontSize: "14px",
                            cursor: "text",
                            height: "100%",
                            minHeight: "200px",
                            width: "100%",
                            flex: "1 1 auto",
                            overflow: "auto",
                            display: "block",
                            boxSizing: "border-box",
                            border: error
                                ? "1px solid #d32f2f"
                                : "1px solid #ccc",
                            borderRadius: "4px",
                            padding: "12px",
                            transition: "border-color 0.2s ease-in-out",
                            scrollbarWidth: "thin",
                            scrollbarColor: `${alpha(theme.palette.primary.main, 0.6)} ${alpha(theme.palette.primary.main, 0.1)}`,
                        } as React.CSSProperties
                    }
                    tagName="div"
                />
                {!value && (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                            position: "absolute",
                            top: "16px",
                            left: isHebrew ? "auto" : "16px",
                            right: isHebrew ? "16px" : "auto",
                            pointerEvents: "none",
                            userSelect: "none",
                            textAlign: isHebrew ? "right" : "left",
                            direction: isHebrew ? "rtl" : "ltr",
                        }}
                    >
                        {t("fields.email_body_placeholder", {
                            ns: "activities",
                            defaultValue:
                                "Start typing your email content here... Click the Variables button to insert dynamic content.",
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

            {!onInsertVariableClick && (
                <>
                    {/* Variables Dialog (only when not using external dialog) */}
                    <AppDialog
                        open={showVariablesDialog}
                        onClose={() => setShowVariablesDialog(false)}
                        drag
                        align
                        slide
                        isRTL={isHebrew}
                        scrollContainerId="email-editor-variables-scroll"
                        paperWidth="320px"
                        paperMaxHeight="55vh"
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
                        title={t("tooltips.insert_variables", { ns: "activities" })}
                        titleIcon={<Code aria-hidden="true" />}
                        ariaLabelledBy="variables-dialog-title"
                        ariaDescribedBy="variables-dialog-description"
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
                            <ModalScrollBox id="email-editor-variables-scroll" isRTL={isHebrew}>
                                <Box
                                    id="variables-dialog-description"
                                    component="div"
                                    sx={{
                                        direction: isHebrew ? "rtl" : "ltr",
                                        textAlign: isHebrew ? "right" : "left",
                                        pl: isHebrew ? theme.spacing(1) : "40px",
                                        pr: isHebrew ? "40px" : theme.spacing(1),
                                        paddingTop: theme.spacing(2),
                                        paddingBottom: theme.spacing(2),
                                    }}
                                >
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{
                                            mb: 2,
                                            direction: isHebrew ? "rtl" : "ltr",
                                            textAlign: isHebrew ? "right" : "left",
                                        }}
                                    >
                                        Click on a variable to insert it into your email
                                        template:
                                    </Typography>
                                    <Box
                                        sx={{
                                            display: "grid",
                                            gap: 2,
                                            gridTemplateColumns: "1fr",
                                            direction: isHebrew ? "rtl" : "ltr",
                                        }}
                                    >
                                        {EMAIL_VARIABLES.map((variable) => (
                                            <Paper
                                                key={variable.key}
                                                elevation={0}
                                                sx={{
                                                    p: 2,
                                                    cursor: "pointer",
                                                    "&:hover": { bgcolor: "action.hover" },
                                                }}
                                                onClick={() => insertVariable(variable)}
                                            >
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 0.5,
                                                        flexWrap: "wrap",
                                                        direction: isHebrew ? "rtl" : "ltr",
                                                    }}
                                                >
                                                    <Typography
                                                        variant="subtitle2"
                                                        sx={{
                                                            fontFamily: "monospace",
                                                            color: "primary.main",
                                                            textAlign: isHebrew ? "right" : "left",
                                                        }}
                                                    >
                                                        {variable.key}
                                                    </Typography>
                                                    <Tooltip
                                                        title={variable.description}
                                                        arrow
                                                        enterDelay={300}
                                                        leaveDelay={100}
                                                        placement="bottom"
                                                        PopperProps={{
                                                            sx: {
                                                                "& .MuiTooltip-tooltip": {
                                                                    direction: isHebrew ? "rtl" : "ltr",
                                                                },
                                                                "& .MuiTooltip-arrow": {
                                                                    ...(isHebrew && { transform: "scaleX(-1)" }),
                                                                },
                                                            },
                                                        }}
                                                    >
                                                        <InfoIcon
                                                            fontSize="small"
                                                            sx={{
                                                                color: "text.secondary",
                                                                fontSize: "1rem",
                                                                cursor: "help",
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </Tooltip>
                                                </Box>
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        display: "block",
                                                        mt: 0.5,
                                                        fontStyle: "italic",
                                                        direction: isHebrew ? "rtl" : "ltr",
                                                        textAlign: isHebrew ? "right" : "left",
                                                    }}
                                                >
                                                    Example: {variable.example}
                                                </Typography>
                                            </Paper>
                                        ))}
                                    </Box>
                                </Box>
                            </ModalScrollBox>
                        </form>
                    </AppDialog>
                </>
            )}

            {/* Buttons Dialog (Insert Button) - AppDialog for drag/align/slide */}
            <AppDialog
                open={showButtonsDialog}
                onClose={() => setShowButtonsDialog(false)}
                drag
                align
                slide
                isRTL={isHebrew}
                scrollContainerId="email-editor-buttons-scroll"
                paperWidth="320px"
                paperMaxHeight="55vh"
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
                title={t("tooltips.insert_buttons")}
                titleIcon={<SmartButton aria-hidden="true" />}
                ariaLabelledBy="buttons-dialog-title"
                ariaDescribedBy="buttons-dialog-description"
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
                        {t("actions.close", { ns: "common", defaultValue: "Close" })}
                    </Button>
                }
            >
                <form
                    style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0, overflow: "hidden" }}
                    onSubmit={(e) => e.preventDefault()}
                >
                    <ModalScrollBox id="email-editor-buttons-scroll" isRTL={isHebrew}>
                        <Box
                            id="buttons-dialog-description"
                            component="div"
                            sx={{
                                pt: 2,
                                pb: 2,
                                px: 2,
                                direction: isHebrew ? "rtl" : "ltr",
                            }}
                        >
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mb: 2 }}
                            >
                                {t("tooltips.insert_buttons_description", {
                                    ns: "activities",
                                    defaultValue:
                                        "Click on a button template to insert it into your email. Template variables like {{link}} will be replaced with actual URLs when the email is sent.",
                                    link: "{link}",
                                })}
                            </Typography>
                            <Box
                                sx={{
                                    display: "grid",
                                    gap: 1,
                                    gridTemplateColumns: "1fr",
                                }}
                            >
                                {buttonTemplates.map((button, index) => (
                                    <Paper
                                        key={index}
                                        elevation={0}
                                        sx={{
                                            px: 2,
                                            py: 0.5,
                                            display: "flex",
                                            justifyContent: "center",
                                            alignItems: "center",
                                            cursor: "pointer",
                                            "&:hover": { bgcolor: "action.hover" },
                                        }}
                                        onClick={() =>
                                            insertButton({
                                                text: t(button.textKey, {
                                                    ns: "activities",
                                                }),
                                                url: button.url,
                                                style: button.style,
                                            })
                                        }
                                    >
                                        <Box
                                            component="a"
                                            href="#"
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
                                                padding: "4px 12px",
                                                borderRadius: "4px",
                                                fontWeight: "bold",
                                                fontSize: "13px",
                                                lineHeight: 1.25,
                                            }}
                                        >
                                            {t(button.textKey, { ns: "activities" })}
                                        </Box>
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
                title={`${t("actions.edit", { ns: "common" })} HTML`}
                description={t("tooltips.insert_buttons_description", {
                    ns: "activities",
                })}
                isRTL={isHebrew}
                ariaLabelledBy="email-html-dialog-title"
                ariaDescribedBy="email-html-dialog-description"
            />
        </Box>
    );
});

export default EmailEditor;
