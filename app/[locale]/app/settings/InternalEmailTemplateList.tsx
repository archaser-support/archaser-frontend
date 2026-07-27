"use client";
import { apiFetch } from "@/utils/apiFetch";

import {
    Box,
    Typography,
    Paper,
    Chip,
    CircularProgress,
    Alert,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { formatDate } from "@/utils/datetimeOperations";

interface InternalEmailTemplate {
    id: number;
    type: string;
    subject: string;
    content: string;
    created_at?: string;
    modified_at?: string;
}

const TEMPLATE_TYPES = [
    {
        key: "dispute_assignment",
    },
];

const InternalEmailTemplateList: React.FC<{ accountId: number }> = () => {
    const { t } = useTranslation(["disputes", "common"]);
    const theme = useTheme();
    const router = useRouter();
    const { data: session } = useSession();

    const {
        data: templates,
        isLoading,
        error,
    } = useQuery<InternalEmailTemplate[]>({
        queryKey: ["internalEmailTemplates"],
        queryFn: async () => {
            const res = await apiFetch("/api/internalEmailTemplates");
            if (!res.ok) {
                throw new Error(`Failed to fetch templates: ${res.status}`);
            }
            return res.json();
        },
    });

    const handleEditTemplate = useCallback((templateType: string, templateId?: number) => {
        const url = templateId
            ? `/app/settings/internal-email-templates/${templateId}?type=${templateType}`
            : `/app/settings/internal-email-templates/create?type=${templateType}`;
        router.push(url);
    }, [router]);

    if (isLoading) {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: 400,
                }}
            >
                <CircularProgress color="primary" size={40} />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                        {t("messages.internal_emails_error_loading", { ns: "disputes" })}: {error.message}
                    </Typography>
                </Alert>
                <Typography variant="body2" color="text.secondary">
                    {t("messages.internal_emails_error_help", { ns: "disputes" })}
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            {/* Description */}
            <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                    mb: { xs: 2, sm: 3 },
                    px: { xs: 1.5, sm: 3 },
                    fontSize: {
                        xs: theme.typography.caption.fontSize,
                        sm: theme.typography.body2.fontSize,
                    },
                    lineHeight: 1.5,
                }}
            >
                {t("sections.internal_emails_description", { ns: "disputes" })}
            </Typography>

            {/* Templates Grid */}
            <Box
                sx={{
                    display: "grid",
                    gap: 3,
                    gridTemplateColumns: {
                        xs: "1fr",
                        md: "repeat(2, 1fr)",
                        lg: "repeat(2, 1fr)",
                    },
                }}
            >
                {TEMPLATE_TYPES.map((templateType) => {
                    const template = Array.isArray(templates)
                        ? templates.find((t) => t.type === templateType.key)
                        : undefined;

                    return (
                        <Paper
                            key={templateType.key}
                            elevation={1}
                            sx={{
                                p: 3,
                                border: "1px solid",
                                borderColor: "divider",
                                borderRadius: 2,
                                transition: "all 0.2s ease-in-out",
                                "&:hover": {
                                    elevation: 3,
                                    transform: "translateY(-2px)",
                                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                                },
                            }}
                        >
                            {/* Template Status */}
                            <Box sx={{ mb: 2 }}>
                                {template ? (
                                    <Box>
                                        <Typography
                                            variant="body2"
                                            color="text.primary"
                                            sx={{ fontWeight: 500 }}
                                        >
                                            {t("fields.internal_emails_subject", { ns: "disputes" })}: {template.subject}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                        >
                                            {t("tooltips.last_modified", { ns: "disputes" })}:{" "}
                                            {template.modified_at ||
                                                template.created_at
                                                ? formatDate(
                                                    template.modified_at || template.created_at!,
                                                    null,
                                                    session
                                                )
                                                : t("common.unknown", { ns: "common" })}
                                        </Typography>
                                    </Box>
                                ) : (
                                    <Box>
                                        <Chip
                                            label={t("tooltips.internal_emails_using_default", { ns: "disputes" })}
                                            size="small"
                                            variant="outlined"
                                            sx={{
                                                mb: 1,
                                                borderColor: theme.palette.chartPalette.main,
                                                color: theme.palette.chartPalette.main,
                                            }}
                                        />
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            fontStyle="italic"
                                        >
                                            {t("messages.internal_emails_no_template", { ns: "disputes" })}
                                        </Typography>
                                    </Box>
                                )}
                            </Box>

                            {/* Action Button */}
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "flex-end",
                                }}
                            >
                                <Typography
                                    variant="body2"
                                    color="primary.main"
                                    sx={{
                                        cursor: "pointer",
                                        fontWeight: 500,
                                        "&:hover": {
                                            textDecoration: "underline",
                                        },
                                    }}
                                    onClick={() =>
                                        handleEditTemplate(
                                            templateType.key,
                                            template?.id
                                        )
                                    }
                                >
                                    {template
                                        ? t("actions.internal_emails_edit_template")
                                        : t("actions.internal_emails_create_template")}
                                </Typography>
                            </Box>
                        </Paper>
                    );
                })}
            </Box>
        </Box>
    );
};

export default InternalEmailTemplateList;
