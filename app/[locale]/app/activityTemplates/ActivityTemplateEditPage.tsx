"use client";

import DescriptionIcon from "@mui/icons-material/Description";
import {
    Box,
    Breadcrumbs,
    Button,
    CircularProgress,
    Link,
    Stack,
    Typography
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api, { apiFetch } from "@/app/api";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import PageHeader from "@/components/PageHeader";
import Seo from "@/shared/layout-components/seo/seo";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";

import ActivityTemplateForm, {
    ActivityTemplate,
    LanguageTemplate,
} from "./ActivityTemplateForm";

interface ActivityTemplateEditPageProps {
    category: string;
    tabName: string;
    editDescriptionKey: string;
    backUrl: string;
}

export default function ActivityTemplateEditPage({
    category,
    tabName,
    editDescriptionKey,
    backUrl,
}: ActivityTemplateEditPageProps) {
    const { t, i18n } = useTranslation(["common", "activity_templates", "settings"]);
    const theme = useTheme();
    const { data: session } = useSession();
    const router = useRouter();
    const params = useParams();
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    const templateId = params?.id as string;
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
    const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState<string>("");
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [hasValidated, setHasValidated] = useState(false);
    const headerRef = useRef<HTMLDivElement>(null);
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
        dispute_resolution: "",
        languageTemplates: [],
    });

    // Navigation state
    const [shouldNavigateAfterSave, setShouldNavigateAfterSave] =
        useState(false);

    // Fetch template data
    const {
        data: template,
        isLoading,
        error,
    } = useQuery({
        queryKey: [`${category}Template`, templateId],
        queryFn: async () => {
            const response = await apiFetch(`/api/activities/templates/${templateId}`
            );
            if (!response.ok) {
                throw new Error("Failed to fetch template");
            }
            return response.json();
        },
        enabled: !!templateId && !!accountId,
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: async (data: ActivityTemplate) => {
            const response = await apiFetch(`/api/activities/templates/${templateId}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        ...data,
                        id: parseInt(templateId),
                        account_id: accountId,
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to update template");
            }
            return response.json();
        },
        onSuccess: () => {
            // Remove queries from cache to force fresh fetch
            queryClient.removeQueries({ queryKey: ["activityTemplates"] });
            // Invalidate to mark as stale
            queryClient.invalidateQueries({ queryKey: ["activityTemplates"] });
            // Refetch all matching queries
            queryClient.refetchQueries({
                queryKey: ["activityTemplates"],
                type: 'all'
            });
            showToast(
                t("actions.activity_templates_success_template_created", { ns: "activity_templates" }),
                "success"
            );

            // Navigate back if this was triggered by handleSubmit
            if (shouldNavigateAfterSave) {
                setShouldNavigateAfterSave(false);
                // Small delay to ensure query invalidation is processed
                setTimeout(() => {
                    router.push(backUrl);
                }, 100);
            }
        },
        onError: (error: Error) => {
            showToast(
                error.message ||
                t("messages.activity_templates_error_template_save_error", { ns: "activity_templates" }),
                "error"
            );
        },
    });

    // Update page title when template loads
    useEffect(() => {
        if (template?.name) {
            document.title = `${template.name} - ${t("actions.activity_templates_edit_activity_template", { ns: "activity_templates" })}`;
        } else {
            document.title = t("actions.activity_templates_edit_activity_template", { ns: "activity_templates" });
        }
    }, [template?.name, t]);

    useEffect(() => {
        if (template) {
            // Initialize language templates from template data
            let languageTemplates: LanguageTemplate[] = [];

            if (
                template.ActivityTemplateLanguage &&
                template.ActivityTemplateLanguage.length > 0
            ) {
                // Transform ActivityTemplateLanguage to LanguageTemplate format
                languageTemplates = template.ActivityTemplateLanguage.map(
                    (lang: any) => ({
                        language: lang.language,
                        sms_content: lang.sms_content || "",
                        whatsapp_content: lang.whatsapp_content || "",
                        email_subject: lang.email_subject || "",
                        email_content: lang.email_content || "",
                    })
                );
            } else if (
                template.languageTemplates &&
                template.languageTemplates.length > 0
            ) {
                languageTemplates = template.languageTemplates;
            } else {
                // Fallback to single language from legacy data
                languageTemplates = [
                    {
                        language: template.language || "English",
                        sms_content: template.sms_content || "",
                        whatsapp_content: template.whatsapp_content || "",
                        email_subject: template.email_subject || "",
                        email_content: template.email_content || "",
                    },
                ];
            }

            const newFormData = {
                id: template.id,
                name: template.name || "",
                category: template.category || category,
                language: template.language || "English",
                sms_content: template.sms_content || "",
                whatsapp_content: template.whatsapp_content || "",
                email_subject: template.email_subject || "",
                email_content: template.email_content || "",
                active: template.active || false,
                dispute_resolution: template.dispute_resolution || "",
                languageTemplates,
            };

            setFormData(newFormData);
        }
    }, [template, category]);

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
            newErrors.name = t("validation.activity_templates_validation_fields_name", { ns: "activity_templates" });

        // Validate each language template
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
                t("validation.activity_templates_validation_please_fix_errors", { ns: "activity_templates" }),
                "error"
            );
            return;
        }

        setIsSubmitting(true);
        setShouldNavigateAfterSave(true);

        try {
            // Prepare the data for submission
            const submitData = {
                ...formData,
                languageTemplates: formData.languageTemplates || [],
            };

            await updateMutation.mutateAsync(submitData);
            // Don't reset isSubmitting here - let navigation handle it
            // The button will stay disabled during navigation, preventing the blink
        } catch {
            showToast(
                t("messages.activity_templates_error_template_save_error", { ns: "activity_templates" }),
                "error"
            );
            setShouldNavigateAfterSave(false);
            setIsSubmitting(false); // Only reset on error
        }
    };

    const handleSendTestEmail = async () => {
        // Use the selected language from the form
        const languageToUse = selectedLanguage ||
            formData.languageTemplates?.[0]?.language ||
            formData.language ||
            "English";

        // Find the language template for the selected language
        const languageTemplate = formData.languageTemplates?.find(
            (lt) => lt.language === languageToUse
        );

        // Check if email content exists for selected language
        const emailSubject = languageTemplate?.email_subject || formData.email_subject || "";
        const emailContent = languageTemplate?.email_content || formData.email_content || "";

        if (!emailSubject?.trim() || !emailContent?.trim()) {
            showToast(
                t("messages.activity_templates_no_email_content_for_language", {
                    ns: "activity_templates",
                    language: languageToUse
                }),
                "error"
            );
            return;
        }

        setIsSendingTestEmail(true);

        try {
            const response = await apiFetch(`/api/activities/templates/${templateId}/test-email`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        language: languageToUse,
                        emailSubject: emailSubject,
                        emailContent: emailContent,
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to send test email");
            }

            const result = await response.json();
            showToast(
                t("messages.activity_templates_test_email_sent", {
                    ns: "activity_templates",
                    language: result.language || languageToUse
                }),
                "success"
            );
        } catch (error: any) {
            showToast(
                error.message ||
                t("messages.activity_templates_test_email_error", { ns: "activity_templates" }),
                "error"
            );
        } finally {
            setIsSendingTestEmail(false);
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

    if (isLoading) {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "50vh",
                }}
            >
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Typography variant="h6" color="error" gutterBottom>
                    {t("fields.activity_templates_template_not_found", { ns: "activity_templates" })}
                </Typography>
                <Button onClick={() => router.push(backUrl)} variant="outlined">
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
            <Seo
                title={
                    template?.name
                        ? `${template.name} - ${t("actions.activity_templates_edit_activity_template", { ns: "activity_templates" })}`
                        : t("actions.activity_templates_edit_activity_template", { ns: "activity_templates" })
                }
            />

            {/* Sticky Header */}
            <Box
                ref={headerRef}
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
                            direction:
                                i18n.language === "he" ? "rtl" : "ltr",
                            "& .MuiBreadcrumbs-ol": {
                                flexWrap: "nowrap",
                                overflow: "hidden",
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                flexDirection:
                                    i18n.language === "he"
                                        ? "row-reverse"
                                        : "row",
                                justifyContent:
                                    i18n.language === "he"
                                        ? "flex-end"
                                        : "flex-start",
                            },
                            "& .MuiBreadcrumbs-li": {
                                minWidth: 0,
                                flexShrink: 1,
                                maxWidth: "none",
                                padding: 0,
                                margin: 0,
                            },
                            "& .MuiBreadcrumbs-separator": {
                                marginLeft:
                                    i18n.language === "he"
                                        ? 0
                                        : theme.spacing(0.5),
                                marginRight:
                                    i18n.language === "he"
                                        ? theme.spacing(0.5)
                                        : theme.spacing(0.5),
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
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                                textAlign:
                                    i18n.language === "he" ? "right" : "left",
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
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                                textAlign:
                                    i18n.language === "he" ? "right" : "left",
                            }}
                        >
                            {tabName === "automated"
                                ? t("values.activity_templates_automated", { ns: "activity_templates" })
                                : tabName === "promiseToPay"
                                    ? t("fields.activity_templates_promise_to_pay", { ns: "activity_templates" })
                                    : tabName === "dispute"
                                        ? t("fields.activity_templates_dispute", { ns: "activity_templates" })
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
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                                textAlign:
                                    i18n.language === "he" ? "right" : "left",
                            }}
                        >
                            {template?.name ||
                                t("actions.activity_templates_edit_activity_template", { ns: "activity_templates" })}
                        </Typography>
                    </Breadcrumbs>

                    <Box sx={{ "& .MuiPaper-root": { mb: 0 } }}>
                        <PageHeader
                            title={
                                template?.name
                                    ? `${template.name} - ${t("actions.activity_templates_edit_activity_template", { ns: "activity_templates" })}`
                                    : t("actions.activity_templates_edit_activity_template", { ns: "activity_templates" })
                            }
                            description={t(editDescriptionKey, { ns: "activity_templates" })}
                            sticky={false}
                        >
                            {hasEditTemplatesPermission && (
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        ml: {
                                            xs: 0,
                                            sm: i18n.language === "he" ? 0 : "auto",
                                        },
                                        mr: {
                                            xs: 0,
                                            sm: i18n.language === "he" ? "auto" : 0,
                                        },
                                        mt: { xs: 2, sm: 0 },
                                    }}
                                >
                                    <Stack
                                        direction="row"
                                        alignItems="center"
                                        className="edit-action-button-group edit-action-button-group--3"
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
                                            disabled={isSubmitting || isSendingTestEmail}
                                        >
                                            {t("actions.cancel", { ns: "common" })}
                                        </Button>
                                        <Button
                                            onClick={handleSendTestEmail}
                                            variant="outlined"
                                            color="primary"
                                            disabled={isSubmitting || isSendingTestEmail}
                                        >
                                            {t("actions.test_email", { ns: "activity_templates" })}
                                        </Button>
                                        <Button
                                            onClick={isSubmitting ? undefined : handleSubmit}
                                            variant="contained"
                                            className="save-button"
                                            disabled={isSubmitting || isSendingTestEmail}
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

            {/* Content Area */}
            <Box
                sx={{
                    px: { xs: 2, sm: 3, md: 4 },
                    py: { xs: 2, sm: 3 },
                }}
            >
                {/* Form */}
                <ActivityTemplateForm
                    formData={formData}
                    onInputChange={handleInputChange}
                    onLanguageTemplateChange={handleLanguageTemplateChange}
                    onAddLanguage={handleAddLanguage}
                    onRemoveLanguage={handleRemoveLanguage}
                    onSelectedLanguageChange={setSelectedLanguage}
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
