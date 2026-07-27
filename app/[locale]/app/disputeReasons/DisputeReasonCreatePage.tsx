"use client";
import { apiFetch } from "@/utils/apiFetch";

import {
    Box,
    Paper,
    Typography,
    Button,
    Breadcrumbs,
    Link,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

import Seo from "@/shared/layout-components/seo/seo";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";

import DisputeReasonForm, { DisputeReason } from "./DisputeReasonForm";

interface DisputeReasonCreatePageProps {
    backUrl: string;
}

export default function DisputeReasonCreatePage({
    backUrl,
}: DisputeReasonCreatePageProps) {
    const { t, i18n } = useTranslation(["disputes", "settings", "common"]);
    const theme = useTheme();
    const { data: session } = useSession();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    const accountId = session?.user?.account_id || 0;

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [hasValidated, setHasValidated] = useState(false);
    const [formData, setFormData] = useState<DisputeReason>({
        id: 0,
        name: "",
        status: "Active",
        account_id: accountId,
        editable: true,
        master_template: false,
        languageTemplates: [
            {
                language: "English",
                name: "",
            },
        ],
    });

    // Create mutation
    const createMutation = useMutation({
        mutationFn: async (data: DisputeReason) => {
            const requestBody = {
                ...data,
                account_id: accountId,
            };

            const response = await apiFetch("/api/operations/dispute-reasons", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to create dispute reason"
                );
            }

            const result = await response.json();
            return result;
        },
        onSuccess: (_data) => {
            // Remove queries from cache to force fresh fetch
            queryClient.removeQueries({
                queryKey: ["dispute-reasons-virtual"],
                exact: false,
            });
            // Invalidate to mark as stale
            queryClient.invalidateQueries({
                queryKey: ["dispute-reasons-virtual"],
                exact: false,
                refetchType: "active",
            });
            // Refetch all matching queries
            queryClient.refetchQueries({
                queryKey: ["dispute-reasons-virtual"],
                exact: false,
                type: "all",
            });
            showToast(
                t("messages.reasons_create_success", { ns: "disputes" }),
                "success"
            );
            // Small delay to ensure query invalidation is processed
            setTimeout(() => {
                router.push(backUrl);
            }, 100);
        },
        onError: (error: Error) => {
            console.error("Error creating dispute reason:", error);
            showToast(
                t("messages.reasons_create_error", { ns: "disputes" }),
                "error"
            );
        },
    });

    const handleSubmit = useCallback(async () => {
        setHasValidated(true);
        setErrors({});

        // Validate form data
        const newErrors: Record<string, string> = {};

        // Validate that at least one language template has a name
        const hasValidLanguage = formData.languageTemplates?.some(
            (template) => template.name && template.name.trim().length > 0
        );

        if (!hasValidLanguage) {
            newErrors.languageTemplates = t(
                "validation.name_required_for_language",
                { ns: "disputes" }
            );
        }

        // Validate individual language templates
        formData.languageTemplates?.forEach((template, index) => {
            if (template.name && template.name.trim().length > 0) {
                if (template.name.trim().length < 2) {
                    newErrors[`language_${index}`] = t("validation.minLength", {
                        ns: "common",
                        count: 2,
                    });
                } else if (template.name.trim().length > 100) {
                    newErrors[`language_${index}`] = t("validation.maxLength", {
                        ns: "common",
                        count: 100,
                    });
                }
            }
        });

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setIsSubmitting(true);
        try {
            await createMutation.mutateAsync(formData);
        } catch (error) {
            console.error("Error submitting form:", error);
        } finally {
            setIsSubmitting(false);
        }
    }, [formData, createMutation, t]);

    const handleCancel = useCallback(() => {
        router.push(backUrl);
    }, [router, backUrl]);

    const isLoading = isSubmitting || createMutation.isPending;

    return (
        <Box sx={{ p: 3 }}>
            <Seo title={t("actions.reasons_add", { ns: "disputes" })} />

            {/* Breadcrumbs */}
            <Breadcrumbs sx={{ mb: 3 }}>
                <Link
                    component="button"
                    variant="body1"
                    onClick={() => router.push("/app/settings")}
                    sx={{ textDecoration: "none", color: "primary.main" }}
                >
                    {t("fields.title", { ns: "settings" })}
                </Link>
                <Link
                    component="button"
                    variant="body1"
                    onClick={() => router.push(backUrl)}
                    sx={{ textDecoration: "none", color: "primary.main" }}
                >
                    {t("fields.tab_dispute_reason", { ns: "settings" })}
                </Link>
                <Typography color="text.primary">
                    {t("actions.reasons_add", { ns: "disputes" })}
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
                    <Box
                        sx={{
                            textAlign:
                                i18n.language === "he" ? "right" : "left",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        }}
                    >
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
                            {t("actions.reasons_add", { ns: "disputes" })}
                        </Typography>

                        <Typography
                            variant="body1"
                            color="text.secondary"
                            fontWeight={500}
                        >
                            {t("sections.reasons_description", {
                                ns: "disputes",
                            })}
                        </Typography>
                    </Box>
                </Box>
            </Paper>

            {/* Form */}
            <DisputeReasonForm
                formData={formData}
                setFormData={setFormData}
                errors={errors}
                hasValidated={hasValidated}
                setErrors={setErrors}
                disabled={isLoading}
            />

            {/* Actions */}
            <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
                <Button
                    onClick={handleCancel}
                    variant="outlined"
                    size="large"
                    disabled={isLoading}
                >
                    {t("actions.cancel", { ns: "common" })}
                </Button>
                <Button
                    onClick={isLoading ? undefined : handleSubmit}
                    variant="contained"
                    fullWidth={false}
                    className="save-button"
                    disabled={isLoading}
                >
                    {t("actions.save", { ns: "common" })}
                </Button>
            </Box>
        </Box>
    );
}
