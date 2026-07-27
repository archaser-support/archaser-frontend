"use client";

import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import DescriptionIcon from "@mui/icons-material/Description";
import {
    Box,
    Chip,
    CircularProgress,
    IconButton,
    Tooltip,
    Typography,
    Link as MuiLink,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { GridColDef, GridSortModel } from "@mui/x-data-grid";
import { useQuery } from "@tanstack/react-query";
import api, { apiFetch } from "@/app/api";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import EndlessScrollDataGrid, {
    useVirtualInfiniteScroll,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import { GRID_CONSTANTS } from "@/shared/layout-components/grid/constants";
import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { ExportFormat } from "@/shared/utility/exportToExcel";
import {
    formatDateForDisplay
} from "@/utils/datetimeOperations";

const AutomatedTemplateList: React.FC<{ accountId?: number }> = ({ accountId: _accountId }) => {
    const { t, i18n } = useTranslation([
        "settings",
        "common",
        "activity_templates",
    ]);
    const theme = useTheme();
    const { data: session } = useSession();
    const { showToast } = useToast();
    const router = useRouter();
    const pathname = usePathname();

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

    const queryKey = useMemo(
        () => [
            "activityTemplates",
            {
                search: debouncedSearch,
                category: "",
                active: "",
                sortField,
                sortDirection,
                version: queryKeyVersion,
            },
        ],
        [debouncedSearch, sortField, sortDirection, queryKeyVersion]
    );

    const queryFn = useCallback(
        async (page: number = 1) => {
            const params = new URLSearchParams();
            params.set("page", page.toString());
            params.set("rowsPerPage", GRID_CONSTANTS.DEFAULT_PAGE_SIZE.toString());
            if (debouncedSearch) {
                params.set("query", debouncedSearch);
            }
            params.set("category", "Automated");
            params.set("sortField", sortField || "name");
            params.set("sortDirection", sortDirection);
            const response = await apiFetch(`/api/activities/templates?${params.toString()}`,
                {
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                }
            );
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const json = await response.json();
            const templates = json.templates || [];
            const total = json.totalRecords || 0;
            return {
                data: templates,
                totalRecords: total,
                hasMore:
                    templates.length > 0 &&
                    page <
                        Math.ceil(total / GRID_CONSTANTS.DEFAULT_PAGE_SIZE),
            };
        },
        [debouncedSearch, sortField, sortDirection]
    );

    const { data, totalRecords, isLoading, hasMore, loadMore, reset, error } =
        useVirtualInfiniteScroll({
            queryKey,
            queryFn,
            pageSize: GRID_CONSTANTS.DEFAULT_PAGE_SIZE,
        });

    const prevDebouncedSearchRef = useRef(debouncedSearch);
    const isInitialMountRef = useRef(true);
    const prevPathnameRef = useRef(pathname);

    useEffect(() => {
        const searchChanged = prevDebouncedSearchRef.current !== debouncedSearch;

        if (searchChanged) {
            prevDebouncedSearchRef.current = debouncedSearch;
            setQueryKeyVersion((prev) => prev + 1);
            reset();
        }
    }, [debouncedSearch, reset]);

    useEffect(() => {
        const pathnameChanged = prevPathnameRef.current !== pathname;
        const isSettingsPage = pathname?.includes("/settings");

        if (pathnameChanged && isSettingsPage && !isInitialMountRef.current) {
            const timeoutId = setTimeout(() => {
                setQueryKeyVersion((prev) => prev + 1);
                reset();
            }, 100);
            return () => clearTimeout(timeoutId);
        }

        prevPathnameRef.current = pathname;
    }, [pathname, reset]);

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

    const rows = useMemo(() => {
        return data.map(mapTemplateToRow);
    }, [data, mapTemplateToRow]);

    const handleExport = useCallback(
        async (
            _selectedColumns: string[],
            _fileName: string,
            _format: ExportFormat
        ) => {
            const rawTemplates = rows || [];
            return rawTemplates.map((template: any) => {
                const languages = template.languages || [];
                const languageNames = languages
                    .map((lang: any) => lang.name || lang)
                    .join(", ");
                const modifiedAt = template.modified_at
                    ? new Date(template.modified_at).toLocaleDateString()
                    : "";
                return {
                    id: template.id,
                    name: template.name,
                    languages: languageNames,
                    modified_at: modifiedAt,
                    active: template.active,
                    raw: template,
                };
            });
        },
        [rows]
    );

    const handleDelete = (id: number) => {
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
                    t("messages.template_in_use_error", {
                        count: activeSequencesCount,
                        ns: "activity_templates",
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
                    t(
                        "messages.activity_templates_error_error_deleting_activity_template",
                        { ns: "activity_templates" }
                    )
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
                t(
                    "messages.activity_templates_error_error_deleting_activity_template",
                    { ns: "activity_templates" }
                ),
                "error"
            );
        }
    };

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
                    const backUrl = `/${locale}/app/settings?tab=templates&templateType=automated`;
                    const templateUrl = `/${locale}/app/settings/automated-templates/${templateId}?backUrl=${encodeURIComponent(backUrl)}`;
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
                sortable: true,
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
                sortable: true,
                renderCell: (params) => {
                    const modifiedAt = params.value;
                    if (!modifiedAt) {
                        return (
                            <Typography
                                sx={{
                                    fontSize: theme.typography.body2.fontSize,
                                    color: "text.secondary",
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
                                    fontSize: theme.typography.body2.fontSize,
                                }}
                            >
                                {formattedDate}
                            </Typography>
                        );
                    } catch (error) {
                        return (
                            <Typography
                                sx={{
                                    fontSize: theme.typography.body2.fontSize,
                                    color: "text.secondary",
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
                sortable: true,
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
                sortable: true,
                renderCell: (params) => {
                    const created_at = params.value;
                    if (!created_at) {
                        return (
                            <Typography
                                sx={{
                                    fontSize: theme.typography.body2.fontSize,
                                    color: "text.secondary",
                                }}
                            >
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
                            <Typography
                                sx={{
                                    fontSize: theme.typography.body2.fontSize,
                                }}
                            >
                                {formattedDate}
                            </Typography>
                        );
                    } catch (error) {
                        return (
                            <Typography
                                sx={{
                                    fontSize: theme.typography.body2.fontSize,
                                    color: "text.secondary",
                                }}
                            >
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
                filterable: false,
                width: 80,
                renderCell: (params) => (
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                        <Tooltip
                            title={
                                params.row.active
                                    ? t(
                                        "actions.activity_templates_cannot_delete_active",
                                        { ns: "activity_templates" }
                                    )
                                    : t("common.actions.delete")
                            }
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
                                            color: "text.disabled",
                                        },
                                    }}
                                >
                                    <DeleteIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Box>
                ),
            },
        ],
        [t, handleDelete, session, theme, i18n.language]
    );

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

    // Add Automated Template Button Component
    const AddAutomatedTemplateButton = React.memo(() => {
        const { t, i18n } = useTranslation([
            "settings",
            "common",
            "activity_templates",
        ]);
        const theme = useTheme();

        if (!hasEditTemplatesPermission) {
            return null;
        }

        return (
            <Tooltip
                title={t("actions.activity_templates_add_template", {
                    ns: "activity_templates",
                })}
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
                        const backUrl = `/${locale}/app/settings?tab=templates&templateType=automated`;
                        router.push(
                            `/${locale}/app/settings/automated-templates/create?backUrl=${encodeURIComponent(backUrl)}`
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
                                backgroundColor: "primary.main",
                                color: "primary.contrastText",
                                borderRadius: "50%",
                                padding: theme.spacing(0.25),
                            }}
                        />
                    </Box>
                </IconButton>
            </Tooltip>
        );
    });

    AddAutomatedTemplateButton.displayName = "AddAutomatedTemplateButton";

    const customButtons = <AddAutomatedTemplateButton />;

    if (isLoading) {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: theme.spacing(50),
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
                    height: theme.spacing(50),
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
            <Box
                sx={{
                    width: "100%",
                    boxSizing: "border-box",
                    contain: "layout",
                    flexShrink: 0,
                }}
            >
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
                    {t("fields.automated_description", {
                        ns: "activity_templates",
                    })}
                </Typography>
            </Box>
            <Box
                sx={{
                    position: "relative",
                    isolation: "isolate",
                    flex: 1,
                    minHeight: 0,
                }}
            >
                <EndlessScrollDataGrid
                    key={`automated-templates-${debouncedSearch}-${queryKeyVersion}`}
                    rows={rows}
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
                    language={i18n.language}
                    fillViewport={true}
                    resizableColumns={true}
                    noRowsMessage={t(
                        "fields.activity_templates_no_automated_templates",
                        { ns: "activity_templates" }
                    )}
                    viewportRecalcDependency={queryKeyVersion}
                    noRowsDescription={t(
                        "actions.activity_templates_no_automated_templates_description",
                        { ns: "activity_templates" }
                    )}
                    onExport={handleExport}
                    exportContextInfo={{
                        pageName: "automated_templates",
                        customPrefix: "automated_templates_export",
                    }}
                />
            </Box>

            <DeleteDialog
                isOpen={deleteConfirmation.isOpen}
                onClose={() =>
                    setDeleteConfirmation({ isOpen: false, id: null })
                }
                onConfirm={confirmDelete}
                title={t("messages.delete_confirmation", {
                    ns: "activity_templates",
                })}
                description={t(
                    "messages.delete_activity_template_confirmation",
                    { ns: "activity_templates" }
                )}
                confirmLabel={t("actions.delete", { ns: "common" })}
                cancelLabel={t("actions.cancel", { ns: "common" })}
                isLoading={false}
                type="delete"
                maxWidth="sm"
                locale={i18n.language}
            />
        </Box>
    );
};

export default AutomatedTemplateList;
