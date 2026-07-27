"use client";

import {
    ArrowBack as ArrowBackIcon,
    Save as SaveIcon,
} from "@mui/icons-material";
import {
    Box,
    Paper,
    Typography,
    Button,
    Breadcrumbs,
    Link,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import api, { apiFetch } from "@/app/api";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import Seo from "@/shared/layout-components/seo/seo";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";

import ActivityTemplateForm, {
    ActivityTemplate,
    LanguageTemplate,
} from "../../../activityTemplates/ActivityTemplateForm";

export default function CreateDisputeTemplatePage() {
    const { t, i18n } = useTranslation([
        "settings",
        "common",
        "activity_templates",
    ]);
    const theme = useTheme();
    const { data: session } = useSession();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const searchParams = useSearchParams();

    const accountId = session?.user?.account_id || 0;
    const backUrl =
        searchParams?.get("backUrl") ||
        "/app/settings?tab=templates&templateType=dispute";

    // Fetch user permissions
    const { data: userPermissionsData } = useQuery<{ permissions: string[] }>({
        queryKey: [
            "user-permissions",
            session?.user?.id,
            session?.user?.role,
            accountId,
        ],
        queryFn: async () => {
            const response = await api.get("/api/permissions/me");
            return response.data;
        },
        enabled: !!session?.user,
        staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    });

    const userPermissions = userPermissionsData?.permissions || [];
    const hasEditTemplatesPermission =
        userPermissions.includes("edit_templates");

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [hasValidated, setHasValidated] = useState(false);
    const [formData, setFormData] = useState<ActivityTemplate>({
        id: 0,
        name: "",
        category: "Dispute",
        language: "English",
        sms_content: "",
        whatsapp_content: "",
        email_subject: "",
        email_content: "",
        active: true,
        dispute_resolution: "", // Add dispute_resolution field
        languageTemplates: [
            {
                language: "English",
                sms_content: "",
                whatsapp_content: "",
                email_subject: "",
                email_content: "",
            },
        ],
    });

    // Create mutation
    const createMutation = useMutation({
        mutationFn: async (data: ActivityTemplate) => {
            const response = await apiFetch(`/api/activities/templates`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...data,
                    account_id: accountId,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to create template");
            }
            return response.json();
        },
        onSuccess: async (data) => {
            // Invalidate and refetch activityTemplates queries
            await queryClient.invalidateQueries({
                queryKey: ["activityTemplates"],
                exact: false,
            });

            showToast(
                t("activityTemplates.success.template_created"),
                "success"
            );

            // Navigate back to the templates list
            router.push(backUrl);
        },
        onError: (error: Error) => {
            showToast(
                error.message ||
                t("activityTemplates.error.template_save_error"),
                "error"
            );
        },
    });

    const handleInputChange = (
        field: keyof ActivityTemplate,
        value: string | boolean
    ) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }));
        // Clear error for this field when user starts typing
        if (errors[field]) {
            setErrors((prev) => ({ ...prev, [field]: "" }));
        }
    };

    const handleLanguageTemplateChange = (
        language: string,
        field: keyof LanguageTemplate,
        value: string
    ) => {
        setFormData((prev) => ({
            ...prev,
            languageTemplates:
                prev.languageTemplates?.map((lt) =>
                    lt.language === language ? { ...lt, [field]: value } : lt
                ) || [],
        }));

        // Clear error for this specific field when user starts typing
        const languageIndex =
            formData.languageTemplates?.findIndex(
                (lt) => lt.language === language
            ) || 0;
        const errorKey = `${field}_${languageIndex}`;
        if (errors[errorKey]) {
            setErrors((prev) => ({ ...prev, [errorKey]: "" }));
        }
    };

    const handleAddLanguage = (language: string) => {
        const newTemplate: LanguageTemplate = {
            language,
            sms_content: "",
            whatsapp_content: "",
            email_subject: "",
            email_content: "",
        };
        setFormData((prev) => ({
            ...prev,
            languageTemplates: [...(prev.languageTemplates || []), newTemplate],
        }));
    };

    const handleRemoveLanguage = (language: string) => {
        setFormData((prev) => ({
            ...prev,
            languageTemplates:
                prev.languageTemplates?.filter(
                    (lt) => lt.language !== language
                ) || [],
        }));
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.name?.trim())
            newErrors.name = t("activityTemplates.validation.fields.name");

        // Validate language templates
        if (
            !formData.languageTemplates ||
            formData.languageTemplates.length === 0
        ) {
            newErrors.languageTemplates = t(
                "activityTemplates.validation.fields.language_templates"
            );
        } else {
            formData.languageTemplates.forEach((langTemplate, index) => {
                if (!langTemplate.sms_content?.trim()) {
                    newErrors[`sms_content_${index}`] = t(
                        "activityTemplates.validation.fields.sms_content"
                    );
                }
                if (!langTemplate.whatsapp_content?.trim()) {
                    newErrors[`whatsapp_content_${index}`] = t(
                        "activityTemplates.validation.fields.whatsapp_content"
                    );
                }
                if (!langTemplate.email_subject?.trim()) {
                    newErrors[`email_subject_${index}`] = t(
                        "activityTemplates.validation.fields.email_subject"
                    );
                }

                const emailContent = langTemplate.email_content?.trim() || "";
                const strippedContent = emailContent
                    .replace(/<[^>]*>/g, "")
                    .trim();
                if (!strippedContent) {
                    newErrors[`email_content_${index}`] = t(
                        "activityTemplates.validation.fields.email_content"
                    );
                }
            });
        }

        // Validate dispute_resolution for Dispute category
        if (formData.category === "Dispute" && !formData.dispute_resolution) {
            newErrors.dispute_resolution = t(
                "activityTemplates.validation.fields.dispute_resolution"
            );
        }

        setErrors(newErrors);
        setHasValidated(true);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            showToast(
                t("activityTemplates.validation.please_fix_errors"),
                "error"
            );
            return;
        }

        setIsSubmitting(true);
        try {
            await createMutation.mutateAsync(formData);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Seo
                title={t("actions.activity_templates_add_activity_template", {
                    ns: "activity_templates",
                })}
            />

            {/* Breadcrumbs */}
            <Breadcrumbs sx={{ mb: 3 }}>
                <Link
                    component="button"
                    variant="body1"
                    onClick={() => {
                        const locale = i18n.language === "he" ? "he" : "en";
                        router.push(`/${locale}/app/settings`);
                    }}
                    sx={{ textDecoration: "none", color: "primary.main" }}
                >
                    {t("fields.title")}
                </Link>
                <Link
                    component="button"
                    variant="body1"
                    onClick={() => router.push(backUrl)}
                    sx={{ textDecoration: "none", color: "primary.main" }}
                >
                    {t("fields.tab_dispute_template_settings")}
                </Link>
                <Typography color="text.primary">
                    {t("actions.activity_templates_add_activity_template", {
                        ns: "activity_templates",
                    })}
                </Typography>
            </Breadcrumbs>

            {/* Header */}
            <Paper
                sx={{
                    p: 4,
                    mb: 3,
                    background: "white",
                    borderRadius: 2,
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
                    border: "1px solid #e0e0e0",
                    position: "relative",
                    overflow: "hidden",
                    animation: "slideUpHeader 0.6s ease-out forwards",
                    opacity: 0,
                    transform: "translateY(20px)",
                    "@keyframes slideUpHeader": {
                        "0%": {
                            opacity: 0,
                            transform: "translateY(20px)",
                        },
                        "100%": {
                            opacity: 1,
                            transform: "translateY(0)",
                        },
                    },
                }}
                elevation={0}
            >
                {/* Background Pattern */}
                <Box
                    sx={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        width: "200px",
                        height: "100%",
                        background:
                            "linear-gradient(135deg, rgba(25, 118, 210, 0.03) 0%, rgba(25, 118, 210, 0.08) 100%)",
                        clipPath: "polygon(100% 0, 0% 100%, 100% 100%)",
                    }}
                />

                <Box sx={{ position: "relative", zIndex: 1 }}>
                    <Box sx={{ textAlign: "left" }}>
                        <Typography
                            variant="h4"
                            fontWeight={600}
                            color="text.primary"
                            sx={{
                                mb: 1,
                                fontSize: "1.75rem",
                                lineHeight: 1.2,
                            }}
                        >
                            {t(
                                "actions.activity_templates_add_activity_template",
                                {
                                    ns: "activity_templates",
                                }
                            )}
                        </Typography>

                        <Typography
                            variant="body1"
                            color="text.secondary"
                            fontWeight={500}
                        >
                            {t("messages.activity_templates_edit_description", {
                                ns: "activity_templates",
                            })}
                        </Typography>
                    </Box>
                </Box>
            </Paper>

            {/* Form */}
            <ActivityTemplateForm
                formData={formData}
                errors={errors}
                onInputChange={handleInputChange}
                onLanguageTemplateChange={handleLanguageTemplateChange}
                onAddLanguage={handleAddLanguage}
                onRemoveLanguage={handleRemoveLanguage}
                lockedCategory="Dispute"
                hasValidated={hasValidated}
                disabled={isSubmitting || !hasEditTemplatesPermission}
            />

            {/* Actions */}
            {hasEditTemplatesPermission && (
                <Box
                    sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}
                >
                    <Button
                        onClick={() => router.push(backUrl)}
                        variant="outlined"
                        size="large"
                    >
                        {t("actions.cancel", { ns: "common" })}
                    </Button>
                    <Button
                        onClick={isSubmitting ? undefined : handleSubmit}
                        variant="contained"
                        fullWidth={false}
                        className="save-button"
                        disabled={isSubmitting}
                    >
                        {t("actions.save", { ns: "common" })}
                    </Button>
                </Box>
            )}
        </Box>
    );
}
