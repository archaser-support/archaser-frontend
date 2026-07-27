"use client";
import { apiFetch } from "@/utils/apiFetch";

import AppDialog from "@/shared/layout-components/modal/AppDialog";
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Help as HelpIcon,
} from "@mui/icons-material";
import GavelIcon from "@mui/icons-material/Gavel";
import {
    Box,
    Button,
    Card,
    CardContent,
    FormControlLabel,
    IconButton,
    Switch,
    TextField,
    Tooltip,
    Typography,
    useTheme
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useToast } from "@/shared/layout-components/toast/ToastProvider";


interface DisputeReasonLanguage {
    language: string;
    name: string;
    master_template?: boolean;
}

interface DisputeReason {
    id?: number;
    name: string;
    status: "Active" | "Inactive";
    account_id: number;
    editable?: boolean;
    master_template?: boolean;
    languageTemplates?: DisputeReasonLanguage[];
}

interface DisputeReasonErrors {
    [key: string]: string;
}

interface UpsertDisputeReasonModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    accountId: number;
    disputeReason?: DisputeReason;
}

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

export const UpsertDisputeReasonModal: React.FC<
    UpsertDisputeReasonModalProps
> = ({ isOpen, onClose, onSuccess, accountId, disputeReason }) => {
    const { t, i18n } = useTranslation(["disputes", "common"]);
    const { success, error, showToast } = useToast();
    const queryClient = useQueryClient();
    const theme = useTheme();

    const [formData, setFormData] = useState<DisputeReason>({
        name: disputeReason?.name || "",
        status: disputeReason?.status || "Active",
        account_id: accountId,
        master_template: disputeReason?.master_template || false,
    });

    const [languageTemplates, setLanguageTemplates] = useState<
        DisputeReasonLanguage[]
    >([]);
    const [selectedLanguage, setSelectedLanguage] = useState<string>("");
    const [errors, setErrors] = useState<DisputeReasonErrors>({});
    const [hasValidated, setHasValidated] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Initialize with existing data or default to English
    useEffect(() => {
        if (isOpen) {
            if (
                disputeReason?.languageTemplates &&
                disputeReason.languageTemplates.length > 0
            ) {
                setLanguageTemplates(disputeReason.languageTemplates);
                setSelectedLanguage(
                    disputeReason.languageTemplates[0].language
                );
            } else {
                const defaultTemplate = {
                    language: "English",
                    name: disputeReason?.name || "",
                };
                setLanguageTemplates([defaultTemplate]);
                setSelectedLanguage("English");
            }

            setFormData({
                name: disputeReason?.name || "",
                status: disputeReason?.status || "Active",
                account_id: accountId,
                master_template: disputeReason?.master_template || false,
            });
            setErrors({});
            setHasValidated(false);
            setIsTransitioning(false);
        }
    }, [disputeReason, accountId, isOpen]);

    const validateForm = (): boolean => {
        setHasValidated(true);
        const newErrors: DisputeReasonErrors = {};

        // Validate that at least one language template has a name
        const hasValidLanguage = languageTemplates.some(
            (template) => template.name && template.name.trim().length > 0
        );

        if (!hasValidLanguage) {
            newErrors.languageTemplates = t(
                "validation.name_required_for_language",
                { ns: "disputes" }
            );
        }

        // Validate individual language templates
        languageTemplates.forEach((template, index) => {
            if (template.name && template.name.trim().length > 0) {
                if (template.name.trim().length < 2) {
                    newErrors[`language_${index}`] = t(
                        "common.validation.minLength",
                        { count: 2 }
                    );
                } else if (template.name.trim().length > 100) {
                    newErrors[`language_${index}`] = t(
                        "common.validation.maxLength",
                        { count: 100 }
                    );
                }
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

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

        // Clear errors for this field
        if (errors[`language_${index}`]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[`language_${index}`];
                return newErrors;
            });
        }
    };

    const handleAddLanguage = () => {
        const availableLanguages = SUPPORTED_LANGUAGES.filter(
            (lang) =>
                !languageTemplates.some(
                    (template) => template.language === lang
                )
        );

        if (availableLanguages.length > 0) {
            const newTemplate = {
                language: availableLanguages[0],
                name: "",
            };
            setLanguageTemplates([...languageTemplates, newTemplate]);
            setSelectedLanguage(availableLanguages[0]);
        }
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
        }
    };

    const handleBlur = (field: keyof DisputeReason) => {
        const value = formData[field];

        if (field === "name") {
            const nameValue = String(value || "").trim();
            if (!nameValue) {
                setErrors((prev) => ({
                    ...prev,
                    name: t("validation.name_required", { ns: "disputes" }),
                }));
            } else if (nameValue.length < 2) {
                setErrors((prev) => ({
                    ...prev,
                    name: t("common.validation.minLength", { count: 2 }),
                }));
            } else if (nameValue.length > 100) {
                setErrors((prev) => ({
                    ...prev,
                    name: t("common.validation.maxLength", { count: 100 }),
                }));
            } else {
                setErrors((prev) => {
                    const newErrors = { ...prev };
                    delete newErrors.name;
                    return newErrors;
                });
            }
        }
    };

    const handleInputChange = (field: keyof DisputeReason, value: any) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }));

        // Clear error when user starts typing
        if (errors[field]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const createMutation = useMutation({
        mutationFn: async (
            data: DisputeReason & { languageTemplates: DisputeReasonLanguage[] }
        ) => {
            const response = await apiFetch("/api/operations/dispute-reasons", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.error || "Failed to create dispute reason"
                );
            }

            return response.json();
        },
        onSuccess: () => {
            success(t("messages.reasons_create_success", { ns: "disputes" }));
            queryClient.invalidateQueries({ queryKey: ["dispute-reasons"] });
            onSuccess();
            onClose();
        },
        onError: (error: Error) => {
            showToast(
                t("messages.reasons_create_error", { ns: "disputes" }),
                "error"
            );
            console.error("Error creating dispute reason:", error);
        },
    });

    const updateMutation = useMutation({
        mutationFn: async (
            data: DisputeReason & { languageTemplates: DisputeReasonLanguage[] }
        ) => {
            const response = await apiFetch(`/api/operations/dispute-reasons/${disputeReason?.id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(data),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.error || "Failed to update dispute reason"
                );
            }

            return response.json();
        },
        onSuccess: () => {
            success(t("messages.reasons_update_success", { ns: "disputes" }));
            queryClient.invalidateQueries({ queryKey: ["dispute-reasons"] });
            onSuccess();
            onClose();
        },
        onError: (error: Error) => {
            showToast(
                t("messages.reasons_update_error", { ns: "disputes" }),
                "error"
            );
            console.error("Error updating dispute reason:", error);
        },
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsTransitioning(true);

        try {
            const submitData = {
                ...formData,
                languageTemplates: languageTemplates.filter(
                    (template) =>
                        template.name && template.name.trim().length > 0
                ),
            };

            if (disputeReason?.id) {
                await updateMutation.mutateAsync(submitData);
            } else {
                await createMutation.mutateAsync(submitData);
            }
        } catch (error) {
            console.error("Error submitting form:", error);
        } finally {
            setIsTransitioning(false);
        }
    };

    const isLoading =
        createMutation.isPending || updateMutation.isPending || isTransitioning;

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
        <AppDialog
            open={isOpen}
            onClose={onClose}
            drag={false}
            align={false}
            slide={false}
            isRTL={i18n.language === "he"}
            title={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <GavelIcon color="primary" />
                    <Typography variant="h6">
                        {disputeReason?.id
                            ? t("actions.reasons_edit", { ns: "disputes" })
                            : t("actions.reasons_add", { ns: "disputes" })}
                    </Typography>
                </Box>
            }
            titleIcon={null}
            ariaLabelledBy="upsert-dispute-reason-title"
            ariaDescribedBy="upsert-dispute-reason-description"
            maxWidth="md"
            fullWidth
            paperSx={{
                sx: {
                    borderRadius:
                        typeof theme.shape.borderRadius === "number"
                            ? theme.shape.borderRadius
                            : 4,
                    minHeight: "600px",
                },
            }}
            actions={
                <>
                    <Button
                        onClick={onClose}
                        variant="outlined"
                        size="small"
                        className="cancel-button"
                        disabled={isLoading}
                        sx={{
                            mr: i18n.language === "he" ? 0 : theme.spacing(1),
                            ml: i18n.language === "he" ? theme.spacing(1) : 0,
                        }}
                    >
                        {t("common.actions.cancel")}
                    </Button>
                    <Button
                        type="submit"
                        form="upsert-dispute-reason-form"
                        variant="contained"
                        size="small"
                        fullWidth={false}
                        className="save-button"
                        disabled={isLoading}
                        sx={{
                            "& .MuiButton-endIcon": {
                                marginRight: i18n.language === "he" ? theme.spacing(1) : undefined,
                                marginLeft: i18n.language !== "he" ? undefined : theme.spacing(1),
                            },
                        }}
                    >
                        {t("actions.save", { ns: "common" })}
                    </Button>
                </>
            }
        >
            <form id="upsert-dispute-reason-form" onSubmit={handleSubmit}>
                <Box id="upsert-dispute-reason-description" component="div">
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            {t("sections.multi_language_settings", {
                                ns: "disputes",
                            })}
                        </Typography>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 2 }}
                        >
                            {t("tooltips.multi_language_info", {
                                ns: "disputes",
                            })}
                        </Typography>

                        {/* Language Overview Cards */}
                        <Box
                            sx={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 2,
                                mb: 3,
                            }}
                        >
                            {languageTemplates.map((template, index) => (
                                <Box
                                    key={index}
                                    sx={{
                                        flex: "1 1 300px",
                                        minWidth: "300px",
                                    }}
                                >
                                    <Card
                                        variant="outlined"
                                        sx={{
                                            cursor: "pointer",
                                            border:
                                                selectedLanguage ===
                                                    template.language
                                                    ? 2
                                                    : 1,
                                            borderColor:
                                                selectedLanguage ===
                                                    template.language
                                                    ? "primary.main"
                                                    : "divider",
                                            "&:hover": {
                                                borderColor: "primary.main",
                                            },
                                        }}
                                        onClick={() =>
                                            setSelectedLanguage(
                                                template.language
                                            )
                                        }
                                    >
                                        <CardContent sx={{ p: 2 }}>
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    justifyContent:
                                                        "space-between",
                                                    alignItems: "center",
                                                    mb: 1,
                                                }}
                                            >
                                                <Typography variant="subtitle2">
                                                    {getLanguageDisplayName(
                                                        template.language
                                                    )}
                                                </Typography>
                                                {languageTemplates.length >
                                                    1 && (
                                                        <IconButton
                                                            size="small"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRemoveLanguage(
                                                                    index
                                                                );
                                                            }}
                                                            color="error"
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    )}
                                            </Box>
                                            <Typography
                                                variant="body2"
                                                color={
                                                    template.name
                                                        ? "text.primary"
                                                        : "text.secondary"
                                                }
                                                sx={{
                                                    minHeight: "20px",
                                                    fontStyle: template.name
                                                        ? "normal"
                                                        : "italic",
                                                }}
                                            >
                                                {template.name ||
                                                    t("fields.language_name", {
                                                        ns: "disputes",
                                                    })}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Box>
                            ))}

                            {SUPPORTED_LANGUAGES.filter(
                                (lang) =>
                                    !languageTemplates.some(
                                        (template) => template.language === lang
                                    )
                            ).length > 0 && (
                                    <Box
                                        sx={{
                                            flex: "1 1 300px",
                                            minWidth: "300px",
                                        }}
                                    >
                                        <Card
                                            variant="outlined"
                                            sx={{
                                                cursor: "pointer",
                                                border: "2px dashed",
                                                borderColor: "divider",
                                                "&:hover": {
                                                    borderColor: "primary.main",
                                                },
                                            }}
                                            onClick={handleAddLanguage}
                                        >
                                            <CardContent
                                                sx={{ p: 2, textAlign: "center" }}
                                            >
                                                <AddIcon
                                                    color="primary"
                                                    sx={{ mb: 1 }}
                                                />
                                                <Typography
                                                    variant="body2"
                                                    color="primary"
                                                >
                                                    {t("actions.add_language", {
                                                        ns: "disputes",
                                                    })}
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Box>
                                )}
                        </Box>

                        {/* Completion Status */}
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="body2" color="text.secondary">
                                {t("sections.language_overview", {
                                    ns: "disputes",
                                })}
                                : {status.completed}/{status.total}
                            </Typography>
                        </Box>
                    </Box>

                    {/* Language Template Editor */}
                    {selectedLanguage && (
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="h6" gutterBottom>
                                {t("tooltips.name_in_language", {
                                    ns: "disputes",
                                    language:
                                        getLanguageDisplayName(
                                            selectedLanguage
                                        ),
                                })}
                            </Typography>

                            {languageTemplates.map(
                                (template, index) =>
                                    template.language === selectedLanguage && (
                                        <TextField
                                            key={index}
                                            fullWidth
                                            label={t("fields.language_name", {
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
                                                !!errors[`language_${index}`]
                                            }
                                            helperText={
                                                errors[`language_${index}`]
                                            }
                                            variant="outlined"
                                            sx={{ mb: 2 }}
                                        />
                                    )
                            )}
                        </Box>
                    )}

                    {/* Basic Fields */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            {t("sections.information", { ns: "disputes" })}
                        </Typography>

                        <FormControlLabel
                            control={
                                <Switch
                                    checked={formData.status === "Active"}
                                    onChange={(e) =>
                                        handleInputChange(
                                            "status",
                                            e.target.checked
                                                ? "Active"
                                                : "Inactive"
                                        )
                                    }
                                    color="primary"
                                />
                            }
                            label={
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                    }}
                                >
                                    <Typography>
                                        {formData.status === "Active"
                                            ? t("values.status_active", { ns: "common" })
                                            : t("values.status_inactive", { ns: "common" })}
                                    </Typography>
                                    <Tooltip
                                        title={t("tooltips.status", {
                                            ns: "disputes",
                                        })}
                                    >
                                        <HelpIcon
                                            fontSize="small"
                                            color="action"
                                        />
                                    </Tooltip>
                                </Box>
                            }
                            sx={{ mb: 2 }}
                        />

                        {formData.master_template !== undefined && (
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={formData.master_template}
                                        onChange={(e) =>
                                            handleInputChange(
                                                "master_template",
                                                e.target.checked
                                            )
                                        }
                                        color="primary"
                                    />
                                }
                                label={
                                    <Typography>
                                        {formData.master_template
                                            ? "Master Template"
                                            : "Not Master Template"}
                                    </Typography>
                                }
                                sx={{ mb: 2 }}
                            />
                        )}
                    </Box>

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
                </Box>
            </form>
        </AppDialog>
    );
};
