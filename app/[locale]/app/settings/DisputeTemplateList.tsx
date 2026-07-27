"use client";

import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import DescriptionIcon from "@mui/icons-material/Description";
import {
    Chip,
    Tooltip,
    Box,
    Typography,
    IconButton,
    CircularProgress,
    Link as MuiLink,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
    GridColDef,
    GridSortModel,
} from "@mui/x-data-grid";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api, { apiFetch } from "@/app/api";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import EndlessScrollDataGrid, {
    useVirtualInfiniteScroll,
    createQueryFn,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { ExportFormat } from "@/shared/utility/exportToExcel";
import {
    formatDateForDisplay,
} from "@/utils/datetimeOperations";

interface ActivityTemplateRow {
    id: number;
    name: string;
    category: string | null;
    language: string | null;
    sms_content: string | null;
    whatsapp_content: string | null;
    email_subject: string | null;
    email_content: string | null;
    active: boolean | null;
    modified_at?: string;
    created_at?: string;
}

interface DisputeTemplateListProps {
    accountId: number;
}

const DisputeTemplateList: React.FC<DisputeTemplateListProps> = ({
    accountId,
}) => {
    const { t, i18n } = useTranslation([
        "disputes",
        "common",
        "activity_templates",
    ]);
    const theme = useTheme();
    const router = useRouter();
    const { showToast } = useToast();
    const { data: session } = useSession();
    const queryClient = useQueryClient();
    const [deleteConfirmation, setDeleteConfirmation] = useState<{
        isOpen: boolean;
        id: number | null;
    }>({
        isOpen: false,
        id: null,
    });
    const [sortModel, setSortModel] = useState<GridSortModel>([
        { field: "name", sort: "asc" },
    ]);
    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search, 500);
    const [queryKeyVersion, setQueryKeyVersion] = useState(0);

    const sortField = sortModel[0]?.field;
    const sortDirection = sortModel[0]?.sort || "asc";

    // Query key - all parameters in a single object
    const queryKey = useMemo(
        () => [
            "activityTemplates",
            {
                search: debouncedSearch,
                category: "Dispute",
                active: "",
                sortField,
                sortDirection,
                version: queryKeyVersion,
            },
        ],
        [debouncedSearch, sortField, sortDirection, queryKeyVersion]
    );

    // Use createQueryFn for fetch-based GET requests
    const { data, totalRecords, isLoading, hasMore, loadMore, reset, error } =
        useVirtualInfiniteScroll({
            queryKey,
            queryFn: createQueryFn(
                "/api/activities/templates",
                {
                    search: debouncedSearch,
                    category: "Dispute",
                    active: "",
                    sortField: sortField || "",
                    sortDirection: sortDirection || "asc",
                },
                "templates" // Response key containing data array
            ),
        });

    // Reset logic - prevent unnecessary resets on initial mount
    const prevDebouncedSearchRef = useRef(debouncedSearch);
    const prevQueryKeyVersionRef = useRef(queryKeyVersion);
    const isInitialMountRef = useRef(true);

    useEffect(() => {
        const searchChanged = prevDebouncedSearchRef.current !== debouncedSearch;

        if (searchChanged) {
            prevDebouncedSearchRef.current = debouncedSearch;
            setQueryKeyVersion((prev) => prev + 1);
        }
    }, [debouncedSearch]);

    // Reset when queryKeyVersion changes (but not on initial mount)
    // Note: queryKeyVersion is already in the queryKey, so changing it will trigger a new query automatically
    // We only need to call reset() when search changes, not when queryKeyVersion changes
    useEffect(() => {
        if (isInitialMountRef.current) {
            isInitialMountRef.current = false;
            prevQueryKeyVersionRef.current = queryKeyVersion;
            return;
        }

        // Only reset if queryKeyVersion changed due to search change
        // The queryKey change will automatically trigger a new query
        if (prevQueryKeyVersionRef.current !== queryKeyVersion) {
            prevQueryKeyVersionRef.current = queryKeyVersion;
            // Don't call reset() here - the queryKey change is enough
            // reset() would invalidate queries, causing a loop
        }
    }, [queryKeyVersion]);

    // Transform API data to grid row format
    const mapTemplateToRow = useCallback((template: any) => {
        return {
            id: template.id,
            name: template.name || "",
            category: template.category,
            language: template.language,
            sms_content: template.sms_content,
            whatsapp_content: template.whatsapp_content,
            email_subject: template.email_subject,
            email_content: template.email_content,
            active: template.active,
            modified_at: template.modified_at,
            User_ActivitiesTemplate_modified_byToUser:
                template.User_ActivitiesTemplate_modified_byToUser,
            created_at: template.created_at,
            User_ActivitiesTemplate_created_byToUser:
                template.User_ActivitiesTemplate_created_byToUser,
            raw: template,
        };
    }, []);

    // Transform rows - use useMemo
    const rows = useMemo(() => {
        return data.map(mapTemplateToRow);
    }, [data, mapTemplateToRow]);

    // Export handler for dispute templates - moved after rows definition
    const handleExport = useCallback(
        async (
            selectedColumns: string[],
            fileName: string,
            format: ExportFormat
        ) => {
            try {
                // Use the existing rows data instead of making a new API call
                const rawTemplates = rows || [];

                const transformedTemplates = rawTemplates.map(
                    (template: any) => {
                        // Format languages
                        const languages = template.languages || [];
                        const languageNames = languages
                            .map((lang: any) => lang.name || lang)
                            .join(", ");

                        // Format modified date
                        const modifiedAt = template.modified_at
                            ? new Date(
                                  template.modified_at
                              ).toLocaleDateString()
                            : "";

                        return {
                            id: template.id,
                            name: template.name,
                            languages: languageNames,
                            modified_at: modifiedAt,
                            active: template.active,
                            raw: template,
                        };
                    }
                );

                return transformedTemplates;
            } catch (error) {
                console.error("Export failed:", error);
                throw error;
            }
        },
        [rows]
    );

    const handleStatusToggle = async (id: number, currentStatus: boolean) => {
        try {
            if (currentStatus) {
                const checkResponse = await apiFetch(`/api/activities/templates/${id}/check-usage`,
                    {
                        method: "GET",
                        headers: { Accept: "application/json" },
                    }
                );

                if (!checkResponse.ok) {
                    throw new Error(
                        t(
                            "activityTemplates.error.error_checking_template_usage"
                        )
                    );
                }

                const { isInUse, activeSequencesCount } =
                    await checkResponse.json();
                if (isInUse) {
                    showToast(
                        t(
                            "messages.activity_templates_delete_language_warning",
                            { ns: "activity_templates" }
                        ),
                        "error"
                    );
                    return;
                }
            }

            const response = await apiFetch(`/api/activities/templates/${id}/toggle`,
                {
                    method: "PUT",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                }
            );

            if (!response.ok) {
                throw new Error(
                    t(
                        "messages.activity_templates_error_error_updating_status",
                        { ns: "activity_templates" }
                    )
                );
            }

            showToast(
                t("messages.activity_templates_success_template_updated", {
                    ns: "activity_templates",
                }),
                "success"
            );
            // Reset accumulated rows to refresh the list
            setQueryKeyVersion((prev) => prev + 1);
            reset();
        } catch (error: any) {
            showToast(
                error.message ||
                    t("activity_templates_error_error_updating_status"),
                "error"
            );
        }
    };

    const handleDelete = async (id: number) => {
        setDeleteConfirmation({ isOpen: true, id });
    };

    const confirmDelete = async () => {
        if (!deleteConfirmation.id) return;

        try {
            const template = rows.find(
                (t: any) => t.id === deleteConfirmation.id
            );
            if (template?.active) {
                showToast(
                    t("actions.activity_templates_cannot_delete_active", {
                        ns: "activity_templates",
                    }),
                    "error"
                );
                setDeleteConfirmation({ isOpen: false, id: null });
                return;
            }

            const checkResponse = await apiFetch(`/api/activities/templates/${deleteConfirmation.id}/check-usage`,
                {
                    method: "GET",
                    headers: { Accept: "application/json" },
                }
            );

            if (!checkResponse.ok) {
                throw new Error(
                    t(
                        "messages.activity_templates_error_error_checking_template_usage",
                        { ns: "activity_templates" }
                    )
                );
            }

            const { isInUse, activeSequencesCount } =
                await checkResponse.json();
            if (isInUse) {
                showToast(
                    t("activityTemplates.template_in_use_error", {
                        count: activeSequencesCount,
                    }),
                    "error"
                );
                setDeleteConfirmation({ isOpen: false, id: null });
                return;
            }

            const response = await apiFetch(`/api/activities/templates/${deleteConfirmation.id}/delete`,
                {
                    method: "DELETE",
                    headers: { Accept: "application/json" },
                }
            );

            if (!response.ok) {
                throw new Error(
                    t("activity_templates_error_error_checking_template_usage")
                );
            }

            showToast(
                t(
                    "actions.activity_templates_activity_template_deleted_success",
                    { ns: "activity_templates" }
                ),
                "success"
            );
            setDeleteConfirmation({ isOpen: false, id: null });
            setQueryKeyVersion((prev) => prev + 1);
            reset();
        } catch (error: any) {
            showToast(
                error.message ||
                    t("activity_templates_error_error_checking_template_usage"),
                "error"
            );
        }
    };

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

    const disputeTemplates = useMemo(() => {
        // Filter for Dispute templates only
        return rows.filter((template) => template.category === "Dispute");
    }, [rows]);

    // Add Dispute Template Button Component
    const AddDisputeTemplateButton = React.memo(() => {
        const { t, i18n } = useTranslation([
            "disputes",
            "common",
            "activity_templates",
        ]);
        const theme = useTheme();

        if (!hasEditTemplatesPermission) {
            return null;
        }

        return (
            <Tooltip
                title={t("actions.templates_add", { ns: "disputes" })}
                arrow
                enterDelay={300}
                leaveDelay={100}
                placement="bottom"
                PopperProps={{
                    sx: {
                        "& .MuiTooltip-tooltip": {
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        },
                        "& .MuiTooltip-arrow": {
                            ...(i18n.language === "he" && {
                                transform: "scaleX(-1)",
                            }),
                        },
                    },
                }}
            >
                <IconButton
                    color="primary"
                    size="small"
                    onClick={() => {
                        const locale = i18n.language === "he" ? "he" : "en";
                        // Always use the dispute tab URL as backUrl
                        const backUrl = `/${locale}/app/settings?tab=templates&templateType=dispute`;
                        router.push(
                            `/${locale}/app/settings/dispute-templates/create?backUrl=${encodeURIComponent(backUrl)}`
                        );
                    }}
                    className="toolbar-button"
                >
                    <Box
                        sx={{
                            position: "relative",
                            display: "inline-flex",
                        }}
                    >
                        <DescriptionIcon />
                        <AddIcon
                            sx={{
                                position: "absolute",
                                right: theme.spacing(-0.5),
                                bottom: theme.spacing(-0.5),
                                fontSize: theme.typography.caption.fontSize,
                                backgroundColor: theme.palette.primary.main,
                                color: theme.palette.primary.contrastText,
                                borderRadius: theme.shape.borderRadius,
                                padding: theme.spacing(0.25),
                            }}
                        />
                    </Box>
                </IconButton>
            </Tooltip>
        );
    });

    AddDisputeTemplateButton.displayName = "AddDisputeTemplateButton";

    const customButtons = <AddDisputeTemplateButton />;

    const columns: GridColDef[] = useMemo(
        () => [
            {
                field: "name",
                headerName: t("fields.activity_templates_name", {
                    ns: "activity_templates",
                }),
                flex: 1,
                minWidth: 200,
                renderCell: (params) => {
                    const templateId = params.row.id;
                    const locale = i18n.language === "he" ? "he" : "en";
                    // Always use the dispute tab URL as backUrl
                    const backUrl = `/${locale}/app/settings?tab=templates&templateType=dispute`;
                    const templateUrl = `/${locale}/app/settings/dispute-templates/${templateId}?backUrl=${encodeURIComponent(backUrl)}`;
                    return (
                        <MuiLink
                            component={Link}
                            href={templateUrl}
                            sx={{
                                textDecoration: "underline",
                                textUnderlineOffset: "0.125em",
                                color: "primary.main",
                                "&:hover": {
                                    textDecoration: "underline",
                                    color: "primary.dark",
                                },
                                cursor: "pointer",
                            }}
                        >
                            <Typography
                                variant="body2"
                                sx={{
                                    color: "inherit",
                                    fontSize: theme.typography.body2.fontSize,
                                }}
                            >
                                {params.value ||
                                    t(
                                        "fields.activity_templates_unnamed_template",
                                        { ns: "activity_templates" }
                                    )}
                            </Typography>
                        </MuiLink>
                    );
                },
            },
            {
                field: "modified_by",
                headerName: t("fields.modified_by", { ns: "common" }),
                flex: 1,
                minWidth: 150,
                renderCell: (params) => (
                    <Typography variant="body2">
                        {params.row.User_ActivitiesTemplate_modified_byToUser?.name ||
                            params.row.User_ActivitiesTemplate_modified_byToUser
                                ?.email ||
                            "-"}
                    </Typography>
                ),
            },
            {
                field: "modified_at",
                headerName: t("fields.modified_at", { ns: "common" }),
                flex: 0.8,
                minWidth: 150,
                renderCell: (params) => {
                    const modifiedAt = params.value;
                    if (!modifiedAt) {
                        return (
                            <Typography
                                sx={{
                                    fontSize: theme.typography.body2.fontSize,
                                }}
                            >
                                --
                            </Typography>
                        );
                    }

                    try {
                        const formattedDate = formatDateForDisplay(
                            modifiedAt,
                            "datetime",
                            session?.user?.locale,
                            session?.user?.timezone
                        );

                        return (
                            <Typography
                                sx={{
                                    fontSize: "0.875rem",
                                }}
                            >
                                {formattedDate}
                            </Typography>
                        );
                    } catch (error) {
                        return (
                            <Typography
                                sx={{
                                    fontSize: "0.875rem",
                                }}
                            >
                                --
                            </Typography>
                        );
                    }
                },
            },
            {
                field: "created_by",
                headerName: t("fields.created_by", { ns: "common" }),
                flex: 1,
                minWidth: 150,
                renderCell: (params) => (
                    <Typography variant="body2">
                        {params.row.User_ActivitiesTemplate_created_byToUser?.name ||
                            params.row.User_ActivitiesTemplate_created_byToUser
                                ?.email ||
                            "-"}
                    </Typography>
                ),
            },
            {
                field: "created_at",
                headerName: t("fields.created_at", { ns: "common" }),
                flex: 0.8,
                minWidth: 150,
                renderCell: (params) => {
                    const created_at = params.value;
                    if (!created_at) {
                        return (
                            <Typography sx={{ fontSize: "0.875rem" }}>
                                --
                            </Typography>
                        );
                    }
                    try {
                        const formattedDate = formatDateForDisplay(
                            created_at,
                            "datetime",
                            session?.user?.locale,
                            session?.user?.timezone
                        );
                        return (
                            <Typography sx={{ fontSize: "0.875rem" }}>
                                {formattedDate}
                            </Typography>
                        );
                    } catch {
                        return (
                            <Typography sx={{ fontSize: "0.875rem" }}>
                                --
                            </Typography>
                        );
                    }
                },
            },
            {
                field: "active",
                headerName: t("fields.status", { ns: "common" }),
                flex: 0.5,
                minWidth: 100,
                renderCell: (params) => {
                    const isActive = params.value === true;
                    return (
                        <Chip
                            label={
                                isActive
                                    ? t("values.status_active", {
                                          ns: "common",
                                      })
                                    : t("values.status_inactive", {
                                          ns: "common",
                                      })
                            }
                            size="small"
                            data-status={isActive ? "active" : "inactive"}
                        />
                    );
                },
            },
            {
                field: "actions",
                headerName: t("actions.activity_templates_actions", {
                    ns: "activity_templates",
                }),
                sortable: false,
                width: 80,
                renderCell: (params) => (
                    <Box sx={{ display: "flex", gap: theme.spacing(0.5) }}>
                        <Tooltip
                            title={
                                params.row.active
                                    ? t(
                                          "actions.activity_templates_cannot_delete_active",
                                          { ns: "activity_templates" }
                                      )
                                    : t("actions.delete", { ns: "common" })
                            }
                            arrow
                            placement="bottom"
                        >
                            <span>
                                <IconButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!params.row.active) {
                                            handleDelete(params.row.id);
                                        }
                                    }}
                                    disabled={params.row.active ?? false}
                                    color="primary"
                                    sx={{
                                        "&.Mui-disabled": {
                                            color: theme.palette.text.disabled,
                                        },
                                    }}
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Box>
                ),
            },
        ],
        [t, handleDelete, router, session, theme, i18n.language]
    );

    if (isLoading && rows.length === 0) {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: 400,
                }}
            >
                <CircularProgress size={40} />
            </Box>
        );
    }

    if (error) {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: 400,
                }}
            >
                <Typography color="error">
                    {t("messages.activity_templates_error_fetching_templates", {
                        ns: "activity_templates",
                    })}
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                    mb: { xs: 2, sm: 3 },
                    px: { xs: 1.5, sm: 3 },
                    fontSize: { xs: "0.75rem", sm: "0.875rem" },
                    lineHeight: 1.5,
                }}
            >
                {t("sections.templates_description", { ns: "disputes" })}
            </Typography>
            <Box
                sx={{
                    position: "relative",
                    isolation: "isolate",
                }}
            >
                <EndlessScrollDataGrid
                    key={`dispute-templates-${debouncedSearch}-${queryKeyVersion}`}
                    rows={disputeTemplates}
                    columns={columns}
                    totalRecords={totalRecords}
                    isLoading={isLoading}
                    onLoadMore={loadMore}
                    hasMore={hasMore}
                    sortModel={sortModel}
                    onSortModelChange={setSortModel}
                    customButtons={customButtons}
                    searchValue={search}
                    onSearchChange={setSearch}
                    searchPlaceholder={t("fields.search_placeholder", {
                        ns: "common",
                    })}
                    searchDebounceMs={500}
                    searchDirection={i18n.language === "he" ? "rtl" : "ltr"}
                    columnVisibilityModel={{
                        modified_at: window.innerWidth >= 1200,
                        created_by: window.innerWidth >= 1200,
                        created_at: window.innerWidth >= 1200,
                    }}
                    language={i18n.language}
                    fillViewport={true}
                    resizableColumns={true}
                    noRowsMessage={t("messages.templates_empty", {
                        ns: "disputes",
                    })}
                    noRowsDescription={t(
                        "messages.try_adjusting_your_filters",
                        { ns: "disputes" }
                    )}
                    onExport={handleExport}
                    exportContextInfo={{
                        pageName: "dispute_templates",
                        customPrefix: "dispute_templates_export",
                    }}
                />
            </Box>

            <DeleteDialog
                isOpen={deleteConfirmation.isOpen}
                onClose={() =>
                    setDeleteConfirmation({ isOpen: false, id: null })
                }
                onConfirm={confirmDelete}
                title={t("actions.activity_templates_delete_confirm_title", {
                    ns: "activity_templates",
                })}
                description={t(
                    "actions.activity_templates_delete_confirm_description",
                    { ns: "activity_templates" }
                )}
                confirmLabel={t(
                    "actions.activity_templates_delete_confirm_confirm",
                    { ns: "activity_templates" }
                )}
                cancelLabel={t(
                    "actions.activity_templates_delete_confirm_cancel",
                    { ns: "activity_templates" }
                )}
                isLoading={false}
                type="delete"
                maxWidth="sm"
                locale={i18n.language}
            />
        </Box>
    );
};

export default DisputeTemplateList;
