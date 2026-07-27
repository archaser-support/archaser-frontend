"use client";

import {
    Delete as DeleteIcon,
    CheckCircle as CheckCircleIcon,
} from "@mui/icons-material";
import {
    Box,
    TextField,
    FormControlLabel,
    Switch,
    Typography,
    IconButton,
    Paper,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { LanguageSelect, LanguageFlag } from "@/components/LocationSelects";

const SUPPORTED_LANGUAGES = [
    "English",
    "Hebrew",
    "Arabic",
    "Spanish",
    "French",
    "German",
    "Italian",
    "Portuguese",
    "Russian",
    "Chinese",
    "Japanese",
    "Korean",
];

export interface DisputeReasonLanguage {
    language: string;
    name: string;
    master_template?: boolean;
}

export interface DisputeReason {
    id?: number;
    name: string;
    status: "Active" | "Inactive";
    account_id: number;
    editable?: boolean;
    master_template?: boolean;
    languageTemplates?: DisputeReasonLanguage[];
}

interface DisputeReasonFormProps {
    formData: DisputeReason;
    setFormData: (data: DisputeReason) => void;
    errors: Record<string, string>;
    hasValidated: boolean;
    setErrors: (errors: Record<string, string>) => void;
    disabled?: boolean;
}

export default function DisputeReasonForm({
    formData,
    setFormData,
    errors,
    hasValidated,
    setErrors,
    disabled = false,
}: DisputeReasonFormProps) {
    const { t, i18n } = useTranslation(["disputes", "common"]);
    const theme = useTheme();

    // Initialize with existing data or default to English
    const [languageTemplates, setLanguageTemplates] = useState<
        DisputeReasonLanguage[]
    >(() => {
        if (
            formData.languageTemplates &&
            formData.languageTemplates.length > 0
        ) {
            return formData.languageTemplates;
        } else {
            return [
                {
                    language: "English",
                    name: formData.name || "",
                },
            ];
        }
    });

    const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
        if (
            formData.languageTemplates &&
            formData.languageTemplates.length > 0
        ) {
            return formData.languageTemplates[0].language;
        } else {
            return "English";
        }
    });

    // Update state when formData changes, but preserve the currently selected language
    useEffect(() => {
        if (
            formData.languageTemplates &&
            formData.languageTemplates.length > 0
        ) {
            setLanguageTemplates(formData.languageTemplates);

            // Only change selected language if the current selection no longer exists
            const currentExists = formData.languageTemplates.some(
                (t) => t.language === selectedLanguage
            );
            if (!currentExists) {
                setSelectedLanguage(formData.languageTemplates[0].language);
            }
        }
    }, [formData.languageTemplates, selectedLanguage]);

    // Calculate available languages for adding
    const availableLanguages = SUPPORTED_LANGUAGES.filter(
        (lang) =>
            !languageTemplates.some((template) => template.language === lang)
    );

    const handleLanguageTemplateChange = (
        index: number,
        field: keyof DisputeReasonLanguage,
        value: string
    ) => {
        const updatedTemplates = [...languageTemplates];
        updatedTemplates[index] = {
            ...updatedTemplates[index],
            [field]: value,
        };

        setLanguageTemplates(updatedTemplates);

        // Update parent form data
        const newFormData = {
            ...formData,
            languageTemplates: updatedTemplates,
        };
        setFormData(newFormData);

        // Clear errors for this field
        if (errors[`language_${index}`]) {
            const newErrors: Record<string, string> = { ...errors };
            delete newErrors[`language_${index}`];
            setErrors(newErrors);
        }
    };

    const handleAddLanguage = (language: string) => {
        const newTemplate: DisputeReasonLanguage = {
            language: language,
            name: "",
        };
        const updatedTemplates = [...languageTemplates, newTemplate];
        setLanguageTemplates(updatedTemplates);
        setSelectedLanguage(language);

        // Update parent form data
        setFormData({
            ...formData,
            languageTemplates: updatedTemplates,
        });
    };

    const handleRemoveLanguage = (index: number) => {
        if (languageTemplates.length > 1) {
            const updatedTemplates = languageTemplates.filter(
                (_, i) => i !== index
            );
            setLanguageTemplates(updatedTemplates);

            // Select the first remaining template
            if (updatedTemplates.length > 0) {
                setSelectedLanguage(updatedTemplates[0].language);
            }

            // Update parent form data
            setFormData({
                ...formData,
                languageTemplates: updatedTemplates,
            });
        }
    };

    const handleInputChange = (field: keyof DisputeReason, value: any) => {
        setFormData({
            ...formData,
            [field]: value,
        });

        // Clear error when user starts typing
        if (errors[field]) {
            const newErrors: Record<string, string> = { ...errors };
            delete newErrors[field];
            setErrors(newErrors);
        }
    };

    const getLanguageDisplayName = (language: string) => {
        return (
            t(`values.language_${language.toLowerCase()}`, {
                ns: "disputes",
            }) || language
        );
    };

    const getCompletionStatus = () => {
        const completed = languageTemplates.filter(
            (template) => template.name && template.name.trim().length > 0
        ).length;
        return { completed, total: languageTemplates.length };
    };

    const status = getCompletionStatus();

    return (
        <Paper
            sx={{
                p: 4,
                mb: 3,
                background: "white",
                borderRadius: 2,
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
                border: "1px solid #e0e0e0",
            }}
            elevation={0}
        >
            {/* Status Switch */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                    {t("fields.status", { ns: "common" })}
                </Typography>
                <FormControlLabel
                    control={
                        <Switch
                            checked={formData.status === "Active"}
                            onChange={(e) =>
                                handleInputChange(
                                    "status",
                                    e.target.checked ? "Active" : "Inactive"
                                )
                            }
                            color="primary"
                            disabled={disabled}
                        />
                    }
                    label={
                        <Typography
                            variant="body2"
                            sx={{ color: "text.secondary" }}
                        >
                            {formData.status === "Active"
                                ? t("values.status_active", { ns: "common" })
                                : t("values.status_inactive", { ns: "common" })}
                        </Typography>
                    }
                />
                {hasValidated && errors.status && (
                    <Typography
                        variant="caption"
                        color="error"
                        sx={{ mt: 0.5, display: "block" }}
                    >
                        {errors.status}
                    </Typography>
                )}
            </Box>

            {/* Multi-Language Section */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>
                    {t("sections.multi_language_settings", { ns: "disputes" })}
                </Typography>
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 3 }}
                >
                    {t("tooltips.multi_language_info", { ns: "disputes" })}
                </Typography>

                {/* Language Templates Validation Error */}
                {hasValidated && errors.languageTemplates && (
                    <Box sx={{ mb: 2 }}>
                        <Typography color="error" variant="body2">
                            {errors.languageTemplates}
                        </Typography>
                    </Box>
                )}

                {/* Add Language Control */}
                {availableLanguages.length > 0 && (
                    <Box sx={{ mb: 3 }}>
                        <Typography
                            variant="body2"
                            sx={{ mb: 1, fontWeight: 500 }}
                        >
                            {t("actions.add_language", { ns: "disputes" })}
                        </Typography>
                        <Box
                            sx={{
                                width: {
                                    xs: "calc((100% - 12px) / 2)",
                                    sm: "calc((100% - 24px) / 3)",
                                    md: "calc((100% - 36px) / 4)",
                                    lg: "calc((100% - 48px) / 5)",
                                },
                            }}
                        >
                            <LanguageSelect
                                value=""
                                onChange={(value) => {
                                    if (value) {
                                        handleAddLanguage(value);
                                    }
                                }}
                                label={t("actions.add_language", {
                                    ns: "disputes",
                                })}
                                availableLanguages={availableLanguages}
                                disabled={disabled}
                            />
                        </Box>
                    </Box>
                )}

                {/* Language Overview */}
                <Box sx={{ mb: 3 }}>
                    <Typography
                        variant="subtitle1"
                        sx={{ mb: 2, fontWeight: 600 }}
                    >
                        {t("sections.language_overview", { ns: "disputes" })}
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
                            const isSelected =
                                selectedLanguage === langTemplate.language;
                            const hasContent = !!langTemplate.name;
                            const completion = hasContent ? 100 : 0;
                            const completionStatus = hasContent
                                ? "complete"
                                : "empty";

                            return (
                                <Paper
                                    key={langTemplate.language}
                                    sx={{
                                        p: 1.5,
                                        cursor: "pointer",
                                        border: isSelected ? 3 : 1,
                                        borderColor: isSelected
                                            ? "primary.main"
                                            : "divider",
                                        backgroundColor: isSelected
                                            ? "primary.50"
                                            : "background.paper",
                                        boxShadow: isSelected
                                            ? "0 4px 12px rgba(25, 118, 210, 0.15)"
                                            : "none",
                                        transform: isSelected
                                            ? "scale(1.02)"
                                            : "scale(1)",
                                        transition: "all 0.2s ease-in-out",
                                        position: "relative",
                                        "&:hover": {
                                            borderColor: "primary.main",
                                            backgroundColor: isSelected
                                                ? "primary.100"
                                                : "action.hover",
                                            transform: isSelected
                                                ? "scale(1.02)"
                                                : "scale(1.01)",
                                        },
                                        "&::before": isSelected
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
                                    onClick={() =>
                                        setSelectedLanguage(
                                            langTemplate.language
                                        )
                                    }
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
                                            <LanguageFlag
                                                language={langTemplate.language}
                                            />
                                            <Typography
                                                variant="caption"
                                                fontWeight={600}
                                                sx={{ fontSize: "0.75rem" }}
                                            >
                                                {getLanguageDisplayName(
                                                    langTemplate.language
                                                )}
                                            </Typography>
                                            {isSelected && (
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
                                            <IconButton
                                                size="small"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const index =
                                                        languageTemplates.findIndex(
                                                            (t) =>
                                                                t.language ===
                                                                langTemplate.language
                                                        );
                                                    handleRemoveLanguage(index);
                                                }}
                                                sx={{
                                                    p: 0.25,
                                                    "&:hover": {
                                                        color: "error.main",
                                                    },
                                                }}
                                            >
                                                <DeleteIcon
                                                    sx={{ fontSize: 12 }}
                                                />
                                            </IconButton>
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
                                        {completionStatus === "complete" && (
                                            <Box
                                                sx={{
                                                    width: 12,
                                                    height: 12,
                                                    borderRadius: "50%",
                                                    backgroundColor:
                                                        "success.main",
                                                }}
                                            />
                                        )}
                                        {completionStatus === "empty" && (
                                            <Box
                                                sx={{
                                                    width: 12,
                                                    height: 12,
                                                    borderRadius: "50%",
                                                    backgroundColor: "grey.300",
                                                }}
                                            />
                                        )}
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ fontSize: "0.65rem" }}
                                        >
                                            {completion}%
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
                                                width: `${completion}%`,
                                                height: "100%",
                                                backgroundColor:
                                                    completionStatus ===
                                                    "complete"
                                                        ? "success.main"
                                                        : "grey.300",
                                                transition: "width 0.3s ease",
                                            }}
                                        />
                                    </Box>
                                </Paper>
                            );
                        })}
                    </Box>
                </Box>
            </Box>

            {/* Language Template Editor */}
            {selectedLanguage && (
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h6" gutterBottom>
                        {t("fields.reason", { ns: "disputes" })}
                    </Typography>

                    {languageTemplates.map(
                        (template, index) =>
                            template.language === selectedLanguage && (
                                <TextField
                                    key={index}
                                    label={t("fields.reason", {
                                        ns: "disputes",
                                    })}
                                    value={template.name}
                                    onChange={(e) =>
                                        handleLanguageTemplateChange(
                                            index,
                                            "name",
                                            e.target.value
                                        )
                                    }
                                    error={
                                        hasValidated &&
                                        !!errors[`language_${index}`]
                                    }
                                    helperText={
                                        hasValidated
                                            ? errors[`language_${index}`]
                                            : ""
                                    }
                                    variant="outlined"
                                    required
                                    sx={{ mb: 2, maxWidth: 600 }}
                                />
                            )
                    )}
                </Box>
            )}

            {/* Error Summary */}
            {Object.keys(errors).length > 0 && hasValidated && (
                <Box sx={{ mb: 2 }}>
                    <Typography color="error" variant="body2">
                        {t("messages.reasons_please_fix_errors", {
                            ns: "disputes",
                        })}
                    </Typography>
                </Box>
            )}
        </Paper>
    );
}
