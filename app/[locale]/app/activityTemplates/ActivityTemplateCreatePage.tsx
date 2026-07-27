"use client";

import {
    Box,
    Breadcrumbs,
    Button,
    Link,
    Paper,
    Stack,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api, { apiFetch } from "@/app/api";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import Seo from "@/shared/layout-components/seo/seo";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";

import DescriptionIcon from "@mui/icons-material/Description";
import ActivityTemplateForm, {
    ActivityTemplate,
    LanguageTemplate,
} from "./ActivityTemplateForm";

interface ActivityTemplateCreatePageProps {
    category: string;
    tabName: string;
    createDescriptionKey: string;
    backUrl: string;
}

export default function ActivityTemplateCreatePage({
    category,
    tabName,
    createDescriptionKey,
    backUrl,
}: ActivityTemplateCreatePageProps) {
    const { t, i18n } = useTranslation(["activity_templates", "settings", "common"]);
    const theme = useTheme();
    const { data: session } = useSession();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { showToast } = useToast();


    const accountId = session?.user?.account_id || 0;

    // Fetch user permissions
    const { data: userPermissionsData } = useQuery<{ permissions: string[] }>({
        queryKey: ["user-permissions", session?.user?.id, session?.user?.role, accountId],
        queryFn: async () => {
            const response = await api.get("/api/permissions/me");
            return response.data;
        },
        enabled: !!session?.user,
        staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    });

    const userPermissions = userPermissionsData?.permissions || [];
    const hasEditTemplatesPermission = userPermissions.includes("edit_templates");
    const hasViewTemplatesPermission = userPermissions.includes("view_templates");

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [hasValidated, setHasValidated] = useState(false);
    const [formData, setFormData] = useState<ActivityTemplate>({
        id: 0,
        name: "",
        category: category,
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
            const response = await apiFetch("/api/activities/templates", {
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
                t("actions.activity_templates_success_template_created"),
                "success"
            );
            router.push(backUrl);
        },
        onError: (error: Error) => {
            showToast(
                error.message ||
                t("messages.activity_templates_error_template_save_error"),
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

        if (!formData.name?.trim()) {
            newErrors.name = t("validation.fields.name");
        }

        // Validate each language template
        if (
            !formData.languageTemplates ||
            formData.languageTemplates.length === 0
        ) {
            newErrors.languageTemplates = t(
                "validation.at_least_one_language"
            );
        } else {
            formData.languageTemplates.forEach((langTemplate, index) => {
                if (!langTemplate.sms_content?.trim()) {
                    newErrors[`sms_content_${index}`] = t(
                        "validation.fields.sms_content"
                    );
                }
                if (!langTemplate.whatsapp_content?.trim()) {
                    newErrors[`whatsapp_content_${index}`] = t(
                        "validation.fields.whatsapp_content"
                    );
                }
                if (!langTemplate.email_subject?.trim()) {
                    newErrors[`email_subject_${index}`] = t(
                        "validation.fields.email_subject"
                    );
                }

                const emailContent = langTemplate.email_content?.trim() || "";
                const strippedContent = emailContent
                    .replace(/<[^>]*>/g, "")
                    .trim();
                if (!strippedContent) {
                    newErrors[`email_content_${index}`] = t(
                        "validation.fields.email_content"
                    );
                }
            });
        }

        setErrors(newErrors);
        setHasValidated(true);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            showToast(
                t("validation.please_fix_errors"),
                "error"
            );
            return;
        }

        setIsSubmitting(true);

        try {
            // Prepare the data for submission
            const submitData = {
                ...formData,
                languageTemplates: formData.languageTemplates || [],
            };

            await createMutation.mutateAsync(submitData);
        } catch (error) {
            console.error("Error creating template:", error);
            showToast(
                t("messages.activity_templates_error_template_save_error"),
                "error"
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    // Check if user has view_templates permission
    if (userPermissionsData && !hasViewTemplatesPermission) {
        return (
            <Box sx={{ p: 3 }}>
                <Typography variant="h6" color="error" gutterBottom>
                    {t("messages.no_permission", { ns: "common", defaultValue: "You do not have permission to view this page" })}
                </Typography>
                <Button onClick={() => router.push("/app/settings")} variant="outlined">
                    {t("actions.back", { ns: "common" })}
                </Button>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                bgcolor: "background.default",
                minHeight: "100vh",
                m: 0,
                p: 0,
                mt: { xs: -1, sm: -1.5 },
                mx: { xs: -1, sm: -1.5 },
                width: { xs: "calc(100% + 16px)", sm: "calc(100% + 24px)" },
                maxWidth: { xs: "calc(100% + 16px)", sm: "calc(100% + 24px)" },
            }}
        >
            <Seo title={t("activityTemplates.create_activity_template")} />

            {/* Sticky Header */}
            <Box
                sx={{
                    position: "sticky",
                    top: { xs: "-8px", sm: "-12px" },
                    left: 0,
                    right: 0,
                    zIndex: 30,
                    bgcolor: "background.paper",
                    flexShrink: 0,
                    m: 0,
                    mt: 0,
                    backgroundColor: "background.paper",
                    width: "100%",
                    maxWidth: "100%",
                    px: { xs: 2, sm: 3, md: 4 },
                    pt: { xs: 2, sm: 3 },
                    pb: 0,
                }}
            >
                <Box
                    sx={{
                        maxWidth: "xl",
                        mx: "auto",
                    }}
                >
                    {/* Breadcrumbs */}
                    <Breadcrumbs
                        sx={{
                            mb: 1,
                            width: "100%",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            "& .MuiBreadcrumbs-ol": {
                                flexWrap: "nowrap",
                                overflow: "hidden",
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                flexDirection: i18n.language === "he" ? "row-reverse" : "row",
                                justifyContent: i18n.language === "he" ? "flex-end" : "flex-start",
                            },
                            "& .MuiBreadcrumbs-li": {
                                minWidth: 0,
                                flexShrink: 1,
                                maxWidth: "none",
                                padding: 0,
                                margin: 0,
                            },
                        }}
                    >
                        <Link
                            component="button"
                            variant="body1"
                            onClick={() => router.push("/app/settings")}
                            sx={{
                                textDecoration: "none",
                                color: "primary.main",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                minWidth: 0,
                                flexShrink: 1,
                                display: "block",
                                maxWidth: "none",
                            }}
                        >
                            {t("fields.title", { ns: "settings" })}
                        </Link>
                        <Link
                            component="button"
                            variant="body1"
                            onClick={() => router.push(backUrl)}
                            sx={{
                                textDecoration: "none",
                                color: "primary.main",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                minWidth: 0,
                                flexShrink: 1,
                                display: "block",
                                maxWidth: "none",
                            }}
                        >
                            {tabName === "automated"
                                ? t("values.activity_templates_automated")
                                : tabName === "promiseToPay"
                                    ? t("fields.activity_templates_promise_to_pay")
                                    : tabName === "dispute"
                                        ? t("fields.activity_templates_dispute")
                                        : t(`fields.tab_${tabName}`, { ns: "settings" })}
                        </Link>
                        <Typography
                            color="text.primary"
                            sx={{
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                minWidth: 0,
                                flexShrink: 1,
                                display: "block",
                                maxWidth: "none",
                            }}
                        >
                            {t("activityTemplates.create_activity_template")}
                        </Typography>
                    </Breadcrumbs>

                    <Box sx={{ "& .MuiPaper-root": { mb: 0 } }}>
                        <PageHeader
                            title={t("activityTemplates.create_activity_template")}
                            description={t(createDescriptionKey)}
                            sticky={false}
                        >
                            {hasEditTemplatesPermission && (
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        ml: { xs: 0, sm: "auto" },
                                        mt: { xs: 2, sm: 0 },
                                    }}
                                >
                                    <Stack
                                        direction="row"
                                        alignItems="center"
                                        className="edit-action-button-group"
                                        sx={{
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                        }}
                                    >
                                        <Button
                                            onClick={() => router.push(backUrl)}
                                            variant="outlined"
                                            className="cancel-button"
                                            disabled={isSubmitting}
                                        >
                                            {t("actions.cancel", { ns: "common" })}
                                        </Button>
                                        <Button
                                            onClick={isSubmitting ? undefined : handleSubmit}
                                            variant="contained"
                                            className="save-button"
                                            disabled={isSubmitting}
                                        >
                                            {t("actions.save", { ns: "common" })}
                                        </Button>
                                    </Stack>
                                </Box>
                            )}
                        </PageHeader>
                    </Box>
                </Box>
            </Box>

            <Box sx={{ maxWidth: "xl", mx: "auto", px: { xs: 2, sm: 3, md: 4 }, py: 3 }}>
                <ActivityTemplateForm
                    formData={formData}
                    onInputChange={handleInputChange}
                    onLanguageTemplateChange={handleLanguageTemplateChange}
                    onAddLanguage={handleAddLanguage}
                    onRemoveLanguage={handleRemoveLanguage}
                    errors={errors}
                    hasValidated={hasValidated}
                    disabled={isSubmitting || !hasEditTemplatesPermission}
                    showCategory={true}
                    lockedCategory={category}
                />
            </Box>
        </Box>
    );
}
