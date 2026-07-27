"use client";

import { Box, CircularProgress, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import api from "@/app/api";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import InternalPageWrapper from "@/components/InternalPageWrapper";
import PageHeader from "@/components/PageHeader";
import ReportViewer from "@/components/reports/ReportViewer";
import ShareReportModal from "@/components/reports/ShareReportModal";
import { MAIN_REPORTS_MENU_CONTEXT } from "@/shared/utils/viewConfigs";
import AppUrls from "@/utils/appUrls";
import { normalizeReportMetadataTables } from "@/utils/reportTableUtils";

const ReportViewerPage: React.FC = () => {
    const { t } = useTranslation(["reports", "common"]);
    const router = useRouter();
    const theme = useTheme();
    const params = useParams();
    const locale = (params?.locale as string) || "en";
    const reportId = params?.id ? parseInt(params.id as string, 10) : NaN;
    const { data: session, status: sessionStatus } = useSession();
    const [shareModalOpen, setShareModalOpen] = useState(false);

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
        enabled: sessionStatus === "authenticated" && !!session?.user,
    });

    const userPermissions = userPermissionsData?.permissions || [];
    const hasEditReportPermission = userPermissions.includes("edit_report");
    const hasShareReportPermission = userPermissions.includes("share_report");
    const hasExportReportPermission = userPermissions.includes("export_report");

    // Fetch report
    const {
        data: reportData,
        isLoading,
        status,
        fetchStatus,
        error: reportError,
    } = useQuery({
        queryKey: ["report", reportId],
        queryFn: async () => {
            const response = await api.get(`/api/reports/${reportId}`);
            return response.data.report;
        },
        enabled: !isNaN(reportId),
    });

    // Fetch metadata for field labels
    const { data: metadata } = useQuery({
        queryKey: ["reportMetadata"],
        queryFn: async () => {
            try {
                const response = await api.get("/api/reports/metadata");
                return response.data;
            } catch (error: any) {
                const errorMessage = error.response?.data?.error
                    || error.message
                    || "Failed to fetch report metadata";
                console.error("[ReportViewer] Error fetching metadata:", {
                    message: errorMessage,
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    url: error.config?.url,
                });
                throw new Error(errorMessage);
            }
        },
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    const allTables = useMemo(
        () => normalizeReportMetadataTables(metadata),
        [metadata]
    );

    if (isLoading) {
        return (
            <InternalPageWrapper>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: { xs: "300px", sm: "400px" },
                        px: { xs: 2, sm: 3 },
                    }}
                >
                    <CircularProgress color="primary" size={48} />
                </Box>
            </InternalPageWrapper>
        );
    }

    if (!reportData) {
        return (
            <InternalPageWrapper>
                <Box sx={{ p: 3 }}>
                    <Typography color="error">
                        {t("messages.report_not_found")}
                    </Typography>
                </Box>
            </InternalPageWrapper>
        );
    }

    // Shell matches CustomerList: header + content area without flex/minHeight
    // so fillViewport grid height measures after layout like the customers grid.
    return (
        <InternalPageWrapper>
            <Box
                sx={{
                    bgcolor: "background.default",
                    borderRadius: theme.shape.borderRadius,
                }}
            >
                <PageHeader
                    title={reportData.name}
                    description={reportData.description}
                />

                <Box
                    sx={{
                        position: "relative",
                        isolation: "isolate",
                        width: "100%",
                        maxWidth: "100%",
                        overflowX: "hidden",
                        boxSizing: "border-box",
                    }}
                >
                    <ReportViewer
                        reportId={reportId}
                        reportName={reportData.name}
                        reportConfig={reportData.report_config}
                        allTables={allTables}
                        hasEditReportPermission={hasEditReportPermission}
                        hasShareReportPermission={hasShareReportPermission}
                        hasExportReportPermission={hasExportReportPermission}
                        isSystemReport={reportData.is_system === true}
                        onEditClick={() => {
                            router.push(
                                `/${locale}${AppUrls.REPORT_BUILDER}?id=${reportId}&context=${MAIN_REPORTS_MENU_CONTEXT}`
                            );
                        }}
                        onShareClick={() => {
                            setShareModalOpen(true);
                        }}
                    />
                </Box>

                <ShareReportModal
                    open={shareModalOpen}
                    onClose={() => setShareModalOpen(false)}
                    reportId={reportId}
                    reportName={reportData.name}
                    accountId={
                        (session?.user as any)?.view_as_user_account_id ||
                        session?.user?.account_id ||
                        0
                    }
                />
            </Box>
        </InternalPageWrapper>
    );
};

export default ReportViewerPage;
