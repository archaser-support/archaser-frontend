"use client";

import { Settings as SettingsIcon } from "@mui/icons-material";
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

export default function CreatePromiseToPayTemplatePage() {
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
        "/app/settings?tab=templates&templateType=promiseToPay";

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
        category: "Promise_to_pay",
        language: "English",
        sms_content: "",
        whatsapp_content: "",
        email_subject: "",
        email_content: "",
        active: true,
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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["activityTemplates"] });
            showToast(
                t("actions.activity_templates_success_template_created", {
                    ns: "activity_templates",
                }),
                "success"
            );
            router.push(backUrl);
        },
        onError: (error: Error) => {
            showToast(
                error.message ||
                t("messages.activity_templates_error_template_save_error", {
                    ns: "activity_templates",
                }),
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
        // Debug logging removed for production
        setFormData((prev) => {
            const updated = {
                ...prev,
                languageTemplates:
                    prev.languageTemplates?.map((lt) =>
                        lt.language === language
                            ? { ...lt, [field]: value }
                            : lt
                    ) || [],
            };
            // Debug logging removed for production
            return updated;
        });

        // Clear error for this specific field when user starts typing
        const languageIndex = formData.languageTemplates?.findIndex(
            (lt) => lt.language === language
        );
        if (languageIndex !== undefined && languageIndex >= 0) {
            const errorKey = `${field}_${languageIndex}`;
            if (errors[errorKey]) {
                setErrors((prev) => ({ ...prev, [errorKey]: "" }));
            }
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
        setHasValidated(true);
        const newErrors: Record<string, string> = {};

        if (!formData.name)
            newErrors.name = t(
                "validation.activity_templates_validation_fields_name",
                { ns: "activity_templates" }
            );

        // Validate language templates
        if (
            !formData.languageTemplates ||
            formData.languageTemplates.length === 0
        ) {
            newErrors.languageTemplates = t(
                "validation.activity_templates_validation_at_least_one_language",
                { ns: "activity_templates" }
            );
        } else {
            formData.languageTemplates.forEach((langTemplate, index) => {
                if (!langTemplate.sms_content?.trim()) {
                    newErrors[`sms_content_${index}`] = t(
                        "validation.activity_templates_validation_fields_sms_content",
                        { ns: "activity_templates" }
                    );
                }
                if (!langTemplate.whatsapp_content?.trim()) {
                    newErrors[`whatsapp_content_${index}`] = t(
                        "validation.activity_templates_validation_fields_whatsapp_content",
                        { ns: "activity_templates" }
                    );
                }
                if (!langTemplate.email_subject?.trim()) {
                    newErrors[`email_subject_${index}`] = t(
                        "validation.activity_templates_validation_fields_email_subject",
                        { ns: "activity_templates" }
                    );
                }

                const emailContent = langTemplate.email_content?.trim() || "";
                const strippedContent = emailContent
                    .replace(/<[^>]*>/g, "")
                    .trim();
                if (!strippedContent) {
                    newErrors[`email_content_${index}`] = t(
                        "validation.activity_templates_validation_fields_email_content",
                        { ns: "activity_templates" }
                    );
                }
            });
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            showToast(
                t(
                    "validation.activity_templates_validation_please_fix_errors",
                    { ns: "activity_templates" }
                ),
                "error"
            );
            return;
        }

        // Debug logging removed for production
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
                    {t("fields.tab_promise_to_pay")}
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
                                { ns: "activity_templates" }
                            )}
                        </Typography>

                        <Typography
                            variant="body1"
                            color="text.secondary"
                            fontWeight={500}
                        >
                            {t(
                                "actions.activity_templates_multi_language_info",
                                { ns: "activity_templates" }
                            )}
                        </Typography>
                    </Box>
                </Box>
            </Paper>

            {/* Form */}
            <ActivityTemplateForm
                formData={formData}
                errors={errors}
                hasValidated={hasValidated}
                onInputChange={handleInputChange}
                onLanguageTemplateChange={handleLanguageTemplateChange}
                onAddLanguage={handleAddLanguage}
                onRemoveLanguage={handleRemoveLanguage}
                lockedCategory="Promise_to_pay"
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
                        sx={{
                            "& .MuiButton-endIcon": {
                                marginRight:
                                    i18n.language === "he"
                                        ? theme.spacing(1)
                                        : undefined,
                                marginLeft:
                                    i18n.language !== "he"
                                        ? undefined
                                        : theme.spacing(1),
                            },
                        }}
                    >
                        {t("actions.save", { ns: "common" })}
                    </Button>
                </Box>
            )}
        </Box>
    );
}
