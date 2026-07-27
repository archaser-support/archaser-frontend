"use client";

import AppDialog from "@/shared/layout-components/modal/AppDialog";
import {
    CheckCircle as CheckCircleIcon,
    Code as CodeIcon,
    Delete as DeleteIcon,
    Email as EmailIcon,
    HelpOutline as HelpOutlineIcon,
    Sms as SmsIcon,
    Warning as WarningIcon,
    WhatsApp as WhatsAppIcon,
} from "@mui/icons-material";
import {
    Box,
    Button,
    FormControl,
    FormControlLabel,
    IconButton,
    MenuItem,
    Paper,
    Select,
    Switch,
    Tab,
    Tabs,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { LanguageSelect } from "@/components/LocationSelects";

import EmailEditor, { EmailEditorRef } from "./EmailEditor";
import VariableInsertionDialog from "./VariableInsertionDialog";

export interface LanguageTemplate {
    language: string;
    sms_content: string;
    whatsapp_content: string;
    email_subject: string;
    email_content: string;
}

export interface ActivityTemplate {
    id: number;
    name: string;
    category: string;
    language: string; // Keep for backward compatibility
    sms_content: string; // Keep for backward compatibility
    whatsapp_content: string; // Keep for backward compatibility
    email_subject: string; // Keep for backward compatibility
    email_content: string; // Keep for backward compatibility
    active: boolean;
    dispute_resolution?: string; // Add dispute_resolution field
    languageTemplates?: LanguageTemplate[]; // New field for multiple languages
}

interface ActivityTemplateFormProps {
    formData: ActivityTemplate;
    errors: Record<string, string>;
    hasValidated?: boolean;
    onInputChange: (
        _field: keyof ActivityTemplate,
        _value: string | boolean
    ) => void;
    onLanguageTemplateChange?: (
        _language: string,
        _field: keyof LanguageTemplate,
        _value: string
    ) => void;
    onAddLanguage?: (language: string) => void;
    onRemoveLanguage?: (language: string) => void;
    onSelectedLanguageChange?: (language: string) => void;
    disabled?: boolean;
    showCategory?: boolean;
    lockedCategory?: string;
}

// Extended language list for better scalability
const SUPPORTED_LANGUAGES = [
    { code: "English", label: "fields.languages_english", flag: "🇺🇸" },
    { code: "Hebrew", label: "fields.languages_hebrew", flag: "🇮🇱" },
    { code: "Spanish", label: "fields.languages_spanish", flag: "🇪🇸" },
    { code: "French", label: "fields.languages_french", flag: "🇫🇷" },
    { code: "German", label: "fields.languages_german", flag: "🇩🇪" },
    { code: "Italian", label: "fields.languages_italian", flag: "🇮🇹" },
    { code: "Portuguese", label: "fields.languages_portuguese", flag: "🇵🇹" },
    { code: "Russian", label: "fields.languages_russian", flag: "🇷🇺" },
    { code: "Arabic", label: "fields.languages_arabic", flag: "🇸🇦" },
    { code: "Chinese", label: "fields.languages_chinese", flag: "🇨🇳" },
    { code: "Japanese", label: "fields.languages_japanese", flag: "🇯🇵" },
    { code: "Korean", label: "fields.languages_korean", flag: "🇰🇷" },
];


export default function ActivityTemplateForm({
    formData,
    errors,
    hasValidated = false,
    onInputChange,
    onLanguageTemplateChange,
    onAddLanguage,
    onRemoveLanguage,
    onSelectedLanguageChange,
    disabled = false,
    showCategory: _showCategory = true,
    lockedCategory,
}: ActivityTemplateFormProps) {
    const { t, i18n } = useTranslation([
        "common",
        "activity_templates",
        "disputes",
    ]);
    const theme = useTheme();
    const [activeContentTab, setActiveContentTab] = useState(0);
    const [selectedLanguage, setSelectedLanguage] = useState<string>("");
    const [deleteLanguageConfirmation, setDeleteLanguageConfirmation] =
        useState<{
            isOpen: boolean;
            language: string | null;
        }>({ isOpen: false, language: null });

    // Refs for textarea elements and cursor position tracking
    const smsTextareaRef = useRef<HTMLTextAreaElement>(null);
    const whatsappTextareaRef = useRef<HTMLTextAreaElement>(null);
    const emailSubjectRef = useRef<HTMLInputElement>(null);
    const emailEditorRef = useRef<EmailEditorRef>(null);
    const [smsCursorPosition, setSmsCursorPosition] = useState(0);
    const [whatsappCursorPosition, setWhatsappCursorPosition] = useState(0);
    const [emailSubjectCursorPosition, setEmailSubjectCursorPosition] =
        useState(0);

    // Variable insertion dialog states (shared for subject/sms/whatsapp and email body)
    const [variableDialog, setVariableDialog] = useState<{
        isOpen: boolean;
        openedFromBody?: boolean;
        field: string | null;
        language: string | null;
        cursorPosition: number | null;
    }>({ isOpen: false, field: null, language: null, cursorPosition: null });

    // Use formData.languageTemplates directly instead of local state
    const languageTemplates = useMemo(
        () =>
            formData.languageTemplates && formData.languageTemplates.length > 0
                ? formData.languageTemplates
                : [
                    {
                        language: formData.language || "English",
                        sms_content: formData.sms_content || "",
                        whatsapp_content: formData.whatsapp_content || "",
                        email_subject: formData.email_subject || "",
                        email_content: formData.email_content || "",
                    },
                ],
        [
            formData.languageTemplates,
            formData.language,
            formData.sms_content,
            formData.whatsapp_content,
            formData.email_subject,
            formData.email_content,
        ]
    );

    // Set initial selected language
    useEffect(() => {
        if (languageTemplates.length > 0 && !selectedLanguage) {
            const initialLanguage = languageTemplates[0].language;
            setSelectedLanguage(initialLanguage);
            onSelectedLanguageChange?.(initialLanguage);
        }
    }, [languageTemplates, selectedLanguage, onSelectedLanguageChange]);

    // Reset cursor positions when selected language changes
    useEffect(() => {
        setSmsCursorPosition(0);
        setWhatsappCursorPosition(0);
        setEmailSubjectCursorPosition(0);
    }, [selectedLanguage]);

    // Notify parent when selected language changes
    useEffect(() => {
        if (selectedLanguage) {
            onSelectedLanguageChange?.(selectedLanguage);
        }
    }, [selectedLanguage, onSelectedLanguageChange]);

    const availableLanguages = SUPPORTED_LANGUAGES.filter(
        (lang) => !languageTemplates.some((lt) => lt.language === lang.code)
    );

    const selectedLanguageTemplate = languageTemplates.find(
        (lt) => lt.language === selectedLanguage
    );

    const handleLanguageTemplateChange = (
        language: string,
        field: keyof LanguageTemplate,
        value: string
    ) => {
        if (onLanguageTemplateChange) {
            onLanguageTemplateChange(language, field, value);
        }
    };

    const handleAddLanguage = (language: string) => {
        setSelectedLanguage(language);
        if (onAddLanguage) {
            onAddLanguage(language);
        }
    };

    const handleRemoveLanguage = (language: string) => {
        if (languageTemplates.length <= 1) {
            return; // Don't allow removing the last language
        }
        setDeleteLanguageConfirmation({ isOpen: true, language });
    };

    const confirmRemoveLanguage = () => {
        if (!deleteLanguageConfirmation.language) return;

        const language = deleteLanguageConfirmation.language;

        // If we're removing the currently selected language, switch to the first available
        if (selectedLanguage === language) {
            const remainingLanguages = languageTemplates.filter(
                (lt) => lt.language !== language
            );
            if (remainingLanguages.length > 0) {
                setSelectedLanguage(remainingLanguages[0].language);
            }
        }

        if (onRemoveLanguage) {
            onRemoveLanguage(language);
        }

        setDeleteLanguageConfirmation({ isOpen: false, language: null });
    };

    const cancelRemoveLanguage = () => {
        setDeleteLanguageConfirmation({ isOpen: false, language: null });
    };

    // Variable insertion functions (one dialog for subject/sms/whatsapp and email body)
    const openVariableDialog = (
        field: string,
        language: string,
        cursorPosition: number
    ) => {
        setVariableDialog({ isOpen: true, openedFromBody: false, field, language, cursorPosition });
    };

    const openVariableDialogForBody = () => {
        setVariableDialog({ isOpen: true, openedFromBody: true, field: null, language: null, cursorPosition: null });
    };

    const closeVariableDialog = () => {
        setVariableDialog({
            isOpen: false,
            openedFromBody: false,
            field: null,
            language: null,
            cursorPosition: null,
        });
    };

    const insertVariable = (variable: string) => {
        if (variableDialog.openedFromBody) {
            emailEditorRef.current?.insertVariableByKey(variable);
            closeVariableDialog();
            return;
        }
        if (!variableDialog.field || !variableDialog.language) return;

        const currentValue =
            languageTemplates.find(
                (lt) => lt.language === variableDialog.language
            )?.[variableDialog.field as keyof LanguageTemplate] || "";

        const cursorPos = variableDialog.cursorPosition || currentValue.length;
        const newValue =
            currentValue.slice(0, cursorPos) +
            variable +
            currentValue.slice(cursorPos);

        if (onLanguageTemplateChange) {
            onLanguageTemplateChange(
                variableDialog.language,
                variableDialog.field as keyof LanguageTemplate,
                newValue
            );
        }

        // Restore cursor position after a short delay to allow the field to update
        setTimeout(() => {
            const fieldElement = document.querySelector(
                `[data-field="${variableDialog.field}"][data-language="${variableDialog.language}"]`
            ) as HTMLInputElement | HTMLTextAreaElement;
            if (fieldElement) {
                const newCursorPos = cursorPos + variable.length;
                fieldElement.setSelectionRange(newCursorPos, newCursorPos);
                fieldElement.focus();
            }
        }, 50);

        closeVariableDialog();
    };

    // Helper function to get cursor position from textarea
    const getCursorPosition = (element: HTMLTextAreaElement): number => {
        return element.selectionStart || element.value.length;
    };

    const getLanguageCompletionStatus = (
        languageTemplate: LanguageTemplate
    ) => {
        const hasSMS = !!languageTemplate.sms_content?.trim();
        const hasWhatsApp = !!languageTemplate.whatsapp_content?.trim();
        const hasEmailSubject = !!languageTemplate.email_subject?.trim();
        const hasEmailContent = !!languageTemplate.email_content?.trim();

        const completedFields = [
            hasSMS,
            hasWhatsApp,
            hasEmailSubject,
            hasEmailContent,
        ].filter(Boolean).length;
        const totalFields = 4;

        if (completedFields === 0) return { status: "empty", percentage: 0 };
        if (completedFields === totalFields)
            return { status: "complete", percentage: 100 };
        return {
            status: "partial",
            percentage: (completedFields / totalFields) * 100,
        };
    };

    const renderContentField = (
        type: "SMS" | "WhatsApp" | "Email",
        languageTemplate: LanguageTemplate
    ) => {
        // Find the index of this language template to get the correct error key
        const languageIndex = languageTemplates.findIndex(
            (lt) => lt.language === languageTemplate.language
        );

        switch (type) {
            case "SMS": {
                const smsErrorKey = `sms_content_${languageIndex}`;
                const smsError = hasValidated ? errors[smsErrorKey] : "";
                return (
                    <Box>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                mb: 1,
                            }}
                        >
                            <Typography
                                variant="body2"
                                sx={{ fontWeight: 500 }}
                            >
                                {t("fields.activity_templates_sms_content", {
                                    ns: "activity_templates",
                                })}{" "}
                                <Box
                                    component="span"
                                    sx={{ color: "error.main" }}
                                >
                                    *
                                </Box>
                            </Typography>
                            <Tooltip title={t("tooltips.insert_variables", { ns: "activities" })}>
                                <IconButton
                                    size="small"
                                    onClick={(e) => {
                                        const textarea =
                                            e.currentTarget.parentElement?.parentElement?.querySelector(
                                                "textarea"
                                            ) as HTMLTextAreaElement;
                                        const cursorPos = textarea
                                            ? getCursorPosition(textarea)
                                            : 0;
                                        openVariableDialog(
                                            "sms_content",
                                            languageTemplate.language,
                                            cursorPos
                                        );
                                    }}
                                    sx={{
                                        color: "primary.main",
                                        "&:hover": {
                                            backgroundColor: "primary.50",
                                        },
                                    }}
                                >
                                    <CodeIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Box>
                        <textarea
                            ref={smsTextareaRef}
                            value={languageTemplate.sms_content}
                            onChange={(e) =>
                                handleLanguageTemplateChange(
                                    languageTemplate.language,
                                    "sms_content",
                                    e.target.value
                                )
                            }
                            onSelect={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                setSmsCursorPosition(target.selectionStart);
                            }}
                            onKeyUp={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                setSmsCursorPosition(target.selectionStart);
                            }}
                            onMouseUp={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                setSmsCursorPosition(target.selectionStart);
                            }}
                            placeholder={t("fields.placeholder_sms_content", {
                                ns: "activity_templates",
                            })}
                            disabled={disabled}
                            data-field="sms_content"
                            data-language={languageTemplate.language}
                            style={{
                                width: "100%",
                                minHeight: "200px",
                                padding: "12px",
                                border: smsError
                                    ? "1px solid #d32f2f"
                                    : "1px solid #ccc",
                                borderRadius: "4px",
                                fontFamily: "inherit",
                                fontSize: "14px",
                                resize: "vertical",
                                backgroundColor: disabled ? "#f5f5f5" : "white",
                                color: disabled ? "#666" : "inherit",
                                outline: "none",
                                transition: "border-color 0.2s ease-in-out",
                            }}
                            onFocus={(e) => {
                                if (!smsError && !disabled) {
                                    e.target.style.borderColor = "#6B46C1";
                                }
                            }}
                            onBlur={(e) => {
                                if (!smsError && !disabled) {
                                    e.target.style.borderColor = "#ccc";
                                }
                            }}
                        />
                        {smsError && (
                            <Typography
                                variant="caption"
                                color="error"
                                sx={{ mt: 0.5, display: "block" }}
                            >
                                {smsError}
                            </Typography>
                        )}
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                mt: 0.5,
                            }}
                        >
                            <Typography
                                variant="caption"
                                color="text.secondary"
                            >
                                {languageTemplate.sms_content?.length || 0} /
                                160 {t("fields.characters", { ns: "common" })}
                            </Typography>
                        </Box>
                    </Box>
                );
            }
            case "WhatsApp": {
                const whatsappErrorKey = `whatsapp_content_${languageIndex}`;
                const whatsappError = hasValidated
                    ? errors[whatsappErrorKey]
                    : "";
                return (
                    <Box>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                mb: 1,
                            }}
                        >
                            <Typography
                                variant="body2"
                                sx={{ fontWeight: 500 }}
                            >
                                {t(
                                    "fields.activity_templates_whatsapp_content",
                                    { ns: "activity_templates" }
                                )}{" "}
                                <Box
                                    component="span"
                                    sx={{ color: "error.main" }}
                                >
                                    *
                                </Box>
                            </Typography>
                            <Tooltip title={t("tooltips.insert_variables", { ns: "activities" })}>
                                <IconButton
                                    size="small"
                                    onClick={(e) => {
                                        const textarea =
                                            e.currentTarget.parentElement?.parentElement?.querySelector(
                                                "textarea"
                                            ) as HTMLTextAreaElement;
                                        const cursorPos = textarea
                                            ? getCursorPosition(textarea)
                                            : 0;
                                        openVariableDialog(
                                            "whatsapp_content",
                                            languageTemplate.language,
                                            cursorPos
                                        );
                                    }}
                                    sx={{
                                        color: "primary.main",
                                        "&:hover": {
                                            backgroundColor: "primary.50",
                                        },
                                    }}
                                >
                                    <CodeIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Box>
                        <textarea
                            ref={whatsappTextareaRef}
                            value={languageTemplate.whatsapp_content}
                            onChange={(e) =>
                                handleLanguageTemplateChange(
                                    languageTemplate.language,
                                    "whatsapp_content",
                                    e.target.value
                                )
                            }
                            onSelect={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                setWhatsappCursorPosition(
                                    target.selectionStart
                                );
                            }}
                            onKeyUp={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                setWhatsappCursorPosition(
                                    target.selectionStart
                                );
                            }}
                            onMouseUp={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                setWhatsappCursorPosition(
                                    target.selectionStart
                                );
                            }}
                            placeholder={t(
                                "fields.placeholder_whatsapp_content",
                                { ns: "activity_templates" }
                            )}
                            disabled={disabled}
                            data-field="whatsapp_content"
                            data-language={languageTemplate.language}
                            style={{
                                width: "100%",
                                minHeight: "200px",
                                padding: "12px",
                                border: whatsappError
                                    ? "1px solid #d32f2f"
                                    : "1px solid #ccc",
                                borderRadius: "4px",
                                fontFamily: "inherit",
                                fontSize: "14px",
                                resize: "vertical",
                                backgroundColor: disabled ? "#f5f5f5" : "white",
                                color: disabled ? "#666" : "inherit",
                                outline: "none",
                                transition: "border-color 0.2s ease-in-out",
                            }}
                            onFocus={(e) => {
                                if (!whatsappError && !disabled) {
                                    e.target.style.borderColor = "#6B46C1";
                                }
                            }}
                            onBlur={(e) => {
                                if (!whatsappError && !disabled) {
                                    e.target.style.borderColor = "#ccc";
                                }
                            }}
                        />
                        {whatsappError && (
                            <Typography
                                variant="caption"
                                color="error"
                                sx={{ mt: 0.5, display: "block" }}
                            >
                                {whatsappError}
                            </Typography>
                        )}
                    </Box>
                );
            }
            case "Email": {
                const emailSubjectErrorKey = `email_subject_${languageIndex}`;
                const emailContentErrorKey = `email_content_${languageIndex}`;
                const emailSubjectError = hasValidated
                    ? errors[emailSubjectErrorKey]
                    : "";
                const emailContentError = hasValidated
                    ? errors[emailContentErrorKey]
                    : "";
                return (
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: "repeat(12, 1fr)",
                            gap: 2,
                        }}
                    >
                        <Box sx={{ gridColumn: "span 4" }}>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    mb: 1,
                                }}
                            >
                                <Typography
                                    variant="body2"
                                    sx={{ fontWeight: 500 }}
                                >
                                    {t(
                                        "fields.activity_templates_email_subject",
                                        { ns: "activity_templates" }
                                    )}{" "}
                                    <Box
                                        component="span"
                                        sx={{ color: "error.main" }}
                                    >
                                        *
                                    </Box>
                                </Typography>
                                <Tooltip title={t("tooltips.insert_variables", { ns: "activities" })}>
                                    <IconButton
                                        size="small"
                                        onClick={(e) => {
                                            const textField =
                                                e.currentTarget.parentElement?.parentElement?.querySelector(
                                                    "input"
                                                ) as HTMLInputElement;
                                            const cursorPos = textField
                                                ? textField.selectionStart ||
                                                textField.value.length
                                                : 0;
                                            openVariableDialog(
                                                "email_subject",
                                                languageTemplate.language,
                                                cursorPos
                                            );
                                        }}
                                        sx={{
                                            color: "primary.main",
                                            "&:hover": {
                                                backgroundColor: "primary.50",
                                            },
                                        }}
                                    >
                                        <CodeIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                            <TextField
                                ref={emailSubjectRef}
                                fullWidth
                                size="small"
                                value={languageTemplate.email_subject}
                                onChange={(e) =>
                                    handleLanguageTemplateChange(
                                        languageTemplate.language,
                                        "email_subject",
                                        e.target.value
                                    )
                                }
                                onSelect={(e) => {
                                    const target = e.target as HTMLInputElement;
                                    setEmailSubjectCursorPosition(
                                        target.selectionStart || 0
                                    );
                                }}
                                onKeyUp={(e) => {
                                    const target = e.target as HTMLInputElement;
                                    setEmailSubjectCursorPosition(
                                        target.selectionStart || 0
                                    );
                                }}
                                onMouseUp={(e) => {
                                    const target = e.target as HTMLInputElement;
                                    setEmailSubjectCursorPosition(
                                        target.selectionStart || 0
                                    );
                                }}
                                error={!!emailSubjectError}
                                helperText={
                                    emailSubjectError ||
                                    `${languageTemplate.email_subject?.length || 0} / 160 ${t("fields.characters", { ns: "common" })}`
                                }
                                placeholder={t(
                                    "fields.placeholder_email_subject",
                                    { ns: "activity_templates" }
                                )}
                                required
                                disabled={disabled}
                                inputProps={{
                                    "data-field": "email_subject",
                                    "data-language": languageTemplate.language,
                                    maxLength: 160,
                                }}
                            />
                        </Box>
                        <Box sx={{ gridColumn: "1 / -1" }}>
                            <Typography
                                variant="body2"
                                sx={{ mb: 1, fontWeight: 500 }}
                            >
                                {t("fields.activity_templates_email_content", {
                                    ns: "activity_templates",
                                })}{" "}
                                <Box
                                    component="span"
                                    sx={{ color: "error.main" }}
                                >
                                    *
                                </Box>
                            </Typography>
                            <EmailEditor
                                ref={emailEditorRef}
                                value={languageTemplate.email_content}
                                onChange={(content) =>
                                    handleLanguageTemplateChange(
                                        languageTemplate.language,
                                        "email_content",
                                        content
                                    )
                                }
                                error={emailContentError}
                                onInsertVariableClick={openVariableDialogForBody}
                            />
                        </Box>
                    </Box>
                );
            }
            default:
                return null;
        }
    };

    return (
        <Paper
            elevation={0}
            sx={{
                p: 3,
                mb: 3,
                borderRadius: theme.shape.borderRadius,
                boxShadow: "none",
                border: "none",
            }}
        >
            {/* Basic Information */}
            <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, color: "primary.main" }}>
                    {t("sections.activity_templates_basic_information", {
                        ns: "activity_templates",
                    })}
                </Typography>
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: { xs: "column", sm: "row" },
                        gap: 2,
                        alignItems: { sm: "flex-start" },
                    }}
                >
                    <Box sx={{ flex: 1, minWidth: 0, maxWidth: 400 }}>
                        <Typography
                            variant="body2"
                            sx={{ mb: 1, fontWeight: 500 }}
                        >
                            {t("fields.activity_templates_name", {
                                ns: "activity_templates",
                            })}{" "}
                            <Box component="span" sx={{ color: "error.main" }}>
                                *
                            </Box>
                        </Typography>
                        <TextField
                            fullWidth
                            size="small"
                            value={formData.name}
                            onChange={(e) =>
                                onInputChange("name", e.target.value)
                            }
                            error={hasValidated && !!errors.name}
                            helperText={hasValidated ? errors.name : ""}
                            required
                            disabled={disabled}
                        />
                    </Box>

                    {/* Dispute Resolution Field - Only show when category is Dispute */}
                    {(lockedCategory === "Dispute" ||
                        formData.category === "Dispute") && (
                            <Box sx={{
                                width: {
                                    xs: "calc((100% - 12px) / 2)",
                                    sm: "calc((100% - 24px) / 3)",
                                    md: "calc((100% - 36px) / 4)",
                                    lg: "calc((100% - 48px) / 5)"
                                }
                            }}>
                                <Typography
                                    variant="body2"
                                    sx={{ mb: 1, fontWeight: 500 }}
                                >
                                    {t(
                                        "fields.activity_templates_dispute_resolution",
                                        { ns: "activity_templates" }
                                    )}{" "}
                                    <Box
                                        component="span"
                                        sx={{ color: "error.main" }}
                                    >
                                        *
                                    </Box>
                                </Typography>
                                <FormControl
                                    fullWidth
                                    size="small"
                                    error={
                                        hasValidated && !!errors.dispute_resolution
                                    }
                                >
                                    <Select
                                        value={formData.dispute_resolution || ""}
                                        onChange={(e) =>
                                            onInputChange(
                                                "dispute_resolution",
                                                e.target.value
                                            )
                                        }
                                        disabled={disabled}
                                        displayEmpty
                                    >
                                        <MenuItem value="" disabled>
                                            {t(
                                                "fields.activity_templates_select_dispute_resolution",
                                                { ns: "activity_templates" }
                                            )}
                                        </MenuItem>
                                        <MenuItem value="Denied">
                                            {t("values.status_denied", {
                                                ns: "disputes",
                                            })}
                                        </MenuItem>
                                        <MenuItem value="Accepted_Settled_partly">
                                            {t(
                                                "values.status_accepted_settled_partly",
                                                { ns: "disputes" }
                                            )}
                                        </MenuItem>
                                        <MenuItem value="Accepted_Settled_in_full">
                                            {t(
                                                "values.status_accepted_settled_in_full",
                                                { ns: "disputes" }
                                            )}
                                        </MenuItem>
                                        <MenuItem value="Accepted">
                                            {t("values.status_accepted", {
                                                ns: "disputes",
                                            })}
                                        </MenuItem>
                                        <MenuItem value="Cancelled">
                                            {t("values.status_cancelled", {
                                                ns: "disputes",
                                            })}
                                        </MenuItem>
                                        <MenuItem value="Admin_Fixed_Balance_Unchanged">
                                            {t(
                                                "values.status_admin_fixed_balance_unchanged",
                                                { ns: "disputes" }
                                            )}
                                        </MenuItem>
                                    </Select>
                                    {hasValidated && errors.dispute_resolution && (
                                        <Typography
                                            variant="caption"
                                            color="error"
                                            sx={{ mt: 1, display: "block" }}
                                        >
                                            {errors.dispute_resolution}
                                        </Typography>
                                    )}
                                </FormControl>
                            </Box>
                        )}

                    <Box
                        sx={{
                            minWidth: "fit-content",
                            pl: { sm: theme.spacing(2) },
                        }}
                    >
                        <Typography
                            variant="body2"
                            sx={{
                                mb: theme.spacing(1),
                                fontWeight: theme.typography.fontWeightMedium,
                            }}
                        >
                            {t("fields.status", { ns: "common" })}
                        </Typography>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={formData.active}
                                    onChange={(e) =>
                                        onInputChange("active", e.target.checked)
                                    }
                                    color="primary"
                                    disabled={disabled}
                                />
                            }
                            label={
                                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                    {formData.active
                                        ? t("values.status_active", { ns: "common" })
                                        : t("values.status_inactive", { ns: "common" })}
                                </Typography>
                            }
                        />
                    </Box>
                </Box>
            </Box>

            {/* Multi-Language Content Section */}
            <Box>
                {/* Add Language Control */}
                {availableLanguages.length > 0 && (
                    <Box
                        sx={{
                            mb: 3,
                            display: "grid",
                            gridTemplateColumns: "repeat(12, 1fr)",
                        }}
                    >
                        <Box sx={{ gridColumn: "span 2" }}>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    mb: 1,
                                }}
                            >
                                <Typography
                                    variant="body2"
                                    sx={{ fontWeight: 500 }}
                                >
                                    {t("actions.activity_templates_add_language", {
                                        ns: "activity_templates",
                                    })}
                                </Typography>
                                <Tooltip
                                    title={t(
                                        "actions.activity_templates_multi_language_info",
                                        { ns: "activity_templates" }
                                    )}
                                    placement="bottom"
                                >
                                    <IconButton
                                        size="small"
                                        aria-label={t(
                                            "actions.activity_templates_multi_language_info",
                                            { ns: "activity_templates" }
                                        )}
                                        sx={{
                                            color: "primary.main",
                                            p: 0.25,
                                        }}
                                    >
                                        <HelpOutlineIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                                <LanguageSelect
                                    value=""
                                    onChange={(value) => {
                                        if (value) {
                                            handleAddLanguage(value);
                                        }
                                    }}
                                    label={t(
                                        "actions.activity_templates_add_language",
                                        { ns: "activity_templates" }
                                    )}
                                    disabled={disabled}
                                />
                            </Box>
                        </Box>
                    </Box>
                )}

                {/* Language Overview */}
                <Box sx={{ mb: 3 }}>
                    <Typography
                        variant="subtitle1"
                        sx={{ mb: 2, fontWeight: 600 }}
                    >
                        {t("fields.activity_templates_language_overview", {
                            ns: "activity_templates",
                        })}
                    </Typography>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "repeat(2, 1fr)",
                                sm: "repeat(3, 1fr)",
                                md: "repeat(4, 1fr)",
                                lg: "repeat(5, 1fr)",
                            },
                            gap: 1.5,
                        }}
                    >
                        {languageTemplates.map((langTemplate) => {
                            const completion =
                                getLanguageCompletionStatus(langTemplate);
                            const langInfo = SUPPORTED_LANGUAGES.find(
                                (l) => l.code === langTemplate.language
                            );

                            return (
                                <Paper
                                    key={langTemplate.language}
                                    sx={{
                                        p: 1.5,
                                        cursor: "pointer",
                                        borderRadius: theme.shape.borderRadius,
                                        border:
                                            selectedLanguage ===
                                                langTemplate.language
                                                ? 3
                                                : 1,
                                        borderColor:
                                            selectedLanguage ===
                                                langTemplate.language
                                                ? "primary.main"
                                                : "divider",
                                        backgroundColor:
                                            selectedLanguage ===
                                                langTemplate.language
                                                ? "primary.50"
                                                : "background.paper",
                                        boxShadow:
                                            selectedLanguage ===
                                                langTemplate.language
                                                ? "0 4px 12px rgba(25, 118, 210, 0.15)"
                                                : "none",
                                        transform:
                                            selectedLanguage ===
                                                langTemplate.language
                                                ? "scale(1.02)"
                                                : "scale(1)",
                                        transition: "all 0.2s ease-in-out",
                                        position: "relative",
                                        "&:hover": {
                                            borderColor: "primary.main",
                                            backgroundColor:
                                                selectedLanguage ===
                                                    langTemplate.language
                                                    ? "primary.100"
                                                    : "action.hover",
                                            transform:
                                                selectedLanguage ===
                                                    langTemplate.language
                                                    ? "scale(1.02)"
                                                    : "scale(1.01)",
                                        },
                                        "&::before":
                                            selectedLanguage ===
                                                langTemplate.language
                                                ? {
                                                    content: '""',
                                                    position: "absolute",
                                                    top: -2,
                                                    left: -2,
                                                    right: -2,
                                                    bottom: -2,
                                                    background:
                                                        "linear-gradient(45deg, primary.main, primary.light)",
                                                    borderRadius: "inherit",
                                                    zIndex: -1,
                                                    opacity: 0.3,
                                                }
                                                : {},
                                    }}
                                    onClick={() => {
                                        setSelectedLanguage(
                                            langTemplate.language
                                        );
                                    }}
                                >
                                    <Box
                                        sx={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            mb: 0.5,
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 0.5,
                                            }}
                                        >
                                            <span style={{ fontSize: "1rem" }}>
                                                {langInfo?.flag}
                                            </span>
                                            <Typography
                                                variant="caption"
                                                fontWeight={600}
                                                sx={{ fontSize: "0.875rem" }}
                                            >
                                                {t(
                                                    langInfo?.label ||
                                                    langTemplate.language
                                                )}
                                            </Typography>
                                            {selectedLanguage ===
                                                langTemplate.language && (
                                                    <CheckCircleIcon
                                                        sx={{
                                                            color: "primary.main",
                                                            fontSize: 14,
                                                            ml: 0.5,
                                                        }}
                                                    />
                                                )}
                                        </Box>
                                        {languageTemplates.length > 1 && (
                                            <Tooltip
                                                title={t(
                                                    "actions.activity_templates_delete_language_confirmation",
                                                    { ns: "activity_templates" }
                                                )}
                                            >
                                                <IconButton
                                                    size="small"
                                                    color="primary"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRemoveLanguage(
                                                            langTemplate.language
                                                        );
                                                    }}
                                                    sx={{ p: 0.5 }}
                                                >
                                                    <DeleteIcon
                                                        sx={{ fontSize: 18 }}
                                                    />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </Box>

                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 0.5,
                                            mb: 0.5,
                                        }}
                                    >
                                        {completion.status === "complete" && (
                                            <CheckCircleIcon
                                                sx={{
                                                    color: "success.main",
                                                    fontSize: 12,
                                                }}
                                            />
                                        )}
                                        {completion.status === "partial" && (
                                            <WarningIcon
                                                sx={{
                                                    color: "warning.main",
                                                    fontSize: 12,
                                                }}
                                            />
                                        )}
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ fontSize: "0.65rem" }}
                                        >
                                            {Math.round(completion.percentage)}%
                                        </Typography>
                                    </Box>

                                    <Box
                                        sx={{
                                            width: "100%",
                                            height: 3,
                                            backgroundColor: "grey.200",
                                            borderRadius: 1.5,
                                            overflow: "hidden",
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                width: `${completion.percentage}%`,
                                                height: "100%",
                                                backgroundColor:
                                                    completion.status ===
                                                        "complete"
                                                        ? "success.main"
                                                        : "warning.main",
                                                transition: "width 0.3s ease",
                                            }}
                                        />
                                    </Box>
                                </Paper>
                            );
                        })}
                    </Box>
                </Box>

                {/* Content Editor for Selected Language */}
                {selectedLanguageTemplate && (
                    <Box>
                        <Tabs
                            value={activeContentTab}
                            onChange={(_, newValue) =>
                                setActiveContentTab(newValue)
                            }
                            variant="scrollable"
                            scrollButtons="auto"
                            sx={{
                                borderBottom: 1,
                                borderColor: "divider",
                                mb: 3,
                                "& .MuiTabs-indicator": {
                                    height: 2,
                                    backgroundColor: "primary.main",
                                },
                                "& .MuiTab-root": {
                                    textTransform: "none",
                                    fontWeight: 500,
                                    minWidth: 120,
                                    py: 1,
                                    px: 2,
                                    color: "text.secondary",
                                    "&:hover": {
                                        color: "primary.main",
                                    },
                                    "&.Mui-selected": {
                                        color: "primary.main",
                                        fontWeight: 600,
                                    },
                                },
                            }}
                        >
                            <Tab
                                label={t(
                                    "fields.activity_templates_tabs_email",
                                    { ns: "activity_templates" }
                                )}
                                icon={
                                    <EmailIcon
                                        sx={{
                                            mb: 0.5,
                                            mr: i18n.language === "he" ? 0 : 1,
                                            ml: i18n.language === "he" ? 1 : 0,
                                        }}
                                    />
                                }
                                iconPosition="start"
                            />
                            <Tab
                                label={t("fields.activity_templates_tabs_sms", {
                                    ns: "activity_templates",
                                })}
                                icon={
                                    <SmsIcon
                                        sx={{
                                            mb: 0.5,
                                            mr: i18n.language === "he" ? 0 : 1,
                                            ml: i18n.language === "he" ? 1 : 0,
                                        }}
                                    />
                                }
                                iconPosition="start"
                            />
                            <Tab
                                label={t(
                                    "fields.activity_templates_tabs_whatsapp",
                                    { ns: "activity_templates" }
                                )}
                                icon={
                                    <WhatsAppIcon
                                        sx={{
                                            mb: 0.5,
                                            mr: i18n.language === "he" ? 0 : 1,
                                            ml: i18n.language === "he" ? 1 : 0,
                                        }}
                                    />
                                }
                                iconPosition="start"
                            />
                        </Tabs>

                        <Box sx={{ minHeight: 500 }}>
                            {renderContentField(
                                ["Email", "SMS", "WhatsApp"][
                                activeContentTab
                                ] as "Email" | "SMS" | "WhatsApp",
                                selectedLanguageTemplate
                            )}
                        </Box>
                    </Box>
                )}
            </Box>

            {/* Language Delete Confirmation Dialog */}
            <AppDialog
                open={deleteLanguageConfirmation.isOpen}
                onClose={cancelRemoveLanguage}
                drag={false}
                align={false}
                slide={false}
                isRTL={i18n.language === "he"}
                title={
                    <Box sx={{ display: "flex", alignItems: "center", gap: theme.spacing(1) }}>
                        <DeleteIcon aria-hidden="true" />
                        {t(
                            "actions.activity_templates_delete_language_confirmation",
                            { ns: "activity_templates" }
                        )}
                    </Box>
                }
                titleIcon={null}
                ariaLabelledBy="delete-language-dialog-title"
                ariaDescribedBy="delete-language-dialog-description"
                maxWidth="sm"
                fullWidth
                actions={
                    <>
                        <Button
                            onClick={cancelRemoveLanguage}
                            variant="outlined"
                            size="small"
                            className="cancel-button"
                            sx={{
                                mr: i18n.language === "he" ? 0 : theme.spacing(1),
                                ml: i18n.language === "he" ? theme.spacing(1) : 0,
                            }}
                        >
                            {t("actions.cancel", { ns: "common" })}
                        </Button>
                        <Button
                            onClick={confirmRemoveLanguage}
                            variant="contained"
                            size="small"
                            color="error"
                        >
                            {t("actions.delete", { ns: "common" })}
                        </Button>
                    </>
                }
            >
                <Box
                    id="delete-language-dialog-description"
                    component="div"
                    sx={{
                        paddingTop: theme.spacing(2),
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                        mt: theme.spacing(2),
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                        }}
                    >
                        <Typography
                            variant="body1"
                            sx={{
                                mb: theme.spacing(1),
                                textAlign: "center",
                                fontWeight: theme.typography.fontWeightMedium,
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            {t(
                                "actions.activity_templates_delete_language_message",
                                {
                                    ns: "activity_templates",
                                    language:
                                        deleteLanguageConfirmation.language
                                            ? t(
                                                `fields.languages_${deleteLanguageConfirmation.language.toLowerCase()}`,
                                                { ns: "common" }
                                            )
                                            : deleteLanguageConfirmation.language,
                                }
                            )}
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                textAlign: "center",
                                color: theme.palette.text.secondary,
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            {t(
                                "messages.activity_templates_delete_language_warning",
                                { ns: "activity_templates" }
                            )}
                        </Typography>
                    </Box>
                </Box>
            </AppDialog>

            {/* Variable Insertion Dialog (shared for subject, sms, whatsapp, and email body) */}
            <VariableInsertionDialog
                open={variableDialog.isOpen}
                onClose={closeVariableDialog}
                onInsertVariable={insertVariable}
            />
        </Paper>
    );
}
