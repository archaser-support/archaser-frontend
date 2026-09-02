"use client";

import {
    Assessment,
    Delete as DeleteIcon,
    PostAdd,
    Edit as EditIcon,
    ContentCopy as CloneIcon,
    Share as ShareIcon,
    Sync as SyncIcon,
} from "@mui/icons-material";
import {
    Box,
    Button,
    CircularProgress,
    IconButton,
    Tooltip,
    Switch,
    Link as MuiLink,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
    GridColDef,
    GridRenderCellParams,
    GridSortModel,
} from "@mui/x-data-grid";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { apiFetch } from "@/app/api";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import React, { useState, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import InternalPageWrapper from "@/components/InternalPageWrapper";
import PageHeader from "@/components/PageHeader";
import EndlessScrollDataGrid, {
    useVirtualInfiniteScroll,
    createQueryFn,
    BREAKPOINTS,
    useWindowWidth,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { MAIN_REPORTS_MENU_CONTEXT } from "@/shared/utils/viewConfigs";
import AppUrls from "@/utils/appUrls";
import {
    formatDateForDisplay,
    getUserDateLocale,
    getUserTimezone,
} from "@/utils/datetimeOperations";

const reportsMenuBuilderContextQuery = `context=${MAIN_REPORTS_MENU_CONTEXT}`;

type ReportAuditUser = {
    name?: string | null;
    username?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
};

function getReportAuditUserDisplayName(
    user: ReportAuditUser | null | undefined,
    fallback?: unknown
): string {
    const fullName = `${user?.first_name || ""} ${user?.last_name || ""}`.trim();
    return (
        user?.name?.trim() ||
        fullName ||
        user?.username?.trim() ||
        user?.email?.trim() ||
        (fallback == null ? "" : String(fallback)) ||
        "-"
    );
}

const ReportsPage: React.FC = () => {
    const { t, i18n } = useTranslation(["reports", "common"]);
    const router = useRouter();
    const params = useParams();
    const locale = (params?.locale as string) || "en";
    const theme = useTheme();
    const { data: session } = useSession();
    const queryClient = useQueryClient();
    const { success, error: showError } = useToast();

    const isAdmin = session?.user?.account_id === 10013;

    const userLocale = useMemo(() => getUserDateLocale(session), [session]);
    const userTimezone = useMemo(() => getUserTimezone(session), [session]);
    const formatAuditDate = useCallback(
        (value: unknown) => {
            if (value === null || value === undefined || value === "") {
                return "-";
            }
            return formatDateForDisplay(
                String(value),
                "datetime",
                userLocale,
                userTimezone
            );
        },
        [userLocale, userTimezone]
    );

    // Search state
    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search, 500);

    // Sorting state - default to modified_at desc
    const [sortModel, setSortModel] = useState<GridSortModel>([
        { field: "modified_at", sort: "desc" },
    ]);
    const [queryKeyVersion, setQueryKeyVersion] = useState(0);

    // Track previous values to prevent unnecessary resets
    const prevDebouncedSearchRef = useRef(debouncedSearch);

    // Multi-select (admin only)
    const [selectedReportIds, setSelectedReportIds] = useState<number[]>([]);

    // Delete confirmation state
    const [deleteConfirmation, setDeleteConfirmation] = useState<{
        isOpen: boolean;
        reportId: number | null;
        reportName: string | null;
    }>({
        isOpen: false,
        reportId: null,
        reportName: null,
    });

    // Sync confirmation state
    const [syncConfirmationOpen, setSyncConfirmationOpen] = useState(false);

    // Fetch user permissions
    const { data: userPermissionsData, isLoading: isLoadingPermissions } =
        useQuery<{ permissions: string[] }>({
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
            staleTime: 2 * 60 * 1000,
            // Ensure permissions are shared across all pages using the same query key
            refetchOnMount: false, // Use cached data if available
            refetchOnWindowFocus: false, // Don't refetch on window focus
        });

    const userPermissions = userPermissionsData?.permissions || [];
    const hasCreateReportPermission = userPermissions.includes("create_report");
    const hasEditReportPermission = userPermissions.includes("edit_report");
    const hasDeleteReportPermission = userPermissions.includes("delete_report");

    // Responsive column visibility
    const windowWidth = useWindowWidth();

    // Extract sort field and direction
    const sortField = sortModel[0]?.field;
    const sortDirection = sortModel[0]?.sort;

    // Query key
    const queryKey = useMemo(
        () => [
            "reports",
            {
                search: debouncedSearch,
                sortField,
                sortDirection,
                version: queryKeyVersion,
                // Master admin list is system-report catalog for sync; others see all saved reports.
                systemOnly: isAdmin,
            },
        ],
        [debouncedSearch, sortField, sortDirection, queryKeyVersion, isAdmin]
    );

    const reportsListParams = useMemo(
        () => ({
            search: debouncedSearch,
            sortField: sortField || "",
            sortDirection: sortDirection || "asc",
            context: "reports",
            ...(isAdmin ? { isSystem: "true" } : {}),
        }),
        [debouncedSearch, sortField, sortDirection, isAdmin]
    );

    // Use virtual infinite scroll hook
    const {
        data: reports,
        totalRecords,
        isLoading,
        hasMore,
        error,
        loadMore,
        reset,
    } = useVirtualInfiniteScroll({
        queryKey,
        queryFn: createQueryFn("/api/reports", reportsListParams, "reports"),
    });

    // Transform reports to grid rows - ensure stable IDs
    const rows = useMemo(() => {
        const allReports = reports || [];

        return allReports.map((report: any) => {
            const createdByUser = report.User_Report_created_byToUser;
            const modifiedByUser = report.User_Report_modified_byToUser;
            return {
                id: report.id, // CRITICAL: Stable ID required for virtual scrolling
                name: report.name || "",
                context: report.context || "",
                description: report.description || "",
                created_at: report.created_at,
                created_by: getReportAuditUserDisplayName(createdByUser),
                modified_at: report.modified_at,
                modified_by: getReportAuditUserDisplayName(modifiedByUser),
                is_system: report.is_system || false,
                is_shared: report.is_shared || false,
                account_id: report.account_id,
                User_Report_created_byToUser: createdByUser,
                User_Report_modified_byToUser: modifiedByUser,
                raw: report, // Original entity for nested data access
            };
        });
    }, [reports]);

    // Delete mutation
    const deleteReportMutation = useMutation({
        mutationFn: async (reportId: number) => {
            const response = await api.delete(`/api/reports/${reportId}`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["reports"] });
            setQueryKeyVersion((prev) => prev + 1);
            reset();
            setDeleteConfirmation({
                isOpen: false,
                reportId: null,
                reportName: null,
            });
            success(t("messages.delete_success", { ns: "reports" }));
        },
        onError: (error: any) => {
            showError(
                error.response?.data?.error ||
                    t("messages.error_deleting", { ns: "reports" })
            );
        },
    });

    // Handle delete click
    const handleDeleteClick = useCallback(
        (reportId: number, reportName: string) => {
            setDeleteConfirmation({
                isOpen: true,
                reportId,
                reportName,
            });
        },
        []
    );

    // Confirm delete
    const confirmDelete = useCallback(async () => {
        if (!deleteConfirmation.reportId) {
            return;
        }

        await deleteReportMutation.mutateAsync(deleteConfirmation.reportId);
    }, [deleteConfirmation.reportId, deleteReportMutation]);

    const syncReportsMutation = useMutation({
        mutationFn: async (reportIds: number[]) => {
            const response = await api.post("/api/reports/sync-system", {
                reportIds,
            });
            return response.data as {
                syncedReports: number;
                targetAccounts: number;
                created: number;
                updated: number;
            };
        },
        onSuccess: (data) => {
            setSyncConfirmationOpen(false);
            setSelectedReportIds([]);
            success(
                t("messages.sync_success", {
                    ns: "reports",
                    defaultValue:
                        "Synced {{syncedReports}} reports to {{targetAccounts}} accounts.",
                    syncedReports: data.syncedReports,
                    targetAccounts: data.targetAccounts,
                })
            );
        },
        onError: (error: any) => {
            showError(
                error.response?.data?.error ||
                    t("messages.sync_error", {
                        ns: "reports",
                        defaultValue: "Failed to sync reports",
                    })
            );
        },
    });

    const confirmSync = useCallback(async () => {
        if (!selectedReportIds.length) return;
        await syncReportsMutation.mutateAsync(selectedReportIds);
    }, [selectedReportIds, syncReportsMutation]);

    // Handle row click
    const handleRowClick = useCallback(
        (row: any) => {
            router.push(`/${locale}${AppUrls.REPORT_DETAILS(row.id)}`);
        },
        [router, locale]
    );

    // Reset when search changes (but not for sort changes)
    React.useEffect(() => {
        const searchChanged =
            prevDebouncedSearchRef.current !== debouncedSearch;

        if (searchChanged) {
            prevDebouncedSearchRef.current = debouncedSearch;

            // Increment version to force new query
            setQueryKeyVersion((prev) => prev + 1);

            // Reset immediately when search changes
            reset();
        }
    }, [debouncedSearch, reset]);

    // Export function
    const handleExport = useCallback(async () => {
        const params = new URLSearchParams({
            search: debouncedSearch,
            sortField: sortField || "",
            sortDirection: sortDirection || "asc",
            context: "reports",
            ...(isAdmin ? { isSystem: "true" } : {}),
            export: "true",
            limit: "10000",
        });

        const response = await apiFetch(`/api/reports?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.reports || [];
    }, [debouncedSearch, sortField, sortDirection, isAdmin]);

    const columns: GridColDef[] = useMemo(() => {
        const cols = [
            {
                field: "name",
                headerName: t("fields.name"),
                flex: 1.5,
                minWidth: isAdmin ? 200 : 250, // Reduce minWidth for admin to accommodate extra columns
                renderCell: (params: GridRenderCellParams) => {
                    const reportUrl = `/${locale}${AppUrls.REPORT_DETAILS(params.row.id)}`;
                    return (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                height: "100%",
                                width: "100%",
                            }}
                        >
                            <MuiLink
                                key="report-name-link"
                                component={Link}
                                href={reportUrl}
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
                                    component="span"
                                    variant="body2"
                                    sx={{
                                        fontWeight: theme.typography.fontWeightMedium,
                                        color: "inherit",
                                    }}
                                >
                                    {String(params.value || "")}
                                </Typography>
                            </MuiLink>
                            {params.row.is_shared ? (
                                <Tooltip
                                    key="shared-report-icon"
                                    title={t("reports.tooltips.shared_report", {
                                        defaultValue: "Shared Report",
                                    })}
                                    arrow
                                    placement="bottom"
                                >
                                    <ShareIcon
                                        fontSize="small"
                                        sx={{
                                            color: theme.palette.primary.main,
                                            fontSize: "1rem",
                                        }}
                                    />
                                </Tooltip>
                            ) : null}
                        </Box>
                    );
                },
            },
            // Show context column for admins
            ...(isAdmin
                ? [
                      {
                          field: "context",
                          headerName: "Context",
                          flex: 1,
                          minWidth: 120,
                          renderCell: (params: GridRenderCellParams) => (
                              <Typography variant="body2">
                                  {params.value || "-"}
                              </Typography>
                          ),
                      },
                  ]
                : []),
            // Show System column for admins
            ...(isAdmin
                ? [
                      {
                          field: "is_system",
                          headerName: t("fields.system", "System"),
                          flex: 0.8,
                          minWidth: 80,
                          renderCell: (params: GridRenderCellParams) => {
                              const isSystem =
                                  params.value ||
                                  params.row.is_system ||
                                  params.row.raw?.is_system;
                              return (
                                  <Box
                                      sx={{
                                          display: "flex",
                                          alignItems: "center",
                                          height: "100%",
                                          width: "100%",
                                      }}
                                  >
                                      <Switch checked={!!isSystem} disabled />
                                  </Box>
                              );
                          },
                      },
                  ]
                : []),
            {
                field: "description",
                headerName: t("fields.description"),
                flex: 3,
                minWidth: isAdmin ? 200 : 300, // Reduce minWidth for admin to accommodate extra columns
                renderCell: (params: GridRenderCellParams) => (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            height: "100%",
                            width: "100%",
                        }}
                    >
                        <Typography variant="body2">
                            {String(params.value || "")}
                        </Typography>
                    </Box>
                ),
            },
            {
                field: "created_at",
                headerName: t("fields.created_at"),
                flex: 1,
                minWidth: 100,
                renderCell: (params: GridRenderCellParams) => (
                    <Typography variant="body2">
                        {formatAuditDate(
                            params.row.created_at || params.value
                        )}
                    </Typography>
                ),
            },
            {
                field: "created_by",
                headerName: t("fields.created_by", { ns: "common" }),
                flex: 1,
                minWidth: isAdmin ? 120 : 150, // Reduce minWidth for admin to accommodate extra columns
                renderCell: (params: GridRenderCellParams) => {
                    const user =
                        params.row.raw?.User_Report_created_byToUser ||
                        params.row.User_Report_created_byToUser;
                    const displayName = getReportAuditUserDisplayName(
                        user,
                        params.value
                    );
                    return (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                height: "100%",
                                width: "100%",
                            }}
                        >
                            <Typography variant="body2" color="text.secondary">
                                {displayName}
                            </Typography>
                        </Box>
                    );
                },
            },
            {
                field: "modified_at",
                headerName: t("fields.modified_at"),
                flex: 1,
                minWidth: 100,
                renderCell: (params: GridRenderCellParams) => (
                    <Typography variant="body2">
                        {formatAuditDate(
                            params.row.modified_at || params.value
                        )}
                    </Typography>
                ),
            },
            {
                field: "modified_by",
                headerName: t("fields.modified_by", { ns: "common" }),
                flex: 1,
                minWidth: isAdmin ? 120 : 150, // Reduce minWidth for admin to accommodate extra columns
                renderCell: (params: GridRenderCellParams) => {
                    const user =
                        params.row.raw?.User_Report_modified_byToUser ||
                        params.row.User_Report_modified_byToUser;
                    const displayName = getReportAuditUserDisplayName(
                        user,
                        params.value
                    );
                    return (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                height: "100%",
                                width: "100%",
                            }}
                        >
                            <Typography variant="body2" color="text.secondary">
                                {displayName}
                            </Typography>
                        </Box>
                    );
                },
            },
            // Only include actions column if user has edit or delete permissions
            ...((hasDeleteReportPermission || hasEditReportPermission) &&
            !isLoadingPermissions
                ? [
                      {
                          field: "actions",
                          headerName: t("actions.actions", { ns: "common" }),
                          width: 140,
                          minWidth: 140,
                          maxWidth: 140,
                          sortable: false,
                          filterable: false,
                          disableColumnMenu: true,
                          resizable: false,
                          flex: 0, // Always fixed width - never expand
                          renderCell: (params: GridRenderCellParams) => {
                              // Disable edit/delete for system reports if current user's account is not 10013
                              const isSystemReport =
                                  params.row.is_system === true;
                              const isEditDisabled = isSystemReport && !isAdmin;
                              const isDeleteDisabled =
                                  isSystemReport && !isAdmin;

                              return (
                                  <Box
                                      sx={{
                                          display: "flex",
                                          gap: 0.5,
                                          alignItems: "center",
                                          height: "100%",
                                          width: "100%",
                                      }}
                                  >
                                      {hasEditReportPermission && (
                                          <Tooltip
                                              title={
                                                  isEditDisabled
                                                      ? t(
                                                            "messages.cannot_edit_system_report",
                                                            {
                                                                ns: "reports",
                                                            }
                                                        )
                                                      : t(
                                                            "actions.edit_report",
                                                            {
                                                                ns: "reports",
                                                            }
                                                        )
                                              }
                                              arrow
                                              enterDelay={300}
                                              leaveDelay={100}
                                              placement="bottom"
                                              PopperProps={{
                                                  sx: {
                                                      "& .MuiTooltip-tooltip": {
                                                          direction:
                                                              i18n.language ===
                                                              "he"
                                                                  ? "rtl"
                                                                  : "ltr",
                                                      },
                                                      "& .MuiTooltip-arrow": {
                                                          ...(i18n.language ===
                                                              "he" && {
                                                              transform:
                                                                  "scaleX(-1)",
                                                          }),
                                                      },
                                                  },
                                              }}
                                          >
                                              <span>
                                                  <IconButton
                                                      color="primary"
                                                      size="small"
                                                      disabled={isEditDisabled}
                                                      onClick={(e) => {
                                                          if (isEditDisabled)
                                                              return;
                                                          e.preventDefault();
                                                          e.stopPropagation();
                                                          router.push(
                                                              `/${locale}${AppUrls.REPORT_BUILDER}?id=${params.row.id}&${reportsMenuBuilderContextQuery}`
                                                          );
                                                      }}
                                                      className="toolbar-button"
                                                  >
                                                      <EditIcon fontSize="small" />
                                                  </IconButton>
                                              </span>
                                          </Tooltip>
                                      )}
                                      {hasEditReportPermission && (
                                          <Tooltip
                                              title={t("clone_report", {
                                                  ns: "reports",
                                                  defaultValue: "Clone Report",
                                              })}
                                              arrow
                                              enterDelay={300}
                                              leaveDelay={100}
                                              placement="bottom"
                                              PopperProps={{
                                                  sx: {
                                                      "& .MuiTooltip-tooltip": {
                                                          direction:
                                                              i18n.language ===
                                                              "he"
                                                                  ? "rtl"
                                                                  : "ltr",
                                                      },
                                                      "& .MuiTooltip-arrow": {
                                                          ...(i18n.language ===
                                                              "he" && {
                                                              transform:
                                                                  "scaleX(-1)",
                                                          }),
                                                      },
                                                  },
                                              }}
                                          >
                                              <span>
                                                  <IconButton
                                                      color="primary"
                                                      size="small"
                                                      onClick={(e) => {
                                                          e.preventDefault();
                                                          e.stopPropagation();
                                                          router.push(
                                                              `/${locale}${AppUrls.REPORT_BUILDER}?id=${params.row.id}&clone=true&${reportsMenuBuilderContextQuery}`
                                                          );
                                                      }}
                                                      className="toolbar-button"
                                                  >
                                                      <CloneIcon fontSize="small" />
                                                  </IconButton>
                                              </span>
                                          </Tooltip>
                                      )}
                                      {hasDeleteReportPermission && (
                                          <Tooltip
                                              title={
                                                  isDeleteDisabled
                                                      ? t(
                                                            "messages.cannot_delete_system_report",
                                                            {
                                                                ns: "reports",
                                                            }
                                                        )
                                                      : t("actions.delete", {
                                                            ns: "common",
                                                        })
                                              }
                                              arrow
                                              enterDelay={300}
                                              leaveDelay={100}
                                              placement="bottom"
                                              PopperProps={{
                                                  sx: {
                                                      "& .MuiTooltip-tooltip": {
                                                          direction:
                                                              i18n.language ===
                                                              "he"
                                                                  ? "rtl"
                                                                  : "ltr",
                                                      },
                                                      "& .MuiTooltip-arrow": {
                                                          ...(i18n.language ===
                                                              "he" && {
                                                              transform:
                                                                  "scaleX(-1)",
                                                          }),
                                                      },
                                                  },
                                              }}
                                          >
                                              <span>
                                                  <IconButton
                                                      color="primary"
                                                      size="small"
                                                      disabled={
                                                          isDeleteDisabled
                                                      }
                                                      onClick={(e) => {
                                                          if (isDeleteDisabled)
                                                              return;
                                                          e.preventDefault();
                                                          e.stopPropagation();
                                                          handleDeleteClick(
                                                              params.row.id,
                                                              params.row.name
                                                          );
                                                      }}
                                                      className="toolbar-button"
                                                  >
                                                      <DeleteIcon fontSize="small" />
                                                  </IconButton>
                                              </span>
                                          </Tooltip>
                                      )}
                                  </Box>
                              );
                          },
                      },
                  ]
                : []),
        ];

        return cols;
    }, [
        isAdmin,
        t,
        theme,
        router,
        locale,
        hasEditReportPermission,
        hasDeleteReportPermission,
        handleDeleteClick,
        isLoadingPermissions,
        i18n.language,
        formatAuditDate,
    ]);

    // Error state
    if (error) {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: theme.spacing(50),
                    flexDirection: "column",
                    gap: theme.spacing(2),
                }}
            >
                <Typography variant="h6" color="error">
                    {t("messages.error_fetching_data")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {error instanceof Error
                        ? error.message
                        : "Unknown error occurred"}
                </Typography>
                <Button variant="outlined" color="primary" onClick={reset}>
                    {t("actions.retry", { ns: "common" })}
                </Button>
            </Box>
        );
    }

    // Shell matches CustomerList / report detail: no flex/minHeight on outer page so
    // fillViewport + useViewportHeight(main bottom) measure correctly.
    return (
        <InternalPageWrapper>
            <Box
                sx={{
                    bgcolor: "background.default",
                    borderRadius: theme.shape.borderRadius,
                }}
            >
                <PageHeader
                    title={t("sections.title")}
                    description={t("sections.title_description")}
                />

                {/* Grid - mount only after permissions have loaded so viewport height is correct */}
                {isLoadingPermissions ? (
                    <Box
                        sx={{
                            minHeight: 400,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: "background.paper",
                            borderRadius: 1,
                        }}
                    >
                        <CircularProgress />
                    </Box>
                ) : (
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
                        <EndlessScrollDataGrid
                        key={`reports-${debouncedSearch}-${queryKeyVersion}-${isAdmin}`}
                        rows={rows}
                        columns={columns}
                        totalRecords={totalRecords}
                        isLoading={isLoading}
                        onLoadMore={loadMore}
                        hasMore={hasMore}
                        sortModel={sortModel}
                        onSortModelChange={setSortModel}
                        onRowClick={handleRowClick}
                        enableMultiSelect={isAdmin}
                        selectedRowIds={selectedReportIds}
                        onSelectionChange={(ids) => {
                            // Grid supports string/number IDs; reports are numeric
                            const numericIds = ids
                                .map((id) =>
                                    typeof id === "string"
                                        ? parseInt(id, 10)
                                        : id
                                )
                                .filter(
                                    (id): id is number =>
                                        typeof id === "number" &&
                                        !Number.isNaN(id)
                                );
                            setSelectedReportIds(numericIds);
                        }}
                        columnVisibilityModel={{
                            name: true, // Always visible
                            context:
                                isAdmin && windowWidth >= BREAKPOINTS.MOBILE, // Visible on mobile+ for admin
                            is_system:
                                isAdmin && windowWidth >= BREAKPOINTS.MOBILE, // Visible on mobile+ for admin
                            description: windowWidth >= BREAKPOINTS.MOBILE, // Visible on mobile+
                            created_at: windowWidth >= BREAKPOINTS.TABLET, // Visible on tablet+
                            created_by: windowWidth >= BREAKPOINTS.TABLET, // Visible on tablet+
                            modified_at: windowWidth >= BREAKPOINTS.DESKTOP, // Visible on desktop+
                            modified_by: windowWidth >= BREAKPOINTS.DESKTOP, // Visible on desktop+
                            actions:
                                (hasDeleteReportPermission ||
                                    hasEditReportPermission) &&
                                !isLoadingPermissions, // Only visible if user has permissions
                        }}
                        resizableColumns={true}
                        bulkActionButton={
                            isAdmin ? (
                                <Tooltip
                                    title={t("actions.sync_to_all_accounts", {
                                        ns: "reports",
                                        defaultValue: "Sync to all accounts",
                                    })}
                                    arrow
                                    enterDelay={300}
                                    leaveDelay={100}
                                    placement="bottom"
                                    PopperProps={{
                                        sx: {
                                            "& .MuiTooltip-tooltip": {
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                            },
                                            "& .MuiTooltip-arrow": {
                                                ...(i18n.language === "he" && {
                                                    transform: "scaleX(-1)",
                                                }),
                                            },
                                        },
                                    }}
                                >
                                    <span>
                                        <IconButton
                                            color="primary"
                                            size="small"
                                            onClick={() =>
                                                setSyncConfirmationOpen(true)
                                            }
                                            disabled={!selectedReportIds.length}
                                            className="toolbar-button"
                                        >
                                            <SyncIcon fontSize="small" />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            ) : undefined
                        }
                        customButtons={
                            <Box
                                sx={{
                                    display: "flex",
                                    gap: theme.spacing(2),
                                    alignItems: "center",
                                }}
                            >
                                {hasCreateReportPermission && (
                                    <Tooltip
                                        title={t("actions.create_report")}
                                        arrow
                                        enterDelay={300}
                                        leaveDelay={100}
                                        placement="bottom"
                                        PopperProps={{
                                            sx: {
                                                "& .MuiTooltip-tooltip": {
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                },
                                                "& .MuiTooltip-arrow": {
                                                    ...(i18n.language ===
                                                        "he" && {
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
                                                router.push(
                                                    `/${locale}${AppUrls.REPORT_BUILDER}?${reportsMenuBuilderContextQuery}`
                                                );
                                            }}
                                            className="toolbar-button"
                                        >
                                            <PostAdd />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Box>
                        }
                        searchValue={search}
                        onSearchChange={setSearch}
                        searchPlaceholder={t("fields.search_placeholder", {
                            ns: "common",
                        })}
                        searchDebounceMs={500}
                        searchDirection={i18n.language === "he" ? "rtl" : "ltr"}
                        language={i18n.language}
                        fillViewport={true}
                        viewportRecalcDependency={!isLoadingPermissions}
                        onExport={handleExport}
                        exportDisabled={false}
                        exportContextInfo={{
                            pageName: "reports",
                            customPrefix: "reports_export",
                        }}
                        noRowsMessage={t("messages.no_results", {
                            ns: "common",
                        })}
                        noRowsDescription={t(
                            "messages.no_results_description",
                            {
                                ns: "common",
                            }
                        )}
                    />
                    </Box>
                )}

                <DeleteDialog
                    isOpen={deleteConfirmation.isOpen}
                    onClose={() =>
                        setDeleteConfirmation({
                            isOpen: false,
                            reportId: null,
                            reportName: null,
                        })
                    }
                    onConfirm={confirmDelete}
                    title={t("messages.delete_confirm_title", { ns: "reports" })}
                    description={
                        deleteConfirmation.reportName ? (
                            <>
                                {t("messages.delete_confirm_description_prefix", {
                                    ns: "reports",
                                })}
                                <Box component="span" sx={{ fontWeight: 600 }}>
                                    &quot;{deleteConfirmation.reportName}&quot;
                                </Box>
                                {t("messages.delete_confirm_description_suffix", {
                                    ns: "reports",
                                })}
                            </>
                        ) : (
                            t("messages.delete_confirmation_no_name", {
                                ns: "reports",
                            })
                        )
                    }
                    confirmLabel={t("actions.delete", { ns: "common" })}
                    cancelLabel={t("actions.cancel", { ns: "common" })}
                    isLoading={deleteReportMutation.isPending}
                    type="delete"
                    maxWidth="sm"
                    locale={i18n.language}
                    errorMessage={
                        deleteReportMutation.error
                            ? (deleteReportMutation.error as any)?.response?.data
                                  ?.error ||
                              t("messages.error_deleting", { ns: "reports" })
                            : undefined
                    }
                />

                <DeleteDialog
                    isOpen={syncConfirmationOpen}
                    onClose={() => setSyncConfirmationOpen(false)}
                    onConfirm={confirmSync}
                    title={t("messages.sync_confirm_title", {
                        ns: "reports",
                        defaultValue: "Sync selected reports",
                    })}
                    description={t("messages.sync_confirm_description", {
                        ns: "reports",
                        defaultValue:
                            "This will sync {{count}} selected system report(s) from the master admin account to all other active accounts. Continue?",
                        count: selectedReportIds.length,
                    })}
                    confirmLabel={t("actions.sync", {
                        ns: "reports",
                        defaultValue: "Sync",
                    })}
                    cancelLabel={t("actions.cancel", { ns: "common" })}
                    isLoading={syncReportsMutation.isPending}
                    showConfirmSpinner={false}
                    confirmDisabled={!selectedReportIds.length}
                    type="info"
                    maxWidth="sm"
                    locale={i18n.language}
                    errorMessage={
                        syncReportsMutation.error
                            ? (syncReportsMutation.error as any)?.response?.data
                                  ?.error ||
                              t("messages.sync_error", {
                                  ns: "reports",
                                  defaultValue: "Failed to sync reports",
                              })
                            : undefined
                    }
                />
            </Box>
        </InternalPageWrapper>
    );
};

export default ReportsPage;
