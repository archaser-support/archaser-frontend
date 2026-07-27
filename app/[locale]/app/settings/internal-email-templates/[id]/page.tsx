"use client";

import {
    Box,
    Breadcrumbs,
    Button,
    CircularProgress,
    Link,
    Paper,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api, { apiFetch } from "@/app/api";
import { useSession } from "next-auth/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import PageHeader from "@/components/PageHeader";
import Seo from "@/shared/layout-components/seo/seo";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import DescriptionIcon from "@mui/icons-material/Description";

import InternalEmailEditor from "./InternalEmailEditor";

// Get template type label
const getTemplateTypeLabel = (type: string, t: any) => {
    const typeLabels = {
        dispute_assignment: t(
            "actions.internal_emails_dispute_assignment_label",
            { ns: "disputes" }
        ),
    };
    return (
        typeLabels[type as keyof typeof typeLabels] ||
        t("messages.internal_emails_default_template", { ns: "disputes" })
    );
};

export default function InternalEmailTemplateEditPage() {
    const { t, i18n } = useTranslation([
        "settings",
        "common",
        "activity_templates",
        "disputes",
    ]);
    const theme = useTheme();
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const { data: session } = useSession();

    const templateId = params?.id as string;
    const templateType = searchParams?.get("type");

    const [formData, setFormData] = useState({
        subject: "",
        content: "",
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
    const [shouldNavigateAfterSave, setShouldNavigateAfterSave] = useState(false);

    // Fetch user permissions
    const { data: userPermissionsData } = useQuery<{ permissions: string[] }>({
        queryKey: [
            "user-permissions",
            session?.user?.id,
            session?.user?.role,
            session?.user?.account_id,
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
    const hasViewTemplatesPermission =
        userPermissions.includes("view_templates");

    // Fetch template data when editing
    const {
        data: template,
        isLoading: templateLoading,
        error: templateError,
    } = useQuery({
        queryKey: ["internalEmailTemplate", templateId],
        queryFn: async () => {
            if (templateId === "create") return null;
            const response = await apiFetch(`/api/internalEmailTemplates/${templateId}`
            );
            if (!response.ok) {
                throw new Error("Failed to fetch template");
            }
            return response.json();
        },
        enabled: templateId !== "create",
        // Refetch when the query key changes (after creation)
        refetchOnWindowFocus: false,
    });

    // Fetch master template for defaults
    const { data: masterTemplate, isLoading: masterLoading } = useQuery({
        queryKey: ["masterTemplate", templateType],
        queryFn: async () => {
            if (!templateType) return null;
            const response = await apiFetch(`/api/internalEmailTemplates/master?type=${templateType}`
            );
            if (!response.ok) {
                throw new Error("Failed to fetch master template");
            }
            return response.json();
        },
        enabled: !!templateType && templateId === "create",
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: async (data: any) => {
            const response = await apiFetch(`/api/internalEmailTemplates/${templateId}`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to update template");
            }
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["internalEmailTemplates"],
            });
            showToast(
                t("messages.internal_emails_save_success", { ns: "disputes" }),
                "success"
            );

            // Navigate back if this was triggered by handleSubmit
            if (shouldNavigateAfterSave) {
                setShouldNavigateAfterSave(false);
                // Small delay to ensure query invalidation is processed
                setTimeout(() => {
                    const locale = i18n.language === "he" ? "he" : "en";
                    router.push(`/${locale}/app/settings?tab=templates&templateType=internalEmail`);
                }, 100);
            }
        },
        onError: (error: Error) => {
            showToast(
                error.message ||
                t("messages.internal_emails_save_error", { ns: "disputes" }),
                "error"
            );
            setShouldNavigateAfterSave(false);
        },
    });

    // Create mutation
    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const response = await apiFetch("/api/internalEmailTemplates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to create template");
            }
            return response.json();
        },
        onSuccess: (newTemplate) => {
            queryClient.invalidateQueries({
                queryKey: ["internalEmailTemplates"],
            });
            showToast(
                t("messages.internal_emails_create_success", { ns: "disputes" }),
                "success"
            );

            // Navigate back if this was triggered by handleSubmit
            if (shouldNavigateAfterSave) {
                setShouldNavigateAfterSave(false);
                // Small delay to ensure query invalidation is processed
                setTimeout(() => {
                    const locale = i18n.language === "he" ? "he" : "en";
                    router.push(`/${locale}/app/settings?tab=templates&templateType=internalEmail`);
                }, 100);
            } else if (newTemplate && newTemplate.id) {
                // Update the URL to reflect the new template ID for future saves (only if not navigating)
                const newUrl = `/app/settings/internal-email-templates/${newTemplate.id}?type=${templateType}`;
                router.replace(newUrl, { scroll: false });
            }
        },
        onError: (error: Error) => {
            showToast(
                error.message ||
                t("messages.internal_emails_create_error", {
                    ns: "disputes",
                }),
                "error"
            );
            setShouldNavigateAfterSave(false);
        },
    });

    // Load template data when fetched or initialize defaults for new templates
    useEffect(() => {
        if (template) {
            // Load existing template data
            setFormData({
                subject: template.subject || "",
                content: template.content || "",
            });
        } else if (templateId === "create" && masterTemplate) {
            // Initialize with master template values for new templates
            setFormData({
                subject: masterTemplate.subject || "",
                content: masterTemplate.content || "",
            });
        }
    }, [template, templateId, masterTemplate]);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setShouldNavigateAfterSave(true);

        try {
            const templateName =
                template?.name ||
                masterTemplate?.name ||
                getTemplateTypeLabel(templateType || "", t);
            const submitData = {
                name: templateName,
                subject: formData.subject,
                content: formData.content,
                type: templateType,
            };

            // Check if we have an existing template to update
            if (template && template.id) {
                await updateMutation.mutateAsync(submitData);
            } else {
                await createMutation.mutateAsync(submitData);
            }
            // Don't reset isSubmitting here - let navigation handle it
            // The button will stay disabled during navigation, preventing the blink
        } catch (error) {
            // Error is already handled by mutation onError callback
            setShouldNavigateAfterSave(false);
            setIsSubmitting(false); // Only reset on error
        }
    };

    const handleSendTestEmail = async () => {
        // Check if email content exists
        const emailSubject = formData.subject || "";
        const emailContent = formData.content || "";

        if (!emailSubject?.trim() || !emailContent?.trim()) {
            showToast(
                t("messages.internal_emails_no_email_content_for_test", {
                    ns: "disputes",
                }),
                "error"
            );
            return;
        }

        // Check if template exists (can't send test email for new templates)
        if (templateId === "create" || !templateId) {
            showToast(
                t("messages.internal_emails_save_before_test", {
                    ns: "disputes",
                }),
                "error"
            );
            return;
        }

        setIsSendingTestEmail(true);

        try {
            const response = await apiFetch(`/api/internalEmailTemplates/${templateId}/test-email`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
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
                t("messages.internal_emails_test_email_sent", {
                    ns: "disputes",
                }),
                "success"
            );
        } catch (error: any) {
            showToast(
                error.message ||
                t("messages.internal_emails_test_email_error", {
                    ns: "disputes",
                }),
                "error"
            );
        } finally {
            setIsSendingTestEmail(false);
        }
    };

    const isLoading = templateLoading || masterLoading;

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

    if (templateError && templateId !== "create") {
        return (
            <Box sx={{ p: 3 }}>
                <Typography variant="h6" color="error" gutterBottom>
                    {t("messages.internal_emails_template_not_found", {
                        ns: "disputes",
                    })}
                </Typography>
                <Button
                    onClick={() => {
                        const locale = i18n.language === "he" ? "he" : "en";
                        router.push(
                            `/${locale}/app/settings?tab=dispute-reason`
                        );
                    }}
                    variant="outlined"
                >
                    {t("actions.internal_emails_back_to_templates", {
                        ns: "disputes",
                    })}
                </Button>
            </Box>
        );
    }

    // Check if user has view_templates permission
    if (userPermissionsData && !hasViewTemplatesPermission) {
        return (
            <Box sx={{ p: 3 }}>
                <Typography variant="h6" color="error" gutterBottom>
                    {t("messages.no_permission", {
                        ns: "common",
                        defaultValue:
                            "You do not have permission to view this page",
                    })}
                </Typography>
                <Button
                    onClick={() => {
                        const locale = i18n.language === "he" ? "he" : "en";
                        router.push(`/${locale}/app/settings`);
                    }}
                    variant="outlined"
                >
                    {t("actions.back", { ns: "common" })}
                </Button>
            </Box>
        );
    }

    const templateName =
        template?.name ||
        masterTemplate?.name ||
        getTemplateTypeLabel(templateType || "", t);
    const pageTitle = `${t("actions.internal_emails_edit_template_title", { ns: "disputes" })} - ${templateName}`;

    return (
        <Box sx={{ p: theme.spacing(3) }}>
            <Seo title={pageTitle} />

            {/* Breadcrumbs */}
            <Breadcrumbs sx={{ mb: theme.spacing(3) }}>
                <Link
                    component="button"
                    variant="body1"
                    onClick={() => {
                        const locale = i18n.language === "he" ? "he" : "en";
                        router.push(`/${locale}/app/settings`);
                    }}
                    sx={{
                        textDecoration: "none",
                        color: theme.palette.primary.main,
                    }}
                >
                    {t("fields.title")}
                </Link>
                <Link
                    component="button"
                    variant="body1"
                    onClick={() =>
                        router.push("/app/settings?tab=dispute-reason")
                    }
                    sx={{
                        textDecoration: "none",
                        color: theme.palette.primary.main,
                    }}
                >
                    {t("sections.internal_emails_title", { ns: "disputes" })}
                </Link>
                <Typography color="text.primary">
                    {t("actions.internal_emails_edit_template_title", {
                        ns: "disputes",
                    })}
                </Typography>
            </Breadcrumbs>

            {/* Header */}
            <PageHeader
                title={pageTitle}
                description={t("messages.internal_emails_edit_description", {
                    templateName: templateName.toLowerCase(),
                    ns: "disputes",
                })}
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
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            <Button
                                onClick={() =>
                                    router.push("/app/settings?tab=dispute-reason")
                                }
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
                                disabled={
                                    isSubmitting ||
                                    isSendingTestEmail ||
                                    templateId === "create"
                                }
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

            {/* Form */}
            <Paper
                sx={{
                    p: theme.spacing(3),
                    mb: theme.spacing(3),
                    backgroundColor: theme.palette.background.paper,
                    borderRadius: theme.shape.borderRadius,
                    boxShadow: theme.shadows[1],
                }}
            >
                <Typography
                    variant="h6"
                    sx={{
                        mb: theme.spacing(3),
                        color: theme.palette.primary.main,
                        textAlign: i18n.language === "he" ? "right" : "left",
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                    }}
                >
                    {t("messages.internal_emails_template_information", {
                        ns: "disputes",
                    })}
                </Typography>

                <TextField
                    fullWidth
                    label={t("fields.internal_emails_email_subject", {
                        ns: "disputes",
                    })}
                    value={formData.subject}
                    onChange={(e) =>
                        setFormData({ ...formData, subject: e.target.value })
                    }
                    helperText={`${formData.subject?.length || 0} / 160 ${t("fields.characters", { ns: "common" })}`}
                    disabled={!hasEditTemplatesPermission}
                    sx={{
                        mb: theme.spacing(3),
                        "& .MuiOutlinedInput-root": {
                            backgroundColor: theme.palette.background.paper,
                            borderRadius: theme.shape.borderRadius,
                        },
                        "& .MuiInputLabel-root": {
                            color: theme.palette.text.secondary,
                        },
                        "& .MuiOutlinedInput-input": {
                            color: theme.palette.text.primary,
                        },
                    }}
                    size="small"
                    inputProps={{
                        maxLength: 160,
                    }}
                />

                <Typography
                    variant="body2"
                    sx={{
                        mb: theme.spacing(1),
                        fontWeight: theme.typography.fontWeightMedium,
                        textAlign: i18n.language === "he" ? "right" : "left",
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                    }}
                >
                    {t("fields.internal_emails_email_content", {
                        ns: "disputes",
                    })}{" "}
                    <Box
                        component="span"
                        sx={{ color: theme.palette.error.main }}
                    >
                        *
                    </Box>
                </Typography>
                <InternalEmailEditor
                    value={formData.content}
                    onChange={(content: string) =>
                        setFormData({ ...formData, content })
                    }
                    disabled={!hasEditTemplatesPermission}
                />
            </Paper>
        </Box>
    );
}
