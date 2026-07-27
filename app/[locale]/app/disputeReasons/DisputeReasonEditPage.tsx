"use client";
import { apiFetch } from "@/utils/apiFetch";

import {
    Box,
    Paper,
    Typography,
    Button,
    CircularProgress,
    Breadcrumbs,
    Link,
    Stack,
} from "@mui/material";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import { useTheme } from "@mui/material/styles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import React, { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

import Seo from "@/shared/layout-components/seo/seo";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import PageHeader from "@/components/PageHeader";

import DisputeReasonForm, { DisputeReason } from "./DisputeReasonForm";

interface DisputeReasonEditPageProps {
    disputeReasonId: number;
    backUrl: string;
}

export default function DisputeReasonEditPage({
    disputeReasonId,
    backUrl,
}: DisputeReasonEditPageProps) {
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
        id: disputeReasonId,
        name: "",
        status: "Active",
        account_id: accountId,
        editable: true,
        master_template: false,
        languageTemplates: [],
    });

    // Fetch dispute reason data
    const { data: disputeReasonData, isLoading: isLoadingData } = useQuery({
        queryKey: ["dispute-reason", disputeReasonId],
        queryFn: async () => {
            const response = await apiFetch(`/api/operations/dispute-reasons/${disputeReasonId}`
            );
            if (!response.ok) {
                throw new Error("Failed to fetch dispute reason");
            }
            return response.json();
        },
    });

    // Update form data when data is loaded
    useEffect(() => {
        if (disputeReasonData) {
            setFormData({
                id: disputeReasonData.id,
                name: disputeReasonData.name,
                status: disputeReasonData.status,
                account_id: disputeReasonData.account_id,
                editable: disputeReasonData.editable,
                master_template: disputeReasonData.master_template,
                languageTemplates:
                    disputeReasonData.DisputeReasonLanguage || [],
            });
        }
    }, [disputeReasonData]);

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: async (data: DisputeReason) => {
            const response = await apiFetch(`/api/operations/dispute-reasons/${disputeReasonId}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        ...data,
                        account_id: accountId,
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to update dispute reason"
                );
            }
            return response.json();
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
            // Also invalidate the specific dispute reason query
            queryClient.invalidateQueries({
                queryKey: ["dispute-reason", disputeReasonId],
            });
            showToast(
                t("messages.reasons_update_success", { ns: "disputes" }),
                "success"
            );
        },
        onError: (error: Error) => {
            showToast(
                t("messages.reasons_update_error", { ns: "disputes" }),
                "error"
            );
            console.error("Error updating dispute reason:", error);
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
            await updateMutation.mutateAsync(formData);
            // Redirect after successful mutation
            router.push(backUrl);
        } catch (error) {
            console.error("Error submitting form:", error);
        } finally {
            setIsSubmitting(false);
        }
    }, [formData, updateMutation, t, router, backUrl]);

    const handleCancel = useCallback(() => {
        router.push(backUrl);
    }, [router, backUrl]);

    const isLoading = isSubmitting || updateMutation.isPending || isLoadingData;

    if (isLoadingData) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Seo title={t("actions.reasons_edit", { ns: "disputes" })} />

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
                    {t("actions.reasons_edit", { ns: "disputes" })}
                </Typography>
            </Breadcrumbs>

            {/* Header */}
            <PageHeader
                title={t("actions.reasons_edit", { ns: "disputes" })}
                description={t("sections.reasons_description", {
                    ns: "disputes",
                })}
            >
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
                        className="edit-action-button-group"
                        sx={{
                            direction:
                                i18n.language === "he" ? "rtl" : "ltr",
                        }}
                    >
                        <Button
                            onClick={handleCancel}
                            variant="outlined"
                            className="cancel-button"
                            disabled={isLoading}
                        >
                            {t("actions.cancel", { ns: "common" })}
                        </Button>
                        <Button
                            onClick={isLoading ? undefined : handleSubmit}
                            variant="contained"
                            className="save-button"
                            disabled={isLoading}
                        >
                            {t("actions.save", { ns: "common" })}
                        </Button>
                    </Stack>
                </Box>
            </PageHeader>

            {/* Form */}
            <DisputeReasonForm
                formData={formData}
                setFormData={setFormData}
                errors={errors}
                hasValidated={hasValidated}
                setErrors={setErrors}
                disabled={isLoading}
            />
        </Box>
    );
}
